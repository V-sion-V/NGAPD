export function createWorkspaceAuthorizationFixture() {
  const users = {
    owner: { userId: "user-owner", active: true },
    admin: { userId: "user-admin", active: true },
    member: { userId: "user-member", active: true },
    outsider: { userId: "user-outsider", active: true },
  } as const;
  const memberships = {
    owner: {
      id: "membership-owner",
      userId: users.owner.userId,
      projectId: "project-sync",
      role: "member" as const,
      active: true,
    },
    admin: {
      id: "membership-admin",
      userId: users.admin.userId,
      projectId: "project-sync",
      role: "admin" as const,
      active: true,
    },
    member: {
      id: "membership-member",
      userId: users.member.userId,
      projectId: "project-sync",
      role: "member" as const,
      active: true,
    },
  };
  const tasks = [
    {
      id: "task-root",
      projectId: "project-sync",
      parentTaskId: null,
      explicitOwnerMembershipId: memberships.owner.id,
    },
    {
      id: "task-child",
      projectId: "project-sync",
      parentTaskId: "task-root",
      explicitOwnerMembershipId: null,
    },
  ];
  return { users, memberships, tasks };
}
