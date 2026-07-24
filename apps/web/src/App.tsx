import type { HealthStatus } from "@ngapd/contracts";
import { useQuery } from "@tanstack/react-query";

async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/health/ready");

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json() as Promise<HealthStatus>;
}

export function App() {
  const health = useQuery({
    queryKey: ["health", "ready"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">NGAPD · Prototype foundation</p>
        <h1>独立游戏团队的任务、工作区与 Agent 上下文</h1>
        <p className="summary">
          工程骨架已连接 React、Fastify、PostgreSQL 与桌面客户端。下一步从工作区租约与同步原型开始。
        </p>
        <div className="status" role="status" aria-live="polite">
          <span
            className={health.data?.status === "ok" ? "status-dot status-dot--ok" : "status-dot"}
            aria-hidden="true"
          />
          {health.isPending && "正在检查服务状态…"}
          {health.isError && "API 或数据库尚未就绪"}
          {health.data && `API 与数据库已就绪 · ${health.data.timestamp}`}
        </div>
      </section>
    </main>
  );
}
