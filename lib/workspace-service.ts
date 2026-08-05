import { actorCanAccessProfile } from "./auth/membership";
import type { WorkspaceActor } from "./auth/membership";
import { normalizeEmail } from "./auth/service";
import type { AvailabilityRule, TimeRange } from "./scheduling/types";

type WorkspaceDependencies = {
  getActor: () => Promise<WorkspaceActor | null>;
  listSchedule: (
    scope: Pick<WorkspaceActor, "role" | "employeeProfileId">,
    range: { from: string; to: string },
    employeeId?: string,
  ) => Promise<unknown>;
  cancelAppointment: (
    scope: Pick<WorkspaceActor, "role" | "employeeProfileId">,
    appointmentId: string,
  ) => Promise<boolean>;
  getEmployeeAvailability: (
    scope: Pick<WorkspaceActor, "role" | "employeeProfileId">,
    employeeId: string,
  ) => Promise<unknown>;
  replaceAvailabilityRules: (
    scope: Pick<WorkspaceActor, "role" | "employeeProfileId">,
    employeeId: string,
    rules: AvailabilityRule[],
  ) => Promise<boolean>;
  addBlockedPeriod: (
    scope: Pick<WorkspaceActor, "role" | "employeeProfileId">,
    employeeId: string,
    range: TimeRange & { note?: string },
  ) => Promise<boolean>;
  listTeamProfiles: () => Promise<unknown>;
  createStaffAccount: (
    adminMembershipId: string,
    input: {
      employeeProfileId: string;
      email: string;
      displayName: string;
      confirm: boolean;
    },
  ) => Promise<{ membershipId: string; temporaryPassword: string } | null>;
  resetStaffPassword: (
    adminMembershipId: string,
    employeeProfileId: string,
    confirm: boolean,
  ) => Promise<{ temporaryPassword: string } | null>;
  setStaffActive: (
    adminMembershipId: string,
    employeeProfileId: string,
    active: boolean,
    confirm: boolean,
  ) => Promise<boolean>;
};

type WorkspaceResult = { status: number; body: Record<string, unknown> };

export function createWorkspaceService(dependencies: WorkspaceDependencies) {
  return {
    async schedule(query: {
      from?: unknown;
      to?: unknown;
      employeeId?: unknown;
    }): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      const range = parseRange(query.from, query.to);
      if (!range) return badRequest("Choose a valid date range.");
      const requestedId =
        typeof query.employeeId === "string" && query.employeeId
          ? query.employeeId
          : undefined;
      if (requestedId && !actorCanAccessProfile(actor, requestedId)) {
        return forbidden();
      }
      const targetId =
        requestedId ??
        (actor.role === "employee" ? actor.employeeProfileId ?? undefined : undefined);
      const scope = { role: actor.role, employeeProfileId: actor.employeeProfileId };
      const entries = await dependencies.listSchedule(scope, range, targetId);
      return { status: 200, body: { entries } };
    },

    async cancel(raw: unknown): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      if (!raw || typeof raw !== "object") return badRequest("Confirm the cancellation.");
      const body = raw as Record<string, unknown>;
      if (
        body.confirm !== true ||
        typeof body.appointmentId !== "string" ||
        !body.appointmentId
      ) {
        return badRequest("Confirm the cancellation.");
      }
      const changed = await dependencies.cancelAppointment(
        { role: actor.role, employeeProfileId: actor.employeeProfileId },
        body.appointmentId,
      );
      return changed
        ? { status: 200, body: { ok: true } }
        : forbidden("That appointment could not be cancelled.");
    },

    async availability(employeeId: unknown): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      if (typeof employeeId !== "string" || !actorCanAccessProfile(actor, employeeId)) {
        return forbidden();
      }
      const availability = await dependencies.getEmployeeAvailability(
        { role: actor.role, employeeProfileId: actor.employeeProfileId },
        employeeId,
      );
      return { status: 200, body: { availability } };
    },

    async saveAvailability(raw: unknown): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      const parsed = parseAvailabilityBody(raw);
      if (!parsed) return badRequest("Check the availability settings.");
      if (!actorCanAccessProfile(actor, parsed.employeeId)) return forbidden();
      const changed = await dependencies.replaceAvailabilityRules(
        { role: actor.role, employeeProfileId: actor.employeeProfileId },
        parsed.employeeId,
        parsed.rules,
      );
      return changed
        ? { status: 200, body: { ok: true } }
        : forbidden("Availability could not be updated.");
    },

    async blockTime(raw: unknown): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      const parsed = parseBlockBody(raw);
      if (!parsed) return badRequest("Check the blocked-time details.");
      if (!actorCanAccessProfile(actor, parsed.employeeId)) return forbidden();
      const changed = await dependencies.addBlockedPeriod(
        { role: actor.role, employeeProfileId: actor.employeeProfileId },
        parsed.employeeId,
        parsed.range,
      );
      return changed
        ? { status: 201, body: { ok: true } }
        : forbidden("That time could not be blocked.");
    },

    async team(): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      if (actor.role !== "admin") return forbidden();
      return {
        status: 200,
        body: { profiles: await dependencies.listTeamProfiles() },
      };
    },

    async teamAction(raw: unknown): Promise<WorkspaceResult> {
      const ready = await readyActor(dependencies);
      if (ready.error) return ready.error;
      const actor = ready.actor;
      if (actor.role !== "admin") return forbidden();
      if (!raw || typeof raw !== "object") return badRequest("Check the team action.");
      const body = raw as Record<string, unknown>;
      const employeeProfileId = parseEmployeeProfileId(body.employeeProfileId);
      if (!employeeProfileId) {
        return badRequest("Choose a team member.");
      }
      if (body.action === "create-account") {
        if (body.confirm !== true) return badRequest("Confirm account creation.");
        const input = parseStaffAccountInput(employeeProfileId, body);
        if (!input) return badRequest("Check the staff account details.");
        const account = await dependencies.createStaffAccount(
          actor.membershipId,
          { ...input, confirm: true },
        );
        return account
          ? {
              status: 201,
              body: {
                membershipId: account.membershipId,
                temporaryPassword: account.temporaryPassword,
              },
            }
          : badRequest("The staff account could not be created.");
      }
      if (body.action === "reset-password") {
        if (body.confirm !== true) return badRequest("Confirm the password reset.");
        const reset = await dependencies.resetStaffPassword(
          actor.membershipId,
          employeeProfileId,
          true,
        );
        return reset
          ? { status: 200, body: { temporaryPassword: reset.temporaryPassword } }
          : badRequest("The temporary password could not be reset.");
      }
      if (body.action === "set-active" && typeof body.active === "boolean") {
        if (body.confirm !== true) return badRequest("Confirm the account change.");
        const changed = await dependencies.setStaffActive(
          actor.membershipId,
          employeeProfileId,
          body.active,
          true,
        );
        return changed
          ? { status: 200, body: { ok: true } }
          : badRequest("The account could not be changed.");
      }
      return badRequest("Check the team action.");
    },
  };
}

