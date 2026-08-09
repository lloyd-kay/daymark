import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { AccessState, RuntimeMode, RuntimeState, RuntimeStatus } from "./contracts";

const runtimeStates: RuntimeState[] = ["running", "stopped", "starting", "needs_attention"];
const runtimeModes: RuntimeMode[] = ["service", "manual"];
const accessStates: AccessState[] = ["local", "temporary_starting", "temporary", "permanent", "error"];
const localHosts = new Set(["127.0.0.1", "localhost"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export function parseRuntimeStatus(value: unknown): RuntimeStatus {
  if (
    !isRecord(value)
    || !isOneOf(value.state, runtimeStates)
    || !isOneOf(value.mode, runtimeModes)
    || !isOneOf(value.access, accessStates)
    || typeof value.localUrl !== "string"
    || !(value.publicUrl === null || typeof value.publicUrl === "string")
    || typeof value.version !== "string"
    || typeof value.latestMigration !== "string"
    || !(value.message === null || typeof value.message === "string")
  ) {
    throw new Error("Daymark returned an invalid runtime status");
  }

  assertSafeLocalUrl(value.localUrl);
  if (value.publicUrl !== null) {
    let publicUrl: URL;
    try {
      publicUrl = new URL(value.publicUrl);
    } catch {
      throw new Error("Daymark returned an unsafe public address");
    }
    if (
      publicUrl.protocol !== "https:"
      || !publicUrl.hostname
      || publicUrl.username !== ""
      || publicUrl.password !== ""
    ) {
      throw new Error("Daymark returned an unsafe public address");
    }
  }
  return value as unknown as RuntimeStatus;
}

export function assertSafeLocalUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Only the local Daymark address can be opened");
  }

  if (
    parsed.protocol !== "http:"
    || !localHosts.has(parsed.hostname)
    || parsed.port !== "3210"
    || parsed.username !== ""
    || parsed.password !== ""
  ) {
    throw new Error("Only the local Daymark address can be opened");
  }

  return parsed;
}

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  return parseRuntimeStatus(await invoke<unknown>("get_runtime_status"));
}

export async function openLocalUrl(value: string): Promise<void> {
  const safeUrl = assertSafeLocalUrl(value);
  await invoke("open_local_url", { path: safeUrl.href });
}

export async function startRuntime(): Promise<void> {
  await invoke("start_runtime");
}

export async function stopRuntime(): Promise<void> {
  await invoke("stop_runtime");
}

export async function restartRuntime(): Promise<void> {
  await invoke("restart_runtime");
}

export function runtimeActionErrorMessage(value: unknown): string {
  const code = isRecord(value) && typeof value.code === "string" ? value.code : null;
  if (code === "service_action_cancelled") {
    return "Administrator approval was cancelled. Daymark was not changed.";
  }
  if (code === "service_action_failed") {
    return "Windows could not change the Daymark service. Open Recovery tools for details.";
  }
  if (code === "service_elevation_failed") {
    return "Windows could not request administrator approval.";
  }
  return "Windows could not change the Daymark service.";
}

export async function setRuntimeMode(mode: RuntimeMode): Promise<void> {
  await invoke("set_runtime_mode", { mode });
}

export function useRuntimeStatus(initialStatus: RuntimeStatus): RuntimeStatus {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let timer: number | undefined;

    const refresh = async () => {
      if (!active || document.visibilityState === "hidden") return;
      try {
        const nextStatus = await getRuntimeStatus();
        if (active) setStatus(nextStatus);
      } catch {
        if (active) {
          setStatus((current) => ({
            ...current,
            state: "needs_attention",
            message: "Daymark Control could not confirm the service status.",
          }));
        }
      }
    };

    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState !== "hidden") {
        void refresh();
        timer = window.setInterval(refresh, 5_000);
      }
    };

    document.addEventListener("visibilitychange", schedule);
    schedule();

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  return status;
}
