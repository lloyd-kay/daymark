import { invoke } from "@tauri-apps/api/core";

import type { BackupSummary } from "./BackupPanel";

export interface SetupState {
  configured: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSetupState(value: unknown): SetupState {
  if (!isRecord(value) || typeof value.configured !== "boolean") {
    throw new Error("Daymark returned an invalid setup state");
  }
  return { configured: value.configured };
}

export function parseSetupCode(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9A-HJKMNP-TV-Z]{5}(?:-[0-9A-HJKMNP-TV-Z]{5}){3}$/.test(value)) {
    throw new Error("Daymark returned an invalid setup code");
  }
  return value;
}

export function parseBackupSummary(value: unknown): BackupSummary {
  if (
    !isRecord(value)
    || typeof value.manifestFile !== "string"
    || typeof value.createdAt !== "string"
    || Number.isNaN(Date.parse(value.createdAt))
    || value.integrity !== "verified"
  ) {
    throw new Error("Daymark returned an invalid backup result");
  }
  return {
    manifestFile: value.manifestFile,
    createdAt: value.createdAt,
    integrity: value.integrity,
  };
}

export async function getSetupState(): Promise<SetupState> {
  return parseSetupState(await invoke<unknown>("get_setup_state"));
}

export async function revealSetupCode(): Promise<string> {
  return parseSetupCode(await invoke<unknown>("reveal_setup_code"));
}

export async function copySetupCode(): Promise<void> {
  await invoke("copy_setup_code");
}

export async function createBackup(): Promise<BackupSummary> {
  return parseBackupSummary(await invoke<unknown>("create_backup"));
}

export async function verifyBackup(path: string): Promise<BackupSummary> {
  return parseBackupSummary(await invoke<unknown>("verify_backup", { path }));
}

export async function restoreBackup(path: string): Promise<void> {
  await invoke("restore_backup", { path });
}
