"use client";

import type { ReactNode } from "react";
import type { DemoServiceKey } from "../../lib/booking/demo";
import type { SetupJourney } from "../../lib/setup-profile";

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
        <span>01 · Customer journey</span>
        <strong>What should customers see?</strong>
      </legend>
      <p className="homepage-decision-intro">
        Choose whether booking begins with your complete catalogue or one service supplied by the current page.
      </p>

      <div className="journey-choice-grid">
        <JourneyChoice
          description="Customers choose a service first; Daymark then shows only people qualified to deliver it."
          journey="catalogue"
          selected={journey === "catalogue"}
          title="Show all services"
          onSelect={onJourneyChange}
        >
          <CatalogueJourneyPreview />
        </JourneyChoice>
        <JourneyChoice
          description="The page supplies one mapped service, so customers begin with the people qualified for it."
          journey="page-service"
          selected={journey === "page-service"}
          title="Use this page's service"
          onSelect={onJourneyChange}
        >
          <PageServiceJourneyPreview />
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
  children,
  description,
  journey,
  onSelect,
  selected,
  title,
}: {
  children: ReactNode;
  description: string;
  journey: SetupJourney;
  onSelect: (journey: SetupJourney) => void;
  selected: boolean;
  title: string;
}) {
  const titleId = `journey-${journey}-title`;
  const descriptionId = `journey-${journey}-description`;

  return (
    <article className={`journey-choice journey-choice-${journey}${selected ? " is-selected" : ""}`}>
      {children}
      <div className="journey-choice-copy">
        <span className="journey-choice-label">
          {journey === "catalogue" ? "Option A · Catalogue" : "Option B · Page service"}
        </span>
        <h4 id={titleId}>{title}</h4>
        <p id={descriptionId}>{description}</p>
        <button
          className="journey-choice-select"
          type="button"
          aria-pressed={selected}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClick={() => onSelect(journey)}
        >
          {selected ? "Selected" : "Choose this journey"}
        </button>
      </div>
    </article>
  );
}

function CatalogueJourneyPreview() {
  return (
    <div className="journey-choice-preview journey-preview-catalogue" aria-hidden="true">
      <span className="journey-preview-label">Full catalogue</span>
      <div className="journey-preview-services">
        <i>Interior consultation</i>
        <i>Garden planning</i>
      </div>
      <span className="journey-preview-arrow">↓</span>
      <div className="journey-preview-people">
        <i>Maya</i><i>Jon</i><i>Theo</i><i>Priya</i>
      </div>
    </div>
  );
}

function PageServiceJourneyPreview() {
  return (
    <div className="journey-choice-preview journey-preview-page-service" aria-hidden="true">
      <span className="journey-preview-label">Service page</span>
      <div className="journey-preview-page">
        <i>Interior consultation</i>
        <b>Selected</b>
      </div>
      <span className="journey-preview-arrow">↓</span>
      <div className="journey-preview-people"><i>Maya</i><i>Jon</i></div>
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
