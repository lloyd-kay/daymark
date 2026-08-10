import {
  and,
  asc,
  eq,
  exists,
  gte,
  gt,
  inArray,
  lt,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import {
  accounts,
  appointments,
  availabilityRules,
  blockedPeriods,
  credentials,
  employeeServiceQualifications,
  employeeProfiles,
  invitations,
  memberships,
  runtimeState,
  services,
} from "../../db/schema";
import { computeBookableSlots, toLondonDateKey } from "../scheduling/slots";
import type { AvailabilityRule, BookableSlot, TimeRange } from "../scheduling/types";
import type {
  CreateBookingInput,
  CreateBookingResult,
  EmployeeAvailability,
  EmployeeProfileRecord,
  PublicEmployee,
  PublicBookingScope,
  PublicService,
  PublicSlotResult,
  ScheduleEntry,
  ScheduleScope,
  TeamProfile,
} from "./contracts";
import {
  generalQualificationValues,
  generalServiceValues,
} from "../services/defaults";
import {
  INITIAL_AVAILABILITY_MARKER,
  initialAvailabilityValues,
  initialProfileValues,
} from "./initial-roster";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const LEGACY_WORKSPACE_ID = "workspace-daymark";
export const PUBLIC_PROFILE_SEEDS = initialProfileValues(LEGACY_WORKSPACE_ID);

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
  const seedProfileIds = PUBLIC_PROFILE_SEEDS.map((profile) => profile.id);
  let createdInitialRoster = false;
  let existingProfiles = await db
    .select({ id: employeeProfiles.id })
    .from(employeeProfiles)
    .where(inArray(employeeProfiles.id, seedProfileIds));

  if (existingProfiles.length === 0) {
    try {
      await db.insert(employeeProfiles).values(
        PUBLIC_PROFILE_SEEDS.map((profile) => ({ ...profile })),
      );
      createdInitialRoster = true;
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
    }
    existingProfiles = await db
      .select({ id: employeeProfiles.id })
      .from(employeeProfiles)
      .where(inArray(employeeProfiles.id, seedProfileIds));
  }

  if (existingProfiles.length !== PUBLIC_PROFILE_SEEDS.length) return;
  await ensureGeneralServiceAccess(db);
  const [initializationMarker] = await db
    .select({ key: runtimeState.key })
    .from(runtimeState)
    .where(eq(runtimeState.key, INITIAL_AVAILABILITY_MARKER))
    .limit(1);
  const [existingAvailability] = await db
    .select({ id: availabilityRules.id })
    .from(availabilityRules)
    .where(inArray(availabilityRules.employeeProfileId, seedProfileIds))
    .limit(1);
  if (!createdInitialRoster && !shouldRepairPartialSeed({
    seedProfileCount: existingProfiles.length,
    expectedSeedProfileCount: PUBLIC_PROFILE_SEEDS.length,
    hasAvailability: Boolean(existingAvailability),
    hasInitializationMarker: Boolean(initializationMarker),
  })) {
    if (existingAvailability && !initializationMarker) {
      await db.insert(runtimeState).values({
        key: INITIAL_AVAILABILITY_MARKER,
        value: "complete",
      }).onConflictDoNothing();
    }
    return;
  }

  try {
    const inserts = [
      ...defaultAvailabilitySeeds().map((rule) =>
        db.insert(availabilityRules).values(rule),
      ),
      db.insert(runtimeState).values({
        key: INITIAL_AVAILABILITY_MARKER,
        value: "complete",
      }),
    ];
    const [first, ...rest] = inserts;
    if (first) await db.batch([first, ...rest]);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
  }
}

async function ensureGeneralServiceAccess(
  db: Awaited<ReturnType<typeof database>>,
): Promise<void> {
  await db
    .insert(services)
    .values(generalServiceValues(LEGACY_WORKSPACE_ID))
    .onConflictDoNothing();
  await db
    .insert(employeeServiceQualifications)
    .values(PUBLIC_PROFILE_SEEDS.map(generalQualificationValues))
    .onConflictDoNothing();
}

