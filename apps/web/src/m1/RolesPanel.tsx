import type {
  ProjectDetail,
  ProjectLogicalRoleCollection,
  ProjectLogicalRoleMutationResponse,
  ProjectLogicalRoleResource,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { m1QueryKeys, newIdempotencyKey } from "./model.js";

export function RolesPanel({
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
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: m1QueryKeys.roles(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectLogicalRoleCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles`,
        { signal },
      ),
  });
  const canManage = detail.project.actions.includes("manage_roles") && Boolean(adminModeId);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.roles(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.members(userId, projectKey),
      }),
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
    ]);
  };

  return (
    <section className="panel" aria-labelledby="roles-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Capability descriptions</p>
          <h3 id="roles-title">项目逻辑角色</h3>
        </div>
        <span className="status-badge">
          {roles.data?.roles.filter((role) => role.status === "active").length ?? 0} 个活动角色
        </span>
      </div>
      <p className="notice">
        名称与单一能力文本同时作为 Agent 提示，但永远不参与 Web、Workspace 或管理员授权。
      </p>

      {canManage && adminModeId && (
        <CreateRoleForm adminModeId={adminModeId} onChanged={invalidate} projectKey={projectKey} />
      )}
      {!canManage && detail.project.lifecycle === "active" && (
        <p className="field-help">
          查看角色无需管理员模式；创建、编辑、复制和归档需要当前项目的活动管理员模式。
        </p>
      )}

      {roles.isPending ? (
        <p className="notice" role="status">
          正在读取项目角色…
        </p>
      ) : roles.data?.roles.length ? (
        <div className="role-grid">
          {roles.data.roles.map((role) => (
            <RoleCard
              adminModeId={adminModeId}
              canManage={canManage}
              key={role.id}
              onChanged={invalidate}
              projectKey={projectKey}
              role={role}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无项目角色。</p>
      )}
      <ErrorNotice error={roles.error} focus />
    </section>
  );
}

function CreateRoleForm({
  projectKey,
  adminModeId,
  onChanged,
}: {
  projectKey: string;
  adminModeId: string;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [capability, setCapability] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const nameId = useId();
  const capabilityId = useId();
  const create = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<ProjectLogicalRoleMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles`,
        {
          method: "POST",
          json: { name, capability, idempotencyKey },
          adminModeId,
        },
      );
      setIdempotencyKey(newIdempotencyKey());
      return result;
    },
    onSuccess: async () => {
      setName("");
      setCapability("");
      await onChanged();
    },
    onError: onChanged,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <form className="role-create form-grid" onSubmit={submit}>
      <h4>创建自定义角色</h4>
      <label htmlFor={nameId}>
        角色名称
        <input
          id={nameId}
          maxLength={160}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label htmlFor={capabilityId}>
        能力范围 / Agent 提示
        <textarea
          id={capabilityId}
          maxLength={4_000}
          minLength={1}
          required
          rows={4}
          value={capability}
          onChange={(event) => setCapability(event.target.value)}
        />
      </label>
      <div className="action-context">
        <strong>受保护操作</strong>
        <span>目标：项目 {projectKey} 的角色目录。</span>
        <span>当前状态：管理员模式已开启。</span>
        <span>后果：创建一个独立活动角色；文本仅描述能力且不会授予权限。</span>
      </div>
      <button className="primary" disabled={create.isPending} type="submit">
        {create.isPending ? "创建中…" : "创建项目角色"}
      </button>
      <ErrorNotice error={create.error} focus />
    </form>
  );
}

