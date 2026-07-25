import { type Database, FoundationRepository } from "@ngapd/database";

export class ScopeProvisioningService {
  private readonly repository: FoundationRepository;

  constructor(database: Database) {
    this.repository = new FoundationRepository(database);
  }

  createProject(input: { key: string; name: string; ownerUserId: string }) {
    return this.repository.createProjectWithWorkspace(input);
  }

  createTask(input: {
    projectId: string;
    key: string;
    title: string;
    parentTaskId: string | null;
    explicitOwnerMembershipId: string | null;
  }) {
    return this.repository.createTaskWithWorkspace(input);
  }
}
