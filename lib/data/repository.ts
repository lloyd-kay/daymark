import {
  and,
  asc,
  eq,
  gt,
  inArray,
  lt,
} from "drizzle-orm";
import {
  appointments,
  availabilityRules,
  blockedPeriods,
  employeeProfiles,
  invitations,
  memberships,
} from "../../db/schema";
import { computeBookableSlots, toLondonDateKey } from "../scheduling/slots";
import type { AvailabilityRule, BookableSlot, TimeRange } from "../scheduling/types";
import type {
  CreateBookingInput,
  CreateBookingResult,
  EmployeeAvailability,
  EmployeeProfileRecord,
  PublicEmployee,
  PublicSlotResult,
  ScheduleEntry,
  ScheduleScope,
  TeamProfile,
} from "./contracts";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const PUBLIC_PROFILE_SEEDS = [
  {
    id: "maya-chen",
    membershipId: null,
    publicName: "Maya Chen",
    title: "Client partner",
    bio: "Thoughtful planning and project conversations.",
    accent: "coral",
    active: true,
    sortOrder: 0,
  },
  {
    id: "theo-brooks",
    membershipId: null,
    publicName: "Theo Brooks",
    title: "Operations specialist",
    bio: "Practical sessions for keeping work moving.",
    accent: "sage",
    active: true,
    sortOrder: 1,
  },
  {
    id: "priya-shah",
    membershipId: null,
    publicName: "Priya Shah",
    title: "Project adviser",
    bio: "Focused support for decisions and next steps.",
    accent: "lilac",
    active: true,
    sortOrder: 2,
  },
  {
    id: "jon-bell",
    membershipId: null,
    publicName: "Jon Bell",
    title: "Team coordinator",
    bio: "Clear, friendly appointments for general enquiries.",
    accent: "ochre",
    active: true,
    sortOrder: 3,
  },
] as const satisfies readonly EmployeeProfileRecord[];

export function toPublicEmployee(
  profile: EmployeeProfileRecord,
): PublicEmployee {
  return {
    id: profile.id,
    publicName: profile.publicName,
    title: profile.title,
    bio: profile.bio,
    accent: profile.accent,
  };
}

export function profileIdsForScope(
  scope: ScheduleScope,
  requestedProfileIds: string[],
): string[] {
  if (scope.role === "admin") return [...requestedProfileIds];
  return scope.employeeProfileId ? [scope.employeeProfileId] : [];
}

export function retentionCutoffIso(now: Date): string {
  return new Date(now.getTime() - THIRTY_DAYS_MS).toISOString();
}

