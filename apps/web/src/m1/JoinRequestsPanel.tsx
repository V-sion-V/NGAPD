import type {
  MembershipJoinRequestCollection,
  MembershipJoinRequestItem,
  MembershipJoinRequestMutationResponse,
  ProjectDetail,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { m1QueryKeys, newIdempotencyKey } from "./model.js";

export function JoinRequestsPanel({
  userId,
  projectKey,
  detail,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
}) {
  const queryClient = useQueryClient();
  const intents = useRef(new Map<string, string>());
  const canReview = detail.project.actions.includes("review_join_request");
  const requests = useQuery({
    queryKey: m1QueryKeys.joinRequests(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<MembershipJoinRequestCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/join-requests`,
        { signal },
      ),
    enabled: canReview,
  });

  const resolveRequest = useMutation({
    mutationFn: async ({
      item,
      decision,
    }: {
      item: MembershipJoinRequestItem;
      decision: "approve" | "reject";
    }) => {
      const intentId = `${item.request.id}:${decision}`;
      const idempotencyKey = intents.current.get(intentId) ?? newIdempotencyKey();
      intents.current.set(intentId, idempotencyKey);
      const result = await apiRequest<MembershipJoinRequestMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/join-requests/${encodeURIComponent(
          item.request.id,
        )}/decision`,
        {
          method: "POST",
          json: {
            decision,
            expectedProjectVersion: detail.project.version,
            expectedMembershipVersion: item.membership.version,
            expectedRequestVersion: item.request.version,
            idempotencyKey,
          },
        },
      );
      intents.current.delete(intentId);
      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: m1QueryKeys.joinRequests(userId, projectKey),
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
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
  });

  if (!canReview) {
    return null;
  }

  return (
    <section className="panel" aria-labelledby="join-requests-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Owner review</p>
          <h3 id="join-requests-title">加入申请</h3>
        </div>
        <span className="status-badge">
          {requests.data?.requests.filter((item) => item.request.status === "pending").length ?? 0}{" "}
          个待处理
        </span>
      </div>
      {requests.isPending ? (
        <p className="notice" role="status">
          正在读取申请…
        </p>
      ) : requests.data?.requests.length ? (
        <ul className="item-list governance-list">
          {requests.data.requests.map((item) => (
            <li className="item-card" key={item.request.id}>
              <div>
                <strong>{item.membership.displayName}</strong>
                <span>
                  {item.request.status === "pending"
                    ? "待审批"
                    : item.request.status === "approved"
                      ? "已批准"
                      : item.request.status === "rejected"
                        ? "已拒绝"
                        : "已失效"}{" "}
                  · 申请版本 {item.request.version}
                </span>
              </div>
              {item.request.status === "pending" && (
                <div className="actions">
                  <DangerousAction
                    confirmLabel="拒绝申请"
                    consequences={[
                      "申请记录与 Membership 会保留，Membership 状态变为已移除。",
                      "申请人之后仍可用同一 Membership 重新申请。",
                    ]}
                    currentState={`待审批，申请版本 ${item.request.version}，成员版本 ${item.membership.version}`}
                    onConfirm={() =>
                      resolveRequest.mutateAsync({ item, decision: "reject" }).then(() => undefined)
                    }
                    target={`${item.membership.displayName} 加入 ${projectKey} 的申请`}
                    title="拒绝加入申请？"
                    triggerLabel="拒绝"
                  />
                  <DangerousAction
                    confirmLabel="批准加入"
                    consequences={[
                      "Membership 将变为活动成员。",
                      "首次加入会复制此刻的个人默认介绍和系统模板绑定；重新加入保留原项目资料。",
                    ]}
                    currentState={`待审批，申请版本 ${item.request.version}，成员版本 ${item.membership.version}`}
                    danger={false}
                    onConfirm={() =>
                      resolveRequest
                        .mutateAsync({ item, decision: "approve" })
                        .then(() => undefined)
                    }
                    target={`${item.membership.displayName} 加入 ${projectKey} 的申请`}
                    title="批准加入申请？"
                    triggerLabel="批准"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">暂无加入申请。</p>
      )}
      <ErrorNotice error={requests.error ?? resolveRequest.error} focus />
    </section>
  );
}
