export type RuntimeState = "running" | "stopped" | "starting" | "needs_attention";
export type RuntimeMode = "service" | "manual";
export type AccessState = "local" | "temporary_starting" | "temporary" | "permanent" | "error";

export interface RuntimeStatus {
  state: RuntimeState;
  mode: RuntimeMode;
  access: AccessState;
  localUrl: string;
  publicUrl: string | null;
  version: string;
  latestMigration: string;
  message: string | null;
}
