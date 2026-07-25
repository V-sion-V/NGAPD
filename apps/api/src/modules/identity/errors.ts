import type { ApiErrorCode } from "@ngapd/contracts";

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly recovery?: string,
    readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
