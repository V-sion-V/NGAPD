import { arch, platform } from "node:os";

import type { PlatformAdapter, PlatformInformation } from "@ngapd/workspace-core";

export class NodePlatformAdapter implements PlatformAdapter {
  getPlatformInformation(): PlatformInformation {
    return {
      platform: platform(),
      architecture: arch(),
      nodeVersion: process.version,
    };
  }
}
