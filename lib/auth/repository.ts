import {
  and,
  eq,
  exists,
  gt,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  authSessions,
  credentials,
  employeeProfiles,
  loginAttempts,
  memberships,
} from "../../db/schema";
import type { CredentialRecord, SessionActorRecord } from "../data/contracts";
import type { PasswordVerifier } from "./password";

const IDLE_SESSION_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

type SessionUsabilityRecord = {
  revokedAt: string | null;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};

export function nextIdleExpiry(now: Date, absoluteExpiry: string): string {
  return new Date(
    Math.min(now.getTime() + IDLE_SESSION_MS, Date.parse(absoluteExpiry)),
  ).toISOString();
}

export function loginLockUntil(failedAttempts: number, now: Date): string | null {
  return failedAttempts >= 5
    ? new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString()
    : null;
}

export function subjectAttemptShouldReset(
  record: { windowStartedAt: string; lockedUntil: string | null },
  now: Date,
): boolean {
  if (record.lockedUntil && Date.parse(record.lockedUntil) > now.getTime()) {
    return false;
  }
  return Date.parse(record.windowStartedAt) + LOGIN_WINDOW_MS <= now.getTime()
    || Boolean(record.lockedUntil);
}

export function atomicFailureIncrement(column: AnySQLiteColumn): SQL<number> {
  return sql<number>`${column} + 1`;
}

export function staffPasswordResetIsAllowed(
  record: {
    role: "admin" | "employee";
    membershipActive: boolean;
    profileActive: boolean | null;
    profileMembershipId: string | null;
  },
  targetMembershipId: string,
): boolean {
  return record.role === "employee"
    && record.membershipActive
    && record.profileActive === true
    && record.profileMembershipId === targetMembershipId;
}

export function sessionIsUsable(
  record: SessionUsabilityRecord,
  now: Date,
): boolean {
  return record.revokedAt === null
    && Date.parse(record.idleExpiresAt) > now.getTime()
    && Date.parse(record.absoluteExpiresAt) > now.getTime();
}

export async function administratorExists(): Promise<boolean> {
  const db = await database();
  const [administrator] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.role, "admin"), eq(memberships.active, true)))
    .limit(1);
  return Boolean(administrator);
}

