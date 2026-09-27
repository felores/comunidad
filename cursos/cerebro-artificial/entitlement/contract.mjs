export const ENTITLEMENT_TIME_ZONE = "America/Bogota";
export const ENTITLEMENT_END_LABEL = "2026-10-22 23:59 America/Bogota";
export const ENTITLEMENT_END_EXCLUSIVE = "2026-10-23T05:00:00.000Z";
export const REFUND_WINDOW_DAYS = 14;

export const INCLUDED_CAPABILITIES = Object.freeze([
  "desktop.local-vault-selection",
  "desktop.markdown-graph",
  "notes.search",
  "notes.open",
  "notes.edit-local",
  "mcp.search",
  "mcp.read",
]);

export const EXCLUDED_CAPABILITIES = Object.freeze([
  "sync",
  "pro",
  "mobile",
  "shared-spaces",
  "managed-inference",
  "broad-export",
  "mcp.write",
]);

const COHORT_SERVICES = Object.freeze([
  "download",
  "onboarding",
  "update",
  "support",
]);

function parseInstant(value, field) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError(`${field} must be a valid instant`);
  }
  return instant;
}

function normalizePlatform(value) {
  const platform = String(value ?? "").trim().toLowerCase();
  if (platform === "darwin" || platform === "mac" || platform === "macos") {
    return "macos";
  }
  if (platform === "win32" || platform === "win" || platform === "windows") {
    return "windows";
  }
  return platform;
}

function platformDecision(platform, gates) {
  const normalized = normalizePlatform(platform);
  const gate = gates?.[normalized];
  const deliverable = Boolean(
    gate?.status === "approved" &&
      gate.approvedAt &&
      gate.artifactVersion &&
      gate.evidence,
  );

  return {
    platform: normalized,
    deliverable,
    featureId: gate?.featureId ?? null,
    reason: deliverable ? null : gate ? `release-gate-${gate.status}` : "unsupported-platform",
  };
}

export function refundDeadline(purchasedAt) {
  const deadline = parseInstant(purchasedAt, "purchasedAt");
  deadline.setUTCDate(deadline.getUTCDate() + REFUND_WINDOW_DAYS);
  return deadline.toISOString();
}

export function evaluateEntitlement(record, options) {
  const now = parseInstant(options?.now ?? new Date(), "now");
  const endExclusive = parseInstant(ENTITLEMENT_END_EXCLUSIVE, "entitlement end");
  const platform = platformDecision(record?.platform, options?.platformGates);
  const refunded = record?.purchaseStatus === "refunded" || Boolean(record?.refundedAt);
  const purchaseConfirmed = record?.purchaseStatus === "confirmed";

  let state;
  if (refunded) {
    state = "revoked";
  } else if (!purchaseConfirmed) {
    state = "purchase_pending";
  } else if (now >= endExclusive) {
    state = "expired";
  } else if (!platform.deliverable) {
    state = "platform_blocked";
  } else if (record?.onboardingStatus !== "completed") {
    state = "onboarding_pending";
  } else {
    state = "active";
  }

  const cohortServicesEnabled = state === "onboarding_pending" || state === "active";
  const serviceAccess = Object.fromEntries(
    COHORT_SERVICES.map((service) => [service, cohortServicesEnabled]),
  );

  return {
    state,
    entitlementEndsAt: ENTITLEMENT_END_LABEL,
    platform,
    purchaseAccess: {
      course: purchaseConfirmed && !refunded,
      privateGroup: purchaseConfirmed && !refunded,
    },
    serviceAccess,
    localContinuity: {
      preserveFiles: true,
      preserveExistingInstallation: true,
      deleteFiles: false,
      uninstall: false,
      drm: false,
    },
  };
}

export function authorizeMcp(record, request, options) {
  const entitlement = evaluateEntitlement(record, options);
  const capability = `mcp.${request?.operation}`;
  const combination = options?.verifiedMcpCombinations?.find(
    (candidate) =>
      candidate.client === request?.client && candidate.version === request?.version,
  );
  const allowedOperation = capability === "mcp.search" || capability === "mcp.read";

  return {
    allowed: entitlement.state === "active" && allowedOperation && Boolean(combination),
    capability,
    reason:
      entitlement.state !== "active"
        ? `entitlement-${entitlement.state}`
        : !allowedOperation
          ? "operation-outside-entitlement"
          : !combination
            ? "unverified-client-version"
            : null,
  };
}

export function applyEntitlementEvent(record = {}, event) {
  if (!event?.id || !event?.type || !event?.occurredAt) {
    throw new TypeError("event id, type and occurredAt are required");
  }
  parseInstant(event.occurredAt, "event.occurredAt");

  const processedEventIds = record.processedEventIds ?? [];
  if (processedEventIds.includes(event.id)) {
    return record;
  }

  const next = {
    ...record,
    processedEventIds: [...processedEventIds, event.id],
  };

  if (event.type === "purchase.confirmed") {
    next.purchaseStatus = "confirmed";
    next.purchasedAt = event.occurredAt;
    next.refundDeadline = refundDeadline(event.occurredAt);
    next.platform = normalizePlatform(event.platform ?? record.platform);
  } else if (event.type === "refund.validated") {
    next.purchaseStatus = "refunded";
    next.refundedAt = event.occurredAt;
  } else if (event.type === "onboarding.completed") {
    next.onboardingStatus = "completed";
    next.onboardedAt = event.occurredAt;
    next.sinapsoVersion = event.sinapsoVersion;
    next.platform = normalizePlatform(event.platform ?? record.platform);
    next.mcpCombination = event.mcpCombination ?? null;
  } else {
    throw new TypeError(`unsupported entitlement event: ${event.type}`);
  }

  return next;
}
