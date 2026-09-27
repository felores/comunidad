import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const image = "sociedad-paralela:p0-local";
const runId = `sp-oauth-runtime-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const hostDirectory = `/dev/shm/${runId}`;
const targetDirectory = "/run/sp-oauth-handoff";
const secretFifo = `${targetDirectory}/client-secret.pipe`;
const resultFifo = `${targetDirectory}/result.pipe`;
const fixture = resolve("tests/fixtures/sp-load-coolify-secret-stub");
const handoffModule = resolve("scripts/oauth-handoff.mjs");
const sentinel = "runtime-oauth-secret-sentinel";
const consumerName = `${runId}-consumer`;
const producerName = `${runId}-producer`;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function collect(child) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  return {
    exited: new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal }))),
    output: () => ({ stdout, stderr }),
  };
}

function setupDirectory() {
  docker([
    "run", "--rm",
    "--mount", "type=bind,src=/dev/shm,target=/host-shm",
    "alpine:3.22", "sh", "-ceu", `
      mkdir -p "/host-shm/${runId}"
      chown 0:10000 "/host-shm/${runId}"
      chmod 1770 "/host-shm/${runId}"
      mkfifo "/host-shm/${runId}/client-secret.pipe" "/host-shm/${runId}/result.pipe"
      chown 10001:10002 "/host-shm/${runId}/client-secret.pipe"
      chown 10002:10001 "/host-shm/${runId}/result.pipe"
      chmod 0640 "/host-shm/${runId}/client-secret.pipe" "/host-shm/${runId}/result.pipe"
    `,
  ]);
}

function cleanupDirectory() {
  spawnSync("docker", [
    "run", "--rm",
    "--mount", "type=bind,src=/dev/shm,target=/host-shm",
    "alpine:3.22", "rm", "-rf", `/host-shm/${runId}`,
  ], { stdio: "ignore" });
}

function consumerArguments(deadlineEpoch) {
  return [
    "run", "--rm", "--platform", "linux/amd64",
    "--name", consumerName,
    "--user", "10002:10002", "--group-add", "10000",
    "--mount", `type=bind,src=${hostDirectory},target=${targetDirectory}`,
    "--mount", `type=bind,src=${fixture},target=/app/ops/sp-load-coolify-secret,readonly`,
    "--env", `HANDOFF_DEADLINE_EPOCH=${deadlineEpoch}`,
    "--env", `HANDOFF_FIFO=${secretFifo}`,
    "--env", `HANDOFF_RESULT_FIFO=${resultFifo}`,
    "--entrypoint", "/app/ops/start-coolify-secret-loader",
    image,
  ];
}

try {
  setupDirectory();
  const deadlineEpoch = Math.floor(Date.now() / 1000) + 10;
  const consumer = spawn("docker", consumerArguments(deadlineEpoch), { stdio: ["ignore", "pipe", "pipe"] });
  const consumerRun = collect(consumer);
  const producerCode = `
    import { deliverOAuthSecret } from "file:///test/oauth-handoff.mjs";
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const secret = Buffer.concat(chunks).toString("utf8").replace(/\\n$/, "");
    await deliverOAuthSecret({
      secret,
      clientId: "client-runtime-proof",
      secretFifo: "${secretFifo}",
      resultFifo: "${resultFifo}",
      handoffId: "${runId}",
      deadlineEpoch: ${deadlineEpoch},
      readyGroupId: 10000,
    });
  `;
  const producer = spawn("docker", [
    "run", "--rm", "--interactive", "--platform", "linux/amd64",
    "--name", producerName,
    "--user", "10001:10001", "--group-add", "10000",
    "--mount", `type=bind,src=${hostDirectory},target=${targetDirectory}`,
    "--mount", `type=bind,src=${handoffModule},target=/test/oauth-handoff.mjs,readonly`,
    "--entrypoint", "node",
    image, "--input-type=module", "--eval", producerCode,
  ], { stdio: ["pipe", "pipe", "pipe"] });
  const producerRun = collect(producer);
  producer.stdin.end(`${sentinel}\n`);

  const runTimeout = new Promise((_, reject) => setTimeout(
    () => reject(new Error("OAuth handoff runtime proof exceeded its deadline")),
    15_000,
  ));
  const [producerExit, consumerExit] = await Promise.race([
    Promise.all([producerRun.exited, consumerRun.exited]),
    runTimeout,
  ]);
  if (producerExit.code !== 0 || consumerExit.code !== 0) {
    const details = JSON.stringify({
      producer: producerRun.output(),
      consumer: consumerRun.output(),
    }).replaceAll(sentinel, "<redacted>");
    throw new Error(
      `OAuth handoff failed: producer=${producerExit.code} consumer=${consumerExit.code} ${details}`,
    );
  }
  const combinedOutput = JSON.stringify([producerRun.output(), consumerRun.output()]);
  if (combinedOutput.includes(sentinel)) throw new Error("OAuth client secret appeared in process output");

  const statOutput = docker([
    "run", "--rm",
    "--mount", `type=bind,src=${hostDirectory},target=${targetDirectory}`,
    "alpine:3.22", "stat", "-c", "%a %u:%g %F %n",
    targetDirectory, secretFifo, resultFifo, `${targetDirectory}/ready.json`,
  ]);
  const expected = [
    `1770 0:10000 directory ${targetDirectory}`,
    `640 10001:10002 fifo ${secretFifo}`,
    `640 10002:10001 fifo ${resultFifo}`,
    `640 10001:10000 regular file ${targetDirectory}/ready.json`,
  ];
  for (const line of expected) {
    if (!statOutput.includes(line)) throw new Error(`Unexpected handoff permissions: ${statOutput}`);
  }

  cleanupDirectory();
  setupDirectory();
  const timeoutStarted = Date.now();
  const timedOut = spawnSync("docker", consumerArguments(Math.floor(Date.now() / 1000) + 2), {
    encoding: "utf8",
    timeout: 5_000,
  });
  const elapsed = Date.now() - timeoutStarted;
  if (timedOut.status === 0 || elapsed > 4_500) {
    throw new Error(`Consumer FIFO open was not bounded: status=${timedOut.status} elapsed=${elapsed}`);
  }

  console.log("OAuth handoff runtime proof passed with exact UIDs, GIDs, FIFO modes, shared tmpfs binding, and bounded open.");
} finally {
  spawnSync("docker", ["rm", "--force", consumerName, producerName], { stdio: "ignore" });
  cleanupDirectory();
}