export function expiredAppointmentsPredicate(now: Date) {
  return lt(appointments.endAt, retentionCutoffIso(now));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function ensureSeedData(): Promise<void> {
  const db = await database();
  const [existing] = await db.select({ id: employeeProfiles.id }).from(employeeProfiles).limit(1);
  if (existing) return;

  try {
    await db.insert(employeeProfiles).values(
      PUBLIC_PROFILE_SEEDS.map((profile) => ({ ...profile })),
    );
    await db.insert(availabilityRules).values(defaultAvailabilitySeeds());
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
}

export async function purgeExpiredAppointments(
  now = new Date(),
): Promise<{ deleted: number }> {
  const db = await database();
  const result = await db
    .delete(appointments)
    .where(expiredAppointmentsPredicate(now));
  return { deleted: Number(result.meta?.changes ?? 0) };
}

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  await ensureSeedData();
  const db = await database();
  const rows = await db
    .select({
      id: employeeProfiles.id,
      publicName: employeeProfiles.publicName,
      title: employeeProfiles.title,
      bio: employeeProfiles.bio,
      accent: employeeProfiles.accent,
    })
    .from(employeeProfiles)
    .where(eq(employeeProfiles.active, true))
    .orderBy(asc(employeeProfiles.sortOrder));
  return rows;
}

export async function listTeamProfiles(): Promise<TeamProfile[]> {
  await ensureSeedData();
  const db = await database();
  return db
    .select({
      id: employeeProfiles.id,
      membershipId: employeeProfiles.membershipId,
      publicName: employeeProfiles.publicName,
      title: employeeProfiles.title,
      bio: employeeProfiles.bio,
      accent: employeeProfiles.accent,
      active: employeeProfiles.active,
      sortOrder: employeeProfiles.sortOrder,
      memberEmail: memberships.email,
      memberDisplayName: memberships.displayName,
    })
    .from(employeeProfiles)
    .leftJoin(memberships, eq(memberships.id, employeeProfiles.membershipId))
    .orderBy(asc(employeeProfiles.sortOrder));
}

export async function listPublicSlots(
  employeeId: string,
  dateKeys: string[],
  now = new Date(),
): Promise<PublicSlotResult | null> {
  if (dateKeys.length === 0) return null;
  await ensureSeedData();
  await purgeExpiredAppointments(now);
  const db = await database();
  const [employee] = await db
    .select({
      id: employeeProfiles.id,
      publicName: employeeProfiles.publicName,
      title: employeeProfiles.title,
      bio: employeeProfiles.bio,
      accent: employeeProfiles.accent,
    })
    .from(employeeProfiles)
    .where(
      and(eq(employeeProfiles.id, employeeId), eq(employeeProfiles.active, true)),
    )
    .limit(1);
  if (!employee) return null;

  const ruleRows = await db
    .select({
      weekday: availabilityRules.weekday,
      startMinute: availabilityRules.startMinute,
      endMinute: availabilityRules.endMinute,
      slotMinutes: availabilityRules.slotMinutes,
      bufferMinutes: availabilityRules.bufferMinutes,
    })
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.employeeProfileId, employeeId),
        eq(availabilityRules.active, true),
      ),
    );

  const { from, to } = broadUtcRange(dateKeys);
  const appointmentRows = await db
    .select({ startAt: appointments.startAt, endAt: appointments.endAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.employeeProfileId, employeeId),
        eq(appointments.status, "booked"),
        lt(appointments.startAt, to),
        gt(appointments.endAt, from),
      ),
    );
  const blockRows = await db
    .select({ startAt: blockedPeriods.startAt, endAt: blockedPeriods.endAt })
    .from(blockedPeriods)
    .where(
      and(
        eq(blockedPeriods.employeeProfileId, employeeId),
        lt(blockedPeriods.startAt, to),
        gt(blockedPeriods.endAt, from),
      ),
    );

  return {
    employee,
    slots: computeBookableSlots({
      dateKeys,
      now,
      rules: ruleRows,
      busy: [...appointmentRows, ...blockRows],
      zone: "Europe/London",
    }),
  };
}

export async function createBooking(
  input: CreateBookingInput,
  now = new Date(),
): Promise<CreateBookingResult> {
  const dateKey = toLondonDateKey(new Date(input.startAt));
  const result = await listPublicSlots(input.employeeId, [dateKey], now);
  const slot = result?.slots.find((candidate) => candidate.startAt === input.startAt);
  if (!result || !slot) return { ok: false, reason: "unavailable" };

  const reference = randomReference();
  const db = await database();
  try {
    await db.insert(appointments).values(
      appointmentInsertValues(input, slot, reference, crypto.randomUUID()),
    );
  } catch (error) {
    if (isUniqueConstraint(error)) return { ok: false, reason: "slot-taken" };
    throw error;
  }

  return {
    ok: true,
    booking: {
      reference,
      employeeName: result.employee.publicName,
      startAt: slot.startAt,
      endAt: slot.endAt,
    },
  };
}

export function appointmentInsertValues(
  input: CreateBookingInput,
  slot: Pick<BookableSlot, "startAt" | "endAt">,
  reference: string,
  id: string,
) {
  return {
    id,
    publicReference: reference,
    employeeProfileId: input.employeeId,
    startAt: slot.startAt,
    endAt: slot.endAt,
    clientName: input.clientName,
    clientAddress: input.clientAddress,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    clientNote: input.clientNote ?? "",
    status: "booked" as const,
  };
}

