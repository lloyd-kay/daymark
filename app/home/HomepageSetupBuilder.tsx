"use client";

import { Copy, ExternalLink, Laptop } from "lucide-react";
import { useState } from "react";
import { DemoBookingFlow } from "../demo/DemoBookingFlow";
import {
  buildSetupProfileUri,
  encodeSetupProfile,
  type SetupJourney,
} from "../../lib/setup-profile";
import {
  WidgetOptionsShowcase,
  type WidgetPlacement,
} from "./WidgetOptionsShowcase";
import { WidgetLivePreview } from "./WidgetLivePreview";

type DemoService = "camera" | "alarm";

type HomepageSetupDraft = {
  journey: SetupJourney;
  demoService: DemoService;
  layout: WidgetPlacement;
};

const INITIAL_DRAFT: HomepageSetupDraft = {
  journey: "catalogue",
  demoService: "camera",
  layout: "floating",
};

export function HomepageSetupBuilder() {
  const [draft, setDraft] = useState<HomepageSetupDraft>(INITIAL_DRAFT);
  const [codeVisible, setCodeVisible] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [layoutMessage, setLayoutMessage] = useState("");
  const code = encodeSetupProfile({
    journey: draft.journey,
    layout: draft.layout,
  });
  const appLink = buildSetupProfileUri(code);
  const scopeLabel = draft.journey === "catalogue"
    ? "Full service catalogue"
    : "Page-specific service";
  const layoutLabel = draft.layout === "floating" ? "Floating widget" : "Inline widget";

  function chooseJourney(journey: SetupJourney) {
    if (journey === draft.journey) return;
    setDraft((current) => ({ ...current, journey }));
    setCopyMessage("");
    setLayoutMessage("");
  }

  function chooseDemoService(demoService: DemoService) {
    if (demoService === draft.demoService) return;
    setDraft((current) => ({ ...current, demoService }));
    setCopyMessage("");
    setLayoutMessage("");
  }

  function chooseLayout(layout: WidgetPlacement) {
    if (layout === draft.layout) return;
    setDraft((current) => ({ ...current, layout }));
    setCopyMessage("");
    setLayoutMessage(
      `${layout === "floating" ? "Floating" : "Inline"} preview selected. Booking progress kept.`,
    );
  }

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      setCopyMessage("Setup code copied.");
    } catch {
      setCopyMessage("Copy unavailable. Select the code and copy it manually.");
    }
  }

  return (
    <section className="homepage-setup-builder" aria-labelledby="homepage-setup-title">
      <div className="homepage-setup-controls" id="widget-options">
        <div className="homepage-setup-controls-heading">
          <p className="eyebrow">Widget options</p>
          <h3 id="homepage-setup-title">Shape the booking experience.</h3>
          <p>
            Set the customer journey and placement together, then try that exact setup in the live preview.
          </p>
        </div>

        <fieldset className="homepage-option-group homepage-scope-options">
          <legend>What should customers see?</legend>
          <SetupOption
            checked={draft.journey === "catalogue"}
            description="Customers choose from every service before Daymark shows qualified people."
            name="homepage-journey"
            onChange={() => chooseJourney("catalogue")}
            title="Show all services"
            value="catalogue"
          />
          <SetupOption
            checked={draft.journey === "page-service"}
            description="The page passes one service into booking, so customers begin with qualified people."
            name="homepage-journey"
            onChange={() => chooseJourney("page-service")}
            title="Use this page's service"
            value="page-service"
          />
        </fieldset>

        {draft.journey === "page-service" ? (
          <fieldset className="homepage-option-group homepage-sample-options">
            <legend>Which sample service should the preview use?</legend>
            <p className="homepage-option-note">
              Sample only. Your administrator chooses the real workspace service in Daymark.
            </p>
            <SetupOption
              checked={draft.demoService === "camera"}
              description="90 minutes · Maya and Jon"
              name="homepage-demo-service"
              onChange={() => chooseDemoService("camera")}
              title="Camera installation"
              value="camera"
            />
            <SetupOption
              checked={draft.demoService === "alarm"}
              description="120 minutes · Theo and Priya"
              name="homepage-demo-service"
              onChange={() => chooseDemoService("alarm")}
              title="Alarm installation"
              value="alarm"
            />
          </fieldset>
        ) : null}

        <fieldset className="homepage-option-group homepage-layout-options">
          <legend>How should the widget appear?</legend>
          <WidgetOptionsShowcase selected={draft.layout} onSelect={chooseLayout} />
        </fieldset>
      </div>

      <div className="homepage-live-preview" aria-labelledby="homepage-preview-title">
        <div className="homepage-live-preview-heading">
          <p className="eyebrow">Try the selected journey</p>
          <h3 id="homepage-preview-title">Live demonstration</h3>
          <p>No appointment will be created. Change the setup whenever you like.</p>
        </div>
        <WidgetLivePreview layout={draft.layout}>
          <DemoBookingFlow journey={draft.journey} demoService={draft.demoService} />
        </WidgetLivePreview>
        <p className="homepage-layout-status sr-only" role="status" aria-live="polite">
          {layoutMessage}
        </p>
      </div>

      <div className="homepage-setup-card">
        <div>
          <p className="eyebrow">Ready for installation</p>
          <h3>Your Daymark setup</h3>
          <p className="homepage-setup-summary">
            <strong>{scopeLabel}</strong>
            <span aria-hidden="true"> · </span>
            <strong>{layoutLabel}</strong>
          </p>
          <p>
            This becomes the workspace default after an administrator reviews and confirms it in Daymark.
            The team can still generate either layout later.
          </p>
          {draft.journey === "page-service" ? (
            <p className="homepage-service-mapping-note">
              The sample service is not transferred. Daymark asks the administrator to map the real service safely.
            </p>
          ) : null}
        </div>

        <div className="homepage-setup-transfer">
          <div className="homepage-setup-actions">
            <a className="homepage-setup-primary" href={appLink}>
              Open in Daymark <ExternalLink size={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              aria-expanded={codeVisible}
              onClick={() => {
                setCodeVisible(true);
                setCopyMessage("");
              }}
            >
              <Laptop size={16} aria-hidden="true" /> Use on another machine
            </button>
          </div>

          <p className="homepage-setup-fallback">
            If Daymark does not open, install it first or use this setup code on the other machine.
          </p>

          {codeVisible ? (
            <div className="homepage-setup-code">
              <label htmlFor="homepage-setup-code">Portable setup code</label>
              <div>
                <input id="homepage-setup-code" value={code} readOnly spellCheck={false} />
                <button type="button" onClick={copyCode}>
                  <Copy size={15} aria-hidden="true" /> Copy setup code
                </button>
              </div>
              {copyMessage ? (
                <p className="homepage-copy-status" role="status" aria-live="polite">
                  {copyMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SetupOption({
  checked,
  description,
  name,
  onChange,
  title,
  value,
}: {
  checked: boolean;
  description: string;
  name: string;
  onChange: () => void;
  title: string;
  value: string;
}) {
  const id = `${name}-${value}`;

  return (
    <label
      aria-label={`${title}. ${description}`}
      className={`homepage-option${checked ? " is-selected" : ""}`}
      htmlFor={id}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>
        <span className="homepage-option-title">
          <strong>{title}</strong>
          <em>{checked ? "Selected" : "Choose"}</em>
        </span>
        <small>{description}</small>
      </span>
    </label>
  );
}
