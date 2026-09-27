import { describe, expect, it } from "vitest";
import { authorizeCommunity, type SessionSubject } from "../../src/server/authorization";
import type { MembershipControlPlane } from "../../src/server/control-plane";

const verified: SessionSubject = {
  id: "user-1",
  email: "member@example.com",
  emailVerified: true,
  name: "Miembro",
};

function controlPlane(result: { allowed: boolean; reason: string }): MembershipControlPlane {
  return {
    async ensureMember() { return { memberId: "member-1" }; },
    async getAccess() { return result; },
  };
}

describe("community authorization", () => {
  it("distinguishes anonymous, unverified, verified, denied, and failure states", async () => {
    expect(await authorizeCommunity(null, controlPlane({ allowed: true, reason: "ok" }))).toEqual({ state: "anonymous" });
    expect(await authorizeCommunity({ ...verified, emailVerified: false }, controlPlane({ allowed: true, reason: "ok" }))).toEqual({ state: "unverified" });
    expect(await authorizeCommunity(verified, controlPlane({ allowed: true, reason: "active" }))).toMatchObject({ state: "authorized", memberId: "member-1" });
    expect(await authorizeCommunity(verified, controlPlane({ allowed: false, reason: "blocked" }))).toEqual({ state: "unauthorized", reason: "blocked" });

    const unavailable: MembershipControlPlane = {
      async ensureMember() { throw new Error("offline"); },
      async getAccess() { return { allowed: true, reason: "never" }; },
    };
    expect(await authorizeCommunity(verified, unavailable)).toEqual({ state: "unavailable" });
  });
});
