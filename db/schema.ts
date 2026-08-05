import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type TeamRole = "admin" | "employee";
export type AppointmentStatus = "booked" | "cancelled";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    oaiUserId: text("oai_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").$type<TeamRole>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_memberships_oai_user_id").on(table.oaiUserId),
    check("memberships_role_check", sql`${table.role} in ('admin', 'employee')`),
  ],
);

export const employeeProfiles = sqliteTable(
  "employee_profiles",
  {
    id: text("id").primaryKey(),
    membershipId: text("membership_id").references(() => memberships.id, {
      onDelete: "set null",
    }),
    publicName: text("public_name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull().default(""),
    accent: text("accent").notNull().default("coral"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_employee_profiles_membership_id").on(table.membershipId),
    index("idx_employee_profiles_active_sort").on(table.active, table.sortOrder),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    redeemedAt: text("redeemed_at"),
    createdByMembershipId: text("created_by_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_invitations_code_hash").on(table.codeHash),
    index("idx_invitations_profile_expiry").on(
      table.employeeProfileId,
      table.expiresAt,
    ),
  ],
);

export const availabilityRules = sqliteTable(
  "availability_rules",
  {
    id: text("id").primaryKey(),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(30),
    bufferMinutes: integer("buffer_minutes").notNull().default(10),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("idx_availability_employee_weekday").on(
      table.employeeProfileId,
      table.weekday,
      table.active,
    ),
    check("availability_weekday_check", sql`${table.weekday} between 0 and 6`),
    check(
      "availability_window_check",
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.startMinute} < ${table.endMinute}`,
    ),
    check("availability_slot_check", sql`${table.slotMinutes} between 15 and 240`),
    check("availability_buffer_check", sql`${table.bufferMinutes} between 0 and 120`),
  ],
);

export const blockedPeriods = sqliteTable(
  "blocked_periods",
  {
    id: text("id").primaryKey(),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_blocked_periods_employee_time").on(
      table.employeeProfileId,
      table.startAt,
      table.endAt,
    ),
    check("blocked_period_window_check", sql`${table.startAt} < ${table.endAt}`),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    publicReference: text("public_reference").notNull(),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientNote: text("client_note").notNull().default(""),
    status: text("status").$type<AppointmentStatus>().notNull().default("booked"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_appointments_public_reference").on(table.publicReference),
    index("idx_appointments_employee_time").on(
      table.employeeProfileId,
      table.startAt,
      table.endAt,
    ),
    index("idx_appointments_retention").on(table.endAt),
    uniqueIndex("idx_appointments_employee_start_booked")
      .on(table.employeeProfileId, table.startAt)
      .where(sql`${table.status} = 'booked'`),
    check(
      "appointments_status_check",
      sql`${table.status} in ('booked', 'cancelled')`,
    ),
    check("appointments_window_check", sql`${table.startAt} < ${table.endAt}`),
  ],
);
