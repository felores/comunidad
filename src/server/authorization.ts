import type { MembershipControlPlane } from "./control-plane";

export type SessionSubject = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  attribution?: {
    source?: string;
    campaign?: string;
    content?: string;
    leadMagnet?: string;
  };
};

export type CommunityAuthorization =
  | { state: "anonymous" }
  | { state: "unverified" }
  | { state: "unauthorized"; reason: string }
  | { state: "unavailable" }
  | { state: "authorized"; memberId: string; subject: SessionSubject };

export async function authorizeCommunity(
  subject: SessionSubject | null,
  controlPlane: MembershipControlPlane,
): Promise<CommunityAuthorization> {
  if (!subject) return { state: "anonymous" };
  if (!subject.emailVerified) return { state: "unverified" };

  try {
    const { memberId } = await controlPlane.ensureMember({
      authSubject: subject.id,
      emailNormalized: subject.email.trim().toLowerCase(),
      displayName: subject.name,
      attribution: subject.attribution,
    });
    const access = await controlPlane.getAccess({
      authSubject: subject.id,
      resource: "community:free",
    });
    return access.allowed
      ? { state: "authorized", memberId, subject }
      : { state: "unauthorized", reason: access.reason };
  } catch {
    return { state: "unavailable" };
  }
}
