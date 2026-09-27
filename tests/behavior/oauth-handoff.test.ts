import { constants, openSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCoolifySecret } from "../../scripts/coolify-secret-loader.mjs";
import {
  assertApprovedAuthSchema,
  cleanupOAuthProvisioningFailure,
  deliverOAuthSecret,
} from "../../scripts/oauth-handoff.mjs";

const temporaryDirectories: string[] = [];

async function handoffDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "sp-oauth-handoff-"));
  temporaryDirectories.push(directory);
  const secretFifo = join(directory, "client-secret.pipe");
  const resultFifo = join(directory, "result.pipe");
  expect(spawnSync("mkfifo", [secretFifo, resultFifo]).status).toBe(0);
  return { directory, secretFifo, resultFifo };
}

function collect(child: ReturnType<typeof spawn>) {
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk; });
  child.stderr?.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
  return { exited, output: () => ({ stdout, stderr }) };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ephemeral Remark42 OAuth handoff", () => {
  it("checks the approved schema without running DDL", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ table_name: "user" }, { table_name: "session" }, { table_name: "oauthClient" }],
    });
    await expect(assertApprovedAuthSchema({ query })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0].trim().toLowerCase()).toMatch(/^select /);
    expect(query.mock.calls[0][0]).not.toMatch(/\b(create|alter|drop|insert|update|delete)\b/i);
  });

  it("keeps the client secret in FIFOs and publishes only non-secret readiness metadata", async () => {
    const { directory, secretFifo, resultFifo } = await handoffDirectory();
    const secret = "oauth-client-secret-sentinel";
    const consumer = spawn("/bin/sh", ["-ceu", `
      IFS= read -r received < "$SECRET_FIFO"
      test "$received" = "$EXPECTED_SECRET"
      printf 'ok\\n' > "$RESULT_FIFO"
    `], {
      env: { ...process.env, SECRET_FIFO: secretFifo, RESULT_FIFO: resultFifo, EXPECTED_SECRET: secret },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const captured = collect(consumer);

    await deliverOAuthSecret({
      secret,
      clientId: "client-safe-id",
      secretFifo,
      resultFifo,
      handoffId: "handoff-safe-id",
      deadlineEpoch: Math.floor(Date.now() / 1000) + 5,
      readyGroupId: process.getgid?.(),
    });

    expect(await captured.exited).toBe(0);
    expect(captured.output()).toEqual({ stdout: "", stderr: "" });
    const ready = await readFile(join(directory, "ready.json"), "utf8");
    expect(ready).toContain("client-safe-id");
    expect(ready).toContain("handoff-safe-id");
    expect(ready).not.toContain(secret);
    expect((await stat(join(directory, "ready.json"))).gid).toBe(process.getgid?.());
  });

  it.each([
    { status: 201, result: "ok\n", rejects: false },
    { status: 500, result: "fail\n", rejects: true },
  ])("updates only the approved Coolify variable and reports $result", async ({ status, result, rejects }) => {
    const { secretFifo, resultFifo } = await handoffDirectory();
    const secret = "loader-secret-sentinel";
    const resultReader = spawn("cat", [resultFifo], { stdio: ["ignore", "pipe", "pipe"] });
    const capturedResult = collect(resultReader);
    const secretWriter = spawn("/bin/sh", ["-ceu", "printf '%s\\n' \"$SECRET\" > \"$SECRET_FIFO\""], {
      env: { ...process.env, SECRET: secret, SECRET_FIFO: secretFifo },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capturedWriter = collect(secretWriter);
    const secretFd = openSync(secretFifo, constants.O_RDONLY);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    const operation = loadCoolifySecret({
      secretFd,
      resultFifo,
      env: {
        COOLIFY_API_BASE_URL: "https://coolify.example.com/api/v1",
        COOLIFY_SERVICE_ID: "service-safe-id",
        COOLIFY_APPROVED_API_BASE_URL: "https://coolify.example.com/api/v1",
        COOLIFY_APPROVED_SERVICE_ID: "service-safe-id",
        COOLIFY_API_TOKEN: "control-token-sentinel",
        HANDOFF_DEADLINE_EPOCH: String(Math.floor(Date.now() / 1000) + 5),
      },
      fetcher,
    });

    if (rejects) await expect(operation).rejects.toThrow("returned 500");
    else await expect(operation).resolves.toBeUndefined();
    expect(await capturedWriter.exited).toBe(0);
    expect(await capturedResult.exited).toBe(0);
    expect(capturedWriter.output()).toEqual({ stdout: "", stderr: "" });
    expect(capturedResult.output().stdout).toBe(result);

    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://coolify.example.com/api/v1/services/service-safe-id/envs");
    expect(init?.method).toBe("PATCH");
    expect(init?.redirect).toBe("manual");
    expect(JSON.parse(String(init?.body))).toEqual({
      key: "AUTH_CUSTOM_CSEC",
      value: secret,
      is_preview: false,
      is_literal: true,
      is_multiline: false,
      is_shown_once: true,
    });
  });

  it("aborts the Coolify request at the approved handoff deadline", async () => {
    const { secretFifo, resultFifo } = await handoffDirectory();
    const secretWriter = spawn("/bin/sh", ["-ceu", "printf 'deadline-secret\\n' > \"$SECRET_FIFO\""], {
      env: { ...process.env, SECRET_FIFO: secretFifo },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capturedWriter = collect(secretWriter);
    const secretFd = openSync(secretFifo, constants.O_RDONLY);
    const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("deadline-abort")), { once: true });
    }));

    await expect(loadCoolifySecret({
      secretFd,
      resultFifo,
      env: {
        COOLIFY_API_BASE_URL: "https://coolify.example.com/api/v1",
        COOLIFY_SERVICE_ID: "service-safe-id",
        COOLIFY_APPROVED_API_BASE_URL: "https://coolify.example.com/api/v1",
        COOLIFY_APPROVED_SERVICE_ID: "service-safe-id",
        COOLIFY_API_TOKEN: "control-token-sentinel",
        HANDOFF_DEADLINE_EPOCH: String(Math.floor(Date.now() / 1000) + 1),
      },
      fetcher,
    })).rejects.toThrow("deadline-abort");
    expect(await capturedWriter.exited).toBe(0);
    expect(capturedWriter.output()).toEqual({ stdout: "", stderr: "" });
  });

  it("rejects a Coolify target that differs from the HG10-approved allowlist", async () => {
    const { secretFifo, resultFifo } = await handoffDirectory();
    const secretWriter = spawn("/bin/sh", ["-ceu", "printf 'allowlist-secret\\n' > \"$SECRET_FIFO\""], {
      env: { ...process.env, SECRET_FIFO: secretFifo },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capturedWriter = collect(secretWriter);
    const secretFd = openSync(secretFifo, constants.O_RDONLY);
    const fetcher = vi.fn<typeof fetch>();

    await expect(loadCoolifySecret({
      secretFd,
      resultFifo,
      env: {
        COOLIFY_API_BASE_URL: "https://attacker.example.com/api/v1",
        COOLIFY_SERVICE_ID: "service-safe-id",
        COOLIFY_APPROVED_API_BASE_URL: "https://coolify.example.com/api/v1",
        COOLIFY_APPROVED_SERVICE_ID: "service-safe-id",
        COOLIFY_API_TOKEN: "control-token-sentinel",
        HANDOFF_DEADLINE_EPOCH: String(Math.floor(Date.now() / 1000) + 1),
      },
      fetcher,
    })).rejects.toThrow("HG10-approved allowlist");
    expect(await capturedWriter.exited).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces orphaned client and session cleanup failures without secret values", async () => {
    const deleteClient = vi.fn().mockRejectedValue(new Error("delete rejected"));
    const revokeSession = vi.fn().mockRejectedValue(new Error("revoke rejected"));
    const error = await cleanupOAuthProvisioningFailure({
      cause: new Error("handoff failed"),
      clientId: "client-remediation-id",
      handoffSucceeded: false,
      deleteClient,
      revokeSession,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("client-remediation-id");
    expect(String(error)).not.toContain("loader-secret-sentinel");
    expect(deleteClient).toHaveBeenCalledOnce();
    expect(revokeSession).toHaveBeenCalledOnce();
  });
});
