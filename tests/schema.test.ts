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
  employeeServiceQualifications,
  employeeProfiles,
  invitations,
  loginAttempts,
  memberships,
  services,
  workspaceEmbedPreferences,
  workspaces,
} from "../db/schema";

describe("Daymark schema", () => {
  it("exports every persistent product table", () => {
    expect(workspaces).toBeDefined();
    expect(accounts).toBeDefined();
    expect(memberships).toBeDefined();
    expect(employeeProfiles).toBeDefined();
    expect(services).toBeDefined();
    expect(employeeServiceQualifications).toBeDefined();
    expect(workspaceEmbedPreferences).toBeDefined();
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
    expect(getTableColumns(services).workspaceId.notNull).toBe(true);
    expect(getTableColumns(employeeServiceQualifications).workspaceId.notNull).toBe(true);
    expect(getTableColumns(invitations).workspaceId.notNull).toBe(true);
    expect(getTableColumns(availabilityRules).workspaceId.notNull).toBe(true);
    expect(getTableColumns(blockedPeriods).workspaceId.notNull).toBe(true);
    expect(getTableColumns(appointments).workspaceId.notNull).toBe(true);
  });
});

describe("workspace embed preference schema", () => {
  it("stores one constrained default per workspace", () => {
    const columns = getTableColumns(workspaceEmbedPreferences);
    expect(columns.workspaceId.primary).toBe(true);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.defaultMode.notNull).toBe(true);
    expect(columns.defaultServiceScope.notNull).toBe(true);
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("backfills existing workspaces with the current floating catalogue default", async () => {
    const migration = await readFile(
      new URL("../drizzle/0005_daymark_embed_preferences.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toMatch(/default_mode[^;]+check[^;]+floating[^;]+inline/is);
    expect(migration).toMatch(/default_service_scope[^;]+check[^;]+all/is);
    expect(migration).toMatch(
      /insert into `workspace_embed_preferences`[\s\S]+select `id`, 'floating', 'all'[\s\S]+from `workspaces`/i,
    );
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

  it("stores a resilient service relationship and immutable appointment snapshot", () => {
    const columns = getTableColumns(appointments);
    expect(columns.serviceId.notNull).toBe(false);
    expect(columns.serviceName.notNull).toBe(true);
    expect(columns.serviceDurationMinutes.notNull).toBe(true);
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

describe("service catalogue migration", () => {
  it("backfills General appointment services before attaching legacy appointments", async () => {
    const migration = await readFile(
      new URL("../drizzle/0004_daymark_service_catalog.sql", import.meta.url),
      "utf8",
    );

    const serviceInsert = migration.indexOf("insert into `services`");
    const qualificationInsert = migration.indexOf(
      "insert into `employee_service_qualifications`",
    );
    const appointmentBackfill = migration.indexOf("update `appointments`");
    expect(serviceInsert).toBeGreaterThan(-1);
    expect(qualificationInsert).toBeGreaterThan(serviceInsert);
    expect(appointmentBackfill).toBeGreaterThan(qualificationInsert);
    expect(migration).toMatch(/PRAGMA foreign_key_check/);
    expect(migration).toMatch(/PRAGMA optimize/);
  });
});
