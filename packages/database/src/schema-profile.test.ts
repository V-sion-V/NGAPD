import { describe, expect, it } from "vitest";

import {
  canonicalDatabaseTarget,
  DatabaseSchemaError,
  readResetConfirmation,
} from "./schema-profile.js";

describe("formal database target confirmation", () => {
  it("canonicalizes a PostgreSQL URL without exposing credentials", () => {
    expect(
      canonicalDatabaseTarget(
        "postgresql://fixture-user:fixture-secret@127.0.0.1:55435/ngapd_m0_domain_p002",
      ),
    ).toBe("127.0.0.1:55435/ngapd_m0_domain_p002");
    expect(canonicalDatabaseTarget("postgres://localhost/example")).toBe("localhost:5432/example");
  });

  it("rejects non-PostgreSQL and ambiguous database URLs", () => {
    expect(() => canonicalDatabaseTarget("https://localhost/example")).toThrow(DatabaseSchemaError);
    expect(() => canonicalDatabaseTarget("postgres://localhost")).toThrow(DatabaseSchemaError);
    expect(() => canonicalDatabaseTarget("not a URL")).toThrow(DatabaseSchemaError);
  });

  it("requires one exact confirmation argument", () => {
    expect(
      readResetConfirmation(["--", "--confirm-destroy", "127.0.0.1:55435/ngapd_m0_domain_p002"]),
    ).toBe("127.0.0.1:55435/ngapd_m0_domain_p002");
    expect(() => readResetConfirmation([])).toThrow("reset requires exactly");
    expect(() =>
      readResetConfirmation(["--confirm", "127.0.0.1:55435/ngapd_m0_domain_p002"]),
    ).toThrow("reset requires exactly");
  });
});
