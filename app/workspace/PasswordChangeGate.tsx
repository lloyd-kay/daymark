"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

const GENERIC_ERROR = "We couldn't update your password. Check the details and try again.";

export function PasswordChangeGate({ displayName }: { displayName: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      if (!response.ok) throw new Error("password change failed");
      window.location.assign("/workspace");
    } catch {
      setStatus(GENERIC_ERROR);
      setLoading(false);
    }
  }

  return (
    <main className="workspace-gate">
      <header>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </Link>
        <span>Secure your account</span>
      </header>
      <section className="auth-card">
        <span className="enrol-icon"><KeyRound size={22} aria-hidden="true" /></span>
        <p className="eyebrow">Welcome, {displayName}</p>
        <h1>Choose a private password.</h1>
        <p>Replace your temporary password before opening the team workspace.</p>
        <form onSubmit={submit}>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          <button className="workspace-primary" type="submit" disabled={loading}>
            {loading ? "Updating…" : "Change password"} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
        {status ? <p className="enrol-error" role="status">{status}</p> : null}
      </section>
    </main>
  );
}
