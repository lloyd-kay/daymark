import {
  insertStaffCredential,
  replaceStaffPasswordVerifier,
  setStaffActiveState,
} from "./repository";
import { generateTemporaryPassword, hashPassword } from "./password";

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
