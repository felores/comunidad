import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth, createAuthOptions } from "../src/server/auth.ts";
import { MemoryEmailProvider } from "../src/server/email.ts";

const image = "sociedad-paralela:p0-local";
const runId = `sp-oauth-provisioning-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const network = `${runId}-network`;
const databaseContainer = `${runId}-db`;
const receiverContainer = `${runId}-receiver`;
const publicOrigin = "https://sociedadparalela.test";
const authSecret = "disposable-auth-secret-at-least-32-characters";
const databasePassword = "disposable-postgres-password";
const coolifyToken = "disposable-coolify-token";
const receiverFixture = resolve("tests/fixtures/coolify-secret-receiver.mjs");
const temporaryDirectory = resolve(".scratchpad", runId);
const tlsDirectory = join(temporaryDirectory, "tls");
const evidenceDirectory = join(temporaryDirectory, "evidence");
let pool;
let auth;
let email;

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", ...options }).trim();
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

async function waitForDatabase(connectionString) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = new Pool({ connectionString, connectionTimeoutMillis: 500 });
    try {
      await candidate.query("select 1");
      await candidate.end();
      return;
    } catch {
      await candidate.end().catch(() => undefined);
      await delay(250);
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready");
}

async function createProvisioner() {
  const registration = await auth.handler(new Request(`${publicOrigin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: publicOrigin, "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify({
      name: "OAuth Provisioner",
      email: "oauth-provisioner@example.com",
      password: "disposable provisioner password",
      callbackURL: "/cuenta-verificada",
    }),
  }));
  if (!registration.ok) throw new Error("Could not create OAuth provisioner");
  const verificationUrl = new URL(email.messages[0].url);
  const verified = await auth.handler(new Request(verificationUrl, { redirect: "manual" }));
  if (![302, 303].includes(verified.status)) throw new Error("Could not verify OAuth provisioner");
  return email;
}

