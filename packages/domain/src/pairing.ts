export type PairingStatus = "pending" | "approved" | "denied" | "consumed" | "expired" | "revoked";

export type PairingEvent = "approve" | "deny" | "consume" | "revoke";

export interface PairingState {
  status: PairingStatus;
  expiresAt: Date;
}

export type PairingTransition =
  | { ok: true; status: PairingStatus }
  | {
      ok: false;
      reason:
        | "pairing_expired"
        | "pairing_denied"
        | "pairing_consumed"
        | "pairing_revoked"
        | "invalid_transition";
    };

export function effectivePairingStatus(state: PairingState, now: Date): PairingStatus {
  return state.status === "pending" && state.expiresAt.getTime() <= now.getTime()
    ? "expired"
    : state.status;
}

export function transitionPairing(
  state: PairingState,
  event: PairingEvent,
  now: Date,
): PairingTransition {
  const status = effectivePairingStatus(state, now);
  if (status === "expired") {
    return { ok: false, reason: "pairing_expired" };
  }
  if (status === "denied") {
    return { ok: false, reason: "pairing_denied" };
  }
  if (status === "consumed") {
    return { ok: false, reason: "pairing_consumed" };
  }
  if (status === "revoked") {
    return { ok: false, reason: "pairing_revoked" };
  }

  if (event === "revoke") {
    return { ok: true, status: "revoked" };
  }
  if (status === "pending" && (event === "approve" || event === "deny")) {
    return { ok: true, status: event === "approve" ? "approved" : "denied" };
  }
  if (status === "approved" && event === "consume") {
    return { ok: true, status: "consumed" };
  }
  return { ok: false, reason: "invalid_transition" };
}
