"use client";

import { Code2, Copy } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { TeamProfile } from "../../lib/data/contracts";

type EmbedMode = "floating" | "inline";

const EMPLOYEE_PROFILE_ID = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const DEFAULT_LABEL = "Book an appointment";

export function EmbedPanel({ profiles }: { profiles: TeamProfile[] }) {
  const [mode, setMode] = useState<EmbedMode>("floating");
  const [employee, setEmployee] = useState("all");
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const origin = useSyncExternalStore(subscribeToOrigin, browserOrigin, serverOrigin);
  const publicProfiles = useMemo(
    () => profiles.filter(
      (profile) => profile.active && EMPLOYEE_PROFILE_ID.test(profile.id),
    ),
    [profiles],
  );

  const snippet = origin
    ? buildEmbedSnippet(origin, mode, employee, DEFAULT_LABEL)
    : "";

  async function copySnippet() {
    if (!snippet) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setCopyMessage("Snippet copied.");
    } catch {
      setCopied(false);
      setCopyMessage("Copy unavailable. Select the snippet and copy it manually.");
    }
  }

  return (
    <div className="embed-panel">
      <div className="team-heading">
        <div>
          <p className="eyebrow">Hosted booking</p>
          <h2>Place Daymark where clients need it.</h2>
        </div>
        <span><Code2 size={16} /> No client data is included in this code</span>
      </div>

      <div className="embed-configurator">
        <div className="embed-controls">
          <fieldset>
            <legend>Display mode</legend>
            <label>
              <input
                type="radio"
                name="embed-mode"
                value="floating"
                checked={mode === "floating"}
                onChange={() => { setMode("floating"); setCopied(false); }}
              />
              <span>Floating launcher</span>
            </label>
            <label>
              <input
                type="radio"
                name="embed-mode"
                value="inline"
                checked={mode === "inline"}
                onChange={() => { setMode("inline"); setCopied(false); }}
              />
              <span>Inline panel</span>
            </label>
          </fieldset>
          <label className="embed-employee-select">
            <span>Calendar</span>
            <select
              value={employee}
              onChange={(event) => { setEmployee(event.target.value); setCopied(false); }}
            >
              <option value="all">All available team members</option>
              {publicProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.publicName}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="embed-preview" data-mode={mode} aria-label={`${mode} widget preview`}>
          <span className="embed-preview-label">Static preview</span>
          {mode === "floating" ? (
            <div className="embed-floating-preview">
              <span>Example page content</span>
              <strong>{DEFAULT_LABEL}</strong>
            </div>
          ) : (
            <div className="embed-inline-preview">
              <small>DAYMARK</small>
              <strong>Choose a time that works.</strong>
              <span>{employee === "all"
                ? "All available team members"
                : publicProfiles.find((profile) => profile.id === employee)?.publicName}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="embed-code">
        <label htmlFor="daymark-embed-snippet">Copy this code into your website</label>
        <textarea id="daymark-embed-snippet" value={snippet} readOnly rows={5} />
        <button type="button" onClick={copySnippet} disabled={!snippet}>
          <Copy size={15} /> {copied ? "Copied" : "Copy snippet"}
        </button>
        {copyMessage ? <p className="workspace-message" role="status">{copyMessage}</p> : null}
      </div>
    </div>
  );
}

export function buildEmbedSnippet(
  origin: string,
  mode: EmbedMode,
  employee: string,
  label: string,
): string {
  const safeOrigin = normalizedOrigin(origin);
  const safeMode: EmbedMode = mode === "inline" ? "inline" : "floating";
  const safeEmployee = employee === "all" || EMPLOYEE_PROFILE_ID.test(employee)
    ? employee
    : "all";
  return `<script src="${escapeAttribute(`${safeOrigin}/daymark-widget.js`)}" data-mode="${safeMode}" data-employee="${escapeAttribute(safeEmployee)}" data-label="${escapeAttribute(label)}"></script>`;
}

function normalizedOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return "";
  }
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function subscribeToOrigin() {
  return () => undefined;
}

function browserOrigin() {
  return window.location.origin;
}

function serverOrigin() {
  return "";
}
