import { describe, expect, it } from "vitest";

import { canCommitLease } from "./workspace.js";

const lease = {
  workspaceId: "ws-1",
  holderConnectionId: "client-a",
  token: "lease-token",
  expiresAt: new Date("2026-07-24T10:01:00.000Z"),
};

describe("canCommitLease", () => {
  it("accepts only the current holder before expiration", () => {
    expect(
      canCommitLease(lease, "client-a", "lease-token", new Date("2026-07-24T10:00:00.000Z")),
    ).toBe(true);
  });

  it("rejects an expired or mismatched lease", () => {
    expect(
      canCommitLease(lease, "client-b", "lease-token", new Date("2026-07-24T10:00:00.000Z")),
    ).toBe(false);
    expect(
      canCommitLease(lease, "client-a", "lease-token", new Date("2026-07-24T10:01:00.000Z")),
    ).toBe(false);
  });
});
