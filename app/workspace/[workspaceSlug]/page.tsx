import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession, getWorkspaceActor } from "../../../lib/auth/membership";
import {
  ensureSeedData,
  getEmployeeAvailability,
  listPublicEmployees,
  listSchedule,
  listTeamProfiles,
} from "../../../lib/data/repository";
import type { TeamProfile } from "../../../lib/data/contracts";
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
          <Link className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></Link>
          <span>Private company access</span>
        </header>
        <section className="auth-card">
          <p className="eyebrow">Access unavailable</p>
          <h1>Access not granted.</h1>
          <p>This account does not have access to this company workspace. Ask its administrator for a private invitation.</p>
          <Link className="workspace-primary" href="/workspace">Your workspaces →</Link>
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
    const own = (await listPublicEmployees(actor.workspaceId)).find(
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
  const [entries, availability] = await Promise.all([
    listSchedule(scope, { from, to }, actor.employeeProfileId ?? undefined),
    selectedProfileId
      ? getEmployeeAvailability(scope, selectedProfileId)
      : Promise.resolve(null),
  ]);

  return (
    <WorkspaceClient
      actor={actor}
      profiles={profiles}
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
