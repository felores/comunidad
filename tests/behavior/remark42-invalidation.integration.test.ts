import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth, createAuthOptions, type AuthInstance } from "../../src/server/auth";
import type { MembershipControlPlane } from "../../src/server/control-plane";
import { MemoryEmailProvider } from "../../src/server/email";
import { handleAuthRequest } from "../../src/pages/api/auth/[...all]";
import { handleLogoutRequest } from "../../src/pages/api/cuenta/salir";
import { handleRemark42SsoRequest } from "../../src/pages/api/remark42/sso";
import { handleRemark42ProxyRequest } from "../../src/pages/comentarios/[...path]";
import { startDisposablePostgres, type DisposablePostgres } from "../helpers/postgres";

const baseUrl = "http://127.0.0.1:4321";
let database: DisposablePostgres;
let pool: Pool;
let email: MemoryEmailProvider;
let auth: AuthInstance;
let upstream: Server;
let upstreamUrl: string;
let upstreamWrites = 0;

const controlPlane: MembershipControlPlane = {
  async ensureMember() { return { memberId: "member-invalidation" }; },
  async getAccess() { return { allowed: true, reason: "active-member" }; },
};

function authRequest(path: string, body?: Record<string, unknown>, cookie?: string) {
  return new Request(`${baseUrl}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      origin: baseUrl,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

function sessionCookie(response: Response): string {
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

async function signIn(password: string) {
  const response = await auth.handler(authRequest("/sign-in/email", {
    email: "member@example.com",
    password,
  }));
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

async function remark42Handoff(session: string) {
  const cookies: string[] = [];
  const response = await handleRemark42SsoRequest({
    request: new Request(`${baseUrl}/api/remark42/sso`, { method: "POST", headers: { cookie: session } }),
    cookies: {
      set(name: string, value: string) { cookies.push(`${name}=${value}`); },
    } as never,
    redirect(path: string, status: number) {
      return new Response(null, { status, headers: { location: path } });
    },
  } as never, auth, controlPlane);
  return { response, cookie: [session, ...cookies].join("; ") };
}

async function proxy(path: string, method: string, cookie?: string) {
  return handleRemark42ProxyRequest(new Request(`${baseUrl}/comentarios${path}`, {
    method,
    headers: cookie ? { cookie, "content-type": "application/json" } : undefined,
    body: method === "GET" ? undefined : JSON.stringify({ text: "controlled" }),
  }), auth);
}

beforeAll(async () => {
  database = await startDisposablePostgres();
  upstream = createServer((request, response) => {
    if (request.method !== "GET") upstreamWrites += 1;
    request.resume();
    response.statusCode = request.method === "GET" ? 200 : 201;
    response.end(request.method === "GET" ? "public" : "created");
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", resolve);
  });
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate Remark42 test port");
  upstreamUrl = `http://127.0.0.1:${address.port}`;

  Object.assign(process.env, {
    NODE_ENV: "test",
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: "invalidation-test-secret-at-least-32-characters",
    AUTH_DATABASE_URL: database.connectionString,
    EMAIL_TRANSPORT: "file",
    CONTROL_PLANE_MODE: "local",
    REMARK42_URL: `${baseUrl}/comentarios`,
    REMARK42_INTERNAL_URL: upstreamUrl,
    REMARK42_SITE_ID: "sociedad-paralela",
    REMARK42_PROVIDER_NAME: "sociedad-paralela",
    REMARK42_SECRET: "remark42-invalidation-secret-at-least-32-characters",
  });
  pool = new Pool({ connectionString: database.connectionString });
  email = new MemoryEmailProvider();
  const options = createAuthOptions({ pool, email });
  await (await getMigrations(options)).runMigrations();
  auth = createAuth({ pool, email });

  const registration = await auth.handler(authRequest("/sign-up/email", {
    name: "Member",
    email: "member@example.com",
    password: "original secure password",
    callbackURL: "/cuenta-verificada",
  }));
  expect(registration.status).toBe(200);
  const verificationUrl = new URL(email.messages[0].url);
  const verified = await auth.handler(authRequest(
    `${verificationUrl.pathname.replace("/api/auth", "")}${verificationUrl.search}`,
  ));
  expect([302, 303]).toContain(verified.status);
});

afterAll(async () => {
  if (upstream) await new Promise<void>((resolve) => upstream.close(() => resolve()));
  await pool?.end();
  database?.stop();
});

