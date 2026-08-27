"use client";

import { Copy, ExternalLink, Laptop } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import {
  PreviewServicePicker,
  ServiceScopeShowcase,
} from "./ServiceScopeShowcase";

type HomepageSetupDraft = {
  journey: SetupJourney;
  demoService: DemoServiceKey;
  layout: WidgetPlacement;
};

type SetupStep = "journey" | "placement" | "complete";

const INITIAL_DRAFT: HomepageSetupDraft = {
  journey: "catalogue",
  demoService: "interior",
  layout: "floating",
};

export function HomepageSetupBuilder() {
  const builderRef = useRef<HTMLElement>(null);
  const focusStepAfterRender = useRef(false);
  const [draft, setDraft] = useState<HomepageSetupDraft>(INITIAL_DRAFT);
  const [activeStep, setActiveStep] = useState<SetupStep>("journey");
  const [journeyConfirmed, setJourneyConfirmed] = useState(false);
  const [layoutConfirmed, setLayoutConfirmed] = useState(false);
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
    ? "Anywhere on my website"
    : "On a specific service page";
  const placementChoiceLabel = draft.layout === "floating"
    ? "Corner button"
    : "Booking section in the page";
  const demoResetKey = `${draft.journey}:${draft.demoService}`;
  const readyToPreview = journeyConfirmed && layoutConfirmed;

  useEffect(() => {
    if (!focusStepAfterRender.current) return;

    focusStepAfterRender.current = false;
    builderRef.current
      ?.querySelector<HTMLElement>(`[data-setup-step-heading="${activeStep}"]`)
      ?.focus();
  }, [activeStep]);

  function showStep(step: SetupStep) {
    focusStepAfterRender.current = true;
    setActiveStep(step);
  }

  function chooseJourney(journey: SetupJourney) {
    if (journey !== draft.journey) {
      setDraft((current) => ({ ...current, journey }));
    }
    setJourneyConfirmed(true);
    showStep(layoutConfirmed ? "complete" : "placement");
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
    if (layout !== draft.layout) {
      setDraft((current) => ({ ...current, layout }));
    }
    setLayoutConfirmed(true);
    showStep("complete");
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
    <section
      ref={builderRef}
      className="homepage-setup-builder"
      aria-labelledby="homepage-setup-title"
    >
      <div className="homepage-setup-controls" id="widget-options">
        <div className="homepage-setup-controls-heading">
          <p className="eyebrow">Booking setup</p>
          <h3 id="homepage-setup-title">Set up booking in two simple steps.</h3>
          <p>
            Make one choice at a time. We will combine them into a live example before anything is installed.
          </p>
        </div>

        <SetupProgress
          activeStep={activeStep}
          journeyConfirmed={journeyConfirmed}
          journeyLabel={journeyChoiceLabel}
          layoutConfirmed={layoutConfirmed}
          layoutLabel={placementChoiceLabel}
          onChangeJourney={() => showStep("journey")}
          onChangeLayout={() => showStep("placement")}
        />

        {activeStep !== "complete" ? (
          <div className="homepage-guided-stage">
            <div className="homepage-guided-question">
              {activeStep === "journey" ? (
                <ServiceScopeShowcase
                  selectedJourney={journeyConfirmed ? draft.journey : null}
                  demoService={draft.demoService}
                  onJourneyChange={chooseJourney}
                />
              ) : (
                <section
                  className="homepage-decision-section homepage-placement-section"
                  aria-labelledby="homepage-placement-question"
                >
                  <div className="homepage-decision-heading">
                    <span>Step 2 of 2 · Opening style</span>
                    <h4
                      id="homepage-placement-question"
                      data-setup-step-heading="placement"
                      tabIndex={-1}
                    >
                      How should booking open?
                    </h4>
                  </div>
                  <p className="homepage-decision-intro">
                    Choose how customers will see the same booking steps. This does not change who they can book.
                  </p>
                  <WidgetOptionsShowcase
                    selected={layoutConfirmed ? draft.layout : null}
                    onSelect={chooseLayout}
                  />
                </section>
              )}
            </div>
            <StepGuide step={activeStep} journeyLabel={journeyChoiceLabel} />
          </div>
        ) : (
          <section className="homepage-guided-complete" aria-live="polite">
            <div>
              <span>Both choices saved</span>
              <h4
                id="homepage-setup-complete-title"
                data-setup-step-heading="complete"
                tabIndex={-1}
              >
                Your booking setup is ready to try.
              </h4>
            </div>
            <p>
              The live demonstration below now uses your starting point and opening style together.
            </p>
          </section>
        )}
      </div>

      {readyToPreview ? (
        <div
          className="homepage-live-preview"
          aria-labelledby="homepage-preview-title"
          hidden={activeStep !== "complete"}
        >
          <div className="homepage-live-preview-heading">
            <p className="eyebrow">Your two choices together</p>
            <h3 id="homepage-preview-title">Live demonstration</h3>
            <p>No appointment will be created. Use Change above to revisit either choice.</p>
          </div>
          {draft.journey === "page-service" ? (
            <PreviewServicePicker
              demoService={draft.demoService}
              onDemoServiceChange={chooseDemoService}
            />
          ) : null}
          <WidgetLivePreview layout={draft.layout} resetKey={demoResetKey}>
            <DemoBookingFlow journey={draft.journey} demoService={draft.demoService} />
          </WidgetLivePreview>
          <p className="homepage-layout-status sr-only" role="status" aria-live="polite">
            {layoutMessage}
          </p>
        </div>
      ) : null}

      {readyToPreview ? (
        <div className="homepage-setup-card" hidden={activeStep !== "complete"}>
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
      ) : null}
    </section>
  );
}

