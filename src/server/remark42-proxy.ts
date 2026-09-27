import { expireRemark42Session } from "./remark42";

const PUBLIC_PATH = "/comentarios";
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
const REMARK42_COOKIE_NAMES = new Set(["JWT", "XSRF-TOKEN"]);

type ProxyOptions = {
  fetcher?: typeof fetch;
  publicUrl?: string;
  internalUrl?: string;
  timeoutMs?: number;
  hasActiveSession?: (request: Request) => Promise<boolean>;
};

const PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseProxyConfig(requestUrl: string, options: ProxyOptions) {
  const publicValue = options.publicUrl ?? process.env.REMARK42_URL?.trim();
  const internalValue = options.internalUrl ?? process.env.REMARK42_INTERNAL_URL?.trim();
  const timeoutMs = options.timeoutMs ?? Number(process.env.REMARK42_PROXY_TIMEOUT_MS ?? "5000");
  if (!publicValue || !internalValue) throw new Error("Remark42 proxy is not configured");

  const request = new URL(requestUrl);
  const publicUrl = new URL(publicValue);
  const internalUrl = new URL(internalValue);
  const publicPath = publicUrl.pathname.replace(/\/$/, "") || "/";
  if (publicUrl.origin !== request.origin || publicPath !== PUBLIC_PATH) {
    throw new Error("Remark42 public URL must be the request origin at /comentarios");
  }
  if (!["http:", "https:"].includes(internalUrl.protocol) || internalUrl.username || internalUrl.password) {
    throw new Error("Invalid Remark42 internal URL");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
    throw new Error("REMARK42_PROXY_TIMEOUT_MS must be between 250 and 10000");
  }
  return { request, publicUrl, internalUrl, timeoutMs };
}

function proxyHeaders(request: Request, publicUrl: URL): Headers {
  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) headers.delete(header);
  headers.delete("host");
  headers.delete("authorization");
  headers.delete("forwarded");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  const cookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => REMARK42_COOKIE_NAMES.has(cookie.slice(0, cookie.indexOf("="))));
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  else headers.delete("cookie");
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
  return headers;
}

function constrainSetCookie(cookie: string): string | null {
  const parts = cookie.split(";").map((part) => part.trim()).filter(Boolean);
  const name = parts[0]?.slice(0, parts[0].indexOf("="));
  if (!name || !REMARK42_COOKIE_NAMES.has(name)) return null;

  const attributes = parts.slice(1).filter((attribute) => {
    const key = attribute.split("=", 1)[0].toLowerCase();
    return key !== "domain" && key !== "path";
  });
  return [parts[0], `Path=${PUBLIC_PATH}`, ...attributes].join("; ");
}

function responseHeaders(headers: Headers, publicUrl: URL, internalUrl: URL): Headers {
  const result = new Headers(headers);
  for (const header of HOP_BY_HOP_HEADERS) result.delete(header);
  result.delete("set-cookie");
  for (const cookie of headers.getSetCookie()) {
    const constrained = constrainSetCookie(cookie);
    if (constrained) result.append("set-cookie", constrained);
  }
  const location = result.get("location");
  if (location) {
    const resolved = new URL(location, internalUrl);
    if (resolved.origin === internalUrl.origin) {
      const suffix = resolved.pathname === "/" ? "" : resolved.pathname;
      result.set("location", `${publicUrl.origin}${PUBLIC_PATH}${suffix}${resolved.search}${resolved.hash}`);
    }
  }
  return result;
}

export async function proxyRemark42Request(request: Request, options: ProxyOptions = {}): Promise<Response> {
  try {
    const config = parseProxyConfig(request.url, options);
    const suffix = config.request.pathname.slice(PUBLIC_PATH.length) || "/";
    if (!suffix.startsWith("/")) return new Response("Ruta inválida", { status: 400 });
    const requiresSession = suffix.startsWith("/auth/") || (
      suffix.startsWith("/api/") && PROTECTED_METHODS.has(request.method.toUpperCase())
    );
    if (requiresSession) {
      const active = options.hasActiveSession ? await options.hasActiveSession(request) : false;
      if (!active) {
        return expireRemark42Session(new Response("Sesión requerida", { status: 401 }));
      }
    }
    const upstream = new URL(config.internalUrl);
    upstream.pathname = `${config.internalUrl.pathname.replace(/\/$/, "")}${suffix}`;
    upstream.search = config.request.search;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await (options.fetcher ?? fetch)(upstream, {
        method: request.method,
        headers: proxyHeaders(request, config.publicUrl),
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
        signal: controller.signal,
        duplex: request.body ? "half" : undefined,
      } as RequestInit);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.headers, config.publicUrl, config.internalUrl),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return new Response("Servicio de comentarios no disponible", { status: 503 });
  }
}
