import { createHash, randomUUID } from "node:crypto";

import { Migrator, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { IdentityRepository } from "./identity-repository.js";
import { StaticMigrationProvider } from "./migrations.js";
import { ProjectMembershipRepository } from "./project-membership-repository.js";
import { ProjectRoleRepository } from "./project-role-repository.js";
import { TaskRepository } from "./task-repository.js";
import { WorkspaceRepository } from "./workspace-repository.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;

describeWithDatabase("M1 project, membership, role and governance repositories", () => {
  const foundation = new FoundationRepository(database!);
  const identity = new IdentityRepository(database!);
  const projects = new ProjectMembershipRepository(database!);
  const roles = new ProjectRoleRepository(database!);
  const tasks = new TaskRepository(database!);
  const workspaces = new WorkspaceRepository(database!);

  beforeAll(async () => {
    await sql`drop schema if exists public cascade`.execute(database!);
    await sql`create schema public`.execute(database!);
    const migrated = await new Migrator({
      db: database!,
      provider: new StaticMigrationProvider(),
    }).migrateToLatest();
    expect(migrated.error).toBeUndefined();
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("updates a versioned profile and creates one complete project for idempotent retries", async () => {
    const actor = await createUser("profile-owner");
    const templates = await roles.listSystemTemplates();
    expect(templates).toHaveLength(74);
    expect(templates).toEqual(
      [...templates].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    );

    await expect(
      identity.updateUserProfile({
        userId: actor.userId,
        displayName: "Profile Owner",
        defaultIntroduction: "Owns the project",
        defaultRoleTemplateIds: [templates[1]!.id, templates[0]!.id, templates[1]!.id],
        expectedVersion: 1,
        requestId: randomUUID(),
        now: new Date("2026-07-28T14:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      ok: true,
      profile: {
        displayName: "Profile Owner",
        defaultRoleTemplateIds: [templates[0]!.id, templates[1]!.id].sort(),
        version: 2,
      },
    });
    await expect(
      identity.updateUserProfile({
        userId: actor.userId,
        displayName: "Stale",
        defaultIntroduction: "",
        defaultRoleTemplateIds: [],
        expectedVersion: 1,
        requestId: randomUUID(),
        now: new Date("2026-07-28T14:00:01.000Z"),
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "version_conflict",
      currentVersion: 2,
    });

    const idempotencyKey = randomUUID();
    const requestSha256 = hashRequest({ key: "PRA", name: "Profile project" });
    const input = {
      actorUserId: actor.userId,
      key: "PRA",
      name: "Profile project",
      description: "Atomic",
      completedSuccessorReopenPolicy: "deny" as const,
      requestId: randomUUID(),
      idempotencyKey,
      requestSha256,
      now: new Date("2026-07-28T14:01:00.000Z"),
    };
    const first = await projects.createProject(input);
    expect(first).toMatchObject({
      ok: true,
      project: { key: "PRA", lifecycle: "active", version: 1 },
      idempotentReplay: false,
    });
    const replay = await projects.createProject({ ...input, requestId: randomUUID() });
    expect(replay).toMatchObject({
      ok: true,
      project: { id: first.ok ? first.project.id : "" },
      idempotentReplay: true,
    });
    await expect(
      projects.createProject({
        ...input,
        requestId: randomUUID(),
        requestSha256: "f".repeat(64),
      }),
    ).resolves.toEqual({ ok: false, reason: "idempotency_conflict" });

    const projectId = first.ok ? first.project.id : "";
    const summary = await database!
      .selectFrom("project_logical_roles")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("project_id", "=", projectId)
      .executeTakeFirstOrThrow();
    expect(Number(summary.count)).toBe(74);
    expect(await countRows("memberships", "project_id", projectId)).toBe(1);
    expect(await countRows("workspaces", "scope_id", projectId)).toBe(1);
    expect(await countRows("outbox_events", "aggregate_id", projectId)).toBe(1);
    expect(
      await database!
        .selectFrom("audit_events")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("action", "=", "project.create")
        .where("target_id", "=", projectId)
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(1);

    const concurrentIdempotencyKey = randomUUID();
    const concurrentRequestSha256 = hashRequest({ key: "PRB", name: "Concurrent retry" });
    const concurrentInput = {
      actorUserId: actor.userId,
      key: "PRB",
      name: "Concurrent retry",
      description: "Serialized by the idempotency key",
      completedSuccessorReopenPolicy: "deny" as const,
      idempotencyKey: concurrentIdempotencyKey,
      requestSha256: concurrentRequestSha256,
      now: new Date("2026-07-28T14:02:00.000Z"),
    };
    const concurrentResults = await Promise.all([
      projects.createProject({ ...concurrentInput, requestId: randomUUID() }),
      projects.createProject({ ...concurrentInput, requestId: randomUUID() }),
    ]);
    expect(concurrentResults.every((result) => result.ok)).toBe(true);
    const concurrentProjectIds = concurrentResults.map((result) =>
      result.ok ? result.project.id : "",
    );
    expect(new Set(concurrentProjectIds).size).toBe(1);
    expect(
      concurrentResults.map((result) => (result.ok ? result.idempotentReplay : null)).sort(),
    ).toEqual([false, true]);
    expect(
      await database!
        .selectFrom("projects")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_key", "=", "PRB")
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(1);
  });

  it("copies defaults on first approval and preserves project profile on rejoin", async () => {
    const owner = await createUser("join-owner");
    const applicant = await createUser("join-applicant");
    const templates = await roles.listSystemTemplates();
    const updatedProfile = await identity.updateUserProfile({
      userId: applicant.userId,
      displayName: "Applicant",
      defaultIntroduction: "Initial introduction",
      defaultRoleTemplateIds: [templates[0]!.id],
      expectedVersion: 1,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:10:00.000Z"),
    });
    expect(updatedProfile.ok).toBe(true);
    const project = await createProject(owner.userId, "JOIN");

    const requested = await projects.createJoinRequest({
      actorUserId: applicant.userId,
      projectKey: project.key,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ projectKey: project.key, round: 1 }),
      now: new Date("2026-07-28T14:11:00.000Z"),
    });
    expect(requested).toMatchObject({
      ok: true,
      membership: { status: "pending", hasBeenActive: false },
      request: { status: "pending" },
    });
    if (!requested.ok) {
      throw new Error("join request setup failed");
    }
    const approved = await projects.resolveJoinRequest({
      projectId: project.id,
      joinRequestId: requested.request.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      decision: "approve",
      expectedProjectVersion: 1,
      expectedMembershipVersion: requested.membership.version,
      expectedRequestVersion: requested.request.version,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ requestId: requested.request.id, decision: "approve" }),
      now: new Date("2026-07-28T14:12:00.000Z"),
    });
    expect(approved).toMatchObject({
      ok: true,
      membership: {
        status: "active",
        permissionLevel: "member",
        introduction: "Initial introduction",
      },
    });
    if (!approved.ok) {
      throw new Error("join approval setup failed");
    }
    expect(approved.membership.roleIds).toHaveLength(1);

    const customRole = (await roles.listProjectRoles(project.id)).find(
      (role) => role.sourceTemplateId === templates[1]!.id,
    )!;
    const customized = await projects.updateMembershipProfile({
      projectId: project.id,
      targetMembershipId: approved.membership.id,
      actorUserId: applicant.userId,
      actorMembershipId: approved.membership.id,
      webSessionId: applicant.webSessionId,
      introduction: "Project-specific profile",
      roleIds: [customRole.id],
      expectedMembershipVersion: approved.membership.version,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:13:00.000Z"),
    });
    expect(customized).toMatchObject({
      ok: true,
      membership: {
        introduction: "Project-specific profile",
        roleIds: [customRole.id],
      },
    });
    if (!customized.ok) {
      throw new Error("membership customization failed");
    }
    await identity.updateUserProfile({
      userId: applicant.userId,
      displayName: "Applicant v2",
      defaultIntroduction: "Changed personal default",
      defaultRoleTemplateIds: [templates[2]!.id],
      expectedVersion: 2,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:14:00.000Z"),
    });
    const removed = await projects.removeMembership({
      projectId: project.id,
      targetMembershipId: approved.membership.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      expectedProjectVersion: 1,
      expectedMembershipVersion: customized.membership.version,
      confirmedBlockingTaskIds: [],
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ membershipId: approved.membership.id, action: "remove" }),
      now: new Date("2026-07-28T14:15:00.000Z"),
    });
    expect(removed).toMatchObject({
      ok: true,
      membership: { status: "removed", permissionLevel: "member" },
    });
    if (!removed.ok) {
      throw new Error("membership removal failed");
    }
    const rerequested = await projects.createJoinRequest({
      actorUserId: applicant.userId,
      projectKey: project.key,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ projectKey: project.key, round: 2 }),
      now: new Date("2026-07-28T14:16:00.000Z"),
    });
    expect(rerequested).toMatchObject({
      ok: true,
      membership: { id: approved.membership.id, status: "pending" },
    });
    if (!rerequested.ok) {
      throw new Error("rejoin request failed");
    }
    const reapproved = await projects.resolveJoinRequest({
      projectId: project.id,
      joinRequestId: rerequested.request.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      decision: "approve",
      expectedProjectVersion: 1,
      expectedMembershipVersion: rerequested.membership.version,
      expectedRequestVersion: rerequested.request.version,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ requestId: rerequested.request.id, decision: "approve" }),
      now: new Date("2026-07-28T14:17:00.000Z"),
    });
    expect(reapproved).toMatchObject({
      ok: true,
      membership: {
        id: approved.membership.id,
        status: "active",
        permissionLevel: "member",
        introduction: "Project-specific profile",
        roleIds: [customRole.id],
      },
    });
    expect(await countRows("memberships", "user_id", applicant.userId)).toBe(1);
  });

  it("requires a valid Admin Mode for role governance and preserves archived bindings", async () => {
    const owner = await createUser("role-owner");
    const attacker = await createUser("role-attacker");
    const project = await createProject(owner.userId, "ROLE");
    await expect(
      projects.openAdminMode({
        projectId: project.id,
        actorUserId: attacker.userId,
        actorMembershipId: project.ownerMembershipId,
        webSessionId: attacker.webSessionId,
        expectedMembershipVersion: 1,
        requestId: randomUUID(),
        idempotencyKey: randomUUID(),
        requestSha256: hashRequest({ projectId: project.id, operation: "forged-open" }),
        now: new Date("2026-07-28T14:19:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    const opened = await projects.openAdminMode({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      expectedMembershipVersion: 1,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ projectId: project.id, operation: "open" }),
      now: new Date("2026-07-28T14:20:00.000Z"),
    });
    expect(opened).toMatchObject({ ok: true, adminMode: { status: "active", version: 1 } });
    if (!opened.ok) {
      throw new Error("admin mode setup failed");
    }

    const created = await roles.createProjectRole({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      adminModeId: opened.adminMode.id,
      name: "Custom role",
      capability: "Untrusted capability text",
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ name: "Custom role" }),
      now: new Date("2026-07-28T14:21:00.000Z"),
    });
    expect(created).toMatchObject({
      ok: true,
      role: { status: "active", capability: "Untrusted capability text" },
    });
    if (!created.ok) {
      throw new Error("role creation failed");
    }
    const bound = await projects.updateMembershipProfile({
      projectId: project.id,
      targetMembershipId: project.ownerMembershipId,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      introduction: "Owner",
      roleIds: [created.role.id],
      expectedMembershipVersion: 1,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:21:30.000Z"),
    });
    expect(bound).toMatchObject({ ok: true, membership: { roleIds: [created.role.id] } });

    const updated = await roles.updateProjectRole({
      projectId: project.id,
      roleId: created.role.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      adminModeId: opened.adminMode.id,
      name: "Custom role v2",
      capability: "Prompt text still grants no authorization",
      expectedVersion: created.role.version,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:22:00.000Z"),
    });
    expect(updated).toMatchObject({ ok: true, role: { version: 2 } });
    if (!updated.ok) {
      throw new Error("role update failed");
    }
    const archived = await roles.archiveProjectRole({
      projectId: project.id,
      roleId: created.role.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      adminModeId: opened.adminMode.id,
      expectedVersion: updated.role.version,
      requestId: randomUUID(),
      now: new Date("2026-07-28T14:23:00.000Z"),
    });
    expect(archived).toMatchObject({ ok: true, role: { status: "archived", version: 3 } });
    const ownerMembership = await projects.findMembership(project.id, project.ownerMembershipId);
    expect(ownerMembership?.roleIds).toEqual([created.role.id]);
    await expect(
      projects.updateMembershipProfile({
        projectId: project.id,
        targetMembershipId: project.ownerMembershipId,
        actorUserId: owner.userId,
        actorMembershipId: project.ownerMembershipId,
        webSessionId: owner.webSessionId,
        introduction: "Owner",
        roleIds: [created.role.id],
        expectedMembershipVersion: ownerMembership!.version,
        requestId: randomUUID(),
        now: new Date("2026-07-28T14:23:30.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "project_role_archived" });

    const copied = await roles.copyProjectRole({
      projectId: project.id,
      sourceRoleId: created.role.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      adminModeId: opened.adminMode.id,
      name: "Copied active role",
      expectedSourceVersion: 3,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ sourceRoleId: created.role.id }),
      now: new Date("2026-07-28T14:24:00.000Z"),
    });
    expect(copied).toMatchObject({
      ok: true,
      role: {
        status: "active",
        capability: "Prompt text still grants no authorization",
      },
    });
    const latestAdmin = await projects.readAdminMode({
      adminModeId: opened.adminMode.id,
      actorUserId: owner.userId,
      webSessionId: owner.webSessionId,
      now: new Date("2026-07-28T14:24:01.000Z"),
      requestId: randomUUID(),
    });
    expect(latestAdmin).toMatchObject({
      ok: true,
      adminMode: {
        status: "active",
        lastProtectedActivityAt: new Date("2026-07-28T14:24:00.000Z"),
        expiresAt: new Date("2026-07-28T14:54:00.000Z"),
      },
    });
  });

  it("revokes capabilities on archive and ownership transfer without restoring them", async () => {
    const owner = await createUser("lifecycle-owner");
    const target = await createUser("lifecycle-target");
    const project = await createProject(owner.userId, "LIFE");
    const targetMembership = await foundation.createMembership({
      projectId: project.id,
      userId: target.userId,
      permissionLevel: "member",
    });
    const admin = await projects.openAdminMode({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      webSessionId: owner.webSessionId,
      expectedMembershipVersion: 1,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ operation: "admin", projectId: project.id }),
      now: new Date("2026-07-28T14:30:00.000Z"),
    });
    expect(admin.ok).toBe(true);
    const deviceId = await database!
      .insertInto("devices")
      .values({
        id: randomUUID(),
        user_id: owner.userId,
        name: "Lifecycle device",
        platform: "windows",
      })
      .returning("id")
      .executeTakeFirstOrThrow()
      .then(({ id }) => id);
    await database!
      .insertInto("workspace_leases")
      .values({
        id: randomUUID(),
        workspace_id: project.workspaceId,
        work_cycle: 1,
        user_id: owner.userId,
        device_id: deviceId,
        connection_id: randomUUID(),
        token_hash: "token-hash",
        base_sync_version: "0",
        issued_at: new Date("2026-07-28T14:30:00.000Z"),
        renewed_at: new Date("2026-07-28T14:30:00.000Z"),
        expires_at: new Date("2026-07-28T15:30:00.000Z"),
      })
      .execute();

    const archived = await projects.changeProjectLifecycle({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      lifecycle: "archived",
      expectedProjectVersion: 1,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ lifecycle: "archived" }),
      now: new Date("2026-07-28T14:31:00.000Z"),
    });
    expect(archived).toMatchObject({ ok: true, project: { lifecycle: "archived", version: 2 } });
    const authorization = await workspaces.getAuthorizationSnapshot(
      project.workspaceId,
      owner.userId,
    );
    expect(authorization?.workspace.lifecycle).toBe("archived");
    expect(
      await database!
        .selectFrom("workspace_leases")
        .select("revoked_at")
        .where("workspace_id", "=", project.workspaceId)
        .executeTakeFirstOrThrow(),
    ).toMatchObject({ revoked_at: new Date("2026-07-28T14:31:00.000Z") });
    expect(
      await database!
        .selectFrom("admin_mode_sessions")
        .select("status")
        .where("project_id", "=", project.id)
        .executeTakeFirstOrThrow(),
    ).toEqual({ status: "revoked" });

    const unarchived = await projects.changeProjectLifecycle({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      lifecycle: "active",
      expectedProjectVersion: 2,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ lifecycle: "active" }),
      now: new Date("2026-07-28T14:32:00.000Z"),
    });
    expect(unarchived).toMatchObject({ ok: true, project: { lifecycle: "active", version: 3 } });
    expect(
      await workspaces.getAuthorizationSnapshot(project.workspaceId, owner.userId),
    ).toMatchObject({ workspace: { lifecycle: "active" } });

    const concurrentLeaseId = randomUUID();
    const concurrentConnectionId = randomUUID();
    const [concurrentArchive, concurrentLease] = await Promise.all([
      projects.changeProjectLifecycle({
        projectId: project.id,
        actorUserId: owner.userId,
        actorMembershipId: project.ownerMembershipId,
        lifecycle: "archived",
        expectedProjectVersion: 3,
        requestId: randomUUID(),
        idempotencyKey: randomUUID(),
        requestSha256: hashRequest({ lifecycle: "archived", round: 2 }),
        now: new Date("2026-07-28T14:32:30.000Z"),
      }),
      workspaces.withLockedWorkspace(project.workspaceId, owner.userId, async (unit, auth) => {
        if (auth.workspace.lifecycle !== "active") {
          return { acquired: false };
        }
        const result = await unit.acquireLease({
          id: concurrentLeaseId,
          userId: owner.userId,
          deviceId,
          connectionId: concurrentConnectionId,
          tokenHash: "concurrent-token-hash",
          baseSyncVersion: 0,
          now: new Date("2026-07-28T14:32:30.000Z"),
          expiresAt: new Date("2026-07-28T15:32:30.000Z"),
          requestId: randomUUID(),
        });
        return { acquired: result.ok };
      }),
    ]);
    expect(concurrentArchive).toMatchObject({
      ok: true,
      project: { lifecycle: "archived", version: 4 },
    });
    expect(concurrentLease).toMatchObject({ acquired: expect.any(Boolean) });
    expect(
      await database!
        .selectFrom("workspace_leases")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("workspace_id", "=", project.workspaceId)
        .where("revoked_at", "is", null)
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(0);

    const activeAgain = await projects.changeProjectLifecycle({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      lifecycle: "active",
      expectedProjectVersion: 4,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ lifecycle: "active", round: 2 }),
      now: new Date("2026-07-28T14:32:45.000Z"),
    });
    expect(activeAgain).toMatchObject({ ok: true, project: { lifecycle: "active", version: 5 } });

    const transfer = await projects.createOwnershipTransfer({
      projectId: project.id,
      actorUserId: owner.userId,
      actorMembershipId: project.ownerMembershipId,
      targetMembershipId: targetMembership.id,
      expectedProjectVersion: 5,
      expectedTargetMembershipVersion: 1,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ targetMembershipId: targetMembership.id }),
      now: new Date("2026-07-28T14:33:00.000Z"),
    });
    expect(transfer).toMatchObject({ ok: true, transfer: { status: "pending" } });
    if (!transfer.ok) {
      throw new Error("transfer setup failed");
    }
    const accepted = await projects.resolveOwnershipTransfer({
      projectId: project.id,
      transferId: transfer.transfer.id,
      actorUserId: target.userId,
      actorMembershipId: targetMembership.id,
      action: "accept",
      expectedProjectVersion: 5,
      expectedTransferVersion: transfer.transfer.version,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ transferId: transfer.transfer.id, action: "accept" }),
      now: new Date("2026-07-28T14:34:00.000Z"),
    });
    expect(accepted).toMatchObject({ ok: true, transfer: { status: "accepted" } });
    expect(await projects.findProjectById(project.id)).toMatchObject({
      ownerMembershipId: targetMembership.id,
      version: 6,
    });
    expect(await projects.findMembership(project.id, targetMembership.id)).toMatchObject({
      permissionLevel: "member",
    });
    expect(await projects.findMembership(project.id, project.ownerMembershipId)).toMatchObject({
      permissionLevel: "admin",
    });
  });

  it("serializes member removal with Task Owner creation and never commits a removed active owner", async () => {
    for (let iteration = 0; iteration < 4; iteration += 1) {
      const owner = await createUser(`race-owner-${iteration}`);
      const member = await createUser(`race-member-${iteration}`);
      const project = await createProject(
        owner.userId,
        `R${String.fromCharCode(65 + iteration)}CE`,
      );
      const memberRow = await foundation.createMembership({
        projectId: project.id,
        userId: member.userId,
        permissionLevel: "member",
      });
      const taskId = randomUUID();
      const [taskResult, removalResult] = await Promise.all([
        tasks.createTask({
          id: taskId,
          projectId: project.id,
          actorMembershipId: project.ownerMembershipId,
          idempotencyKey: randomUUID(),
          requestSha256: hashRequest({ taskId, owner: memberRow.id }),
          title: "Concurrent ownership",
          parentTaskId: null,
          explicitOwnerMembershipId: memberRow.id,
        }),
        projects.removeMembership({
          projectId: project.id,
          targetMembershipId: memberRow.id,
          actorUserId: owner.userId,
          actorMembershipId: project.ownerMembershipId,
          expectedProjectVersion: 1,
          expectedMembershipVersion: 1,
          confirmedBlockingTaskIds: [],
          requestId: randomUUID(),
          idempotencyKey: randomUUID(),
          requestSha256: hashRequest({ membershipId: memberRow.id, operation: "remove" }),
          now: new Date(`2026-07-28T14:4${iteration}:00.000Z`),
        }),
      ]);
      const membership = await projects.findMembership(project.id, memberRow.id);
      const task = await tasks.findTask(taskId);
      expect(
        membership?.status === "removed" && task?.explicitOwnerMembershipId === memberRow.id,
      ).toBe(false);
      if (membership?.status === "removed") {
        expect(taskResult).toMatchObject({ ok: false, reason: "task_ownership_invalid" });
        expect(removalResult).toMatchObject({ ok: true });
      } else {
        expect(taskResult).toMatchObject({ ok: true });
        expect(removalResult).toMatchObject({
          ok: false,
          reason: "active_task_ownership_blocked",
          blockingTasks: [{ id: taskId }],
        });
      }
    }
  });

  it("rolls back business state, audit, outbox and idempotency when the outbox boundary fails", async () => {
    const owner = await createUser("fault-owner");
    const member = await createUser("fault-member");
    const project = await createProject(owner.userId, "FAIL");
    const memberRow = await foundation.createMembership({
      projectId: project.id,
      userId: member.userId,
      permissionLevel: "member",
    });
    const idempotencyKey = randomUUID();
    await sql`
      create function ngapd_test_fail_m1_outbox()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.event_type = 'membership.permission.changed' then
          raise exception 'injected m1 outbox failure';
        end if;
        return new;
      end
      $function$
    `.execute(database!);
    await sql`
      create trigger ngapd_test_fail_m1_outbox
      before insert on outbox_events
      for each row execute function ngapd_test_fail_m1_outbox()
    `.execute(database!);
    try {
      await expect(
        projects.changeMembershipPermission({
          projectId: project.id,
          targetMembershipId: memberRow.id,
          actorUserId: owner.userId,
          actorMembershipId: project.ownerMembershipId,
          permissionLevel: "admin",
          expectedProjectVersion: 1,
          expectedMembershipVersion: 1,
          requestId: randomUUID(),
          idempotencyKey,
          requestSha256: hashRequest({ membershipId: memberRow.id, permission: "admin" }),
          now: new Date("2026-07-28T14:50:00.000Z"),
        }),
      ).rejects.toThrow("injected m1 outbox failure");
    } finally {
      await sql`drop trigger ngapd_test_fail_m1_outbox on outbox_events`.execute(database!);
      await sql`drop function ngapd_test_fail_m1_outbox()`.execute(database!);
    }
    expect(await projects.findMembership(project.id, memberRow.id)).toMatchObject({
      permissionLevel: "member",
      version: 1,
    });
    expect(
      await database!
        .selectFrom("audit_events")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("action", "=", "membership.permission.change")
        .where("target_id", "=", memberRow.id)
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(0);
    expect(
      await database!
        .selectFrom("m1_idempotency_records")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(0);
  });

  async function createUser(loginName: string) {
    const created = await foundation.createUserWithWorkspace({
      loginName,
      normalizedLoginName: loginName,
      passwordHash: "argon2id$fixture",
    });
    const session = await identity.createSession({
      tokenHash: `session-${randomUUID()}`,
      userId: created.user.id,
      expiresAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    return { userId: created.user.id, webSessionId: session.id };
  }

  async function createProject(actorUserId: string, key: string) {
    const created = await projects.createProject({
      actorUserId,
      key,
      name: `${key} Project`,
      description: "",
      completedSuccessorReopenPolicy: "deny",
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      requestSha256: hashRequest({ key }),
      now: new Date("2026-07-28T13:00:00.000Z"),
    });
    if (!created.ok) {
      throw new Error(`project fixture failed: ${created.reason}`);
    }
    return created.project;
  }

  async function countRows(
    table: "memberships" | "workspaces" | "outbox_events",
    column: "project_id" | "scope_id" | "aggregate_id" | "user_id",
    value: string,
  ) {
    const result = await database!
      .selectFrom(table)
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where(column, "=", value)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }
});

function hashRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
