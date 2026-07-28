import type { SystemLogicalRoleTemplateCollection, UserProfile } from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { firstVisibleGrapheme, m1QueryKeys } from "./model.js";

export function ProfilePanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const displayNameId = useId();
  const introductionId = useId();
  const errorId = useId();
  const profile = useQuery({
    queryKey: m1QueryKeys.profile(userId),
    queryFn: ({ signal }) => apiRequest<UserProfile>("/api/v1/users/me/profile", { signal }),
  });
  const templates = useQuery({
    queryKey: m1QueryKeys.templates(userId),
    queryFn: ({ signal }) =>
      apiRequest<SystemLogicalRoleTemplateCollection>("/api/v1/system/logical-role-templates", {
        signal,
      }),
  });
  const [displayName, setDisplayName] = useState("");
  const [defaultIntroduction, setDefaultIntroduction] = useState("");
  const [templateIds, setTemplateIds] = useState<string[]>([]);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.displayName);
      setDefaultIntroduction(profile.data.defaultIntroduction);
      setTemplateIds(profile.data.defaultRoleTemplateIds);
    }
  }, [profile.data?.version]);

  const update = useMutation({
    mutationFn: () => {
      if (!profile.data) {
        throw new Error("个人资料尚未载入");
      }
      return apiRequest<UserProfile>("/api/v1/users/me/profile", {
        method: "PATCH",
        json: {
          displayName,
          defaultIntroduction,
          defaultRoleTemplateIds: templateIds,
          expectedVersion: profile.data.version,
        },
      });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(m1QueryKeys.profile(userId), next);
    },
    onError: () => queryClient.invalidateQueries({ queryKey: m1QueryKeys.profile(userId) }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate();
  };

  if (profile.isPending || templates.isPending) {
    return (
      <p className="notice" role="status">
        正在读取个人资料…
      </p>
    );
  }

  return (
    <div className="content-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Personal defaults</p>
          <h2>个人资料</h2>
        </div>
        <p>默认介绍和角色只在首次加入项目时复制。项目内资料之后独立维护。</p>
      </header>

      <form
        className="panel profile-layout"
        onSubmit={submit}
        aria-describedby={update.error ? errorId : undefined}
      >
        <aside className="profile-preview" aria-label="头像占位符预览">
          <span className="avatar avatar--large" aria-hidden="true">
            {firstVisibleGrapheme(displayName)}
          </span>
          <strong>{displayName || "未命名用户"}</strong>
          <span className="sr-only">{displayName || "当前用户"}的头像占位符</span>
          <p>头像由显示名的首个可显示 Unicode 字素生成，不会上传图片。</p>
        </aside>

        <div className="form-grid">
          <label htmlFor={displayNameId}>
            显示名
            <input
              id={displayNameId}
              maxLength={80}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label htmlFor={introductionId}>
            默认自我介绍
            <textarea
              id={introductionId}
              maxLength={4_000}
              rows={6}
              value={defaultIntroduction}
              onChange={(event) => setDefaultIntroduction(event.target.value)}
            />
            <span className="field-help">按不可信纯文本安全显示；最多 4,000 字符。</span>
          </label>

          <fieldset className="role-picker">
            <legend>默认系统角色模板</legend>
            <p className="field-help">可选择多个；这些内容描述能力，但不会授予项目权限。</p>
            <div className="checkbox-grid">
              {templates.data?.templates.map((template) => (
                <label className="check-card" key={template.id}>
                  <input
                    checked={templateIds.includes(template.id)}
                    type="checkbox"
                    onChange={(event) =>
                      setTemplateIds((current) =>
                        event.target.checked
                          ? [...current, template.id]
                          : current.filter((id) => id !== template.id),
                      )
                    }
                  />
                  <span>
                    <strong>{template.title}</strong>
                    <small>{template.desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-actions">
            <button className="primary" disabled={update.isPending || !profile.data} type="submit">
              {update.isPending ? "保存中…" : "保存个人资料"}
            </button>
            {profile.data && <span className="version-note">资料版本 {profile.data.version}</span>}
          </div>
          <ErrorNotice
            error={profile.error ?? templates.error ?? update.error}
            focus
            id={errorId}
          />
        </div>
      </form>
    </div>
  );
}
