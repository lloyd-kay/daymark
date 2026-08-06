"use client";

import { Check, Copy, LockKeyhole, MailPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import type { TeamProfile } from "../../lib/data/contracts";

export type TeamAccessPanelProps = {
  workspaceSlug?: string;
  profiles: TeamProfile[];
  onProfilesChange(profiles: TeamProfile[]): void;
};

type InvitationSlip = {
  employeeProfileId: string;
  publicName: string;
  url: string;
  expiresAt: string;
};

export function TeamAccessPanel({
  workspaceSlug = "daymark",
  profiles,
  onProfilesChange,
}: TeamAccessPanelProps) {
  const [emails, setEmails] = useState<Record<string, string>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.memberEmail ?? ""])),
  );
  const [invitation, setInvitation] = useState<InvitationSlip | null>(null);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function invite(event: FormEvent<HTMLFormElement>, profile: TeamProfile) {
    event.preventDefault();
    const email = (emails[profile.id] ?? "").trim().toLowerCase();
    if (!window.confirm(`Create private access for ${profile.publicName}?`)) return;
    setLoadingProfileId(profile.id);
    setInvitation(null);
    setMessage("");
    try {
      const response = await fetch(`/api/workspace/team?workspace=${encodeURIComponent(workspaceSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-invitation",
          employeeProfileId: profile.id,
          email,
          role: "employee",
          confirm: true,
        }),
      });
      const body = await response.json() as {
        code?: string;
        expiresAt?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !body.code || !body.expiresAt) {
        throw new Error(body.error ?? "The access invitation could not be created.");
      }
      setInvitation({
        employeeProfileId: profile.id,
        publicName: profile.publicName,
        url: `${window.location.origin}/join/${encodeURIComponent(body.code)}`,
        expiresAt: body.expiresAt,
      });
      setMessage(body.message ?? "Access invitation created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The access invitation could not be created.");
    } finally {
      setLoadingProfileId(null);
    }
  }

  async function toggleActive(profile: TeamProfile) {
    const active = !profile.active;
    if (!window.confirm(`${active ? "Activate" : "Deactivate"} ${profile.publicName} for this company?`)) return;
    setLoadingProfileId(profile.id);
    setMessage("");
    try {
      const response = await fetch(`/api/workspace/team?workspace=${encodeURIComponent(workspaceSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-active",
          employeeProfileId: profile.id,
          active,
          confirm: true,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Company access could not be changed.");
      onProfilesChange(profiles.map((item) => item.id === profile.id ? { ...item, active } : item));
      setMessage(`${profile.publicName} is now ${active ? "active" : "inactive"} for this company.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Company access could not be changed.");
    } finally {
      setLoadingProfileId(null);
    }
  }

  async function copyInvitation(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Invitation link copied.");
    } catch {
      setMessage("Copy unavailable. Select the invitation link and copy it manually.");
    }
  }

  return (
    <div className="team-view">
      <div className="team-heading">
        <div><p className="eyebrow">Administrator desk</p><h2>Company access, by invitation.</h2></div>
        <span><MailPlus size={16} /> People can join only after an administrator grants access</span>
      </div>
      {message ? <p className="workspace-message" role="status">{message}</p> : null}
      <div className="team-cards">
        {profiles.map((profile, index) => {
          const loading = loadingProfileId === profile.id;
          return (
            <article className="team-card" data-accent={profile.accent} key={profile.id}>
              <span className="team-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="avatar-stamp">{initials(profile.publicName)}</div>
              <div className="team-copy">
                <small>{profile.title}</small><h3>{profile.publicName}</h3>
                <p>{profile.memberEmail ?? "No company access yet"}</p>
              </div>
              <span className={profile.active ? "status-chip is-active" : "status-chip"}>{profile.active ? "Active" : "Inactive"}</span>

              {profile.membershipId ? (
                <div className="team-actions">
                  <button type="button" onClick={() => toggleActive(profile)} disabled={loading}>
                    {profile.active ? <LockKeyhole size={14} /> : <Check size={14} />}
                    {profile.active ? "Remove company access" : "Restore company access"}
                  </button>
                </div>
              ) : (
                <form className="staff-account-form" onSubmit={(event) => invite(event, profile)}>
                  <label><span>Email</span><input name={`staff-email-${profile.id}`} type="email" value={emails[profile.id] ?? ""} onChange={(event) => setEmails((current) => ({ ...current, [profile.id]: event.target.value }))} autoComplete="off" required /></label>
                  <button type="submit" disabled={loading}><MailPlus size={14} /> Create private invitation</button>
                </form>
              )}

              {invitation?.employeeProfileId === profile.id ? (
                <div className="temporary-password-slip invitation-slip" role="status">
                  <small>Single-use invitation for {invitation.publicName}</small>
                  <strong>{invitation.url}</strong>
                  <small>Expires {new Date(invitation.expiresAt).toLocaleDateString("en-GB")}</small>
                  <div>
                    <button type="button" onClick={() => copyInvitation(invitation.url)} aria-label="Copy invitation link"><Copy size={14} /> Copy link</button>
                    <button type="button" onClick={() => setInvitation(null)} aria-label="Dismiss invitation link">Dismiss</button>
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
