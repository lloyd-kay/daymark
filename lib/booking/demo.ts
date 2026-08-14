import type {
  CreateBookingInput,
  PublicEmployee,
  PublicService,
} from "../data/contracts";
import type { BookableSlot } from "../scheduling/types";
import {
  BookingTransportError,
  type BookingTransport,
} from "./transport";

const DEMO_DATE_COUNT = 7;
const DEMO_SLOT_TIMES = [
  "08:30:00.000Z",
  "09:00:00.000Z",
  "09:30:00.000Z",
  "10:30:00.000Z",
  "11:00:00.000Z",
  "11:30:00.000Z",
  "13:00:00.000Z",
  "13:30:00.000Z",
  "14:30:00.000Z",
  "15:00:00.000Z",
  "15:30:00.000Z",
  "16:00:00.000Z",
] as const;

export type DemoServiceKey = "interior" | "garden";

export const DEMO_SERVICES: PublicService[] = [
  {
    id: "service-demo-interior-consultation",
    slug: "interior-consultation",
    name: "Interior consultation",
    category: "Design consultation",
    description: "Plan a thoughtful room with a Cedar House specialist.",
    durationMinutes: 90,
  },
  {
    id: "service-demo-garden-planning",
    slug: "garden-planning",
    name: "Garden planning",
    category: "Outdoor spaces",
    description: "Shape a practical planting and layout plan for your garden.",
    durationMinutes: 120,
  },
];

export const DEMO_EMPLOYEES: PublicEmployee[] = [
  { id: "maya-chen", publicName: "Maya Chen", title: "Interior designer", bio: "Calm, practical room planning with a material-led approach.", accent: "coral" },
  { id: "theo-brooks", publicName: "Theo Brooks", title: "Garden designer", bio: "Outdoor layouts designed around daily life and the seasons.", accent: "sage" },
  { id: "priya-shah", publicName: "Priya Shah", title: "Planting specialist", bio: "Resilient planting plans with texture, colour, and year-round interest.", accent: "lilac" },
  { id: "jon-bell", publicName: "Jon Bell", title: "Space planning consultant", bio: "Clear room layouts and a friendly, practical design walkthrough.", accent: "ochre" },
];

const ELIGIBLE_EMPLOYEE_IDS: Record<string, readonly string[]> = {
  "service-demo-interior-consultation": ["maya-chen", "jon-bell"],
  "service-demo-garden-planning": ["theo-brooks", "priya-shah"],
};

const DEMO_SERVICE_IDS: Record<DemoServiceKey, string> = {
  interior: "service-demo-interior-consultation",
  garden: "service-demo-garden-planning",
};

export function demoScenario(serviceKey: DemoServiceKey): {
  service: PublicService;
  employees: PublicEmployee[];
} {
  const service = requireService(DEMO_SERVICE_IDS[serviceKey]);
  return { service, employees: eligibleEmployees(service) };
}

export const demoBookingTransport: BookingTransport = {
  async loadEmployees(serviceId) {
    const service = requireService(serviceId);
    return eligibleEmployees(service);
  },

  async loadSlots(serviceId, employeeId) {
    const service = requireService(serviceId);
    requireEligibleEmployee(service, employeeId);
    const dateKeys = consecutiveDemoDateKeys(londonTodayKey(), DEMO_DATE_COUNT);
    return {
      dateKeys,
      slots: demoSlotsFor(service, employeeId, dateKeys),
    };
  },

  async createBooking(input) {
    const service = requireService(input.serviceId);
    const employee = requireEligibleEmployee(service, input.employeeId);
    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    return {
      reference: "DEMO-ONLY",
      serviceName: service.name,
      serviceDurationMinutes: service.durationMinutes,
      employeeName: employee.publicName,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      address: input.clientAddress,
      contactSummary: maskedContact(input),
    };
  },
};

function requireService(serviceId: string): PublicService {
  const service = DEMO_SERVICES.find((candidate) => candidate.id === serviceId);
  if (!service) {
    throw new BookingTransportError("That demonstration service is not available.", 400);
  }
  return service;
}

function requireEligibleEmployee(
  service: PublicService,
  employeeId: string,
): PublicEmployee {
  const employee = eligibleEmployees(service).find(
    (candidate) => candidate.id === employeeId,
  );
  if (!employee) {
    throw new BookingTransportError(
      "That specialist is not available for this service.",
      400,
    );
  }
  return employee;
}

function eligibleEmployees(service: PublicService): PublicEmployee[] {
  const eligibleIds = new Set(ELIGIBLE_EMPLOYEE_IDS[service.id] ?? []);
  return DEMO_EMPLOYEES.filter((employee) => eligibleIds.has(employee.id));
}

function maskedContact(input: CreateBookingInput): string {
  return input.clientEmail ? "d••••@example.com" : "•••• 0000";
}

function consecutiveDemoDateKeys(startDateKey: string, count: number): string[] {
  const start = Date.parse(`${startDateKey}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

function demoSlotsFor(
  service: PublicService,
  employeeId: string,
  dateKeys: string[],
): BookableSlot[] {
  return dateKeys.flatMap((dateKey) => {
    const seed = demoSeed(`${service.id}:${employeeId}:${dateKey}`);
    const slotCount = 2 + (seed % 3);
    const times = Array.from({ length: slotCount }, (_, index) =>
      DEMO_SLOT_TIMES[(seed + index * 5) % DEMO_SLOT_TIMES.length],
    ).sort();

    return times.map((time) => {
      const startAt = `${dateKey}T${time}`;
      const endAt = new Date(
        Date.parse(startAt) + service.durationMinutes * 60_000,
      ).toISOString();
      return { dateKey, startAt, endAt };
    });
  });
}

function demoSeed(value: string): number {
  return Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

function londonTodayKey(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
