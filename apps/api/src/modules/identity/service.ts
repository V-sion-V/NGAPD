import { type Database, FoundationRepository, IdentityRepository } from "@ngapd/database";
import type { DeviceAccessTokenRequest, DevicePlatform, PairingDecision } from "@ngapd/contracts";

import { ApplicationError } from "./errors.js";
import {
  createPairingCode,
  createSecret,
  hashPassword,
  hashSecret,
  normalizeLoginName,
  verifyPassword,
} from "./security.js";

const sessionDurationMs = 12 * 60 * 60 * 1_000;
const pairingDurationMs = 10 * 60 * 1_000;
const accessTokenDurationMs = 15 * 60 * 1_000;

export interface ServiceContext {
  requestId: string;
  now: Date;
}

export class IdentityService {
  private readonly foundation: FoundationRepository;
  private readonly identity: IdentityRepository;

  constructor(database: Database) {
    this.foundation = new FoundationRepository(database);
    this.identity = new IdentityRepository(database);
  }

  async register(input: { loginName: string; password: string }, context: ServiceContext) {
    const normalizedLoginName = normalizeLoginName(input.loginName);
    const passwordHash = await hashPassword(input.password);
    try {
      const { user, workspace } = await this.foundation.createUserWithWorkspace({
        loginName: input.loginName.normalize("NFKC").trim(),
        normalizedLoginName,
        passwordHash,
      });
      const session = await this.issueSession(user.id, context.now);
      await this.foundation.writeAudit({
        actorUserId: user.id,
        workspaceId: workspace.id,
        requestId: context.requestId,
        action: "identity.register",
        result: "success",
        reasonCode: "USER_REGISTERED",
      });
      return {
        token: session.token,
        actor: {
          userId: user.id,
          loginName: user.login_name,
          expiresAt: session.expiresAt.toISOString(),
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApplicationError(409, "LOGIN_NAME_TAKEN", "该登录名已被使用", "请使用其他登录名");
      }
      throw error;
    }
  }

  async login(input: { loginName: string; password: string }, context: ServiceContext) {
    const user = await this.identity.findUserForLogin(normalizeLoginName(input.loginName));
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw new ApplicationError(
        401,
        "AUTHENTICATION_FAILED",
        "登录名或密码不正确",
        "请检查凭据后重试",
      );
    }
    if (!user.active) {
      throw new ApplicationError(403, "ACCOUNT_INACTIVE", "账号当前不可用", "请联系管理员恢复账号");
    }
    const session = await this.issueSession(user.id, context.now);
    await this.foundation.writeAudit({
      actorUserId: user.id,
      requestId: context.requestId,
      action: "identity.login",
      result: "success",
      reasonCode: "LOGIN_SUCCEEDED",
    });
    return {
      token: session.token,
      actor: {
        userId: user.id,
        loginName: user.login_name,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  async resolveSession(token: string | undefined, now: Date) {
    if (!token) {
      throw authenticationRequired();
    }
    const session = await this.identity.resolveSession(hashSecret(token), now);
    if (!session) {
      throw authenticationRequired();
    }
    if (!session.active) {
      throw new ApplicationError(403, "ACCOUNT_INACTIVE", "账号当前不可用", "请联系管理员恢复账号");
    }
    return {
      sessionId: session.session_id,
      userId: session.user_id,
      loginName: session.login_name,
      expiresAt: session.expires_at,
    };
  }

  async resolveAccessToken(token: string | undefined, now: Date) {
    if (!token) {
      throw authenticationRequired();
    }
    const access = await this.identity.resolveAccessToken(hashSecret(token), now);
    if (!access) {
      throw authenticationRequired();
    }
    if (!access.active || access.device_revoked_at || access.device_user_id !== access.user_id) {
      throw new ApplicationError(
        403,
        access.device_revoked_at ? "DEVICE_REVOKED" : "ACCOUNT_INACTIVE",
        "设备或账号当前不可用",
        "请重新配对或联系管理员恢复账号",
      );
    }
    return {
      accessTokenId: access.access_token_id,
      userId: access.user_id,
      deviceId: access.device_id,
      expiresAt: access.expires_at,
    };
  }

  async logout(token: string | undefined, context: ServiceContext): Promise<void> {
    if (!token) {
      throw authenticationRequired();
    }
    const session = await this.resolveSession(token, context.now);
    await this.identity.revokeSession(hashSecret(token), context.now);
    await this.foundation.writeAudit({
      actorUserId: session.userId,
      requestId: context.requestId,
      action: "identity.logout",
      result: "success",
      reasonCode: "SESSION_REVOKED",
    });
  }

  async createPairing(
    input: {
      deviceName: string;
      platform: DevicePlatform;
      correlationSecret: string;
    },
    context: ServiceContext,
  ) {
    const code = createPairingCode();
    const expiresAt = new Date(context.now.getTime() + pairingDurationMs);
    const pairing = await this.identity.createPairingRequest({
      codeHash: hashSecret(code),
      correlationHash: hashSecret(input.correlationSecret),
      deviceName: input.deviceName,
      platform: input.platform,
      expiresAt,
    });
    return {
      pairingId: pairing.id,
      code,
      verificationPath: `/pairing?code=${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async pairingSummary(code: string, now: Date) {
    const pairing = await this.identity.findPairingByCode(
      hashSecret(normalizePairingCode(code)),
      now,
    );
    if (!pairing) {
      throw pairingNotFound();
    }
    return {
      pairingId: pairing.id,
      status: pairing.status,
      device: {
        name: pairing.device_name,
        platform: pairing.platform,
      },
      expiresAt: pairing.expires_at.toISOString(),
    };
  }

  async pairingStatus(pairingId: string, correlationSecret: string, context: ServiceContext) {
    const result = await this.identity.inspectPairing({
      pairingId,
      correlationHash: hashSecret(correlationSecret),
      requestId: context.requestId,
      now: context.now,
    });
    if (!result.ok) {
      throw pairingFailure(result.reason);
    }
    return {
      pairingId: result.pairing.id,
      status: result.pairing.status,
      expiresAt: result.pairing.expires_at.toISOString(),
    };
  }

  async decidePairing(
    code: string,
    decision: PairingDecision["decision"],
    userId: string,
    context: ServiceContext,
  ) {
    const result = await this.identity.decidePairing({
      codeHash: hashSecret(normalizePairingCode(code)),
      userId,
      decision: decision === "approve" ? "approved" : "denied",
      requestId: context.requestId,
      now: context.now,
    });
    if (!result.ok) {
      throw pairingFailure(result.reason);
    }
    return {
      pairingId: result.pairing.id,
      status: result.pairing.status,
      device: {
        name: result.pairing.device_name,
        platform: result.pairing.platform,
      },
      expiresAt: result.pairing.expires_at.toISOString(),
    };
  }

  async consumePairing(pairingId: string, correlationSecret: string, context: ServiceContext) {
    const accessToken = createSecret();
    const deviceCredential = createSecret();
    const accessTokenExpiresAt = new Date(context.now.getTime() + accessTokenDurationMs);
    const result = await this.identity.consumePairing({
      pairingId,
      correlationHash: hashSecret(correlationSecret),
      credentialHash: hashSecret(deviceCredential),
      accessTokenHash: hashSecret(accessToken),
      accessTokenExpiresAt,
      requestId: context.requestId,
      now: context.now,
    });
    if (!result.ok) {
      throw pairingFailure(result.reason);
    }
    return {
      deviceId: result.deviceId,
      accessToken,
      deviceCredential,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }

  async issueDeviceAccessToken(input: DeviceAccessTokenRequest, context: ServiceContext) {
    const accessToken = createSecret();
    const accessTokenExpiresAt = new Date(context.now.getTime() + accessTokenDurationMs);
    const result = await this.identity.issueDeviceAccessToken({
      deviceId: input.deviceId,
      credentialHash: hashSecret(input.deviceCredential),
      accessTokenHash: hashSecret(accessToken),
      accessTokenExpiresAt,
      requestId: context.requestId,
      now: context.now,
    });
    if (!result.ok) {
      throw deviceCredentialFailure(result.reason);
    }
    return {
      deviceId: result.deviceId,
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    };
  }

  async listDevices(userId: string) {
    const devices = await this.identity.listDevices(userId);
    return {
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        platform: device.platform,
        createdAt: device.created_at.toISOString(),
        revokedAt: device.revoked_at?.toISOString() ?? null,
      })),
    };
  }

  async revokeDevice(deviceId: string, userId: string, context: ServiceContext): Promise<void> {
    if (
      !(await this.identity.revokeDevice({
        deviceId,
        userId,
        requestId: context.requestId,
        now: context.now,
      }))
    ) {
      throw new ApplicationError(404, "FORBIDDEN", "设备不存在或不可撤销", "请刷新设备列表后重试");
    }
  }

  async revokeCurrentDevice(
    identity: { userId: string; deviceId: string },
    context: ServiceContext,
  ): Promise<void> {
    await this.revokeDevice(identity.deviceId, identity.userId, context);
  }

  private async issueSession(userId: string, now: Date) {
    const token = createSecret();
    const expiresAt = new Date(now.getTime() + sessionDurationMs);
    await this.identity.createSession({
      tokenHash: hashSecret(token),
      userId,
      expiresAt,
    });
    return { token, expiresAt };
  }
}

function authenticationRequired() {
  return new ApplicationError(401, "AUTHENTICATION_REQUIRED", "需要登录后继续", "请先登录");
}

function pairingNotFound() {
  return new ApplicationError(
    404,
    "PAIRING_NOT_FOUND",
    "配对请求不存在",
    "请在 CLI 中重新发起配对",
  );
}

function pairingFailure(reason: string): ApplicationError {
  switch (reason) {
    case "pending":
      return new ApplicationError(
        409,
        "PAIRING_PENDING",
        "配对请求仍在等待确认",
        "请在 Web 中确认设备后继续等待",
      );
    case "expired":
      return new ApplicationError(
        410,
        "PAIRING_EXPIRED",
        "配对请求已过期",
        "请在 CLI 中重新发起配对",
      );
    case "denied":
      return new ApplicationError(
        409,
        "PAIRING_DENIED",
        "配对请求已被拒绝",
        "如需继续，请重新发起配对",
      );
    case "consumed":
      return new ApplicationError(
        409,
        "PAIRING_CONSUMED",
        "配对请求已经使用",
        "请使用已配对设备或重新发起配对",
      );
    case "association_mismatch":
      return new ApplicationError(
        403,
        "PAIRING_ASSOCIATION_MISMATCH",
        "配对关联校验失败",
        "请回到发起该配对的 CLI 重试",
      );
    case "attempts_exceeded":
      return new ApplicationError(
        429,
        "PAIRING_ATTEMPTS_EXCEEDED",
        "配对关联尝试次数已达上限",
        "请在 CLI 中重新发起配对",
      );
    case "revoked":
      return new ApplicationError(403, "DEVICE_REVOKED", "设备授权已撤销", "请重新发起配对");
    default:
      return pairingNotFound();
  }
}

function deviceCredentialFailure(reason: string): ApplicationError {
  switch (reason) {
    case "device_revoked":
      return new ApplicationError(403, "DEVICE_REVOKED", "设备授权已撤销", "请重新发起配对");
    case "account_inactive":
      return new ApplicationError(
        403,
        "ACCOUNT_INACTIVE",
        "账号当前不可用",
        "请联系管理员恢复账号",
      );
    default:
      return new ApplicationError(
        401,
        "DEVICE_CREDENTIAL_INVALID",
        "设备凭据无效",
        "请检查本机凭据状态或重新发起配对",
      );
  }
}

function normalizePairingCode(code: string): string {
  return code.replaceAll("-", "").trim().toUpperCase();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
