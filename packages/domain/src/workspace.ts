export const WORKSPACE_SCOPES = ["user", "project", "task"] as const;

export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number];

export interface LeaseSnapshot {
  workspaceId: string;
  holderConnectionId: string;
  token: string;
  expiresAt: Date;
}

export function isLeaseActive(lease: LeaseSnapshot, now: Date): boolean {
  return lease.expiresAt.getTime() > now.getTime();
}

export function canCommitLease(
  lease: LeaseSnapshot,
  connectionId: string,
  token: string,
  now: Date,
): boolean {
  return (
    isLeaseActive(lease, now) && lease.holderConnectionId === connectionId && lease.token === token
  );
}