export function shouldRepairPartialSeed(input: {
  seedProfileCount: number;
  expectedSeedProfileCount: number;
  hasAvailability: boolean;
  hasInitializationMarker: boolean;
}): boolean {
  return input.seedProfileCount === input.expectedSeedProfileCount
    && !input.hasAvailability
    && !input.hasInitializationMarker;
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

export async function listPublicEmployees(
  scope: PublicBookingScope,
  serviceId?: string,
  now = new Date(),
): Promise<PublicEmployee[]> {
  await ensureSeedData();
  const db = await database();
  if (serviceId) {
    return db
      .select({
        id: employeeProfiles.id,
        publicName: employeeProfiles.publicName,
        title: employeeProfiles.title,
        bio: employeeProfiles.bio,
        accent: employeeProfiles.accent,
      })
      .from(employeeProfiles)
      .innerJoin(
        employeeServiceQualifications,
        and(
          eq(employeeServiceQualifications.employeeProfileId, employeeProfiles.id),
          eq(employeeServiceQualifications.workspaceId, scope.workspaceId),
        ),
      )
      .innerJoin(
        services,
        and(
          eq(services.id, employeeServiceQualifications.serviceId),
          eq(services.workspaceId, scope.workspaceId),
        ),
      )
      .where(and(
        eq(employeeProfiles.workspaceId, scope.workspaceId),
        eq(employeeProfiles.active, true),
        eq(services.id, serviceId),
        eq(services.active, true),
        publicQualificationPredicate(
          scope.workspaceId,
          toLondonDateKey(now),
          serviceId,
        ),
      ))
      .orderBy(asc(employeeProfiles.sortOrder));
  }
  const rows = await db
    .select({
      id: employeeProfiles.id,
      publicName: employeeProfiles.publicName,
      title: employeeProfiles.title,
      bio: employeeProfiles.bio,
      accent: employeeProfiles.accent,
    })
    .from(employeeProfiles)
    .where(and(
      eq(employeeProfiles.workspaceId, scope.workspaceId),
      eq(employeeProfiles.active, true),
    ))
    .orderBy(asc(employeeProfiles.sortOrder));
  return rows;
}

export async function listPublicServices(
  scope: PublicBookingScope,
  employeeId?: string,
  now = new Date(),
): Promise<PublicService[]> {
  await ensureSeedData();
  const db = await database();
  const eligibleEmployee = exists(
    db
      .select({ id: employeeServiceQualifications.id })
      .from(employeeServiceQualifications)
      .innerJoin(
        employeeProfiles,
        and(
          eq(employeeProfiles.id, employeeServiceQualifications.employeeProfileId),
          eq(employeeProfiles.workspaceId, scope.workspaceId),
        ),
      )
      .where(and(
        eq(employeeServiceQualifications.serviceId, services.id),
        eq(employeeProfiles.active, true),
        publicQualificationPredicate(
          scope.workspaceId,
          toLondonDateKey(now),
          undefined,
          employeeId,
        ),
      )),
  );
  return db
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      category: services.category,
      description: services.description,
      durationMinutes: services.durationMinutes,
    })
    .from(services)
    .where(and(
      eq(services.workspaceId, scope.workspaceId),
      eq(services.active, true),
      eligibleEmployee,
    ))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export function publicQualificationPredicate(
  workspaceId: string,
  today: string,
  serviceId?: string,
  employeeId?: string,
) {
  return and(
    eq(employeeServiceQualifications.workspaceId, workspaceId),
    eq(employeeServiceQualifications.active, true),
    serviceId
      ? eq(employeeServiceQualifications.serviceId, serviceId)
      : undefined,
    employeeId
      ? eq(employeeServiceQualifications.employeeProfileId, employeeId)
      : undefined,
    or(
      eq(employeeServiceQualifications.method, "manual"),
      and(
        eq(employeeServiceQualifications.method, "certificate"),
        gte(employeeServiceQualifications.expiresOn, today),
      ),
    ),
  );
}

