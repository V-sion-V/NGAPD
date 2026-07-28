import {
  ArchiveProjectLogicalRoleRequestSchema,
  CopyProjectLogicalRoleRequestSchema,
  CreateProjectLogicalRoleRequestSchema,
  ProjectKeyParamsSchema,
  ProjectLogicalRoleCollectionSchema,
  ProjectLogicalRoleMutationResponseSchema,
  ProjectLogicalRoleResourceSchema,
  ProjectRoleParamsSchema,
  SystemLogicalRoleTemplateCollectionSchema,
  UpdateProjectLogicalRoleRequestSchema,
  type ArchiveProjectLogicalRoleRequest,
  type CopyProjectLogicalRoleRequest,
  type CreateProjectLogicalRoleRequest,
  type ProjectKeyParams,
  type ProjectRoleParams,
  type UpdateProjectLogicalRoleRequest,
} from "@ngapd/contracts";
import type { FastifyInstance } from "fastify";

import {
  AdminModeHeadersSchema,
  assertM1SameOrigin,
  m1ErrorResponses,
  resolveM1Request,
  type AdminModeHeaders,
  type M1RouteOptions,
} from "../authorization-audit/routes.js";
import type { RolesService } from "./service.js";

export async function registerRoleRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & { service: RolesService },
): Promise<void> {
  app.get(
    "/api/v1/system/logical-role-templates",
    {
      schema: {
        response: {
          200: SystemLogicalRoleTemplateCollectionSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request) => {
      await resolveM1Request(request, options);
      return options.service.listSystemTemplates();
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey/roles",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: { 200: ProjectLogicalRoleCollectionSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.listProjectRoles(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectKeyParams;
    Headers: AdminModeHeaders;
    Body: CreateProjectLogicalRoleRequest;
  }>(
    "/api/v1/projects/:projectKey/roles",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        headers: AdminModeHeadersSchema,
        body: CreateProjectLogicalRoleRequestSchema,
        response: {
          201: ProjectLogicalRoleMutationResponseSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return reply
        .code(201)
        .send(
          await options.service.createProjectRole(
            request.params.projectKey,
            request.body,
            request.headers["x-ngapd-admin-mode-id"],
            resolved.actor,
            resolved.context,
          ),
        );
    },
  );

  app.get<{ Params: ProjectRoleParams }>(
    "/api/v1/projects/:projectKey/roles/:roleId",
    {
      schema: {
        params: ProjectRoleParamsSchema,
        response: { 200: ProjectLogicalRoleResourceSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.getProjectRole(
        request.params.projectKey,
        request.params.roleId,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.patch<{
    Params: ProjectRoleParams;
    Headers: AdminModeHeaders;
    Body: UpdateProjectLogicalRoleRequest;
  }>(
    "/api/v1/projects/:projectKey/roles/:roleId",
    {
      schema: {
        params: ProjectRoleParamsSchema,
        headers: AdminModeHeadersSchema,
        body: UpdateProjectLogicalRoleRequestSchema,
        response: { 200: ProjectLogicalRoleMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.updateProjectRole(
        request.params.projectKey,
        request.params.roleId,
        request.body,
        request.headers["x-ngapd-admin-mode-id"],
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectRoleParams;
    Headers: AdminModeHeaders;
    Body: CopyProjectLogicalRoleRequest;
  }>(
    "/api/v1/projects/:projectKey/roles/:roleId/copy",
    {
      schema: {
        params: ProjectRoleParamsSchema,
        headers: AdminModeHeadersSchema,
        body: CopyProjectLogicalRoleRequestSchema,
        response: {
          201: ProjectLogicalRoleMutationResponseSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return reply
        .code(201)
        .send(
          await options.service.copyProjectRole(
            request.params.projectKey,
            request.params.roleId,
            request.body,
            request.headers["x-ngapd-admin-mode-id"],
            resolved.actor,
            resolved.context,
          ),
        );
    },
  );

  app.post<{
    Params: ProjectRoleParams;
    Headers: AdminModeHeaders;
    Body: ArchiveProjectLogicalRoleRequest;
  }>(
    "/api/v1/projects/:projectKey/roles/:roleId/archive",
    {
      schema: {
        params: ProjectRoleParamsSchema,
        headers: AdminModeHeadersSchema,
        body: ArchiveProjectLogicalRoleRequestSchema,
        response: { 200: ProjectLogicalRoleMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.archiveProjectRole(
        request.params.projectKey,
        request.params.roleId,
        request.body,
        request.headers["x-ngapd-admin-mode-id"],
        resolved.actor,
        resolved.context,
      );
    },
  );
}
