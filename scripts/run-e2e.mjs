import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuthOptions } from "../src/server/auth.ts";
import { MemoryEmailProvider } from "../src/server/email.ts";
import { startDisposablePostgres } from "../tests/helpers/postgres.ts";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not allocate port"));
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

const database = await startDisposablePostgres();
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const emailDirectory = ".local-email-e2e";
await rm(emailDirectory, { recursive: true, force: true });
await rm("test-results", { recursive: true, force: true });

Object.assign(process.env, {
  NODE_ENV: "test",
  BETTER_AUTH_URL: baseUrl,
  PUBLIC_APP_URL: baseUrl,
  BETTER_AUTH_SECRET: "e2e-local-secret-with-at-least-32-characters",
  AUTH_DATABASE_URL: database.connectionString,
  EMAIL_TRANSPORT: "file",
  EMAIL_FILE_DIR: emailDirectory,
  CONTROL_PLANE_MODE: "local",
  CONTROL_PLANE_TOKEN: "server-only-token-sentinel",
  PLAYWRIGHT_BASE_URL: baseUrl,
});

const migrationPool = new Pool({ connectionString: database.connectionString });
try {
  await (await getMigrations(createAuthOptions({ pool: migrationPool, email: new MemoryEmailProvider() }))).runMigrations();
} finally {
  await migrationPool.end();
}

const server = spawn(process.execPath, ["./node_modules/astro/bin/astro.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Astro exited before readiness\n${serverLog}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body.service === "sociedad-paralela") {
        ready = true;
        break;
      }
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  if (!ready) throw new Error(`Astro did not become ready\n${serverLog}`);

  const playwright = spawn(process.execPath, ["./node_modules/@playwright/test/cli.js", "test"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve) => playwright.once("exit", resolve));
  if (exitCode !== 0) process.exitCode = typeof exitCode === "number" ? exitCode : 1;
} finally {
  server.kill("SIGTERM");
  database.stop();
}
