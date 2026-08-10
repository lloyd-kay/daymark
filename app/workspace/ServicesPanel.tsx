"use client";

import { ArrowRight, Plus, Power, Save, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import type {
  EmployeeServiceQualification,
  TeamProfile,
  WorkspaceService,
} from "../../lib/data/contracts";

type MutationBody = Record<string, unknown> & { action: string };

export function ServicesPanel({
  workspaceSlug = "daymark",
  profiles,
  initialServices,
}: {
  workspaceSlug?: string;
  profiles: TeamProfile[];
  initialServices: WorkspaceService[];
}) {
  const [services, setServices] = useState(initialServices);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/workspace/services?workspace=${encodeURIComponent(workspaceSlug)}`;

  async function refresh() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = (await response.json()) as {
      services?: WorkspaceService[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? "Services could not be refreshed.");
    }
    setServices(body.services ?? []);
  }

  async function mutate(body: MutationBody, successMessage: string) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "The service change could not be saved.");
      }
      await refresh();
      setMessage(successMessage);
      return true;
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "The service change could not be saved.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await mutate({
      action: "create-service",
      name,
      category,
      description,
      durationMinutes,
    }, `${name.trim()} added to the catalogue.`);
    if (created) {
      setName("");
      setCategory("");
      setDescription("");
      setDurationMinutes(60);
    }
  }

  return (
    <div className="services-panel">
      <div className="team-heading services-heading">
        <div>
          <p className="eyebrow">Qualified catalogue</p>
          <h2>Match every service to the right people.</h2>
          <p>
            Clients see only active services that at least one current team member
            is approved to deliver.
          </p>
        </div>
        <span><ShieldCheck size={16} /> Administrator controlled</span>
      </div>

      {message ? <p className="workspace-message" role="status">{message}</p> : null}
      {loading ? <span className="workspace-loading" role="status">Saving services…</span> : null}

      <form className="service-create-form" onSubmit={createService}>
        <div className="service-create-copy">
          <p className="eyebrow">New service</p>
          <h3>Add a bookable option.</h3>
          <p>Use one service for each distinct skill, duration, or installation type.</p>
        </div>
        <label>
          <span>Name</span>
          <input
            name="service-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Camera installation"
            required
          />
        </label>
        <label>
          <span>Category</span>
          <input
            name="service-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
            placeholder="Smart security"
            required
          />
        </label>
        <label>
          <span>Duration</span>
          <select
            name="service-duration"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          >
            {durationOptions().map((minutes) => (
              <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>
            ))}
          </select>
        </label>
        <label className="service-description-field">
          <span>Description</span>
          <textarea
            name="service-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What is included in this booking?"
          />
        </label>
        <button className="workspace-primary" type="submit" disabled={loading}>
          <Plus size={16} /> Add service
        </button>
      </form>

      <div className="service-card-list">
        {services.length ? services.map((service) => (
          <ServiceCard
            key={serviceRevision(service)}
            service={service}
            profiles={profiles}
            disabled={loading}
            mutate={mutate}
          />
        )) : (
          <div className="service-empty-state">
            <strong>No services yet.</strong>
            <span>Add the first service above, then approve who can deliver it.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  profiles,
  disabled,
  mutate,
}: {
  service: WorkspaceService;
  profiles: TeamProfile[];
  disabled: boolean;
  mutate: (body: MutationBody, successMessage: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(service.name);
  const [category, setCategory] = useState(service.category);
  const [description, setDescription] = useState(service.description);
  const [durationMinutes, setDurationMinutes] = useState(service.durationMinutes);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate({
      action: "update-service",
      serviceId: service.id,
      name,
      category,
      description,
      durationMinutes,
    }, `${name.trim()} updated.`);
  }

  async function changeActive() {
    const active = !service.active;
    if (!active && !window.confirm(
      `Deactivate ${service.name}? It will immediately disappear from public booking.`,
    )) return;
    await mutate({
      action: "set-service-active",
      serviceId: service.id,
      active,
      ...(active ? {} : { confirm: true }),
    }, active ? `${service.name} restored.` : `${service.name} deactivated.`);
  }

  return (
    <article className={service.active ? "service-admin-card" : "service-admin-card is-inactive"}>
      <header>
        <div>
          <span className={service.active ? "status-chip is-active" : "status-chip"}>
            {service.active ? "Active" : "Inactive"}
          </span>
          <h3>{service.name}</h3>
          <code>service: {service.slug}</code>
        </div>
        <button type="button" className="service-power-button" onClick={changeActive} disabled={disabled}>
          <Power size={15} /> {service.active ? "Deactivate service" : "Restore service"}
        </button>
      </header>

      <form className="service-edit-form" onSubmit={update}>
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        </label>
        <label>
          <span>Category</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} required />
        </label>
        <label>
          <span>Duration</span>
          <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
            {durationOptions().map((minutes) => (
              <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>
            ))}
          </select>
        </label>
        <label className="service-description-field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} />
        </label>
        <button type="submit" disabled={disabled}><Save size={14} /> Save service details</button>
      </form>

      <section className="qualification-section" aria-label={`${service.name} team qualifications`}>
        <div className="qualification-heading">
          <div>
            <small>Team qualifications</small>
            <strong>Who can deliver this service?</strong>
          </div>
          <span>{service.qualifications.filter((item) => item.current).length} current</span>
        </div>
        <div className="qualification-grid">
          {profiles.map((profile) => (
            <QualificationEditor
              key={profile.id}
              profile={profile}
              service={service}
              qualification={service.qualifications.find(
                (item) => item.employeeProfileId === profile.id,
              ) ?? null}
              disabled={disabled}
              mutate={mutate}
            />
          ))}
        </div>
      </section>
    </article>
  );
}

function QualificationEditor({
  profile,
  service,
  qualification,
  disabled,
  mutate,
}: {
  profile: TeamProfile;
  service: WorkspaceService;
  qualification: EmployeeServiceQualification | null;
  disabled: boolean;
  mutate: (body: MutationBody, successMessage: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"none" | "manual" | "certificate">(
    qualification?.active ? qualification.method : "none",
  );
  const [certificateName, setCertificateName] = useState(qualification?.certificateName ?? "");
  const [certificateReference, setCertificateReference] = useState(
    qualification?.certificateReference ?? "",
  );
  const [issuedOn, setIssuedOn] = useState(qualification?.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(qualification?.expiresOn ?? "");

  async function save() {
    const removing = mode === "none";
    if (removing && !qualification?.active) return;
    if (removing && !window.confirm(
      `Remove ${profile.publicName}'s approval for ${service.name}?`,
    )) return;
    await mutate({
      action: "set-qualification",
      serviceId: service.id,
      employeeProfileId: profile.id,
      active: !removing,
      method: mode === "certificate" ? "certificate" : "manual",
      certificateName: mode === "certificate" ? certificateName : null,
      certificateReference: mode === "certificate" ? certificateReference || null : null,
      issuedOn: mode === "certificate" ? issuedOn || null : null,
      expiresOn: mode === "certificate" ? expiresOn || null : null,
      ...(removing ? { confirm: true } : {}),
    }, removing
      ? `${profile.publicName}'s qualification removed.`
      : `${profile.publicName}'s qualification saved.`);
  }

  const status = qualificationStatus(profile, service.active, qualification);
  const fieldSuffix = profile.id;

  return (
    <div className="qualification-row" data-status={status.toLowerCase().replaceAll(" ", "-")}>
      <div className="qualification-person">
        <span className="roster-dot" data-accent={profile.accent} />
        <div>
          <strong>{profile.publicName}</strong>
          <small>{profile.title}</small>
        </div>
        <span className={`qualification-status status-${status.toLowerCase().replaceAll(" ", "-")}`}>
          {status}
        </span>
      </div>
      {qualification?.method === "certificate" && qualification.certificateName ? (
        <p className="certificate-summary">
          <strong>{qualification.certificateName}</strong>
          {qualification.expiresOn ? <span>Expires {formatDate(qualification.expiresOn)}</span> : null}
        </p>
      ) : null}
      <label>
        <span>Approval</span>
        <select
          name={`qualification-${fieldSuffix}`}
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
          disabled={disabled}
        >
          <option value="none">Not qualified</option>
          <option value="manual">Admin approved</option>
          <option value="certificate">Certificate</option>
        </select>
      </label>
      {mode === "certificate" ? (
        <div className="certificate-fields">
          <label>
            <span>Certificate name</span>
            <input
              name={`certificate-name-${fieldSuffix}`}
              value={certificateName}
              onChange={(event) => setCertificateName(event.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label>
            <span>Reference</span>
            <input
              name={`certificate-reference-${fieldSuffix}`}
              value={certificateReference}
              onChange={(event) => setCertificateReference(event.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            <span>Issued</span>
            <input
              name={`certificate-issued-${fieldSuffix}`}
              type="date"
              value={issuedOn}
              onChange={(event) => setIssuedOn(event.target.value)}
            />
          </label>
          <label>
            <span>Expires</span>
            <input
              name={`certificate-expiry-${fieldSuffix}`}
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              required
            />
          </label>
        </div>
      ) : null}
      <button
        type="button"
        className="qualification-save"
        onClick={save}
        disabled={disabled || (mode === "none" && !qualification?.active)}
        aria-label={`Save ${profile.publicName} qualification`}
      >
        Save <ArrowRight size={14} />
      </button>
    </div>
  );
}

function qualificationStatus(
  profile: TeamProfile,
  serviceActive: boolean,
  qualification: EmployeeServiceQualification | null,
): "Current" | "Expires soon" | "Expired" | "Not qualified" | "Inactive" {
  if (!profile.active || !serviceActive) return "Inactive";
  if (!qualification?.active) return "Not qualified";
  if (!qualification.current) return qualification.method === "certificate"
    ? "Expired"
    : "Not qualified";
  if (qualification.method === "certificate" && qualification.expiresOn) {
    const today = londonDateKey(new Date());
    const remaining = Date.parse(`${qualification.expiresOn}T00:00:00.000Z`)
      - Date.parse(`${today}T00:00:00.000Z`);
    if (remaining <= 30 * 86_400_000) return "Expires soon";
  }
  return "Current";
}

function londonDateKey(value: Date): string {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function durationOptions(): number[] {
  return Array.from({ length: 32 }, (_, index) => (index + 1) * 15);
}

function serviceRevision(service: WorkspaceService): string {
  return JSON.stringify(service);
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours} hr ${remainder} min`
    : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}
