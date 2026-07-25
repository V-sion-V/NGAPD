import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  createDatabase,
  FoundationRepository,
  migrateToLatest,
  type Database,
} from "@ngapd/database";
import { LocalObjectStore } from "@ngapd/object-store";
import { MacOsKeychainCredentialAdapter } from "@ngapd/workspace-cli";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeOnMacWithDatabase =
  connectionString && process.platform === "darwin" ? describe : describe.skip;
const cliPath = fileURLToPath(new URL("../../workspace-cli/dist/bin.js", import.meta.url));
const publicOrigin = "https://ngapd.local";
const objectRoot = "/private/tmp/ngapd-workspace-sync-p003-server-objects";
const rootA = "/private/tmp/ngapd-workspace-sync-p003-local-a";
const rootB = "/private/tmp/ngapd-workspace-sync-p003-local-b";
const keychainA = "/private/tmp/ngapd-workspace-sync-p003-device-a.keychain-db";
const keychainB = "/private/tmp/ngapd-workspace-sync-p003-device-b.keychain-db";

describeOnMacWithDatabase("Workspace CLI real macOS integration", () => {
  let database: Database;
  let app: FastifyInstance;
  let apiOrigin: string;
  let currentTime = new Date();

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    await rm(objectRoot, { recursive: true, force: true });
    await mkdir(objectRoot, { mode: 0o700 });
    app = await buildApp({
      database,
      databaseCheck: async () => true,
      now: () => currentTime,
      objectStore: new LocalObjectStore(objectRoot),
      publicOrigin,
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("TEST_API_ADDRESS_UNAVAILABLE");
    }
    apiOrigin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
    await cleanExternalState();
    await rm(objectRoot, { recursive: true, force: true });
  });

  it("repeats SYNC-001 through SYNC-009 with two CLI processes and real Keychain/APFS", async () => {
    const first = await runRound(1);
    const second = await runRound(2);

    expect(first.scenarios).toEqual(scenarioIds);
    expect(second.scenarios).toEqual(scenarioIds);
    expect(first.finalVersion).toBe(3);
    expect(second.finalVersion).toBe(3);
    expect(first.conflictCopies).toBeGreaterThanOrEqual(1);
    expect(second.conflictCopies).toBeGreaterThanOrEqual(1);
  }, 60_000);

  async function runRound(round: number) {
    await cleanExternalState();
    await mkdir(join(rootA, "workspace"), { recursive: true, mode: 0o700 });
    await mkdir(join(rootB, "workspace"), { recursive: true, mode: 0o700 });
    const passwordA = `test-${randomUUID()}`;
    const passwordB = `test-${randomUUID()}`;
    const namespaceA = `com.ngapd.workspace.p003.a${round}`;
    const namespaceB = `com.ngapd.workspace.p003.b${round}`;
    let adapterA: MacOsKeychainCredentialAdapter | null = null;
    let adapterB: MacOsKeychainCredentialAdapter | null = null;
    currentTime = new Date();

    try {
      adapterA = await MacOsKeychainCredentialAdapter.createIsolated(
        keychainA,
        passwordA,
        namespaceA,
      );
      adapterB = await MacOsKeychainCredentialAdapter.createIsolated(
        keychainB,
        passwordB,
        namespaceB,
      );
      const loginName = `cli-e2e-${round}-${randomUUID().slice(0, 8)}`;
      const registration = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        headers: { origin: publicOrigin },
        payload: { loginName, password: "synthetic correct password" },
      });
      expect(registration.statusCode).toBe(201);
      const cookie = sessionCookie(registration.headers["set-cookie"]);
      const workspace = await database
        .selectFrom("users")
        .innerJoin("workspaces", (joinBuilder) =>
          joinBuilder
            .onRef("workspaces.scope_id", "=", "users.id")
            .on("workspaces.scope_type", "=", "user"),
        )
        .select(["users.id as user_id", "workspaces.id"])
        .where("users.normalized_login_name", "=", loginName)
        .executeTakeFirstOrThrow();

      const environmentA = cliEnvironment(rootA, keychainA, passwordA, namespaceA);
      const environmentB = cliEnvironment(rootB, keychainB, passwordB, namespaceB);
      await pairCli(environmentA, `Round ${round} Device A`, cookie);
      await pairCli(environmentB, `Round ${round} Device B`, cookie);

      expect(
        await runCli(
          ["connect", workspace.id, "--path", "workspace", "--alias", "main", "--json"],
          environmentA,
        ),
      ).toMatchObject({ status: "success", data: { syncVersion: 0 } });
      expect(await runCli(["lease", "acquire", "main", "--json"], environmentA)).toMatchObject({
        status: "success",
      });

      await writeFile(join(rootA, "workspace", "story.md"), `round ${round} first\n`, "utf8");
      await writeFile(join(rootA, "workspace", "image.bin"), Buffer.from([0, round, 255]));
      const smallSyncStartedAt = performance.now();
      const smallSync = await runCli(["sync", "main", "--json"], environmentA);
      const smallSyncElapsedMs = performance.now() - smallSyncStartedAt;
      expect(smallSync).toMatchObject({
        status: "success",
        data: { changed: true, syncVersion: 1 },
      });
      expect(smallSyncElapsedMs).toBeLessThan(10_000);
      process.stdout.write(
        `${JSON.stringify({
          metric: "workspace_small_sync",
          round,
          elapsedMs: Math.round(smallSyncElapsedMs * 100) / 100,
          fileCount: 2,
          targetMs: 10_000,
        })}\n`,
      );
      expect(await runCli(["sync", "main", "--json"], environmentA)).toMatchObject({
        data: { changed: false, syncVersion: 1 },
      });

      expect(
        await runCli(
          ["connect", workspace.id, "--path", "workspace", "--alias", "main", "--json"],
          environmentB,
        ),
      ).toMatchObject({ data: { syncVersion: 1 } });
      expect(await runCli(["lease", "acquire", "main", "--json"], environmentB, 1)).toMatchObject({
        status: "error",
        data: { code: "LEASE_CONFLICT" },
      });
      expect(
        await runCli(["lease", "takeover", "main", "--confirm", "--json"], environmentB),
      ).toMatchObject({ status: "success", data: { baseSyncVersion: 1 } });

      await writeFile(join(rootA, "workspace", "story.md"), "late old-holder edit\n", "utf8");
      expect(await runCli(["sync", "main", "--json"], environmentA, 1)).toMatchObject({
        status: "error",
        data: { code: "LEASE_INVALID" },
      });
      expect(await serverVersion(workspace.id)).toBe(1);

      currentTime = new Date(currentTime.getTime() + 2 * 60 * 1_000);
      expect(await runCli(["lease", "renew", "main", "--json"], environmentB, 1)).toMatchObject({
        status: "error",
        data: { code: "LEASE_EXPIRED" },
      });
      expect(
        await runCli(["lease", "takeover", "main", "--confirm", "--json"], environmentB),
      ).toMatchObject({ status: "success" });

      await writeFile(join(rootB, "workspace", "story.md"), "server-side edit\n", "utf8");
      await rm(join(rootB, "workspace", "image.bin"));
      await writeFile(join(rootB, "workspace", "renamed.bin"), Buffer.from([0, round, 255]));
      expect(await runCli(["sync", "main", "--json"], environmentB)).toMatchObject({
        data: { syncVersion: 2 },
      });

      expect(
        await runCli(["workspace", "status", "main", "--json"], environmentA, 1),
      ).toMatchObject({
        status: "conflict",
        data: { baseSyncVersion: 1, remoteSyncVersion: 2 },
      });
      expect(
        await runCli(["lease", "takeover", "main", "--confirm", "--json"], environmentA),
      ).toMatchObject({ data: { baseSyncVersion: 2 } });
      expect(
        await runCli(["conflict", "use-local", "main", "--confirm", "--json"], environmentA),
      ).toMatchObject({ status: "success", data: { syncVersion: 3 } });
      expect(await serverVersion(workspace.id)).toBe(3);

      await writeFile(join(rootB, "workspace", "story.md"), "discarded local edit\n", "utf8");
      expect(
        await runCli(["lease", "takeover", "main", "--confirm", "--json"], environmentB),
      ).toMatchObject({ data: { baseSyncVersion: 3 } });
      expect(
        await runCli(["conflict", "use-server", "main", "--confirm", "--json"], environmentB),
      ).toMatchObject({ status: "recovered", data: { syncVersion: 3 } });
      expect(await readFile(join(rootB, "workspace", "story.md"), "utf8")).toBe(
        "late old-holder edit\n",
      );

      await writeFile(join(rootB, "workspace", "CON"), "portable-name rejection\n", "utf8");
      expect(await runCli(["sync", "main", "--json"], environmentB, 1)).toMatchObject({
        status: "error",
        data: { code: "PATH_NOT_PORTABLE" },
      });
      expect(await serverVersion(workspace.id)).toBe(3);
      await rm(join(rootB, "workspace", "CON"));

      const foundation = new FoundationRepository(database);
      const project = await foundation.createProjectWithWorkspace({
        key: `CLI${round}`,
        name: `CLI round ${round}`,
        ownerUserId: workspace.user_id,
      });
      const nextOwnerLogin = `cli-next-owner-${round}-${randomUUID().slice(0, 8)}`;
      const nextOwner = await foundation.createUserWithWorkspace({
        loginName: nextOwnerLogin,
        normalizedLoginName: nextOwnerLogin,
        passwordHash: "argon2id$synthetic",
      });
      const nextOwnerMembership = await foundation.createMembership({
        projectId: project.project.id,
        userId: nextOwner.user.id,
        role: "member",
      });
      const task = await foundation.createTaskWithWorkspace({
        projectId: project.project.id,
        key: `OWNER-${round}`,
        title: `Owner invalidation ${round}`,
        parentTaskId: null,
        explicitOwnerMembershipId: project.ownerMembership.id,
      });
      await mkdir(join(rootA, "task"), { mode: 0o700 });
      expect(
        await runCli(
          ["connect", task.workspace.id, "--path", "task", "--alias", "task", "--json"],
          environmentA,
        ),
      ).toMatchObject({ status: "success" });
      await runCli(["lease", "acquire", "task", "--json"], environmentA);
      await database
        .updateTable("workspaces")
        .set({ work_cycle: 2 })
        .where("id", "=", task.workspace.id)
        .execute();
      expect(await runCli(["lease", "renew", "task", "--json"], environmentA, 1)).toMatchObject({
        status: "error",
        data: { code: "WORK_CYCLE_CHANGED" },
      });
      await runCli(["lease", "takeover", "task", "--confirm", "--json"], environmentA);
      await database
        .updateTable("tasks")
        .set({ explicit_owner_membership_id: nextOwnerMembership.id })
        .where("id", "=", task.task.id)
        .execute();
      expect(await runCli(["lease", "renew", "task", "--json"], environmentA, 1)).toMatchObject({
        status: "error",
        data: { code: "FORBIDDEN" },
      });
      expect(await serverVersion(task.workspace.id)).toBe(0);

      expect(await runCli(["auth", "logout", "--json"], environmentB)).toMatchObject({
        status: "success",
        data: { paired: false, revoked: true },
      });
      expect(await runCli(["auth", "status", "--json"], environmentB, 1)).toMatchObject({
        status: "read_only",
        data: { paired: false },
      });
      await runCli(["auth", "logout", "--json"], environmentA);

      const stateText = await readFile(join(rootB, "workspace", ".ngapd", "state.json"), "utf8");
      expect(stateText).not.toMatch(/password|credential|access.?token|lease.?token|secret/iu);
      const conflictCopies = (await readdir(join(rootB, "workspace"))).filter((name) =>
        name.includes(".ngapd-conflict-"),
      ).length;
      const audit = await database
        .selectFrom("audit_events")
        .select(["action", "metadata"])
        .where("workspace_id", "=", workspace.id)
        .execute();
      expect(audit.map((event) => event.action)).toEqual(
        expect.arrayContaining([
          "workspace.lease.acquire",
          "workspace.lease.takeover",
          "workspace.commit",
          "workspace.conflict.use_local",
          "workspace.conflict.use_server",
        ]),
      );
      expect(JSON.stringify(audit)).not.toMatch(
        /synthetic correct password|device-|access-|lease-/u,
      );

      return {
        scenarios: scenarioIds,
        finalVersion: await serverVersion(workspace.id),
        conflictCopies,
      };
    } finally {
      await adapterA?.deleteIsolatedKeychain();
      adapterA = null;
      await adapterB?.deleteIsolatedKeychain();
      adapterB = null;
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  }

  function cliEnvironment(
    root: string,
    keychainPath: string,
    keychainPassword: string,
    namespace: string,
  ): NodeJS.ProcessEnv {
    return {
      ...process.env,
      NGAPD_WORKSPACE_API_ORIGIN: apiOrigin,
      NGAPD_WORKSPACE_ROOT: root,
      NGAPD_WORKSPACE_KEYCHAIN_PATH: keychainPath,
      NGAPD_WORKSPACE_KEYCHAIN_PASSWORD: keychainPassword,
      NGAPD_WORKSPACE_KEYCHAIN_NAMESPACE: namespace,
      NGAPD_WORKSPACE_PAIR_POLL_MS: "250",
      NGAPD_WORKSPACE_PAIR_TIMEOUT_MS: "5000",
    };
  }

  async function pairCli(
    environment: NodeJS.ProcessEnv,
    deviceName: string,
    cookie: string,
  ): Promise<void> {
    const child = spawn(
      process.execPath,
      [cliPath, "pair", "--device-name", deviceName, "--json"],
      {
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const pending = await firstJsonLine(child.stdout);
    expect(pending).toMatchObject({ status: "pending" });
    const code = String((pending.data as { code: string }).code);
    const decision = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${code}/decision`,
      headers: { cookie, origin: publicOrigin },
      payload: { decision: "approve" },
    });
    expect(decision.statusCode).toBe(200);
    const completed = await collectChild(child, 0);
    expect(completed.last).toMatchObject({ status: "success" });
    expect(completed.all).not.toMatch(
      /"(?:deviceCredential|accessToken|leaseToken|correlationSecret)":/u,
    );
  }

  async function serverVersion(workspaceId: string): Promise<number> {
    const row = await database
      .selectFrom("workspaces")
      .select("sync_version")
      .where("id", "=", workspaceId)
      .executeTakeFirstOrThrow();
    return Number(row.sync_version);
  }
});

const scenarioIds = [
  "SYNC-001",
  "SYNC-002",
  "SYNC-003",
  "SYNC-004",
  "SYNC-005",
  "SYNC-006",
  "SYNC-007",
  "SYNC-008",
  "SYNC-009",
] as const;

async function runCli(args: readonly string[], environment: NodeJS.ProcessEnv, expectedExit = 0) {
  const child = spawn(process.execPath, [cliPath, ...args], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return (await collectChild(child, expectedExit)).last;
}

async function collectChild(
  child: ReturnType<typeof spawn>,
  expectedExit: number,
): Promise<{ last: Record<string, unknown>; all: string }> {
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  const exitCode = await exited(child);
  const all = `${await stdout}${await stderr}`;
  expect(exitCode, all).toBe(expectedExit);
  const lines = all
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
  if (lines.length === 0) {
    throw new Error(`CLI_JSON_RESULT_MISSING: ${all}`);
  }
  return { last: JSON.parse(lines.at(-1)!) as Record<string, unknown>, all };
}

function firstJsonLine(stream: NodeJS.ReadableStream | null): Promise<Record<string, unknown>> {
  if (stream === null) {
    return Promise.reject(new Error("CLI_STDOUT_MISSING"));
  }
  return new Promise((resolve, reject) => {
    let buffer = "";
    stream.setEncoding("utf8");
    const onData = (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }
      stream.off("data", onData);
      try {
        resolve(JSON.parse(buffer.slice(0, newline)) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    };
    stream.on("data", onData);
    stream.once("error", reject);
  });
}

function collect(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (stream === null) {
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    let output = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      output += chunk;
    });
    stream.on("end", () => resolve(output));
    stream.on("error", reject);
  });
}

function exited(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

function sessionCookie(setCookie: string | string[] | undefined): string {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (value === undefined) {
    throw new Error("SESSION_COOKIE_MISSING");
  }
  return value.split(";")[0]!;
}

async function cleanExternalState(): Promise<void> {
  for (const root of [rootA, rootB, keychainA, keychainB]) {
    await rm(root, { recursive: true, force: true });
  }
}
