"use client";

import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { navigate } from "../../../lib/browser-navigation";

type AuthView = "sign-in" | "setup";

const GENERIC_ERROR = "We couldn't complete that request. Check your details and try again.";

export function SignInPanel({
  workspaceSlug,
  setupAllowed = true,
  redirectPath,
  initialView = "sign-in",
  setupProfileCode,
}: {
  workspaceSlug?: string;
  setupAllowed?: boolean;
  redirectPath?: string;
  initialView?: AuthView;
  setupProfileCode?: string;
} = {}) {
  const [view, setView] = useState<AuthView>(initialView);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const body = view === "sign-in"
      ? {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }
      : {
          setupCode: String(form.get("setupCode") ?? ""),
          workspaceName: String(form.get("workspaceName") ?? ""),
          workspaceSlug: String(form.get("workspaceSlug") ?? ""),
          displayName: String(form.get("displayName") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          ...(setupProfileCode ? { setupProfileCode } : {}),
        };

    try {
      const response = await fetch(`/api/auth/${view}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("authentication failed");
      const result = await response.json() as { workspaceSlug?: string };
      navigate(
        redirectPath && view === "sign-in"
          ? redirectPath
          : view === "setup" && result.workspaceSlug
          ? `/workspace/${encodeURIComponent(result.workspaceSlug)}${setupProfileCode ? "?view=embed" : ""}`
          : workspaceSlug
            ? `/workspace/${encodeURIComponent(workspaceSlug)}`
            : "/workspace",
      );
    } catch {
      setStatus(GENERIC_ERROR);
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <span className="enrol-icon" aria-hidden="true">
        {view === "sign-in" ? <LockKeyhole size={22} /> : <KeyRound size={22} />}
      </span>
      <p className="eyebrow">Protected team access</p>
      <h1>{view === "sign-in" ? "Staff sign in." : "Set up Daymark."}</h1>
      <p>
        {view === "sign-in"
          ? "Employees see only their own calendar. Administrators can coordinate the full team."
          : "Create the first administrator account using the private setup code supplied with this site."}
      </p>

      {view === "setup" && !setupProfileCode ? (
        <a className="quiet-link setup-profile-import-link" href="/setup-profile/import">
          Import setup code
        </a>
      ) : null}

      {setupAllowed ? (
        <div className="auth-view-switch" aria-label="Authentication options">
          <button type="button" aria-pressed={view === "sign-in"} onClick={() => switchView("sign-in")}>Sign in</button>
          <button type="button" aria-pressed={view === "setup"} onClick={() => switchView("setup")}>First-time setup</button>
        </div>
      ) : null}

      <form onSubmit={submit}>
        {view === "setup" ? (
          <>
            <label htmlFor="setup-code">Setup code</label>
            <input id="setup-code" name="setupCode" autoComplete="one-time-code" required />
            <label htmlFor="workspace-name">Company name</label>
            <input id="workspace-name" name="workspaceName" autoComplete="organization" minLength={2} maxLength={80} required />
            <label htmlFor="workspace-slug">Booking URL</label>
            <span className="field-prefix">daymark / book /</span>
            <input id="workspace-slug" name="workspaceSlug" inputMode="url" minLength={2} maxLength={64} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="cedar-house" required />
            <label htmlFor="display-name">Display name</label>
            <input id="display-name" name="displayName" autoComplete="name" required />
          </>
        ) : null}
        <label htmlFor={`${view}-email`}>Email address</label>
        <input id={`${view}-email`} name="email" type="email" autoComplete="email" required />
        <label htmlFor={`${view}-password`}>Password</label>
        <input
          id={`${view}-password`}
          name="password"
          type="password"
          autoComplete={view === "sign-in" ? "current-password" : "new-password"}
          minLength={12}
          maxLength={128}
          required
        />
        <button className="workspace-primary" type="submit" disabled={loading}>
          {loading ? "Checking…" : view === "sign-in" ? "Sign in" : "Create administrator"}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      {status ? <p className="enrol-error" role="status">{status}</p> : null}
    </section>
  );

  function switchView(nextView: AuthView) {
    setView(nextView);
    setStatus("");
  }
}
