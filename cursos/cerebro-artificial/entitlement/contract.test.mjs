import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXCLUDED_CAPABILITIES,
  INCLUDED_CAPABILITIES,
  applyEntitlementEvent,
  authorizeMcp,
  evaluateEntitlement,
  refundDeadline,
} from "./contract.mjs";
import { auditPlatformGates } from "./gate-audit.mjs";

const blockedGates = JSON.parse(
  await readFile(new URL("./platform-gates.json", import.meta.url), "utf8"),
);

const approvedMac = {
  ...blockedGates,
  macos: {
    featureId: "F100",
    status: "approved",
    approvedAt: "2026-09-20T12:00:00.000Z",
    artifactVersion: "1.0.0",
    evidence: "release-evidence/F100.json",
  },
};

const activeRecord = {
  purchaseStatus: "confirmed",
  purchasedAt: "2026-09-20T15:00:00.000Z",
  platform: "macos",
  onboardingStatus: "completed",
};

test("purchase enables onboarding only for a release-approved platform", () => {
  const blocked = evaluateEntitlement(
    { ...activeRecord, onboardingStatus: "pending" },
    { now: "2026-09-21T12:00:00.000Z", platformGates: blockedGates },
  );
  assert.equal(blocked.state, "platform_blocked");
  assert.equal(blocked.serviceAccess.download, false);
  assert.equal(blocked.platform.featureId, "F100");

  const eligible = evaluateEntitlement(
    { ...activeRecord, onboardingStatus: "pending" },
    { now: "2026-09-21T12:00:00.000Z", platformGates: approvedMac },
  );
  assert.equal(eligible.state, "onboarding_pending");
  assert.equal(eligible.serviceAccess.download, true);
  assert.equal(eligible.serviceAccess.onboarding, true);
});

test("macOS and Windows fail closed while F100 and F101 are blocked", () => {
  for (const platform of ["macos", "windows"]) {
    const result = evaluateEntitlement(
      { ...activeRecord, platform },
      { now: "2026-09-21T12:00:00.000Z", platformGates: blockedGates },
    );
    assert.equal(result.state, "platform_blocked");
    assert.equal(result.platform.deliverable, false);
  }
});

test("platform audit reads Sinapso feature state and rejects premature approval", () => {
  const source = {
    features: [
      { id: "F100", state: "blocked", verified_at: null },
      { id: "F101", state: "blocked", verified_at: null },
    ],
  };
  const result = auditPlatformGates(blockedGates, source);
  assert.deepEqual(
    result.map(({ platform, deliverable }) => ({ platform, deliverable })),
    [
      { platform: "macos", deliverable: false },
      { platform: "windows", deliverable: false },
    ],
  );
  assert.throws(
    () => auditPlatformGates(approvedMac, source),
    /F100 is blocked without approved verification/,
  );
});

test("the common cutoff includes the 23:59 minute in Bogota and never extends", () => {
  const duringFinalMinute = evaluateEntitlement(activeRecord, {
    now: "2026-10-23T04:59:59.999Z",
    platformGates: approvedMac,
  });
  assert.equal(duringFinalMinute.state, "active");

  const expired = evaluateEntitlement(activeRecord, {
    now: "2026-10-23T05:00:00.000Z",
    platformGates: approvedMac,
  });
  assert.equal(expired.state, "expired");
  assert.deepEqual(expired.serviceAccess, {
    download: false,
    onboarding: false,
    update: false,
    support: false,
  });

  const latePurchase = evaluateEntitlement(
    { ...activeRecord, purchasedAt: "2026-10-22T23:00:00.000Z" },
    { now: "2026-10-23T05:00:00.000Z", platformGates: approvedMac },
  );
  assert.equal(latePurchase.state, "expired");
});

