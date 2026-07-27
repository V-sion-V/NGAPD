import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const repositoryRoot = new URL("../../", import.meta.url);
const expectedNodeVersion = (
  await readFile(new URL(".node-version", repositoryRoot), "utf8")
).trim();
const packageManifest = JSON.parse(await readFile(new URL("package.json", repositoryRoot), "utf8"));
const expectedPnpmVersion = String(packageManifest.packageManager).replace(/^pnpm@/, "");

function fail(message) {
  process.stderr.write(`CI preflight failed: ${message}\n`);
  process.exitCode = 1;
}

function readPnpmVersion() {
  const match = /^pnpm\/([^\s]+)/u.exec(process.env.npm_config_user_agent ?? "");
  if (!match) {
    fail("the preflight must be invoked through pnpm");
    return null;
  }
  return match[1];
}

function requirePostgresUrl(name) {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is required`);
    return;
  }
  try {
    const parsed = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.pathname === "/"
    ) {
      throw new Error("invalid target");
    }
  } catch {
    fail(`${name} must identify a PostgreSQL host and database`);
  }
}

if (process.versions.node !== expectedNodeVersion) {
  fail(`Node ${expectedNodeVersion} is required; observed ${process.versions.node}`);
}

const observedPnpmVersion = readPnpmVersion();
if (observedPnpmVersion && observedPnpmVersion !== expectedPnpmVersion) {
  fail(`pnpm ${expectedPnpmVersion} is required; observed ${observedPnpmVersion}`);
}

const requiresDatabase = process.argv.includes("--require-database");
if (requiresDatabase) {
  requirePostgresUrl("DATABASE_URL");
  requirePostgresUrl("DATABASE_TEST_URL");
}

if (process.exitCode) {
  process.exit();
}

process.stdout.write(
  `${JSON.stringify({
    node: process.versions.node,
    pnpm: observedPnpmVersion,
    databaseGate: requiresDatabase,
  })}\n`,
);
