import { SignJWT } from "jose";
import type { SessionSubject } from "./authorization";

export type Remark42Session = {
  configured: boolean;
  publicUrl?: string;
  cookiePath?: string;
  siteId?: string;
  providerName?: string;
  token?: string;
  jti?: string;
};

export type Remark42Handoff = {
  redirectPath: string;
  cookies: Array<{
    name: "JWT" | "XSRF-TOKEN";
    value: string;
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "strict";
      path: string;
      maxAge: number;
    };
  }>;
};

const REMARK42_PUBLIC_PATH = "/comentarios";

export function remark42ExpirationHeaders(): string[] {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `JWT=; Path=${REMARK42_PUBLIC_PATH}; Max-Age=0; HttpOnly; SameSite=Strict${secure}`,
    `XSRF-TOKEN=; Path=${REMARK42_PUBLIC_PATH}; Max-Age=0; SameSite=Strict${secure}`,
  ];
}

export function expireRemark42Session(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const cookie of remark42ExpirationHeaders()) headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parsePublicUrl(value: string): URL {
  const url = new URL(value);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("REMARK42_URL cannot include credentials, query, or hash");
  }
  if (path !== REMARK42_PUBLIC_PATH) {
    throw new Error(`REMARK42_URL must use the same-origin path ${REMARK42_PUBLIC_PATH}`);
  }
  url.pathname = path;
  return url;
}

export async function createRemark42Session(subject: SessionSubject): Promise<Remark42Session> {
  const host = process.env.REMARK42_URL?.trim();
  const siteId = process.env.REMARK42_SITE_ID?.trim();
  const providerName = process.env.REMARK42_PROVIDER_NAME?.trim();
  const secret = process.env.REMARK42_SECRET?.trim();
  if (!host || !siteId || !providerName || !secret) return { configured: false };
  if (secret.length < 32) throw new Error("REMARK42_SECRET must contain at least 32 characters");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(providerName)) {
    throw new Error("REMARK42_PROVIDER_NAME has an invalid format");
  }

  const publicUrl = parsePublicUrl(host);
  if (process.env.NODE_ENV === "production" && publicUrl.protocol !== "https:") {
    throw new Error("REMARK42_URL must use https in production");
  }

  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const token = await new SignJWT({
    user: {
      aud: siteId,
      id: `sp_${subject.id}`,
      name: subject.name,
    },
    auth_provider: { name: providerName },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("remark42")
    .setAudience(siteId)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .setJti(jti)
    .sign(new TextEncoder().encode(secret));

  return {
    configured: true,
    publicUrl: publicUrl.href.replace(/\/$/, ""),
    cookiePath: publicUrl.pathname,
    siteId,
    providerName,
    token,
    jti,
  };
}

export function buildRemark42Handoff(requestUrl: string, session: Remark42Session): Remark42Handoff {
  if (
    !session.configured ||
    !session.publicUrl ||
    !session.cookiePath ||
    !session.siteId ||
    !session.token ||
    !session.jti
  ) {
    throw new Error("Remark42 is not configured");
  }

  const requestOrigin = new URL(requestUrl).origin;
  const publicUrl = new URL(session.publicUrl);
  if (publicUrl.origin !== requestOrigin || publicUrl.pathname !== REMARK42_PUBLIC_PATH) {
    throw new Error("Remark42 SSO requires the configured same-origin /comentarios path");
  }

  const secure = process.env.NODE_ENV === "production";
  const sharedOptions = {
    secure,
    sameSite: "strict" as const,
    path: session.cookiePath,
    maxAge: 5 * 60,
  };
  return {
    redirectPath: `${session.cookiePath}/web?site=${encodeURIComponent(session.siteId)}`,
    cookies: [
      { name: "JWT", value: session.token, options: { ...sharedOptions, httpOnly: true } },
      { name: "XSRF-TOKEN", value: session.jti, options: { ...sharedOptions, httpOnly: false } },
    ],
  };
}
