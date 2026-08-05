"use client";

import { ArrowRight, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export function EnrolmentPanel({
  kind,
  displayName,
  signOutPath,
}: {
  kind: "setup" | "invitation";
  displayName: string;
  signOutPath: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/workspace/enrol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, code }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "That code could not be used.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be used.");
      setLoading(false);
    }
  }

  return (
    <WorkspaceFrame>
      <div className="enrol-card">
        <span className="enrol-icon"><KeyRound size={22} aria-hidden="true" /></span>
        <p className="eyebrow">Signed in as {displayName}</p>
        <h1>{kind === "setup" ? "Claim the first admin desk." : "Join your private calendar."}</h1>
        <p>
          {kind === "setup"
            ? "Use the one-time setup code supplied with this Daymark site. Once claimed, you can create employee invitations from the team view."
            : "Ask your administrator for a single-use Daymark invitation code. Your account will be linked only to your employee profile."}
        </p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">
            {kind === "setup" ? "Administrator setup code" : "Team invitation code"}
          </label>
          <div>
            <input
              id="access-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              minLength={4}
              maxLength={128}
              required
              placeholder={kind === "setup" ? "Enter setup code" : "DAYMARK-…"}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Checking…" : "Continue"} <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
        {error ? <p className="enrol-error" role="status">{error}</p> : null}
        <a className="quiet-link" href={signOutPath}>
          <LogOut size={15} aria-hidden="true" /> Use a different account
        </a>
      </div>
    </WorkspaceFrame>
  );
}

export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="workspace-gate">
      <header>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </Link>
        <span>Team workspace</span>
      </header>
      {children}
    </main>
  );
}