export async function createInvitation(
  adminMembershipId: string,
  employeeProfileId: string,
  now = new Date(),
): Promise<{ code: string; expiresAt: string } | null> {
  const db = await database();
  const [admin] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, adminMembershipId),
        eq(memberships.role, "admin"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  const [profile] = await db
    .select({ id: employeeProfiles.id })
    .from(employeeProfiles)
    .where(
      and(
        eq(employeeProfiles.id, employeeProfileId),
        eq(employeeProfiles.active, true),
      ),
    )
    .limit(1);
  if (!admin || !profile) return null;

  const code = randomCode();
  const expiresAt = new Date(now.getTime() + SEVEN_DAYS_MS).toISOString();
  await db.insert(invitations).values({
    id: crypto.randomUUID(),
    codeHash: await sha256(code),
    employeeProfileId,
    expiresAt,
    createdByMembershipId: adminMembershipId,
  });
  return { code, expiresAt };
}

export async function listSchedule(
  scope: ScheduleScope,
  range: { from: string; to: string },
  requestedEmployeeId?: string,
): Promise<ScheduleEntry[]> {
  await ensureSeedData();
  await purgeExpiredAppointments();
  const db = await database();
  const allProfiles = await db
    .select({ id: employeeProfiles.id })
    .from(employeeProfiles)
    .where(eq(employeeProfiles.active, true));
  const requestedIds = requestedEmployeeId
    ? [requestedEmployeeId]
    : allProfiles.map((profile) => profile.id);
  const allowedIds = profileIdsForScope(scope, requestedIds);
  if (allowedIds.length === 0) return [];

  const entries = await db
    .select({
      id: appointments.id,
      reference: appointments.publicReference,
      employeeProfileId: appointments.employeeProfileId,
      employeeName: employeeProfiles.publicName,
      accent: employeeProfiles.accent,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      clientName: appointments.clientName,
      clientAddress: appointments.clientAddress,
      clientEmail: appointments.clientEmail,
      clientPhone: appointments.clientPhone,
      clientNote: appointments.clientNote,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(
      employeeProfiles,
      eq(employeeProfiles.id, appointments.employeeProfileId),
    )
    .where(
      and(
        inArray(appointments.employeeProfileId, allowedIds),
        lt(appointments.startAt, range.to),
        gt(appointments.endAt, range.from),
      ),
    )
    .orderBy(asc(appointments.startAt));
  return entries.map(projectScheduleEntry);
}

export function projectScheduleEntry(entry: ScheduleEntry): ScheduleEntry {
  return {
    id: entry.id,
    reference: entry.reference,
    employeeProfileId: entry.employeeProfileId,
    employeeName: entry.employeeName,
    accent: entry.accent,
    startAt: entry.startAt,
    endAt: entry.endAt,
    clientName: entry.clientName,
    clientAddress: entry.clientAddress,
    clientEmail: entry.clientEmail,
    clientPhone: entry.clientPhone,
    clientNote: entry.clientNote,
    status: entry.status,
  };
}

export async function getEmployeeAvailability(
  scope: ScheduleScope,
  requestedEmployeeId: string,
): Promise<EmployeeAvailability | null> {
  const [allowedId] = profileIdsForScope(scope, [requestedEmployeeId]);
  if (!allowedId || allowedId !== requestedEmployeeId) return null;
  const db = await database();
  const rules = await db
    .select({
      weekday: availabilityRules.weekday,
      startMinute: availabilityRules.startMinute,
      endMinute: availabilityRules.endMinute,
      slotMinutes: availabilityRules.slotMinutes,
      bufferMinutes: availabilityRules.bufferMinutes,
    })
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.employeeProfileId, requestedEmployeeId),
        eq(availabilityRules.active, true),
      ),
    )
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startMinute));
  const blocked = await db
    .select({
      id: blockedPeriods.id,
      startAt: blockedPeriods.startAt,
      endAt: blockedPeriods.endAt,
      note: blockedPeriods.note,
    })
    .from(blockedPeriods)
    .where(eq(blockedPeriods.employeeProfileId, requestedEmployeeId))
    .orderBy(asc(blockedPeriods.startAt));
  return { employeeProfileId: requestedEmployeeId, rules, blocked };
}

