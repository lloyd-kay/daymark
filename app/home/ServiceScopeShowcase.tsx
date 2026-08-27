"use client";

import { ArrowDown, Check, Users } from "lucide-react";
import type { ReactNode } from "react";
import { demoScenario, type DemoServiceKey } from "../../lib/booking/demo";
import type { SetupJourney } from "../../lib/setup-profile";
import { WidgetHostBrowser } from "./WidgetPreviewChrome";

export function ServiceScopeShowcase({
  selectedJourney,
  demoService,
  onJourneyChange,
}: {
  selectedJourney: SetupJourney | null;
  demoService: DemoServiceKey;
  onJourneyChange: (journey: SetupJourney) => void;
}) {
  return (
    <section
      className="homepage-decision-section homepage-journey-section"
      aria-labelledby="homepage-journey-question"
    >
      <div className="homepage-decision-heading">
        <span>Step 1 of 2 · Starting point</span>
        <h4
          id="homepage-journey-question"
          data-setup-step-heading="journey"
          tabIndex={-1}
        >
          Where will customers start?
        </h4>
      </div>
      <p className="homepage-decision-intro">
        Choose the situation customers will be in when they open booking. You will choose how booking appears next.
      </p>

      <div className="journey-choice-grid">
        <JourneyChoice
          bestFor="A homepage, navigation button, contact page, or general Book now link."
          description="Customers choose what they need first. Daymark then shows only the people who can provide that service."
          journey="catalogue"
          selected={selectedJourney === "catalogue"}
          title="Anywhere on my website"
          onSelect={onJourneyChange}
        >
          <CatalogueJourneyPreview />
        </JourneyChoice>
        <JourneyChoice
          bestFor="A page dedicated to one service, such as a consultation or treatment page."
          description="The page tells Daymark which service the customer is viewing. They go straight to the people qualified for it."
          journey="page-service"
          selected={selectedJourney === "page-service"}
          title="On a specific service page"
          onSelect={onJourneyChange}
        >
          <PageServiceJourneyPreview demoService={demoService} />
        </JourneyChoice>
      </div>
    </section>
  );
}

export function PreviewServicePicker({
  demoService,
  onDemoServiceChange,
}: {
  demoService: DemoServiceKey;
  onDemoServiceChange: (service: DemoServiceKey) => void;
}) {
  return (
    <fieldset className="homepage-sample-options">
      <legend>Preview service</legend>
      <p>
        Switch the sample service in this demonstration. This preview choice is not included in the setup you transfer.
      </p>
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
          {journey === "catalogue" ? "Option 1 · Site-wide start" : "Option 2 · Service-page start"}
        </span>
        <h5 id={titleId}>{title}</h5>
        <p id={descriptionId}>{description}</p>
        <p className="journey-choice-best" id={bestForId}><strong>Best for:</strong> {bestFor}</p>
        <span className="journey-choice-action" aria-hidden="true">
          {selected ? "Current choice" : "Choose this starting point"}
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
        <span className="sr-only">{selected ? "Choose current option" : "Choose"}</span>
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
