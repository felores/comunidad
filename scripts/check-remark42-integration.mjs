import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createAuth, createAuthOptions } from "../src/server/auth.ts";
import { MemoryEmailProvider } from "../src/server/email.ts";
import { createRemark42Session } from "../src/server/remark42.ts";
import { createRemark42OAuthClient, remark42OAuthRedirectUrl } from "../src/server/remark42-oauth.ts";
import { proxyRemark42Request } from "../src/server/remark42-proxy.ts";
import { startDisposablePostgres } from "../tests/helpers/postgres.ts";

const image = "ghcr.io/umputun/remark42:v1.16.4";
const siteId = "sociedad-paralela";
const secret = "disposable-remark42-integration-secret-32-chars";
const containerName = `sp-remark42-test-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const volumeName = `${containerName}-data`;
let internalUrl = "";
let authInstance;
let authPool;
let database;

function requestHeaders(rawHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

function authRequest(origin, path, body, cookie) {
  return new Request(`${origin}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      origin,
      "x-forwarded-for": "127.0.0.1",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

function responseCookie(response) {
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}

const proxyServer = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://127.0.0.1:${proxyServer.address().port}`;
    const request = new Request(`${origin}${incoming.url}`, {
      method: incoming.method,
      headers: requestHeaders(incoming.headers),
    });
    const response = incoming.url.startsWith("/api/auth/")
      ? authInstance
        ? await authInstance.handler(request)
        : new Response("auth unavailable", { status: 503 })
      : await proxyRemark42Request(request, {
          publicUrl: `${origin}/comentarios`,
          internalUrl,
          timeoutMs: 2_000,
        });
    outgoing.statusCode = response.status;
    for (const [name, value] of response.headers) {
      if (name !== "set-cookie") outgoing.setHeader(name, value);
    }
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) outgoing.setHeader("set-cookie", setCookies);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 503;
    outgoing.end("proxy unavailable");
  }
});

await new Promise((resolve, reject) => {
  proxyServer.once("error", reject);
  proxyServer.listen(0, "127.0.0.1", resolve);
});
const proxyPort = proxyServer.address().port;
const publicOrigin = `http://localhost:${proxyPort}`;
const publicUrl = `${publicOrigin}/comentarios`;

function stopContainer() {
  try {
    execFileSync("docker", ["rm", "--force", containerName], { stdio: "ignore" });
  } catch {
    // The disposable container may already have exited.
  }
  try {
    execFileSync("docker", ["volume", "rm", "--force", volumeName], { stdio: "ignore" });
  } catch {
    // The disposable volume may already be gone.
  }
}