export async function createAdministratorAccount(input: {
  email: string;
  displayName: string;
  verifier: PasswordVerifier;
  mustChangePassword: false;
}): Promise<{ membershipId: string }> {
  const db = await database();
  const membershipId = crypto.randomUUID();
  const now = new Date().toISOString();
  const email = normalizedEmail(input.email);
  await db.batch([
    db.insert(memberships).values({
      id: membershipId,
      oaiUserId: null,
      email,
      displayName: input.displayName,
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(credentials).values({
      id: crypto.randomUUID(),
      membershipId,
      email,
      passwordHash: input.verifier.hash,
      passwordSalt: input.verifier.salt,
      passwordIterations: input.verifier.iterations,
      mustChangePassword: input.mustChangePassword,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
  return { membershipId };
}

export async function findCredentialByEmail(
  email: string,
  emailHash: string,
  fingerprintHash: string,
  now = new Date(),
): Promise<{ credential: CredentialRecord | null; retryAt: string | null }> {
  const db = await database();
  await cleanupAuthState(db, now);

  const [row] = await db
    .select({
      membershipId: memberships.id,
      employeeProfileId: employeeProfiles.id,
      displayName: memberships.displayName,
      role: memberships.role,
      active: memberships.active,
      email: credentials.email,
      passwordHash: credentials.passwordHash,
      passwordSalt: credentials.passwordSalt,
      passwordIterations: credentials.passwordIterations,
      mustChangePassword: credentials.mustChangePassword,
      lockedUntil: credentials.lockedUntil,
      failedAttempts: credentials.failedAttempts,
    })
    .from(credentials)
    .innerJoin(memberships, eq(memberships.id, credentials.membershipId))
    .leftJoin(employeeProfiles, eq(employeeProfiles.membershipId, memberships.id))
    .where(eq(credentials.email, normalizedEmail(email)))
    .limit(1);
  const [attempt] = await db
    .select({
      lockedUntil: loginAttempts.lockedUntil,
      windowStartedAt: loginAttempts.windowStartedAt,
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.fingerprintHash, fingerprintHash),
      ),
    )
    .limit(1);

  const accountRetryAt = row?.lockedUntil
    && Date.parse(row.lockedUntil) > now.getTime()
    ? row.lockedUntil
    : null;
  const subjectRetryAt = attempt && !subjectAttemptShouldReset(attempt, now)
    ? attempt.lockedUntil
    : null;

  const credential = row
    ? {
        membershipId: row.membershipId,
        employeeProfileId: row.employeeProfileId,
        displayName: row.displayName,
        role: row.role,
        active: row.active,
        email: row.email,
        passwordHash: row.passwordHash,
        passwordSalt: row.passwordSalt,
        passwordIterations: row.passwordIterations,
        mustChangePassword: row.mustChangePassword,
        lockedUntil: row.lockedUntil,
      }
    : null;
  return { credential, retryAt: laterRetry(accountRetryAt, subjectRetryAt) };
}

export async function recordFailedLogin(
  emailHash: string,
  fingerprintHash: string,
  membershipId: string | null,
  now = new Date(),
): Promise<string | null> {
  const db = await database();
  const timestamp = now.toISOString();
  const windowCutoff = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();
  const lockUntil = new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString();
  const subjectIncrement = atomicFailureIncrement(loginAttempts.failedAttempts);
  const subjectWrite = db
    .insert(loginAttempts)
    .values({
      id: crypto.randomUUID(),
      emailHash,
      fingerprintHash,
      failedAttempts: 1,
      windowStartedAt: timestamp,
      lockedUntil: null,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [loginAttempts.emailHash, loginAttempts.fingerprintHash],
      set: {
        failedAttempts: sql<number>`case
          when ${loginAttempts.lockedUntil} > ${timestamp} then ${subjectIncrement}
          when ${loginAttempts.windowStartedAt} <= ${windowCutoff} then 1
          else ${subjectIncrement}
        end`,
        windowStartedAt: sql<string>`case
          when ${loginAttempts.lockedUntil} > ${timestamp} then ${loginAttempts.windowStartedAt}
          when ${loginAttempts.windowStartedAt} <= ${windowCutoff} then ${timestamp}
          else ${loginAttempts.windowStartedAt}
        end`,
        lockedUntil: sql<string | null>`case
          when ${loginAttempts.lockedUntil} > ${timestamp} then ${loginAttempts.lockedUntil}
          when ${loginAttempts.windowStartedAt} <= ${windowCutoff} then null
          when ${subjectIncrement} >= 5 then ${lockUntil}
          else null
        end`,
        updatedAt: timestamp,
      },
    })
    .returning({ lockedUntil: loginAttempts.lockedUntil });

  if (!membershipId) {
    const [subject] = await subjectWrite;
    return subject?.lockedUntil ?? null;
  }

  const accountIncrement = atomicFailureIncrement(credentials.failedAttempts);
  const accountWrite = db
    .update(credentials)
    .set({
      failedAttempts: sql<number>`case
        when ${credentials.lockedUntil} is not null
          and ${credentials.lockedUntil} <= ${timestamp} then 1
        else ${accountIncrement}
      end`,
      lockedUntil: sql<string | null>`case
        when ${credentials.lockedUntil} > ${timestamp} then ${credentials.lockedUntil}
        when ${credentials.lockedUntil} is not null
          and ${credentials.lockedUntil} <= ${timestamp} then null
        when ${accountIncrement} >= 5 then ${lockUntil}
        else null
      end`,
      updatedAt: timestamp,
    })
    .where(eq(credentials.membershipId, membershipId))
    .returning({ lockedUntil: credentials.lockedUntil });
  const [subjectRows, accountRows] = await db.batch([
    subjectWrite,
    accountWrite,
  ]);
  return laterRetry(
    accountRows[0]?.lockedUntil ?? null,
    subjectRows[0]?.lockedUntil ?? null,
  );
}

export async function clearFailedLogins(
  emailHash: string,
  fingerprintHash: string,
  membershipId: string,
): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.batch([
    db
      .delete(loginAttempts)
      .where(
        and(
          eq(loginAttempts.emailHash, emailHash),
          eq(loginAttempts.fingerprintHash, fingerprintHash),
        ),
      ),
    db
      .update(credentials)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: now })
      .where(eq(credentials.membershipId, membershipId)),
  ]);
}

export async function createAuthSession(
  membershipId: string,
  tokenHash: string,
  times: {
    createdAt: string;
    lastUsedAt: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  },
): Promise<void> {
  const db = await database();
  await db.insert(authSessions).values({
    id: crypto.randomUUID(),
    membershipId,
    tokenHash,
    ...times,
    revokedAt: null,
  });
}

export async function findSessionActor(
  tokenHash: string,
  now = new Date(),
): Promise<SessionActorRecord | null> {
  const db = await database();
  await cleanupAuthState(db, now);
  const [actor] = await db
    .select({
      membershipId: memberships.id,
      employeeProfileId: employeeProfiles.id,
      displayName: memberships.displayName,
      email: credentials.email,
      role: memberships.role,
      active: memberships.active,
      mustChangePassword: credentials.mustChangePassword,
      idleExpiresAt: authSessions.idleExpiresAt,
      absoluteExpiresAt: authSessions.absoluteExpiresAt,
    })
    .from(authSessions)
    .innerJoin(memberships, eq(memberships.id, authSessions.membershipId))
    .innerJoin(credentials, eq(credentials.membershipId, memberships.id))
    .leftJoin(employeeProfiles, eq(employeeProfiles.membershipId, memberships.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.idleExpiresAt, now.toISOString()),
        gt(authSessions.absoluteExpiresAt, now.toISOString()),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!actor) return null;

  const idleExpiresAt = nextIdleExpiry(now, actor.absoluteExpiresAt);
  await db
    .update(authSessions)
    .set({ lastUsedAt: now.toISOString(), idleExpiresAt })
    .where(eq(authSessions.tokenHash, tokenHash));
  return { ...actor, idleExpiresAt };
}

export async function replacePassword(
  membershipId: string,
  verifier: PasswordVerifier,
): Promise<void> {
  const db = await database();
  await db
    .update(credentials)
    .set({
      passwordHash: verifier.hash,
      passwordSalt: verifier.salt,
      passwordIterations: verifier.iterations,
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(credentials.membershipId, membershipId));
}

export async function revokeSession(tokenHash: string, now = new Date()): Promise<void> {
  const db = await database();
  await db
    .update(authSessions)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
}

export async function revokeMembershipSessions(
  membershipId: string,
  now = new Date(),
): Promise<void> {
  const db = await database();
  await db
    .update(authSessions)
    .set({ revokedAt: now.toISOString() })
    .where(
      and(
        eq(authSessions.membershipId, membershipId),
        isNull(authSessions.revokedAt),
      ),
    );
}

export async function insertStaffCredential(
  administratorMembershipId: string,
  input: {
    employeeProfileId: string;
    email: string;
    displayName: string;
    verifier: PasswordVerifier;
    confirm: boolean;
  },
): Promise<{ membershipId: string } | null> {
  if (
    input.confirm !== true
    || !validEmployeeProfileId(input.employeeProfileId)
    || !validNormalizedEmail(input.email)
    || !validTrimmedDisplayName(input.displayName)
  ) {
    return null;
  }

  const db = await database();
  const [administrator] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, administratorMembershipId),
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
        eq(employeeProfiles.id, input.employeeProfileId),
        eq(employeeProfiles.active, true),
        isNull(employeeProfiles.membershipId),
      ),
    )
    .limit(1);
  if (!administrator || !profile) return null;

  const membershipId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const email = input.email;
  const administratorIsActive = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, administratorMembershipId),
          eq(memberships.role, "admin"),
          eq(memberships.active, true),
        ),
      ),
  );
  const profileIsEligible = and(
    eq(employeeProfiles.id, input.employeeProfileId),
    eq(employeeProfiles.active, true),
    isNull(employeeProfiles.membershipId),
    administratorIsActive,
  );
  const membershipExists = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.role, "employee"),
          eq(memberships.active, true),
        ),
      ),
  );
  const results = await db.batch([
    db.insert(memberships).select(
      db
        .select({
          id: sql<string>`${membershipId}`.as("id"),
          oaiUserId: sql<string | null>`null`.as("oai_user_id"),
          email: sql<string>`${email}`.as("email"),
          displayName: sql<string>`${input.displayName}`.as("display_name"),
          role: sql<"employee">`'employee'`.as("role"),
          active: sql<boolean>`true`.as("active"),
          createdAt: sql<string>`${timestamp}`.as("created_at"),
          updatedAt: sql<string>`${timestamp}`.as("updated_at"),
        })
        .from(employeeProfiles)
        .where(profileIsEligible)
        .limit(1),
    ),
    db.insert(credentials).select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          membershipId: sql<string>`${membershipId}`.as("membership_id"),
          email: sql<string>`${email}`.as("email"),
          passwordHash: sql<string>`${input.verifier.hash}`.as("password_hash"),
          passwordSalt: sql<string>`${input.verifier.salt}`.as("password_salt"),
          passwordIterations: sql<number>`${input.verifier.iterations}`.as(
            "password_iterations",
          ),
          mustChangePassword: sql<boolean>`true`.as("must_change_password"),
          failedAttempts: sql<number>`0`.as("failed_attempts"),
          lockedUntil: sql<string | null>`null`.as("locked_until"),
          createdAt: sql<string>`${timestamp}`.as("created_at"),
          updatedAt: sql<string>`${timestamp}`.as("updated_at"),
        })
        .from(employeeProfiles)
        .where(and(profileIsEligible, membershipExists))
        .limit(1),
    ),
    db
      .update(employeeProfiles)
      .set({ membershipId, updatedAt: timestamp })
      .where(and(profileIsEligible, membershipExists)),
  ]);
  if (!requiredWritesChanged(results, [0, 1, 2])) return null;
  return { membershipId };
}

