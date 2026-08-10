import { describe, expect, it, vi } from "vitest";
import { createPublicBookingService as createScopedPublicBookingService, maskContact } from "../lib/public-booking";

const scope = { workspaceId: "workspace-cedar", workspaceSlug: "cedar-house", workspaceName: "Cedar House" };

function createPublicBookingService(deps: ReturnType<typeof dependencies>) {
  return createScopedPublicBookingService(scope, deps);
}

const employee = {
  id: "maya-chen",
  publicName: "Maya Chen",
  title: "Client partner",
  bio: "Thoughtful planning.",
  accent: "coral",
};

const service = {
  id: "service-camera",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Smart security",
  description: "Install and configure a camera.",
  durationMinutes: 90,
};

const validBooking = {
  serviceId: "service-camera",
  employeeId: "maya-chen",
  startAt: "2026-08-10T08:00:00.000Z",
  clientName: "Lloyd Example",
  clientAddress: "14 Example Street, London, N1 1AA",
  clientEmail: "lloyd@example.com",
  clientPhone: null,
  clientNote: "Planning conversation",
};

function dependencies() {
  return {
    listPublicServices: vi.fn().mockResolvedValue([service]),
    listPublicEmployees: vi.fn().mockResolvedValue([employee]),
    listPublicSlots: vi.fn().mockResolvedValue({ service, employee, slots: [] }),
    createBooking: vi.fn().mockResolvedValue({
      ok: true,
      booking: {
        reference: "DM-7K4P2Q",
        serviceName: "Camera installation",
        serviceDurationMinutes: 90,
        employeeName: "Maya Chen",
        startAt: validBooking.startAt,
        endAt: "2026-08-10T08:30:00.000Z",
      },
    }),
  };
}

describe("public employee data", () => {
  it("whitelists public service fields and accepts optional employee filtering", async () => {
    const deps = dependencies();
    deps.listPublicServices.mockResolvedValue([{
      ...service,
      workspaceId: "private-workspace",
      active: true,
      certificateName: "must not leak",
    }] as never);

    const result = await createPublicBookingService(deps).services({
      employeeId: "maya-chen",
    });

    expect(result.body).toEqual({ services: [service] });
    expect(deps.listPublicServices).toHaveBeenCalledWith(
      scope,
      "maya-chen",
      expect.any(Date),
    );
    expect(JSON.stringify(result.body)).not.toMatch(/workspace|active|certificate/i);
  });

  it("whitelists anonymous profile fields", async () => {
    const deps = dependencies();
    deps.listPublicEmployees.mockResolvedValue([
      { ...employee, membershipId: "private", active: true },
    ] as never);
    const service = createPublicBookingService(deps);

    const result = await service.employees({ serviceId: "service-camera" });

    expect(result.body).toEqual({ employees: [employee] });
    expect(deps.listPublicEmployees).toHaveBeenCalledWith(
      scope,
      "service-camera",
      expect.any(Date),
    );
    expect(JSON.stringify(result.body)).not.toMatch(/certificate|expiresOn|issuedOn/i);
  });
});

