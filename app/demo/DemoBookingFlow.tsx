"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_SERVICES,
  demoBookingTransport,
  demoScenario,
  type DemoServiceKey,
} from "../../lib/booking/demo";
import { BookingFlow } from "../booking/BookingFlow";

export function DemoBookingFlow({
  journey = "catalogue",
  demoService = "interior",
}: {
  journey?: "catalogue" | "page-service";
  demoService?: DemoServiceKey;
} = {}) {
  const scenario = demoScenario(demoService);
  const fixedService = journey === "page-service";
  const resetKey = `${journey}:${demoService}`;
  const resetLabel = fixedService
    ? scenario.service.name
    : "the full service catalogue";
  const container = useRef<HTMLDivElement>(null);
  const previousResetKey = useRef(resetKey);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    const timer = window.setTimeout(() => {
      setResetMessage(`Demonstration reset for ${resetLabel}.`);
      const homepagePreview = container.current?.closest<HTMLElement>(".homepage-live-preview");
      if (homepagePreview && !homepagePreview.contains(document.activeElement)) return;
      container.current?.querySelector<HTMLElement>(".stage-title h3")?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resetKey, resetLabel]);

  return (
    <div className="demo-booking-flow" ref={container}>
      <span className="sr-only" role="status" aria-live="polite">{resetMessage}</span>
      <BookingFlow
        key={resetKey}
        initialServices={fixedService ? [scenario.service] : DEMO_SERVICES}
        initialServiceId={fixedService ? scenario.service.id : undefined}
        initialEmployees={fixedService ? scenario.employees : []}
        transport={demoBookingTransport}
        demonstration
      />
    </div>
  );
}
