import {
  insertStaffCredential,
  replaceStaffPasswordVerifier,
  revokeMembershipSessions,
  setStaffActiveState,
} from "./repository";
import { generateTemporaryPassword, hashPassword } from "./password";

export async function createStaffAccount(
  adminMembershipId: string,
  input: { employeeProfileId: string; email: string; displayName: string },
): Promise<{ temporaryPassword: string } | null> {
  const temporaryPassword = generateTemporaryPassword();
  const verifier = await hashPassword(temporaryPassword);
  const account = await insertStaffCredential(adminMembershipId, {
    ...input,
    verifier,
  });
  return account ? { temporaryPassword } : null;
}

export async function resetStaffPassword(
  adminMembershipId: string,
  employeeProfileId: string,
): Promise<{ temporaryPassword: string } | null> {
  const temporaryPassword = generateTemporaryPassword();
  const verifier = await hashPassword(temporaryPassword);
  const replaced = await replaceStaffPasswordVerifier(
    adminMembershipId,
    employeeProfileId,
    verifier,
  );
  return replaced ? { temporaryPassword } : null;
}

export async function setStaffActive(
  adminMembershipId: string,
  employeeProfileId: string,
  active: boolean,
): Promise<boolean> {
  const changed = await setStaffActiveState(
    adminMembershipId,
    employeeProfileId,
    active,
  );
  if (!changed) return false;
  if (!active) await revokeMembershipSessions(changed.membershipId);
  return true;
}
