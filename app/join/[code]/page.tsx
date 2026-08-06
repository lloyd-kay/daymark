import type { Metadata } from "next";
import Link from "next/link";
import { getAccountSession } from "../../../lib/auth/membership";
import { SignInPanel } from "../../workspace/sign-in/SignInPanel";
import { JoinWorkspacePanel } from "./JoinWorkspacePanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company invitation — Daymark",
  description: "Accept private access to a Daymark company workspace.",
};

export default async function JoinWorkspacePage({
  params,
}: {
  params: Promise<{ code: string }> | { code: string };
}) {
  const { code } = await params;
  const session = await getAccountSession();
  return (
    <main className="workspace-gate">
      <header>
        <Link className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></Link>
        <span>Invitation-only access</span>
      </header>
      {session
        ? <JoinWorkspacePanel code={code} />
        : <SignInPanel setupAllowed={false} redirectPath={`/join/${encodeURIComponent(code)}`} />}
    </main>
  );
}
