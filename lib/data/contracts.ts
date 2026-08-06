import type { AvailabilityRule, BookableSlot } from "../scheduling/types";

export type PublicEmployee = {
  id: string;
  publicName: string;
  title: string;
  bio: string;
  accent: string;
};

export type EmployeeProfileRecord = PublicEmployee & {
  workspaceId: string;
  membershipId: string | null;
  active: boolean;
  sortOrder: number;
};

export type TeamProfile = EmployeeProfileRecord & {
  memberEmail: string | null;
  memberDisplayName: string | null;
  hasCredential: boolean;
};

export type MembershipRecord = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "employee";
  active: boolean;
  employeeProfileId: string | null;
};

export type AccountSessionRecord = {
  accountId: string;
  email: string;
  displayName: string;
  active: boolean;
  mustChangePassword: boolean;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};

export type WorkspaceMembershipRecord = {
  membershipId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  accountId: string;
  employeeProfileId: string | null;
  role: "admin" | "employee";
  active: boolean;
};

export type ScheduleScope = Pick<
  MembershipRecord,
  "role" | "employeeProfileId"
> & { workspaceId: string };

export type WorkspaceSummary = {
  name: string;
  slug: string;
  role: "admin" | "employee";
};

export type PublicBookingScope = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
};

export type ScheduleEntry = {
  id: string;
  reference: string;
  employeeProfileId: string;
  employeeName: string;
  accent: string;
  startAt: string;
  endAt: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNote: string;
  status: "booked" | "cancelled";
};

export type CreateBookingInput = {
  employeeId: string;
  startAt: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientNote?: string;
};

export type CredentialRecord = {
  accountId: string;
  displayName: string;
  active: boolean;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  mustChangePassword: boolean;
  lockedUntil: string | null;
};

export type SessionActorRecord = AccountSessionRecord;

export type CreateBookingResult =
  | {
      ok: true;
      booking: {
        reference: string;
        employeeName: string;
        startAt: string;
        endAt: string;
      };
    }
  | { ok: false; reason: "unavailable" | "slot-taken" };

export type EmployeeAvailability = {
  employeeProfileId: string;
  rules: AvailabilityRule[];
  blocked: Array<{ id: string; startAt: string; endAt: string; note: string }>;
};

export type PublicSlotResult = {
  employee: PublicEmployee;
  slots: BookableSlot[];
};