async function loginProvisioner() {
  const response = await auth.handler(new Request(`${publicOrigin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: publicOrigin, "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify({
      email: "oauth-provisioner@example.com",
      password: "disposable provisioner password",
    }),
  }));
  if (!response.ok) throw new Error("Could not sign in OAuth provisioner");
  const cookie = response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const sessionResponse = await auth.handler(new Request(`${publicOrigin}/api/auth/get-session`, {
    headers: { cookie, origin: publicOrigin },
  }));
  const session = await sessionResponse.json();
  if (!session?.user?.id) throw new Error("Could not resolve OAuth provisioner session");
  return { cookie, userId: session.user.id };
}

async function assertSessionRevoked(cookie) {
  const response = await auth.handler(new Request(`${publicOrigin}/api/auth/get-session`, {
    headers: { cookie, origin: publicOrigin },
  }));
  if (await response.json() !== null) throw new Error("OAuth provisioner session was not revoked");
}

function prepareHandoff(suffix) {
  const hostDirectory = `/dev/shm/${runId}-${suffix}`;
  docker([
    "run", "--rm", "--mount", "type=bind,src=/dev/shm,target=/host-shm",
    "alpine:3.22", "sh", "-ceu", `
      mkdir -p "/host-shm/${runId}-${suffix}"
      chown 0:10000 "/host-shm/${runId}-${suffix}"
      chmod 1770 "/host-shm/${runId}-${suffix}"
      mkfifo "/host-shm/${runId}-${suffix}/client-secret.pipe" "/host-shm/${runId}-${suffix}/result.pipe"
      chown 10001:10002 "/host-shm/${runId}-${suffix}/client-secret.pipe"
      chown 10002:10001 "/host-shm/${runId}-${suffix}/result.pipe"
      chmod 0640 "/host-shm/${runId}-${suffix}/client-secret.pipe" "/host-shm/${runId}-${suffix}/result.pipe"
    `,
  ]);
  return hostDirectory;
}

async function startReceiver(responseStatus) {
  spawnSync("docker", ["rm", "--force", receiverContainer], { stdio: "ignore" });
  await rm(join(evidenceDirectory, "result.json"), { force: true });
  docker([
    "run", "--detach", "--rm", "--name", receiverContainer,
    "--network", network, "--network-alias", "coolify-receiver",
    "--user", "0:0",
    "--mount", `type=bind,src=${receiverFixture},target=/test/receiver.mjs,readonly`,
    "--mount", `type=bind,src=${tlsDirectory},target=/tls,readonly`,
    "--mount", `type=bind,src=${evidenceDirectory},target=/evidence`,
    "--env", `EXPECTED_COOLIFY_TOKEN=${coolifyToken}`,
    "--env", `RESPONSE_STATUS=${responseStatus}`,
    "--entrypoint", "node", image, "/test/receiver.mjs",
  ]);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (docker(["logs", receiverContainer]).includes("coolify-receiver-ready")) return;
    await delay(100);
  }
  throw new Error("Disposable Coolify receiver did not become ready");
}

async function runHandoff({ suffix, responseStatus, session, expectedSuccess }) {
  await startReceiver(responseStatus);
  const hostDirectory = prepareHandoff(suffix);
  const deadlineEpoch = Math.floor(Date.now() / 1000) + 20;
  const producerEnv = join(temporaryDirectory, `producer-${suffix}.env`);
  const consumerEnv = join(temporaryDirectory, `consumer-${suffix}.env`);
  await writeFile(producerEnv, [
    "NODE_ENV=production",
    `BETTER_AUTH_URL=${publicOrigin}`,
    `BETTER_AUTH_SECRET=${authSecret}`,
    `AUTH_DATABASE_URL=postgresql://sp_auth:${databasePassword}@${databaseContainer}:5432/sp_auth`,
    `REMARK42_URL=${publicOrigin}/comentarios`,
    "REMARK42_PROVIDER_NAME=sociedad-paralela",
    `REMARK42_OAUTH_PROVISIONER_USER_ID=${session.userId}`,
    `REMARK42_OAUTH_PROVISIONER_SESSION_COOKIE=${session.cookie}`,
    "REMARK42_OAUTH_SECRET_FIFO=/run/sp-oauth-handoff/client-secret.pipe",
    "REMARK42_OAUTH_RESULT_FIFO=/run/sp-oauth-handoff/result.pipe",
    `HANDOFF_ID=${runId}-${suffix}`,
    `HANDOFF_DEADLINE_EPOCH=${deadlineEpoch}`,
    "HANDOFF_SHARED_GID=10000",
    "",
  ].join("\n"), { mode: 0o600 });
  await writeFile(consumerEnv, [
    "COOLIFY_API_BASE_URL=https://coolify-receiver:8443/api/v1",
    "COOLIFY_SERVICE_ID=service-test",
    "COOLIFY_APPROVED_API_BASE_URL=https://coolify-receiver:8443/api/v1",
    "COOLIFY_APPROVED_SERVICE_ID=service-test",
    `COOLIFY_API_TOKEN=${coolifyToken}`,
    "HANDOFF_FIFO=/run/sp-oauth-handoff/client-secret.pipe",
    "HANDOFF_RESULT_FIFO=/run/sp-oauth-handoff/result.pipe",
    `HANDOFF_DEADLINE_EPOCH=${deadlineEpoch}`,
    "NODE_EXTRA_CA_CERTS=/tls/ca.crt",
    "",
  ].join("\n"), { mode: 0o600 });

  const consumerName = `${runId}-${suffix}-consumer`;
  const producerName = `${runId}-${suffix}-producer`;
  const consumer = spawn("docker", [
    "run", "--rm", "--name", consumerName, "--platform", "linux/amd64",
    "--network", network, "--user", "10002:10002", "--group-add", "10000",
    "--mount", `type=bind,src=${hostDirectory},target=/run/sp-oauth-handoff`,
    "--mount", `type=bind,src=${tlsDirectory},target=/tls,readonly`,
    "--env-file", consumerEnv,
    "--entrypoint", "/app/ops/start-coolify-secret-loader", image,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const consumerRun = collect(consumer);
  const producer = spawn("docker", [
    "run", "--rm", "--name", producerName, "--platform", "linux/amd64",
    "--network", network, "--user", "10001:10001", "--group-add", "10000",
    "--mount", `type=bind,src=${hostDirectory},target=/run/sp-oauth-handoff`,
    "--env-file", producerEnv,
    "--entrypoint", "node", image, "/app/ops/provision-remark42-oauth-client.mjs",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const producerRun = collect(producer);
  const timeout = delay(25_000).then(() => { throw new Error("OAuth provisioning integration timed out"); });
  let exits;
  try {
    exits = await Promise.race([Promise.all([producerRun.exited, consumerRun.exited]), timeout]);
  } finally {
    spawnSync("docker", ["rm", "--force", producerName, consumerName], { stdio: "ignore" });
  }
  const [producerExit, consumerExit] = exits;
  const output = JSON.stringify({ producer: producerRun.output(), consumer: consumerRun.output() });
  if (output.includes("OAUTH_CLIENT_SECRET") || output.includes("client_secret")) {
    throw new Error("OAuth secret marker appeared in job output");
  }
  if (expectedSuccess && (producerExit.code !== 0 || consumerExit.code !== 0)) {
    throw new Error(`Expected OAuth provisioning success: ${output}`);
  }
  if (!expectedSuccess && (producerExit.code === 0 || consumerExit.code === 0)) {
    throw new Error(`Expected OAuth provisioning failure: ${output}`);
  }
  const evidence = JSON.parse(await readFile(join(evidenceDirectory, "result.json"), "utf8"));
  if (!evidence.accepted || evidence.responseStatus !== responseStatus) {
    throw new Error("Disposable Coolify receiver did not validate the request");
  }
  await assertSessionRevoked(session.cookie);
}

try {
  await mkdir(tlsDirectory, { recursive: true });
  await mkdir(evidenceDirectory, { recursive: true });
  const openssl = (args) => execFileSync("openssl", args, { stdio: "ignore" });
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=SP Test CA", "-keyout", join(tlsDirectory, "ca.key"), "-out", join(tlsDirectory, "ca.crt")]);
  openssl(["req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=coolify-receiver", "-keyout", join(tlsDirectory, "server.key"), "-out", join(tlsDirectory, "server.csr")]);
  await writeFile(join(tlsDirectory, "server.ext"), "subjectAltName=DNS:coolify-receiver\nextendedKeyUsage=serverAuth\n", { mode: 0o600 });
  openssl(["x509", "-req", "-days", "1", "-in", join(tlsDirectory, "server.csr"), "-CA", join(tlsDirectory, "ca.crt"), "-CAkey", join(tlsDirectory, "ca.key"), "-CAserial", join(tlsDirectory, "ca.srl"), "-CAcreateserial", "-extfile", join(tlsDirectory, "server.ext"), "-out", join(tlsDirectory, "server.crt")]);
  await Promise.all([chmod(join(tlsDirectory, "ca.crt"), 0o644), chmod(join(tlsDirectory, "server.crt"), 0o644), chmod(join(tlsDirectory, "server.key"), 0o600)]);

  docker(["network", "create", network]);
  docker([
    "run", "--detach", "--rm", "--name", databaseContainer, "--network", network,
    "--env", "POSTGRES_DB=sp_auth", "--env", "POSTGRES_USER=sp_auth",
    "--env", `POSTGRES_PASSWORD=${databasePassword}`,
    "--publish", "127.0.0.1::5432", "postgres:17.6-alpine3.22",
  ]);
  const port = docker(["port", databaseContainer, "5432/tcp"]).match(/:(\d+)$/)?.[1];
  if (!port) throw new Error("Could not resolve disposable PostgreSQL port");
  const connectionString = `postgresql://sp_auth:${databasePassword}@127.0.0.1:${port}/sp_auth`;
  await waitForDatabase(connectionString);
  Object.assign(process.env, {
    NODE_ENV: "production",
    BETTER_AUTH_URL: publicOrigin,
    BETTER_AUTH_SECRET: authSecret,
    AUTH_DATABASE_URL: connectionString,
    EMAIL_TRANSPORT: "file",
  });
  pool = new Pool({ connectionString });
  email = new MemoryEmailProvider();
  const options = createAuthOptions({ pool, email });
  await (await getMigrations(options)).runMigrations();
  auth = createAuth({ pool, email });
  await createProvisioner();

  const successSession = await loginProvisioner();
  await runHandoff({ suffix: "success", responseStatus: 201, session: successSession, expectedSuccess: true });
  const clientsAfterSuccess = await pool.query('select count(*)::int as count from "oauthClient"');
  if (clientsAfterSuccess.rows[0].count !== 1) throw new Error("Successful OAuth client was not retained");

  const failureSession = await loginProvisioner();
  await runHandoff({ suffix: "failure", responseStatus: 500, session: failureSession, expectedSuccess: false });
  const clientsAfterFailure = await pool.query('select count(*)::int as count from "oauthClient"');
  if (clientsAfterFailure.rows[0].count !== 1) throw new Error("Failed OAuth client was not deleted");

  console.log("Real OAuth producer/consumer integration passed for success, failure cleanup, and session revocation.");
} finally {
  await pool?.end().catch(() => undefined);
  for (const name of [receiverContainer, databaseContainer]) {
    spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
  }
  spawnSync("docker", ["network", "rm", network], { stdio: "ignore" });
  spawnSync("docker", ["run", "--rm", "--mount", "type=bind,src=/dev/shm,target=/host-shm", "alpine:3.22", "sh", "-c", `rm -rf /host-shm/${runId}-*`], { stdio: "ignore" });
  await rm(temporaryDirectory, { recursive: true, force: true });
}
