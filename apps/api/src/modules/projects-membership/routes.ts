import {
  ChangeMembershipPermissionRequestSchema,
  ChangeProjectLifecycleRequestSchema,
  CreateMembershipJoinRequestSchema,
  CreateOwnershipTransferRequestSchema,
  JoinRequestParamsSchema,
  MembershipCollectionSchema,
  MembershipJoinRequestCollectionSchema,
  MembershipJoinRequestMutationResponseSchema,
  MembershipMutationResponseSchema,
  MembershipParamsSchema,
  MembershipRemovalPreviewSchema,
  OwnershipTransferCollectionSchema,
  OwnershipTransferMutationResponseSchema,
  OwnershipTransferParamsSchema,
  ProjectCollectionSchema,
  ProjectDetailSchema,
  ProjectJoinTargetSchema,
  ProjectKeyParamsSchema,
  ProjectMutationResponseSchema,
  RemoveMembershipRequestSchema,
  ResolveMembershipJoinRequestSchema,
  ResolveOwnershipTransferRequestSchema,
  UpdateMembershipProfileRequestSchema,
  CreateProjectRequestSchema,
  type ChangeMembershipPermissionRequest,
  type ChangeProjectLifecycleRequest,
  type CreateMembershipJoinRequest,
  type CreateOwnershipTransferRequest,
  type CreateProjectRequest,
  type JoinRequestParams,
  type MembershipParams,
  type OwnershipTransferParams,
  type ProjectKeyParams,
  type RemoveMembershipRequest,
  type ResolveMembershipJoinRequest,
  type ResolveOwnershipTransferRequest,
  type UpdateMembershipProfileRequest,
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
import type { ProjectsMembershipService } from "./service.js";

export async function registerProjectsMembershipRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & { service: ProjectsMembershipService },
): Promise<void> {
  app.get(
    "/api/v1/projects",
    {
      schema: {
        response: { 200: ProjectCollectionSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.listProjects(resolved.actor, resolved.context);
    },
  );

  app.post<{ Body: CreateProjectRequest }>(
    "/api/v1/projects",
    {
      schema: {
        body: CreateProjectRequestSchema,
        response: { 201: ProjectMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return reply
        .code(201)
        .send(await options.service.createProject(request.body, resolved.actor, resolved.context));
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: { 200: ProjectDetailSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.getProject(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey/join-target",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: { 200: ProjectJoinTargetSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.getJoinTarget(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: ProjectKeyParams; Body: ChangeProjectLifecycleRequest }>(
    "/api/v1/projects/:projectKey/lifecycle",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        body: ChangeProjectLifecycleRequestSchema,
        response: { 200: ProjectMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.changeProjectLifecycle(
        request.params.projectKey,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Body: CreateMembershipJoinRequest }>(
    "/api/v1/membership-join-requests",
    {
      schema: {
        body: CreateMembershipJoinRequestSchema,
        response: {
          201: MembershipJoinRequestMutationResponseSchema,
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
          await options.service.createJoinRequest(request.body, resolved.actor, resolved.context),
        );
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey/join-requests",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: {
          200: MembershipJoinRequestCollectionSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.listJoinRequests(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: JoinRequestParams; Body: ResolveMembershipJoinRequest }>(
    "/api/v1/projects/:projectKey/join-requests/:requestId/decision",
    {
      schema: {
        params: JoinRequestParamsSchema,
        body: ResolveMembershipJoinRequestSchema,
        response: {
          200: MembershipJoinRequestMutationResponseSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.resolveJoinRequest(
        request.params.projectKey,
        request.params.requestId,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey/members",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: { 200: MembershipCollectionSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.listMembers(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.patch<{
    Params: MembershipParams;
    Headers: AdminModeHeaders;
    Body: UpdateMembershipProfileRequest;
  }>(
    "/api/v1/projects/:projectKey/members/:membershipId/profile",
    {
      schema: {
        params: MembershipParamsSchema,
        headers: AdminModeHeadersSchema,
        body: UpdateMembershipProfileRequestSchema,
        response: { 200: MembershipMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.updateMembershipProfile(
        request.params.projectKey,
        request.params.membershipId,
        request.body,
        request.headers["x-ngapd-admin-mode-id"],
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: MembershipParams; Body: ChangeMembershipPermissionRequest }>(
    "/api/v1/projects/:projectKey/members/:membershipId/permission",
    {
      schema: {
        params: MembershipParamsSchema,
        body: ChangeMembershipPermissionRequestSchema,
        response: { 200: MembershipMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.changeMembershipPermission(
        request.params.projectKey,
        request.params.membershipId,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{ Params: MembershipParams }>(
    "/api/v1/projects/:projectKey/members/:membershipId/removal-preview",
    {
      schema: {
        params: MembershipParamsSchema,
        response: { 200: MembershipRemovalPreviewSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.previewMembershipRemoval(
        request.params.projectKey,
        request.params.membershipId,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: MembershipParams; Body: RemoveMembershipRequest }>(
    "/api/v1/projects/:projectKey/members/:membershipId/remove",
    {
      schema: {
        params: MembershipParamsSchema,
        body: RemoveMembershipRequestSchema,
        response: { 200: MembershipMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.removeMembership(
        request.params.projectKey,
        request.params.membershipId,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{ Params: ProjectKeyParams }>(
    "/api/v1/projects/:projectKey/ownership-transfers",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        response: { 200: OwnershipTransferCollectionSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.listOwnershipTransfers(
        request.params.projectKey,
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: ProjectKeyParams; Body: CreateOwnershipTransferRequest }>(
    "/api/v1/projects/:projectKey/ownership-transfers",
    {
      schema: {
        params: ProjectKeyParamsSchema,
        body: CreateOwnershipTransferRequestSchema,
        response: {
          201: OwnershipTransferMutationResponseSchema,
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
          await options.service.createOwnershipTransfer(
            request.params.projectKey,
            request.body,
            resolved.actor,
            resolved.context,
          ),
        );
    },
  );

  app.post<{ Params: OwnershipTransferParams; Body: ResolveOwnershipTransferRequest }>(
    "/api/v1/projects/:projectKey/ownership-transfers/:transferId/resolve",
    {
      schema: {
        params: OwnershipTransferParamsSchema,
        body: ResolveOwnershipTransferRequestSchema,
        response: {
          200: OwnershipTransferMutationResponseSchema,
          ...m1ErrorResponses,
        },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.resolveOwnershipTransfer(
        request.params.projectKey,
        request.params.transferId,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );
}
