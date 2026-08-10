"use client";

import { DEMO_SERVICES, demoBookingTransport } from "../../lib/booking/demo";
import { BookingFlow } from "../booking/BookingFlow";

export function DemoBookingFlow() {
  return (
    <BookingFlow
      initialServices={DEMO_SERVICES}
      initialEmployees={[]}
      transport={demoBookingTransport}
      demonstration
    />
  );
}
