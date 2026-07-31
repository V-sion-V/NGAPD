import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const envPath = resolve(repositoryRoot, ".env");
const inheritedDatabaseUrl = process.env.DATABASE_URL;
const inheritedTestDatabaseUrl = process.env.DATABASE_TEST_URL;

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const options = parseArguments(process.argv.slice(2));
const selected = {};

if (options.scope === "app" || options.scope === "both") {
  selected.application = await selectDatabase("application", [
    candidate("DATABASE_URL", inheritedDatabaseUrl),
    candidate("DATABASE_LOCAL_URL", process.env.DATABASE_LOCAL_URL),
    candidate("DATABASE_URL (.env)", inheritedDatabaseUrl ? undefined : process.env.DATABASE_URL),
    candidate("DATABASE_FALLBACK_URL", process.env.DATABASE_FALLBACK_URL),
  ]);
  process.env.DATABASE_URL = selected.application.url;
}

if (options.scope === "test" || options.scope === "both") {
  selected.test = await selectDatabase("test", [
    candidate("DATABASE_TEST_URL", inheritedTestDatabaseUrl),
    candidate("DATABASE_TEST_LOCAL_URL", process.env.DATABASE_TEST_LOCAL_URL),
    candidate(
      "DATABASE_TEST_URL (.env)",
      inheritedTestDatabaseUrl ? undefined : process.env.DATABASE_TEST_URL,
    ),
    candidate("DATABASE_TEST_FALLBACK_URL", process.env.DATABASE_TEST_FALLBACK_URL),
  ]);
  process.env.DATABASE_TEST_URL = selected.test.url;
}

if (
  selected.application &&
  selected.test &&
  selected.application.identity === selected.test.identity
) {
  throw new Error(
    "Application and test database targets must be different; the test suite may reset its database.",
  );
}

if (options.checkOnly) {
  process.stdout.write("[database] environment ready\n");
  process.exitCode = 0;
} else {
  await runCommand(options.command, options.commandArguments);
}

function parseArguments(arguments_) {
  let scope = "both";
  let checkOnly = false;
  const separator = arguments_.indexOf("--");
  const optionArguments = separator === -1 ? arguments_ : arguments_.slice(0, separator);
  const commandArguments = separator === -1 ? [] : arguments_.slice(separator + 1);

  for (const argument of optionArguments) {
    if (argument === "--check") {
      checkOnly = true;
      continue;
    }
    if (argument.startsWith("--scope=")) {
      scope = argument.slice("--scope=".length);
      continue;
    }
    throw new Error(`Unknown database environment option: ${argument}`);
  }

  if (!["none", "app", "test", "both"].includes(scope)) {
    throw new Error(`Invalid database environment scope: ${scope}`);
  }
  if (!checkOnly && commandArguments.length === 0) {
    throw new Error("Expected a command after --");
  }

  return {
    scope,
    checkOnly,
    command: commandArguments[0],
    commandArguments: commandArguments.slice(1),
  };
}

function candidate(source, url) {
  return url ? { source, url } : null;
}

async function selectDatabase(purpose, candidates) {
  const usableCandidates = [];
  const seen = new Set();

  for (const current of candidates) {
    if (!current || seen.has(current.url)) {
      continue;
    }
    seen.add(current.url);
    usableCandidates.push(current);
  }

  if (usableCandidates.length === 0) {
    throw new Error(
      `No ${purpose} database is configured. Set a local URL or its fallback URL in .env.`,
    );
  }

  for (const current of usableCandidates) {
    const endpoint = describeDatabaseUrl(current.url);
    try {
      const result = await inspectPostgres(current.url);
      if (result.majorVersion !== 17) {
        process.stderr.write(
          `[database] ${purpose}: skipped ${current.source} (${endpoint}); expected PostgreSQL 17, found ${result.version}\n`,
        );
        continue;
      }
      process.stdout.write(
        `[database] ${purpose}: ${current.source} -> ${endpoint} (PostgreSQL ${result.version})\n`,
      );
      return {
        ...current,
        identity: endpoint,
      };
    } catch (error) {
      process.stderr.write(
        `[database] ${purpose}: unavailable ${current.source} (${endpoint}; ${safeError(error)})\n`,
      );
    }
  }

  throw new Error(
    `No reachable PostgreSQL 17 ${purpose} database was found after checking configured local and fallback targets.`,
  );
}

async function inspectPostgres(connectionString) {
  const requireFromDatabasePackage = createRequire(
    resolve(repositoryRoot, "packages/database/package.json"),
  );
  const { Client } = requireFromDatabasePackage("pg");
  const client = new Client({
    application_name: "ngapd-environment-check",
    connectionString,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 3_000,
  });
  let connected = false;

  try {
    await client.connect();
    connected = true;
    const result = await client.query(
      "select current_database() as database_name, current_setting('server_version') as version, current_setting('server_version_num') as version_number",
    );
    const row = result.rows[0];
    const versionNumber = Number(row?.version_number);
    if (!row?.database_name || !row.version || !Number.isInteger(versionNumber)) {
      throw new Error("unexpected PostgreSQL identity response");
    }
    return {
      databaseName: row.database_name,
      majorVersion: Math.trunc(versionNumber / 10_000),
      version: row.version,
    };
  } finally {
    if (connected) {
      await client.end();
    }
  }
}

function describeDatabaseUrl(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    return "invalid PostgreSQL URL";
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  return `${parsed.hostname}:${parsed.port || "5432"}/${databaseName || "(missing)"}`;
}

function safeError(error) {
  const code = typeof error === "object" && error !== null ? error.code : undefined;
  if (typeof code === "string" && code) {
    return code;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/password authentication failed/iu.test(message)) {
    return "authentication failed";
  }
  if (/database .* does not exist/iu.test(message)) {
    return "database does not exist";
  }
  if (/unexpected PostgreSQL identity response/iu.test(message)) {
    return message;
  }
  return "connection failed";
}

async function runCommand(command, commandArguments) {
  let executable = command;
  let arguments_ = commandArguments;
  const packageManagerEntry = process.env.npm_execpath;

  if (command === "pnpm" && packageManagerEntry) {
    const packageManagerName = basename(packageManagerEntry).toLowerCase();
    executable = process.execPath;
    arguments_ = packageManagerName.includes("pnpm")
      ? [packageManagerEntry, ...commandArguments]
      : [packageManagerEntry, "run", ...commandArguments];
  } else if (process.platform === "win32" && !/\.(?:cmd|exe)$/iu.test(command)) {
    executable = `${command}.cmd`;
  }

  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal ${signal}`));
        return;
      }
      resolveExit(code ?? 1);
    });
  });

  process.exitCode = exitCode;
}
