import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
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

export const runtimeState = sqliteTable("runtime_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("idx_workspaces_slug").on(table.slug)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("idx_accounts_email").on(table.email)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role").$type<TeamRole>().notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_memberships_workspace_account").on(
      table.workspaceId,
      table.accountId,
    ),
    index("idx_memberships_account_active").on(table.accountId, table.active),
    check("memberships_role_check", sql`${table.role} in ('admin', 'employee')`),
  ],
);

export const employeeProfiles = sqliteTable(
  "employee_profiles",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
    index("idx_employee_profiles_workspace_active_sort").on(
      table.workspaceId,
      table.active,
      table.sortOrder,
    ),
  ],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_services_workspace_slug").on(table.workspaceId, table.slug),
    uniqueIndex("idx_services_workspace_id").on(table.workspaceId, table.id),
    index("idx_services_workspace_active_sort").on(
      table.workspaceId,
      table.active,
      table.sortOrder,
    ),
    check(
      "services_duration_check",
      sql`${table.durationMinutes} between 15 and 480 and ${table.durationMinutes} % 15 = 0`,
    ),
  ],
);

export const workspaceEmbedPreferences = sqliteTable(
  "workspace_embed_preferences",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    defaultMode: text("default_mode")
      .$type<"floating" | "inline">()
      .notNull(),
    defaultServiceScope: text("default_service_scope")
      .$type<"all" | "service">()
      .notNull(),
    defaultServiceId: text("default_service_id"),
    ...timestamps,
  },
  (table) => [
    check(
      "workspace_embed_preferences_default_mode_check",
      sql`${table.defaultMode} in ('floating', 'inline')`,
    ),
    check(
      "workspace_embed_preferences_service_scope_check",
      sql`(
        ${table.defaultServiceScope} = 'all' and ${table.defaultServiceId} is null
      ) or (
        ${table.defaultServiceScope} = 'service' and ${table.defaultServiceId} is not null
      )`,
    ),
    foreignKey({
      name: "workspace_embed_preferences_service_workspace_fk",
      columns: [table.workspaceId, table.defaultServiceId],
      foreignColumns: [services.workspaceId, services.id],
    }),
  ],
);

export const employeeServiceQualifications = sqliteTable(
  "employee_service_qualifications",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    method: text("method").$type<"manual" | "certificate">().notNull(),
    certificateName: text("certificate_name"),
    certificateReference: text("certificate_reference"),
    issuedOn: text("issued_on"),
    expiresOn: text("expires_on"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_employee_service_qualifications_pair").on(
      table.workspaceId,
      table.employeeProfileId,
      table.serviceId,
    ),
    index("idx_employee_service_qualifications_service_active").on(
      table.workspaceId,
      table.serviceId,
      table.active,
      table.expiresOn,
    ),
    index("idx_employee_service_qualifications_employee_active").on(
      table.workspaceId,
      table.employeeProfileId,
      table.active,
    ),
    check(
      "employee_service_qualifications_method_check",
      sql`${table.method} in ('manual', 'certificate')`,
    ),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    emailHash: text("email_hash").notNull(),
    role: text("role").$type<TeamRole>().notNull().default("employee"),
    employeeProfileId: text("employee_profile_id").references(
      () => employeeProfiles.id,
      { onDelete: "cascade" },
    ),
    expiresAt: text("expires_at").notNull(),
    redeemedAt: text("redeemed_at"),
    createdByMembershipId: text("created_by_membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_invitations_code_hash").on(table.codeHash),
    index("idx_invitations_workspace_expiry").on(
      table.workspaceId,
      table.expiresAt,
    ),
    check("invitations_role_check", sql`${table.role} in ('admin', 'employee')`),
  ],
);

export const availabilityRules = sqliteTable(
  "availability_rules",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
      table.workspaceId,
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
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
      table.workspaceId,
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
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    publicReference: text("public_reference").notNull(),
    serviceId: text("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    serviceName: text("service_name").notNull().default("General appointment"),
    serviceDurationMinutes: integer("service_duration_minutes").notNull().default(30),
    employeeProfileId: text("employee_profile_id")
      .notNull()
      .references(() => employeeProfiles.id, { onDelete: "cascade" }),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    clientName: text("client_name").notNull(),
    clientAddress: text("client_address").notNull().default(""),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    clientNote: text("client_note").notNull().default(""),
    status: text("status").$type<AppointmentStatus>().notNull().default("booked"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_appointments_public_reference").on(table.publicReference),
    index("idx_appointments_employee_time").on(
      table.workspaceId,
      table.employeeProfileId,
      table.startAt,
      table.endAt,
    ),
    index("idx_appointments_retention").on(table.endAt),
    index("idx_appointments_service").on(table.workspaceId, table.serviceId),
    uniqueIndex("idx_appointments_employee_start_booked")
      .on(table.workspaceId, table.employeeProfileId, table.startAt)
      .where(sql`${table.status} = 'booked'`),
    check(
      "appointments_status_check",
      sql`${table.status} in ('booked', 'cancelled')`,
    ),
    check("appointments_window_check", sql`${table.startAt} < ${table.endAt}`),
    check(
      "appointments_service_duration_check",
      sql`${table.serviceDurationMinutes} between 15 and 480 and ${table.serviceDurationMinutes} % 15 = 0`,
    ),
  ],
);

export const credentials = sqliteTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id, {
      onDelete: "cascade",
    }),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    mustChangePassword: integer("must_change_password", { mode: "boolean" })
      .notNull()
      .default(true),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: text("locked_until"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_credentials_account_id").on(table.accountId),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id, {
      onDelete: "cascade",
    }),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at").notNull(),
    idleExpiresAt: text("idle_expires_at").notNull(),
    absoluteExpiresAt: text("absolute_expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_account_expiry").on(
      table.accountId,
      table.idleExpiresAt,
      table.absoluteExpiresAt,
    ),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    windowStartedAt: text("window_started_at").notNull(),
    lockedUntil: text("locked_until"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_login_attempts_subject").on(
      table.emailHash,
      table.fingerprintHash,
    ),
    index("idx_login_attempts_updated").on(table.updatedAt),
  ],
);
