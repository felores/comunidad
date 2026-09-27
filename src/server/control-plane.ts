export type Attribution = {
  source?: string;
  campaign?: string;
  content?: string;
  leadMagnet?: string;
};

export interface MembershipControlPlane {
  ensureMember(input: {
    authSubject: string;
    emailNormalized: string;
    displayName: string;
    attribution?: Attribution;
  }): Promise<{ memberId: string }>;
  getAccess(input: {
    authSubject: string;
    resource: string;
  }): Promise<{ allowed: boolean; reason: string }>;
}

type DirectusItemResponse<T> = { data: T };

const APPROVED_BASE_URL = "https://aos.markenetica.com";
const ALLOWED_COLLECTIONS = new Set(["sp_members", "sp_entitlements"]);

export class ControlPlaneUnavailableError extends Error {
  constructor(message = "Membership control plane is unavailable") {
    super(message);
    this.name = "ControlPlaneUnavailableError";
  }
}

class DirectusConflictError extends Error {
  constructor() {
    super("Control plane returned 409");
    this.name = "DirectusConflictError";
  }
}

export class DirectusMembershipControlPlane implements MembershipControlPlane {
  constructor(
    private readonly token: string,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
    private readonly baseUrl = APPROVED_BASE_URL,
  ) {
    if (!token.trim()) throw new Error("CONTROL_PLANE_TOKEN is required");
    if (new URL(baseUrl).origin !== APPROVED_BASE_URL) {
      throw new Error(`Control plane origin must be ${APPROVED_BASE_URL}`);
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10_000) {
      throw new Error("CONTROL_PLANE_TIMEOUT_MS must be between 250 and 10000");
    }
  }

  private async request<T>(collection: string, init: RequestInit, query?: URLSearchParams): Promise<T> {
    if (!ALLOWED_COLLECTIONS.has(collection)) throw new Error("Blocked non-sp control-plane collection");
    const url = new URL(`/items/${collection}`, this.baseUrl);
    if (query) url.search = query.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: controller.signal,
      });
      if (response.status === 409) throw new DirectusConflictError();
      if (!response.ok) throw new ControlPlaneUnavailableError(`Control plane returned ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DirectusConflictError) throw error;
      if (error instanceof ControlPlaneUnavailableError) throw error;
      throw new ControlPlaneUnavailableError(error instanceof Error ? error.message : undefined);
    } finally {
      clearTimeout(timeout);
    }
  }

  async ensureMember(input: {
    authSubject: string;
    emailNormalized: string;
    displayName: string;
    attribution?: Attribution;
  }): Promise<{ memberId: string }> {
    const query = new URLSearchParams({
      "filter[auth_subject][_eq]": input.authSubject,
      fields: "id",
      limit: "1",
    });
    const existing = await this.request<DirectusItemResponse<Array<{ id: string }>>>(
      "sp_members",
      { method: "GET" },
      query,
    );
    if (existing.data[0]?.id) return { memberId: existing.data[0].id };

    try {
      const created = await this.request<DirectusItemResponse<{ id: string }>>("sp_members", {
        method: "POST",
        body: JSON.stringify({
          auth_subject: input.authSubject,
          email_normalized: input.emailNormalized,
          display_name: input.displayName,
          status: "active",
          source: input.attribution?.source,
          campaign: input.attribution?.campaign,
          content: input.attribution?.content,
          lead_magnet: input.attribution?.leadMagnet,
        }),
      });
      return { memberId: created.data.id };
    } catch (error) {
      if (!(error instanceof DirectusConflictError)) throw error;
      const winner = await this.request<DirectusItemResponse<Array<{ id: string }>>>(
        "sp_members",
        { method: "GET" },
        query,
      );
      const memberId = winner.data[0]?.id;
      if (!memberId) {
        throw new ControlPlaneUnavailableError("Control plane conflict did not resolve to a member");
      }
      return { memberId };
    }
  }

  async getAccess(input: { authSubject: string; resource: string }) {
    if (input.resource === "community:free") {
      const query = new URLSearchParams({
        "filter[auth_subject][_eq]": input.authSubject,
        "filter[status][_eq]": "active",
        fields: "id,status",
        limit: "1",
      });
      const result = await this.request<DirectusItemResponse<Array<{ id: string; status: string }>>>(
        "sp_members",
        { method: "GET" },
        query,
      );
      return result.data[0]?.status === "active"
        ? { allowed: true, reason: "active-member" }
        : { allowed: false, reason: "member-not-active" };
    }

    const query = new URLSearchParams({
      "filter[auth_subject][_eq]": input.authSubject,
      "filter[resource][_eq]": input.resource,
      "filter[state][_eq]": "active",
      fields: "id,state,resource",
      limit: "1",
    });
    const result = await this.request<DirectusItemResponse<Array<{ id: string }>>>(
      "sp_entitlements",
      { method: "GET" },
      query,
    );
    return result.data.length === 1
      ? { allowed: true, reason: "active-entitlement" }
      : { allowed: false, reason: "no-active-entitlement" };
  }
}

class LocalMembershipControlPlane implements MembershipControlPlane {
  private readonly members = new Map<string, string>();

  async ensureMember(input: { authSubject: string }): Promise<{ memberId: string }> {
    const memberId = this.members.get(input.authSubject) ?? `local-${crypto.randomUUID()}`;
    this.members.set(input.authSubject, memberId);
    return { memberId };
  }

  async getAccess(input: { authSubject: string; resource: string }) {
    const allowed = input.resource === "community:free" && this.members.has(input.authSubject);
    return { allowed, reason: allowed ? "local-active-member" : "local-denied" };
  }
}

let singleton: MembershipControlPlane | undefined;

export function createMembershipControlPlane(): MembershipControlPlane {
  const mode = process.env.CONTROL_PLANE_MODE ?? "directus";
  if (mode === "local") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CONTROL_PLANE_MODE=local is forbidden in production");
    }
    return new LocalMembershipControlPlane();
  }
  if (mode !== "directus") throw new Error(`Unsupported CONTROL_PLANE_MODE: ${mode}`);
  return new DirectusMembershipControlPlane(
    process.env.CONTROL_PLANE_TOKEN ?? "",
    Number(process.env.CONTROL_PLANE_TIMEOUT_MS ?? "2500"),
    fetch,
    process.env.CONTROL_PLANE_BASE_URL ?? APPROVED_BASE_URL,
  );
}

export function getMembershipControlPlane(): MembershipControlPlane {
  singleton ??= createMembershipControlPlane();
  return singleton;
}
