import type {
  MembershipCollection,
  OwnershipTransferCollection,
  OwnershipTransferMutationResponse,
  OwnershipTransferResource,
  ProjectDetail,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { m1QueryKeys, newIdempotencyKey } from "./model.js";

export function OwnershipPanel({
  userId,
  projectKey,
  detail,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
}) {
  const queryClient = useQueryClient();
  const [targetMembershipId, setTargetMembershipId] = useState("");
  const [createIntent, setCreateIntent] = useState(newIdempotencyKey);
  const resolveIntents = useRef(new Map<string, string>());
  const targetId = useId();
  const transfers = useQuery({
    queryKey: m1QueryKeys.transfers(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<OwnershipTransferCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/ownership-transfers`,
        { signal },
      ),
  });
  const members = useQuery({
    queryKey: m1QueryKeys.members(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<MembershipCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members`,
        { signal },
      ),
  });
  const canCreate = detail.project.actions.includes("transfer_ownership");
  const eligibleTargets =
    members.data?.members.filter(
      (member) => member.status === "active" && member.id !== detail.project.ownerMembershipId,
    ) ?? [];
  const selectedTarget = eligibleTargets.find((member) => member.id === targetMembershipId);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.transfers(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.members(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.projects(userId),
      }),
    ]);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedTarget) {
        throw new Error("请选择活动目标成员");
      }
      const result = await apiRequest<OwnershipTransferMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/ownership-transfers`,
        {
          method: "POST",
          json: {
            targetMembershipId: selectedTarget.id,
            expectedProjectVersion: detail.project.version,
            expectedTargetMembershipVersion: selectedTarget.version,
            idempotencyKey: createIntent,
          },
        },
      );
      setCreateIntent(newIdempotencyKey());
      return result;
    },
    onSuccess: async () => {
      setTargetMembershipId("");
      await invalidate();
    },
    onError: invalidate,
  });

  const resolve = useMutation({
    mutationFn: async ({
      transfer,
      action,
    }: {
      transfer: OwnershipTransferResource;
      action: "accept" | "reject" | "cancel";
    }) => {
      const intentId = `${transfer.id}:${action}`;
      const idempotencyKey = resolveIntents.current.get(intentId) ?? newIdempotencyKey();
      resolveIntents.current.set(intentId, idempotencyKey);
      const result = await apiRequest<OwnershipTransferMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/ownership-transfers/${encodeURIComponent(
          transfer.id,
        )}/resolve`,
        {
          method: "POST",
          json: {
            action,
            expectedProjectVersion: detail.project.version,
            expectedTransferVersion: transfer.version,
            idempotencyKey,
          },
        },
      );
      resolveIntents.current.delete(intentId);
      return result;
    },
    onSuccess: invalidate,
    onError: invalidate,
  });

  return (
    <section className="panel" aria-labelledby="ownership-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Single owner</p>
          <h3 id="ownership-title">所有权转移</h3>
        </div>
        <span className="status-badge">项目始终恰有一个活动 Owner</span>
      </div>

      {canCreate && (
        <div className="inline-form">
          <label htmlFor={targetId}>
            转移目标
            <select
              id={targetId}
              required
              value={targetMembershipId}
              onChange={(event) => setTargetMembershipId(event.target.value)}
            >
              <option value="">选择活动成员</option>
              {eligibleTargets.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName} · {member.permissionLevel === "admin" ? "Admin" : "Member"}
                </option>
              ))}
            </select>
          </label>
          <DangerousAction
            confirmLabel="创建转移请求"
            consequences={[
              "项目 Owner 在目标成员接受前不会变化。",
              "同一项目只能有一个待处理请求；目标可接受或拒绝，当前 Owner 可取消。",
              "目标接受时双方 Admin/Member 权限值保持不变。",
            ]}
            currentState={`当前 Owner：${detail.currentMembership.displayName}；项目版本 ${detail.project.version}`}
            danger={false}
            disabled={!selectedTarget || create.isPending}
            onConfirm={() => create.mutateAsync().then(() => undefined)}
            target={`${selectedTarget?.displayName ?? "未选择成员"} 成为项目 ${projectKey} 的 Owner`}
            title="发起所有权转移？"
            triggerLabel="发起转移请求"
          />
        </div>
      )}

      {transfers.isPending || members.isPending ? (
        <p className="notice" role="status">
          正在读取所有权请求…
        </p>
      ) : transfers.data?.transfers.length ? (
        <ul className="item-list governance-list">
          {transfers.data.transfers.map((transfer) => {
            const target = members.data?.members.find(
              (member) => member.id === transfer.targetMembershipId,
            );
            return (
              <li className="item-card" key={transfer.id}>
                <div>
                  <strong>目标：{target?.displayName ?? transfer.targetMembershipId}</strong>
                  <span>
                    {transfer.status === "pending"
                      ? "待目标成员决定"
                      : transfer.status === "accepted"
                        ? "已接受"
                        : transfer.status === "rejected"
                          ? "已拒绝"
                          : transfer.status === "cancelled"
                            ? "已取消"
                            : "已失效"}{" "}
                    · 版本 {transfer.version}
                  </span>
                </div>
                {transfer.status === "pending" && (
                  <div className="actions">
                    {transfer.actions.includes("cancel") && (
                      <DangerousAction
                        confirmLabel="取消请求"
                        consequences={[
                          "当前转移请求将结束。",
                          "Project Owner 不变；如需转移必须创建新请求。",
                        ]}
                        currentState={`待处理，版本 ${transfer.version}`}
                        onConfirm={() =>
                          resolve.mutateAsync({ transfer, action: "cancel" }).then(() => undefined)
                        }
                        target={`转移给 ${target?.displayName ?? "目标成员"} 的请求`}
                        title="取消所有权转移？"
                        triggerLabel="取消"
                      />
                    )}
                    {transfer.actions.includes("reject") && (
                      <DangerousAction
                        confirmLabel="拒绝转移"
                        consequences={[
                          "当前转移请求将结束。",
                          "Project Owner 与双方 Admin/Member 权限值都保持不变。",
                        ]}
                        currentState={`待处理，版本 ${transfer.version}`}
                        onConfirm={() =>
                          resolve.mutateAsync({ transfer, action: "reject" }).then(() => undefined)
                        }
                        target={`项目 ${projectKey} 的 Owner 转移请求`}
                        title="拒绝成为 Project Owner？"
                        triggerLabel="拒绝"
                      />
                    )}
                    {transfer.actions.includes("accept") && (
                      <DangerousAction
                        confirmLabel="接受并成为 Owner"
                        consequences={[
                          "Project.owner_membership_id 将原子切换到你的 Membership。",
                          "双方原有 Admin/Member 权限值不变；旧 Owner 的专属能力立即失效。",
                          "相关 Workspace 租约和管理员能力会按新资格重算。",
                        ]}
                        currentState={`待处理，项目版本 ${detail.project.version}，请求版本 ${transfer.version}`}
                        danger={false}
                        onConfirm={() =>
                          resolve.mutateAsync({ transfer, action: "accept" }).then(() => undefined)
                        }
                        target={`项目 ${projectKey} 的唯一 Project Owner`}
                        title="接受所有权转移？"
                        triggerLabel="接受"
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">暂无所有权转移记录。</p>
      )}
      <ErrorNotice
        error={transfers.error ?? members.error ?? create.error ?? resolve.error}
        focus
      />
    </section>
  );
}