const EMPLOYEE_PROFILE_ID = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

function parseEmployeeProfileId(value: unknown): string | null {
  return typeof value === "string"
    && value !== "all"
    && EMPLOYEE_PROFILE_ID.test(value)
    ? value
    : null;
}

function parseStaffAccountInput(
  employeeProfileId: string,
  body: Record<string, unknown>,
) {
  if (typeof body.email !== "string" || typeof body.displayName !== "string") {
    return null;
  }
  const email = normalizeEmail(body.email);
  const displayName = body.displayName.trim();
  if (
    email.length < 3
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || displayName.length < 1
    || displayName.length > 80
  ) {
    return null;
  }
  return { employeeProfileId, email, displayName };
}

async function readyActor(dependencies: WorkspaceDependencies): Promise<
  | { actor: WorkspaceActor; error: null }
  | { actor: null; error: WorkspaceResult }
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
  return { actor, error: null };
}

function parseRange(from: unknown, to: unknown) {
  if (typeof from !== "string" || typeof to !== "string") return null;
  const start = new Date(from);
  const end = new Date(to);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString() !== from ||
    end.toISOString() !== to ||
    end <= start ||
    end.getTime() - start.getTime() > 31 * 86_400_000
  ) {
    return null;
  }
  return { from, to };
}

function parseAvailabilityBody(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.employeeId !== "string" || !Array.isArray(body.rules)) return null;
  const rules: AvailabilityRule[] = [];
  for (const item of body.rules) {
    if (!item || typeof item !== "object") return null;
    const rule = item as Record<string, unknown>;
    if (
      !integerBetween(rule.weekday, 0, 6) ||
      !integerBetween(rule.startMinute, 0, 1439) ||
      !integerBetween(rule.endMinute, 1, 1440) ||
      !integerBetween(rule.slotMinutes, 15, 240) ||
      !integerBetween(rule.bufferMinutes, 0, 120) ||
      Number(rule.startMinute) >= Number(rule.endMinute)
    ) {
      return null;
    }
    rules.push({
      weekday: Number(rule.weekday),
      startMinute: Number(rule.startMinute),
      endMinute: Number(rule.endMinute),
      slotMinutes: Number(rule.slotMinutes),
      bufferMinutes: Number(rule.bufferMinutes),
    });
  }
  return { employeeId: body.employeeId, rules };
}

function parseBlockBody(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.employeeId !== "string" ||
    typeof body.startAt !== "string" ||
    typeof body.endAt !== "string"
  ) {
    return null;
  }
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString() !== body.startAt ||
    end.toISOString() !== body.endAt ||
    end <= start
  ) {
    return null;
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 160) : "";
  return {
    employeeId: body.employeeId,
    range: { startAt: body.startAt, endAt: body.endAt, note },
  };
}

function integerBetween(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function unauthorized(): WorkspaceResult {
  return { status: 401, body: { ok: false, error: "Sign in is required." } };
}

function forbidden(error = "You do not have access to that."): WorkspaceResult {
  return { status: 403, body: { ok: false, error } };
}

function badRequest(error: string): WorkspaceResult {
  return { status: 400, body: { ok: false, error } };
}
