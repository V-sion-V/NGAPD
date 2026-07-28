import { Type, type Static } from "@sinclair/typebox";

export const LogicalRoleNameSchema = Type.String({ minLength: 1, maxLength: 160 });
export const LogicalRoleCapabilitySchema = Type.String({ minLength: 1, maxLength: 4_000 });
export const ProjectLogicalRoleStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
]);

export const SystemLogicalRoleTemplateSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 160 }),
    title: Type.String({ minLength: 1, maxLength: 160 }),
    desc: Type.String({ minLength: 1, maxLength: 4_000 }),
  },
  { additionalProperties: false },
);

export const ProjectLogicalRoleActionSchema = Type.Union([
  Type.Literal("edit"),
  Type.Literal("copy"),
  Type.Literal("archive"),
  Type.Literal("bind"),
]);

export const ProjectLogicalRoleResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    sourceTemplateId: Type.Union([Type.String({ minLength: 1, maxLength: 160 }), Type.Null()]),
    name: LogicalRoleNameSchema,
    capability: LogicalRoleCapabilitySchema,
    status: ProjectLogicalRoleStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    actions: Type.Array(ProjectLogicalRoleActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const CreateProjectLogicalRoleRequestSchema = Type.Object(
  {
    name: LogicalRoleNameSchema,
    capability: LogicalRoleCapabilitySchema,
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const ProjectRoleParamsSchema = Type.Object(
  {
    projectKey: Type.String({ pattern: "^[A-Z]{2,6}$" }),
    roleId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const SystemLogicalRoleTemplateCollectionSchema = Type.Object(
  {
    templates: Type.Array(SystemLogicalRoleTemplateSchema),
  },
  { additionalProperties: false },
);

export const ProjectLogicalRoleCollectionSchema = Type.Object(
  {
    roles: Type.Array(ProjectLogicalRoleResourceSchema),
  },
  { additionalProperties: false },
);

export const ProjectLogicalRoleMutationResponseSchema = Type.Object(
  {
    role: ProjectLogicalRoleResourceSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const UpdateProjectLogicalRoleRequestSchema = Type.Object(
  {
    name: LogicalRoleNameSchema,
    capability: LogicalRoleCapabilitySchema,
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const CopyProjectLogicalRoleRequestSchema = Type.Object(
  {
    name: LogicalRoleNameSchema,
    expectedSourceVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const ArchiveProjectLogicalRoleRequestSchema = Type.Object(
  {
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type LogicalRoleName = Static<typeof LogicalRoleNameSchema>;
export type LogicalRoleCapability = Static<typeof LogicalRoleCapabilitySchema>;
export type ProjectLogicalRoleStatus = Static<typeof ProjectLogicalRoleStatusSchema>;
export type SystemLogicalRoleTemplate = Static<typeof SystemLogicalRoleTemplateSchema>;
export type ProjectLogicalRoleAction = Static<typeof ProjectLogicalRoleActionSchema>;
export type ProjectLogicalRoleResource = Static<typeof ProjectLogicalRoleResourceSchema>;
export type ProjectRoleParams = Static<typeof ProjectRoleParamsSchema>;
export type SystemLogicalRoleTemplateCollection = Static<
  typeof SystemLogicalRoleTemplateCollectionSchema
>;
export type ProjectLogicalRoleCollection = Static<typeof ProjectLogicalRoleCollectionSchema>;
export type ProjectLogicalRoleMutationResponse = Static<
  typeof ProjectLogicalRoleMutationResponseSchema
>;
export type CreateProjectLogicalRoleRequest = Static<typeof CreateProjectLogicalRoleRequestSchema>;
export type UpdateProjectLogicalRoleRequest = Static<typeof UpdateProjectLogicalRoleRequestSchema>;
export type CopyProjectLogicalRoleRequest = Static<typeof CopyProjectLogicalRoleRequestSchema>;
export type ArchiveProjectLogicalRoleRequest = Static<
  typeof ArchiveProjectLogicalRoleRequestSchema
>;
