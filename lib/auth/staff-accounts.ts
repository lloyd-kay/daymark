import {
  insertWorkspaceInvitation,
  insertStaffCredential,
  redeemWorkspaceInvitation,
  replaceStaffPasswordVerifier,
  setStaffActiveState,
} from "./repository";
import {
  generateSessionToken,
  generateTemporaryPassword,
  hashOpaqueValue,
  hashPassword,
} from "./password";
import { normalizeEmail } from "./service";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function createWorkspaceInvitation(
  administratorMembershipId: string,
  input: {
    email: string;
    role: "admin" | "employee";
    employeeProfileId: string | null;
  },
  now = new Date(),
): Promise<{ code: string; expiresAt: string } | null> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const code = generateSessionToken();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString();
  const created = await insertWorkspaceInvitation({
    administratorMembershipId,
    emailHash: await hashOpaqueValue(email),
    codeHash: await hashOpaqueValue(code),
    role: input.role,
    employeeProfileId: input.employeeProfileId,
    expiresAt,
  });
  return created ? { code, expiresAt } : null;
}

export async function acceptWorkspaceInvitation(
  code: string,
  account: { accountId: string; email: string },
  now = new Date(),
): Promise<{ workspaceSlug: string } | null> {
  if (!code) return null;
  return redeemWorkspaceInvitation({
    codeHash: await hashOpaqueValue(code),
    emailHash: await hashOpaqueValue(normalizeEmail(account.email)),
    accountId: account.accountId,
    now,
  });
}

export async function createStaffAccount(
  adminMembershipId: string,
  input: {
    employeeProfileId: string;
    email: string;
    displayName: string;
    confirm: boolean;
  },
): Promise<{ membershipId: string; temporaryPassword: string } | null> {
  const temporaryPassword = generateTemporaryPassword();
  const verifier = await hashPassword(temporaryPassword);
  const account = await insertStaffCredential(adminMembershipId, {
    ...input,
    verifier,
  });
  return account ? { membershipId: account.membershipId, temporaryPassword } : null;
}

export async function resetStaffPassword(
  adminMembershipId: string,
  employeeProfileId: string,
  confirm: boolean,
): Promise<{ temporaryPassword: string } | null> {
  const temporaryPassword = generateTemporaryPassword();
  const verifier = await hashPassword(temporaryPassword);
  const replaced = await replaceStaffPasswordVerifier(
    adminMembershipId,
    employeeProfileId,
    verifier,
    confirm,
  );
  return replaced ? { temporaryPassword } : null;
}

export async function setStaffActive(
  adminMembershipId: string,
  employeeProfileId: string,
  active: boolean,
  confirm: boolean,
): Promise<boolean> {
  const changed = await setStaffActiveState(
    adminMembershipId,
    employeeProfileId,
    active,
    confirm,
  );
  return Boolean(changed);
}
