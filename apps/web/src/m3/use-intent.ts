import type { QueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { m1QueryKeys } from "../m1/model.js";
import { IntentKeyManager } from "./operations.js";
import { m3QueryKeys } from "./query-keys.js";

export function useIntentKeyManager(): IntentKeyManager {
  const manager = useRef<IntentKeyManager | null>(null);
  manager.current ??= new IntentKeyManager();
  return manager.current;
}

export async function invalidateProjectTaskQueries(
  queryClient: QueryClient,
  userId: string,
  projectKey: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: m3QueryKeys.project(userId, projectKey) }),
    queryClient.invalidateQueries({ queryKey: m3QueryKeys.notifications(userId) }),
    queryClient.invalidateQueries({ queryKey: m1QueryKeys.project(userId, projectKey) }),
  ]);
}
