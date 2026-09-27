import type { APIRoute } from "astro";
import { getAuth, type AuthInstance } from "../../server/auth";
import { proxyRemark42Request } from "../../server/remark42-proxy";

export const prerender = false;

export function handleRemark42ProxyRequest(request: Request, auth: AuthInstance = getAuth()) {
  return proxyRemark42Request(request, {
  hasActiveSession: async (candidate) => {
    try {
      return Boolean((await auth.api.getSession({ headers: candidate.headers }))?.user);
    } catch {
      return false;
    }
  },
  });
}

export const ALL: APIRoute = ({ request }) => handleRemark42ProxyRequest(request);
