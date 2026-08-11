"use client";

import type { ReactNode } from "react";
import type { WidgetPlacement } from "./WidgetOptionsShowcase";
import { WidgetHostBrowser, WidgetNeutralHostPage } from "./WidgetPreviewChrome";

export function WidgetLivePreview({
  layout,
  children,
}: {
  layout: WidgetPlacement;
  children: ReactNode;
}) {
  const layoutLabel = layout === "floating" ? "Floating widget" : "Inline widget";

  return (
    <div className="widget-presentation" data-layout={layout}>
      <p className="widget-presentation-label">
        <span>Live Cedar House preview</span>
        <strong>{layoutLabel} selected</strong>
      </p>
      <WidgetHostBrowser>
        <WidgetNeutralHostPage />
        <div
          id="widget-live-booking"
          className="widget-live-surface"
          hidden={layout === "floating"}
        >
          {children}
        </div>
        {layout === "floating" ? (
          <div className="widget-daymark-fab widget-live-launcher" aria-hidden="true">
            <span>D</span> Book an appointment
          </div>
        ) : null}
      </WidgetHostBrowser>
    </div>
  );
}
