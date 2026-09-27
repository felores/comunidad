import { readFile } from "node:fs/promises";
import { decodeProtectedHeader, jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSubject } from "../../src/server/authorization";
import { proxyRemark42Request } from "../../src/server/remark42-proxy";
import {
  buildRemark42Handoff,
  createRemark42Session,
  expireRemark42Session,
} from "../../src/server/remark42";

const localOrigin = "http://localhost:4321";
const publicUrl = `${localOrigin}/comentarios`;
const internalUrl = "http://127.0.0.1:8080";
const siteId = "sociedad-paralela";
const secret = "local-remark42-contract-secret-at-least-32-characters";
const subject: SessionSubject = {
  id: "user-42",
  email: "member@example.com",
  emailVerified: true,
  name: "Miembro Local",
};

const originalEnv: Record<string, string | undefined> = {};
const envKeys = ["NODE_ENV", "REMARK42_URL", "REMARK42_SITE_ID", "REMARK42_PROVIDER_NAME", "REMARK42_SECRET"];

beforeEach(() => {
  for (const key of envKeys) originalEnv[key] = process.env[key];
  process.env.NODE_ENV = "test";
  process.env.REMARK42_URL = publicUrl;
  process.env.REMARK42_SITE_ID = siteId;
  process.env.REMARK42_PROVIDER_NAME = siteId;
  process.env.REMARK42_SECRET = secret;
});

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("Remark42 v1.16.4 SSO contract", () => {
  it("signs registered and nested audience claims and builds the same-origin cookie handoff", async () => {
    const session = await createRemark42Session(subject);
    expect(session).toMatchObject({
      configured: true,
      publicUrl,
      cookiePath: "/comentarios",
      siteId,
      providerName: siteId,
    });
    expect(decodeProtectedHeader(session.token!)).toMatchObject({ alg: "HS256", typ: "JWT" });

    const { payload } = await jwtVerify(session.token!, new TextEncoder().encode(secret), {
      issuer: "remark42",
      audience: siteId,
    });
    expect(payload.iss).toBe("remark42");
    expect(payload.aud).toBe(siteId);
    expect(payload.jti).toBe(session.jti);
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp! - payload.iat!).toBe(5 * 60);
    expect(payload.user).toEqual({
      aud: siteId,
      id: "sp_user-42",
      name: "Miembro Local",
    });
    expect(payload.auth_provider).toEqual({ name: siteId });
    expect(JSON.stringify(payload)).not.toContain(subject.email);

    const handoff = buildRemark42Handoff(`${localOrigin}/api/remark42/sso`, session);
    expect(handoff.redirectPath).toBe("/comentarios/web?site=sociedad-paralela");
    expect(handoff.cookies).toEqual([
      expect.objectContaining({
        name: "JWT",
        value: session.token,
        options: expect.objectContaining({ path: "/comentarios", httpOnly: true, sameSite: "strict", maxAge: 300 }),
      }),
      expect.objectContaining({
        name: "XSRF-TOKEN",
        value: session.jti,
        options: expect.objectContaining({ path: "/comentarios", httpOnly: false, sameSite: "strict", maxAge: 300 }),
      }),
    ]);
    expect(() => buildRemark42Handoff("http://127.0.0.1:4321/api/remark42/sso", session))
      .toThrow("same-origin");
  });

  it("maps the public /comentarios path to pinned local Remark42 and fails closed otherwise", async () => {
    const upstreamHeaders = new Headers({ location: `${internalUrl}/web?site=${siteId}` });
    upstreamHeaders.append("set-cookie", "JWT=refreshed; Path=/; Domain=127.0.0.1; HttpOnly; SameSite=Strict");
    upstreamHeaders.append("set-cookie", "XSRF-TOKEN=csrf-new; Path=/; Domain=127.0.0.1; SameSite=Strict");
    upstreamHeaders.append("set-cookie", "unrelated=blocked; Path=/");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("pong", {
      status: 302,
      headers: upstreamHeaders,
    }));
    const response = await proxyRemark42Request(
      new Request(`${publicUrl}/ping?ready=1`, {
        headers: {
          authorization: "Bearer app-session-sentinel",
          cookie: "better-auth.session_token=server-session-sentinel; JWT=signed; analytics=tracked; XSRF-TOKEN=csrf",
          "x-forwarded-host": "attacker.invalid",
        },
      }),
      { fetcher, publicUrl, internalUrl, timeoutMs: 1_000 },
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [upstream, init] = fetcher.mock.calls[0];
    expect(String(upstream)).toBe(`${internalUrl}/ping?ready=1`);
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBe("JWT=signed; XSRF-TOKEN=csrf");
    expect(headers.get("cookie")).not.toContain("server-session-sentinel");
    expect(headers.get("cookie")).not.toContain("analytics");
    expect(headers.get("x-forwarded-host")).toBe("localhost:4321");
    expect(headers.get("x-forwarded-proto")).toBe("http");
    expect(response.headers.get("location")).toBe(`${publicUrl}/web?site=${siteId}`);
    expect(response.headers.getSetCookie()).toEqual([
      "JWT=refreshed; Path=/comentarios; HttpOnly; SameSite=Strict",
      "XSRF-TOKEN=csrf-new; Path=/comentarios; SameSite=Strict",
    ]);
    expect(response.headers.getSetCookie().join(";")).not.toMatch(/Domain=|unrelated=/i);

    const missing = await proxyRemark42Request(new Request(`${publicUrl}/ping`), {
      fetcher,
      publicUrl,
      internalUrl: "",
    });
    expect(missing.status).toBe(503);

    const compose = await readFile("compose.local.yml", "utf8");
    expect(compose).toContain("image: ghcr.io/umputun/remark42:v1.16.4");
    expect(compose).toContain("REMARK_URL: http://localhost:4321/comentarios");
    expect(compose).toContain("AUTH_CUSTOM_NAME: sociedad-paralela");
    expect(compose).toContain("AUTH_ANON: \"false\"");
    expect(compose).toContain("AUTH_CUSTOM_AUTH_URL: http://localhost:4321/api/auth/oauth2/authorize");
    expect(compose).toContain("AUTH_CUSTOM_TOKEN_URL: http://localhost:4321/api/auth/oauth2/token");
    expect(compose).toContain("AUTH_CUSTOM_INFO_URL: http://localhost:4321/api/auth/oauth2/userinfo");
    expect(compose).not.toContain("provider-disabled");
  });

  it("requires an active Better Auth session for comment writes and expires stale Remark42 cookies", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const request = new Request(`${publicUrl}/api/v1/comment`, {
      method: "POST",
      headers: {
        cookie: "better-auth.session_token=revoked; JWT=stale; XSRF-TOKEN=stale-csrf",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: "blocked" }),
    });
    const denied = await proxyRemark42Request(request, {
      fetcher,
      publicUrl,
      internalUrl,
      timeoutMs: 1_000,
      hasActiveSession: async () => false,
    });

    expect(denied.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect(denied.headers.getSetCookie()).toEqual([
      "JWT=; Path=/comentarios; Max-Age=0; HttpOnly; SameSite=Strict",
      "XSRF-TOKEN=; Path=/comentarios; Max-Age=0; SameSite=Strict",
    ]);

    fetcher.mockResolvedValueOnce(new Response("created", { status: 201 }));
    const allowed = await proxyRemark42Request(request, {
      fetcher,
      publicUrl,
      internalUrl,
      timeoutMs: 1_000,
      hasActiveSession: async () => true,
    });
    expect(allowed.status).toBe(201);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("expires both Remark42 cookies after a successful reset response", () => {
    const response = expireRemark42Session(Response.json({ ok: true }));
    expect(response.headers.getSetCookie()).toEqual([
      "JWT=; Path=/comentarios; Max-Age=0; HttpOnly; SameSite=Strict",
      "XSRF-TOKEN=; Path=/comentarios; Max-Age=0; SameSite=Strict",
    ]);
  });
});
