import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  appointments,
  authSessions,
  availabilityRules,
  blockedPeriods,
  credentials,
  employeeProfiles,
  invitations,
  loginAttempts,
  memberships,
} from "../db/schema";

describe("Daymark schema", () => {
  it("exports every persistent product table", () => {
    expect(memberships).toBeDefined();
    expect(employeeProfiles).toBeDefined();
    expect(invitations).toBeDefined();
    expect(availabilityRules).toBeDefined();
    expect(blockedPeriods).toBeDefined();
    expect(appointments).toBeDefined();
  });
});

describe("staff authentication schema", () => {
  it("exports credential, session, and login-attempt tables", () => {
    expect(credentials).toBeDefined();
    expect(authSessions).toBeDefined();
    expect(loginAttempts).toBeDefined();
  });

  it("stores address plus optional email and phone on appointments", () => {
    const columns = getTableColumns(appointments);
    expect(columns.clientAddress.notNull).toBe(true);
    expect(columns.clientEmail.notNull).toBe(false);
    expect(columns.clientPhone.notNull).toBe(false);
  });
});