describe("real Remark42 invalidation boundary", () => {
  it("does not announce logout success when Better Auth cannot revoke the session", async () => {
    const failedAuth = {
      handler: async () => new Response("auth unavailable", { status: 503 }),
    } as unknown as AuthInstance;
    const response = await handleLogoutRequest(
      new Request(`${baseUrl}/api/cuenta/salir`, { method: "POST" }),
      (path, status) => new Response(null, { status, headers: { location: path } }),
      failedAuth,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([
      "JWT=; Path=/comentarios; Max-Age=0; HttpOnly; SameSite=Strict",
      "XSRF-TOKEN=; Path=/comentarios; Max-Age=0; SameSite=Strict",
    ]);
  });

  it("rejects stale jars after logout and password reset while preserving public reads", async () => {
    const firstSession = await signIn("original secure password");
    const firstHandoff = await remark42Handoff(firstSession);
    expect(firstHandoff.response.status).toBe(303);
    expect(firstHandoff.cookie).toContain("JWT=");
    expect(firstHandoff.cookie).toContain("XSRF-TOKEN=");

    const initialWrite = await proxy("/api/v1/comment", "POST", firstHandoff.cookie);
    expect(initialWrite.status).toBe(201);
    expect(upstreamWrites).toBe(1);

    const logout = await handleLogoutRequest(
      new Request(`${baseUrl}/api/cuenta/salir`, { method: "POST", headers: { cookie: firstHandoff.cookie } }),
      (path, status) => new Response(null, { status, headers: { location: path } }),
      auth,
    );
    const logoutCookies = logout.headers.getSetCookie();
    expect(logoutCookies.some((cookie) => cookie.includes("better-auth.session_token=") && cookie.includes("Max-Age=0")))
      .toBe(true);
    expect(logoutCookies).toContain("JWT=; Path=/comentarios; Max-Age=0; HttpOnly; SameSite=Strict");
    expect(logoutCookies).toContain("XSRF-TOKEN=; Path=/comentarios; Max-Age=0; SameSite=Strict");

    const staleLogoutWrite = await proxy("/api/v1/comment", "POST", firstHandoff.cookie);
    expect(staleLogoutWrite.status).toBe(401);
    expect(staleLogoutWrite.headers.getSetCookie()).toHaveLength(2);
    expect(upstreamWrites).toBe(1);
    const staleAuth = await proxy("/auth/sociedad-paralela/callback", "GET", firstHandoff.cookie);
    expect(staleAuth.status).toBe(401);
    expect(upstreamWrites).toBe(1);
    expect((await remark42Handoff(firstSession)).response.status).toBe(403);

    const secondSession = await signIn("original secure password");
    const secondHandoff = await remark42Handoff(secondSession);
    expect(secondHandoff.response.status).toBe(303);

    const resetRequest = await auth.handler(authRequest("/request-password-reset", {
      email: "member@example.com",
      redirectTo: "/restablecer",
    }));
    expect(resetRequest.status).toBe(200);
    const resetMessage = email.messages.findLast((message) => message.kind === "password-reset");
    expect(resetMessage).toBeDefined();
    const resetUrl = new URL(resetMessage!.url);
    const callback = await auth.handler(authRequest(
      `${resetUrl.pathname.replace("/api/auth", "")}${resetUrl.search}`,
    ));
    const token = new URL(callback.headers.get("location")!).searchParams.get("token");
    expect(token).toBeTruthy();
    const reset = await handleAuthRequest(authRequest("/reset-password", {
      token,
      newPassword: "replacement secure password",
    }), auth);
    expect(reset.status).toBe(200);
    expect(reset.headers.getSetCookie()).toEqual([
      "JWT=; Path=/comentarios; Max-Age=0; HttpOnly; SameSite=Strict",
      "XSRF-TOKEN=; Path=/comentarios; Max-Age=0; SameSite=Strict",
    ]);

    const staleResetWrite = await proxy("/api/v1/comment", "POST", secondHandoff.cookie);
    expect(staleResetWrite.status).toBe(401);
    expect(upstreamWrites).toBe(1);
    expect((await remark42Handoff(secondSession)).response.status).toBe(403);

    const oldPassword = await auth.handler(authRequest("/sign-in/email", {
      email: "member@example.com",
      password: "original secure password",
    }));
    expect(oldPassword.status).toBe(401);
    const thirdSession = await signIn("replacement secure password");
    expect((await remark42Handoff(thirdSession)).response.status).toBe(303);

    const publicRead = await proxy("/api/v1/find?site=sociedad-paralela", "GET");
    expect(publicRead.status).toBe(200);
    expect(await publicRead.text()).toBe("public");
  });
});
