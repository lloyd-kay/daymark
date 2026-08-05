"use client";

import { liveBookingTransport } from "../../lib/booking/transport";
import type { PublicEmployee } from "../../lib/data/contracts";
import { BookingFlow } from "./BookingFlow";

export function LiveBookingFlow({
  initialEmployees,
  initialEmployeeId,
  embedded = false,
}: {
  initialEmployees: PublicEmployee[];
  initialEmployeeId?: string;
  embedded?: boolean;
}) {
  return (
    <BookingFlow
      initialEmployees={initialEmployees}
      initialEmployeeId={initialEmployeeId}
      transport={liveBookingTransport}
      embedded={embedded}
    />
  );
}
