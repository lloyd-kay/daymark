import type {
  CreateBookingInput,
  PublicEmployee,
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
          safeMessage(
            body?.error,
            "The qualified team could not be loaded. Please try again.",
          ),
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
        throw new BookingTransportError(
          "Availability could not be loaded. Please try again.",
          response.status,
        );
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
          safeMessage(
            body?.error,
            "The booking could not be completed. Please try again.",
          ),
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
