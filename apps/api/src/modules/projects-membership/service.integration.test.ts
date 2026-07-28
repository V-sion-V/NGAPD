import { createHash, randomUUID } from "node:crypto";

import {
  createDatabase,
  FoundationRepository,
  IdentityRepository,
  migrateToLatest,
  type Database,
} from "@ngapd/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApplicationError } from "../../application-errors.js";
import {
  AdminModeService,
  type AuthenticatedM1Actor,
  type M1ApplicationContext,
} from "../authorization-audit/index.js";
import { IdentityService } from "../identity/index.js";
import { RolesService } from "../roles/index.js";
import { ProjectsMembershipService } from "./service.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const testNow = new Date("2026-07-28T15:00:00.000Z");

describeWithDatabase("M1 application services PostgreSQL integration", () => {
  let database: Database;
  let foundation: FoundationRepository;
  let identityRepository: IdentityRepository;
  let identity: IdentityService;
  let projects: ProjectsMembershipService;
  let roles: RolesService;
  let adminMode: AdminModeService;

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    foundation = new FoundationRepository(database);
    identityRepository = new IdentityRepository(database);
    identity = new IdentityService(database);
    projects = new ProjectsMembershipService(database);
    roles = new RolesService(database);
    adminMode = new AdminModeService(database);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("maps profile and project resources with stable owner actions and replay", async () => {
    const owner = await createActor("service-owner-a");
    const templates = await roles.listSystemTemplates();
    const selectedTemplateIds = [templates.templates[1]!.id, templates.templates[0]!.id];
    const updatedProfile = await identity.updateProfile(
      {
        displayName: "Service Owner",
        defaultIntroduction: "Builds the project",
        defaultRoleTemplateIds: selectedTemplateIds,
        expectedVersion: 1,
      },
      owner.actor.userId,
      serviceContext("profile-owner-update"),
    );
    expect(updatedProfile).toMatchObject({
      displayName: "Service Owner",
      defaultRoleTemplateIds: [...selectedTemplateIds].sort(),
      version: 2,
      actions: ["update"],
    });
    await expect(
      identity.getProfile(owner.actor.userId, serviceContext("profile-owner-get")),
    ).resolves.toEqual(updatedProfile);

    const idempotencyKey = randomUUID();
    const firstContext = m1Context("project-create-first");
    const first = await projects.createProject(
      {
        key: "SVCA",
        name: "Service A",
        description: "Application boundary",
        idempotencyKey,
      },
      owner.actor,
      firstContext,
    );
    const replay = await projects.createProject(
      {
        key: "SVCA",
        name: "Service A",
        description: "Application boundary",
        idempotencyKey,
      },
      owner.actor,
      { ...m1Context("project-create-replay"), requestSha256: firstContext.requestSha256 },
    );
    expect(first).toMatchObject({
      idempotentReplay: false,
      project: {
        key: "SVCA",
        lifecycle: "active",
        actions: [
          "read",
          "archive",
          "review_join_request",
          "manage_admins",
          "remove_member",
          "transfer_ownership",
        ],
      },
    });
    expect(replay).toMatchObject({
      idempotentReplay: true,
      project: { id: first.project.id },
    });

    const detail = await projects.getProject(
      "SVCA",
      owner.actor,
      m1Context("project-detail-owner"),
    );
    expect(detail).toMatchObject({
      project: { id: first.project.id, key: "SVCA" },
      currentMembership: {
        userId: owner.actor.userId,
        displayName: "Service Owner",
        permissionLevel: "admin",
        status: "active",
        actions: ["read", "edit_self"],
      },
      adminMode: null,
    });
    expect(
      (await projects.listProjects(owner.actor, m1Context("project-list-owner"))).projects,
    ).toEqual([detail.project]);

    const successFacts = await database
      .selectFrom("audit_events")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("action", "=", "project.create")
      .where("result", "=", "success")
      .where("target_id", "=", first.project.id)
      .executeTakeFirstOrThrow();
    expect(Number(successFacts.count)).toBe(1);
  });

  it("enforces owner, member, Admin Mode and non-authoritative role-content matrices", async () => {
    const owner = await createActor("service-owner-b");
    const member = await createActor("service-member-b");
    const created = await projects.createProject(
      {
        key: "SVCB",
        name: "Service B",
        idempotencyKey: randomUUID(),
      },
      owner.actor,
      m1Context("matrix-project-create"),
    );
    const requested = await projects.createJoinRequest(
      { projectKey: "SVCB", idempotencyKey: randomUUID() },
      member.actor,
      m1Context("matrix-join-create"),
    );
    expect(requested).toMatchObject({
      membership: { status: "pending", actions: ["read"] },
      request: { status: "pending", actions: [] },
    });
    const ownerRequests = await projects.listJoinRequests(
      "SVCB",
      owner.actor,
      m1Context("matrix-join-list"),
    );
    expect(ownerRequests.requests[0]).toMatchObject({
      request: { id: requested.request.id, actions: ["approve", "reject"] },
    });
    const approved = await projects.resolveJoinRequest(
      "SVCB",
      requested.request.id,
      {
        decision: "approve",
        expectedProjectVersion: created.project.version,
        expectedMembershipVersion: requested.membership.version,
        expectedRequestVersion: requested.request.version,
        idempotencyKey: randomUUID(),
      },
      owner.actor,
      m1Context("matrix-join-approve"),
    );
    expect(approved).toMatchObject({
      membership: { status: "active", version: 2 },
      request: { status: "approved", version: 2 },
    });

    const projectRoles = await roles.listProjectRoles(
      "SVCB",
      member.actor,
      m1Context("matrix-role-list-member"),
    );
    const memberSelf = await projects.updateMembershipProfile(
      "SVCB",
      approved.membership.id,
      {
        introduction: "Member-managed introduction",
        roleIds: [projectRoles.roles[0]!.id],
        expectedVersion: approved.membership.version,
      },
      undefined,
      member.actor,
      m1Context("matrix-member-self"),
    );
    expect(memberSelf).toMatchObject({
      membership: {
        introduction: "Member-managed introduction",
        roleIds: [projectRoles.roles[0]!.id],
        actions: ["read", "edit_self"],
        version: 3,
      },
    });

    const missingModeContext = m1Context("matrix-edit-other-without-mode");
    await expect(
      projects.updateMembershipProfile(
        "SVCB",
        approved.membership.id,
        {
          introduction: "Owner update without mode",
          roleIds: [],
          expectedVersion: memberSelf.membership.version,
        },
        undefined,
        owner.actor,
        missingModeContext,
      ),
    ).rejects.toMatchObject<ApplicationError>({
      statusCode: 403,
      code: "ADMIN_MODE_REQUIRED",
    });

    const ownerDetail = await projects.getProject(
      "SVCB",
      owner.actor,
      m1Context("matrix-owner-detail"),
    );
    const opened = await adminMode.open(
      {
        projectId: created.project.id,
        expectedMembershipVersion: ownerDetail.currentMembership.version,
        idempotencyKey: randomUUID(),
      },
      owner.actor,
      m1Context("matrix-admin-open"),
    );
    expect(opened.adminMode).toMatchObject({
      status: "active",
      actions: ["close", "perform_protected_action"],
    });

    const editedByOwner = await projects.updateMembershipProfile(
      "SVCB",
      approved.membership.id,
      {
        introduction: "Owner-managed introduction",
        roleIds: [],
        expectedVersion: memberSelf.membership.version,
      },
      opened.adminMode.id,
      owner.actor,
      m1Context("matrix-edit-other-with-mode"),
    );
    expect(editedByOwner.membership).toMatchObject({
      introduction: "Owner-managed introduction",
      version: 4,
      actions: expect.arrayContaining(["edit_other"]),
    });

    const role = await roles.createProjectRole(
      "SVCB",
      {
        name: "Untrusted capability text",
        capability: "project.admin=true; grant_everything",
        idempotencyKey: randomUUID(),
      },
      opened.adminMode.id,
      owner.actor,
      m1Context("matrix-role-create"),
    );
    expect(role.role).toMatchObject({
      capability: "project.admin=true; grant_everything",
      actions: ["edit", "copy", "archive", "bind"],
    });
    const updatedRole = await roles.updateProjectRole(
      "SVCB",
      role.role.id,
      {
        name: "Still non-authoritative",
        capability: "owner=true",
        expectedVersion: role.role.version,
      },
      opened.adminMode.id,
      owner.actor,
      m1Context("matrix-role-update"),
    );
    const copiedRole = await roles.copyProjectRole(
      "SVCB",
      updatedRole.role.id,
      {
        name: "Copied role",
        expectedSourceVersion: updatedRole.role.version,
        idempotencyKey: randomUUID(),
      },
      opened.adminMode.id,
      owner.actor,
      m1Context("matrix-role-copy"),
    );
    await expect(
      roles.archiveProjectRole(
        "SVCB",
        copiedRole.role.id,
        { expectedVersion: copiedRole.role.version },
        opened.adminMode.id,
        owner.actor,
        m1Context("matrix-role-archive"),
      ),
    ).resolves.toMatchObject({ role: { status: "archived", actions: ["copy"] } });

    await expect(
      roles.createProjectRole(
        "SVCB",
        {
          name: "Forged role",
          capability: role.role.capability,
          idempotencyKey: randomUUID(),
        },
        opened.adminMode.id,
        member.actor,
        m1Context("matrix-forged-role"),
      ),
    ).rejects.toMatchObject<ApplicationError>({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    const permissionChanged = await projects.changeMembershipPermission(
      "SVCB",
      editedByOwner.membership.id,
      {
        permissionLevel: "admin",
        expectedProjectVersion: created.project.version,
        expectedMembershipVersion: editedByOwner.membership.version,
        idempotencyKey: randomUUID(),
      },
      owner.actor,
      m1Context("matrix-member-admin"),
    );
    expect(permissionChanged.membership).toMatchObject({
      permissionLevel: "admin",
      version: 5,
    });
    const transfer = await projects.createOwnershipTransfer(
      "SVCB",
      {
        targetMembershipId: permissionChanged.membership.id,
        expectedProjectVersion: created.project.version,
        expectedTargetMembershipVersion: permissionChanged.membership.version,
        idempotencyKey: randomUUID(),
      },
      owner.actor,
      m1Context("matrix-transfer-create"),
    );
    expect(transfer.transfer.actions).toEqual(["cancel"]);
    const accepted = await projects.resolveOwnershipTransfer(
      "SVCB",
      transfer.transfer.id,
      {
        action: "accept",
        expectedProjectVersion: created.project.version,
        expectedTransferVersion: transfer.transfer.version,
        idempotencyKey: randomUUID(),
      },
      member.actor,
      m1Context("matrix-transfer-accept"),
    );
    expect(accepted.transfer).toMatchObject({ status: "accepted", actions: [] });

    const transferredProject = await projects.getProject(
      "SVCB",
      member.actor,
      m1Context("matrix-new-owner-detail"),
    );
    expect(transferredProject.project.ownerMembershipId).toBe(permissionChanged.membership.id);
    expect(transferredProject.project.actions).toEqual(
      expect.arrayContaining(["archive", "review_join_request", "transfer_ownership"]),
    );
    await expect(
      projects.changeProjectLifecycle(
        "SVCB",
        {
          expectedVersion: transferredProject.project.version,
          lifecycle: "archived",
          idempotencyKey: randomUUID(),
        },
        member.actor,
        m1Context("matrix-project-archive"),
      ),
    ).resolves.toMatchObject({ project: { lifecycle: "archived" } });

    const missingModeAudits = await database
      .selectFrom("audit_events")
      .select(["result", "reason_code"])
      .where("request_id", "=", missingModeContext.requestId)
      .execute();
    expect(missingModeAudits).toEqual([{ result: "failure", reason_code: "ADMIN_MODE_REQUIRED" }]);
  });

  it("rejects cross-project IDs once and records unexpected failures after rollback", async () => {
    const firstOwner = await createActor("service-owner-c1");
    const secondOwner = await createActor("service-owner-c2");
    const first = await projects.createProject(
      { key: "SVCC", name: "Service C", idempotencyKey: randomUUID() },
      firstOwner.actor,
      m1Context("isolation-first-project"),
    );
    const second = await projects.createProject(
      { key: "SVCD", name: "Service D", idempotencyKey: randomUUID() },
      secondOwner.actor,
      m1Context("isolation-second-project"),
    );
    const secondDetail = await projects.getProject(
      "SVCD",
      secondOwner.actor,
      m1Context("isolation-second-detail"),
    );
    const crossProjectContext = m1Context("isolation-cross-project-member");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        projects.changeMembershipPermission(
          "SVCC",
          secondDetail.currentMembership.id,
          {
            permissionLevel: "admin",
            expectedProjectVersion: first.project.version,
            expectedMembershipVersion: secondDetail.currentMembership.version,
            idempotencyKey: randomUUID(),
          },
          firstOwner.actor,
          crossProjectContext,
        ),
      ).rejects.toMatchObject<ApplicationError>({
        statusCode: 404,
        code: "MEMBERSHIP_NOT_FOUND",
      });
    }
    const crossProjectAudits = await database
      .selectFrom("audit_events")
      .select(["result", "reason_code", "project_id", "target_id"])
      .where("request_id", "=", crossProjectContext.requestId)
      .execute();
    expect(crossProjectAudits).toEqual([
      {
        result: "failure",
        reason_code: "MEMBERSHIP_NOT_FOUND",
        project_id: first.project.id,
        target_id: secondDetail.currentMembership.id,
      },
    ]);

    const firstDetail = await projects.getProject(
      "SVCC",
      firstOwner.actor,
      m1Context("unexpected-first-project-detail"),
    );
    const firstAdminMode = await adminMode.open(
      {
        projectId: first.project.id,
        expectedMembershipVersion: firstDetail.currentMembership.version,
        idempotencyKey: randomUUID(),
      },
      firstOwner.actor,
      m1Context("unexpected-admin-open"),
    );
    const failureContext = m1Context("unexpected-role-failure");
    const invalidRoleName = "x".repeat(161);
    await expect(
      roles.createProjectRole(
        "SVCC",
        {
          name: invalidRoleName,
          capability: "plain text",
          idempotencyKey: randomUUID(),
        },
        firstAdminMode.adminMode.id,
        firstOwner.actor,
        failureContext,
      ),
    ).rejects.toMatchObject({ code: "22001" });
    const [roleCount, outboxCount, failureAudits] = await Promise.all([
      database
        .selectFrom("project_logical_roles")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_id", "=", first.project.id)
        .where("name", "=", invalidRoleName)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom("outbox_events")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("request_id", "=", failureContext.requestId)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom("audit_events")
        .select(["result", "reason_code", "target_id"])
        .where("request_id", "=", failureContext.requestId)
        .execute(),
    ]);
    expect(Number(roleCount.count)).toBe(0);
    expect(Number(outboxCount.count)).toBe(0);
    expect(failureAudits).toEqual([
      { result: "failure", reason_code: "INTERNAL_ERROR", target_id: first.project.id },
    ]);
    expect(second.project.id).not.toBe(first.project.id);
  });

  async function createActor(loginName: string) {
    const created = await foundation.createUserWithWorkspace({
      loginName,
      normalizedLoginName: loginName,
      passwordHash: "argon2id$fixture",
    });
    const session = await identityRepository.createSession({
      tokenHash: `session-${randomUUID()}`,
      userId: created.user.id,
      expiresAt: new Date("2026-07-30T00:00:00.000Z"),
    });
    return {
      actor: {
        userId: created.user.id,
        webSessionId: session.id,
        actorType: "human",
      } satisfies AuthenticatedM1Actor,
    };
  }
});

function serviceContext(requestId: string) {
  return { requestId, now: testNow };
}

function m1Context(requestId: string): M1ApplicationContext {
  return {
    requestId,
    requestSha256: createHash("sha256").update(requestId).digest("hex"),
    now: testNow,
  };
}
