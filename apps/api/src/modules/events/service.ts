import type { ResourceInvalidationEvent } from "@ngapd/contracts";
import {
  EventCursorExpiredError,
  type EventRepository,
  type ResourceInvalidationRecord,
} from "@ngapd/database";

import { ApplicationError } from "../../application-errors.js";

export class EventService {
  constructor(private readonly events: EventRepository) {}

  async replay(
    userId: string,
    afterCursor: string,
    limit = 100,
  ): Promise<ResourceInvalidationEvent[]> {
    try {
      const records = await this.events.readAuthorized({ userId, afterCursor, limit });
      return records.map(toInvalidationEvent);
    } catch (error) {
      if (error instanceof EventCursorExpiredError) {
        throw new ApplicationError(
          409,
          "EVENT_CURSOR_EXPIRED",
          "事件游标已过期",
          "请重新获取当前资源状态后，从最新游标重新连接",
        );
      }
      if (error instanceof TypeError) {
        throw new ApplicationError(
          400,
          "VALIDATION_ERROR",
          "事件游标格式不正确",
          "请使用服务器返回的十进制游标重新连接",
        );
      }
      throw error;
    }
  }
}

function toInvalidationEvent(record: ResourceInvalidationRecord): ResourceInvalidationEvent {
  return {
    cursor: record.cursor,
    projectId: record.projectId,
    audienceType: record.audienceType,
    audienceId: record.audienceId,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    eventType: record.eventType,
    refetch: true,
    createdAt: record.createdAt.toISOString(),
  };
}
