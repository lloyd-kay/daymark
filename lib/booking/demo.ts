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

export const DEMO_SERVICES: PublicService[] = [
  {
    id: "service-demo-camera-installation",
    slug: "camera-installation",
    name: "Camera installation",
    category: "Smart home installation",
    description: "Install and configure connected security cameras.",
    durationMinutes: 90,
  },
  {
    id: "service-demo-alarm-installation",
    slug: "alarm-installation",
    name: "Alarm installation",
    category: "Smart home installation",
    description: "Install and configure a connected alarm system.",
    durationMinutes: 120,
  },
];

export const DEMO_EMPLOYEES: PublicEmployee[] = [
  { id: "maya-chen", publicName: "Maya Chen", title: "Camera installer", bio: "Careful connected-camera placement and setup.", accent: "coral" },
  { id: "theo-brooks", publicName: "Theo Brooks", title: "Alarm installer", bio: "Practical connected-alarm installation and testing.", accent: "sage" },
  { id: "priya-shah", publicName: "Priya Shah", title: "Alarm specialist", bio: "Secure alarm configuration and household handover.", accent: "lilac" },
  { id: "jon-bell", publicName: "Jon Bell", title: "Camera specialist", bio: "Clear camera setup with a friendly walkthrough.", accent: "ochre" },
];

const ELIGIBLE_EMPLOYEE_IDS: Record<string, readonly string[]> = {
  "service-demo-camera-installation": ["maya-chen", "jon-bell"],
  "service-demo-alarm-installation": ["theo-brooks", "priya-shah"],
};

export const demoBookingTransport: BookingTransport = {
  async loadEmployees(serviceId) {
    const service = requireService(serviceId);
    const eligibleIds = new Set(ELIGIBLE_EMPLOYEE_IDS[service.id]);
    return DEMO_EMPLOYEES.filter((employee) => eligibleIds.has(employee.id));
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
  const eligibleIds = ELIGIBLE_EMPLOYEE_IDS[service.id] ?? [];
  const employee = eligibleIds.includes(employeeId)
    ? DEMO_EMPLOYEES.find((candidate) => candidate.id === employeeId)
    : null;
  if (!employee) {
    throw new BookingTransportError(
      "That installer is not available for this service.",
      400,
    );
  }
  return employee;
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
