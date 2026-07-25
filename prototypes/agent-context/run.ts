import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

import {
  AgentContextError,
  AGENT_CONTEXT_FIXTURE_VERSION,
  analyzeAgentTaskContext,
  buildAgentContextManifest,
  collectAgentContextManifestPages,
  createAgentContextFixture,
  getAgentContextManifestPage,
  getAgentToolAuthorization,
  normalizeAgentContextEvidence,
  readAgentContextSource,
  readAllSelectedAgentContextSources,
  type AgentContextInput,
  type AgentContextManifestEntry,
} from "../../packages/test-fixtures/src/agent-context.js";

export interface AgentContextPerformanceEvidence {
  profile: "deep-tree" | "wide-siblings" | "dense-dag";
  taskCount: number;
  dependencyCount: number;
  sourceCount: number;
  repetitions: number;
  p95Milliseconds: number;
  maximumMilliseconds: number;
  thresholdMilliseconds: 1000;
  pass: boolean;
}

export interface AgentContextScenarioEvidence {
  scenario: string;
  pass: true;
  observation: string;
}

export interface AgentContextRunEvidence {
  conclusion: "pass";
  schemaVersion: 1;
  fixtureVersion: string;
  environment: {
    platform: NodeJS.Platform;
    architecture: string;
    node: string;
  };
  budget: {
    tokens: number;
    minimumRequiredTokens: number;
    selectedTokens: number;
    remainingTokens: number;
  };
  ordering: string[];
  pagination: {
    pageSize: number;
    entryCount: number;
    combinedEqualsUnpaginated: true;
  };
  selection: {
    included: string[];
    excluded: Array<{ sourceId: string; reason: string }>;
  };
  summaries: string[];
  authorization: ReturnType<typeof getAgentToolAuthorization>;
  scenarios: AgentContextScenarioEvidence[];
  performance: AgentContextPerformanceEvidence[];
}

const DEFAULT_BUDGET = 6000;
const DEFAULT_PAGE_SIZE = 4;

function expectAgentError(action: () => unknown, code: AgentContextError["code"]): void {
  let observed: unknown;
  try {
    action();
  } catch (error) {
    observed = error;
  }
  assert(observed instanceof AgentContextError);
  assert.equal(observed.code, code);
}

function sourceIds(entries: readonly AgentContextManifestEntry[]): string[] {
  return entries.map((entry) => entry.sourceId);
}

function attachInjectionFixture(input: AgentContextInput): AgentContextInput {
  const injectionPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures/workspace-injection.md",
  );
  const injection = input.sources.find((source) => source.sourceId === "workspace-injection");
  assert(injection);
  injection.content = readFileSync(injectionPath, "utf8");
  return input;
}

