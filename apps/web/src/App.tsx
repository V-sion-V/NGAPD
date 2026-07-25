import type { ApiError, DeviceSummary, PairingStatus, SessionActor } from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";

import { TaskUiApp } from "./task-ui/TaskUiApp.js";

interface PairingSummary {
  pairingId: string;
  status: PairingStatus;
  device: Pick<DeviceSummary, "name" | "platform">;
  expiresAt: string;
}

class RequestError extends Error {
  constructor(readonly detail: ApiError) {
    super(detail.message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new RequestError((await response.json()) as ApiError);
  }
  return response.json() as Promise<T>;
}

export function App() {
  if (new URLSearchParams(window.location.search).get("prototype") === "task-ui") {
    return <TaskUiApp />;
  }
  return <WorkspaceAccessApp />;
}

function WorkspaceAccessApp() {
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const initialCode = useMemo(
    () => new URLSearchParams(window.location.search).get("code") ?? "",
    [],
  );
  const [pairingCode, setPairingCode] = useState(initialCode.toUpperCase());

  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionActor>("/api/v1/auth/session"),
    retry: false,
  });
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => api<{ devices: DeviceSummary[] }>("/api/v1/devices"),
    enabled: Boolean(session.data),
  });
  const pairing = useQuery({
    queryKey: ["pairing", pairingCode],
    queryFn: () =>
      api<PairingSummary>(`/api/v1/pairing/requests/${encodeURIComponent(pairingCode)}`),
    enabled: Boolean(session.data && /^[A-Z0-9]{8}$/.test(pairingCode)),
    retry: false,
  });

  const auth = useMutation({
    mutationFn: () =>
      api<SessionActor>(`/api/v1/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ loginName, password }),
      }),
    onSuccess: async (actor) => {
      queryClient.setQueryData(["session"], actor);
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: () => setPassword(""),
  });
  const logout = useMutation({
    mutationFn: () => api<{ ok: true }>("/api/v1/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["session"] });
      queryClient.removeQueries({ queryKey: ["devices"] });
      queryClient.removeQueries({ queryKey: ["pairing"] });
    },
  });
  const pairingDecision = useMutation({
    mutationFn: (decision: "approve" | "deny") =>
      api<PairingSummary>(`/api/v1/pairing/requests/${encodeURIComponent(pairingCode)}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (result) => queryClient.setQueryData(["pairing", pairingCode], result),
  });
  const revokeDevice = useMutation({
    mutationFn: (deviceId: string) =>
      api<{ ok: true }>(`/api/v1/devices/${encodeURIComponent(deviceId)}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  const submitAuth = (event: FormEvent) => {
    event.preventDefault();
    auth.mutate();
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">NGAPD · Workspace access</p>
        <h1>安全连接你的 Workspace 设备</h1>
        <p className="summary">
          Web 只处理账号和一次性设备确认。Workspace 文件始终由本地 CLI 与服务端同步层处理。
        </p>

        {session.isPending && <p className="notice">正在检查登录状态…</p>}
        {!session.data && !session.isPending && (
          <form className="panel form" onSubmit={submitAuth}>
            <div className="tabs" aria-label="账号操作">
              <button
                className={authMode === "register" ? "tab tab--active" : "tab"}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                注册
              </button>
              <button
                className={authMode === "login" ? "tab tab--active" : "tab"}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                登录
              </button>
            </div>
            <label>
              登录名
              <input
                autoComplete="username"
                minLength={3}
                required
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
              />
            </label>
            <label>
              密码
              <input
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                minLength={12}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="primary" disabled={auth.isPending} type="submit">
              {auth.isPending ? "处理中…" : authMode === "register" ? "创建账号" : "登录"}
            </button>
            <ErrorNotice error={auth.error} />
          </form>
        )}

        {session.data && (
          <div className="workspace">
            <header className="account-bar">
              <div>
                <span className="muted">当前账号</span>
                <strong>{session.data.loginName}</strong>
              </div>
              <button
                className="secondary"
                disabled={logout.isPending}
                type="button"
                onClick={() => logout.mutate()}
              >
                退出
              </button>
            </header>

            <section className="panel">
              <h2>确认一次性配对</h2>
              <label>
                CLI 显示的 8 位配对码
                <input
                  autoCapitalize="characters"
                  maxLength={8}
                  value={pairingCode}
                  onChange={(event) =>
                    setPairingCode(event.target.value.replaceAll("-", "").toUpperCase())
                  }
                />
              </label>
              {pairing.isFetching && <p className="notice">正在读取设备摘要…</p>}
              {pairing.data && (
                <div className="device-card">
                  <div>
                    <strong>{pairing.data.device.name}</strong>
                    <span>
                      {pairing.data.device.platform} · {pairing.data.status}
                    </span>
                  </div>
                  {pairing.data.status === "pending" && (
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={pairingDecision.isPending}
                        type="button"
                        onClick={() => pairingDecision.mutate("deny")}
                      >
                        拒绝
                      </button>
                      <button
                        className="primary"
                        disabled={pairingDecision.isPending}
                        type="button"
                        onClick={() => pairingDecision.mutate("approve")}
                      >
                        确认此设备
                      </button>
                    </div>
                  )}
                </div>
              )}
              <ErrorNotice error={pairing.error ?? pairingDecision.error} />
            </section>

            <section className="panel">
              <h2>已授权设备</h2>
              {devices.data?.devices.length ? (
                <ul className="device-list">
                  {devices.data.devices.map((device) => (
                    <li key={device.id}>
                      <div>
                        <strong>{device.name}</strong>
                        <span>
                          {device.platform} · {device.revokedAt ? "已撤销" : "有效"}
                        </span>
                      </div>
                      {!device.revokedAt && (
                        <button
                          className="secondary"
                          disabled={revokeDevice.isPending}
                          type="button"
                          onClick={() => revokeDevice.mutate(device.id)}
                        >
                          撤销
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notice">尚未授权设备。</p>
              )}
              <ErrorNotice error={devices.error ?? revokeDevice.error} />
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function ErrorNotice({ error }: { error: Error | null }) {
  if (!error) {
    return null;
  }
  const recovery = error instanceof RequestError ? error.detail.recovery : undefined;
  return (
    <p className="error" role="alert">
      {error.message}
      {recovery ? ` · ${recovery}` : ""}
    </p>
  );
}
