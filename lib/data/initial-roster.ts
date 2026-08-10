import type { EmployeeProfileRecord } from "./contracts";

export const INITIAL_AVAILABILITY_MARKER = "initial-availability-v1";

const PROFILE_TEMPLATES = [
  {
    id: "maya-chen",
    publicName: "Maya Chen",
    title: "Client partner",
    bio: "Thoughtful planning and project conversations.",
    accent: "coral",
    sortOrder: 0,
  },
  {
    id: "theo-brooks",
    publicName: "Theo Brooks",
    title: "Operations specialist",
    bio: "Practical sessions for keeping work moving.",
    accent: "sage",
    sortOrder: 1,
  },
  {
    id: "priya-shah",
    publicName: "Priya Shah",
    title: "Project adviser",
    bio: "Focused support for decisions and next steps.",
    accent: "lilac",
    sortOrder: 2,
  },
  {
    id: "jon-bell",
    publicName: "Jon Bell",
    title: "Team coordinator",
    bio: "Clear, friendly appointments for general enquiries.",
    accent: "ochre",
    sortOrder: 3,
  },
] as const;

const AVAILABILITY_WINDOWS: Record<string, [number, number]> = {
  "maya-chen": [9 * 60, 17 * 60],
  "theo-brooks": [8 * 60 + 30, 16 * 60 + 30],
  "priya-shah": [10 * 60, 18 * 60],
  "jon-bell": [9 * 60, 15 * 60 + 30],
};

export function initialProfileValues(workspaceId: string): EmployeeProfileRecord[] {
  return PROFILE_TEMPLATES.map((profile) => ({
    ...profile,
    workspaceId,
    membershipId: null,
    active: true,
  }));
}

export function initialAvailabilityValues(workspaceId: string) {
  return PROFILE_TEMPLATES.flatMap((profile) =>
    [1, 2, 3, 4, 5].map((weekday) => ({
      id: `rule-${profile.id}-${weekday}`,
      workspaceId,
      employeeProfileId: profile.id,
      weekday,
      startMinute: AVAILABILITY_WINDOWS[profile.id][0],
      endMinute: AVAILABILITY_WINDOWS[profile.id][1],
      slotMinutes: 30,
      bufferMinutes: 10,
      active: true,
    })),
  );
}
