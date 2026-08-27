import type { WorkspaceActor } from "./auth/membership";
import type {
  EmbedMode,
  EmbedServiceScope,
  WorkspaceEmbedPreference,
} from "./data/contracts";
import type { EmbedPreferenceAdminScope } from "./data/embed-preference-repository";
import {
  decodeSetupProfile,
  SetupProfileError,
} from "./setup-profile";

type EmbedPreferenceDependencies = {
  getActor(): Promise<WorkspaceActor | null>;
  getWorkspaceEmbedPreference(
    scope: { workspaceId: string },
  ): Promise<WorkspaceEmbedPreference>;
  setWorkspaceEmbedPreference(
    admin: EmbedPreferenceAdminScope,
    input: Pick<
      WorkspaceEmbedPreference,
      "defaultMode" | "defaultServiceScope" | "defaultServiceId"
    >,
  ): Promise<boolean>;
};

type EmbedPreferenceResult = {
  status: number;
  body: Record<string, unknown>;
};

export function createEmbedPreferences(
  dependencies: EmbedPreferenceDependencies,
) {
  return {
    async read(): Promise<EmbedPreferenceResult> {
      const ready = await readyAdministrator(dependencies);
      if (ready.error) return ready.error;
      try {
        const preference = await dependencies.getWorkspaceEmbedPreference({
          workspaceId: ready.actor.workspaceId,
        });
        return { status: 200, body: { preference } };
      } catch {
        return storageFailure("The workspace default could not be loaded. Try again.");
      }
    },

    async mutate(raw: unknown): Promise<EmbedPreferenceResult> {
      const ready = await readyAdministrator(dependencies);
      if (ready.error) return ready.error;
      if (!raw || typeof raw !== "object") return badRequest();

      const body = raw as Record<string, unknown>;
      let defaultMode: EmbedMode;
      let defaultServiceScope: EmbedServiceScope;
      let defaultServiceId: string | null;
      if (body.action === "set-default") {
        if (
          !hasExactKeys(body, [
            "action",
            "defaultMode",
            "defaultServiceScope",
            "serviceId",
          ])
          || (body.defaultMode !== "floating" && body.defaultMode !== "inline")
          || (body.defaultServiceScope !== "all" && body.defaultServiceScope !== "service")
          || !validServiceId(body.serviceId)
          || !validServiceSelection(body.defaultServiceScope, body.serviceId)
        ) {
          return badRequest();
        }
        defaultMode = body.defaultMode;
        defaultServiceScope = body.defaultServiceScope;
        defaultServiceId = body.serviceId;
      } else if (body.action === "import-profile") {
        if (
          !hasExactKeys(body, ["action", "code", "serviceId"])
          || typeof body.code !== "string"
          || !validServiceId(body.serviceId)
        ) {
          return badRequest();
        }
        try {
          const profile = decodeSetupProfile(body.code);
          defaultMode = profile.layout;
          defaultServiceScope = profile.journey === "catalogue" ? "all" : "service";
          defaultServiceId = body.serviceId;
          if (!validServiceSelection(defaultServiceScope, defaultServiceId)) {
            return badRequest();
          }
        } catch (error) {
          return error instanceof SetupProfileError
            ? setupProfileFailure(error)
            : badRequest();
        }
      } else {
        return badRequest();
      }

      const admin = {
        membershipId: ready.actor.membershipId,
        workspaceId: ready.actor.workspaceId,
      };
      try {
        const changed = await dependencies.setWorkspaceEmbedPreference(admin, {
          defaultMode,
          defaultServiceScope,
          defaultServiceId,
        });
        if (!changed) return forbidden();
        const preference = await dependencies.getWorkspaceEmbedPreference({
          workspaceId: ready.actor.workspaceId,
        });
        return { status: 200, body: { ok: true, preference } };
      } catch {
        return storageFailure("The workspace default could not be saved. Try again.");
      }
    },
  };
}

function validServiceId(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)
  );
}

function validServiceSelection(
  scope: EmbedServiceScope,
  serviceId: string | null,
): boolean {
  return (scope === "all" && serviceId === null)
    || (scope === "service" && serviceId !== null);
}

function hasExactKeys(
  body: Record<string, unknown>,
  expected: string[],
): boolean {
  const keys = Object.keys(body).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === [...expected].sort()[index]);
}

async function readyAdministrator(
  dependencies: Pick<EmbedPreferenceDependencies, "getActor">,
): Promise<
  | { actor: WorkspaceActor; error: null }
  | { actor: null; error: EmbedPreferenceResult }
> {
  const actor = await dependencies.getActor();
  if (!actor) return { actor: null, error: unauthorized() };
  if (actor.mustChangePassword) {
    return {
      actor: null,
      error: {
        status: 428,
        body: { ok: false, error: "Change your temporary password first." },
      },
    };
  }
  if (actor.role !== "admin") return { actor: null, error: forbidden() };
  return { actor, error: null };
}

function setupProfileFailure(error: SetupProfileError): EmbedPreferenceResult {
  if (error.code === "invalid_checksum") {
    return {
      status: 400,
      body: { ok: false, error: "That setup code looks incomplete or mistyped." },
    };
  }
  if (error.code === "unsupported_version") {
    return {
      status: 400,
      body: { ok: false, error: "Update Daymark before importing this setup code." },
    };
  }
  return {
    status: 400,
    body: { ok: false, error: "That setup code is not valid." },
  };
}

function unauthorized(): EmbedPreferenceResult {
  return { status: 401, body: { ok: false, error: "Sign in is required." } };
}

function forbidden(): EmbedPreferenceResult {
  return { status: 403, body: { ok: false, error: "You do not have access to that." } };
}

function badRequest(): EmbedPreferenceResult {
  return { status: 400, body: { ok: false, error: "Check the Embed preference action." } };
}

function storageFailure(error: string): EmbedPreferenceResult {
  return { status: 500, body: { ok: false, error } };
}
