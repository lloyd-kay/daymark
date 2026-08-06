import { useState, type MouseEvent } from "react";

import type { RuntimeStatus } from "./contracts";
import { RuntimeModePanel } from "./RuntimeModePanel";
import {
  isTauriRuntime,
  openLocalUrl,
  setRuntimeMode,
  startRuntime,
  stopRuntime,
  useRuntimeStatus,
} from "./runtime";

export type ControlStatus = RuntimeStatus;

interface AppProps {
  initialStatus: ControlStatus;
}

const stateLabel: Record<ControlStatus["state"], string> = {
  running: "Running",
  stopped: "Stopped",
  starting: "Starting",
  needs_attention: "Needs attention",
};

export function App({ initialStatus }: AppProps) {
  const status = useRuntimeStatus(initialStatus);
  const [runtimeAction, setRuntimeAction] = useState<"idle" | "working">("idle");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const isRunning = status.state === "running";
  const administratorUrl = `${status.localUrl}/workspace/sign-in`;

  const handleAdministratorLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isTauriRuntime()) return;
    event.preventDefault();
    void openLocalUrl(administratorUrl);
  };

  const handleRuntimeMode = async (mode: RuntimeStatus["mode"]) => {
    if (!isTauriRuntime()) return;
    setRuntimeError(null);
    try {
      await setRuntimeMode(mode);
    } catch {
      setRuntimeError("Windows could not change the runtime mode. Administrator approval may be required.");
    }
  };

  const handleRuntimeAction = async () => {
    if (!isTauriRuntime() || runtimeAction === "working") return;
    setRuntimeAction("working");
    setRuntimeError(null);
    try {
      if (isRunning) await stopRuntime();
      await startRuntime();
    } catch {
      setRuntimeError("Windows could not change the Daymark service. Administrator approval may be required.");
    } finally {
      setRuntimeAction("idle");
    }
  };

  return (
    <div className="control-shell">
      <header className="masthead">
        <a className="brand" href="#control" aria-label="Daymark Control home">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DAYMARK</span>
        </a>
        <div className="masthead-note">
          <span className="masthead-rule" aria-hidden="true" />
          PRIVATE TEAM SCHEDULING
        </div>
      </header>

      <main id="control" className="control-main">
        <section className="intro" aria-labelledby="control-title">
          <p className="eyebrow">LOCAL CONTROL DESK</p>
          <h1 id="control-title">Daymark Control</h1>
          <p className="intro-copy">
            Keep the booking service steady, private and recoverable from one calm place.
          </p>
        </section>

        <section className="service-sheet" aria-labelledby="service-heading">
          <div className="sheet-binding" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <div className="service-heading-row">
            <div>
              <p className="eyebrow">SERVICE STATUS</p>
              <h2 id="service-heading">{stateLabel[status.state]}</h2>
            </div>
            <p
              className={`status-seal status-${status.state}`}
              aria-label={`Service status: ${stateLabel[status.state]}`}
              title={`Service status: ${stateLabel[status.state]}`}
            >
              <span aria-hidden="true">{isRunning ? "✓" : "■"}</span>
            </p>
          </div>
          <p className="status-message">{status.message ?? "Daymark is responding normally."}</p>
          <dl className="quick-facts">
            <div>
              <dt>Runs as</dt>
              <dd>{status.mode === "service" ? "Always-on Windows service" : "Only while Control is open"}</dd>
            </div>
            <div>
              <dt>Booking access</dt>
              <dd>{status.access === "local" ? "This computer only" : "Public link available"}</dd>
            </div>
          </dl>
          {runtimeError ? <p className="control-error" role="alert">{runtimeError}</p> : null}
          <div className="primary-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={runtimeAction === "working"}
              onClick={handleRuntimeAction}
            >
              {runtimeAction === "working" ? "Working…" : isRunning ? "Restart Daymark" : "Start Daymark"}
              <span aria-hidden="true">↗</span>
            </button>
            <a className="button button-paper" href={administratorUrl} onClick={handleAdministratorLink}>
              Open administrator workspace
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <div className="file-grid" aria-label="Daymark controls">
          <RuntimeModePanel mode={status.mode} onChange={handleRuntimeMode} />

          <section className="file-card file-lilac" aria-labelledby="access-heading">
            <p className="file-number">02 / ACCESS</p>
            <h2 id="access-heading">Private by default.</h2>
            <p>Local access is active. Public links are created only when you ask for one.</p>
            <button type="button" className="text-action">Manage booking access <span aria-hidden="true">→</span></button>
          </section>

          <section className="file-card file-ochre" aria-labelledby="backup-heading">
            <p className="file-number">03 / BACKUPS</p>
            <h2 id="backup-heading">A safe copy, on demand.</h2>
            <p>Create a verified backup before upgrades or whenever the calendar matters most.</p>
            <button type="button" className="text-action">Create verified backup <span aria-hidden="true">→</span></button>
          </section>

          <section className="file-card file-sky" aria-labelledby="recovery-heading">
            <p className="file-number">04 / RECOVERY</p>
            <h2 id="recovery-heading">Clear steps when needed.</h2>
            <p>Diagnostics stay free of booking details, passwords and protected setup codes.</p>
            <button type="button" className="text-action">Open recovery tools <span aria-hidden="true">→</span></button>
          </section>
        </div>

        <footer className="system-strip" aria-label="Installed Daymark details">
          <div>
            <span>CONTROL VERSION</span>
            <strong>{status.version}</strong>
          </div>
          <div>
            <span>DATABASE</span>
            <strong>{status.latestMigration.replace(/^\d{4}_/, "").replace(/\.sql$/, "").replaceAll("_", " ")}</strong>
          </div>
          <div className="privacy-note">
            <span aria-hidden="true">◇</span>
            Calendars remain employee-private.
          </div>
        </footer>
      </main>
    </div>
  );
}
