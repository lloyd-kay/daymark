import type { AuthenticatedIdentity } from "../data/contracts";

type EnrolBody =
  | { kind: "setup"; code: string }
  | { kind: "invitation"; code: string };

type EnrolmentDependencies = {
  claimAdministrator: (
    identity: AuthenticatedIdentity,
    code: string,
  ) => Promise<unknown | null>;
  redeemInvitation: (
    identity: AuthenticatedIdentity,
    code: string,
  ) => Promise<unknown | null>;
};

export type EnrolmentResult = {
  status: number;
  body: { ok: boolean; error?: string };
};

export async function performEnrolment(
  identity: AuthenticatedIdentity | null,
  rawBody: unknown,
  dependencies: EnrolmentDependencies,
): Promise<EnrolmentResult> {
  if (!identity) {
    return {
      status: 401,
      body: { ok: false, error: "Sign in before joining the workspace." },
    };
  }

  const body = parseEnrolBody(rawBody);
  if (!body) {
    return {
      status: 400,
      body: { ok: false, error: "Enter a valid access code." },
    };
  }

  const membership =
    body.kind === "setup"
      ? await dependencies.claimAdministrator(identity, body.code)
      : await dependencies.redeemInvitation(identity, body.code);
  if (!membership) {
    return {
      status: 403,
      body: { ok: false, error: "That code could not be used." },
    };
  }

  return { status: 200, body: { ok: true } };
}

function parseEnrolBody(value: unknown): EnrolBody | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "setup" && candidate.kind !== "invitation") {
    return null;
  }
  if (typeof candidate.code !== "string") return null;
  const code = candidate.code.trim();
  if (code.length < 4 || code.length > 128) return null;
  return { kind: candidate.kind, code };
}
