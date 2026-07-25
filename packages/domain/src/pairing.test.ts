import { describe, expect, it } from "vitest";

import { effectivePairingStatus, transitionPairing } from "./pairing.js";

const future = new Date("2026-07-25T10:01:00.000Z");
const now = new Date("2026-07-25T10:00:00.000Z");

describe("pairing state", () => {
  it("allows one approve and one consume transition", () => {
    expect(transitionPairing({ status: "pending", expiresAt: future }, "approve", now)).toEqual({
      ok: true,
      status: "approved",
    });
    expect(transitionPairing({ status: "approved", expiresAt: future }, "consume", now)).toEqual({
      ok: true,
      status: "consumed",
    });
    expect(transitionPairing({ status: "consumed", expiresAt: future }, "consume", now)).toEqual({
      ok: false,
      reason: "pairing_consumed",
    });
  });

  it("expires pending requests using the server time", () => {
    expect(effectivePairingStatus({ status: "pending", expiresAt: now }, now)).toBe("expired");
    expect(transitionPairing({ status: "pending", expiresAt: now }, "approve", now)).toEqual({
      ok: false,
      reason: "pairing_expired",
    });
  });
});
