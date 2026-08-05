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

export const liveBookingTransport: BookingTransport = {
  async loadSlots(employeeId, from) {
    const response = await fetch(
      `/api/public/slots?employeeId=${encodeURIComponent(employeeId)}&from=${encodeURIComponent(from)}`,
      { cache: "no-store" },
    );
    const body = await response.json() as {
      error?: string;
      dateKeys?: string[];
      slots?: BookableSlot[];
    };
    if (!response.ok) throw new Error(body.error ?? "Availability could not be loaded.");
    return { dateKeys: body.dateKeys ?? [], slots: body.slots ?? [] };
  },

  async createBooking(input) {
    const response = await fetch("/api/public/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json() as {
      error?: string;
      booking?: Awaited<ReturnType<BookingTransport["createBooking"]>>;
    };
    if (!response.ok || !body.booking) {
      throw new Error(body.error ?? "The booking could not be completed.");
    }
    return body.booking;
  },
};

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
