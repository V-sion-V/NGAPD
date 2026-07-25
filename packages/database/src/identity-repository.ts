import { randomUUID, timingSafeEqual } from "node:crypto";

import { sql, type Kysely, type Selectable, type Transaction } from "kysely";

import { writeAudit } from "./foundation-repository.js";
import type { DatabaseSchema, PairingRequestTable } from "./types.js";

export const MAX_PAIRING_ASSOCIATION_ATTEMPTS = 5;

export interface CreatePairingInput {
  id?: string;
  codeHash: string;
  correlationHash: string;
  deviceName: string;
  platform: "macos" | "windows" | "linux";
  expiresAt: Date;
}

export interface ConsumePairingInput {
  pairingId: string;
  correlationHash: string;
  deviceId?: string;
  credentialId?: string;
  credentialHash: string;
  accessTokenId?: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
  requestId: string;
  now: Date;
}

export interface InspectPairingInput {
  pairingId: string;
  correlationHash: string;
  requestId: string;
  now: Date;
}

export interface IssueDeviceAccessTokenInput {
  deviceId: string;
  credentialHash: string;
  accessTokenId?: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
  requestId: string;
  now: Date;
}

export class IdentityRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async findUserForLogin(normalizedLoginName: string) {
    return this.database
      .selectFrom("users")
      .select(["id", "login_name", "normalized_login_name", "password_hash", "active"])
      .where("normalized_login_name", "=", normalizedLoginName)
      .executeTakeFirst();
  }

  async createSession(input: { id?: string; tokenHash: string; userId: string; expiresAt: Date }) {
    return this.database
      .insertInto("web_sessions")
      .values({
        id: input.id ?? randomUUID(),
        token_hash: input.tokenHash,
        user_id: input.userId,
        expires_at: input.expiresAt,
      })
      .returning(["id", "user_id", "expires_at"])
      .executeTakeFirstOrThrow();
  }

  async resolveSession(tokenHash: string, now: Date) {
    return this.database
      .selectFrom("web_sessions as session")
      .innerJoin("users as user", "user.id", "session.user_id")
      .select([
        "session.id as session_id",
        "session.expires_at",
        "user.id as user_id",
        "user.login_name",
        "user.active",
      ])
      .where("session.token_hash", "=", tokenHash)
      .where("session.revoked_at", "is", null)
      .where("session.expires_at", ">", now)
      .executeTakeFirst();
  }

  async resolveAccessToken(tokenHash: string, now: Date) {
    return this.database
      .selectFrom("device_access_tokens as access")
      .innerJoin("devices as device", "device.id", "access.device_id")
      .innerJoin("users as user", "user.id", "access.user_id")
      .select([
        "access.id as access_token_id",
        "access.expires_at",
        "device.id as device_id",
        "device.user_id as device_user_id",
        "device.revoked_at as device_revoked_at",
        "user.id as user_id",
        "user.active",
      ])
      .where("access.token_hash", "=", tokenHash)
      .where("access.revoked_at", "is", null)
      .where("access.expires_at", ">", now)
      .executeTakeFirst();
  }

  async revokeSession(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.database
      .updateTable("web_sessions")
      .set({ revoked_at: now })
      .where("token_hash", "=", tokenHash)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async createPairingRequest(input: CreatePairingInput) {
    return this.database
      .insertInto("pairing_requests")
      .values({
        id: input.id ?? randomUUID(),
        code_hash: input.codeHash,
        correlation_hash: input.correlationHash,
        device_name: input.deviceName,
        platform: input.platform,
        status: "pending",
        expires_at: input.expiresAt,
        approved_by_user_id: null,
        device_id: null,
        consumed_at: null,
      })
      .returning(["id", "device_name", "platform", "status", "expires_at", "approved_by_user_id"])
      .executeTakeFirstOrThrow();
  }

  async findPairingByCode(codeHash: string, now: Date) {
    await this.expirePairings(now);
    return this.database
      .selectFrom("pairing_requests")
      .select(["id", "device_name", "platform", "status", "expires_at", "approved_by_user_id"])
      .where("code_hash", "=", codeHash)
      .executeTakeFirst();
  }

  async inspectPairing(input: InspectPairingInput) {
    return this.database.transaction().execute(async (transaction) => {
      const pairing = await transaction
        .selectFrom("pairing_requests")
        .selectAll()
        .where("id", "=", input.pairingId)
        .forUpdate()
        .executeTakeFirst();
      if (!pairing) {
        return { ok: false as const, reason: "not_found" as const };
      }
      const association = await verifyPairingAssociation(transaction, pairing, input);
      if (!association.ok) {
        return association;
      }

      let status = pairing.status;
      if (
        pairing.expires_at.getTime() <= input.now.getTime() &&
        (status === "pending" || status === "approved")
      ) {
        status = "expired";
        await transaction
          .updateTable("pairing_requests")
          .set({ status, updated_at: input.now })
          .where("id", "=", pairing.id)
          .execute();
      }

      return {
        ok: true as const,
        pairing: {
          id: pairing.id,
          status,
          expires_at: pairing.expires_at,
        },
      };
    });
  }

  async decidePairing(input: {
    codeHash: string;
    userId: string;
    decision: "approved" | "denied";
    requestId: string;
    now: Date;
  }) {
    return this.database.transaction().execute(async (transaction) => {
      const pairing = await transaction
        .selectFrom("pairing_requests")
        .selectAll()
        .where("code_hash", "=", input.codeHash)
        .forUpdate()
        .executeTakeFirst();
      if (!pairing) {
        return { ok: false as const, reason: "not_found" as const };
      }
      if (pairing.expires_at.getTime() <= input.now.getTime()) {
        if (pairing.status === "pending") {
          await transaction
            .updateTable("pairing_requests")
            .set({ status: "expired", updated_at: input.now })
            .where("id", "=", pairing.id)
            .execute();
        }
        return { ok: false as const, reason: "expired" as const };
      }
      if (pairing.status !== "pending") {
        if (pairing.status === "revoked" && pairing.attempts >= MAX_PAIRING_ASSOCIATION_ATTEMPTS) {
          return { ok: false as const, reason: "attempts_exceeded" as const };
        }
        return { ok: false as const, reason: pairing.status };
      }
      const updated = await transaction
        .updateTable("pairing_requests")
        .set({
          status: input.decision,
          approved_by_user_id: input.decision === "approved" ? input.userId : null,
          updated_at: input.now,
        })
        .where("id", "=", pairing.id)
        .returning(["id", "status", "device_name", "platform", "expires_at"])
        .executeTakeFirstOrThrow();
      await writeAudit(transaction, {
        actorUserId: input.userId,
        requestId: input.requestId,
        action: "pairing.decision",
        result: input.decision,
        reasonCode: input.decision === "approved" ? "PAIRING_APPROVED" : "PAIRING_DENIED",
        metadata: { pairingId: pairing.id, platform: pairing.platform },
      });
      return { ok: true as const, pairing: updated };
    });
  }

  async consumePairing(input: ConsumePairingInput) {
    return this.database.transaction().execute(async (transaction) => {
      const pairing = await transaction
        .selectFrom("pairing_requests")
        .selectAll()
        .where("id", "=", input.pairingId)
        .forUpdate()
        .executeTakeFirst();
      if (!pairing) {
        return { ok: false as const, reason: "not_found" as const };
      }
      const association = await verifyPairingAssociation(transaction, pairing, input);
      if (!association.ok) {
        return association;
      }
      if (
        pairing.expires_at.getTime() <= input.now.getTime() &&
        (pairing.status === "pending" || pairing.status === "approved")
      ) {
        await transaction
          .updateTable("pairing_requests")
          .set({ status: "expired", updated_at: input.now })
          .where("id", "=", pairing.id)
          .execute();
        return { ok: false as const, reason: "expired" as const };
      }
      if (pairing.status !== "approved" || !pairing.approved_by_user_id) {
        if (pairing.status === "revoked" && pairing.attempts >= MAX_PAIRING_ASSOCIATION_ATTEMPTS) {
          return { ok: false as const, reason: "attempts_exceeded" as const };
        }
        return { ok: false as const, reason: pairing.status };
      }

      const deviceId = input.deviceId ?? randomUUID();
      await transaction
        .insertInto("devices")
        .values({
          id: deviceId,
          user_id: pairing.approved_by_user_id,
          name: pairing.device_name,
          platform: pairing.platform,
        })
        .execute();
      await transaction
        .insertInto("device_credentials")
        .values({
          id: input.credentialId ?? randomUUID(),
          device_id: deviceId,
          secret_hash: input.credentialHash,
          expires_at: null,
          revoked_at: null,
        })
        .execute();
      await transaction
        .insertInto("device_access_tokens")
        .values({
          id: input.accessTokenId ?? randomUUID(),
          device_id: deviceId,
          user_id: pairing.approved_by_user_id,
          token_hash: input.accessTokenHash,
          expires_at: input.accessTokenExpiresAt,
          revoked_at: null,
        })
        .execute();
      await transaction
        .updateTable("pairing_requests")
        .set({
          status: "consumed",
          device_id: deviceId,
          consumed_at: input.now,
          updated_at: input.now,
        })
        .where("id", "=", pairing.id)
        .execute();
      await writeAudit(transaction, {
        actorUserId: pairing.approved_by_user_id,
        deviceId,
        requestId: input.requestId,
        action: "pairing.consume",
        result: "success",
        reasonCode: "PAIRING_CONSUMED",
        metadata: { pairingId: pairing.id, platform: pairing.platform },
      });
      return {
        ok: true as const,
        deviceId,
        userId: pairing.approved_by_user_id,
      };
    });
  }

  async issueDeviceAccessToken(input: IssueDeviceAccessTokenInput) {
    return this.database.transaction().execute(async (transaction) => {
      const credential = await transaction
        .selectFrom("devices as device")
        .innerJoin("device_credentials as credential", "credential.device_id", "device.id")
        .innerJoin("users as user", "user.id", "device.user_id")
        .select([
          "device.id as device_id",
          "device.user_id",
          "device.revoked_at as device_revoked_at",
          "credential.secret_hash",
          "credential.expires_at as credential_expires_at",
          "credential.revoked_at as credential_revoked_at",
          "user.active as user_active",
        ])
        .where("device.id", "=", input.deviceId)
        .forUpdate()
        .executeTakeFirst();
      if (!credential || !hashesEqual(credential.secret_hash, input.credentialHash)) {
        return { ok: false as const, reason: "credential_invalid" as const };
      }
      if (credential.device_revoked_at || credential.credential_revoked_at) {
        return { ok: false as const, reason: "device_revoked" as const };
      }
      if (
        credential.credential_expires_at &&
        credential.credential_expires_at.getTime() <= input.now.getTime()
      ) {
        return { ok: false as const, reason: "credential_invalid" as const };
      }
      if (!credential.user_active) {
        return { ok: false as const, reason: "account_inactive" as const };
      }

      await transaction
        .insertInto("device_access_tokens")
        .values({
          id: input.accessTokenId ?? randomUUID(),
          device_id: credential.device_id,
          user_id: credential.user_id,
          token_hash: input.accessTokenHash,
          expires_at: input.accessTokenExpiresAt,
          revoked_at: null,
        })
        .execute();
      await writeAudit(transaction, {
        actorUserId: credential.user_id,
        deviceId: credential.device_id,
        requestId: input.requestId,
        action: "device.access_token.issue",
        result: "success",
        reasonCode: "DEVICE_ACCESS_TOKEN_ISSUED",
      });

      return {
        ok: true as const,
        deviceId: credential.device_id,
        userId: credential.user_id,
      };
    });
  }

  async listDevices(userId: string) {
    return this.database
      .selectFrom("devices")
      .select(["id", "name", "platform", "created_at", "revoked_at"])
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async revokeDevice(input: {
    deviceId: string;
    userId: string;
    requestId: string;
    now: Date;
  }): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const device = await transaction
        .selectFrom("devices")
        .select(["id"])
        .where("id", "=", input.deviceId)
        .where("user_id", "=", input.userId)
        .where("revoked_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if (!device) {
        return false;
      }
      await transaction
        .updateTable("devices")
        .set({ revoked_at: input.now })
        .where("id", "=", input.deviceId)
        .execute();
      await transaction
        .updateTable("device_credentials")
        .set({ revoked_at: input.now })
        .where("device_id", "=", input.deviceId)
        .execute();
      await transaction
        .updateTable("device_access_tokens")
        .set({ revoked_at: input.now })
        .where("device_id", "=", input.deviceId)
        .execute();
      await transaction
        .updateTable("pairing_requests")
        .set({ status: "revoked", updated_at: input.now })
        .where("device_id", "=", input.deviceId)
        .execute();
      await writeAudit(transaction, {
        actorUserId: input.userId,
        deviceId: input.deviceId,
        requestId: input.requestId,
        action: "device.revoke",
        result: "success",
        reasonCode: "DEVICE_REVOKED",
      });
      return true;
    });
  }

  private async expirePairings(now: Date): Promise<void> {
    await this.database
      .updateTable("pairing_requests")
      .set({ status: "expired", updated_at: now })
      .where("status", "=", "pending")
      .where("expires_at", "<=", now)
      .execute();
  }
}

