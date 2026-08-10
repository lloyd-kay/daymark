"use client";

import { liveBookingTransport } from "../../lib/booking/transport";
import type { PublicEmployee, PublicService } from "../../lib/data/contracts";
import { BookingFlow } from "./BookingFlow";

export function LiveBookingFlow({
  initialServices,
  initialEmployees,
  workspaceSlug,
  initialServiceId,
  initialEmployeeId,
  embedded = false,
}: {
  initialServices: PublicService[];
  initialEmployees: PublicEmployee[];
  workspaceSlug: string;
  initialServiceId?: string;
  initialEmployeeId?: string;
  embedded?: boolean;
}) {
  return (
    <BookingFlow
      initialServices={initialServices}
      initialEmployees={initialEmployees}
      initialServiceId={initialServiceId}
      initialEmployeeId={initialEmployeeId}
      transport={liveBookingTransport(workspaceSlug)}
      embedded={embedded}
    />
  );
}
