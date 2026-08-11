"use client";

import { WidgetArtworkHero, WidgetHostBrowser } from "./WidgetPreviewChrome";

export type WidgetPlacement = "floating" | "inline";

export function WidgetOptionsShowcase({
  selected,
  onSelect,
}: {
  selected: WidgetPlacement;
  onSelect: (placement: WidgetPlacement) => void;
}) {
  return (
    <div className="widget-choice-grid" aria-label="Widget presentation options">
      <article className={`widget-choice widget-choice-floating${selected === "floating" ? " is-selected" : ""}`}>
        <div className="widget-host-page" aria-hidden="true">
          <WidgetHostBrowser>
            <WidgetArtworkHero />
            <div className="widget-host-strip" />
            <div className="floating-panel">
              <span className="widget-preview-eyebrow">DAYMARK · BOOKING</span>
              <strong>Who would you<br />like to meet?</strong>
              <div className="widget-person-row"><span className="active">Maya</span><span>Theo</span><span>Priya</span></div>
              <div className="widget-slot-row"><span>10:30</span><span>13:00</span><span>15:30</span></div>
            </div>
            <div className="widget-daymark-fab"><span>D</span>Book an appointment</div>
          </WidgetHostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option A · Floating</span>
          <h3 id="floating-widget-title">Always close, never in the way</h3>
          <p id="floating-widget-description">A compact corner button opens the booking panel over any page. Best when booking should be available site-wide.</p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "floating"}
            aria-labelledby="floating-widget-title"
            aria-describedby="floating-widget-description"
            onClick={() => onSelect("floating")}
          >
            {selected === "floating" ? "Selected" : "Choose this layout"}
          </button>
        </div>
      </article>

      <article className={`widget-choice widget-choice-inline${selected === "inline" ? " is-selected" : ""}`}>
        <div className="widget-host-page" aria-hidden="true">
          <WidgetHostBrowser>
            <WidgetArtworkHero inline />
            <div className="inline-panel">
              <div className="inline-rail"><strong>DAYMARK</strong><span>01 / 03</span></div>
              <div className="inline-main">
                <div className="inline-head">
                  <div><span className="widget-preview-eyebrow">BOOK THE RIGHT PERSON</span><strong>Choose your person.</strong></div>
                  <span>PERSON → DATE → TIME</span>
                </div>
                <div className="inline-grid"><span>PLANNING<b>Maya</b></span><span>DESIGN<b>Theo</b></span><span>CARE<b>Priya</b></span><span>DETAILS<b>Jon</b></span></div>
              </div>
            </div>
          </WidgetHostBrowser>
        </div>
        <div className="widget-choice-copy">
          <span className="widget-choice-label">Option B · Inline</span>
          <h3 id="inline-widget-title">A booking section with presence</h3>
          <p id="inline-widget-description">The full panel sits inside a page and feels intentional. Best for a dedicated contact or book-now section.</p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "inline"}
            aria-labelledby="inline-widget-title"
            aria-describedby="inline-widget-description"
            onClick={() => onSelect("inline")}
          >
            {selected === "inline" ? "Selected" : "Choose this layout"}
          </button>
        </div>
      </article>
    </div>
  );
}
