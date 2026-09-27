import type { APIRoute } from "astro";
import { getAuth, type AuthInstance } from "../../../server/auth";
import { remark42ExpirationHeaders } from "../../../server/remark42";

export const prerender = false;

export async function handleLogoutRequest(
  request: Request,
  redirect: (path: string, status: 303) => Response,
  auth: AuthInstance = getAuth(),
) {
  const target = new URL("/api/auth/sign-out", request.url);
  const response = await auth.handler(new Request(target, {
    method: "POST",
    headers: request.headers,
  }));
  if (!response.ok) {
    const failure = new Response("No se pudo cerrar la sesión", { status: 503 });
    for (const cookie of remark42ExpirationHeaders()) failure.headers.append("set-cookie", cookie);
    return failure;
  }
  const result = redirect("/ingresar", 303);
  for (const cookie of response.headers.getSetCookie()) result.headers.append("set-cookie", cookie);
  for (const cookie of remark42ExpirationHeaders()) result.headers.append("set-cookie", cookie);
  return result;
}

export const POST: APIRoute = ({ request, redirect }) => handleLogoutRequest(request, redirect);
