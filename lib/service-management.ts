import type { WorkspaceActor } from "./auth/membership";
import type { WorkspaceService } from "./data/contracts";
import type { QualificationMethod } from "./services/eligibility";
import {
  normalizeServiceSlug,
  validDateOnly,
  validServiceDuration,
  validServiceSlug,
} from "./services/eligibility";

export type ServiceAdminScope = Pick<
  WorkspaceActor,
  "membershipId" | "workspaceId"
>;

export type ServiceDetailsInput = {
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
};

export type ServiceUpdateInput = ServiceDetailsInput & { serviceId: string };

export type QualificationInput = {
  serviceId: string;
  employeeProfileId: string;
  active: boolean;
  method: QualificationMethod;
  certificateName: string | null;
  certificateReference: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
};

type ServiceManagementDependencies = {
  getActor: () => Promise<WorkspaceActor | null>;
  listWorkspaceServices: (
    scope: Pick<WorkspaceActor, "workspaceId">,
  ) => Promise<WorkspaceService[]>;
  createWorkspaceService: (
    admin: ServiceAdminScope,
    input: ServiceDetailsInput,
  ) => Promise<boolean>;
  updateWorkspaceService: (
    admin: ServiceAdminScope,
    input: ServiceUpdateInput,
  ) => Promise<boolean>;
  setWorkspaceServiceActive: (
    admin: ServiceAdminScope,
    serviceId: string,
    active: boolean,
  ) => Promise<boolean>;
  setEmployeeServiceQualification: (
    admin: ServiceAdminScope,
    input: QualificationInput,
  ) => Promise<boolean>;
};

type ServiceManagementResult = {
  status: number;
  body: Record<string, unknown>;
};

export function createServiceManagement(
  dependencies: ServiceManagementDependencies,
) {
  return {
    async list(): Promise<ServiceManagementResult> {
      const ready = await readyAdministrator(dependencies);
      if (ready.error) return ready.error;
      const services = await dependencies.listWorkspaceServices({
        workspaceId: ready.actor.workspaceId,
      });
      return { status: 200, body: { services } };
    },

    async mutate(raw: unknown): Promise<ServiceManagementResult> {
      const ready = await readyAdministrator(dependencies);
      if (ready.error) return ready.error;
      if (!raw || typeof raw !== "object") {
        return badRequest("Check the service action.");
      }

      const body = raw as Record<string, unknown>;
      const admin = adminScope(ready.actor);

      if (body.action === "create-service") {
        const input = parseServiceDetails(body);
        if (!input) return badRequest("Check the service details.");
        const created = await dependencies.createWorkspaceService(admin, input);
        return created
          ? { status: 201, body: { ok: true } }
          : badRequest("The service could not be created.");
      }

      if (body.action === "update-service") {
        const serviceId = parseOpaqueId(body.serviceId);
        const details = parseServiceDetails(body);
        if (!serviceId || !details) return badRequest("Check the service details.");
        const changed = await dependencies.updateWorkspaceService(admin, {
          serviceId,
          ...details,
        });
        return changed
          ? { status: 200, body: { ok: true } }
          : badRequest("The service could not be updated.");
      }

      if (body.action === "set-service-active") {
        const serviceId = parseOpaqueId(body.serviceId);
        if (
          !serviceId
          || typeof body.active !== "boolean"
          || (!body.active && body.confirm !== true)
        ) {
          return badRequest("Confirm the service status change.");
        }
        const changed = await dependencies.setWorkspaceServiceActive(
          admin,
          serviceId,
          body.active,
        );
        return changed
          ? { status: 200, body: { ok: true } }
          : badRequest("The service status could not be changed.");
      }

      if (body.action === "set-qualification") {
        const parsed = parseQualification(body);
        if (!parsed || (!parsed.active && body.confirm !== true)) {
          return badRequest("Check and confirm the qualification details.");
        }
        const changed = await dependencies.setEmployeeServiceQualification(
          admin,
          parsed,
        );
        return changed
          ? { status: 200, body: { ok: true } }
          : badRequest("The qualification could not be changed.");
      }

      return badRequest("Check the service action.");
    },
  };
}

