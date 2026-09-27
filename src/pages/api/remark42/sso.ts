import type { APIRoute } from "astro";
import { getAuth, type AuthInstance } from "../../../server/auth";
import { authorizeCommunity, type SessionSubject } from "../../../server/authorization";
import { getMembershipControlPlane, type MembershipControlPlane } from "../../../server/control-plane";
import { buildRemark42Handoff, createRemark42Session } from "../../../server/remark42";

export const prerender = false;

type SsoContext = Pick<Parameters<APIRoute>[0], "request" | "cookies" | "redirect">;

export async function handleRemark42SsoRequest(
  { request, cookies, redirect }: SsoContext,
  auth: AuthInstance = getAuth(),
  controlPlane: MembershipControlPlane = getMembershipControlPlane(),
) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  const subject: SessionSubject | null = user ? {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
  } : null;
  const authorization = await authorizeCommunity(subject, controlPlane);
  if (authorization.state !== "authorized") return new Response("No autorizado", { status: 403 });

  const remark = await createRemark42Session(authorization.subject);
  try {
    const handoff = buildRemark42Handoff(request.url, remark);
    for (const cookie of handoff.cookies) cookies.set(cookie.name, cookie.value, cookie.options);
    return redirect(handoff.redirectPath, 303);
  } catch {
    return new Response("Remark42 no está configurado para el mismo origen", { status: 503 });
  }
}

export const POST: APIRoute = (context) => handleRemark42SsoRequest(context);
