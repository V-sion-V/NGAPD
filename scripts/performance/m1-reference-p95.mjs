import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import https from "node:https";
import process from "node:process";
import { URL } from "node:url";

const defaults = {
  host: process.env.NGAPD_REFERENCE_HOST ?? "127.0.0.1",
  port: Number(process.env.NGAPD_REFERENCE_HTTPS_PORT ?? "8443"),
  origin: process.env.NGAPD_REFERENCE_ORIGIN,
  serverName: process.env.NGAPD_REFERENCE_SERVER_NAME,
  readSamples: Number(process.env.NGAPD_REFERENCE_READ_SAMPLES ?? "100"),
  writeSamples: Number(process.env.NGAPD_REFERENCE_WRITE_SAMPLES ?? "100"),
  warmupReads: Number(process.env.NGAPD_REFERENCE_WARMUP_READS ?? "20"),
  warmupWrites: Number(process.env.NGAPD_REFERENCE_WARMUP_WRITES ?? "5"),
  readThresholdMs: Number(process.env.NGAPD_REFERENCE_READ_THRESHOLD_MS ?? "500"),
  writeThresholdMs: Number(process.env.NGAPD_REFERENCE_WRITE_THRESHOLD_MS ?? "800"),
  insecure: false,
  confirmIsolatedTarget: false,
};

function usage() {
  process.stdout.write(`Usage: pnpm reference:p95 -- [options]

Required safety acknowledgement:
  --confirm-isolated-target      Confirm that the target uses disposable test data

Connection:
  --host <host>                  Connect address (default: 127.0.0.1)
  --port <port>                  HTTPS port (default: 8443)
  --origin <origin>              Origin/Host expected by NGAPD
  --server-name <name>           TLS SNI name; defaults to the origin hostname
  --insecure                     Accept the isolated stack's internal CA certificate

Sampling:
  --samples <count>              Set both read and write sample counts
  --read-samples <count>         Read sample count (default: 100)
  --write-samples <count>        Write sample count (default: 100)
  --warmup-reads <count>         Untimed read warmups (default: 20)
  --warmup-writes <count>        Untimed write warmups (default: 5)
  --read-threshold-ms <ms>       Read P95 threshold (default: 500)
  --write-threshold-ms <ms>      Write P95 threshold (default: 800)
`);
}

function positiveNumber(value, name, { integer = false, allowZero = false } = {}) {
  const parsed = Number(value);
  const minimumSatisfied = allowZero ? parsed >= 0 : parsed > 0;
  if (!Number.isFinite(parsed) || !minimumSatisfied || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"} number`);
  }
  return parsed;
}

function readValue(arguments_, index, name) {
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseOptions(arguments_) {
  const options = { ...defaults };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    switch (argument) {
      case "--":
        break;
      case "--help":
        usage();
        return null;
      case "--confirm-isolated-target":
        options.confirmIsolatedTarget = true;
        break;
      case "--insecure":
        options.insecure = true;
        break;
      case "--host":
        options.host = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--port":
        options.port = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
        });
        index += 1;
        break;
      case "--origin":
        options.origin = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--server-name":
        options.serverName = readValue(arguments_, index, argument);
        index += 1;
        break;
      case "--samples": {
        const samples = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
        });
        options.readSamples = samples;
        options.writeSamples = samples;
        index += 1;
        break;
      }
      case "--read-samples":
        options.readSamples = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
        });
        index += 1;
        break;
      case "--write-samples":
        options.writeSamples = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
        });
        index += 1;
        break;
      case "--warmup-reads":
        options.warmupReads = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
          allowZero: true,
        });
        index += 1;
        break;
      case "--warmup-writes":
        options.warmupWrites = positiveNumber(readValue(arguments_, index, argument), argument, {
          integer: true,
          allowZero: true,
        });
        index += 1;
        break;
      case "--read-threshold-ms":
        options.readThresholdMs = positiveNumber(readValue(arguments_, index, argument), argument);
        index += 1;
        break;
      case "--write-threshold-ms":
        options.writeThresholdMs = positiveNumber(readValue(arguments_, index, argument), argument);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  options.origin ??= `https://ngapd.local:${String(options.port)}`;
  const origin = new URL(options.origin);
  if (origin.protocol !== "https:") {
    throw new Error("--origin must use https");
  }
  options.port = positiveNumber(options.port, "--port", { integer: true });
  options.readSamples = positiveNumber(options.readSamples, "--read-samples", { integer: true });
  options.writeSamples = positiveNumber(options.writeSamples, "--write-samples", {
    integer: true,
  });
  options.warmupReads = positiveNumber(options.warmupReads, "--warmup-reads", {
    integer: true,
    allowZero: true,
  });
  options.warmupWrites = positiveNumber(options.warmupWrites, "--warmup-writes", {
    integer: true,
    allowZero: true,
  });
  options.readThresholdMs = positiveNumber(options.readThresholdMs, "--read-threshold-ms");
  options.writeThresholdMs = positiveNumber(options.writeThresholdMs, "--write-threshold-ms");
  options.origin = origin.origin;
  options.serverName ??= origin.hostname;
  options.hostHeader = origin.host;

  if (!options.confirmIsolatedTarget) {
    throw new Error(
      "--confirm-isolated-target is required because the benchmark creates a synthetic user and profile updates",
    );
  }
  return options;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function metrics(values) {
  return {
    samples: values.length,
    p50Ms: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
  };
}

