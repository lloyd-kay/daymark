import { useState } from "react";

import type { RuntimeMode } from "./contracts";

export const manualModeWarning =
  "Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.";

interface RuntimeModePanelProps {
  mode: RuntimeMode;
  onChange: (mode: RuntimeMode) => void | Promise<void>;
}

export function RuntimeModePanel({ mode, onChange }: RuntimeModePanelProps) {
  const [pendingManual, setPendingManual] = useState(false);

  const chooseService = () => {
    setPendingManual(false);
    void onChange("service");
  };

  const confirmManual = () => {
    setPendingManual(false);
    void onChange("manual");
  };

  return (
    <section className="file-card file-sage runtime-mode-card" aria-labelledby="runtime-mode-heading">
      <p className="file-number">01 / RUNTIME</p>
      <h2 id="runtime-mode-heading">Always ready.</h2>
      <p>Choose how Daymark runs on this computer. The always-on service is recommended.</p>

      <fieldset className="mode-options">
        <legend className="visually-hidden">Runtime mode</legend>
        <label className="mode-option">
          <input
            type="radio"
            name="runtime-mode"
            aria-label="Always-on service"
            checked={mode === "service" && !pendingManual}
            onChange={chooseService}
          />
          <span>
            <strong>Always-on service</strong>
            <small>Starts with Windows and serves booking links whenever this computer is online.</small>
          </span>
        </label>
        <label className="mode-option">
          <input
            type="radio"
            name="runtime-mode"
            aria-label="Manual mode"
            checked={mode === "manual" || pendingManual}
            onChange={() => setPendingManual(true)}
          />
          <span>
            <strong>Manual mode</strong>
            <small>Runs only while Daymark Control remains open.</small>
          </span>
        </label>
      </fieldset>

      {pendingManual ? (
        <div className="mode-warning" role="alert">
          <strong>Before switching to manual mode</strong>
          <p>{manualModeWarning}</p>
          <div className="mode-warning-actions">
            <button type="button" className="button button-primary" onClick={confirmManual}>
              I understand — use manual mode
            </button>
            <button type="button" className="text-action" onClick={() => setPendingManual(false)}>
              Keep always-on service
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
