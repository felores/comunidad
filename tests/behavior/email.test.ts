import { describe, expect, it } from "vitest";
import { MemoryEmailProvider, passwordResetMessage, verificationMessage } from "../../src/server/email";

describe("transactional email contract", () => {
  it("keeps verification and reset messages distinct and retry-safe", async () => {
    const provider = new MemoryEmailProvider();
    await provider.send(verificationMessage("member@example.com", "https://example.com/verify?token=one", "one"));
    await provider.send(passwordResetMessage("member@example.com", "https://example.com/reset?token=two", "two"));
    expect(provider.messages).toEqual([
      expect.objectContaining({ kind: "verification", idempotencyKey: "verify/one" }),
      expect.objectContaining({ kind: "password-reset", idempotencyKey: "password-reset/two" }),
    ]);
  });
});
