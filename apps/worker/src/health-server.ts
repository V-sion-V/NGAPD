import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface WorkerHealthServer {
  host: string;
  port: number;
  close(): Promise<void>;
}

export async function startWorkerHealthServer(input: {
  host: string;
  port: number;
  isReady: () => Promise<boolean> | boolean;
}): Promise<WorkerHealthServer> {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://worker-health").pathname;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");

    if (request.method === "GET" && pathname === "/health/live") {
      response.statusCode = 200;
      response.end(JSON.stringify({ service: "ngapd-worker", status: "ok" }));
      return;
    }

    if (request.method === "GET" && pathname === "/health/ready") {
      let ready = false;
      try {
        ready = await input.isReady();
      } catch {
        ready = false;
      }
      response.statusCode = ready ? 200 : 503;
      response.end(
        JSON.stringify({
          service: "ngapd-worker",
          status: ready ? "ok" : "error",
          checks: { databaseAndRunner: ready },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ service: "ngapd-worker", status: "not_found" }));
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(input.port, input.host);
  });

  const address = server.address() as AddressInfo;
  return {
    host: input.host,
    port: address.port,
    close: async () => {
      if (!server.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}