export async function replaceAvailabilityRules(
  scope: ScheduleScope,
  requestedEmployeeId: string,
  rules: AvailabilityRule[],
): Promise<boolean> {
  const [allowedId] = profileIdsForScope(scope, [requestedEmployeeId]);
  if (!allowedId || allowedId !== requestedEmployeeId) return false;
  const db = await database();
  await db
    .delete(availabilityRules)
    .where(eq(availabilityRules.employeeProfileId, requestedEmployeeId));
  if (rules.length > 0) {
    await db.insert(availabilityRules).values(
      rules.map((rule) => ({
        id: crypto.randomUUID(),
        employeeProfileId: requestedEmployeeId,
        ...rule,
        active: true,
      })),
    );
  }
  return true;
}

export async function addBlockedPeriod(
  scope: ScheduleScope,
  requestedEmployeeId: string,
  range: TimeRange & { note?: string },
): Promise<boolean> {
  const [allowedId] = profileIdsForScope(scope, [requestedEmployeeId]);
  if (!allowedId || allowedId !== requestedEmployeeId) return false;
  const db = await database();
  await db.insert(blockedPeriods).values({
    id: crypto.randomUUID(),
    employeeProfileId: requestedEmployeeId,
    startAt: range.startAt,
    endAt: range.endAt,
    note: range.note ?? "",
  });
  return true;
}

export async function cancelAppointment(
  scope: ScheduleScope,
  appointmentId: string,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const [appointment] = await db
    .select({ employeeProfileId: appointments.employeeProfileId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!appointment) return false;
  const [allowedId] = profileIdsForScope(scope, [appointment.employeeProfileId]);
  if (!allowedId || allowedId !== appointment.employeeProfileId) return false;
  await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: now.toISOString() })
    .where(eq(appointments.id, appointmentId));
  return true;
}

export async function setEmployeeActive(
  adminMembershipId: string,
  employeeProfileId: string,
  active: boolean,
): Promise<boolean> {
  const db = await database();
  const [admin] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, adminMembershipId),
        eq(memberships.role, "admin"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!admin) return false;
  await db
    .update(employeeProfiles)
    .set({ active, updatedAt: new Date().toISOString() })
    .where(eq(employeeProfiles.id, employeeProfileId));
  return true;
}

async function database() {
  const { getDb } = await import("../../db");
  return getDb();
}

function defaultAvailabilitySeeds() {
  const windows: Record<string, [number, number]> = {
    "maya-chen": [9 * 60, 17 * 60],
    "theo-brooks": [8 * 60 + 30, 16 * 60 + 30],
    "priya-shah": [10 * 60, 18 * 60],
    "jon-bell": [9 * 60, 15 * 60 + 30],
  };
  return PUBLIC_PROFILE_SEEDS.flatMap((profile) =>
    [1, 2, 3, 4, 5].map((weekday) => ({
      id: `rule-${profile.id}-${weekday}`,
      employeeProfileId: profile.id,
      weekday,
      startMinute: windows[profile.id][0],
      endMinute: windows[profile.id][1],
      slotMinutes: 30,
      bufferMinutes: 10,
      active: true,
    })),
  );
}

function broadUtcRange(dateKeys: string[]) {
  const sorted = [...dateKeys].sort();
  const first = Date.parse(`${sorted[0]}T00:00:00.000Z`) - 2 * 60 * 60 * 1000;
  const last = Date.parse(`${sorted.at(-1)}T00:00:00.000Z`) + 26 * 60 * 60 * 1000;
  return { from: new Date(first).toISOString(), to: new Date(last).toISOString() };
}

function randomReference(): string {
  return `DM-${randomCharacters(6)}`;
}

function randomCode(): string {
  return `DAYMARK-${randomCharacters(8)}`;
}

function randomCharacters(length: number): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