async function benchmark(options) {
  const agent = new https.Agent({
    keepAlive: true,
    maxSockets: 1,
    rejectUnauthorized: !options.insecure,
  });

  async function request(method, pathname, { body, cookie, measure = false } = {}) {
    const encoded = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const started = process.hrtime.bigint();
    const result = await new Promise((resolve, reject) => {
      const request_ = https.request(
        {
          host: options.host,
          port: options.port,
          method,
          path: pathname,
          servername: options.serverName,
          agent,
          rejectUnauthorized: !options.insecure,
          headers: {
            Host: options.hostHeader,
            Accept: "application/json",
            "User-Agent": "ngapd-reference-p95",
            ...(cookie ? { Cookie: cookie } : {}),
            ...(method === "GET" ? {} : { Origin: options.origin }),
            ...(encoded
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(encoded.length),
                }
              : {}),
          },
        },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let json;
            try {
              json = text ? JSON.parse(text) : undefined;
            } catch {
              reject(
                new Error(`${method} ${pathname} returned invalid JSON (${response.statusCode})`),
              );
              return;
            }
            resolve({
              status: response.statusCode,
              headers: response.headers,
              json,
            });
          });
        },
      );
      request_.on("error", reject);
      request_.setTimeout(10_000, () =>
        request_.destroy(new Error(`${method} ${pathname} timed out`)),
      );
      if (encoded) {
        request_.write(encoded);
      }
      request_.end();
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (result.status < 200 || result.status >= 300) {
      const code = result.json?.code ? ` (${String(result.json.code)})` : "";
      throw new Error(`${method} ${pathname} returned ${String(result.status)}${code}`);
    }
    return measure ? { ...result, elapsedMs } : result;
  }

  try {
    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const registered = await request("POST", "/api/v1/auth/register", {
      body: {
        loginName: `refperf-${suffix}`,
        password: `reference-only-${suffix}`,
      },
    });
    const setCookie = registered.headers["set-cookie"]?.[0];
    if (!setCookie) {
      throw new Error("Registration did not return a session cookie");
    }
    const cookie = setCookie.split(";", 1)[0];

    let profile = (await request("GET", "/api/v1/users/me/profile", { cookie })).json;

    for (let index = 0; index < options.warmupReads; index += 1) {
      profile = (await request("GET", "/api/v1/users/me/profile", { cookie })).json;
    }
    for (let index = 0; index < options.warmupWrites; index += 1) {
      profile = (
        await request("PATCH", "/api/v1/users/me/profile", {
          cookie,
          body: {
            displayName: `Reference warmup ${String(index % 2)}`,
            defaultIntroduction: "Reference-server warmup",
            defaultRoleTemplateIds: [],
            expectedVersion: profile.version,
          },
        })
      ).json;
    }

    const reads = [];
    for (let index = 0; index < options.readSamples; index += 1) {
      const response = await request("GET", "/api/v1/users/me/profile", {
        cookie,
        measure: true,
      });
      reads.push(response.elapsedMs);
    }

    const writes = [];
    for (let index = 0; index < options.writeSamples; index += 1) {
      const response = await request("PATCH", "/api/v1/users/me/profile", {
        cookie,
        measure: true,
        body: {
          displayName: `Reference sample ${String(index % 2)}`,
          defaultIntroduction: "Reference-server P95 sample",
          defaultRoleTemplateIds: [],
          expectedVersion: profile.version,
        },
      });
      profile = response.json;
      writes.push(response.elapsedMs);
    }

    const read = metrics(reads);
    const write = metrics(writes);
    const passed = read.p95Ms < options.readThresholdMs && write.p95Ms < options.writeThresholdMs;
    return {
      observedAt: new Date().toISOString(),
      path: `${options.host} -> HTTPS gateway -> API -> PostgreSQL`,
      sampling: "single client, sequential requests, one keep-alive connection",
      warmup: {
        reads: options.warmupReads,
        writes: options.warmupWrites,
      },
      read: {
        operation: "GET /api/v1/users/me/profile",
        thresholdMs: options.readThresholdMs,
        ...read,
        passed: read.p95Ms < options.readThresholdMs,
      },
      write: {
        operation: "PATCH /api/v1/users/me/profile",
        thresholdMs: options.writeThresholdMs,
        ...write,
        passed: write.p95Ms < options.writeThresholdMs,
      },
      result: passed ? "passed" : "failed",
    };
  } finally {
    agent.destroy();
  }
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options) {
    const result = await benchmark(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.result !== "passed") {
      process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(
    `reference P95 failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
