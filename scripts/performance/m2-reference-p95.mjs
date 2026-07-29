import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import http from "node:http";
import https from "node:https";
import process from "node:process";
import { URL } from "node:url";

function parse(arguments_) {
  const options = {
    baseUrl: process.env.NGAPD_M2_REFERENCE_URL ?? "https://ngapd.local:8443",
    connectHost: process.env.NGAPD_M2_REFERENCE_HOST,
    samples: Number(process.env.NGAPD_M2_REFERENCE_SAMPLES ?? "20"),
    insecure: false,
    confirmed: false,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--confirm-isolated-target") {
      options.confirmed = true;
    } else if (argument === "--insecure") {
      options.insecure = true;
    } else if (argument === "--base-url") {
      options.baseUrl = arguments_[++index];
    } else if (argument === "--connect-host") {
      options.connectHost = arguments_[++index];
    } else if (argument === "--samples") {
      options.samples = Number(arguments_[++index]);
    } else if (argument === "--help") {
      process.stdout.write(`Usage: pnpm reference:m2:p95 -- [options]

  --confirm-isolated-target  Required: benchmark creates disposable users/tasks
  --base-url <url>           Public NGAPD origin (default https://ngapd.local:8443)
  --connect-host <host>      Connect host while preserving origin Host/SNI
  --samples <count>          Samples per operation (default 20)
  --insecure                 Accept the isolated deployment certificate
`);
      return null;
    } else if (argument !== "--") {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!options.confirmed) {
    throw new Error("--confirm-isolated-target is required");
  }
  if (!Number.isInteger(options.samples) || options.samples < 5 || options.samples > 500) {
    throw new Error("--samples must be an integer from 5 through 500");
  }
  options.url = new URL(options.baseUrl);
  if (!["http:", "https:"].includes(options.url.protocol)) {
    throw new Error("--base-url must use http or https");
  }
  return options;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function metric(values, thresholdMs) {
  const p95Ms = Number(percentile(values, 0.95).toFixed(2));
  return {
    samples: values.length,
    p50Ms: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms,
    maxMs: Number(Math.max(...values).toFixed(2)),
    thresholdMs,
    passed: p95Ms < thresholdMs,
  };
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (!options) {
    return;
  }
  const transport = options.url.protocol === "https:" ? https : http;
  const agent =
    options.url.protocol === "https:"
      ? new https.Agent({ keepAlive: true, rejectUnauthorized: !options.insecure })
      : new http.Agent({ keepAlive: true });

  async function request(method, pathname, { body, cookie, taskMutation = false } = {}) {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    const response = await new Promise((resolve, reject) => {
      const outgoing = transport.request(
        {
          protocol: options.url.protocol,
          hostname: options.connectHost ?? options.url.hostname,
          port: options.url.port || (options.url.protocol === "https:" ? 443 : 80),
          servername: options.url.hostname,
          path: `${options.url.pathname.replace(/\/$/u, "")}${pathname}`,
          method,
          agent,
          rejectUnauthorized: !options.insecure,
          headers: {
            Host: options.url.host,
            Accept: "application/json",
            "User-Agent": "ngapd-m2-reference-p95",
            "x-request-id": requestId,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(method === "GET" ? {} : { Origin: options.url.origin }),
            ...(taskMutation ? { "idempotency-key": randomUUID() } : {}),
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(payload.length),
                }
              : {}),
          },
        },
        (incoming) => {
          const chunks = [];
          incoming.on("data", (chunk) => chunks.push(chunk));
          incoming.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let json;
            try {
              json = text ? JSON.parse(text) : undefined;
            } catch {
              reject(new Error(`${method} ${pathname} returned invalid JSON`));
              return;
            }
            resolve({
              status: incoming.statusCode,
              headers: incoming.headers,
              json,
            });
          });
        },
      );
      outgoing.on("error", reject);
      outgoing.setTimeout(15_000, () =>
        outgoing.destroy(new Error(`${method} ${pathname} timed out`)),
      );
      if (payload) {
        outgoing.write(payload);
      }
      outgoing.end();
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `${method} ${pathname} returned ${response.status} ${response.json?.code ?? ""}`,
      );
    }
    return { ...response, elapsedMs };
  }

  const suffix = Date.now().toString(36).slice(-6);
  const registered = await request("POST", "/api/v1/auth/register", {
    body: {
      loginName: `m2-p95-${suffix}`,
      password: `m2-isolated-${randomUUID()}`,
    },
  });
  const setCookie = registered.headers["set-cookie"];
  const cookieLine = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookieLine) {
    throw new Error("Registration response did not include a session cookie");
  }
  const cookie = cookieLine.split(";")[0];
  const projectKey = `P${randomUUID()
    .replace(/[^a-f0-9]/gu, "")
    .slice(0, 5)
    .split("")
    .map((character) => String.fromCharCode(65 + Number.parseInt(character, 16)))
    .join("")}`;
  const createdProject = await request("POST", "/api/v1/projects", {
    cookie,
    body: {
      key: projectKey,
      name: "M2 reference benchmark",
      idempotencyKey: randomUUID(),
    },
  });
  const ownerMembershipId = createdProject.json.project.ownerMembershipId;
  const createTask = (title, parentTaskKey = null) =>
    request("POST", `/api/v1/projects/${projectKey}/tasks`, {
      cookie,
      taskMutation: true,
      body: {
        parentTaskKey,
        explicitOwnerMembershipId: parentTaskKey ? null : ownerMembershipId,
        title,
      },
    });

  const root = await createTask("Benchmark root");
  const rootTask = root.json.task;
  const createSamples = [];
  for (let index = 0; index < options.samples; index += 1) {
    const result = await createTask(`Create sample ${index}`);
    createSamples.push(result.elapsedMs);
  }
  const detailSamples = [];
  const listSamples = [];
  for (let index = 0; index < options.samples; index += 1) {
    detailSamples.push(
      (
        await request("GET", `/api/v1/projects/${projectKey}/tasks/${rootTask.key}`, {
          cookie,
        })
      ).elapsedMs,
    );
    listSamples.push(
      (
        await request("GET", `/api/v1/projects/${projectKey}/tasks?parentTaskKey=root`, {
          cookie,
        })
      ).elapsedMs,
    );
  }

  let updateVersion = rootTask.version;
  const updateSamples = [];
  for (let index = 0; index < options.samples; index += 1) {
    const result = await request("PATCH", `/api/v1/projects/${projectKey}/tasks/${rootTask.key}`, {
      cookie,
      taskMutation: true,
      body: {
        expectedTaskVersion: updateVersion,
        title: `Benchmark root ${index}`,
      },
    });
    updateVersion = result.json.task.version;
    updateSamples.push(result.elapsedMs);
  }

  const dagParent = await createTask("DAG parent");
  const dagKeys = [];
  for (let index = 0; index < 200; index += 1) {
    const child = await createTask(`DAG node ${index}`, dagParent.json.task.key);
    dagKeys.push(child.json.task.key);
  }
  for (let index = 0; index < dagKeys.length - 1; index += 1) {
    await request("POST", `/api/v1/projects/${projectKey}/task-dependencies`, {
      cookie,
      taskMutation: true,
      body: {
        action: "add",
        predecessorTaskKey: dagKeys[index],
        successorTaskKey: dagKeys[index + 1],
        expectedGraphVersion: index,
      },
    });
  }
  const dagSamples = [];
  for (let index = 0; index < options.samples; index += 1) {
    dagSamples.push(
      (
        await request(
          "GET",
          `/api/v1/projects/${projectKey}/tasks?parentTaskKey=${dagParent.json.task.key}&limit=200`,
          { cookie },
        )
      ).elapsedMs,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: options.url.origin,
    projectKey,
    metrics: {
      list: metric(listSamples, 500),
      detail: metric(detailSamples, 500),
      create: metric(createSamples, 800),
      update: metric(updateSamples, 800),
      dag200: metric(dagSamples, 800),
    },
  };
  process.stdout.write(`M2_REFERENCE_P95 ${JSON.stringify(report)}\n`);
  if (Object.values(report.metrics).some((entry) => !entry.passed)) {
    process.exitCode = 1;
  }
  agent.destroy();
}

await main();