export async function replaceStaffPasswordVerifier(
  administratorMembershipId: string,
  employeeProfileId: string,
  verifier: PasswordVerifier,
  confirm: boolean,
  now = new Date(),
): Promise<boolean> {
  if (confirm !== true || !validEmployeeProfileId(employeeProfileId)) return false;

  const db = await database();
  const [administrator] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, administratorMembershipId),
        eq(memberships.role, "admin"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  const [target] = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      membershipActive: memberships.active,
      profileActive: employeeProfiles.active,
      profileMembershipId: employeeProfiles.membershipId,
    })
    .from(credentials)
    .innerJoin(memberships, eq(memberships.id, credentials.membershipId))
    .leftJoin(employeeProfiles, eq(employeeProfiles.membershipId, memberships.id))
    .where(eq(employeeProfiles.id, employeeProfileId))
    .limit(1);
  if (
    !administrator
    || !target
    || !staffPasswordResetIsAllowed(target, target.membershipId)
  ) return false;

  const administratorIsActive = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, administratorMembershipId),
          eq(memberships.role, "admin"),
          eq(memberships.active, true),
        ),
      ),
  );
  const targetIsCurrentAndActive = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(
        employeeProfiles,
        eq(employeeProfiles.membershipId, memberships.id),
      )
      .where(
        and(
          eq(memberships.id, target.membershipId),
          eq(memberships.role, "employee"),
          eq(memberships.active, true),
          eq(employeeProfiles.id, employeeProfileId),
          eq(employeeProfiles.active, true),
          administratorIsActive,
        ),
      ),
  );
  const results = await db.batch([
    db
      .update(credentials)
      .set({
        passwordHash: verifier.hash,
        passwordSalt: verifier.salt,
        passwordIterations: verifier.iterations,
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: now.toISOString(),
      })
      .where(
        and(
          eq(credentials.membershipId, target.membershipId),
          targetIsCurrentAndActive,
        ),
      ),
    db
      .update(authSessions)
      .set({ revokedAt: now.toISOString() })
      .where(
        and(
          eq(authSessions.membershipId, target.membershipId),
          isNull(authSessions.revokedAt),
          targetIsCurrentAndActive,
        ),
      ),
  ]);
  return requiredWritesChanged(results, [0]);
}

