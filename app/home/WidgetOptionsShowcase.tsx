"use client";

import { WidgetArtworkHero, WidgetHostBrowser } from "./WidgetPreviewChrome";

export type WidgetPlacement = "floating" | "inline";

export function WidgetOptionsShowcase({
  selected,
  onSelect,
}: {
  selected: WidgetPlacement | null;
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
          <span className="widget-choice-label">Option 1 · Opens over the page</span>
          <h5 id="floating-widget-title">Corner button</h5>
          <p id="floating-widget-description">A small Book button stays in the corner. Selecting it opens booking over the current page, and customers can close it again.</p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "floating"}
            aria-labelledby="floating-widget-title"
            aria-describedby="floating-widget-description"
            onClick={() => onSelect("floating")}
          >
            {selected === "floating" ? "Current choice" : "Choose this opening style"}
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
          <span className="widget-choice-label">Option 2 · Built into the page</span>
          <h5 id="inline-widget-title">Booking section in the page</h5>
          <p id="inline-widget-description">The complete booking experience sits inside the page as a dedicated section. Customers do not open a separate panel.</p>
          <button
            className="widget-choice-select"
            type="button"
            aria-pressed={selected === "inline"}
            aria-labelledby="inline-widget-title"
            aria-describedby="inline-widget-description"
            onClick={() => onSelect("inline")}
          >
            {selected === "inline" ? "Current choice" : "Choose this opening style"}
          </button>
        </div>
      </article>
    </div>
  );
}
