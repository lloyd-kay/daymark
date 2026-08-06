"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";

export function JoinWorkspacePanel({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function accept() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json() as { workspaceSlug?: string; error?: string };
      if (!response.ok || !body.workspaceSlug) throw new Error(body.error ?? "Access could not be granted.");
      window.location.assign(`/workspace/${encodeURIComponent(body.workspaceSlug)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be granted.");
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <span className="enrol-icon" aria-hidden="true"><MailCheck size={22} /></span>
      <p className="eyebrow">Private company invitation</p>
      <h1>Accept company access.</h1>
      <p>This invitation adds only this company to your Daymark account. Its administrator will not see any other company you use.</p>
      <button className="workspace-primary" type="button" onClick={accept} disabled={loading}>
        {loading ? "Checking…" : "Accept invitation"}<ArrowRight size={17} />
      </button>
      {message ? <p className="enrol-error" role="status">{message}</p> : null}
    </section>
  );
}
