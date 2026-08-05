import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspaceActor } from "../../lib/auth/membership";
import {
  ensureSeedData,
  getEmployeeAvailability,
  listPublicEmployees,
  listSchedule,
  listTeamProfiles,
} from "../../lib/data/repository";
import type { TeamProfile } from "../../lib/data/contracts";
import { PasswordChangeGate } from "./PasswordChangeGate";
import { WorkspaceClient } from "./WorkspaceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team workspace — Daymark",
  description: "A private scheduling workspace for the Daymark team.",
};

export default async function WorkspacePage() {
  const actor = await getWorkspaceActor();
  if (!actor) redirect("/workspace/sign-in");
  if (actor.mustChangePassword) {
    return <PasswordChangeGate displayName={actor.displayName} />;
  }

  await ensureSeedData();
  const { from, to } = initialWeekRange();
  const nowIso = new Date().toISOString();
  const scope = { role: actor.role, employeeProfileId: actor.employeeProfileId };
  let profiles: TeamProfile[];
  if (actor.role === "admin") {
    profiles = await listTeamProfiles();
  } else {
    const own = (await listPublicEmployees()).find(
      (profile) => profile.id === actor.employeeProfileId,
    );
    profiles = own
      ? [
          {
            ...own,
            membershipId: actor.membershipId,
            active: true,
            sortOrder: 0,
            memberEmail: actor.email,
            memberDisplayName: actor.displayName,
            hasCredential: true,
          },
        ]
      : [];
  }
  const selectedProfileId =
    actor.employeeProfileId ?? profiles.find((profile) => profile.active)?.id ?? null;
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
      nowIso={nowIso}
    />
  );
}

function initialWeekRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { from: start.toISOString(), to: end.toISOString() };
}
