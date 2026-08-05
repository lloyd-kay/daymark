import { describe, expect, it, vi } from "vitest";
import { createPublicBookingService } from "../lib/public-booking";

const employee = {
  id: "maya-chen",
  publicName: "Maya Chen",
  title: "Client partner",
  bio: "Thoughtful planning.",
  accent: "coral",
};

const validBooking = {
  employeeId: "maya-chen",
  startAt: "2026-08-10T08:00:00.000Z",
  clientName: "Lloyd Example",
  clientEmail: "lloyd@example.com",
  clientNote: "Planning conversation",
};

function dependencies() {
  return {
    listPublicEmployees: vi.fn().mockResolvedValue([employee]),
    listPublicSlots: vi.fn().mockResolvedValue({ employee, slots: [] }),
    createBooking: vi.fn().mockResolvedValue({
      ok: true,
      booking: {
        reference: "DM-7K4P2Q",
        employeeName: "Maya Chen",
        startAt: validBooking.startAt,
        endAt: "2026-08-10T08:30:00.000Z",
      },
    }),
  };
}

describe("public employee data", () => {
  it("whitelists anonymous profile fields", async () => {
    const deps = dependencies();
    deps.listPublicEmployees.mockResolvedValue([
      { ...employee, membershipId: "private", active: true },
    ] as never);
    const service = createPublicBookingService(deps);

    const result = await service.employees();

    expect(result.body).toEqual({ employees: [employee] });
  });
});

describe("slot lookup", () => {
  it("rejects malformed employee and date parameters", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    const result = await service.slots(
      { employeeId: "<script>", from: "not-a-date" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(result.status).toBe(400);
    expect(deps.listPublicSlots).not.toHaveBeenCalled();
  });

  it("requests a focused fourteen-day window", async () => {
    const deps = dependencies();
    const service = createPublicBookingService(deps);

    await service.slots(
      { employeeId: "maya-chen", from: "2026-08-06" },
      new Date("2026-08-05T12:00:00.000Z"),
    );

    expect(deps.listPublicSlots).toHaveBeenCalledWith(
      "maya-chen",
      expect.arrayContaining(["2026-08-06", "2026-08-19"]),
      expect.any(Date),
    );
    expect(deps.listPublicSlots.mock.calls[0][1]).toHaveLength(14);
  });
});

describe("booking creation", () => {
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
        employeeName: "Maya Chen",
        startAt: "2026-08-10T08:00:00.000Z",
        endAt: "2026-08-10T08:30:00.000Z",
      },
    });
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
