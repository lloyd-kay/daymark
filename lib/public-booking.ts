import type {
  CreateBookingInput,
  CreateBookingResult,
  PublicBookingScope,
  PublicEmployee,
  PublicService,
  PublicSlotResult,
} from "./data/contracts";

type PublicBookingDependencies = {
  listPublicServices: (
    scope: PublicBookingScope,
    employeeId?: string,
    now?: Date,
  ) => Promise<PublicService[]>;
  listPublicEmployees: (
    scope: PublicBookingScope,
    serviceId?: string,
    now?: Date,
  ) => Promise<PublicEmployee[]>;
  listPublicSlots: (
    scope: PublicBookingScope,
    serviceId: string,
    employeeId: string,
    dateKeys: string[],
    now: Date,
  ) => Promise<PublicSlotResult | null>;
  createBooking: (
    scope: PublicBookingScope,
    input: CreateBookingInput,
    now: Date,
  ) => Promise<CreateBookingResult>;
};

type ServiceResult = { status: number; body: Record<string, unknown> };

export function createPublicBookingService(
  scope: PublicBookingScope,
  dependencies: PublicBookingDependencies,
) {
  return {
    async services(
      query: { employeeId?: string | null } = {},
      now = new Date(),
    ): Promise<ServiceResult> {
      if (query.employeeId && !validEmployeeId(query.employeeId)) {
        return {
          status: 400,
          body: { ok: false, error: "Choose a valid person." },
        };
      }
      const rows = await dependencies.listPublicServices(
        scope,
        query.employeeId ?? undefined,
        now,
      );
      const services = rows.map(toPublicService);
      return { status: 200, body: { services } };
    },

    async employees(
      query: { serviceId?: string | null },
      now = new Date(),
    ): Promise<ServiceResult> {
      if (!validServiceId(query.serviceId)) {
        return {
          status: 400,
          body: { ok: false, error: "Choose a valid service." },
        };
      }
      const rows = await dependencies.listPublicEmployees(scope, query.serviceId, now);
      const employees = rows.map((employee) => ({
        id: employee.id,
        publicName: employee.publicName,
        title: employee.title,
        bio: employee.bio,
        accent: employee.accent,
      }));
      return { status: 200, body: { employees } };
    },

    async slots(
      query: {
        serviceId?: string | null;
        employeeId?: string | null;
        from?: string | null;
      },
      now = new Date(),
    ): Promise<ServiceResult> {
      if (
        !validServiceId(query.serviceId)
        || !validEmployeeId(query.employeeId)
        || !validDateKey(query.from)
      ) {
        return {
          status: 400,
          body: { ok: false, error: "Choose a valid person and date." },
        };
      }
      const dateKeys = consecutiveDateKeys(query.from, 14);
      const result = await dependencies.listPublicSlots(
        scope,
        query.serviceId,
        query.employeeId,
        dateKeys,
        now,
      );
      if (!result) {
        return {
          status: 404,
          body: { ok: false, error: "That person is not available for booking." },
        };
      }
      return {
        status: 200,
        body: {
          service: toPublicService(result.service),
          employee: {
            id: result.employee.id,
            publicName: result.employee.publicName,
            title: result.employee.title,
            bio: result.employee.bio,
            accent: result.employee.accent,
          },
          slots: result.slots,
          dateKeys,
        },
      };
    },

    async book(raw: unknown, now = new Date()): Promise<ServiceResult> {
      const parsed = parseBookingInput(raw, now);
      if (!parsed.ok) {
        return { status: 400, body: { ok: false, error: parsed.error } };
      }
      const result = await dependencies.createBooking(scope, parsed.data, now);
      if (!result.ok) {
        const slotTaken = result.reason === "slot-taken";
        return {
          status: slotTaken ? 409 : 400,
          body: {
            ok: false,
            error: slotTaken
              ? "That time was just booked. Please choose another."
              : "That time is no longer available. Please choose another.",
          },
        };
      }
      return {
        status: 201,
        body: {
          ok: true,
          booking: {
            reference: result.booking.reference,
            serviceName: result.booking.serviceName,
            serviceDurationMinutes: result.booking.serviceDurationMinutes,
            employeeName: result.booking.employeeName,
            startAt: result.booking.startAt,
            endAt: result.booking.endAt,
            address: parsed.data.clientAddress,
            contactSummary: maskContact(
              parsed.data.clientEmail,
              parsed.data.clientPhone,
            ),
          },
        },
      };
    },
  };
}

function parseBookingInput(
  value: unknown,
  now: Date,
): { ok: true; data: CreateBookingInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Check the booking details and try again." };
  }
  const input = value as Record<string, unknown>;
  if (!validServiceId(input.serviceId)) {
    return { ok: false, error: "Choose a valid service." };
  }
  if (!validEmployeeId(input.employeeId)) {
    return { ok: false, error: "Choose a valid person." };
  }
  if (typeof input.startAt !== "string" || !validFutureIso(input.startAt, now)) {
    return { ok: false, error: "Choose an available future time." };
  }
  if (typeof input.clientName !== "string" || !inLength(input.clientName, 1, 80)) {
    return { ok: false, error: "Enter your name." };
  }
  if (typeof input.clientAddress !== "string") {
    return { ok: false, error: "Enter the appointment address." };
  }
  const clientAddress = input.clientAddress.trim().replace(/\s+/g, " ");
  if (!inLength(clientAddress, 1, 240)) {
    return { ok: false, error: "Enter the appointment address." };
  }
  const clientEmail = optionalString(input.clientEmail);
  if (clientEmail === undefined) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const clientPhone = optionalString(input.clientPhone);
  if (clientPhone === undefined) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  if (!clientEmail && !clientPhone) {
    return { ok: false, error: "Enter an email address or phone number." };
  }
  if (
    clientEmail &&
    (!inLength(clientEmail, 3, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail))
  ) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (clientPhone && !/^[+\d][\d\s().-]{6,24}$/.test(clientPhone)) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  const note = typeof input.clientNote === "string" ? input.clientNote.trim() : "";
  if (note.length > 500) {
    return { ok: false, error: "Keep the note under 500 characters." };
  }
  return {
    ok: true,
    data: {
      serviceId: input.serviceId,
      employeeId: input.employeeId,
      startAt: input.startAt,
      clientName: input.clientName.trim(),
      clientAddress,
      clientEmail,
      clientPhone,
      clientNote: note,
    },
  };
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || null;
}

export function maskContact(email: string | null, phone: string | null): string {
  if (email) {
    const [local, domain] = email.split("@");
    return `${local.slice(0, 1)}${"•".repeat(Math.max(4, local.length - 1))}@${domain}`;
  }
  const digits = phone?.replace(/\D/g, "") ?? "";
  return `•••• ${digits.slice(-4)}`;
}

function validEmployeeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(value);
}

function validServiceId(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
}

function toPublicService(service: PublicService): PublicService {
  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    category: service.category,
    description: service.description,
    durationMinutes: service.durationMinutes,
  };
}

function validDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validFutureIso(value: string, now: Date): boolean {
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString() === value &&
    date.getTime() > now.getTime()
  );
}

function consecutiveDateKeys(from: string, count: number): string[] {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

function inLength(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}
