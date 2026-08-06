import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountSession } from "../../lib/auth/membership";
import { listAccountWorkspaces } from "../../lib/auth/repository";
import { PasswordChangeGate } from "./PasswordChangeGate";
import { WorkspaceChooser } from "./WorkspaceChooser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your companies — Daymark",
  description: "Choose a private Daymark company workspace.",
};

export default async function WorkspacePage() {
  const session = await getAccountSession();
  if (!session) redirect("/workspace/sign-in");
  if (session.mustChangePassword) {
    return <PasswordChangeGate displayName={session.displayName} />;
  }
  return (
    <WorkspaceChooser
      displayName={session.displayName}
      workspaces={await listAccountWorkspaces(session.accountId)}
    />
  );
}
