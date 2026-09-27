import type { APIRoute } from "astro";
import { getAuth, type AuthInstance } from "../../../server/auth";
import { expireRemark42Session } from "../../../server/remark42";

export const prerender = false;

export async function handleAuthRequest(request: Request, auth: AuthInstance = getAuth()) {
  const response = await auth.handler(request);
  const path = new URL(request.url).pathname;
  if (request.method === "POST" && path === "/api/auth/reset-password" && response.ok) {
    return expireRemark42Session(response);
  }
  return response;
}

export const ALL: APIRoute = ({ request }) => handleAuthRequest(request);
