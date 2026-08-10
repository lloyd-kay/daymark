"use client";

import { Code2, Copy } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import type {
  EmbedMode,
  TeamProfile,
  WorkspaceEmbedPreference,
  WorkspaceService,
} from "../../lib/data/contracts";
import { validServiceSlug } from "../../lib/services/eligibility";

type BookingJourney = "catalogue" | "preselected";

const EMPLOYEE_PROFILE_ID = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const DEFAULT_LABEL = "Book an appointment";

export function EmbedPanel({
  profiles,
  services = [],
  workspaceSlug = "daymark",
  initialPreference,
}: {
  profiles: TeamProfile[];
  services?: WorkspaceService[];
  workspaceSlug?: string;
  initialPreference?: WorkspaceEmbedPreference | null;
}) {
  const initialMode = initialPreference?.defaultMode ?? "floating";
  const initialJourney: BookingJourney = initialPreference?.defaultServiceScope === "service"
    ? "preselected"
    : "catalogue";
  const firstActiveServiceId = services.find(
    (item) => item.active && validServiceSlug(item.slug),
  )?.id ?? "";
  const initialServiceId = initialJourney === "preselected"
    ? initialPreference?.defaultServiceId ?? ""
    : firstActiveServiceId;
  const initialSavedPreference: WorkspaceEmbedPreference = initialPreference ?? {
    workspaceId: "",
    defaultMode: initialMode,
    defaultServiceScope: "all",
    defaultServiceId: null,
  };
  const [mode, setMode] = useState<EmbedMode>(initialMode);
  const [savedPreference, setSavedPreference] = useState(initialSavedPreference);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultMessage, setDefaultMessage] = useState("");
  const [journey, setJourney] = useState<BookingJourney>(initialJourney);
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
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
  const activeServices = useMemo(
    () => services.filter((item) => item.active && validServiceSlug(item.slug)),
    [services],
  );
  const selectedService = activeServices.find(
    (candidate) => candidate.id === selectedServiceId,
  ) ?? null;
  const configuredServiceSlug = journey === "preselected"
    ? selectedService?.slug ?? ""
    : "all";
  const savedService = savedPreference.defaultServiceScope === "service"
    ? activeServices.find(
        (candidate) => candidate.id === savedPreference.defaultServiceId,
      ) ?? null
    : null;
  const savedModeLabel = savedPreference.defaultMode === "inline"
    ? "Inline widget"
    : "Floating widget";
  const savedJourneyLabel = savedPreference.defaultServiceScope === "service"
    ? savedService?.name ?? "Unavailable service"
    : "Show all services";
  const draftServiceScope = journey === "preselected" ? "service" : "all";
  const draftServiceId = journey === "preselected" ? selectedServiceId || null : null;
  const defaultSelectionValid = journey === "catalogue" || selectedService !== null;
  const defaultIsDirty = mode !== savedPreference.defaultMode
    || draftServiceScope !== savedPreference.defaultServiceScope
    || draftServiceId !== savedPreference.defaultServiceId;
  const unavailableSavedSelection = journey === "preselected"
    && !selectedService
    && savedPreference.defaultServiceScope === "service"
    && savedPreference.defaultServiceId === draftServiceId;
  const eligibleProfiles = (() => {
    if (journey !== "preselected") return publicProfiles;
    if (!selectedService) return [];
    const eligibleIds = new Set(
      selectedService.qualifications
        .filter((qualification) => qualification.active && qualification.current)
        .map((qualification) => qualification.employeeProfileId),
    );
    return publicProfiles.filter((profile) => eligibleIds.has(profile.id));
  })();
  const configuredEmployee = employee === "all"
    || eligibleProfiles.some((profile) => profile.id === employee)
    ? employee
    : "all";

  const snippet = origin && configuredServiceSlug
    ? buildEmbedSnippet(
        origin,
        mode,
        configuredEmployee,
        configuredServiceSlug,
        DEFAULT_LABEL,
        workspaceSlug,
      )
    : "";
  const directLink = origin && configuredServiceSlug
    ? buildDirectBookingLink(origin, workspaceSlug, configuredServiceSlug)
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

  async function saveWorkspaceDefault() {
    if (!defaultSelectionValid || !defaultIsDirty) return;
    setSavingDefault(true);
    setDefaultMessage("");
    try {
      const response = await fetch(
        `/api/workspace/embed-preferences?workspace=${encodeURIComponent(workspaceSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set-default",
            defaultMode: mode,
            defaultServiceScope: draftServiceScope,
            serviceId: journey === "preselected" ? selectedService?.id ?? null : null,
          }),
        },
      );
      const body = await response.json() as {
        error?: string;
        preference?: WorkspaceEmbedPreference;
      };
      if (!response.ok || !body.preference) {
        throw new Error(body.error ?? "The workspace default could not be saved. Try again.");
      }
      setSavedPreference(body.preference);
      setDefaultMessage("Workspace default saved.");
    } catch (error) {
      setDefaultMessage(
        error instanceof Error && error.message
          ? error.message
          : "The workspace default could not be saved. Try again.",
      );
    } finally {
      setSavingDefault(false);
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
                onChange={() => {
                  setMode("floating");
                  setCopied(false);
                  setDefaultMessage("");
                }}
              />
              <span>Floating launcher</span>
            </label>
            <label>
              <input
                type="radio"
                name="embed-mode"
                value="inline"
                checked={mode === "inline"}
                onChange={() => {
                  setMode("inline");
                  setCopied(false);
                  setDefaultMessage("");
                }}
              />
              <span>Inline panel</span>
            </label>
          </fieldset>
          <div className="embed-default-control">
            <p className="embed-default-summary">
              Workspace default: {savedModeLabel} · {savedJourneyLabel}
            </p>
            <button
              type="button"
              disabled={savingDefault || !defaultSelectionValid || !defaultIsDirty}
              onClick={saveWorkspaceDefault}
            >
              {savingDefault ? "Saving default…" : "Save as workspace default"}
            </button>
            <a href="/setup-profile/import">Import setup code</a>
            {defaultMessage ? (
              <p className="workspace-message" role="status">{defaultMessage}</p>
            ) : null}
          </div>
          <fieldset>
            <legend>Booking journey</legend>
            <label>
              <input
                type="radio"
                name="embed-journey"
                value="catalogue"
                checked={journey === "catalogue"}
                onChange={() => {
                  setJourney("catalogue");
                  setEmployee("all");
                  setCopied(false);
                  setDefaultMessage("");
                }}
              />
              <span>Show all services</span>
            </label>
            <label>
              <input
                type="radio"
                name="embed-journey"
                value="preselected"
                checked={journey === "preselected"}
                disabled={activeServices.length === 0}
                onChange={() => {
                  setJourney("preselected");
                  setEmployee("all");
                  setCopied(false);
                  setDefaultMessage("");
                }}
              />
              <span>Preselect a service</span>
            </label>
          </fieldset>
          {journey === "preselected" ? (
            <label className="embed-service-select">
              <span>Service</span>
              <select
                name="embed-service"
                value={selectedServiceId}
                onChange={(event) => {
                  setSelectedServiceId(event.target.value);
                  setEmployee("all");
                  setCopied(false);
                  setDefaultMessage("");
                }}
              >
                {!selectedService && selectedServiceId ? (
                  <option value={selectedServiceId} disabled>Unavailable saved service</option>
                ) : null}
                {!selectedServiceId ? <option value="">Choose a service</option> : null}
                {activeServices.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {journey === "preselected" && !selectedService ? (
            <p className="enrol-error embed-service-alert" role="alert">
              {unavailableSavedSelection
                ? "The saved service is unavailable. Choose an active service and save the workspace default."
                : "Choose an active service before saving or publishing this setup."}
            </p>
          ) : null}
          <label className="embed-employee-select">
            <span>Calendar</span>
            <select
              name="embed-employee"
              value={configuredEmployee}
              onChange={(event) => { setEmployee(event.target.value); setCopied(false); }}
            >
              <option value="all">All available team members</option>
              {eligibleProfiles.map((profile) => (
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
              <span>{selectedService && journey === "preselected"
                ? `${selectedService.name} · `
                : ""}
              {configuredEmployee === "all"
                ? "All available team members"
                : eligibleProfiles.find((profile) => profile.id === configuredEmployee)?.publicName}
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

      <div className="embed-direct-link">
        <label htmlFor="daymark-direct-booking-link">Direct booking link</label>
        <div>
          <input id="daymark-direct-booking-link" value={directLink} readOnly />
          {directLink ? (
            <a href={directLink} target="_blank" rel="noreferrer">Open booking page</a>
          ) : null}
        </div>
        <p>Use this URL for buttons, emails, or pages where the widget is not needed.</p>
      </div>
    </div>
  );
}

export function buildEmbedSnippet(
  origin: string,
  mode: EmbedMode,
  employee: string,
  service: string,
  label: string,
  workspaceSlug = "daymark",
): string {
  const safeOrigin = normalizedOrigin(origin);
  const safeMode: EmbedMode = mode === "inline" ? "inline" : "floating";
  const safeEmployee = employee === "all" || EMPLOYEE_PROFILE_ID.test(employee)
    ? employee
    : "all";
  const safeService = service === "all" || validServiceSlug(service)
    ? service
    : "all";
  const safeWorkspace = EMPLOYEE_PROFILE_ID.test(workspaceSlug) ? workspaceSlug : "daymark";
  return `<script src="${escapeAttribute(`${safeOrigin}/daymark-widget.js`)}" data-workspace="${escapeAttribute(safeWorkspace)}" data-mode="${safeMode}" data-employee="${escapeAttribute(safeEmployee)}" data-service="${escapeAttribute(safeService)}" data-label="${escapeAttribute(label)}"></script>`;
}

export function buildDirectBookingLink(
  origin: string,
  workspaceSlug: string,
  service: string,
): string {
  const safeOrigin = normalizedOrigin(origin);
  const safeWorkspace = EMPLOYEE_PROFILE_ID.test(workspaceSlug) ? workspaceSlug : "daymark";
  const base = `${safeOrigin}/book/${encodeURIComponent(safeWorkspace)}`;
  return service === "all" || !validServiceSlug(service)
    ? base
    : `${base}?service=${encodeURIComponent(service)}`;
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
