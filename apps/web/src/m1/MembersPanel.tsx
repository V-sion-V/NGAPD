import type {
  MembershipCollection,
  MembershipMutationResponse,
  MembershipRemovalPreview,
  ProjectDetail,
  ProjectLogicalRoleCollection,
  ProjectMembershipResource,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import {
  canChangeRoleBinding,
  membershipStatusLabel,
  m1QueryKeys,
  newIdempotencyKey,
} from "./model.js";

export function MembersPanel({
  userId,
  projectKey,
  detail,
  adminModeId,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
  adminModeId: string | null;
}) {
  const members = useQuery({
    queryKey: m1QueryKeys.members(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<MembershipCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members`,
        { signal },
      ),
  });
  const roles = useQuery({
    queryKey: m1QueryKeys.roles(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectLogicalRoleCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles`,
        { signal },
      ),
  });

  return (
    <section className="panel" aria-labelledby="members-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Membership</p>
          <h3 id="members-title">项目成员</h3>
        </div>
        <span className="status-badge">
          {members.data?.members.filter((member) => member.status === "active").length ?? 0}{" "}
          名活动成员
        </span>
      </div>
      {members.isPending || roles.isPending ? (
        <p className="notice" role="status">
          正在读取成员与角色…
        </p>
      ) : members.data?.members.length ? (
        <div className="member-grid">
          {members.data.members.map((member) => (
            <MemberCard
              adminModeId={adminModeId}
              currentMembershipId={detail.currentMembership.id}
              detail={detail}
              key={member.id}
              member={member}
              projectKey={projectKey}
              roles={roles.data?.roles ?? []}
              userId={userId}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无成员。</p>
      )}
      <ErrorNotice error={members.error ?? roles.error} focus />
    </section>
  );
}

function MemberCard({
  userId,
  projectKey,
  detail,
  member,
  roles,
  currentMembershipId,
  adminModeId,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
  member: ProjectMembershipResource;
  roles: ProjectLogicalRoleCollection["roles"];
  currentMembershipId: string;
  adminModeId: string | null;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [introduction, setIntroduction] = useState(member.introduction);
  const [roleIds, setRoleIds] = useState(member.roleIds);
  const [permissionIntent, setPermissionIntent] = useState(newIdempotencyKey);
  const [removalIntent, setRemovalIntent] = useState(newIdempotencyKey);
  const [preview, setPreview] = useState<MembershipRemovalPreview | null>(null);
  const introductionId = useId();
  const isSelf = member.id === currentMembershipId;
  const canEditSelf = isSelf && member.actions.includes("edit_self");
  const canEditOther = !isSelf && member.actions.includes("edit_other") && Boolean(adminModeId);
  const canEdit = canEditSelf || canEditOther;
  const isOwner = detail.project.ownerMembershipId === member.id;

  useEffect(() => {
    setIntroduction(member.introduction);
    setRoleIds(member.roleIds);
    setPreview(null);
  }, [member.introduction, member.roleIds, member.version]);

  const invalidateMemberState = async () => {
    await Promise.all([
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

  const saveProfile = useMutation({
    mutationFn: () =>
      apiRequest<MembershipMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(
          member.id,
        )}/profile`,
        {
          method: "PATCH",
          json: {
            introduction,
            roleIds,
            expectedVersion: member.version,
          },
          adminModeId: isSelf ? null : adminModeId,
        },
      ),
    onSuccess: async () => {
      setEditing(false);
      await invalidateMemberState();
    },
    onError: invalidateMemberState,
  });

  const changePermission = useMutation({
    mutationFn: async () => {
      const next = member.permissionLevel === "admin" ? ("member" as const) : ("admin" as const);
      const result = await apiRequest<MembershipMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(
          member.id,
        )}/permission`,
        {
          method: "POST",
          json: {
            permissionLevel: next,
            expectedProjectVersion: detail.project.version,
            expectedMembershipVersion: member.version,
            idempotencyKey: permissionIntent,
          },
        },
      );
      setPermissionIntent(newIdempotencyKey());
      return result;
    },
    onSuccess: invalidateMemberState,
    onError: invalidateMemberState,
  });

  const previewRemoval = useMutation({
    mutationFn: () =>
      apiRequest<MembershipRemovalPreview>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(
          member.id,
        )}/removal-preview`,
      ),
    onSuccess: setPreview,
    onError: invalidateMemberState,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!preview || !preview.canRemove) {
        throw new Error("当前影响预览不允许移除");
      }
      const result = await apiRequest<MembershipMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members/${encodeURIComponent(
          member.id,
        )}/remove`,
        {
          method: "POST",
          json: {
            expectedProjectVersion: preview.projectVersion,
            expectedMembershipVersion: preview.membershipVersion,
            confirmedBlockingTaskIds: [],
            idempotencyKey: removalIntent,
          },
        },
      );
      setRemovalIntent(newIdempotencyKey());
      return result;
    },
    onSuccess: async () => {
      setPreview(null);
      await invalidateMemberState();
    },
    onError: invalidateMemberState,
  });

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    saveProfile.mutate();
  };

  return (
    <article className="member-card">
      <header>
        <div>
          <strong>{member.displayName}</strong>
          <span>{membershipStatusLabel(member)}</span>
        </div>
        {isOwner && <span className="status-badge">唯一 Owner</span>}
      </header>

      <p className="member-introduction">{member.introduction || "尚未填写项目内介绍。"}</p>
      <div className="role-chip-list" aria-label={`${member.displayName} 的角色`}>
        {member.roleIds.length
          ? member.roleIds.map((roleId) => {
              const role = roles.find((candidate) => candidate.id === roleId);
              return (
                <span className="role-chip" key={roleId}>
                  {role?.name ?? "历史角色"} · {role?.status === "archived" ? "已归档" : "活动"}
                </span>
              );
            })
          : "未绑定逻辑角色"}
      </div>

      {editing && canEdit && (
        <form className="member-editor" onSubmit={submitProfile}>
          {!isSelf && (
            <div className="action-context">
              <strong>管理员模式受保护操作</strong>
              <span>目标：{member.displayName} 的项目内资料。</span>
              <span>
                当前状态：{membershipStatusLabel(member)}，版本 {member.version}。
              </span>
              <span>后果：项目介绍与逻辑角色绑定更新；个人默认资料和权限资格不变。</span>
            </div>
          )}
          <label htmlFor={introductionId}>
            项目内介绍
            <textarea
              id={introductionId}
              maxLength={4_000}
              rows={4}
              value={introduction}
              onChange={(event) => setIntroduction(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>逻辑角色绑定</legend>
            <p className="field-help">角色只描述能力，不改变 Web、Workspace 或管理员权限。</p>
            <div className="checkbox-grid checkbox-grid--compact">
              {roles.map((role) => {
                const checked = roleIds.includes(role.id);
                return (
                  <label className="check-card" key={role.id}>
                    <input
                      checked={checked}
                      disabled={!canChangeRoleBinding(role, checked, canEdit)}
                      type="checkbox"
                      onChange={(event) =>
                        setRoleIds((current) =>
                          event.target.checked
                            ? [...current, role.id]
                            : current.filter((id) => id !== role.id),
                        )
                      }
                    />
                    <span>
                      <strong>{role.name}</strong>
                      <small>
                        {role.status === "archived" ? "已归档，仅保留历史绑定" : "活动"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="actions">
            <button className="secondary" type="button" onClick={() => setEditing(false)}>
              取消
            </button>
            <button className="primary" disabled={saveProfile.isPending} type="submit">
              {saveProfile.isPending ? "保存中…" : "保存成员资料"}
            </button>
          </div>
        </form>
      )}

      <div className="member-actions">
        {(canEdit || (!isSelf && member.actions.includes("edit_other"))) && (
          <button
            className="secondary compact"
            disabled={!canEdit}
            type="button"
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? "收起编辑" : isSelf ? "编辑我的项目资料" : "编辑成员资料"}
          </button>
        )}
        {!isSelf && member.actions.includes("edit_other") && !adminModeId && (
          <span className="field-help">编辑他人资料需要当前项目管理员模式。</span>
        )}

        {(member.actions.includes("grant_admin") || member.actions.includes("revoke_admin")) && (
          <DangerousAction
            confirmLabel={member.permissionLevel === "admin" ? "撤销 Admin" : "任命 Admin"}
            consequences={
              member.permissionLevel === "admin"
                ? [
                    "成员将降为普通 Member。",
                    "该成员当前项目的管理员模式与项目 Workspace 写资格会立即失效。",
                  ]
                : [
                    "成员获得 Project Admin 资格，但不会自动开启管理员模式。",
                    "Owner 专属操作仍不可由 Admin 执行。",
                  ]
            }
            currentState={`${membershipStatusLabel(member)}，版本 ${member.version}`}
            danger={member.permissionLevel === "admin"}
            onConfirm={() => changePermission.mutateAsync().then(() => undefined)}
            target={`${member.displayName} 在项目 ${projectKey} 的权限资格`}
            title={
              member.permissionLevel === "admin" ? "撤销 Project Admin？" : "任命 Project Admin？"
            }
            triggerLabel={member.permissionLevel === "admin" ? "撤销 Admin" : "任命 Admin"}
          />
        )}

        {member.actions.includes("remove") && (
          <div className="removal-flow">
            <button
              className="secondary compact"
              disabled={previewRemoval.isPending}
              type="button"
              onClick={() => previewRemoval.mutate()}
            >
              {previewRemoval.isPending ? "检查中…" : "检查移除影响"}
            </button>
            {preview && (
              <div
                className={
                  preview.canRemove ? "impact-preview" : "impact-preview impact-preview--blocked"
                }
              >
                <strong>{preview.canRemove ? "可以移除" : "移除被任务阻塞"}</strong>
                {preview.blockingTasks.length ? (
                  <p>
                    启用态未完成 Task：
                    {preview.blockingTasks.map((task) => task.key).join("、")}
                  </p>
                ) : (
                  <p>没有启用态未完成 Task 由该成员有效拥有。</p>
                )}
                {preview.canRemove && (
                  <DangerousAction
                    confirmLabel="确认移除成员"
                    consequences={[
                      "Membership 将保留并变为“已移除 · Member”。",
                      "项目介绍、角色绑定、审计和全部历史 Task Owner 引用保持不变。",
                      "成员将立即失去项目访问；相关租约和管理员能力会被撤销。",
                    ]}
                    currentState={`${membershipStatusLabel(member)}；影响预览项目版本 ${preview.projectVersion}、成员版本 ${preview.membershipVersion}`}
                    onConfirm={() => remove.mutateAsync().then(() => undefined)}
                    target={`${member.displayName} 在项目 ${projectKey} 的 Membership`}
                    title="移除项目成员？"
                    triggerLabel="继续移除"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ErrorNotice
        error={saveProfile.error ?? changePermission.error ?? previewRemoval.error ?? remove.error}
        focus
      />
    </article>
  );
}
