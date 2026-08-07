import { useState } from "react";

import type { AccessState } from "./contracts";

interface PublicAccessPanelProps {
  access: AccessState;
  publicUrl?: string | null;
  onStartQuick?: () => Promise<void>;
  onStop?: () => Promise<void>;
  onBeginPermanentLogin?: () => Promise<void>;
  onSavePermanentToken?: (token: string) => Promise<void>;
}

type PanelAction = "idle" | "starting" | "stopping" | "saving";

export function PublicAccessPanel({
  access,
  publicUrl = null,
  onStartQuick = async () => undefined,
  onStop = async () => undefined,
  onBeginPermanentLogin = async () => undefined,
  onSavePermanentToken = async () => undefined,
}: PublicAccessPanelProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [showPermanent, setShowPermanent] = useState(false);
  const [token, setToken] = useState("");
  const [action, setAction] = useState<PanelAction>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const runAction = async (nextAction: PanelAction, callback: () => Promise<void>) => {
    setAction(nextAction);
    setMessage(null);
    try {
      await callback();
    } catch {
      setMessage("Public access could not be changed. Local Daymark is still available.");
    } finally {
      setAction("idle");
    }
  };

  const startQuickLink = async () => {
    setShowWarning(false);
    await runAction("starting", onStartQuick);
  };

  const saveToken = async () => {
    const submittedToken = token.trim();
    if (!submittedToken) {
      setMessage("Enter the scoped Cloudflare tunnel token first.");
      return;
    }
    await runAction("saving", async () => {
      await onSavePermanentToken(submittedToken);
      setToken("");
      setMessage("Permanent access details are protected by Windows.");
    });
  };

  const hasPublicAccess = access === "temporary" || access === "permanent";

  return (
    <section className="file-card file-lilac access-card" aria-labelledby="access-heading">
      <p className="file-number">02 / ACCESS</p>
      <h2 id="access-heading">Private by default.</h2>
      <p>Local access is always available. Add public access only when you need it.</p>

      {access === "temporary_starting" || action === "starting" ? (
        <p className="access-state" role="status">Creating a protected test link…</p>
      ) : null}

      {hasPublicAccess && publicUrl ? (
        <div className="public-link-card">
          <strong>{access === "temporary" ? "Temporary test link" : "Permanent booking address"}</strong>
          <code>{publicUrl}</code>
          <button
            type="button"
            className="button button-paper"
            disabled={action !== "idle"}
            onClick={() => void runAction("stopping", onStop)}
          >
            {action === "stopping" ? "Stopping…" : "Stop public access"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button button-primary access-primary"
          disabled={action !== "idle" || access === "temporary_starting"}
          onClick={() => setShowWarning(true)}
        >
          Create temporary test link
          <span aria-hidden="true">↗</span>
        </button>
      )}

      {showWarning ? (
        <div className="access-warning" role="alert">
          <strong>Testing only</strong>
          <p>This address may change or stop without notice. It is not for real client bookings.</p>
          <div className="access-actions">
            <button type="button" className="button button-primary" onClick={() => void startQuickLink()}>
              I understand — create test link
            </button>
            <button type="button" className="text-action" onClick={() => setShowWarning(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <details className="permanent-access" open={showPermanent} onToggle={(event) => setShowPermanent(event.currentTarget.open)}>
        <summary>Permanent public access — for later</summary>
        <p>Use this after you have a domain and a Cloudflare account. Local Daymark keeps running if setup fails.</p>
        <button type="button" className="button button-paper" onClick={() => void runAction("saving", onBeginPermanentLogin)}>
          Open Cloudflare sign-in
        </button>
        <label>
          Scoped tunnel token
          <input
            type="password"
            value={token}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <button type="button" className="button button-paper" disabled={action !== "idle"} onClick={() => void saveToken()}>
          {action === "saving" ? "Protecting…" : "Protect permanent access"}
        </button>
      </details>

      {access === "error" || message ? (
        <p className="panel-message" role="status">{message ?? "Public access needs attention. Local Daymark is still available."}</p>
      ) : null}
    </section>
  );
}
