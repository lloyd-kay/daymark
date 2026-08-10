import type {
  CreateBookingInput,
  PublicEmployee,
  PublicService,
} from "../data/contracts";
import type { BookableSlot } from "../scheduling/types";

export type BookingTransport = {
  loadEmployees(serviceId: string): Promise<PublicEmployee[]>;
  loadSlots(serviceId: string, employeeId: string, from: string): Promise<{
    dateKeys: string[];
    slots: BookableSlot[];
  }>;
  createBooking(input: CreateBookingInput): Promise<{
    reference: string;
    serviceName: string;
    serviceDurationMinutes: number;
    employeeName: string;
    startAt: string;
    endAt: string;
    address: string;
    contactSummary: string;
  }>;
};

export class BookingTransportError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingTransportError";
    this.status = status;
  }
}

export function isBookingConflict(error: unknown): error is BookingTransportError {
  return error instanceof BookingTransportError && error.status === 409;
}

export function liveBookingTransport(workspaceSlug: string): BookingTransport {
  const basePath = `/api/public/${encodeURIComponent(workspaceSlug)}`;
  return {
  async loadEmployees(serviceId) {
    const response = await fetch(
      `${basePath}/employees?serviceId=${encodeURIComponent(serviceId)}`,
      { cache: "no-store" },
    );
    const body = await safeJsonBody(response) as {
      error?: string;
      employees?: PublicEmployee[];
    } | null;
    if (!response.ok) {
      throw new BookingTransportError(
        safeMessage(body?.error, "The qualified team could not be loaded. Please try again."),
        response.status,
      );
    }
    if (!body) {
      throw new BookingTransportError(
        "The qualified team could not be loaded. Please try again.",
        response.status,
      );
    }
    return body.employees ?? [];
  },

  async loadSlots(serviceId, employeeId, from) {
    const response = await fetch(
      `${basePath}/slots?serviceId=${encodeURIComponent(serviceId)}&employeeId=${encodeURIComponent(employeeId)}&from=${encodeURIComponent(from)}`,
      { cache: "no-store" },
    );
    const body = await safeJsonBody(response) as {
      error?: string;
      dateKeys?: string[];
      slots?: BookableSlot[];
    } | null;
    if (!response.ok) {
      throw new BookingTransportError(
        safeMessage(body?.error, "Availability could not be loaded. Please try again."),
        response.status,
      );
    }
    if (!body) {
      throw new BookingTransportError("Availability could not be loaded. Please try again.", response.status);
    }
    return { dateKeys: body.dateKeys ?? [], slots: body.slots ?? [] };
  },

  async createBooking(input) {
    const response = await fetch(`${basePath}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await safeJsonBody(response) as {
      error?: string;
      booking?: Awaited<ReturnType<BookingTransport["createBooking"]>>;
    } | null;
    if (!response.ok || !body?.booking) {
      throw new BookingTransportError(
        safeMessage(body?.error, "The booking could not be completed. Please try again."),
        response.status,
      );
    }
    return body.booking;
  },
  };
}

async function safeJsonBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function safeMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

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

export const demoBookingTransport: BookingTransport = {
  async loadEmployees() {
    return DEMO_EMPLOYEES;
  },

  async loadSlots(_serviceId, employeeId) {
    const dateKeys = consecutiveDemoDateKeys(londonTodayKey(), DEMO_DATE_COUNT);
    return { dateKeys, slots: demoSlotsFor(employeeId, dateKeys) };
  },

  async createBooking(input) {
    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    return {
      reference: "DEMO-ONLY",
      serviceName: DEMO_SERVICE.name,
      serviceDurationMinutes: DEMO_SERVICE.durationMinutes,
      employeeName: DEMO_EMPLOYEE_NAMES[input.employeeId] ?? "Daymark demonstration",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      address: input.clientAddress,
      contactSummary: input.clientEmail ? "d••••@example.com" : "•••• 0000",
    };
  },
};

export const DEMO_SERVICE: PublicService = {
  id: "service-demo-general-consultation",
  slug: "general-consultation",
  name: "General consultation",
  category: "Demonstration",
  description: "A fixed non-transactional Daymark demonstration service.",
  durationMinutes: 30,
};

export const DEMO_EMPLOYEES: PublicEmployee[] = [
  { id: "maya-chen", publicName: "Maya Chen", title: "Client partner", bio: "Thoughtful planning and project conversations.", accent: "coral" },
  { id: "theo-brooks", publicName: "Theo Brooks", title: "Operations specialist", bio: "Practical sessions for keeping work moving.", accent: "sage" },
  { id: "priya-shah", publicName: "Priya Shah", title: "Project adviser", bio: "Focused support for decisions and next steps.", accent: "lilac" },
  { id: "jon-bell", publicName: "Jon Bell", title: "Team coordinator", bio: "Clear, friendly appointments for general enquiries.", accent: "ochre" },
];

const DEMO_EMPLOYEE_NAMES: Record<string, string> = {
  "maya-chen": "Maya Chen",
  "theo-brooks": "Theo Brooks",
  "priya-shah": "Priya Shah",
  "jon-bell": "Jon Bell",
};

function consecutiveDemoDateKeys(startDateKey: string, count: number): string[] {
  const start = Date.parse(`${startDateKey}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

function demoSlotsFor(employeeId: string, dateKeys: string[]): BookableSlot[] {
  return dateKeys.flatMap((dateKey) => {
    const seed = demoSeed(`${employeeId}:${dateKey}`);
    const slotCount = 2 + (seed % 3);
    const times = Array.from({ length: slotCount }, (_, index) =>
      DEMO_SLOT_TIMES[(seed + index * 5) % DEMO_SLOT_TIMES.length],
    ).sort();

    return times.map((time) => {
      const startAt = `${dateKey}T${time}`;
      const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString();
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
