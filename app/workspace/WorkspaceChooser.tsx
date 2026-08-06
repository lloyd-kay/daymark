import Link from "next/link";
import type { WorkspaceSummary } from "../../lib/data/contracts";

export function WorkspaceChooser({
  displayName,
  workspaces,
}: {
  displayName: string;
  workspaces: WorkspaceSummary[];
}) {
  return (
    <main className="workspace-gate workspace-chooser">
      <header>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </Link>
        <span>Private company access</span>
      </header>
      <section className="auth-card">
        <p className="eyebrow">Welcome back, {displayName}</p>
        <h1>Choose your workspace.</h1>
        <p>Only companies that have granted this account access appear here.</p>
        {workspaces.length ? (
          <div className="workspace-choice-list">
            {workspaces.map((workspace) => (
              <Link key={workspace.slug} href={`/workspace/${workspace.slug}`}>
                <span><strong>{workspace.name}</strong><small>{workspace.role}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="enrol-error" role="status">
            This account has no active company access. Ask a company administrator for an invitation.
          </p>
        )}
      </section>
    </main>
  );
}
