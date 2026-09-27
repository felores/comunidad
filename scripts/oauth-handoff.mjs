import { constants } from "node:fs";
import { chmod, chown, lstat, open, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const POLL_MS = 25;
const REQUIRED_AUTH_TABLES = ["user", "session", "oauthClient"];

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function assertBeforeDeadline(deadlineEpoch) {
  if (!Number.isInteger(deadlineEpoch) || deadlineEpoch <= Math.floor(Date.now() / 1000)) {
    throw new Error("OAuth handoff deadline elapsed");
  }
}

async function assertFifo(path) {
  if (!(await lstat(path)).isFIFO()) throw new Error(`${path} must be a FIFO`);
}

async function openBeforeDeadline(path, flags, deadlineEpoch) {
  for (;;) {
    assertBeforeDeadline(deadlineEpoch);
    try {
      return await open(path, flags);
    } catch (error) {
      if (!["ENXIO", "EAGAIN", "EWOULDBLOCK"].includes(error?.code)) throw error;
      await wait(POLL_MS);
    }
  }
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset);
    if (!bytesWritten) throw new Error("FIFO write made no progress");
    offset += bytesWritten;
  }
}

async function readResult(handle, deadlineEpoch) {
  const chunks = [];
  let size = 0;
  for (;;) {
    assertBeforeDeadline(deadlineEpoch);
    const buffer = Buffer.alloc(64);
    try {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length);
      if (!bytesRead) {
        await wait(POLL_MS);
        continue;
      }
      chunks.push(buffer.subarray(0, bytesRead));
      size += bytesRead;
      if (size > 16) throw new Error("Invalid OAuth handoff result");
      const value = Buffer.concat(chunks).toString("utf8");
      if (value.includes("\n")) {
        if (value !== "ok\n" && value !== "fail\n") throw new Error("Invalid OAuth handoff result");
        return value.trim();
      }
    } catch (error) {
      if (!["EAGAIN", "EWOULDBLOCK"].includes(error?.code)) throw error;
      await wait(POLL_MS);
    }
  }
}

export async function assertApprovedAuthSchema(pool) {
  const result = await pool.query(
    `select table_name
       from information_schema.tables
      where table_schema = current_schema()
        and table_name = any($1::text[])`,
    [REQUIRED_AUTH_TABLES],
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_AUTH_TABLES.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Approved auth schema is missing: ${missing.join(", ")}`);
}

export async function deliverOAuthSecret({
  secret,
  clientId,
  secretFifo,
  resultFifo,
  handoffId,
  deadlineEpoch,
  readyGroupId,
}) {
  if (!secret || secret.includes("\n") || secret.includes("\0")) {
    throw new Error("OAuth client secret must be one non-empty line");
  }
  if (!clientId || !handoffId) throw new Error("OAuth handoff metadata is incomplete");
  assertBeforeDeadline(deadlineEpoch);
  await Promise.all([assertFifo(secretFifo), assertFifo(resultFifo)]);
  if (dirname(resolve(secretFifo)) !== dirname(resolve(resultFifo))) {
    throw new Error("OAuth handoff FIFOs must share one directory");
  }

  const handoffDirectory = dirname(resolve(secretFifo));
  const readyPath = join(handoffDirectory, "ready.json");
  const temporaryReadyPath = join(handoffDirectory, `.ready-${process.pid}-${crypto.randomUUID()}.tmp`);
  const ready = {
    clientId,
    producerPid: process.pid,
    handoffId,
    deadlineEpoch,
  };
  await writeFile(temporaryReadyPath, `${JSON.stringify(ready)}\n`, { mode: 0o640, flag: "wx" });
  if (readyGroupId !== undefined) {
    if (!Number.isInteger(readyGroupId) || readyGroupId < 1) throw new Error("Invalid OAuth handoff group ID");
    await chown(temporaryReadyPath, -1, readyGroupId);
  }
  await chmod(temporaryReadyPath, 0o640);
  await rename(temporaryReadyPath, readyPath);

  let resultHandle;
  let secretHandle;
  const secretBuffer = Buffer.from(`${secret}\n`, "utf8");
  try {
    resultHandle = await open(resultFifo, constants.O_RDONLY | constants.O_NONBLOCK);
    secretHandle = await openBeforeDeadline(
      secretFifo,
      constants.O_WRONLY | constants.O_NONBLOCK,
      deadlineEpoch,
    );
    await writeAll(secretHandle, secretBuffer);
    await secretHandle.close();
    secretHandle = undefined;
    const result = await readResult(resultHandle, deadlineEpoch);
    if (result !== "ok") throw new Error("OAuth secret consumer reported failure");
  } finally {
    secretBuffer.fill(0);
    await secretHandle?.close().catch(() => undefined);
    await resultHandle?.close().catch(() => undefined);
    await unlink(temporaryReadyPath).catch(() => undefined);
  }
}

export async function cleanupOAuthProvisioningFailure({
  cause,
  clientId,
  handoffSucceeded,
  deleteClient,
  revokeSession,
}) {
  const cleanupFailures = [];
  if (!handoffSucceeded && clientId && deleteClient) {
    try {
      await deleteClient();
    } catch {
      cleanupFailures.push(new Error(`OAuth client ${clientId} could not be deleted`));
    }
  }
  if (!handoffSucceeded && revokeSession) {
    try {
      await revokeSession();
    } catch {
      cleanupFailures.push(new Error("OAuth provisioner session could not be revoked"));
    }
  }
  if (cleanupFailures.length) {
    throw new AggregateError(
      [cause instanceof Error ? cause : new Error("OAuth provisioning failed"), ...cleanupFailures],
      `OAuth provisioning cleanup failed for client ${clientId ?? "not-created"}`,
    );
  }
  throw cause;
}