function parseServiceDetails(
  body: Record<string, unknown>,
): ServiceDetailsInput | null {
  const name = parseRequiredText(body.name, 80);
  const category = parseRequiredText(body.category, 80);
  const description = parseOptionalText(body.description, 500);
  if (
    !name
    || !category
    || !description.ok
    || !validServiceDuration(body.durationMinutes)
  ) {
    return null;
  }
  const slug = normalizeServiceSlug(name);
  if (!validServiceSlug(slug)) return null;
  return {
    name,
    category,
    description: description.value ?? "",
    durationMinutes: body.durationMinutes,
  };
}

function parseQualification(
  body: Record<string, unknown>,
): QualificationInput | null {
  const serviceId = parseOpaqueId(body.serviceId);
  const employeeProfileId = parseOpaqueId(body.employeeProfileId);
  if (
    !serviceId
    || !employeeProfileId
    || typeof body.active !== "boolean"
    || (body.method !== "manual" && body.method !== "certificate")
  ) {
    return null;
  }

  if (body.method === "manual") {
    return {
      serviceId,
      employeeProfileId,
      active: body.active,
      method: "manual",
      certificateName: null,
      certificateReference: null,
      issuedOn: null,
      expiresOn: null,
    };
  }

  const certificateName = parseOptionalText(body.certificateName, 120);
  const certificateReference = parseOptionalText(body.certificateReference, 120);
  const issuedOn = parseOptionalDate(body.issuedOn);
  const expiresOn = parseOptionalDate(body.expiresOn);
  if (
    !certificateName.ok
    || !certificateReference.ok
    || !issuedOn.ok
    || !expiresOn.ok
    || (body.active && (!certificateName.value || !expiresOn.value))
    || (issuedOn.value && expiresOn.value && issuedOn.value > expiresOn.value)
  ) {
    return null;
  }

  return {
    serviceId,
    employeeProfileId,
    active: body.active,
    method: "certificate",
    certificateName: certificateName.value,
    certificateReference: certificateReference.value,
    issuedOn: issuedOn.value,
    expiresOn: expiresOn.value,
  };
}

function parseRequiredText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maximum && !containsControlCharacter(normalized)
    ? normalized
    : null;
}

function parseOptionalText(
  value: unknown,
  maximum: number,
): { ok: true; value: string | null } | { ok: false; value: null } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, value: null };
  const normalized = value.trim();
  if (normalized.length > maximum || normalized.includes(String.fromCharCode(0))) {
    return { ok: false, value: null };
  }
  return { ok: true, value: normalized || null };
}

function parseOptionalDate(
  value: unknown,
): { ok: true; value: string | null } | { ok: false; value: null } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  return validDateOnly(value)
    ? { ok: true, value }
    : { ok: false, value: null };
}

function parseOpaqueId(value: unknown): string | null {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)
    ? value
    : null;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function adminScope(actor: WorkspaceActor): ServiceAdminScope {
  return {
    membershipId: actor.membershipId,
    workspaceId: actor.workspaceId,
  };
}

async function readyAdministrator(
  dependencies: Pick<ServiceManagementDependencies, "getActor">,
): Promise<
  | { actor: WorkspaceActor; error: null }
  | { actor: null; error: ServiceManagementResult }
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
  if (actor.role !== "admin") {
    return { actor: null, error: forbidden() };
  }
  return { actor, error: null };
}

function unauthorized(): ServiceManagementResult {
  return { status: 401, body: { ok: false, error: "Sign in is required." } };
}

function forbidden(): ServiceManagementResult {
  return { status: 403, body: { ok: false, error: "You do not have access to that." } };
}

function badRequest(error: string): ServiceManagementResult {
  return { status: 400, body: { ok: false, error } };
}
