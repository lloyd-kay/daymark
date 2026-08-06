import type { CredentialRecord, SessionActorRecord } from "../data/contracts";
import {
  normalizeWorkspaceSlug,
  workspaceSlugError,
} from "../workspaces/slug";
import type { PasswordVerifier } from "./password";

const INVALID_CREDENTIALS = "Email or password not recognised.";
const LOCKED_OUT = "Too many attempts. Try again in 15 minutes.";
const IDLE_SESSION_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const DUMMY_VERIFIER = {
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  hash: "A0Bw09WO7-dVT6w2l1AasdIZCVZwAvyGoFtu5dQAg7U",
  iterations: 210_000,
};

export type AuthResult = {
  status: number;
  body: {
    ok: boolean;
    error?: string;
    mustChangePassword?: boolean;
    workspaceSlug?: string;
  };
  session?: { token: string; expiresAt: string };
};

type CredentialLookup = {
  credential: CredentialRecord | null;
  retryAt: string | null;
};

type SessionTimes = {
  createdAt: string;
  lastUsedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
};

export type AuthDependencies = {
  administratorExists(): Promise<boolean>;
  createInitialWorkspaceAdministrator(input: {
    workspaceName: string;
    workspaceSlug: string;
    email: string;
    displayName: string;
    verifier: PasswordVerifier;
    mustChangePassword: false;
  }): Promise<{ accountId: string; workspaceSlug: string }>;
  findCredentialByEmail(
    email: string,
    emailHash: string,
    fingerprintHash: string,
    now: Date,
  ): Promise<CredentialLookup>;
  recordFailedLogin(
    emailHash: string,
    fingerprintHash: string,
    accountId: string | null,
    now: Date,
  ): Promise<string | null>;
  clearFailedLogins(
    emailHash: string,
    fingerprintHash: string,
    accountId: string,
  ): Promise<void>;
  createAuthSession(
    accountId: string,
    tokenHash: string,
    times: SessionTimes,
  ): Promise<void>;
  findSessionActor(tokenHash: string, now: Date): Promise<SessionActorRecord | null>;
  replacePassword(accountId: string, verifier: PasswordVerifier): Promise<void>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  revokeAccountSessions(accountId: string, now: Date): Promise<void>;
  hashOpaqueValue(value: string): Promise<string>;
  hashPassword(password: string): Promise<PasswordVerifier>;
  verifyPassword(password: string, verifier: PasswordVerifier): Promise<boolean>;
  generateSessionToken(): string;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function createAuthService(dependencies: AuthDependencies) {
  async function issueSession(
    accountId: string,
    mustChangePassword: boolean,
    now: Date,
  ): Promise<AuthResult> {
    const token = dependencies.generateSessionToken();
    const tokenHash = await dependencies.hashOpaqueValue(token);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_MS).toISOString();
    await dependencies.createAuthSession(accountId, tokenHash, {
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      idleExpiresAt: new Date(now.getTime() + IDLE_SESSION_MS).toISOString(),
      absoluteExpiresAt,
    });
    return {
      status: 200,
      body: { ok: true, mustChangePassword },
      session: { token, expiresAt: absoluteExpiresAt },
    };
  }

  return {
    async setup(
      input: {
        setupCode: string;
        workspaceName: string;
        workspaceSlug: string;
        displayName: string;
        email: string;
        password: string;
      },
      expectedSetupCode: string,
      now = new Date(),
    ): Promise<AuthResult> {
      const [suppliedHash, expectedHash] = await Promise.all([
        dependencies.hashOpaqueValue(input.setupCode),
        dependencies.hashOpaqueValue(expectedSetupCode),
      ]);
      if (!expectedSetupCode || suppliedHash !== expectedHash) {
        return failure(403, "Setup code not recognised.");
      }
      if (await dependencies.administratorExists()) {
        return failure(409, "Administrator setup has already been completed.");
      }

      const displayName = input.displayName.trim();
      const workspaceName = input.workspaceName.trim();
      const workspaceSlug = normalizeWorkspaceSlug(input.workspaceSlug);
      const email = normalizeEmail(input.email);
      if (workspaceName.length < 2 || workspaceName.length > 80) {
        return failure(400, "Company name must be between 2 and 80 characters.");
      }
      const slugError = workspaceSlugError(workspaceSlug);
      if (slugError) return failure(400, slugError);
      if (displayName.length < 1 || displayName.length > 80) {
        return failure(400, "Display name must be between 1 and 80 characters.");
      }
      if (!validEmail(email)) {
        return failure(400, "Enter a valid email address.");
      }
      if (!validPassword(input.password)) {
        return failure(400, "Password must be between 12 and 128 characters.");
      }

      const verifier = await dependencies.hashPassword(input.password);
      const account = await dependencies.createInitialWorkspaceAdministrator({
        workspaceName,
        workspaceSlug,
        email,
        displayName,
        verifier,
        mustChangePassword: false,
      });
      const result = await issueSession(account.accountId, false, now);
      result.body.workspaceSlug = account.workspaceSlug;
      return result;
    },

    async signIn(
      input: { email: string; password: string },
      fingerprintHash: string,
      now = new Date(),
    ): Promise<AuthResult> {
      const email = normalizeEmail(input.email);
      const emailHash = await dependencies.hashOpaqueValue(email);
      const { credential, retryAt } = await dependencies.findCredentialByEmail(
        email,
        emailHash,
        fingerprintHash,
        now,
      );
      if (retryAt && Date.parse(retryAt) > now.getTime()) {
        return failure(429, LOCKED_OUT);
      }

      const verifier = credential
        ? {
            hash: credential.passwordHash,
            salt: credential.passwordSalt,
            iterations: credential.passwordIterations,
          }
        : DUMMY_VERIFIER;
      const passwordMatches = await dependencies.verifyPassword(input.password, verifier);
      if (!credential || !credential.active || !passwordMatches) {
        const failedRetryAt = await dependencies.recordFailedLogin(
          emailHash,
          fingerprintHash,
          credential?.accountId ?? null,
          now,
        );
        if (failedRetryAt && Date.parse(failedRetryAt) > now.getTime()) {
          return failure(429, LOCKED_OUT);
        }
        return failure(401, INVALID_CREDENTIALS);
      }

      await dependencies.clearFailedLogins(
        emailHash,
        fingerprintHash,
        credential.accountId,
      );
      return issueSession(credential.accountId, credential.mustChangePassword, now);
    },

    async changePassword(
      token: string,
      password: string,
      now = new Date(),
    ): Promise<AuthResult> {
      const tokenHash = await dependencies.hashOpaqueValue(token);
      const actor = await dependencies.findSessionActor(tokenHash, now);
      if (!actor || !actor.active) return failure(401, "Sign in is required.");
      if (!validPassword(password)) {
        return failure(400, "Password must be between 12 and 128 characters.");
      }

      const verifier = await dependencies.hashPassword(password);
      await dependencies.replacePassword(actor.accountId, verifier);
      await dependencies.revokeAccountSessions(actor.accountId, now);
      return issueSession(actor.accountId, false, now);
    },

    async signOut(token: string, now = new Date()): Promise<AuthResult> {
      const tokenHash = await dependencies.hashOpaqueValue(token);
      await dependencies.revokeSession(tokenHash, now);
      return { status: 200, body: { ok: true } };
    },
  };
}

function failure(status: number, error: string): AuthResult {
  return { status, body: { ok: false, error } };
}

function validPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}

function validEmail(value: string): boolean {
  return value.length >= 3
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
