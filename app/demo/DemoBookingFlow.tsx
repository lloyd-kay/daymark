"use client";

import { demoBookingTransport } from "../../lib/booking/transport";
import type { PublicEmployee } from "../../lib/data/contracts";
import { BookingFlow } from "../booking/BookingFlow";

const DEMO_EMPLOYEES: PublicEmployee[] = [
  { id: "maya-chen", publicName: "Maya Chen", title: "Client partner", bio: "Thoughtful planning and project conversations.", accent: "coral" },
  { id: "theo-brooks", publicName: "Theo Brooks", title: "Operations specialist", bio: "Practical sessions for keeping work moving.", accent: "sage" },
  { id: "priya-shah", publicName: "Priya Shah", title: "Project adviser", bio: "Focused support for decisions and next steps.", accent: "lilac" },
  { id: "jon-bell", publicName: "Jon Bell", title: "Team coordinator", bio: "Clear, friendly appointments for general enquiries.", accent: "ochre" },
];

export function DemoBookingFlow() {
  return (
    <BookingFlow
      initialEmployees={DEMO_EMPLOYEES}
      transport={demoBookingTransport}
      demonstration
    />
  );
}
