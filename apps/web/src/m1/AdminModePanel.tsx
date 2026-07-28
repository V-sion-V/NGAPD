import type { AdminModeMutationResponse, AdminModeResource, ProjectDetail } from "@ngapd/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { m1QueryKeys, newIdempotencyKey, remainingMinutes } from "./model.js";

export function AdminModePanel({
  userId,
  projectKey,
  detail,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
}) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const current = detail.adminMode;
  const isActive =
    current?.status === "active" && new Date(current.expiresAt).getTime() > now.getTime();
  const eligible =
    detail.currentMembership.status === "active" &&
    (detail.project.ownerMembershipId === detail.currentMembership.id ||
      detail.currentMembership.permissionLevel === "admin") &&
    detail.project.lifecycle === "active";

  useEffect(() => {
    if (!current || current.status !== "active") {
      return;
    }
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [current?.id, current?.status]);

  const setAdminMode = (adminMode: AdminModeResource | null) => {
    queryClient.setQueryData<ProjectDetail>(m1QueryKeys.project(userId, projectKey), (existing) =>
      existing ? { ...existing, adminMode } : existing,
    );
  };
  const refreshProtectedActions = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.members(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.roles(userId, projectKey),
      }),
    ]);

  const open = useMutation({
    mutationFn: () =>
      apiRequest<AdminModeMutationResponse>("/api/v1/admin-mode/sessions", {
        method: "POST",
        json: {
          projectId: detail.project.id,
          expectedMembershipVersion: detail.currentMembership.version,
          idempotencyKey,
        },
      }),
    onSuccess: async (result) => {
      setIdempotencyKey(newIdempotencyKey());
      setNow(new Date());
      setAdminMode(result.adminMode);
      await refreshProtectedActions();
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
  });

  const close = useMutation({
    mutationFn: async () => {
      if (!current) {
        throw new Error("管理员模式状态尚未载入");
      }
      return apiRequest<AdminModeMutationResponse>(
        `/api/v1/admin-mode/sessions/${encodeURIComponent(current.id)}/close`,
        {
          method: "POST",
          json: { expectedVersion: current.version },
        },
      );
    },
    onSuccess: async (result) => {
      setAdminMode(result.adminMode);
      await refreshProtectedActions();
    },
    onError: () => {
      setAdminMode(null);
      void queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      });
    },
  });

  return (
    <section
      className={isActive ? "admin-mode admin-mode--active" : "admin-mode"}
      aria-labelledby="admin-mode-title"
    >
      <div>
        <p className="eyebrow">Scoped capability</p>
        <h3 id="admin-mode-title">管理员模式</h3>
      </div>
      {isActive && current ? (
        <>
          <div className="admin-mode-status" role="status">
            <span aria-hidden="true">◆</span>
            <div>
              <strong>已开启 · 仅限项目 {projectKey}</strong>
              <span>
                约 {remainingMinutes(current.expiresAt, now)} 分钟后过期；普通读取不会续期
              </span>
            </div>
          </div>
          <DangerousAction
            confirmLabel="关闭管理员模式"
            consequences={[
              "当前项目的受保护角色和他人资料操作将立即失去能力。",
              "再次管理时必须显式重新开启；普通成员自助和 Owner 专属操作不受影响。",
            ]}
            currentState={`活动，版本 ${current.version}，到期 ${new Date(
              current.expiresAt,
            ).toLocaleString("zh-CN")}`}
            danger={false}
            onConfirm={() => close.mutateAsync().then(() => undefined)}
            target={`项目 ${projectKey} 的当前 Web 会话`}
            title="关闭管理员模式？"
            triggerLabel="关闭模式"
          />
        </>
      ) : (
        <>
          <p className="notice">
            {current?.status === "expired" ||
            (current?.status === "active" && new Date(current.expiresAt).getTime() <= now.getTime())
              ? "管理员模式已过期。旧能力不会续用。"
              : current?.status === "revoked"
                ? "管理员模式已因资格或项目状态变化而撤销。"
                : "当前为普通模式。角色管理和编辑他人资料需要显式开启。"}
          </p>
          <DangerousAction
            confirmLabel="开启管理员模式"
            consequences={[
              "能力仅绑定当前 Web 会话、当前 Membership 与当前项目。",
              "普通读取不会续期；最后一次成功受保护操作后 30 分钟无操作即过期。",
              "该能力只允许计划内的角色管理和编辑他人资料，不能替代 Owner 专属操作。",
            ]}
            currentState={`普通模式；成员版本 ${detail.currentMembership.version}`}
            danger={false}
            disabled={!eligible || open.isPending}
            onConfirm={() => open.mutateAsync().then(() => undefined)}
            target={`当前 Web 会话在项目 ${projectKey} 的管理能力`}
            title="开启当前项目管理员模式？"
            triggerLabel="为当前项目开启管理员模式"
          />
          {!eligible && (
            <p className="field-help">仅活动 Project Owner 或 Admin 可为活动项目开启。</p>
          )}
        </>
      )}
      <ErrorNotice error={open.error ?? close.error} focus />
    </section>
  );
}
