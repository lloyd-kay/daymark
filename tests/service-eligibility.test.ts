import { describe, expect, it } from "vitest";

import {
  normalizeServiceSlug,
  qualificationIsCurrent,
  validDateOnly,
  validServiceDuration,
  validServiceSlug,
} from "../lib/services/eligibility";
import {
  generalQualificationValues,
  generalServiceId,
  generalServiceValues,
} from "../lib/services/defaults";

describe("service identifiers", () => {
  it("normalizes service names without depending on a host page URL", () => {
    expect(normalizeServiceSlug("  Eufy Alarm / 4–6 Sensors  ")).toBe(
      "eufy-alarm-4-6-sensors",
    );
    expect(validServiceSlug("eufy-alarm-4-6-sensors")).toBe(true);
    expect(validServiceSlug("all")).toBe(false);
    expect(validServiceSlug("https://example.com/product")).toBe(false);
  });
});

describe("service duration and certificate dates", () => {
  it("accepts only supported 15-minute service increments", () => {
    expect(validServiceDuration(15)).toBe(true);
    expect(validServiceDuration(90)).toBe(true);
    expect(validServiceDuration(480)).toBe(true);
    expect(validServiceDuration(0)).toBe(false);
    expect(validServiceDuration(91)).toBe(false);
    expect(validServiceDuration(495)).toBe(false);
  });

  it("accepts exact calendar dates and rejects normalized rollovers", () => {
    expect(validDateOnly("2026-08-10")).toBe(true);
    expect(validDateOnly("2026-02-29")).toBe(false);
    expect(validDateOnly("10/08/2026")).toBe(false);
    expect(validDateOnly(null)).toBe(false);
  });
});

describe("employee service qualification", () => {
  it("keeps manual approval current and expires certificate approval after its expiry date", () => {
    expect(qualificationIsCurrent(
      { active: true, method: "manual", expiresOn: null },
      "2026-08-10",
    )).toBe(true);
    expect(qualificationIsCurrent(
      { active: true, method: "certificate", expiresOn: "2026-08-10" },
      "2026-08-10",
    )).toBe(true);
    expect(qualificationIsCurrent(
      { active: true, method: "certificate", expiresOn: "2026-08-09" },
      "2026-08-10",
    )).toBe(false);
    expect(qualificationIsCurrent(
      { active: false, method: "manual", expiresOn: null },
      "2026-08-10",
    )).toBe(false);
    expect(qualificationIsCurrent(
      { active: true, method: "certificate", expiresOn: null },
      "2026-08-10",
    )).toBe(false);
  });
});

describe("backward-compatible General appointment", () => {
  it("derives stable workspace service and employee qualification records", () => {
    expect(generalServiceId("workspace-cedar")).toBe(
      "service-general-workspace-cedar",
    );
    expect(generalServiceValues("workspace-cedar")).toEqual({
      id: "service-general-workspace-cedar",
      workspaceId: "workspace-cedar",
      slug: "general-appointment",
      name: "General appointment",
      category: "General",
      description: "General appointment booking.",
      durationMinutes: 30,
      active: true,
      sortOrder: 0,
    });
    expect(generalQualificationValues({
      id: "maya-chen",
      workspaceId: "workspace-cedar",
    })).toEqual({
      id: "qualification-general-maya-chen",
      workspaceId: "workspace-cedar",
      employeeProfileId: "maya-chen",
      serviceId: "service-general-workspace-cedar",
      method: "manual",
      certificateName: null,
      certificateReference: null,
      issuedOn: null,
      expiresOn: null,
      active: true,
    });
  });
});
