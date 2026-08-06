import type { Metadata } from "next";
import Link from "next/link";
import { normalizeWorkspaceSlug } from "../../../../lib/workspaces/slug";
import { SignInPanel } from "../../sign-in/SignInPanel";

export const metadata: Metadata = {
  title: "Staff sign in — Daymark",
  description: "Secure access to a private Daymark company workspace.",
};

export default async function CompanySignInPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string };
}) {
  const { workspaceSlug } = await params;
  return (
    <main className="workspace-gate">
      <header>
        <Link className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></Link>
        <span>Private company access</span>
      </header>
      <SignInPanel workspaceSlug={normalizeWorkspaceSlug(workspaceSlug)} setupAllowed={false} />
    </main>
  );
}
