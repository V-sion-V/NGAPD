import type { ResourceInvalidationEvent } from "@ngapd/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { invalidationQueryKeys, type CurrentProjectIdentity } from "./model.js";

export function useResourceEvents(
  userId: string,
  currentProject?: CurrentProjectIdentity | null,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const events = new EventSource("/api/v1/events");
    const refreshAfterConnect = () => {
      void queryClient.invalidateQueries({ queryKey: m1Root(userId) });
    };
    const invalidate = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as ResourceInvalidationEvent;
        for (const queryKey of invalidationQueryKeys(userId, event, currentProject)) {
          void queryClient.invalidateQueries({ queryKey });
        }
      } catch {
        void queryClient.invalidateQueries({ queryKey: m1Root(userId) });
      }
    };

    events.addEventListener("open", refreshAfterConnect);
    events.addEventListener("resource-invalidated", invalidate as EventListener);
    return () => {
      events.removeEventListener("open", refreshAfterConnect);
      events.removeEventListener("resource-invalidated", invalidate as EventListener);
      events.close();
    };
  }, [currentProject?.id, currentProject?.key, queryClient, userId]);
}

function m1Root(userId: string) {
  return ["m1", userId] as const;
}
