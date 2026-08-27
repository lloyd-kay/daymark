"use client";

import { Copy, ExternalLink, Laptop } from "lucide-react";
import { useState } from "react";
import { DemoBookingFlow } from "../demo/DemoBookingFlow";
import type { DemoServiceKey } from "../../lib/booking/demo";
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
import { ServiceScopeShowcase } from "./ServiceScopeShowcase";

type HomepageSetupDraft = {
  journey: SetupJourney;
  demoService: DemoServiceKey;
  layout: WidgetPlacement;
};

const INITIAL_DRAFT: HomepageSetupDraft = {
  journey: "catalogue",
  demoService: "interior",
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
  const journeyChoiceLabel = draft.journey === "catalogue"
    ? "Full catalogue"
    : "This page's service";
  const placementChoiceLabel = draft.layout === "floating"
    ? "Floating button"
    : "Inline section";
  const demoResetKey = `${draft.journey}:${draft.demoService}`;

  function chooseJourney(journey: SetupJourney) {
    if (journey === draft.journey) return;
    setDraft((current) => ({ ...current, journey }));
    setCopyMessage("");
    setLayoutMessage("");
  }

  function chooseDemoService(demoService: DemoServiceKey) {
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
          <p className="eyebrow">Booking setup</p>
          <h3 id="homepage-setup-title">Two choices. One clear setup.</h3>
          <p>
            Choose where customers begin, then choose where booking appears. The live demonstration will combine both decisions.
          </p>
        </div>

        <aside className="homepage-current-selection" aria-live="polite" aria-atomic="true">
          <span>Your current setup</span>
          <dl>
            <div>
              <dt>Booking starts</dt>
              <dd>{journeyChoiceLabel}</dd>
            </div>
            <div>
              <dt>Widget appears</dt>
              <dd>{placementChoiceLabel}</dd>
            </div>
          </dl>
        </aside>

        <ServiceScopeShowcase
          journey={draft.journey}
          demoService={draft.demoService}
          onJourneyChange={chooseJourney}
          onDemoServiceChange={chooseDemoService}
        />

        <fieldset className="homepage-decision-section homepage-placement-section">
          <legend>
            <span>02 · Widget appears</span>
            <strong>Choose where booking appears</strong>
          </legend>
          <p className="homepage-decision-intro">
            Then choose where the same booking flow lives: behind a compact corner button or inside the page itself.
          </p>
          <WidgetOptionsShowcase selected={draft.layout} onSelect={chooseLayout} />
        </fieldset>
      </div>

      <div className="homepage-live-preview" aria-labelledby="homepage-preview-title">
        <div className="homepage-live-preview-heading">
          <p className="eyebrow">Try the selected journey</p>
          <h3 id="homepage-preview-title">Live demonstration</h3>
          <p>No appointment will be created. Change the setup whenever you like.</p>
        </div>
        <WidgetLivePreview layout={draft.layout} resetKey={demoResetKey}>
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
