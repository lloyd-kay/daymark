import { getTableColumns } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  accounts,
  appointments,
  authSessions,
  availabilityRules,
  blockedPeriods,
  credentials,
  employeeProfiles,
  invitations,
  loginAttempts,
  memberships,
  workspaces,
} from "../db/schema";

describe("Daymark schema", () => {
  it("exports every persistent product table", () => {
    expect(workspaces).toBeDefined();
    expect(accounts).toBeDefined();
    expect(memberships).toBeDefined();
    expect(employeeProfiles).toBeDefined();
    expect(invitations).toBeDefined();
    expect(availabilityRules).toBeDefined();
    expect(blockedPeriods).toBeDefined();
    expect(appointments).toBeDefined();
  });

  it("requires one workspace scope on every company-owned record", () => {
    expect(getTableColumns(workspaces).slug.notNull).toBe(true);
    expect(getTableColumns(memberships).workspaceId.notNull).toBe(true);
    expect(getTableColumns(memberships).accountId.notNull).toBe(true);
    expect(getTableColumns(employeeProfiles).workspaceId.notNull).toBe(true);
    expect(getTableColumns(invitations).workspaceId.notNull).toBe(true);
    expect(getTableColumns(availabilityRules).workspaceId.notNull).toBe(true);
    expect(getTableColumns(blockedPeriods).workspaceId.notNull).toBe(true);
    expect(getTableColumns(appointments).workspaceId.notNull).toBe(true);
  });
});

describe("staff authentication schema", () => {
  it("exports credential, session, and login-attempt tables", () => {
    expect(credentials).toBeDefined();
    expect(authSessions).toBeDefined();
    expect(loginAttempts).toBeDefined();
  });

  it("keeps credentials and sessions account-scoped rather than company-scoped", () => {
    expect(getTableColumns(credentials).accountId.notNull).toBe(true);
    expect(getTableColumns(authSessions).accountId.notNull).toBe(true);
    expect(getTableColumns(credentials)).not.toHaveProperty("membershipId");
    expect(getTableColumns(authSessions)).not.toHaveProperty("membershipId");
  });

  it("stores address plus optional email and phone on appointments", () => {
    const columns = getTableColumns(appointments);
    expect(columns.clientAddress.notNull).toBe(true);
    expect(columns.clientEmail.notNull).toBe(false);
    expect(columns.clientPhone.notNull).toBe(false);
  });
});

describe("Daymark widget auth migration", () => {
  it("keeps foreign keys disabled until both dependent table rebuilds finish", async () => {
    const migration = await readFile(
      new URL("../drizzle/0001_daymark_widget_auth.sql", import.meta.url),
      "utf8",
    );

    expect(migration.indexOf("PRAGMA foreign_keys=OFF")).toBeLessThan(
      migration.indexOf("DROP TABLE `appointments`"),
    );
    expect(migration.indexOf("DROP TABLE `memberships`")).toBeLessThan(
      migration.lastIndexOf("PRAGMA foreign_keys=ON"),
    );
  });
});

describe("company workspace migration", () => {
  it("creates the legacy workspace before copying scoped rows", async () => {
    const migration = await readFile(
      new URL("../drizzle/0002_daymark_company_workspaces.sql", import.meta.url),
      "utf8",
    );

    const workspaceInsert = migration.indexOf("insert into `workspaces`");
    const membershipCopy = migration.indexOf("insert into `__new_memberships`");
    expect(workspaceInsert).toBeGreaterThan(-1);
    expect(membershipCopy).toBeGreaterThan(workspaceInsert);
    expect(migration.indexOf("PRAGMA foreign_keys=OFF")).toBeLessThan(
      migration.indexOf("drop table `memberships`"),
    );
    expect(migration.lastIndexOf("PRAGMA foreign_keys=ON")).toBeGreaterThan(
      migration.indexOf("drop table `appointments`"),
    );
    expect(migration).toMatch(/PRAGMA foreign_key_check/);
    expect(migration).toMatch(/PRAGMA optimize/);
  });
});
