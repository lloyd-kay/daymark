import { useEffect, useState, type MouseEvent } from "react";

import { BackupPanel } from "./BackupPanel";
import type { RuntimeStatus } from "./contracts";
import {
  beginPermanentTunnelLogin,
  copySetupCode,
  createBackup,
  getSetupState,
  restoreBackup,
  revealSetupCode,
  savePermanentTunnelToken,
  startQuickTunnel,
  stopTunnel,
  verifyBackup,
} from "./control";
import { PublicAccessPanel } from "./PublicAccessPanel";
import { RuntimeModePanel } from "./RuntimeModePanel";
import { SetupPanel } from "./SetupPanel";
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

const accessLabel: Record<ControlStatus["access"], string> = {
  local: "This computer only",
  temporary_starting: "Creating temporary link",
  temporary: "Temporary test link",
  permanent: "Permanent access configured",
  error: "Local only — public access needs attention",
};

export function App({ initialStatus }: AppProps) {
  const status = useRuntimeStatus(initialStatus);
  const [runtimeAction, setRuntimeAction] = useState<"idle" | "working">("idle");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [setupConfigured, setSetupConfigured] = useState(true);
  const isRunning = status.state === "running";
  const administratorUrl = `${status.localUrl}/workspace/sign-in`;

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let active = true;
    void getSetupState()
      .then((state) => {
        if (active) setSetupConfigured(state.configured);
      })
      .catch(() => {
        if (active) setSetupConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
              <dd>{accessLabel[status.access]}</dd>
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

          <PublicAccessPanel
            access={status.access}
            publicUrl={status.publicUrl}
            onStartQuick={async () => {
              if (isTauriRuntime()) await startQuickTunnel();
            }}
            onStop={async () => {
              if (isTauriRuntime()) await stopTunnel();
            }}
            onBeginPermanentLogin={async () => {
              if (isTauriRuntime()) await beginPermanentTunnelLogin();
            }}
            onSavePermanentToken={async (token) => {
              if (isTauriRuntime()) await savePermanentTunnelToken(token);
            }}
          />

          <BackupPanel onCreate={createBackup} onVerify={verifyBackup} onRestore={restoreBackup} />

          <SetupPanel
            configured={setupConfigured}
            onReveal={revealSetupCode}
            onCopy={copySetupCode}
          />
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