function RoleCard({
  projectKey,
  adminModeId,
  canManage,
  role,
  onChanged,
}: {
  projectKey: string;
  adminModeId: string | null;
  canManage: boolean;
  role: ProjectLogicalRoleResource;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [capability, setCapability] = useState(role.capability);
  const [copyName, setCopyName] = useState(`${role.name} 副本`);
  const [copyIntent, setCopyIntent] = useState(newIdempotencyKey);
  const nameId = useId();
  const capabilityId = useId();
  const copyNameId = useId();

  useEffect(() => {
    setName(role.name);
    setCapability(role.capability);
    setCopyName(`${role.name} 副本`);
  }, [role.capability, role.name, role.version]);

  const update = useMutation({
    mutationFn: () => {
      if (!adminModeId) {
        throw new Error("当前项目管理员模式未开启");
      }
      return apiRequest<ProjectLogicalRoleMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles/${encodeURIComponent(role.id)}`,
        {
          method: "PATCH",
          json: { name, capability, expectedVersion: role.version },
          adminModeId,
        },
      );
    },
    onSuccess: async () => {
      setEditing(false);
      await onChanged();
    },
    onError: onChanged,
  });

  const copy = useMutation({
    mutationFn: async () => {
      if (!adminModeId) {
        throw new Error("当前项目管理员模式未开启");
      }
      const result = await apiRequest<ProjectLogicalRoleMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles/${encodeURIComponent(
          role.id,
        )}/copy`,
        {
          method: "POST",
          json: {
            name: copyName,
            expectedSourceVersion: role.version,
            idempotencyKey: copyIntent,
          },
          adminModeId,
        },
      );
      setCopyIntent(newIdempotencyKey());
      return result;
    },
    onSuccess: onChanged,
    onError: onChanged,
  });

  const archive = useMutation({
    mutationFn: () => {
      if (!adminModeId) {
        throw new Error("当前项目管理员模式未开启");
      }
      return apiRequest<ProjectLogicalRoleMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles/${encodeURIComponent(
          role.id,
        )}/archive`,
        {
          method: "POST",
          json: { expectedVersion: role.version },
          adminModeId,
        },
      );
    },
    onSuccess: onChanged,
    onError: onChanged,
  });

  const submitUpdate = (event: FormEvent) => {
    event.preventDefault();
    update.mutate();
  };

  const submitCopy = (event: FormEvent) => {
    event.preventDefault();
    copy.mutate();
  };

  return (
    <article className="role-card">
      <header>
        <div>
          <strong>{role.name}</strong>
          <span>
            {role.sourceTemplateId ? "系统模板快照" : "项目自定义"} ·{" "}
            {role.status === "active" ? "活动" : "已归档"}
          </span>
        </div>
        <span className="status-badge">
          {role.status === "active" ? "可绑定" : "仅保留历史绑定"}
        </span>
      </header>
      <p className="role-capability">{role.capability}</p>
      <span className="version-note">角色版本 {role.version}</span>

      {editing && canManage && (
        <form className="form-grid role-editor" onSubmit={submitUpdate}>
          <label htmlFor={nameId}>
            角色名称
            <input
              id={nameId}
              maxLength={160}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor={capabilityId}>
            能力范围 / Agent 提示
            <textarea
              id={capabilityId}
              maxLength={4_000}
              minLength={1}
              required
              rows={5}
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            />
          </label>
          <div className="action-context">
            <strong>受保护操作</strong>
            <span>目标：角色“{role.name}”。</span>
            <span>
              当前状态：{role.status === "active" ? "活动" : "已归档"}，版本 {role.version}。
            </span>
            <span>后果：名称和单一能力 / Agent 提示文本会同时更新；权限不变。</span>
          </div>
          <div className="actions">
            <button className="secondary" type="button" onClick={() => setEditing(false)}>
              取消
            </button>
            <button className="primary" disabled={update.isPending} type="submit">
              {update.isPending ? "保存中…" : "保存角色"}
            </button>
          </div>
        </form>
      )}

      {canManage && (
        <div className="role-actions">
          {role.actions.includes("edit") && (
            <button
              className="secondary compact"
              type="button"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? "收起编辑" : "编辑"}
            </button>
          )}
          {role.actions.includes("copy") && (
            <form className="inline-form copy-role" onSubmit={submitCopy}>
              <label htmlFor={copyNameId}>
                新副本名称
                <input
                  id={copyNameId}
                  maxLength={160}
                  required
                  value={copyName}
                  onChange={(event) => setCopyName(event.target.value)}
                />
              </label>
              <span className="field-help">
                目标：复制“{role.name}”；当前版本 {role.version}
                ；结果是新的独立活动角色，原角色不变。
              </span>
              <button className="secondary" disabled={copy.isPending} type="submit">
                {copy.isPending ? "复制中…" : "复制为活动角色"}
              </button>
            </form>
          )}
          {role.actions.includes("archive") && (
            <DangerousAction
              confirmLabel="归档角色"
              consequences={[
                "现有成员绑定和未来历史引用保持可读。",
                "该角色不能再新增绑定或编辑，也不能原地恢复。",
                "如需继续使用，请复制为新的活动角色。",
              ]}
              currentState={`活动，版本 ${role.version}`}
              onConfirm={() => archive.mutateAsync().then(() => undefined)}
              target={`${projectKey} 的角色“${role.name}”`}
              title="归档项目角色？"
              triggerLabel="归档"
            />
          )}
        </div>
      )}
      <ErrorNotice error={update.error ?? copy.error ?? archive.error} focus />
    </article>
  );
}