function runCoreScenarios(): {
  input: AgentContextInput;
  scenarios: AgentContextScenarioEvidence[];
} {
  const input = attachInjectionFixture(createAgentContextFixture("deep-tree"));
  const manifest = buildAgentContextManifest(input, { budgetTokens: DEFAULT_BUDGET });
  const scenarios: AgentContextScenarioEvidence[] = [];
  const record = (scenario: string, observation: string): void => {
    scenarios.push({ scenario, pass: true, observation });
  };

  const repeated = buildAgentContextManifest(input, { budgetTokens: DEFAULT_BUDGET });
  assert.deepEqual(
    normalizeAgentContextEvidence(repeated),
    normalizeAgentContextEvidence(manifest),
  );
  record("deterministic-repeat", "相同输入的规范化 manifest 逐字段一致");

  expectAgentError(
    () => buildAgentContextManifest(input, { budgetTokens: 3049 }),
    "INSUFFICIENT_CONTEXT_BUDGET",
  );
  record("insufficient-budget", "低于 3050 token 的预算稳定拒绝且不产生部分 manifest");

  const pages = collectAgentContextManifestPages(input, {
    budgetTokens: DEFAULT_BUDGET,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  assert.deepEqual(pages, manifest.entries);
  assert.equal(new Set(sourceIds(pages)).size, pages.length);
  record("pagination", "全部页面组合与未分页清单逐项一致，无重复或遗漏");

  const firstPage = getAgentContextManifestPage(input, {
    budgetTokens: DEFAULT_BUDGET,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  assert(firstPage.nextCursor);
  expectAgentError(
    () =>
      getAgentContextManifestPage(input, {
        budgetTokens: DEFAULT_BUDGET - 1,
        pageSize: DEFAULT_PAGE_SIZE,
        cursor: firstPage.nextCursor ?? undefined,
      }),
    "INVALID_CURSOR",
  );
  record("cursor-drift", "预算变化后旧游标稳定失效");

  const byId = new Map(manifest.entries.map((entry) => [entry.sourceId, entry]));
  assert.equal(byId.get("ancestor-near")?.selection, "included");
  assert.equal(byId.get("predecessor-summary-user")?.selection, "included");
  assert.equal(byId.get("direct-follow")?.selection, "included");
  assert.equal(byId.get("direct-follow-duplicate")?.reason, "duplicate_relation");
  assert.equal(byId.get("recursive-follow")?.reason, "recursive_follow");
  record(
    "task-relations",
    "活动祖先、已完成 predecessor 与一跳关注进入清单；重复边和递归关注被排除",
  );

  assert.equal(byId.get("project-skill-quality")?.selection, "included");
  assert.equal(byId.get("user-skill-quality")?.reason, "shadowed_by_project_skill");
  assert.equal(byId.get("disabled-user-skill")?.reason, "disabled");
  record("skill-discovery", "项目同名 Skill 优先，未启用 Skill 排除且不授予能力");

  const summaries = manifest.entries
    .filter((entry) => entry.summarySource !== undefined && entry.selection === "included")
    .map((entry) => entry.summarySource);
  assert.deepEqual([...new Set(summaries)].sort(), [
    "agent_provided",
    "system_fallback",
    "user_provided",
  ]);
  assert.equal(byId.get("unconfirmed-summary")?.reason, "unconfirmed");
  record("summary-provenance", "三类确认摘要保留来源，未确认摘要被排除");

  assert.equal(byId.has("other-user-private-workspace"), false);
  const otherUser = input.sources.find(
    (source) => source.sourceId === "other-user-private-workspace",
  );
  assert(otherUser?.ownerUserId);
  const crossUserIntent = {
    targetSourceId: otherUser.sourceId,
    targetUserId: otherUser.ownerUserId,
    purpose: "explicit synthetic comparison",
    targetVersion: otherUser.version,
  };
  const crossUserManifest = buildAgentContextManifest(input, {
    budgetTokens: 10000,
    crossUserIntent,
  });
  const crossUserEntry = crossUserManifest.entries.find(
    (entry) => entry.sourceId === otherUser.sourceId,
  );
  assert.equal(crossUserEntry?.selection, "included");
  const crossUserRead = readAgentContextSource(input, {
    manifestVersion: crossUserManifest.manifestVersion,
    sourceId: otherUser.sourceId,
    sourceVersion: otherUser.version,
    budgetTokens: crossUserManifest.budget.budgetTokens,
    crossUserIntent,
  });
  assert.deepEqual(crossUserRead.authorization, {
    read: true,
    write: false,
    adminMode: false,
    lease: false,
    requiresConfirmation: true,
  });
  expectAgentError(
    () =>
      buildAgentContextManifest(input, {
        budgetTokens: 10000,
        crossUserIntent: { ...crossUserIntent, purpose: "" },
      }),
    "READ_DENIED",
  );
  record("cross-user-boundary", "其他用户来源默认不可发现；精确目标、目的、版本和底层允许时仅只读");

  const reads = readAllSelectedAgentContextSources(input, manifest);
  const analysis = analyzeAgentTaskContext(manifest, reads);
  assert.equal(analysis.status, "complete");
  assert(analysis.goal);
  assert(analysis.ancestors.length > 0);
  assert(analysis.predecessors.length > 0);
  assert.equal(analysis.directFollows.length, 1);
  assert.equal(analysis.permissionLimits.adminMode, false);
  record("reference-analysis", "结构化分析只使用实际读取结果并覆盖目标、角色、关系和权限");

  const currentTask = byId.get("current-task");
  assert(currentTask);
  expectAgentError(
    () =>
      readAgentContextSource(input, {
        manifestVersion: manifest.manifestVersion,
        sourceId: currentTask.sourceId,
        sourceVersion: currentTask.version,
        budgetTokens: manifest.budget.budgetTokens,
        authorization: { underlyingReadAllowed: false },
      }),
    "READ_DENIED",
  );
  const changed = structuredClone(input);
  const changedSource = changed.sources.find((source) => source.sourceId === "current-task");
  assert(changedSource);
  changedSource.version = "v2";
  expectAgentError(
    () =>
      readAgentContextSource(changed, {
        manifestVersion: manifest.manifestVersion,
        sourceId: currentTask.sourceId,
        sourceVersion: currentTask.version,
        budgetTokens: manifest.budget.budgetTokens,
      }),
    "SOURCE_VERSION_INVALID",
  );
  record("progressive-read", "未选择、重新授权拒绝和来源版本失效均不会返回正文");

  const withoutInjection = structuredClone(input);
  withoutInjection.sources = withoutInjection.sources.filter(
    (source) => source.sourceId !== "workspace-injection",
  );
  assert.deepEqual(getAgentToolAuthorization(withoutInjection), getAgentToolAuthorization(input));
  const injectionEntry = byId.get("workspace-injection");
  assert(injectionEntry);
  const injectionRead = readAgentContextSource(input, {
    manifestVersion: manifest.manifestVersion,
    sourceId: injectionEntry.sourceId,
    sourceVersion: injectionEntry.version,
    budgetTokens: manifest.budget.budgetTokens,
  });
  assert.equal(injectionRead.trust, "untrusted");
  assert.match(injectionRead.content ?? "", /管理员模式/);
  assert.equal(injectionRead.authorization.write, false);
  assert.equal(injectionRead.authorization.adminMode, false);
  record("prompt-injection", "注入材料保持非可信，加入前后工具授权逐字段相同");

  const invalid = structuredClone(input);
  const duplicate = invalid.sources[0];
  assert(duplicate);
  invalid.sources.push(structuredClone(duplicate));
  expectAgentError(
    () => buildAgentContextManifest(invalid, { budgetTokens: DEFAULT_BUDGET }),
    "INVALID_INPUT",
  );
  record("invalid-input", "重复来源在部分 manifest 产生前稳定拒绝");

  return { input, scenarios };
}

function percentile95(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
  return ordered[index] ?? Number.POSITIVE_INFINITY;
}

function measurePerformance(repetitions: number): AgentContextPerformanceEvidence[] {
  return (["deep-tree", "wide-siblings", "dense-dag"] as const).map((profile) => {
    const input = createAgentContextFixture(profile);
    buildAgentContextManifest(input, { budgetTokens: DEFAULT_BUDGET });
    const samples: number[] = [];
    for (let iteration = 0; iteration < repetitions; iteration += 1) {
      const startedAt = performance.now();
      buildAgentContextManifest(input, { budgetTokens: DEFAULT_BUDGET });
      samples.push(performance.now() - startedAt);
    }
    const p95Milliseconds = percentile95(samples);
    const maximumMilliseconds = Math.max(...samples);
    return {
      profile,
      taskCount: input.taskFixture.tasks.length,
      dependencyCount: input.taskFixture.dependencies.length,
      sourceCount: input.sources.length,
      repetitions,
      p95Milliseconds: Number(p95Milliseconds.toFixed(3)),
      maximumMilliseconds: Number(maximumMilliseconds.toFixed(3)),
      thresholdMilliseconds: 1000,
      pass: p95Milliseconds < 1000,
    };
  });
}

export function runAgentContextScenarios(repetitions = 80): AgentContextRunEvidence {
  assert(Number.isInteger(repetitions) && repetitions > 0);
  const { input, scenarios } = runCoreScenarios();
  const manifest = buildAgentContextManifest(input, { budgetTokens: DEFAULT_BUDGET });
  const pages = collectAgentContextManifestPages(input, {
    budgetTokens: DEFAULT_BUDGET,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const performanceEvidence = measurePerformance(repetitions);
  assert(performanceEvidence.every((evidence) => evidence.pass));
  const included = manifest.entries
    .filter((entry) => entry.selection === "included")
    .map((entry) => entry.sourceId);
  const excluded = manifest.entries
    .filter((entry) => entry.selection === "excluded")
    .map((entry) => ({ sourceId: entry.sourceId, reason: entry.reason }));

  return {
    conclusion: "pass",
    schemaVersion: 1,
    fixtureVersion: AGENT_CONTEXT_FIXTURE_VERSION,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
    },
    budget: {
      tokens: manifest.budget.budgetTokens,
      minimumRequiredTokens: manifest.budget.minimumRequiredTokens,
      selectedTokens: manifest.budget.selectedTokens,
      remainingTokens: manifest.budget.remainingTokens,
    },
    ordering: sourceIds(manifest.entries),
    pagination: {
      pageSize: DEFAULT_PAGE_SIZE,
      entryCount: pages.length,
      combinedEqualsUnpaginated: true,
    },
    selection: { included, excluded },
    summaries: manifest.entries
      .filter((entry) => entry.summarySource !== undefined)
      .map((entry) => `${entry.sourceId}:${entry.summarySource}:${entry.reason}`),
    authorization: getAgentToolAuthorization(input),
    scenarios,
    performance: performanceEvidence,
  };
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  try {
    process.stdout.write(
      `${JSON.stringify(normalizeAgentContextEvidence(runAgentContextScenarios()), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}
