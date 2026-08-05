import { describe, expect, it } from "vitest";
import {
  appointments,
  availabilityRules,
  blockedPeriods,
  employeeProfiles,
  invitations,
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
