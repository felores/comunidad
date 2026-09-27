import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth, createAuthOptions, type AuthInstance } from "../../src/server/auth";
import { MemoryEmailProvider } from "../../src/server/email";
import { startDisposablePostgres, type DisposablePostgres } from "../helpers/postgres";

const baseUrl = "http://127.0.0.1:4321";
const authSecret = "local-test-secret-with-at-least-32-characters";

let database: DisposablePostgres;
let pool: Pool;
let email: MemoryEmailProvider;
let auth: AuthInstance;

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
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}

beforeAll(async () => {
  database = await startDisposablePostgres();
  process.env.NODE_ENV = "test";
  process.env.BETTER_AUTH_URL = baseUrl;
  process.env.BETTER_AUTH_SECRET = authSecret;
  process.env.AUTH_DATABASE_URL = database.connectionString;
  pool = new Pool({ connectionString: database.connectionString });
  email = new MemoryEmailProvider();
  const options = createAuthOptions({ pool, email });
  await (await getMigrations(options)).runMigrations();
  auth = createAuth({ pool, email });
});

afterAll(async () => {
  await pool?.end();
  database?.stop();
});

describe("Better Auth registration and session boundary", () => {
  it("registers once, verifies, creates a secure session, resets, and revokes it", async () => {
    const registration = {
      name: "Ada Builder",
      email: "Ada@Example.com",
      password: "correct horse battery staple",
      callbackURL: "/cuenta-verificada",
      source: "field-notes",
      campaign: "p0",
    };
    const signUp = await auth.handler(authRequest("/sign-up/email", registration));
    expect(signUp.status).toBe(200);
    expect(signUp.headers.get("set-cookie")).toBeNull();
    expect(email.messages).toHaveLength(1);
    expect(email.messages[0]).toMatchObject({ kind: "verification", to: "ada@example.com" });

    const duplicate = await auth.handler(authRequest("/sign-up/email", registration));
    expect(duplicate.status).toBe(200);
    const count = await pool.query<{ count: string }>('select count(*) from "user" where email = $1', ["ada@example.com"]);
    expect(count.rows[0].count).toBe("1");

    const account = await pool.query<{ password: string }>('select password from account where "userId" = (select id from "user" where email = $1)', ["ada@example.com"]);
    expect(account.rows[0].password).not.toBe(registration.password);
    expect(account.rows[0].password.length).toBeGreaterThan(30);

    const deniedBeforeVerification = await auth.handler(authRequest("/sign-in/email", {
      email: registration.email,
      password: registration.password,
    }));
    expect(deniedBeforeVerification.status).toBe(403);

    const verificationUrl = new URL(email.messages[0].url);
    const verify = await auth.handler(authRequest(`${verificationUrl.pathname.replace("/api/auth", "")}${verificationUrl.search}`));
    expect([302, 303]).toContain(verify.status);

    const login = await auth.handler(authRequest("/sign-in/email", {
      email: registration.email,
      password: registration.password,
    }));
    expect(login.status).toBe(200);
    const cookie = sessionCookie(login);
    expect(cookie).toContain("better-auth.session_token=");
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    expect(login.headers.get("set-cookie")?.toLowerCase()).toContain("samesite=lax");

    const activeSession = await auth.handler(authRequest("/get-session", undefined, cookie));
    expect((await activeSession.json()).user).toMatchObject({ email: "ada@example.com", emailVerified: true });

    const resetRequest = await auth.handler(authRequest("/request-password-reset", {
      email: registration.email,
      redirectTo: "/restablecer",
    }));
    expect(resetRequest.status).toBe(200);
    const resetMessage = email.messages.find((message) => message.kind === "password-reset");
    expect(resetMessage).toBeDefined();
    const resetUrl = new URL(resetMessage!.url);
    const resetCallback = await auth.handler(authRequest(`${resetUrl.pathname.replace("/api/auth", "")}${resetUrl.search}`));
    expect([302, 303]).toContain(resetCallback.status);
    const token = new URL(resetCallback.headers.get("location")!).searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await auth.handler(authRequest("/reset-password", {
      token,
      newPassword: "a different secure password",
    }));
    expect(reset.status).toBe(200);

    const revokedSession = await auth.handler(authRequest("/get-session", undefined, cookie));
    expect(await revokedSession.json()).toBeNull();

    const oldPassword = await auth.handler(authRequest("/sign-in/email", {
      email: registration.email,
      password: registration.password,
    }));
    expect(oldPassword.status).toBe(401);

    const newPassword = await auth.handler(authRequest("/sign-in/email", {
      email: registration.email,
      password: "a different secure password",
    }));
    expect(newPassword.status).toBe(200);
  });

  it("enforces the production cookie contract without custom password hashing", () => {
    const previous = { nodeEnv: process.env.NODE_ENV, url: process.env.BETTER_AUTH_URL };
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = "https://sociedadparalela.com";
    const options = createAuthOptions({ pool, email });
    expect(options.advanced).toMatchObject({
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: "lax" },
    });
    expect(options.emailAndPassword?.password).toBeUndefined();
    process.env.NODE_ENV = previous.nodeEnv;
    process.env.BETTER_AUTH_URL = previous.url;
  });
});