test("a valid refund immediately revokes cohort services without destructive actions", () => {
  const refunded = evaluateEntitlement(
    {
      ...activeRecord,
      purchaseStatus: "refunded",
      refundedAt: "2026-09-25T15:00:00.000Z",
    },
    { now: "2026-09-25T15:00:00.001Z", platformGates: approvedMac },
  );

  assert.equal(refunded.state, "revoked");
  assert.deepEqual(refunded.purchaseAccess, {
    course: false,
    privateGroup: false,
  });
  assert.equal(Object.values(refunded.serviceAccess).every((allowed) => !allowed), true);
  assert.deepEqual(refunded.localContinuity, {
    preserveFiles: true,
    preserveExistingInstallation: true,
    deleteFiles: false,
    uninstall: false,
    drm: false,
  });
});

test("Sinapso expiry does not silently revoke the purchased course", () => {
  const expired = evaluateEntitlement(activeRecord, {
    now: "2026-10-23T05:00:00.000Z",
    platformGates: approvedMac,
  });
  assert.equal(expired.state, "expired");
  assert.deepEqual(expired.purchaseAccess, {
    course: true,
    privateGroup: true,
  });
});

test("refund deadline is recorded 14 days after payment", () => {
  assert.equal(
    refundDeadline("2026-09-20T15:00:00.000Z"),
    "2026-10-04T15:00:00.000Z",
  );
});

test("payment and onboarding events are auditable and idempotent", () => {
  const purchase = {
    id: "payment-1",
    type: "purchase.confirmed",
    occurredAt: "2026-09-20T15:00:00.000Z",
    platform: "darwin",
  };
  const purchased = applyEntitlementEvent({}, purchase);
  assert.equal(purchased.platform, "macos");
  assert.equal(purchased.refundDeadline, "2026-10-04T15:00:00.000Z");
  assert.strictEqual(applyEntitlementEvent(purchased, purchase), purchased);

  const onboarded = applyEntitlementEvent(purchased, {
    id: "onboarding-1",
    type: "onboarding.completed",
    occurredAt: "2026-09-21T15:00:00.000Z",
    sinapsoVersion: "1.0.0",
    platform: "macos",
  });
  assert.equal(onboarded.onboardingStatus, "completed");
  assert.equal(onboarded.sinapsoVersion, "1.0.0");

  const refunded = applyEntitlementEvent(onboarded, {
    id: "refund-1",
    type: "refund.validated",
    occurredAt: "2026-09-22T15:00:00.000Z",
  });
  assert.equal(refunded.purchaseStatus, "refunded");
  assert.deepEqual(refunded.processedEventIds, ["payment-1", "onboarding-1", "refund-1"]);
});

test("MCP permits only search and read on verified client/version combinations", () => {
  const options = {
    now: "2026-09-21T12:00:00.000Z",
    platformGates: approvedMac,
    verifiedMcpCombinations: [{ client: "opencode", version: "1.2.3" }],
  };

  assert.equal(
    authorizeMcp(
      activeRecord,
      { operation: "search", client: "opencode", version: "1.2.3" },
      options,
    ).allowed,
    true,
  );
  assert.equal(
    authorizeMcp(
      activeRecord,
      { operation: "read", client: "opencode", version: "unverified" },
      options,
    ).allowed,
    false,
  );
  assert.equal(
    authorizeMcp(
      activeRecord,
      { operation: "write", client: "opencode", version: "1.2.3" },
      options,
    ).allowed,
    false,
  );
});

test("capability declarations exclude planned or unsupported products", () => {
  assert.deepEqual(INCLUDED_CAPABILITIES, [
    "desktop.local-vault-selection",
    "desktop.markdown-graph",
    "notes.search",
    "notes.open",
    "notes.edit-local",
    "mcp.search",
    "mcp.read",
  ]);
  for (const excluded of ["sync", "pro", "mobile", "shared-spaces", "managed-inference"] ) {
    assert.equal(EXCLUDED_CAPABILITIES.includes(excluded), true);
  }
  assert.equal(INCLUDED_CAPABILITIES.includes("mcp.write"), false);
});
