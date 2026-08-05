import {
  and,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
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

  let accountRetryAt = row?.lockedUntil ?? null;
  if (row?.lockedUntil && Date.parse(row.lockedUntil) <= now.getTime()) {
    await db
      .update(credentials)
      .set({ failedAttempts: 0, lockedUntil: null, updatedAt: now.toISOString() })
      .where(eq(credentials.membershipId, row.membershipId));
    row.failedAttempts = 0;
    row.lockedUntil = null;
    accountRetryAt = null;
  }

  let subjectRetryAt = attempt?.lockedUntil ?? null;
  if (
    attempt
    && (Date.parse(attempt.windowStartedAt) + LOGIN_WINDOW_MS <= now.getTime()
      || (attempt.lockedUntil && Date.parse(attempt.lockedUntil) <= now.getTime()))
  ) {
    await db
      .delete(loginAttempts)
      .where(
        and(
          eq(loginAttempts.emailHash, emailHash),
          eq(loginAttempts.fingerprintHash, fingerprintHash),
        ),
      );
    subjectRetryAt = null;
  }

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
  const [attempt] = await db
    .select({
      id: loginAttempts.id,
      failedAttempts: loginAttempts.failedAttempts,
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
  const inWindow = attempt
    && Date.parse(attempt.windowStartedAt) + LOGIN_WINDOW_MS > now.getTime();
  const subjectFailures = inWindow ? attempt.failedAttempts + 1 : 1;
  const subjectLock = loginLockUntil(subjectFailures, now);
  const subjectWrite = db
    .insert(loginAttempts)
    .values({
      id: attempt?.id ?? crypto.randomUUID(),
      emailHash,
      fingerprintHash,
      failedAttempts: subjectFailures,
      windowStartedAt: inWindow ? attempt.windowStartedAt : now.toISOString(),
      lockedUntil: subjectLock,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [loginAttempts.emailHash, loginAttempts.fingerprintHash],
      set: {
        failedAttempts: subjectFailures,
        windowStartedAt: inWindow ? attempt.windowStartedAt : now.toISOString(),
        lockedUntil: subjectLock,
        updatedAt: now.toISOString(),
      },
    });

  if (!membershipId) {
    await subjectWrite;
    return subjectLock;
  }

  const [credential] = await db
    .select({ failedAttempts: credentials.failedAttempts })
    .from(credentials)
    .where(eq(credentials.membershipId, membershipId))
    .limit(1);
  const accountFailures = (credential?.failedAttempts ?? 0) + 1;
  const accountLock = loginLockUntil(accountFailures, now);
  await db.batch([
    subjectWrite,
    db
      .update(credentials)
      .set({
        failedAttempts: accountFailures,
        lockedUntil: accountLock,
        updatedAt: now.toISOString(),
      })
      .where(eq(credentials.membershipId, membershipId)),
  ]);
  return laterRetry(accountLock, subjectLock);
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
  },
): Promise<{ membershipId: string } | null> {
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
  const email = normalizedEmail(input.email);
  await db.batch([
    db.insert(memberships).values({
      id: membershipId,
      oaiUserId: null,
      email,
      displayName: input.displayName,
      role: "employee",
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    db.insert(credentials).values({
      id: crypto.randomUUID(),
      membershipId,
      email,
      passwordHash: input.verifier.hash,
      passwordSalt: input.verifier.salt,
      passwordIterations: input.verifier.iterations,
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    db
      .update(employeeProfiles)
      .set({ membershipId, updatedAt: timestamp })
      .where(
        and(
          eq(employeeProfiles.id, input.employeeProfileId),
          eq(employeeProfiles.active, true),
          isNull(employeeProfiles.membershipId),
        ),
      ),
  ]);
  return { membershipId };
}

export async function replaceStaffPasswordVerifier(
  administratorMembershipId: string,
  targetMembershipId: string,
  verifier: PasswordVerifier,
  now = new Date(),
): Promise<boolean> {
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
    .select({ membershipId: credentials.membershipId })
    .from(credentials)
    .where(eq(credentials.membershipId, targetMembershipId))
    .limit(1);
  if (!administrator || !target) return false;

  await db.batch([
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
      .where(eq(credentials.membershipId, targetMembershipId)),
    db
      .update(authSessions)
      .set({ revokedAt: now.toISOString() })
      .where(
        and(
          eq(authSessions.membershipId, targetMembershipId),
          isNull(authSessions.revokedAt),
        ),
      ),
  ]);
  return true;
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

async function database() {
  const { getDb } = await import("../../db");
  return getDb();
}
