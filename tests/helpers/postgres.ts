import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

export type DisposablePostgres = {
  connectionString: string;
  containerName: string;
  stop(): void;
};

export async function startDisposablePostgres(): Promise<DisposablePostgres> {
  const containerName = `sp-auth-test-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  execFileSync("docker", [
    "run", "--detach", "--rm",
    "--name", containerName,
    "--env", "POSTGRES_DB=sp_auth",
    "--env", "POSTGRES_USER=sp_auth",
    "--env", "POSTGRES_PASSWORD=local-test-password",
    "--publish", "127.0.0.1::5432",
    "postgres:17.6-alpine3.22",
  ], { stdio: "ignore" });

  const portOutput = execFileSync("docker", ["port", containerName, "5432/tcp"], { encoding: "utf8" }).trim();
  const port = portOutput.match(/:(\d+)$/)?.[1];
  if (!port) throw new Error(`Could not resolve PostgreSQL port from ${portOutput}`);
  const connectionString = `postgresql://sp_auth:local-test-password@127.0.0.1:${port}/sp_auth`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 500 });
    try {
      await pool.query("select 1");
      await pool.end();
      return {
        connectionString,
        containerName,
        stop() {
          try {
            execFileSync("docker", ["rm", "--force", containerName], { stdio: "ignore" });
          } catch {
            // The container may already have stopped.
          }
        },
      };
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => undefined);
      await delay(250);
    }
  }

  execFileSync("docker", ["logs", "--tail", "40", containerName], { stdio: "inherit" });
  execFileSync("docker", ["rm", "--force", containerName], { stdio: "ignore" });
  throw new Error("Disposable PostgreSQL did not become ready", { cause: lastError });
}
