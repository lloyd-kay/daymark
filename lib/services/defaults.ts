export const GENERAL_SERVICE_SLUG = "general-appointment";

export function generalServiceId(workspaceId: string): string {
  return `service-general-${workspaceId}`;
}

export function generalServiceValues(workspaceId: string) {
  return {
    id: generalServiceId(workspaceId),
    workspaceId,
    slug: GENERAL_SERVICE_SLUG,
    name: "General appointment",
    category: "General",
    description: "General appointment booking.",
    durationMinutes: 30,
    active: true,
    sortOrder: 0,
  };
}

export function generalQualificationValues(profile: {
  id: string;
  workspaceId: string;
}) {
  return {
    id: `qualification-general-${profile.id}`,
    workspaceId: profile.workspaceId,
    employeeProfileId: profile.id,
    serviceId: generalServiceId(profile.workspaceId),
    method: "manual" as const,
    certificateName: null,
    certificateReference: null,
    issuedOn: null,
    expiresOn: null,
    active: true,
  };
}
