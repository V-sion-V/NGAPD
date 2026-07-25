import { Type, type Static } from "@sinclair/typebox";

export const Sha256Schema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: "^[0-9a-f]{64}$",
});

export const WorkspaceScopeSchema = Type.Union([
  Type.Literal("user"),
  Type.Literal("project"),
  Type.Literal("task"),
]);

export const WorkspaceLifecycleSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
  Type.Literal("deleted"),
]);

export const WorkspaceMetadataSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    scopeType: WorkspaceScopeSchema,
    scopeId: Type.String({ format: "uuid" }),
    lifecycle: WorkspaceLifecycleSchema,
    workCycle: Type.Integer({ minimum: 1 }),
    syncVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const WorkspaceManifestEntrySchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 1024 }),
    kind: Type.Literal("file"),
    size: Type.Integer({ minimum: 0 }),
    sha256: Sha256Schema,
  },
  { additionalProperties: false },
);

export const WorkspaceManifestSchema = Type.Object(
  {
    hash: Sha256Schema,
    entries: Type.Array(WorkspaceManifestEntrySchema, { maxItems: 2_000 }),
  },
  { additionalProperties: false },
);

export const WorkspaceVersionSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    syncVersion: Type.Integer({ minimum: 0 }),
    manifest: WorkspaceManifestSchema,
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const WorkspaceMetadataResponseSchema = Type.Object(
  {
    workspace: WorkspaceMetadataSchema,
    currentVersion: WorkspaceVersionSchema,
  },
  { additionalProperties: false },
);

export const WorkspaceLeaseStateSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("expired"),
  Type.Literal("released"),
  Type.Literal("taken_over"),
  Type.Literal("invalidated"),
]);

export const WorkspaceLeaseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    workspaceId: Type.String({ format: "uuid" }),
    workCycle: Type.Integer({ minimum: 1 }),
    userId: Type.String({ format: "uuid" }),
    deviceId: Type.String({ format: "uuid" }),
    connectionId: Type.String({ format: "uuid" }),
    baseSyncVersion: Type.Integer({ minimum: 0 }),
    issuedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
    state: WorkspaceLeaseStateSchema,
  },
  { additionalProperties: false },
);

export const WorkspaceLeaseGrantSchema = Type.Object(
  {
    lease: WorkspaceLeaseSchema,
    leaseToken: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const AcquireWorkspaceLeaseRequestSchema = Type.Object(
  {
    connectionId: Type.String({ format: "uuid" }),
    baseSyncVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const RenewWorkspaceLeaseRequestSchema = Type.Object(
  {
    leaseId: Type.String({ format: "uuid" }),
    connectionId: Type.String({ format: "uuid" }),
    leaseToken: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const ReleaseWorkspaceLeaseRequestSchema = RenewWorkspaceLeaseRequestSchema;

export const TakeoverWorkspaceLeaseRequestSchema = Type.Object(
  {
    connectionId: Type.String({ format: "uuid" }),
    confirmed: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const WorkspaceObjectSchema = Type.Object(
  {
    sha256: Sha256Schema,
    size: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const CommitWorkspaceRequestSchema = Type.Object(
  {
    leaseId: Type.String({ format: "uuid" }),
    connectionId: Type.String({ format: "uuid" }),
    leaseToken: Type.String({ minLength: 32, maxLength: 256 }),
    baseSyncVersion: Type.Integer({ minimum: 0 }),
    idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
    manifest: WorkspaceManifestSchema,
  },
  { additionalProperties: false },
);

export const CommitWorkspaceResponseSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    syncVersion: Type.Integer({ minimum: 1 }),
    manifestHash: Sha256Schema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const UseLocalConflictRequestSchema = Type.Object(
  {
    choice: Type.Literal("use_local"),
    leaseId: Type.String({ format: "uuid" }),
    connectionId: Type.String({ format: "uuid" }),
    leaseToken: Type.String({ minLength: 32, maxLength: 256 }),
    baseSyncVersion: Type.Integer({ minimum: 0 }),
    idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
    manifest: WorkspaceManifestSchema,
  },
  { additionalProperties: false },
);

export const UseServerConflictRequestSchema = Type.Object(
  {
    choice: Type.Literal("use_server"),
    leaseId: Type.String({ format: "uuid" }),
    connectionId: Type.String({ format: "uuid" }),
    leaseToken: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const ResolveWorkspaceConflictRequestSchema = Type.Union([
  UseLocalConflictRequestSchema,
  UseServerConflictRequestSchema,
]);

export const ResolveWorkspaceConflictResponseSchema = Type.Object(
  {
    choice: Type.Union([Type.Literal("use_local"), Type.Literal("use_server")]),
    authoritativeVersion: WorkspaceVersionSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const WorkspaceIdParamsSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const WorkspaceObjectParamsSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    sha256: Sha256Schema,
  },
  { additionalProperties: false },
);

export const WorkspaceVersionParamsSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    syncVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type WorkspaceScope = Static<typeof WorkspaceScopeSchema>;
export type WorkspaceLifecycle = Static<typeof WorkspaceLifecycleSchema>;
export type WorkspaceMetadata = Static<typeof WorkspaceMetadataSchema>;
export type WorkspaceManifestEntry = Static<typeof WorkspaceManifestEntrySchema>;
export type WorkspaceManifest = Static<typeof WorkspaceManifestSchema>;
export type WorkspaceVersion = Static<typeof WorkspaceVersionSchema>;
export type WorkspaceLease = Static<typeof WorkspaceLeaseSchema>;
export type WorkspaceLeaseGrant = Static<typeof WorkspaceLeaseGrantSchema>;
export type AcquireWorkspaceLeaseRequest = Static<typeof AcquireWorkspaceLeaseRequestSchema>;
export type RenewWorkspaceLeaseRequest = Static<typeof RenewWorkspaceLeaseRequestSchema>;
export type ReleaseWorkspaceLeaseRequest = Static<typeof ReleaseWorkspaceLeaseRequestSchema>;
export type TakeoverWorkspaceLeaseRequest = Static<typeof TakeoverWorkspaceLeaseRequestSchema>;
export type CommitWorkspaceRequest = Static<typeof CommitWorkspaceRequestSchema>;
export type CommitWorkspaceResponse = Static<typeof CommitWorkspaceResponseSchema>;
export type ResolveWorkspaceConflictRequest = Static<typeof ResolveWorkspaceConflictRequestSchema>;
export type ResolveWorkspaceConflictResponse = Static<
  typeof ResolveWorkspaceConflictResponseSchema
>;
