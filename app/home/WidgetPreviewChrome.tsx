import type { ReactNode } from "react";

export function WidgetHostBrowser({ children }: { children: ReactNode }) {
  return (
    <div className="widget-host-browser">
      <div className="widget-host-bar" aria-hidden="true"><i /><i /><i /></div>
      <div className="widget-host-nav" aria-hidden="true">
        <strong>CEDAR HOUSE</strong>
        <span className="widget-host-links"><i>ABOUT</i><i>SERVICES</i><i>JOURNAL</i></span>
      </div>
      {children}
    </div>
  );
}

export function WidgetArtworkHero({ inline = false }: { inline?: boolean }) {
  return (
    <div className="widget-host-hero" aria-hidden="true">
      <div>
        <span className="widget-host-kicker">Considered spaces</span>
        <strong>
          {inline ? <>Start with a<br />conversation.</> : <>Room to feel<br />at home.</>}
        </strong>
        <p>
          {inline
            ? "The booking experience becomes part of a dedicated contact or services page."
            : "A sample host website keeps its own visual identity while Daymark waits quietly in the corner."}
        </p>
      </div>
      <div className="widget-host-art widget-host-art-full-wordmark">
        <div className="widget-host-art-canvas">
          {/* The local source artwork must preserve its exact crop inside this decorative mockup. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/daymark-widget-art-4x3-background-2x.png"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="widget-host-art-wordmark">DAYMARK</span>
          <span className="widget-host-art-tagline">
            Book the right person. Keep every calendar private.
          </span>
        </div>
      </div>
    </div>
  );
}

export function WidgetNeutralHostPage() {
  return (
    <div className="widget-live-host-page" aria-hidden="true">
      <div className="widget-live-host-copy">
        <span className="widget-host-kicker">Considered spaces</span>
        <strong>Room to feel<br />at home.</strong>
        <p>A sample host page keeps its own identity while Daymark handles booking.</p>
      </div>
      <div className="widget-live-host-details">
        <span>INTERIORS</span>
        <span>PLANNING</span>
        <span>CARE</span>
      </div>
    </div>
  );
}