export async function listTeamProfiles(
  scope: Pick<ScheduleScope, "workspaceId">,
): Promise<TeamProfile[]> {
  await ensureSeedData();
  const db = await database();
  const rows = await db
    .select({
      id: employeeProfiles.id,
      workspaceId: employeeProfiles.workspaceId,
      membershipId: employeeProfiles.membershipId,
      publicName: employeeProfiles.publicName,
      title: employeeProfiles.title,
      bio: employeeProfiles.bio,
      accent: employeeProfiles.accent,
      active: employeeProfiles.active,
      sortOrder: employeeProfiles.sortOrder,
      memberEmail: accounts.email,
      memberDisplayName: accounts.displayName,
      credentialId: credentials.id,
    })
    .from(employeeProfiles)
    .leftJoin(
      memberships,
      and(
        eq(memberships.id, employeeProfiles.membershipId),
        eq(memberships.workspaceId, scope.workspaceId),
      ),
    )
    .leftJoin(accounts, eq(accounts.id, memberships.accountId))
    .leftJoin(credentials, eq(credentials.accountId, accounts.id))
    .where(eq(employeeProfiles.workspaceId, scope.workspaceId))
    .orderBy(asc(employeeProfiles.sortOrder));
  return rows.map(projectTeamProfile);
}

type TeamProfileProjection = Omit<TeamProfile, "hasCredential"> & {
  credentialId: string | null;
  [key: string]: unknown;
};

export function projectTeamProfile(row: TeamProfileProjection): TeamProfile {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    membershipId: row.membershipId,
    publicName: row.publicName,
    title: row.title,
    bio: row.bio,
    accent: row.accent,
    active: row.active,
    sortOrder: row.sortOrder,
    memberEmail: row.memberEmail,
    memberDisplayName: row.memberDisplayName,
    hasCredential: Boolean(row.credentialId),
  };
}

export async function listPublicSlots(
  scope: PublicBookingScope,
  serviceId: string,
  employeeId: string,
  dateKeys: string[],
  now = new Date(),
): Promise<PublicSlotResult | null> {
  if (dateKeys.length === 0) return null;
  await ensureSeedData();
  await purgeExpiredAppointments(now);
  const db = await database();
  const [eligible] = await db
    .select({
      serviceId: services.id,
      serviceSlug: services.slug,
      serviceName: services.name,
      serviceCategory: services.category,
      serviceDescription: services.description,
      serviceDurationMinutes: services.durationMinutes,
      employeeId: employeeProfiles.id,
      employeePublicName: employeeProfiles.publicName,
      employeeTitle: employeeProfiles.title,
      employeeBio: employeeProfiles.bio,
      employeeAccent: employeeProfiles.accent,
    })
    .from(employeeServiceQualifications)
    .innerJoin(
      services,
      and(
        eq(services.id, employeeServiceQualifications.serviceId),
        eq(services.workspaceId, scope.workspaceId),
      ),
    )
    .innerJoin(
      employeeProfiles,
      and(
        eq(employeeProfiles.id, employeeServiceQualifications.employeeProfileId),
        eq(employeeProfiles.workspaceId, scope.workspaceId),
      ),
    )
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.active, true),
        eq(employeeProfiles.id, employeeId),
        eq(employeeProfiles.active, true),
        publicQualificationPredicate(
          scope.workspaceId,
          toLondonDateKey(now),
          serviceId,
          employeeId,
        ),
      ),
    )
    .limit(1);
  if (!eligible) return null;

  const service: PublicService = {
    id: eligible.serviceId,
    slug: eligible.serviceSlug,
    name: eligible.serviceName,
    category: eligible.serviceCategory,
    description: eligible.serviceDescription,
    durationMinutes: eligible.serviceDurationMinutes,
  };
  const employee: PublicEmployee = {
    id: eligible.employeeId,
    publicName: eligible.employeePublicName,
    title: eligible.employeeTitle,
    bio: eligible.employeeBio,
    accent: eligible.employeeAccent,
  };

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
        eq(availabilityRules.workspaceId, scope.workspaceId),
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
        eq(appointments.workspaceId, scope.workspaceId),
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
        eq(blockedPeriods.workspaceId, scope.workspaceId),
        lt(blockedPeriods.startAt, to),
        gt(blockedPeriods.endAt, from),
      ),
    );

  return {
    service,
    employee,
    slots: computeBookableSlots({
      dateKeys,
      now,
      rules: ruleRows,
      busy: [...appointmentRows, ...blockRows],
      durationMinutes: service.durationMinutes,
      zone: "Europe/London",
    }),
  };
}