export async function setStaffActiveState(
  administratorMembershipId: string,
  employeeProfileId: string,
  active: boolean,
  confirm: boolean,
  now = new Date(),
): Promise<{ membershipId: string } | null> {
  if (confirm !== true || !validEmployeeProfileId(employeeProfileId)) return null;

  const db = await database();
  const [administrator] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, administratorMembershipId),
        eq(memberships.role, "admin"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  const [target] = await db
    .select({
      membershipId: memberships.id,
      role: memberships.role,
      profileMembershipId: employeeProfiles.membershipId,
    })
    .from(employeeProfiles)
    .innerJoin(memberships, eq(memberships.id, employeeProfiles.membershipId))
    .where(eq(employeeProfiles.id, employeeProfileId))
    .limit(1);
  if (
    !administrator
    || !target
    || target.role !== "employee"
    || target.profileMembershipId !== target.membershipId
  ) {
    return null;
  }

  const timestamp = now.toISOString();
  const administratorIsActive = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, administratorMembershipId),
          eq(memberships.role, "admin"),
          eq(memberships.active, true),
        ),
      ),
  );
  const targetIsCurrent = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(
        employeeProfiles,
        eq(employeeProfiles.membershipId, memberships.id),
      )
      .innerJoin(credentials, eq(credentials.membershipId, memberships.id))
      .where(
        and(
          eq(memberships.id, target.membershipId),
          eq(memberships.role, "employee"),
          eq(employeeProfiles.id, employeeProfileId),
          administratorIsActive,
        ),
      ),
  );
  const membershipUpdate = db
    .update(memberships)
    .set({ active, updatedAt: timestamp })
    .where(
      and(
        eq(memberships.id, target.membershipId),
        eq(memberships.role, "employee"),
        administratorIsActive,
        targetIsCurrent,
      ),
    );
  const profileUpdate = db
    .update(employeeProfiles)
    .set({ active, updatedAt: timestamp })
    .where(
      and(
        eq(employeeProfiles.id, employeeProfileId),
        eq(employeeProfiles.membershipId, target.membershipId),
        administratorIsActive,
        targetIsCurrent,
      ),
    );
  const sessionRevocation = db
    .update(authSessions)
    .set({ revokedAt: timestamp })
    .where(
      and(
        eq(authSessions.membershipId, target.membershipId),
        isNull(authSessions.revokedAt),
        administratorIsActive,
        targetIsCurrent,
      ),
    );
  const results = active
    ? await db.batch([membershipUpdate, profileUpdate])
    : await db.batch([membershipUpdate, profileUpdate, sessionRevocation]);
  if (!requiredWritesChanged(results, [0, 1])) return null;
  return { membershipId: target.membershipId };
}

