import type { SessionActor } from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";

import { ApiRequestError, apiRequest } from "../api.js";
import { ErrorNotice } from "./ErrorNotice.js";

export function AuthGate({
  children,
}: {
  children: (actor: SessionActor, logout: () => void, logoutPending: boolean) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const loginInput = useRef<HTMLInputElement>(null);
  const loginId = useId();
  const passwordId = useId();
  const errorId = useId();

  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => apiRequest<SessionActor>("/api/v1/auth/session", { signal }),
    retry: false,
  });

  const auth = useMutation({
    mutationFn: () =>
      apiRequest<SessionActor>(`/api/v1/auth/${mode}`, {
        method: "POST",
        json: { loginName, password },
      }),
    onSuccess: (actor) => {
      queryClient.setQueryData(["session"], actor);
      setPassword("");
    },
    onError: () => setPassword(""),
  });

  const logout = useMutation({
    mutationFn: () => apiRequest<{ ok: true }>("/api/v1/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      setPassword("");
      queueMicrotask(() => loginInput.current?.focus());
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    auth.mutate();
  };
  const sessionError =
    session.error instanceof ApiRequestError &&
    session.error.detail.code === "AUTHENTICATION_REQUIRED"
      ? null
      : session.error;

  if (session.isPending) {
    return (
      <main className="auth-shell">
        <p className="notice" role="status">
          正在检查登录状态…
        </p>
      </main>
    );
  }

  if (session.data) {
    return children(session.data, () => logout.mutate(), logout.isPending);
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero" aria-labelledby="auth-title">
        <p className="eyebrow">NGAPD · AI 原生敏捷协作</p>
        <h1 id="auth-title">让团队边界清晰，让每一次执行可追溯。</h1>
        <p className="summary">
          账号、项目与 Workspace 使用同一套服务端权限。登录后可管理个人资料、项目协作和本地设备。
        </p>
        <ul className="feature-list" aria-label="产品特点">
          <li>项目身份与权限由服务端统一判断</li>
          <li>本地 Workspace 保持设备侧安全边界</li>
          <li>关键变更包含版本、审计与恢复建议</li>
        </ul>
      </section>

      <form
        className="panel auth-form"
        onSubmit={submit}
        aria-describedby={auth.error ? errorId : undefined}
      >
        <div>
          <p className="eyebrow">开始使用</p>
          <h2>{mode === "register" ? "创建本地账号" : "登录 NGAPD"}</h2>
        </div>
        <div className="tabs" aria-label="账号操作">
          <button
            aria-pressed={mode === "register"}
            className={mode === "register" ? "tab tab--active" : "tab"}
            type="button"
            onClick={() => {
              setMode("register");
              loginInput.current?.focus();
            }}
          >
            注册
          </button>
          <button
            aria-pressed={mode === "login"}
            className={mode === "login" ? "tab tab--active" : "tab"}
            type="button"
            onClick={() => {
              setMode("login");
              loginInput.current?.focus();
            }}
          >
            登录
          </button>
        </div>
        <label htmlFor={loginId}>
          登录名
          <input
            id={loginId}
            ref={loginInput}
            autoComplete="username"
            minLength={3}
            required
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
          />
          <span className="field-help">3–80 个字母、数字、点、下划线或连字符。</span>
        </label>
        <label htmlFor={passwordId}>
          密码
          <input
            id={passwordId}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={12}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="field-help">至少 12 个字符；密码不会进入页面持久化状态。</span>
        </label>
        <button className="primary" disabled={auth.isPending} type="submit">
          {auth.isPending ? "处理中…" : mode === "register" ? "创建账号" : "登录"}
        </button>
        <ErrorNotice error={auth.error} focus id={errorId} />
        <ErrorNotice error={sessionError} id={errorId} />
      </form>
    </main>
  );
}