export async function createBooking(
  scope: PublicBookingScope,
  input: CreateBookingInput,
  now = new Date(),
): Promise<CreateBookingResult> {
  const dateKey = toLondonDateKey(new Date(input.startAt));
  const result = await listPublicSlots(
    scope,
    input.serviceId,
    input.employeeId,
    [dateKey],
    now,
  );
  const slot = result?.slots.find((candidate) => candidate.startAt === input.startAt);
  if (!result || !slot) return { ok: false, reason: "unavailable" };

  const reference = randomReference();
  const db = await database();
  const appointmentId = crypto.randomUUID();
  const timestamp = now.toISOString();
  const guardedInsert = db.insert(appointments).select(
    db
      .select({
        id: sql<string>`${appointmentId}`.as("id"),
        workspaceId: sql<string>`${scope.workspaceId}`.as("workspace_id"),
        publicReference: sql<string>`${reference}`.as("public_reference"),
        serviceId: services.id,
        serviceName: services.name,
        serviceDurationMinutes: services.durationMinutes,
        employeeProfileId: employeeProfiles.id,
        startAt: sql<string>`${slot.startAt}`.as("start_at"),
        endAt: sql<string>`${slot.endAt}`.as("end_at"),
        clientName: sql<string>`${input.clientName}`.as("client_name"),
        clientAddress: sql<string>`${input.clientAddress}`.as("client_address"),
        clientEmail: sql<string | null>`${input.clientEmail}`.as("client_email"),
        clientPhone: sql<string | null>`${input.clientPhone}`.as("client_phone"),
        clientNote: sql<string>`${input.clientNote ?? ""}`.as("client_note"),
        status: sql<"booked">`${"booked"}`.as("status"),
        createdAt: sql<string>`${timestamp}`.as("created_at"),
        updatedAt: sql<string>`${timestamp}`.as("updated_at"),
      })
      .from(employeeServiceQualifications)
      .innerJoin(
        services,
        and(
          eq(services.id, employeeServiceQualifications.serviceId),
          eq(services.workspaceId, scope.workspaceId),
        ),
      )
      .innerJoin(
        employeeProfiles,
        and(
          eq(employeeProfiles.id, employeeServiceQualifications.employeeProfileId),
          eq(employeeProfiles.workspaceId, scope.workspaceId),
        ),
      )
      .where(and(
        eq(services.id, input.serviceId),
        eq(services.active, true),
        eq(employeeProfiles.id, input.employeeId),
        eq(employeeProfiles.active, true),
        publicQualificationPredicate(
          scope.workspaceId,
          toLondonDateKey(now),
          input.serviceId,
          input.employeeId,
        ),
        notExists(
          db
            .select({ id: appointments.id })
            .from(appointments)
            .where(bookedAppointmentOverlapPredicate(
              scope.workspaceId,
              input.employeeId,
              slot.startAt,
              slot.endAt,
            )),
        ),
      ))
      .limit(1),
  );
  try {
    const inserted = await guardedInsert;
    if (Number(inserted.meta?.changes ?? 0) !== 1) {
      return { ok: false, reason: "slot-taken" };
    }
  } catch (error) {
    if (isUniqueConstraint(error)) return { ok: false, reason: "slot-taken" };
    throw error;
  }

  const [snapshot] = await db
    .select({
      serviceName: appointments.serviceName,
      serviceDurationMinutes: appointments.serviceDurationMinutes,
    })
    .from(appointments)
    .where(and(
      eq(appointments.id, appointmentId),
      eq(appointments.workspaceId, scope.workspaceId),
    ))
    .limit(1);
  if (!snapshot) return { ok: false, reason: "slot-taken" };

  return {
    ok: true,
    booking: {
      reference,
      serviceName: snapshot.serviceName,
      serviceDurationMinutes: snapshot.serviceDurationMinutes,
      employeeName: result.employee.publicName,
      startAt: slot.startAt,
      endAt: slot.endAt,
    },
  };
}

