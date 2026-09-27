import { constants, read } from "node:fs";
import { lstat, open } from "node:fs/promises";

const POLL_MS = 25;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remainingMilliseconds(deadlineEpoch) {
  const remaining = (deadlineEpoch * 1000) - Date.now();
  if (!Number.isInteger(deadlineEpoch) || remaining <= 0) throw new Error("OAuth handoff deadline elapsed");
  return remaining;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error("Invalid loader arguments");
    values.set(name, value);
  }
  if ([...values.keys()].some((name) => !["--secret-fd", "--result-fifo"].includes(name))) {
    throw new Error("Unsupported loader argument");
  }
  const secretFd = Number(values.get("--secret-fd"));
  const resultFifo = values.get("--result-fifo");
  if (!Number.isInteger(secretFd) || secretFd < 3 || !resultFifo) throw new Error("Loader arguments are required");
  return { secretFd, resultFifo };
}

function parseConfig(env) {
  const baseUrl = new URL(env.COOLIFY_API_BASE_URL ?? "");
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.pathname !== "/api/v1"
  ) {
    throw new Error("COOLIFY_API_BASE_URL must be an approved HTTPS /api/v1 URL");
  }
  const serviceId = env.COOLIFY_SERVICE_ID?.trim();
  const approvedBaseUrl = env.COOLIFY_APPROVED_API_BASE_URL?.trim();
  const approvedServiceId = env.COOLIFY_APPROVED_SERVICE_ID?.trim();
  const token = env.COOLIFY_API_TOKEN?.trim();
  const deadlineEpoch = Number(env.HANDOFF_DEADLINE_EPOCH);
  if (!serviceId || !/^[A-Za-z0-9_-]+$/.test(serviceId)) throw new Error("Invalid COOLIFY_SERVICE_ID");
  if (baseUrl.href.replace(/\/$/, "") !== approvedBaseUrl || serviceId !== approvedServiceId) {
    throw new Error("Coolify target does not match the HG10-approved allowlist");
  }
  if (!token) throw new Error("COOLIFY_API_TOKEN is required");
  remainingMilliseconds(deadlineEpoch);
  return { baseUrl, serviceId, token, deadlineEpoch };
}

function readFromFd(fd, buffer) {
  return new Promise((resolve, reject) => {
    read(fd, buffer, 0, buffer.length, null, (error, bytesRead) => {
      if (error) reject(error);
      else resolve(bytesRead);
    });
  });
}

export async function readSecretLine(secretFd, deadlineEpoch) {
  const chunks = [];
  let size = 0;
  for (;;) {
    remainingMilliseconds(deadlineEpoch);
    const chunk = Buffer.alloc(512);
    try {
      const bytesRead = await readFromFd(secretFd, chunk);
      if (!bytesRead) {
        if (size) break;
        await wait(POLL_MS);
        continue;
      }
      const value = chunk.subarray(0, bytesRead);
      size += value.length;
      if (size > 4096) throw new Error("OAuth client secret is too large");
      chunks.push(value);
    } catch (error) {
      if (!["EAGAIN", "EWOULDBLOCK"].includes(error?.code)) throw error;
      await wait(POLL_MS);
    }
  }
  const buffer = Buffer.concat(chunks);
  try {
    if (buffer.includes(0) || buffer.length < 2 || buffer[buffer.length - 1] !== 0x0a) {
      throw new Error("OAuth client secret must be one complete line");
    }
    const value = buffer.subarray(0, -1).toString("utf8");
    if (!value || value.includes("\n") || value.includes("\r")) {
      throw new Error("OAuth client secret must be one complete line");
    }
    return value;
  } finally {
    buffer.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

async function writeResult(resultFifo, value, deadlineEpoch) {
  if (!(await lstat(resultFifo)).isFIFO()) throw new Error("OAuth result path must be a FIFO");
  let handle;
  for (;;) {
    remainingMilliseconds(deadlineEpoch);
    try {
      handle = await open(resultFifo, constants.O_WRONLY | constants.O_NONBLOCK);
      break;
    } catch (error) {
      if (!["ENXIO", "EAGAIN", "EWOULDBLOCK"].includes(error?.code)) throw error;
      await wait(POLL_MS);
    }
  }
  try {
    await handle.writeFile(`${value}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

export async function loadCoolifySecret({ secretFd, resultFifo, env = process.env, fetcher = fetch }) {
  let secret;
  try {
    const config = parseConfig(env);
    secret = await readSecretLine(secretFd, config.deadlineEpoch);
    const endpoint = new URL(`/api/v1/services/${encodeURIComponent(config.serviceId)}/envs`, config.baseUrl.origin);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMilliseconds(config.deadlineEpoch));
    let response;
    try {
      response = await fetcher(endpoint, {
        method: "PATCH",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          key: "AUTH_CUSTOM_CSEC",
          value: secret,
          is_preview: false,
          is_literal: true,
          is_multiline: false,
          is_shown_once: true,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status !== 201) throw new Error(`Coolify secret update returned ${response.status}`);
    await writeResult(resultFifo, "ok", config.deadlineEpoch);
  } catch (error) {
    const deadlineEpoch = Number(env.HANDOFF_DEADLINE_EPOCH);
    await writeResult(resultFifo, "fail", deadlineEpoch).catch(() => undefined);
    throw error;
  } finally {
    secret = undefined;
  }
}

export async function runCoolifySecretLoader(argv = process.argv.slice(2)) {
  return loadCoolifySecret({ ...parseArguments(argv) });
}
