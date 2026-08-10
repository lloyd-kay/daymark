"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { WorkspaceService, WorkspaceSummary } from "../../lib/data/contracts";
import { navigate } from "../../lib/browser-navigation";
import {
  decodeSetupProfile,
  encodeSetupProfile,
  SetupProfileError,
  type SetupProfile,
} from "../../lib/setup-profile";
import { SignInPanel } from "../workspace/sign-in/SignInPanel";
import { SetupProfileConfirmation } from "./SetupProfileConfirmation";

export type SetupProfileImportPanelProps = {
  initialCode: string;
  installationState: "unclaimed" | "sign-in-required" | "ready";
  adminWorkspaces: WorkspaceSummary[];
  redirectPath: string;
};

type PendingProfile = { code: string; profile: SetupProfile };

export function SetupProfileImportPanel({
  initialCode,
  installationState,
  adminWorkspaces,
  redirectPath,
}: SetupProfileImportPanelProps) {
  const initialReview = review(initialCode);
  const eligibleWorkspaces = useMemo(
    () => adminWorkspaces.filter((workspace) => workspace.role === "admin"),
    [adminWorkspaces],
  );
  const initialWorkspace = eligibleWorkspaces.length === 1
    ? eligibleWorkspaces[0].slug
    : "";
  const [rawCode, setRawCode] = useState(initialCode);
  const [pending, setPending] = useState<PendingProfile | null>(initialReview.pending);
  const [selectedWorkspace, setSelectedWorkspace] = useState(initialWorkspace);
  const [confirmedSetupCode, setConfirmedSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialReview.error);
  const [activeServices, setActiveServices] = useState<WorkspaceService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [servicesLoading, setServicesLoading] = useState(
    installationState === "ready"
    && initialReview.pending?.profile.journey === "page-service"
    && Boolean(initialWorkspace),
  );
  const [servicesError, setServicesError] = useState("");
  const [serviceLoadAttempt, setServiceLoadAttempt] = useState(0);

  useEffect(() => {
    if (
      installationState !== "ready"
      || pending?.profile.journey !== "page-service"
      || !selectedWorkspace
    ) {
      return;
    }

    let cancelled = false;
    void fetch(
      `/api/workspace/services?workspace=${encodeURIComponent(selectedWorkspace)}`,
      { cache: "no-store" },
    ).then(async (response) => {
      const body = await response.json() as { services?: WorkspaceService[] };
      if (!response.ok || !Array.isArray(body.services)) {
        throw new Error("service load failed");
      }
      if (cancelled) return;
      const services = body.services.filter((service) => service.active === true);
      setActiveServices(services);
      setSelectedServiceId(services.length === 1 ? services[0].id : "");
    }).catch(() => {
      if (cancelled) return;
      setServicesError("Services could not be loaded. Try again.");
    }).finally(() => {
      if (!cancelled) setServicesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [installationState, pending, selectedWorkspace, serviceLoadAttempt]);

  if (installationState === "sign-in-required") {
    return (
      <SignInPanel
        setupAllowed={false}
        redirectPath={redirectPath}
      />
    );
  }

  if (installationState === "unclaimed" && confirmedSetupCode) {
    const setupRedirectPath = pending?.profile.journey === "page-service"
      ? `/setup-profile/import?code=${encodeURIComponent(confirmedSetupCode)}`
      : undefined;
    return (
      <SignInPanel
        initialView="setup"
        setupAllowed={false}
        setupProfileCode={confirmedSetupCode}
        redirectPath={setupRedirectPath}
      />
    );
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = review(rawCode);
    resetServices(
      installationState === "ready"
      && result.pending?.profile.journey === "page-service"
      && Boolean(selectedWorkspace),
    );
    setPending(result.pending);
    setError(result.error);
  }

  function cancelReview() {
    setPending(null);
    setRawCode("");
    setError("");
    resetServices();
  }

  async function confirmImport() {
    if (!pending) return;
    if (installationState === "unclaimed") {
      setConfirmedSetupCode(pending.code);
      return;
    }
    if (
      !selectedWorkspace
      || (pending.profile.journey === "page-service" && !selectedServiceId)
    ) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/embed-preferences?workspace=${encodeURIComponent(selectedWorkspace)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import-profile",
            code: pending.code,
            serviceId: pending.profile.journey === "page-service"
              ? selectedServiceId
              : null,
          }),
        },
      );
      if (!response.ok) throw new Error("import failed");
      navigate(
        `/workspace/${encodeURIComponent(selectedWorkspace)}?view=embed`,
      );
    } catch {
      setError("The setup could not be imported. Try again.");
      setBusy(false);
    }
  }

  if (pending) {
    const pageService = pending.profile.journey === "page-service";
    return (
      <SetupProfileConfirmation
        profile={pending.profile}
        busy={busy}
        confirmDisabled={installationState === "ready" && (
          !selectedWorkspace
          || (pageService && (
            servicesLoading
            || Boolean(servicesError)
            || !selectedServiceId
          ))
        )}
        onConfirm={confirmImport}
        onCancel={cancelReview}
      >
        {installationState === "ready" ? (
          <div className="setup-profile-workspace">
            {eligibleWorkspaces.length === 1 ? (
              <p>Workspace: <strong>{eligibleWorkspaces[0].name}</strong></p>
            ) : eligibleWorkspaces.length > 1 ? (
              <label htmlFor="setup-profile-workspace">
                <span>Workspace</span>
                <select
                  id="setup-profile-workspace"
                  value={selectedWorkspace}
                  onChange={(event) => selectWorkspace(event.target.value)}
                >
                  <option value="">Choose a workspace</option>
                  {eligibleWorkspaces.map((workspace) => (
                    <option key={workspace.slug} value={workspace.slug}>{workspace.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p role="alert">You need administrator access to a workspace before importing this setup.</p>
            )}
            {pageService && selectedWorkspace ? (
              <div className="setup-profile-service" aria-busy={servicesLoading}>
                {servicesLoading ? (
                  <p className="setup-profile-service-status" role="status">
                    Loading active services…
                  </p>
                ) : servicesError ? (
                  <div className="setup-profile-service-error">
                    <p className="enrol-error" role="alert">{servicesError}</p>
                    <button type="button" onClick={retryServices}>Retry services</button>
                  </div>
                ) : activeServices.length > 0 ? (
                  <label htmlFor="setup-profile-service">
                    <span>Service for this page</span>
                    <select
                      id="setup-profile-service"
                      value={selectedServiceId}
                      onChange={(event) => setSelectedServiceId(event.target.value)}
                    >
                      {activeServices.length > 1 ? (
                        <option value="">Choose a service</option>
                      ) : null}
                      {activeServices.map((service) => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="setup-profile-service-empty">
                    No active services are available in this workspace.{" "}
                    <a href={`/workspace/${encodeURIComponent(selectedWorkspace)}?view=services`}>
                      Manage services
                    </a>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="enrol-error" role="alert">{error}</p> : null}
      </SetupProfileConfirmation>
    );
  }

  return (
    <section className="setup-profile-entry auth-card">
      <p className="eyebrow">Transfer a Daymark setup</p>
      <h1>Import setup code.</h1>
      <p>Paste the code from the Daymark demonstration, then review it before anything changes.</p>
      <form onSubmit={submitReview}>
        <label htmlFor="setup-profile-code">Setup code</label>
        <input
          id="setup-profile-code"
          value={rawCode}
          onChange={(event) => {
            setRawCode(event.target.value);
            setError("");
          }}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <button className="workspace-primary" type="submit">Review setup</button>
      </form>
      {error ? <p className="enrol-error" role="alert">{error}</p> : null}
    </section>
  );

  function resetServices(loading = false) {
    setSelectedServiceId("");
    setActiveServices([]);
    setServicesError("");
    setServicesLoading(loading);
  }

  function selectWorkspace(workspaceSlug: string) {
    resetServices(
      pending?.profile.journey === "page-service" && Boolean(workspaceSlug),
    );
    setSelectedWorkspace(workspaceSlug);
  }

  function retryServices() {
    resetServices(true);
    setServiceLoadAttempt((attempt) => attempt + 1);
  }
}

function review(value: string): { pending: PendingProfile | null; error: string } {
  if (!value) return { pending: null, error: "" };
  try {
    const profile = decodeSetupProfile(value);
    return {
      pending: { profile, code: encodeSetupProfile(profile) },
      error: "",
    };
  } catch (error) {
    return {
      pending: null,
      error: error instanceof SetupProfileError
        ? setupProfileGuidance(error)
        : "That setup code is not valid.",
    };
  }
}

function setupProfileGuidance(error: SetupProfileError): string {
  if (error.code === "invalid_checksum") {
    return "That setup code looks incomplete or mistyped.";
  }
  if (error.code === "unsupported_version") {
    return "Update Daymark before importing this setup code.";
  }
  return "That setup code is not valid.";
}
