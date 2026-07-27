import { randomBytes } from "node:crypto";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { URL } from "node:url";

const repositoryRoot = new URL("../../", import.meta.url);
const projectName = "ngapd-p004-smoke";
const composeExecutable = process.env.COMPOSE_BIN ?? "docker";
const composePrefix = process.env.COMPOSE_BIN ? [] : ["compose"];
const httpPort = process.env.NGAPD_SMOKE_HTTP_PORT ?? "18080";
const httpsPort = process.env.NGAPD_SMOKE_HTTPS_PORT ?? "18443";
const useVerifiedPreloadedImages = process.env.NGAPD_COMPOSE_VERIFIED_PRELOAD === "1";
const ephemeralPassword = randomBytes(24).toString("hex");
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: projectName,
  POSTGRES_DB: "ngapd_smoke",
  POSTGRES_USER: "ngapd",
  POSTGRES_PASSWORD: ephemeralPassword,
  NGAPD_SITE_ADDRESS: `https://ngapd.local:${httpsPort}`,
  NGAPD_HTTP_PORT: httpPort,
  NGAPD_HTTPS_PORT: httpsPort,
};

function run(command, args, options = {}) {
  const capture = options.capture === true;
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${String(result.status)}`);
  }
  return result;
}

function compose(args, options = {}) {
  return run(
    composeExecutable,
    [...composePrefix, "--project-name", projectName, "--file", "compose.yaml", ...args],
    options,
  );
}

function check(condition, message) {
  if (!condition) {
    throw new Error(`Compose smoke assertion failed: ${message}`);
  }
}

function serviceNetworks(service) {
  if (Array.isArray(service.networks)) {
    return service.networks;
  }
  return Object.keys(service.networks ?? {});
}

function parseConfig() {
  const raw = compose(["config", "--format", "json"], { capture: true }).stdout;
  const config = JSON.parse(raw);
  const expectedServices = ["api", "gateway", "migrate", "postgres", "web", "worker"];
  check(
    JSON.stringify(Object.keys(config.services).sort()) === JSON.stringify(expectedServices),
    "service inventory must be postgres/migrate/api/worker/web/gateway",
  );
  check(config.networks.backend.internal === true, "backend network must be internal");
  check(
    serviceNetworks(config.services.api).includes("backend") &&
      !serviceNetworks(config.services.api).includes("edge"),
    "API must use only the internal backend network",
  );
  check(
    serviceNetworks(config.services.worker).includes("backend") &&
      !serviceNetworks(config.services.worker).includes("edge"),
    "Worker must use only the internal backend network",
  );
  for (const serviceName of ["postgres", "migrate", "api", "worker", "web"]) {
    check(
      (config.services[serviceName].ports ?? []).length === 0,
      `${serviceName} must not publish a host port`,
    );
  }
  check((config.services.gateway.ports ?? []).length === 3, "Gateway must own all host ports");
  const apiVolumeTargets = (config.services.api.volumes ?? []).map((volume) => volume.target);
  check(apiVolumeTargets.includes("/var/lib/ngapd/objects"), "object volume must be persistent");
  check(apiVolumeTargets.includes("/var/lib/ngapd/backups"), "backup volume must be persistent");
  check(
    (config.services.postgres.volumes ?? []).some(
      (volume) => volume.target === "/var/lib/postgresql/data",
    ),
    "PostgreSQL volume must be persistent",
  );
}

function parseComposePs() {
  const raw = compose(["ps", "--format", "json"], { capture: true }).stdout.trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return raw
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

function curlGateway(pathname) {
  const command = process.platform === "win32" ? "curl.exe" : "curl";
  return run(
    command,
    [
      "--fail",
      "--silent",
      "--show-error",
      "--insecure",
      "--resolve",
      `ngapd.local:${httpsPort}:127.0.0.1`,
      `https://ngapd.local:${httpsPort}${pathname}`,
    ],
    { capture: true },
  ).stdout;
}

function assertServiceUsers() {
  for (const serviceName of ["api", "worker", "web", "gateway"]) {
    const uid = compose(["exec", "-T", serviceName, "id", "-u"], {
      capture: true,
    }).stdout.trim();
    check(uid !== "" && uid !== "0", `${serviceName} must run as a non-root user`);
  }
}

function assertNoApplicationEgress(serviceName) {
  const source =
    "try { await fetch('https://example.com', { signal: AbortSignal.timeout(3000) }); process.exit(1); } catch { process.exit(0); }";
  compose(["exec", "-T", serviceName, "node", "--input-type=module", "--eval", source]);
}