export function appointmentInsertValues(
  scope: PublicBookingScope,
  input: CreateBookingInput,
  service: Pick<PublicService, "id" | "name" | "durationMinutes">,
  slot: Pick<BookableSlot, "startAt" | "endAt">,
  reference: string,
  id: string,
) {
  return {
    id,
    workspaceId: scope.workspaceId,
    publicReference: reference,
    serviceId: service.id,
    serviceName: service.name,
    serviceDurationMinutes: service.durationMinutes,
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

export function bookedAppointmentOverlapPredicate(
  workspaceId: string,
  employeeId: string,
  startAt: string,
  endAt: string,
) {
  return and(
    eq(appointments.workspaceId, workspaceId),
    eq(appointments.employeeProfileId, employeeId),
    eq(appointments.status, "booked"),
    lt(appointments.startAt, endAt),
    gt(appointments.endAt, startAt),
  );
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
    workspaceId: LEGACY_WORKSPACE_ID,
    codeHash: await sha256(code),
    emailHash: await sha256(code),
    role: "employee",
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
    .where(and(
      eq(employeeProfiles.workspaceId, scope.workspaceId),
      eq(employeeProfiles.active, true),
    ));
  const requestedIds = requestedEmployeeId
    ? [requestedEmployeeId]
    : allProfiles.map((profile) => profile.id);
  const allowedIds = profileIdsForScope(scope, requestedIds);
  if (allowedIds.length === 0) return [];

  const entries = await db
    .select({
      id: appointments.id,
      reference: appointments.publicReference,
      serviceName: appointments.serviceName,
      serviceDurationMinutes: appointments.serviceDurationMinutes,
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
        eq(appointments.workspaceId, scope.workspaceId),
        eq(employeeProfiles.workspaceId, scope.workspaceId),
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
    serviceName: entry.serviceName,
    serviceDurationMinutes: entry.serviceDurationMinutes,
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
        eq(availabilityRules.workspaceId, scope.workspaceId),
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
    .where(and(
      eq(blockedPeriods.workspaceId, scope.workspaceId),
      eq(blockedPeriods.employeeProfileId, requestedEmployeeId),
    ))
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
    .where(and(
      eq(availabilityRules.workspaceId, scope.workspaceId),
      eq(availabilityRules.employeeProfileId, requestedEmployeeId),
    ));
  if (rules.length > 0) {
    await db.insert(availabilityRules).values(
      rules.map((rule) => ({
        id: crypto.randomUUID(),
        workspaceId: scope.workspaceId,
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
    workspaceId: scope.workspaceId,
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
    .where(and(
      eq(appointments.id, appointmentId),
      eq(appointments.workspaceId, scope.workspaceId),
    ))
    .limit(1);
  if (!appointment) return false;
  const [allowedId] = profileIdsForScope(scope, [appointment.employeeProfileId]);
  if (!allowedId || allowedId !== appointment.employeeProfileId) return false;
  await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: now.toISOString() })
    .where(and(
      eq(appointments.id, appointmentId),
      eq(appointments.workspaceId, scope.workspaceId),
    ));
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
  return initialAvailabilityValues(LEGACY_WORKSPACE_ID);
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
