import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountSession, getWorkspaceActor } from "../../../lib/auth/membership";
import {
  ensureSeedData,
  getEmployeeAvailability,
  listPublicEmployees,
  listSchedule,
  listTeamProfiles,
} from "../../../lib/data/repository";
import type {
  TeamProfile,
  WorkspaceEmbedPreference,
} from "../../../lib/data/contracts";
import { getWorkspaceEmbedPreference } from "../../../lib/data/embed-preference-repository";
import { listWorkspaceServices } from "../../../lib/data/service-repository";
import { normalizeWorkspaceSlug } from "../../../lib/workspaces/slug";
import { PasswordChangeGate } from "../PasswordChangeGate";
import { WorkspaceClient } from "../WorkspaceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team workspace — Daymark",
  description: "A private company scheduling workspace.",
};

export default async function CompanyWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string };
}) {
  const { workspaceSlug: rawSlug } = await params;
  const workspaceSlug = normalizeWorkspaceSlug(rawSlug);
  const actor = await getWorkspaceActor(workspaceSlug);
  if (!actor) {
    const session = await getAccountSession();
    if (!session) redirect(`/workspace/${workspaceSlug}/sign-in`);
    return (
      <main className="workspace-gate">
        <header>
          <a className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></a>
          <span>Private company access</span>
        </header>
        <section className="auth-card">
          <p className="eyebrow">Access unavailable</p>
          <h1>Access not granted.</h1>
          <p>This account does not have access to this company workspace. Ask its administrator for a private invitation.</p>
          <a className="workspace-primary" href="/workspace">Your workspaces →</a>
        </section>
      </main>
    );
  }
  if (actor.mustChangePassword) {
    return <PasswordChangeGate displayName={actor.displayName} />;
  }

  await ensureSeedData();
  const { from, to } = initialWeekRange();
  const scope = {
    workspaceId: actor.workspaceId,
    role: actor.role,
    employeeProfileId: actor.employeeProfileId,
  };
  let profiles: TeamProfile[];
  if (actor.role === "admin") {
    profiles = await listTeamProfiles(scope);
  } else {
    const own = (await listPublicEmployees({
      workspaceId: actor.workspaceId,
      workspaceSlug: actor.workspaceSlug,
      workspaceName: actor.workspaceName,
    })).find(
      (profile) => profile.id === actor.employeeProfileId,
    );
    profiles = own ? [{
      ...own,
      workspaceId: actor.workspaceId,
      membershipId: actor.membershipId,
      active: true,
      sortOrder: 0,
      memberEmail: actor.email,
      memberDisplayName: actor.displayName,
      hasCredential: true,
    }] : [];
  }
  const selectedProfileId = actor.employeeProfileId
    ?? profiles.find((profile) => profile.active)?.id
    ?? null;
  const [entries, availability, initialServices, initialEmbedPreference] = await Promise.all([
    listSchedule(scope, { from, to }, actor.employeeProfileId ?? undefined),
    selectedProfileId
      ? getEmployeeAvailability(scope, selectedProfileId)
      : Promise.resolve(null),
    actor.role === "admin"
      ? listWorkspaceServices({ workspaceId: actor.workspaceId })
      : Promise.resolve([]),
    actor.role === "admin"
      ? getWorkspaceEmbedPreference({ workspaceId: actor.workspaceId })
      : Promise.resolve<WorkspaceEmbedPreference | null>(null),
  ]);

  return (
    <WorkspaceClient
      actor={actor}
      profiles={profiles}
      initialServices={initialServices}
      initialEmbedPreference={initialEmbedPreference}
      initialEntries={entries}
      initialAvailability={availability}
      initialRange={{ from, to }}
      nowIso={new Date().toISOString()}
    />
  );
}

function initialWeekRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { from: start.toISOString(), to: end.toISOString() };
}