describe("slot lookup", () => {
  it("rejects malformed employee and date parameters", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    const result = await service.slots(
      { serviceId: "<script>", employeeId: "<script>", from: "not-a-date" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.status).toBe(400);
    expect(deps.listPublicSlots).not.toHaveBeenCalled();
  });

  it("requests a focused fourteen-day window", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    await service.slots(
      { serviceId: "service-camera", employeeId: "maya-chen", from: "2026-08-06" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(deps.listPublicSlots).toHaveBeenCalledWith(
      scope,
      "service-camera",
      "maya-chen",
      expect.arrayContaining(["2026-08-06", "2026-08-19"]),
      expect.any(Date),
    );
    expect(deps.listPublicSlots.mock.calls[0][3]).toHaveLength(14);
  });
});

describe("booking creation", () => {
  it("rejects a missing service before querying storage", async () => {
    const deps = dependencies();

    const result = await createPublicBookingService(deps).book(
      { ...validBooking, serviceId: undefined },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: "Choose a valid service." },
    });
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("rejects invalid contact details before querying storage", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    const result = await service.book(
      { ...validBooking, clientEmail: "not-an-email" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: "Enter a valid email address." },
    });
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("rejects malformed phone details before querying storage", async () => {
    const deps = dependencies();
    const result = await createPublicBookingService(deps).book(
      { ...validBooking, clientEmail: null, clientPhone: "not a phone" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.body.error).toBe("Enter a valid phone number.");
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("rejects malformed optional contact types even when the other contact is valid", async () => {
    const deps = dependencies();
    const result = await createPublicBookingService(deps).book(
      { ...validBooking, clientPhone: { value: "+442079460958" } },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.body.error).toBe("Enter a valid phone number.");
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("requires an address and at least one contact method", async () => {
    const service = createPublicBookingService(dependencies());
    const noAddress = await service.book(
      { ...validBooking, clientAddress: "" },
      new Date("2026-08-05T12:00:00.000Z"),
    );
    const noContact = await service.book(
      { ...validBooking, clientEmail: null, clientPhone: null },
      new Date("2026-08-05T12:00:00.000Z"),
    );
    expect(noAddress.body.error).toBe("Enter the appointment address.");
    expect(noContact.body.error).toBe("Enter an email address or phone number.");
  });

  it("rejects a past timestamp before querying storage", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    const result = await service.book(
      { ...validBooking, startAt: "2026-08-01T08:00:00.000Z" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.status).toBe(400);
    expect(deps.createBooking).not.toHaveBeenCalled();
  });

  it("returns a concise confirmation for a successful booking", async () => {
    const service = createPublicBookingService(dependencies());

    const result = await service.book(
      validBooking,
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      ok: true,
      booking: {
        reference: "DM-7K4P2Q",
        serviceName: "Camera installation",
        serviceDurationMinutes: 90,
        employeeName: "Maya Chen",
        startAt: "2026-08-10T08:00:00.000Z",
        endAt: "2026-08-10T08:30:00.000Z",
        address: "14 Example Street, London, N1 1AA",
        contactSummary: "l••••@example.com",
      },
    });
  });

  it("accepts a phone-only booking and returns an exact phone mask", async () => {
    const deps = dependencies();
    const result = await createPublicBookingService(deps).book(
      { ...validBooking, clientEmail: null, clientPhone: "+44 20 7946 0958" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.body.booking).toMatchObject({ contactSummary: "•••• 0958" });
    expect(deps.createBooking).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ clientEmail: null, clientPhone: "+44 20 7946 0958" }),
      expect.any(Date),
    );
  });

  it("normalizes appointment address whitespace before storage and confirmation", async () => {
    const deps = dependencies();
    const result = await createPublicBookingService(deps).book(
      { ...validBooking, clientAddress: "  14   Example Street,\n London, N1 1AA  " },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(deps.createBooking).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ clientAddress: "14 Example Street, London, N1 1AA" }),
      expect.any(Date),
    );
    expect(result.body.booking).toMatchObject({ address: "14 Example Street, London, N1 1AA" });
  });

  it("accepts a 240-character address and rejects a longer address", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);
    const accepted = await service.book(
      { ...validBooking, clientAddress: "A".repeat(240) },
      new Date("2026-08-05T12:00:00.000Z"),
    );
    const rejected = await service.book(
      { ...validBooking, clientAddress: "A".repeat(241) },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(accepted.status).toBe(201);
    expect(rejected.body.error).toBe("Enter the appointment address.");
    expect(deps.createBooking).toHaveBeenCalledTimes(1);
  });

  it("masks the confirmation contact", async () => {
    const result = await createPublicBookingService(dependencies()).book(
      validBooking,
      new Date("2026-08-05T12:00:00.000Z"),
    );
    expect(result.body.booking).toMatchObject({
      address: "14 Example Street, London, N1 1AA",
      contactSummary: "l••••@example.com",
    });
    expect(JSON.stringify(result.body)).not.toContain("lloyd@example.com");
  });

  it("whitelists a public confirmation even when storage returns extra contact fields", async () => {
    const deps = dependencies();
    deps.createBooking.mockResolvedValue({
      ok: true,
      booking: {
        reference: "DM-7K4P2Q",
        serviceName: "Camera installation",
        serviceDurationMinutes: 90,
        employeeName: "Maya Chen",
        startAt: validBooking.startAt,
        endAt: "2026-08-10T08:30:00.000Z",
        clientEmail: "leak@example.com",
        clientPhone: "+442079460000",
      },
    } as never);

    const result = await createPublicBookingService(deps).book(
      validBooking,
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.body).toEqual({
      ok: true,
      booking: {
        reference: "DM-7K4P2Q",
        serviceName: "Camera installation",
        serviceDurationMinutes: 90,
        employeeName: "Maya Chen",
        startAt: validBooking.startAt,
        endAt: "2026-08-10T08:30:00.000Z",
        address: "14 Example Street, London, N1 1AA",
        contactSummary: "l••••@example.com",
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("leak@example.com");
    expect(JSON.stringify(result.body)).not.toContain("79460000");
  });

  it("masks phone contacts by their final four digits", () => {
    expect(maskContact(null, "+44 20 7946 0958")).toBe("•••• 0958");
  });

  it("maps a simultaneous claim to a friendly 409 conflict", async () => {
    const deps = dependencies();
    deps.createBooking.mockResolvedValue({
      ok: false,
      reason: "slot-taken",
    } as never);
    const service = createPublicBookingService(deps);

    const result = await service.book(
      validBooking,
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: 409,
      body: {
        ok: false,
        error: "That time was just booked. Please choose another.",
      },
    });
  });
});
