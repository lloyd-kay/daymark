import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "../chatgpt-auth";
import {
  administratorExists,
  ensureSeedData,
  getEmployeeAvailability,
  getMembershipByOaiUserId,
  listPublicEmployees,
  listSchedule,
  listTeamProfiles,
} from "../../lib/data/repository";
import { resolveWorkspaceActor } from "../../lib/auth/membership";
import type { TeamProfile } from "../../lib/data/contracts";
import { EnrolmentPanel, WorkspaceFrame } from "./EnrolmentPanel";
import { WorkspaceClient } from "./WorkspaceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team workspace — Daymark",
  description: "A private scheduling workspace for the Daymark team.",
};

export default async function WorkspacePage() {
  const user = await getChatGPTUser();
  if (!user) return <SignedOutWorkspace />;

  await ensureSeedData();
  const membership = await getMembershipByOaiUserId(user.userId);
  const identity = {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
  };
  const actor = resolveWorkspaceActor(identity, membership);
  if (!actor) {
    return (
      <EnrolmentPanel
        kind={(await administratorExists()) ? "invitation" : "setup"}
        displayName={user.displayName}
        signOutPath={chatGPTSignOutPath("/workspace")}
      />
    );
  }

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
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}

function SignedOutWorkspace() {
  return (
    <WorkspaceFrame>
      <section className="workspace-welcome">
        <Link className="quiet-link" href="/">
          <ArrowLeft size={15} aria-hidden="true" /> Return to booking
        </Link>
        <div className="welcome-lock" aria-hidden="true"><LockKeyhole size={25} /></div>
        <p className="eyebrow">Protected team access</p>
        <h1>A private room for the team.</h1>
        <p className="welcome-copy">
          Employees see only their own calendar. Administrators can coordinate the
          full team, while client details remain behind authenticated access.
        </p>
        <a className="sign-in-button" href={chatGPTSignInPath("/workspace")}>
          Sign in with ChatGPT <ArrowRight size={18} aria-hidden="true" />
        </a>
        <div className="welcome-points">
          <span><ShieldCheck size={16} /> Server-checked permissions</span>
          <span><LockKeyhole size={16} /> No shared employee calendars</span>
        </div>
      </section>
    </WorkspaceFrame>
  );
}

function initialWeekRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { from: start.toISOString(), to: end.toISOString() };
}
