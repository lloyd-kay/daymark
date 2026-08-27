"use client";

import { ArrowDown, Check, Users } from "lucide-react";
import type { ReactNode } from "react";
import { demoScenario, type DemoServiceKey } from "../../lib/booking/demo";
import type { SetupJourney } from "../../lib/setup-profile";
import { WidgetHostBrowser } from "./WidgetPreviewChrome";

export function ServiceScopeShowcase({
  journey,
  demoService,
  onJourneyChange,
  onDemoServiceChange,
}: {
  journey: SetupJourney;
  demoService: DemoServiceKey;
  onJourneyChange: (journey: SetupJourney) => void;
  onDemoServiceChange: (service: DemoServiceKey) => void;
}) {
  return (
    <fieldset className="homepage-decision-section homepage-journey-section">
      <legend>
        <span>01 · Booking starts</span>
        <strong>Choose how booking starts</strong>
      </legend>
      <p className="homepage-decision-intro">
        First choose the customer&apos;s opening screen. This controls where they begin—not where the widget appears.
      </p>

      <div className="journey-choice-grid">
        <JourneyChoice
          bestFor="A general booking link or a button used across the whole website."
          description="Customers begin with your full catalogue. After they choose a service, Daymark shows only the people qualified to deliver it."
          journey="catalogue"
          selected={journey === "catalogue"}
          title="Let customers choose a service"
          onSelect={onJourneyChange}
        >
          <CatalogueJourneyPreview />
        </JourneyChoice>
        <JourneyChoice
          bestFor="A dedicated service page where the customer has already made their choice."
          description="The page supplies one mapped service automatically. Customers skip the catalogue and begin with the people qualified for that service."
          journey="page-service"
          selected={journey === "page-service"}
          title="Start with this service selected"
          onSelect={onJourneyChange}
        >
          <PageServiceJourneyPreview demoService={demoService} />
        </JourneyChoice>
      </div>

      {journey === "page-service" ? (
        <fieldset className="homepage-sample-options">
          <legend>Service used in this demonstration</legend>
          <p>Sample only. An administrator maps the real workspace service in Daymark.</p>
          <SampleServiceOption
            checked={demoService === "interior"}
            description="90 minutes · Maya and Jon"
            label="Interior consultation"
            onChange={() => onDemoServiceChange("interior")}
            value="interior"
          />
          <SampleServiceOption
            checked={demoService === "garden"}
            description="120 minutes · Theo and Priya"
            label="Garden planning"
            onChange={() => onDemoServiceChange("garden")}
            value="garden"
          />
        </fieldset>
      ) : null}
    </fieldset>
  );
}

function JourneyChoice({
  bestFor,
  children,
  description,
  journey,
  onSelect,
  selected,
  title,
}: {
  bestFor: string;
  children: ReactNode;
  description: string;
  journey: SetupJourney;
  onSelect: (journey: SetupJourney) => void;
  selected: boolean;
  title: string;
}) {
  const titleId = `journey-${journey}-title`;
  const descriptionId = `journey-${journey}-description`;
  const bestForId = `journey-${journey}-best-for`;

  return (
    <article className={`journey-choice journey-choice-${journey}${selected ? " is-selected" : ""}`}>
      {children}
      <div className="journey-choice-copy">
        <span className="journey-choice-label">
          {journey === "catalogue" ? "Option A · Catalogue" : "Option B · Page service"}
        </span>
        <h4 id={titleId}>{title}</h4>
        <p id={descriptionId}>{description}</p>
        <p className="journey-choice-best" id={bestForId}><strong>Best for:</strong> {bestFor}</p>
        <span className="journey-choice-action" aria-hidden="true">
          {selected ? "Selected" : "Choose this journey"}
        </span>
      </div>
      <button
        className="journey-choice-select"
        type="button"
        aria-pressed={selected}
        aria-labelledby={titleId}
        aria-describedby={`${descriptionId} ${bestForId}`}
        onClick={() => onSelect(journey)}
      >
        <span className="sr-only">{selected ? "Selected" : "Choose"}</span>
      </button>
    </article>
  );
}

function CatalogueJourneyPreview() {
  return (
    <div className="journey-choice-preview journey-preview-catalogue" aria-hidden="true">
      <WidgetHostBrowser>
        <div className="journey-preview-scene">
          <div className="journey-preview-heading">
            <span>Daymark booking · First screen</span>
            <strong>Your complete service catalogue</strong>
          </div>
          <div className="journey-preview-booking">
            <span>Customer action</span>
            <strong>Choose a service</strong>
            <div className="journey-preview-services">
              <i>Interior consultation</i>
              <i>Garden planning</i>
            </div>
          </div>
          <div className="journey-preview-result">
            <ArrowDown size={15} strokeWidth={2.4} />
            <div>
              <span>Qualified people appear next</span>
              <div className="journey-preview-people">
                <i>Maya</i><i>Jon</i><i>Theo</i><i>Priya</i>
              </div>
            </div>
          </div>
        </div>
      </WidgetHostBrowser>
    </div>
  );
}

function PageServiceJourneyPreview({ demoService }: { demoService: DemoServiceKey }) {
  const { service, employees } = demoScenario(demoService);

  return (
    <div className="journey-choice-preview journey-preview-page-service" aria-hidden="true">
      <WidgetHostBrowser>
        <div className="journey-preview-scene">
          <div className="journey-preview-heading">
            <span>Cedar House · Service page</span>
            <strong>{service.name}</strong>
          </div>
          <div className="journey-preview-booking journey-preview-booking-selected">
            <span>Passed into Daymark</span>
            <strong><Check size={15} strokeWidth={2.5} /> {service.name} selected</strong>
            <small>The customer does not choose it again.</small>
          </div>
          <div className="journey-preview-result">
            <Users size={16} strokeWidth={2.2} />
            <div>
              <span>Start with qualified people</span>
              <div className="journey-preview-people">
                {employees.map((employee) => (
                  <i key={employee.id}>{employee.publicName.split(" ")[0]}</i>
                ))}
              </div>
            </div>
          </div>
        </div>
      </WidgetHostBrowser>
    </div>
  );
}

function SampleServiceOption({
  checked,
  description,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
  value: DemoServiceKey;
}) {
  const id = `homepage-demo-service-${value}`;

  return (
    <label
      aria-label={`${label}. ${description}`}
      className={`homepage-option${checked ? " is-selected" : ""}`}
      htmlFor={id}
    >
      <input
        id={id}
        type="radio"
        name="homepage-demo-service"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="homepage-option-title">
          <strong>{label}</strong>
          <em>{checked ? "Selected" : "Choose"}</em>
        </span>
        <small>{description}</small>
      </span>
    </label>
  );
}