type AuthDatabase = Awaited<ReturnType<typeof database>>;

async function cleanupAuthState(db: AuthDatabase, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  const attemptCutoff = new Date(now.getTime() - ATTEMPT_RETENTION_MS).toISOString();
  await db.batch([
    db.delete(loginAttempts).where(lte(loginAttempts.updatedAt, attemptCutoff)),
    db
      .delete(authSessions)
      .where(
        or(
          isNotNull(authSessions.revokedAt),
          lte(authSessions.idleExpiresAt, timestamp),
          lte(authSessions.absoluteExpiresAt, timestamp),
        ),
      ),
  ]);
}

function laterRetry(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

const SAFE_EMPLOYEE_PROFILE_ID = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validEmployeeProfileId(value: string): boolean {
  return value !== "all" && SAFE_EMPLOYEE_PROFILE_ID.test(value);
}

function validNormalizedEmail(value: string): boolean {
  return value.length <= 254 && value === normalizedEmail(value) && EMAIL.test(value);
}

function validTrimmedDisplayName(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && value === value.trim();
}

function requiredWritesChanged(results: readonly unknown[], indexes: readonly number[]): boolean {
  return indexes.every((index) => {
    const result = results[index] as { meta?: { changes?: unknown } } | undefined;
    return Number(result?.meta?.changes ?? 0) === 1;
  });
}

async function database() {
  const { getDb } = await import("../../db");
  return getDb();
}
