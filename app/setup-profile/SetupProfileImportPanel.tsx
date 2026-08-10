"use client";

import { FormEvent, useMemo, useState } from "react";
import type { WorkspaceSummary } from "../../lib/data/contracts";
import { navigate } from "../../lib/browser-navigation";
import {
  decodeSetupProfile,
  encodeSetupProfile,
  SetupProfileError,
  type SetupProfile,
} from "../../lib/setup-profile";
import { SignInPanel } from "../workspace/sign-in/SignInPanel";
import { SetupProfileConfirmation } from "./SetupProfileConfirmation";

export type SetupProfileImportPanelProps = {
  initialCode: string;
  installationState: "unclaimed" | "sign-in-required" | "ready";
  adminWorkspaces: WorkspaceSummary[];
  redirectPath: string;
};

type PendingProfile = { code: string; profile: SetupProfile };

export function SetupProfileImportPanel({
  initialCode,
  installationState,
  adminWorkspaces,
  redirectPath,
}: SetupProfileImportPanelProps) {
  const initialReview = review(initialCode);
  const eligibleWorkspaces = useMemo(
    () => adminWorkspaces.filter((workspace) => workspace.role === "admin"),
    [adminWorkspaces],
  );
  const [rawCode, setRawCode] = useState(initialCode);
  const [pending, setPending] = useState<PendingProfile | null>(initialReview.pending);
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    eligibleWorkspaces.length === 1 ? eligibleWorkspaces[0].slug : "",
  );
  const [confirmedSetupCode, setConfirmedSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialReview.error);

  if (installationState === "sign-in-required") {
    return (
      <SignInPanel
        setupAllowed={false}
        redirectPath={redirectPath}
      />
    );
  }

  if (installationState === "unclaimed" && confirmedSetupCode) {
    return (
      <SignInPanel
        initialView="setup"
        setupAllowed={false}
        setupProfileCode={confirmedSetupCode}
      />
    );
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = review(rawCode);
    setPending(result.pending);
    setError(result.error);
  }

  function cancelReview() {
    setPending(null);
    setRawCode("");
    setError("");
  }

  async function confirmImport() {
    if (!pending) return;
    if (installationState === "unclaimed") {
      setConfirmedSetupCode(pending.code);
      return;
    }
    if (!selectedWorkspace) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/embed-preferences?workspace=${encodeURIComponent(selectedWorkspace)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import-profile", code: pending.code }),
        },
      );
      if (!response.ok) throw new Error("import failed");
      navigate(
        `/workspace/${encodeURIComponent(selectedWorkspace)}?view=embed`,
      );
    } catch {
      setError("The setup could not be imported. Try again.");
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <SetupProfileConfirmation
        profile={pending.profile}
        busy={busy}
        confirmDisabled={installationState === "ready" && !selectedWorkspace}
        onConfirm={confirmImport}
        onCancel={cancelReview}
      >
        {installationState === "ready" ? (
          <div className="setup-profile-workspace">
            {eligibleWorkspaces.length === 1 ? (
              <p>Workspace: <strong>{eligibleWorkspaces[0].name}</strong></p>
            ) : eligibleWorkspaces.length > 1 ? (
              <label htmlFor="setup-profile-workspace">
                <span>Workspace</span>
                <select
                  id="setup-profile-workspace"
                  value={selectedWorkspace}
                  onChange={(event) => setSelectedWorkspace(event.target.value)}
                >
                  <option value="">Choose a workspace</option>
                  {eligibleWorkspaces.map((workspace) => (
                    <option key={workspace.slug} value={workspace.slug}>{workspace.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p role="alert">You need administrator access to a workspace before importing this setup.</p>
            )}
          </div>
        ) : null}
        {error ? <p className="enrol-error" role="alert">{error}</p> : null}
      </SetupProfileConfirmation>
    );
  }

  return (
    <section className="setup-profile-entry auth-card">
      <p className="eyebrow">Transfer a Daymark setup</p>
      <h1>Import setup code.</h1>
      <p>Paste the code from the Daymark demonstration, then review it before anything changes.</p>
      <form onSubmit={submitReview}>
        <label htmlFor="setup-profile-code">Setup code</label>
        <input
          id="setup-profile-code"
          value={rawCode}
          onChange={(event) => {
            setRawCode(event.target.value);
            setError("");
          }}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button className="workspace-primary" type="submit">Review setup</button>
      </form>
      {error ? <p className="enrol-error" role="alert">{error}</p> : null}
    </section>
  );
}

function review(value: string): { pending: PendingProfile | null; error: string } {
  if (!value) return { pending: null, error: "" };
  try {
    const profile = decodeSetupProfile(value);
    return {
      pending: { profile, code: encodeSetupProfile(profile.layout) },
      error: "",
    };
  } catch (error) {
    return {
      pending: null,
      error: error instanceof SetupProfileError
        ? setupProfileGuidance(error)
        : "That setup code is not valid.",
    };
  }
}

function setupProfileGuidance(error: SetupProfileError): string {
  if (error.code === "invalid_checksum") {
    return "That setup code looks incomplete or mistyped.";
  }
  if (error.code === "unsupported_version") {
    return "Update Daymark before importing this setup code.";
  }
  return "That setup code is not valid.";
}
