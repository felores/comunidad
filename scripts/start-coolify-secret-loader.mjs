#!/usr/bin/env node
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { spawn } from "node:child_process";

const deadlineEpoch = Number(process.env.HANDOFF_DEADLINE_EPOCH);
const handoffFifo = process.env.HANDOFF_FIFO?.trim();
const resultFifo = process.env.HANDOFF_RESULT_FIFO?.trim();
const remaining = (deadlineEpoch * 1000) - Date.now();
if (!Number.isInteger(deadlineEpoch) || remaining <= 0) throw new Error("OAuth handoff deadline elapsed");
if (!handoffFifo || !resultFifo) throw new Error("OAuth handoff FIFO paths are required");

const secretHandle = await open(handoffFifo, constants.O_RDONLY | constants.O_NONBLOCK);
try {
  const child = spawn("/app/ops/sp-load-coolify-secret", [
    "--secret-fd", "3",
    "--result-fifo", resultFifo,
  ], {
    env: process.env,
    stdio: ["ignore", "inherit", "inherit", secretHandle.fd],
  });
  const terminate = setTimeout(() => {
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
  }, remaining);
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(terminate);
  if (exit.code !== 0) {
    throw new Error(`OAuth secret loader exited unsuccessfully: ${exit.code ?? exit.signal}`);
  }
} finally {
  await secretHandle.close();
}