async function verifyPairingAssociation(
  transaction: Transaction<DatabaseSchema>,
  pairing: Selectable<PairingRequestTable>,
  input: {
    correlationHash: string;
    requestId: string;
    now: Date;
  },
) {
  if (hashesEqual(pairing.correlation_hash, input.correlationHash)) {
    if (pairing.status === "revoked" && pairing.attempts >= MAX_PAIRING_ASSOCIATION_ATTEMPTS) {
      return { ok: false as const, reason: "attempts_exceeded" as const };
    }
    return { ok: true as const };
  }

  const canBeLocked = pairing.status === "pending" || pairing.status === "approved";
  const nextAttempts = canBeLocked ? pairing.attempts + 1 : pairing.attempts;
  const attemptsExceeded = canBeLocked && nextAttempts >= MAX_PAIRING_ASSOCIATION_ATTEMPTS;
  if (canBeLocked) {
    await transaction
      .updateTable("pairing_requests")
      .set({
        attempts: sql`attempts + 1`,
        ...(attemptsExceeded ? { status: "revoked" as const } : {}),
        updated_at: input.now,
      })
      .where("id", "=", pairing.id)
      .execute();
  }
  await writeAudit(transaction, {
    actorUserId: pairing.approved_by_user_id,
    requestId: input.requestId,
    action: "pairing.association",
    result: "failure",
    reasonCode: attemptsExceeded ? "PAIRING_ATTEMPTS_EXCEEDED" : "PAIRING_ASSOCIATION_MISMATCH",
    metadata: {
      pairingId: pairing.id,
      platform: pairing.platform,
    },
  });
  return {
    ok: false as const,
    reason: attemptsExceeded ? ("attempts_exceeded" as const) : ("association_mismatch" as const),
  };
}

function hashesEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
