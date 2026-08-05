import type { AvailabilityRule, BookableSlot } from "../scheduling/types";

export type PublicEmployee = {
  id: string;
  publicName: string;
  title: string;
  bio: string;
  accent: string;
};

export type EmployeeProfileRecord = PublicEmployee & {
  membershipId: string | null;
  active: boolean;
  sortOrder: number;
};

export type AuthenticatedIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

export type MembershipRecord = {
  id: string;
  oaiUserId: string;
  email: string;
  displayName: string;
  role: "admin" | "employee";
  active: boolean;
  employeeProfileId: string | null;
};

export type ScheduleScope = Pick<
  MembershipRecord,
  "role" | "employeeProfileId"
>;

export type ScheduleEntry = {
  id: string;
  reference: string;
  employeeProfileId: string;
  employeeName: string;
  accent: string;
  startAt: string;
  endAt: string;
  clientName: string;
  clientEmail: string;
  clientNote: string;
  status: "booked" | "cancelled";
};

export type CreateBookingInput = {
  employeeId: string;
  startAt: string;
  clientName: string;
  clientEmail: string;
  clientNote?: string;
};

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
