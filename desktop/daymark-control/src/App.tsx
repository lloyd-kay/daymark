export interface ControlStatus {
  state: "running" | "stopped" | "starting" | "needs_attention";
  mode: "service" | "manual";
  access: "local" | "temporary" | "permanent" | "error";
  localUrl: string;
  publicUrl: string | null;
  version: string;
  latestMigration: string;
  message: string | null;
}

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
  const isRunning = initialStatus.state === "running";
  const administratorUrl = `${initialStatus.localUrl}/workspace/sign-in`;

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
              <h2 id="service-heading">{stateLabel[initialStatus.state]}</h2>
            </div>
            <p
              className={`status-seal status-${initialStatus.state}`}
              aria-label={`Service status: ${stateLabel[initialStatus.state]}`}
              title={`Service status: ${stateLabel[initialStatus.state]}`}
            >
              <span aria-hidden="true">{isRunning ? "✓" : "■"}</span>
            </p>
          </div>
          <p className="status-message">{initialStatus.message ?? "Daymark is responding normally."}</p>
          <dl className="quick-facts">
            <div>
              <dt>Runs as</dt>
              <dd>{initialStatus.mode === "service" ? "Always-on Windows service" : "Only while Control is open"}</dd>
            </div>
            <div>
              <dt>Booking access</dt>
              <dd>{initialStatus.access === "local" ? "This computer only" : "Public link available"}</dd>
            </div>
          </dl>
          <div className="primary-actions">
            <button type="button" className="button button-primary">
              {isRunning ? "Restart Daymark" : "Start Daymark"}
              <span aria-hidden="true">↗</span>
            </button>
            <a className="button button-paper" href={administratorUrl}>
              Open administrator workspace
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <div className="file-grid" aria-label="Daymark controls">
          <section className="file-card file-sage" aria-labelledby="runtime-mode-heading">
            <p className="file-number">01 / RUNTIME</p>
            <h2 id="runtime-mode-heading">Always ready.</h2>
            <p>Service mode starts Daymark with Windows and keeps client links available.</p>
            <button type="button" className="text-action">Review runtime mode <span aria-hidden="true">→</span></button>
          </section>

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
            <strong>{initialStatus.version}</strong>
          </div>
          <div>
            <span>DATABASE</span>
            <strong>{initialStatus.latestMigration.replace(/^\d{4}_/, "").replace(/\.sql$/, "").replaceAll("_", " ")}</strong>
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
