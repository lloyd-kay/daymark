import { describe, expect, it } from "vitest";

import { readRuntimeHealth } from "../lib/runtime-health";

describe("readRuntimeHealth", () => {
  it("reports ok when the database has the final committed migration", async () => {
    await expect(readRuntimeHealth(fakeDatabase("0006_service_scope_widget_defaults.sql"))).resolves.toEqual({
      status: "ok",
      appVersion: "0.1.1",
      latestMigration: "0006_service_scope_widget_defaults.sql",
    });
  });

  it("reports needs_migration without exposing database contents", async () => {
    const result = await readRuntimeHealth(fakeDatabase("0001_daymark_widget_auth.sql"));

    expect(result).toEqual({
      status: "needs_migration",
      appVersion: "0.1.1",
      latestMigration: "0001_daymark_widget_auth.sql",
    });
    expect(Object.keys(result).sort()).toEqual(["appVersion", "latestMigration", "status"]);
  });
});

function fakeDatabase(latestMigration: string | null) {
  return {
    prepare(sql: string) {
      expect(sql).toBe("SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1");
      return {
        async first<T>() {
          return (latestMigration === null ? null : { name: latestMigration }) as T | null;
        },
      };
    },
  };
}
