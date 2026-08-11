"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WidgetPlacement } from "./WidgetOptionsShowcase";
import { WidgetHostBrowser, WidgetNeutralHostPage } from "./WidgetPreviewChrome";

export function WidgetLivePreview({
  layout,
  resetKey,
  children,
}: {
  layout: WidgetPlacement;
  resetKey: string;
  children: ReactNode;
}) {
  const layoutLabel = layout === "floating" ? "Floating widget" : "Inline widget";
  const [floatingState, setFloatingState] = useState({ layout, resetKey, open: false });
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreLauncherFocus = useRef(false);
  const floating = layout === "floating";

  if (floatingState.layout !== layout) {
    setFloatingState({ layout, resetKey, open: false });
  } else if (floatingState.resetKey !== resetKey) {
    setFloatingState({ layout, resetKey, open: floating });
  }

  const floatingOpen = floatingState.layout === layout
    && floatingState.resetKey === resetKey
    && floatingState.open;

  useEffect(() => {
    if (!floating) return;
    if (floatingOpen) {
      closeRef.current?.focus();
    } else if (restoreLauncherFocus.current) {
      restoreLauncherFocus.current = false;
      launcherRef.current?.focus();
    }
  }, [floating, floatingOpen]);

  useEffect(() => {
    if (!floating || !floatingOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      restoreLauncherFocus.current = true;
      setFloatingState({ layout, resetKey, open: false });
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [floating, floatingOpen, layout, resetKey]);

  function openFloating() {
    restoreLauncherFocus.current = false;
    setFloatingState({ layout, resetKey, open: true });
  }

  function closeFloating() {
    restoreLauncherFocus.current = true;
    setFloatingState({ layout, resetKey, open: false });
  }

  const bookingVisible = !floating || floatingOpen;

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
          hidden={!bookingVisible}
          role={floating ? "dialog" : undefined}
          aria-labelledby={floating ? "widget-live-dialog-title" : undefined}
        >
          {floating ? (
            <div className="widget-live-dialog-head">
              <strong id="widget-live-dialog-title">Book with Daymark</strong>
              <button
                ref={closeRef}
                className="widget-live-close"
                type="button"
                onClick={closeFloating}
              >
                Close booking
              </button>
            </div>
          ) : null}
          {children}
        </div>
        {floating ? (
          <button
            ref={launcherRef}
            className="widget-daymark-fab widget-live-launcher"
            type="button"
            aria-controls="widget-live-booking"
            aria-expanded={floatingOpen}
            hidden={floatingOpen}
            onClick={openFloating}
          >
            <span aria-hidden="true">D</span> Book an appointment
          </button>
        ) : null}
      </WidgetHostBrowser>
    </div>
  );
}