function assertPersistentApplicationVolumes() {
  const writeMarker =
    "const fs = await import('node:fs/promises'); await fs.writeFile('/var/lib/ngapd/objects/smoke-marker', 'objects'); await fs.writeFile('/var/lib/ngapd/backups/smoke-marker', 'backups');";
  const readMarker =
    "const fs = await import('node:fs/promises'); if ((await fs.readFile('/var/lib/ngapd/objects/smoke-marker', 'utf8')) !== 'objects') process.exit(1); if ((await fs.readFile('/var/lib/ngapd/backups/smoke-marker', 'utf8')) !== 'backups') process.exit(1);";
  compose(["exec", "-T", "api", "node", "--input-type=module", "--eval", writeMarker]);
  compose(["restart", "api"]);
  compose(["up", "--detach", "--wait", "--wait-timeout", "180"]);
  compose(["exec", "-T", "api", "node", "--input-type=module", "--eval", readMarker]);
}

let failure;
try {
  process.stdout.write("[compose-smoke] validating resolved configuration\n");
  parseConfig();

  process.stdout.write(
    `[compose-smoke] building all service images (${useVerifiedPreloadedImages ? "verified preloaded bases" : "pull current bases"})\n`,
  );
  compose(useVerifiedPreloadedImages ? ["build"] : ["build", "--pull"]);

  process.stdout.write("[compose-smoke] starting clean six-service stack\n");
  compose(["up", "--detach", "--wait", "--wait-timeout", "240"]);

  check(curlGateway("/health/live").includes('"status":"ok"'), "Gateway API liveness failed");
  check(curlGateway("/health/ready").includes('"status":"ok"'), "Gateway API readiness failed");
  check(curlGateway("/").includes('id="root"'), "Gateway did not serve the Web application");

  compose([
    "exec",
    "-T",
    "worker",
    "node",
    "-e",
    "fetch('http://127.0.0.1:3001/health/live').then(r=>{if(!r.ok)process.exit(1)})",
  ]);
  compose([
    "exec",
    "-T",
    "worker",
    "node",
    "-e",
    "fetch('http://127.0.0.1:3001/health/ready').then(r=>{if(!r.ok)process.exit(1)})",
  ]);
  compose(["run", "--rm", "migrate"]);

  assertServiceUsers();
  assertPersistentApplicationVolumes();
  assertNoApplicationEgress("api");
  assertNoApplicationEgress("worker");

  const apiPort = compose(["port", "api", "3000"], {
    capture: true,
    allowFailure: true,
  }).stdout.trim();
  const workerPort = compose(["port", "worker", "3001"], {
    capture: true,
    allowFailure: true,
  }).stdout.trim();
  check(
    ["", ":0"].includes(apiPort) && ["", ":0"].includes(workerPort),
    "API/Worker port lookup must not return a host binding",
  );
  const runtimeServices = parseComposePs();
  for (const serviceName of ["api", "worker"]) {
    const service = runtimeServices.find(
      (candidate) => (candidate.Service ?? candidate.service) === serviceName,
    );
    check(service, `${serviceName} must appear in the running service inventory`);
    const runtimePublishers = service.Publishers ?? service.publishers ?? [];
    check(
      runtimePublishers.every((publisher) => {
        const publishedPort = Number(publisher.PublishedPort ?? publisher.publishedPort ?? 0);
        const hostUrl = publisher.URL ?? publisher.url ?? "";
        return publishedPort === 0 && hostUrl === "";
      }),
      `${serviceName} must have no runtime publishers`,
    );
  }

  const logs = compose(["logs", "--no-color"], { capture: true }).stdout;
  check(!logs.includes(ephemeralPassword), "ephemeral PostgreSQL password appeared in logs");

  process.stdout.write(
    `${JSON.stringify({
      project: projectName,
      services: 6,
      gateway: `https://ngapd.local:${httpsPort}`,
      applicationEgress: "blocked",
      persistentVolumes: "verified",
    })}\n`,
  );
} catch (error) {
  failure = error;
  const diagnostics = compose(["logs", "--no-color", "--tail", "200"], {
    capture: true,
    allowFailure: true,
  }).stdout.replaceAll(ephemeralPassword, "[REDACTED]");
  if (diagnostics) {
    process.stderr.write(`${diagnostics}\n`);
  }
} finally {
  const cleanup = compose(["down", "--volumes", "--remove-orphans", "--timeout", "20"], {
    allowFailure: true,
  });
  if (cleanup.status !== 0 && !failure) {
    failure = new Error(`Compose cleanup failed with exit ${String(cleanup.status)}`);
  }
  const remaining = compose(["ps", "--all", "--quiet"], {
    capture: true,
    allowFailure: true,
  }).stdout.trim();
  if (remaining && !failure) {
    failure = new Error("Compose cleanup left project containers behind");
  }
}

if (failure) {
  throw failure;
}