try {
  database = await startDisposablePostgres();
  Object.assign(process.env, {
    NODE_ENV: "test",
    BETTER_AUTH_URL: publicOrigin,
    BETTER_AUTH_SECRET: "disposable-better-auth-oauth-provider-secret",
    AUTH_DATABASE_URL: database.connectionString,
    EMAIL_TRANSPORT: "file",
    REMARK42_URL: publicUrl,
    REMARK42_SITE_ID: siteId,
    REMARK42_PROVIDER_NAME: siteId,
    REMARK42_SECRET: secret,
  });
  authPool = new Pool({ connectionString: database.connectionString });
  const email = new MemoryEmailProvider();
  const authOptions = createAuthOptions({ pool: authPool, email });
  await (await getMigrations(authOptions)).runMigrations();
  authInstance = createAuth({ pool: authPool, email });

  const provisioner = {
    name: "Local OAuth Provisioner",
    email: "local-oauth-provisioner@example.com",
    password: "disposable provisioner password",
    callbackURL: "/cuenta-verificada",
  };
  const signUp = await authInstance.handler(authRequest(publicOrigin, "/sign-up/email", provisioner));
  if (!signUp.ok || email.messages.length !== 1) throw new Error("Could not create disposable OAuth provisioner");
  const verificationUrl = new URL(email.messages[0].url);
  const verified = await authInstance.handler(authRequest(
    publicOrigin,
    `${verificationUrl.pathname.replace("/api/auth", "")}${verificationUrl.search}`,
  ));
  if (![302, 303].includes(verified.status)) throw new Error("Could not verify disposable OAuth provisioner");
  const login = await authInstance.handler(authRequest(publicOrigin, "/sign-in/email", {
    email: provisioner.email,
    password: provisioner.password,
  }));
  if (!login.ok) throw new Error("Could not authenticate disposable OAuth provisioner");
  const provisionerCookie = responseCookie(login);
  const sessionResponse = await authInstance.handler(authRequest(publicOrigin, "/get-session", undefined, provisionerCookie));
  const provisionerSession = await sessionResponse.json();
  process.env.REMARK42_OAUTH_PROVISIONER_USER_ID = provisionerSession?.user?.id;

  const client = await createRemark42OAuthClient(authInstance, {
    publicUrl,
    providerName: siteId,
    headers: new Headers({ cookie: provisionerCookie, "x-forwarded-for": "127.0.0.1" }),
  });
  if (!client.client_id || !client.client_secret) throw new Error("Better Auth OAuth client provisioning failed");

  const redirectUri = remark42OAuthRedirectUrl(publicUrl, siteId);
  const authorizeUrl = new URL(`${publicOrigin}/api/auth/oauth2/authorize`);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: redirectUri,
    scope: "openid profile",
    state: "integration-state",
  }).toString();
  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
  const authorizeResult = await authorize.json().catch(() => null);
  if (!authorize.ok || authorizeResult?.redirect !== true || !authorizeResult?.url?.startsWith("/ingresar?")) {
    throw new Error(`Better Auth OAuth provider did not start the login flow: ${authorize.status} ${JSON.stringify(authorizeResult).slice(0, 500)}`);
  }

  execFileSync("docker", [
    "run", "--detach",
    "--name", containerName,
    "--env", `REMARK_URL=${publicUrl}`,
    "--env", `SITE=${siteId}`,
    "--env", `SECRET=${secret}`,
    "--env", "AUTH_ANON=false",
    "--env", `AUTH_CUSTOM_NAME=${siteId}`,
    "--env", `AUTH_CUSTOM_CID=${client.client_id}`,
    "--env", `AUTH_CUSTOM_CSEC=${client.client_secret}`,
    "--env", `AUTH_CUSTOM_AUTH_URL=${publicOrigin}/api/auth/oauth2/authorize`,
    "--env", `AUTH_CUSTOM_TOKEN_URL=${publicOrigin}/api/auth/oauth2/token`,
    "--env", `AUTH_CUSTOM_INFO_URL=${publicOrigin}/api/auth/oauth2/userinfo`,
    "--env", "AUTH_CUSTOM_SCOPES=openid,profile",
    "--env", "AUTH_CUSTOM_ID_FIELD=sub",
    "--env", "AUTH_CUSTOM_NAME_FIELD=name",
    "--env", "AUTH_CUSTOM_PICTURE_FIELD=picture",
    "--mount", `type=volume,source=${volumeName},target=/srv/var`,
    "--publish", "127.0.0.1::8080",
    image,
  ], { stdio: "ignore" });

  const portOutput = execFileSync("docker", ["port", containerName, "8080/tcp"], { encoding: "utf8" }).trim();
  const remarkPort = portOutput.match(/:(\d+)$/)?.[1];
  if (!remarkPort) throw new Error(`Could not resolve Remark42 port from ${portOutput}`);
  internalUrl = `http://127.0.0.1:${remarkPort}`;

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const ping = await fetch(`${internalUrl}/ping`);
      if (ping.ok) {
        ready = true;
        break;
      }
    } catch {
      // Container is still starting.
    }
    await delay(250);
  }
  if (!ready) throw new Error("Pinned Remark42 container did not become ready");

  const session = await createRemark42Session({
    id: "integration-user",
    email: "must-not-reach-remark42@example.com",
    emailVerified: true,
    name: "Integration Member",
  });
  if (!session.configured || !session.token || !session.jti) {
    throw new Error("Remark42 session was not created");
  }

  const response = await fetch(`${publicUrl}/api/v1/user?site=${siteId}`, {
    headers: {
      authorization: "Bearer must-not-reach-remark42",
      cookie: `better-auth.session_token=must-not-reach-remark42; JWT=${session.token}; XSRF-TOKEN=${session.jti}`,
      "x-xsrf-token": session.jti,
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Remark42 rejected corrected SSO token: ${response.status} ${body.slice(0, 500)}`);
  const user = JSON.parse(body);
  const serialized = JSON.stringify(user);
  if (!serialized.includes("sp_integration-user") || !serialized.includes("Integration Member")) {
    throw new Error(`Remark42 did not return the signed user: ${body.slice(0, 500)}`);
  }
  if (serialized.includes("must-not-reach-remark42@example.com")) {
    throw new Error("Remark42 response exposed the application email");
  }

  console.log(`Pinned Remark42 accepted the corrected JWT through ${publicUrl}/api/v1/user.`);
  console.log(`Remark42 custom provider ${siteId} points to the live disposable Better Auth OAuth endpoints.`);
  console.log("Better Auth and Authorization sentinels were removed by the same-origin proxy.");
} catch (error) {
  try {
    execFileSync("docker", ["logs", "--tail", "80", containerName], { stdio: "inherit" });
  } catch {
    // No container logs are available.
  }
  throw error;
} finally {
  stopContainer();
  await authPool?.end();
  database?.stop();
  await new Promise((resolve) => proxyServer.close(resolve));
}
