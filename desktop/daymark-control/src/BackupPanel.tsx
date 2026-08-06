import { useState } from "react";

export interface BackupSummary {
  manifestFile: string;
  createdAt: string;
  integrity: "verified";
}

interface BackupPanelProps {
  onCreate: () => Promise<BackupSummary>;
  onVerify: (path: string) => Promise<BackupSummary>;
  onRestore: (path: string) => Promise<void>;
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function BackupPanel({ onCreate, onVerify, onRestore }: BackupPanelProps) {
  const [manifestPath, setManifestPath] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [latestBackup, setLatestBackup] = useState<BackupSummary | null>(null);
  const [verifiedRestore, setVerifiedRestore] = useState<BackupSummary | null>(null);
  const [busy, setBusy] = useState<"idle" | "creating" | "verifying" | "restoring">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const create = async () => {
    setBusy("creating");
    setMessage(null);
    try {
      setLatestBackup(await onCreate());
    } catch {
      setMessage("Daymark could not create a verified backup.");
    } finally {
      setBusy("idle");
    }
  };

  const verify = async () => {
    setBusy("verifying");
    setMessage(null);
    setVerifiedRestore(null);
    setConfirmation("");
    try {
      setVerifiedRestore(await onVerify(manifestPath));
    } catch {
      setMessage("That backup could not be verified and will not be restored.");
    } finally {
      setBusy("idle");
    }
  };

  const restore = async () => {
    if (!verifiedRestore || confirmation !== "RESTORE") return;
    setBusy("restoring");
    setMessage(null);
    try {
      await onRestore(verifiedRestore.manifestFile);
      setMessage("The verified backup was restored successfully.");
      setVerifiedRestore(null);
      setConfirmation("");
    } catch {
      setMessage("The restore did not complete. Daymark kept the current data and safety backup.");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <section className="file-card file-ochre backup-card" aria-labelledby="backup-heading">
      <p className="file-number">03 / BACKUPS</p>
      <h2 id="backup-heading">A safe copy, on demand.</h2>
      <p>Create a verified backup before upgrades or whenever the calendar matters most.</p>

      <button type="button" className="button button-primary" disabled={busy !== "idle"} onClick={create}>
        {busy === "creating" ? "Creating backup…" : "Create verified backup"}
      </button>

      {latestBackup ? (
        <div className="backup-result" role="status">
          <strong>Integrity verified</strong>
          <span>{formatCreatedAt(latestBackup.createdAt)}</span>
        </div>
      ) : null}

      <details className="restore-drawer">
        <summary>Restore from a backup</summary>
        <label>
          <span>Backup manifest path</span>
          <input
            value={manifestPath}
            onChange={(event) => {
              setManifestPath(event.target.value);
              setVerifiedRestore(null);
              setConfirmation("");
            }}
          />
        </label>
        <button
          type="button"
          className="button button-paper"
          disabled={!manifestPath.trim() || busy !== "idle"}
          onClick={verify}
        >
          {busy === "verifying" ? "Verifying…" : "Verify backup"}
        </button>

        {verifiedRestore ? (
          <div className="restore-confirmation">
            <strong>Ready to restore</strong>
            <p>Daymark will create a safety backup before replacing current data.</p>
            <label>
              <span>Type RESTORE to confirm</span>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            <button
              type="button"
              className="button button-primary"
              disabled={confirmation !== "RESTORE" || busy !== "idle"}
              onClick={restore}
            >
              {busy === "restoring" ? "Restoring…" : "Restore verified backup"}
            </button>
          </div>
        ) : null}
      </details>

      {message ? <p className="panel-message" role="status">{message}</p> : null}
    </section>
  );
}
