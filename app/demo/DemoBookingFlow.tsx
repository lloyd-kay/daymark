"use client";

import {
  DEMO_EMPLOYEES,
  DEMO_SERVICE,
  demoBookingTransport,
} from "../../lib/booking/transport";
import { BookingFlow } from "../booking/BookingFlow";

export function DemoBookingFlow() {
  return (
    <BookingFlow
      initialServices={[DEMO_SERVICE]}
      initialServiceId={DEMO_SERVICE.id}
      initialEmployees={DEMO_EMPLOYEES}
      transport={demoBookingTransport}
      demonstration
    />
  );
}
