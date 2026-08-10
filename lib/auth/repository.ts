import {
  and,
  asc,
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
  accounts,
  authSessions,
  availabilityRules,
  credentials,
  employeeServiceQualifications,
  employeeProfiles,
  invitations,
  loginAttempts,
  memberships,
  runtimeState,
  services,
  workspaces,
} from "../../db/schema";
import type {
  AccountSessionRecord,
  CredentialRecord,
  WorkspaceSummary,
  WorkspaceMembershipRecord,
} from "../data/contracts";
import type { PasswordVerifier } from "./password";
import {
  generalQualificationValues,
  generalServiceValues,
} from "../services/defaults";
import {
  INITIAL_AVAILABILITY_MARKER,
  initialAvailabilityValues,
  initialProfileValues,
} from "../data/initial-roster";

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
    .select({ id: memberships.id, workspaceId: memberships.workspaceId })
    .from(memberships)
    .where(and(eq(memberships.role, "admin"), eq(memberships.active, true)))
    .limit(1);
  return Boolean(administrator);
}

export async function createInitialWorkspaceAdministrator(input: {
  workspaceName: string;
  workspaceSlug: string;
  email: string;
  displayName: string;
  verifier: PasswordVerifier;
  mustChangePassword: false;
}): Promise<{ accountId: string; workspaceSlug: string }> {
  const db = await database();
  const workspaceId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const now = new Date().toISOString();
  const email = normalizedEmail(input.email);
  const initialProfiles = initialProfileValues(workspaceId);
  const initialAvailability = initialAvailabilityValues(workspaceId);
  await db.batch([
    db.insert(workspaces).values({
      id: workspaceId,
      name: input.workspaceName,
      slug: input.workspaceSlug,
      active: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(services).values({
      ...generalServiceValues(workspaceId),
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(employeeProfiles).values(initialProfiles),
    db.insert(employeeServiceQualifications).values(
      initialProfiles.map(generalQualificationValues),
    ),
    ...initialProfiles.map((profile) =>
      db.insert(availabilityRules).values(
        initialAvailability.filter((rule) => rule.employeeProfileId === profile.id),
      )),
    db.insert(runtimeState).values({
      key: INITIAL_AVAILABILITY_MARKER,
      value: "complete",
      updatedAt: now,
    }).onConflictDoNothing(),
    db.insert(accounts).values({
      id: accountId,
      email,
      displayName: input.displayName,
      active: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(memberships).values({
      id: membershipId,
      workspaceId,
      accountId,
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(credentials).values({
      id: crypto.randomUUID(),
      accountId,
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
  return { accountId, workspaceSlug: input.workspaceSlug };
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
      accountId: accounts.id,
      displayName: accounts.displayName,
      active: accounts.active,
      email: accounts.email,
      passwordHash: credentials.passwordHash,
      passwordSalt: credentials.passwordSalt,
      passwordIterations: credentials.passwordIterations,
      mustChangePassword: credentials.mustChangePassword,
      lockedUntil: credentials.lockedUntil,
      failedAttempts: credentials.failedAttempts,
    })
    .from(credentials)
    .innerJoin(accounts, eq(accounts.id, credentials.accountId))
    .where(eq(accounts.email, normalizedEmail(email)))
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
        accountId: row.accountId,
        displayName: row.displayName,
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
  accountId: string | null,
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

  if (!accountId) {
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
    .where(eq(credentials.accountId, accountId))
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
  accountId: string,
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
      .where(eq(credentials.accountId, accountId)),
  ]);
}

export async function createAuthSession(
  accountId: string,
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
    accountId,
    tokenHash,
    ...times,
    revokedAt: null,
  });
}

export async function findSessionActor(
  tokenHash: string,
  now = new Date(),
): Promise<AccountSessionRecord | null> {
  const db = await database();
  await cleanupAuthState(db, now);
  const [actor] = await db
    .select({
      accountId: accounts.id,
      displayName: accounts.displayName,
      email: accounts.email,
      active: accounts.active,
      mustChangePassword: credentials.mustChangePassword,
      idleExpiresAt: authSessions.idleExpiresAt,
      absoluteExpiresAt: authSessions.absoluteExpiresAt,
    })
    .from(authSessions)
    .innerJoin(accounts, eq(accounts.id, authSessions.accountId))
    .innerJoin(credentials, eq(credentials.accountId, accounts.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.idleExpiresAt, now.toISOString()),
        gt(authSessions.absoluteExpiresAt, now.toISOString()),
        eq(accounts.active, true),
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

export async function findWorkspaceMembership(
  accountId: string,
  workspaceSlug: string,
): Promise<WorkspaceMembershipRecord | null> {
  const db = await database();
  const [membership] = await db
    .select({
      membershipId: memberships.id,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      accountId: memberships.accountId,
      employeeProfileId: employeeProfiles.id,
      role: memberships.role,
      active: memberships.active,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .leftJoin(
      employeeProfiles,
      and(
        eq(employeeProfiles.membershipId, memberships.id),
        eq(employeeProfiles.workspaceId, workspaces.id),
      ),
    )
    .where(
      and(
        eq(memberships.accountId, accountId),
        eq(memberships.active, true),
        eq(workspaces.slug, workspaceSlug),
        eq(workspaces.active, true),
      ),
    )
    .limit(1);
  return membership ?? null;
}

export async function listAccountWorkspaces(
  accountId: string,
): Promise<WorkspaceSummary[]> {
  const db = await database();
  return db
    .select({
      name: workspaces.name,
      slug: workspaces.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(
      eq(memberships.accountId, accountId),
      eq(memberships.active, true),
      eq(workspaces.active, true),
    ))
    .orderBy(asc(workspaces.name));
}

export async function insertWorkspaceInvitation(input: {
  administratorMembershipId: string;
  emailHash: string;
  codeHash: string;
  role: "admin" | "employee";
  employeeProfileId: string | null;
  expiresAt: string;
}): Promise<boolean> {
  const db = await database();
  const [administrator] = await db
    .select({ workspaceId: memberships.workspaceId })
    .from(memberships)
    .where(and(
      eq(memberships.id, input.administratorMembershipId),
      eq(memberships.role, "admin"),
      eq(memberships.active, true),
    ))
    .limit(1);
  if (!administrator) return false;

  if (input.employeeProfileId) {
    const [profile] = await db
      .select({ id: employeeProfiles.id })
      .from(employeeProfiles)
      .where(and(
        eq(employeeProfiles.id, input.employeeProfileId),
        eq(employeeProfiles.workspaceId, administrator.workspaceId),
        isNull(employeeProfiles.membershipId),
      ))
      .limit(1);
    if (!profile) return false;
  }

  await db.insert(invitations).values({
    id: crypto.randomUUID(),
    workspaceId: administrator.workspaceId,
    codeHash: input.codeHash,
    emailHash: input.emailHash,
    role: input.role,
    employeeProfileId: input.employeeProfileId,
    expiresAt: input.expiresAt,
    createdByMembershipId: input.administratorMembershipId,
  });
  return true;
}

export async function redeemWorkspaceInvitation(input: {
  codeHash: string;
  emailHash: string;
  accountId: string;
  now: Date;
}): Promise<{ workspaceSlug: string } | null> {
  const db = await database();
  const timestamp = input.now.toISOString();
  const [invitation] = await db
    .select({
      id: invitations.id,
      workspaceId: invitations.workspaceId,
      workspaceSlug: workspaces.slug,
      emailHash: invitations.emailHash,
      role: invitations.role,
      employeeProfileId: invitations.employeeProfileId,
    })
    .from(invitations)
    .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
    .where(and(
      eq(invitations.codeHash, input.codeHash),
      eq(invitations.emailHash, input.emailHash),
      isNull(invitations.redeemedAt),
      gt(invitations.expiresAt, timestamp),
      eq(workspaces.active, true),
    ))
    .limit(1);
  if (!invitation) return null;

  const [existing] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.workspaceId, invitation.workspaceId),
      eq(memberships.accountId, input.accountId),
    ))
    .limit(1);
  if (existing) return null;

  const membershipId = crypto.randomUUID();
  const membershipInsert = db.insert(memberships).values({
    id: membershipId,
    workspaceId: invitation.workspaceId,
    accountId: input.accountId,
    role: invitation.role,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const redeem = db
    .update(invitations)
    .set({ redeemedAt: timestamp })
    .where(and(
      eq(invitations.id, invitation.id),
      isNull(invitations.redeemedAt),
      gt(invitations.expiresAt, timestamp),
    ));

  try {
    if (invitation.employeeProfileId) {
      const profileLink = db
        .update(employeeProfiles)
        .set({ membershipId, updatedAt: timestamp })
        .where(and(
          eq(employeeProfiles.id, invitation.employeeProfileId),
          eq(employeeProfiles.workspaceId, invitation.workspaceId),
          isNull(employeeProfiles.membershipId),
        ));
      const results = await db.batch([membershipInsert, profileLink, redeem]);
      if (!requiredWritesChanged(results, [0, 1, 2])) return null;
    } else {
      const results = await db.batch([membershipInsert, redeem]);
      if (!requiredWritesChanged(results, [0, 1])) return null;
    }
  } catch {
    return null;
  }
  return { workspaceSlug: invitation.workspaceSlug };
}

export async function replacePassword(
  accountId: string,
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
    .where(eq(credentials.accountId, accountId));
}

export async function revokeSession(tokenHash: string, now = new Date()): Promise<void> {
  const db = await database();
  await db
    .update(authSessions)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
}

export async function revokeAccountSessions(
  accountId: string,
  now = new Date(),
): Promise<void> {
  const db = await database();
  await db
    .update(authSessions)
    .set({ revokedAt: now.toISOString() })
    .where(
      and(
        eq(authSessions.accountId, accountId),
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
    .select({ id: memberships.id, workspaceId: memberships.workspaceId })
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
    .select({ id: employeeProfiles.id, workspaceId: employeeProfiles.workspaceId })
    .from(employeeProfiles)
    .where(
      and(
        eq(employeeProfiles.id, input.employeeProfileId),
        eq(employeeProfiles.active, true),
        isNull(employeeProfiles.membershipId),
      ),
    )
    .limit(1);
  if (
    !administrator
    || !profile
    || profile.workspaceId !== administrator.workspaceId
  ) return null;

  const accountId = crypto.randomUUID();
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
    eq(employeeProfiles.workspaceId, administrator.workspaceId),
    eq(employeeProfiles.active, true),
    isNull(employeeProfiles.membershipId),
    administratorIsActive,
  );
  const accountExists = exists(
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)),
  );
  const membershipExists = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, membershipId),
          eq(memberships.workspaceId, administrator.workspaceId),
          eq(memberships.accountId, accountId),
          eq(memberships.role, "employee"),
          eq(memberships.active, true),
        ),
      ),
  );
  const results = await db.batch([
    db.insert(accounts).select(
      db
        .select({
          id: sql<string>`${accountId}`.as("id"),
          email: sql<string>`${email}`.as("email"),
          displayName: sql<string>`${input.displayName}`.as("display_name"),
          active: sql<boolean>`true`.as("active"),
          createdAt: sql<string>`${timestamp}`.as("created_at"),
          updatedAt: sql<string>`${timestamp}`.as("updated_at"),
        })
        .from(employeeProfiles)
        .where(profileIsEligible)
        .limit(1),
    ),
    db.insert(memberships).select(
      db
        .select({
          id: sql<string>`${membershipId}`.as("id"),
          workspaceId: sql<string>`${administrator.workspaceId}`.as("workspace_id"),
          accountId: sql<string>`${accountId}`.as("account_id"),
          role: sql<"employee">`'employee'`.as("role"),
          active: sql<boolean>`true`.as("active"),
          createdAt: sql<string>`${timestamp}`.as("created_at"),
          updatedAt: sql<string>`${timestamp}`.as("updated_at"),
        })
        .from(employeeProfiles)
        .where(and(profileIsEligible, accountExists))
        .limit(1),
    ),
    db.insert(credentials).select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          accountId: sql<string>`${accountId}`.as("account_id"),
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
        .where(and(profileIsEligible, accountExists, membershipExists))
        .limit(1),
    ),
    db
      .update(employeeProfiles)
      .set({ membershipId, updatedAt: timestamp })
      .where(and(profileIsEligible, membershipExists)),
  ]);
  if (!requiredWritesChanged(results, [0, 1, 2, 3])) return null;
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
    .select({ id: memberships.id, workspaceId: memberships.workspaceId })
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
      accountId: memberships.accountId,
      membershipId: memberships.id,
      workspaceId: memberships.workspaceId,
      role: memberships.role,
      membershipActive: memberships.active,
      profileActive: employeeProfiles.active,
      profileMembershipId: employeeProfiles.membershipId,
    })
    .from(employeeProfiles)
    .innerJoin(memberships, eq(memberships.id, employeeProfiles.membershipId))
    .innerJoin(accounts, eq(accounts.id, memberships.accountId))
    .innerJoin(credentials, eq(credentials.accountId, accounts.id))
    .where(eq(employeeProfiles.id, employeeProfileId))
    .limit(1);
  if (
    !administrator
    || !target
    || administrator.workspaceId !== target.workspaceId
    || !staffPasswordResetIsAllowed(target, target.membershipId)
  ) return false;

  const administratorIsActive = exists(
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.id, administratorMembershipId),
          eq(memberships.workspaceId, administrator.workspaceId),
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
          eq(memberships.workspaceId, administrator.workspaceId),
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
          eq(credentials.accountId, target.accountId),
          targetIsCurrentAndActive,
        ),
      ),
    db
      .update(authSessions)
      .set({ revokedAt: now.toISOString() })
      .where(
        and(
          eq(authSessions.accountId, target.accountId),
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
    .select({ id: memberships.id, workspaceId: memberships.workspaceId })
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
      accountId: memberships.accountId,
      membershipId: memberships.id,
      workspaceId: memberships.workspaceId,
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
    || administrator.workspaceId !== target.workspaceId
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
          eq(memberships.workspaceId, administrator.workspaceId),
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
      .innerJoin(credentials, eq(credentials.accountId, memberships.accountId))
      .where(
        and(
          eq(memberships.id, target.membershipId),
          eq(memberships.workspaceId, administrator.workspaceId),
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
  const results = await db.batch([membershipUpdate, profileUpdate]);
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
