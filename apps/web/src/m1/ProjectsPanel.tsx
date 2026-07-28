import type {
  MembershipJoinRequestMutationResponse,
  ProjectCollection,
  ProjectJoinTarget,
  ProjectMutationResponse,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { m1QueryKeys, newIdempotencyKey, type CurrentProjectIdentity } from "./model.js";
import { ProjectGovernance } from "./ProjectGovernance.js";

export function ProjectsPanel({
  userId,
  selectedProjectKey,
  onSelectProject,
  onProjectIdentity,
}: {
  userId: string;
  selectedProjectKey: string | null;
  onSelectProject: (projectKey: string | null) => void;
  onProjectIdentity: (project: CurrentProjectIdentity | null) => void;
}) {
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: m1QueryKeys.projects(userId),
    queryFn: ({ signal }) => apiRequest<ProjectCollection>("/api/v1/projects", { signal }),
  });

  useEffect(() => {
    if (!selectedProjectKey && projects.data?.projects.length && projects.data.projects[0]) {
      onSelectProject(projects.data.projects[0].key);
    }
  }, [onSelectProject, projects.data?.projects, selectedProjectKey]);

  return (
    <div className="content-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Project spaces</p>
          <h2>项目</h2>
        </div>
        <p>创建协作空间，或用精确 Project Key 申请加入。系统不提供项目目录。</p>
      </header>

      <div className="project-entry-grid">
        <CreateProjectForm
          userId={userId}
          onCreated={(projectKey) => onSelectProject(projectKey)}
        />
        <JoinProjectForm userId={userId} />
      </div>

      <section className="panel" aria-labelledby="project-list-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Your projects</p>
            <h3 id="project-list-title">我的项目</h3>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: m1QueryKeys.projects(userId),
              })
            }
          >
            刷新
          </button>
        </div>
        {projects.isPending ? (
          <p className="notice" role="status">
            正在读取项目…
          </p>
        ) : projects.data?.projects.length ? (
          <ul className="project-list">
            {projects.data.projects.map((project) => (
              <li key={project.id}>
                <button
                  aria-current={selectedProjectKey === project.key ? "page" : undefined}
                  className={
                    selectedProjectKey === project.key
                      ? "project-row project-row--active"
                      : "project-row"
                  }
                  type="button"
                  onClick={() => onSelectProject(project.key)}
                >
                  <span className="project-key">{project.key}</span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.description || "暂无项目说明"}</small>
                  </span>
                  <span className="status-badge">
                    {project.lifecycle === "active" ? "活动" : "已归档"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">你还没有可访问的项目。</p>
        )}
        <ErrorNotice error={projects.error} focus />
      </section>

      {selectedProjectKey && (
        <ProjectGovernance
          projectKey={selectedProjectKey}
          userId={userId}
          onIdentity={onProjectIdentity}
        />
      )}
    </div>
  );
}

function CreateProjectForm({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (projectKey: string) => void;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const keyId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const create = useMutation({
    mutationFn: () =>
      apiRequest<ProjectMutationResponse>("/api/v1/projects", {
        method: "POST",
        json: {
          key,
          name,
          description,
          completedSuccessorReopenPolicy: "deny",
          idempotencyKey,
        },
      }),
    onSuccess: async (result) => {
      setIdempotencyKey(newIdempotencyKey());
      setKey("");
      setName("");
      setDescription("");
      await queryClient.invalidateQueries({
        queryKey: m1QueryKeys.projects(userId),
      });
      onCreated(result.project.key);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <form
      className="panel form-grid"
      onSubmit={submit}
      aria-describedby={create.error ? errorId : undefined}
    >
      <div>
        <p className="eyebrow">Create</p>
        <h3>创建项目</h3>
      </div>
      <label htmlFor={keyId}>
        Project Key
        <input
          id={keyId}
          maxLength={6}
          minLength={2}
          pattern="[A-Z]{2,6}"
          placeholder="GAME"
          required
          value={key}
          onChange={(event) => setKey(event.target.value.toUpperCase())}
        />
        <span className="field-help">2–6 个大写字母；创建后不可修改。</span>
      </label>
      <label htmlFor={nameId}>
        项目名称
        <input
          id={nameId}
          maxLength={160}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label htmlFor={descriptionId}>
        项目说明（可选）
        <textarea
          id={descriptionId}
          maxLength={8_000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button className="primary" disabled={create.isPending} type="submit">
        {create.isPending ? "创建中…" : "创建项目"}
      </button>
      <ErrorNotice error={create.error} focus id={errorId} />
    </form>
  );
}

function JoinProjectForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [searchedKey, setSearchedKey] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const inputId = useId();
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const target = useQuery({
    queryKey: m1QueryKeys.joinTarget(userId, searchedKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectJoinTarget>(
        `/api/v1/projects/${encodeURIComponent(searchedKey)}/join-target`,
        { signal },
      ),
    enabled: Boolean(searchedKey),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () =>
      apiRequest<MembershipJoinRequestMutationResponse>("/api/v1/membership-join-requests", {
        method: "POST",
        json: { projectKey: searchedKey, idempotencyKey },
      }),
    onSuccess: async () => {
      setIdempotencyKey(newIdempotencyKey());
      await queryClient.invalidateQueries({
        queryKey: m1QueryKeys.projects(userId),
      });
      resultHeading.current?.focus();
    },
  });

  const search = (event: FormEvent) => {
    event.preventDefault();
    setSearchedKey(key);
  };

  return (
    <section className="panel form-grid" aria-labelledby="join-title">
      <div>
        <p className="eyebrow">Join</p>
        <h3 id="join-title">申请加入项目</h3>
      </div>
      <form className="inline-form" onSubmit={search}>
        <label htmlFor={inputId}>
          精确 Project Key
          <input
            id={inputId}
            maxLength={6}
            minLength={2}
            pattern="[A-Z]{2,6}"
            placeholder="GAME"
            required
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase())}
          />
        </label>
        <button className="secondary" type="submit">
          核对项目
        </button>
      </form>
      {target.isFetching && (
        <p className="notice" role="status">
          正在核对精确 Key…
        </p>
      )}
      {target.data && (
        <div className="join-target">
          <h4 ref={resultHeading} tabIndex={-1}>
            {target.data.name}
          </h4>
          <p>
            Key：{target.data.key} ·{" "}
            {target.data.acceptsJoinRequests ? "当前接受申请" : "当前不接受申请"}
          </p>
          <button
            className="primary"
            disabled={!target.data.acceptsJoinRequests || join.isPending}
            type="button"
            onClick={() => join.mutate()}
          >
            {join.isPending ? "提交中…" : "提交加入申请"}
          </button>
        </div>
      )}
      {join.isSuccess && (
        <p className="success" role="status">
          申请已提交。审批前你不会获得项目详情访问权限。
        </p>
      )}
      <ErrorNotice error={target.error ?? join.error} focus />
    </section>
  );
}
