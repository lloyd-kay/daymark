"use client";

import { Check, Copy, KeyRound, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import type { TeamProfile } from "../../lib/data/contracts";

export type TeamAccessPanelProps = {
  profiles: TeamProfile[];
  onProfilesChange(profiles: TeamProfile[]): void;
};

type AccountDraft = { email: string; displayName: string };

type TemporaryCredential = {
  employeeProfileId: string;
  publicName: string;
  temporaryPassword: string;
};

export function TeamAccessPanel({
  profiles,
  onProfilesChange,
}: TeamAccessPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>(() =>
    Object.fromEntries(profiles.map((profile) => [
      profile.id,
      {
        email: profile.memberEmail ?? "",
        displayName: profile.memberDisplayName ?? profile.publicName,
      },
    ])),
  );
  const [temporaryCredential, setTemporaryCredential] =
    useState<TemporaryCredential | null>(null);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function updateDraft(employeeProfileId: string, change: Partial<AccountDraft>) {
    setDrafts((current) => ({
      ...current,
      [employeeProfileId]: {
        email: current[employeeProfileId]?.email ?? "",
        displayName: current[employeeProfileId]?.displayName ?? "",
        ...change,
      },
    }));
  }

  async function createAccount(
    event: FormEvent<HTMLFormElement>,
    profile: TeamProfile,
  ) {
    event.preventDefault();
    const draft = drafts[profile.id] ?? { email: "", displayName: profile.publicName };
    if (!window.confirm(`Create a staff account for ${profile.publicName}?`)) return;
    await runAccountAction(profile.id, {
      action: "create-account",
      employeeProfileId: profile.id,
      email: draft.email,
      displayName: draft.displayName,
      confirm: true,
    }, (temporaryPassword, membershipId) => {
      onProfilesChange(profiles.map((item) => item.id === profile.id
        ? {
            ...item,
            membershipId,
            memberEmail: draft.email.trim().toLowerCase(),
            memberDisplayName: draft.displayName.trim(),
            hasCredential: true,
          }
        : item));
      setTemporaryCredential({
        employeeProfileId: profile.id,
        publicName: profile.publicName,
        temporaryPassword,
      });
      setMessage(`Staff account created for ${profile.publicName}.`);
    });
  }

  async function resetPassword(profile: TeamProfile) {
    if (!window.confirm(`Reset the temporary password for ${profile.publicName}?`)) return;
    await runAccountAction(profile.id, {
      action: "reset-password",
      employeeProfileId: profile.id,
      confirm: true,
    }, (temporaryPassword) => {
      setTemporaryCredential({
        employeeProfileId: profile.id,
        publicName: profile.publicName,
        temporaryPassword,
      });
      setMessage(`Temporary password reset for ${profile.publicName}.`);
    });
  }

  async function toggleActive(profile: TeamProfile) {
    const active = !profile.active;
    if (!window.confirm(`${active ? "Activate" : "Deactivate"} ${profile.publicName}?`)) {
      return;
    }
    setLoadingProfileId(profile.id);
    setMessage("");
    try {
      const response = await fetch("/api/workspace/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-active",
          employeeProfileId: profile.id,
          active,
          confirm: true,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The account could not be changed.");
      onProfilesChange(profiles.map((item) =>
        item.id === profile.id ? { ...item, active } : item));
      setMessage(`${profile.publicName} is now ${active ? "active" : "inactive"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The account could not be changed.");
    } finally {
      setLoadingProfileId(null);
    }
  }

  async function runAccountAction(
    employeeProfileId: string,
    requestBody: Record<string, unknown>,
    onSuccess: (temporaryPassword: string, membershipId: string | null) => void,
  ) {
    setLoadingProfileId(employeeProfileId);
    setMessage("");
    setTemporaryCredential(null);
    try {
      const response = await fetch("/api/workspace/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body = (await response.json()) as {
        membershipId?: string;
        temporaryPassword?: string;
        error?: string;
      };
      if (!response.ok || !body.temporaryPassword) {
        throw new Error(body.error ?? "The temporary password could not be created.");
      }
      onSuccess(body.temporaryPassword, body.membershipId ?? null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The staff account could not be updated.",
      );
    } finally {
      setLoadingProfileId(null);
    }
  }

  async function copyTemporaryPassword(password: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(password);
      setMessage("Temporary password copied.");
    } catch {
      setMessage(
        "Copy unavailable. Select the temporary password and copy it manually.",
      );
    }
  }

  return (
    <div className="team-view">
      <div className="team-heading">
        <div>
          <p className="eyebrow">Administrator desk</p>
          <h2>Four calendars. One clear view.</h2>
        </div>
        <span><KeyRound size={16} /> Account access stays administrator-controlled</span>
      </div>
      {message ? <p className="workspace-message" role="status">{message}</p> : null}
      <div className="team-cards">
        {profiles.map((profile, index) => {
          const draft = drafts[profile.id] ?? {
            email: profile.memberEmail ?? "",
            displayName: profile.memberDisplayName ?? profile.publicName,
          };
          const loading = loadingProfileId === profile.id;
          return (
            <article className="team-card" data-accent={profile.accent} key={profile.id}>
              <span className="team-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="avatar-stamp">{initials(profile.publicName)}</div>
              <div className="team-copy">
                <small>{profile.title}</small>
                <h3>{profile.publicName}</h3>
                <p>{profile.memberEmail ?? "No staff account yet"}</p>
              </div>
              <span className={profile.active ? "status-chip is-active" : "status-chip"}>
                {profile.active ? "Active" : "Inactive"}
              </span>

              {profile.hasCredential ? (
                <div className="team-actions">
                  <button type="button" onClick={() => resetPassword(profile)} disabled={loading}>
                    <KeyRound size={14} /> Reset temporary password
                  </button>
                  <button type="button" onClick={() => toggleActive(profile)} disabled={loading}>
                    {profile.active ? <LockKeyhole size={14} /> : <Check size={14} />}
                    {profile.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ) : (
                <form className="staff-account-form" onSubmit={(event) => createAccount(event, profile)}>
                  <label>
                    <span>Email</span>
                    <input
                      name={`staff-email-${profile.id}`}
                      type="email"
                      value={draft.email}
                      onChange={(event) => updateDraft(profile.id, { email: event.target.value })}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label>
                    <span>Display name</span>
                    <input
                      name={`staff-display-name-${profile.id}`}
                      value={draft.displayName}
                      maxLength={80}
                      onChange={(event) => updateDraft(profile.id, { displayName: event.target.value })}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    <KeyRound size={14} /> Create staff account
                  </button>
                </form>
              )}

              {temporaryCredential?.employeeProfileId === profile.id ? (
                <div className="temporary-password-slip" role="status">
                  <small>One-time temporary password for {temporaryCredential.publicName}</small>
                  <strong>{temporaryCredential.temporaryPassword}</strong>
                  <div>
                    <button
                      type="button"
                      onClick={() => copyTemporaryPassword(
                        temporaryCredential.temporaryPassword,
                      )}
                      aria-label="Copy temporary password"
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemporaryCredential(null)}
                      aria-label="Dismiss temporary password"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
