import { describe, expect, it, vi } from "vitest";
import { DirectusMembershipControlPlane } from "../../src/server/control-plane";

describe("server-only Directus control plane", () => {
  it("uses the approved origin, bounded DTO fields, and a server authorization header", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(Response.json({ data: { id: "member-9", ignored: "not returned" } }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "member-9", status: "active", secret: "discard" }] }));
    const adapter = new DirectusMembershipControlPlane("service-token-sentinel", 1_000, fetcher);

    await expect(adapter.ensureMember({
      authSubject: "auth-9",
      emailNormalized: "member@example.com",
      displayName: "Member",
    })).resolves.toEqual({ memberId: "member-9" });
    await expect(adapter.getAccess({ authSubject: "auth-9", resource: "community:free" }))
      .resolves.toEqual({ allowed: true, reason: "active-member" });

    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/aos\.markenetica\.com\/items\/sp_(members|entitlements)/);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer service-token-sentinel");
      expect(String(url)).not.toContain("service-token-sentinel");
    }
    expect(String(fetcher.mock.calls[0][0])).toContain("fields=id");
    expect(String(fetcher.mock.calls[2][0])).toContain("fields=id%2Cstatus");
  });

  it("fails closed on a downstream rejection and refuses another origin", async () => {
    const adapter = new DirectusMembershipControlPlane("token", 1_000, async () => new Response(null, { status: 503 }));
    await expect(adapter.getAccess({ authSubject: "auth-1", resource: "community:free" })).rejects.toThrow("503");
    expect(() => new DirectusMembershipControlPlane("token", 1_000, fetch, "https://example.com"))
      .toThrow("https://aos.markenetica.com");
  });

  it("converges concurrent member creation on the unique auth subject", async () => {
    let reads = 0;
    let creates = 0;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "GET") {
        reads += 1;
        return Response.json({ data: reads <= 2 ? [] : [{ id: "member-winner" }] });
      }
      creates += 1;
      return creates === 1
        ? Response.json({ data: { id: "member-winner" } })
        : new Response(null, { status: 409 });
    });
    const adapter = new DirectusMembershipControlPlane("token", 1_000, fetcher);
    const input = {
      authSubject: "auth-race",
      emailNormalized: "member@example.com",
      displayName: "Member",
    };

    await expect(Promise.all([adapter.ensureMember(input), adapter.ensureMember(input)]))
      .resolves.toEqual([{ memberId: "member-winner" }, { memberId: "member-winner" }]);
    expect(creates).toBe(2);
    expect(reads).toBe(3);
  });
});