function SetupProgress({
  activeStep,
  journeyConfirmed,
  journeyLabel,
  layoutConfirmed,
  layoutLabel,
  onChangeJourney,
  onChangeLayout,
}: {
  activeStep: SetupStep;
  journeyConfirmed: boolean;
  journeyLabel: string;
  layoutConfirmed: boolean;
  layoutLabel: string;
  onChangeJourney: () => void;
  onChangeLayout: () => void;
}) {
  const progressLabel = activeStep === "journey"
    ? "Step 1 of 2"
    : activeStep === "placement"
      ? "Step 2 of 2"
      : "2 of 2 complete";

  return (
    <nav className="homepage-setup-progress" aria-label="Booking setup progress">
      <p>{progressLabel}</p>
      <ol>
        <li
          className={`${journeyConfirmed ? "is-complete" : ""} ${activeStep === "journey" ? "is-current" : ""}`.trim()}
          aria-current={activeStep === "journey" ? "step" : undefined}
        >
          <span className="homepage-progress-number">1</span>
          <span className="homepage-progress-copy">
            <small>Customers start</small>
            <strong>{journeyConfirmed ? journeyLabel : "Choose a starting point"}</strong>
          </span>
          {journeyConfirmed && activeStep !== "journey" ? (
            <button type="button" onClick={onChangeJourney}>Change starting point</button>
          ) : (
            <em>{activeStep === "journey" ? "Choose now" : "Not chosen"}</em>
          )}
        </li>
        <li
          className={`${layoutConfirmed ? "is-complete" : ""} ${activeStep === "placement" ? "is-current" : ""}`.trim()}
          aria-current={activeStep === "placement" ? "step" : undefined}
        >
          <span className="homepage-progress-number">2</span>
          <span className="homepage-progress-copy">
            <small>Booking opens</small>
            <strong>{layoutConfirmed ? layoutLabel : journeyConfirmed ? "Choose an opening style" : "Available after step 1"}</strong>
          </span>
          {layoutConfirmed && activeStep !== "placement" ? (
            <button type="button" onClick={onChangeLayout}>Change how booking opens</button>
          ) : (
            <em>{activeStep === "placement" ? "Choose now" : journeyConfirmed ? "Next step" : "Locked"}</em>
          )}
        </li>
      </ol>
    </nav>
  );
}

function StepGuide({
  step,
  journeyLabel,
}: {
  step: Exclude<SetupStep, "complete">;
  journeyLabel: string;
}) {
  return (
    <aside className={`homepage-step-guide homepage-step-guide-${step}`} aria-live="polite">
      <span>{step === "journey" ? "What step 1 changes" : "Step 1 saved"}</span>
      {step === "journey" ? (
        <>
          <h4>Choose the first screen customers see.</h4>
          <dl>
            <div><dt>Anywhere</dt><dd>They choose a service first.</dd></div>
            <div><dt>Service page</dt><dd>That service is already selected.</dd></div>
          </dl>
          <p>Both routes still end with only qualified people.</p>
        </>
      ) : (
        <>
          <p className="homepage-step-saved"><strong>{journeyLabel}</strong></p>
          <h4>Now choose how the same booking steps appear.</h4>
          <p>A corner button opens over the page. A booking section sits inside the page.</p>
        </>
      )}
    </aside>
  );
}
