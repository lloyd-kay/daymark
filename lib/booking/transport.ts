import type { CreateBookingInput } from "../data/contracts";
import type { BookableSlot } from "../scheduling/types";

export type BookingTransport = {
  loadSlots(employeeId: string, from: string): Promise<{
    dateKeys: string[];
    slots: BookableSlot[];
  }>;
  createBooking(input: CreateBookingInput): Promise<{
    reference: string;
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

export const liveBookingTransport: BookingTransport = {
  async loadSlots(employeeId, from) {
    const response = await fetch(
      `/api/public/slots?employeeId=${encodeURIComponent(employeeId)}&from=${encodeURIComponent(from)}`,
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
    const response = await fetch("/api/public/bookings", {
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

const demoSlots: BookableSlot[] = [
  {
    dateKey: "2026-08-06",
    startAt: "2026-08-06T09:00:00.000Z",
    endAt: "2026-08-06T09:30:00.000Z",
  },
  {
    dateKey: "2026-08-06",
    startAt: "2026-08-06T10:00:00.000Z",
    endAt: "2026-08-06T10:30:00.000Z",
  },
];

export const demoBookingTransport: BookingTransport = {
  async loadSlots() {
    return { dateKeys: ["2026-08-06"], slots: demoSlots };
  },

  async createBooking(input) {
    const slot = demoSlots.find((candidate) => candidate.startAt === input.startAt) ?? demoSlots[0];
    return {
      reference: "DEMO-ONLY",
      employeeName: "Maya Chen",
      startAt: slot.startAt,
      endAt: slot.endAt,
      address: input.clientAddress,
      contactSummary: input.clientEmail ? "d••••@example.com" : "•••• 0000",
    };
  },
};
