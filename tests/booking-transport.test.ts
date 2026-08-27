import { describe, expect, it, vi } from "vitest";
import {
  BookingTransportError,
  liveBookingTransport as createLiveBookingTransport,
} from "../lib/booking/transport";
import {
  DEMO_SERVICES,
  demoScenario,
  demoBookingTransport,
} from "../lib/booking/demo";

const liveBookingTransport = createLiveBookingTransport("cedar-house");

describe("demonstration booking transport", () => {
  it.each([
    ["interior", "Interior consultation", 90, ["Maya Chen", "Jon Bell"]],
    ["garden", "Garden planning", 120, ["Theo Brooks", "Priya Shah"]],
  ] as const)("selects the canonical %s demonstration scenario", (
    key,
    serviceName,
    durationMinutes,
    employeeNames,
  ) => {
    const scenario = demoScenario(key);

    expect(scenario.service).toMatchObject({ name: serviceName, durationMinutes });
    expect(scenario.employees.map((employee) => employee.publicName)).toEqual(employeeNames);
  });

  it("offers the exact neutral catalogue and service-qualified specialists", async () => {
    expect(DEMO_SERVICES.map(({ id, durationMinutes }) => ({ id, durationMinutes }))).toEqual([
      { id: "service-demo-interior-consultation", durationMinutes: 90 },
      { id: "service-demo-garden-planning", durationMinutes: 120 },
    ]);
    expect((await demoBookingTransport.loadEmployees("service-demo-interior-consultation"))
      .map((employee) => employee.publicName)).toEqual(["Maya Chen", "Jon Bell"]);
    expect((await demoBookingTransport.loadEmployees("service-demo-garden-planning"))
      .map((employee) => employee.publicName)).toEqual(["Theo Brooks", "Priya Shah"]);
  });

  it.each([
    ["service-demo-interior-consultation", "maya-chen", "Interior consultation", 90],
    ["service-demo-garden-planning", "theo-brooks", "Garden planning", 120],
  ] as const)("keeps %s in memory and uses its duration", async (
    serviceId,
    employeeId,
    serviceName,
    durationMinutes,
  ) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-10T12:00:00.000Z"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const slots = await demoBookingTransport.loadSlots(serviceId, employeeId, "2030-03-10");
      const booking = await demoBookingTransport.createBooking({
        serviceId,
        employeeId,
        startAt: slots.slots[0].startAt,
        clientName: "Demo Visitor",
        clientAddress: "14 Sample Street, London",
        clientEmail: "demo@example.com",
        clientPhone: null,
        clientNote: "",
      });
      expect(booking.reference).toBe("DEMO-ONLY");
      expect(booking).toMatchObject({
        serviceName,
        serviceDurationMinutes: durationMinutes,
      });
      expect(Date.parse(slots.slots[0].endAt) - Date.parse(slots.slots[0].startAt))
        .toBe(durationMinutes * 60_000);
      expect(Date.parse(booking.endAt) - Date.parse(booking.startAt))
        .toBe(durationMinutes * 60_000);
      expect(slots.dateKeys[0]).toBe("2030-03-10");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("offers seven stable selectable days with employee-specific times", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-10T12:00:00.000Z"));
    try {
      const interiorId = "service-demo-interior-consultation";
      const maya = await demoBookingTransport.loadSlots(interiorId, "maya-chen", "2030-03-10");
      const mayaAgain = await demoBookingTransport.loadSlots(interiorId, "maya-chen", "2030-03-10");
      const jon = await demoBookingTransport.loadSlots(interiorId, "jon-bell", "2030-03-10");

      expect(maya.dateKeys).toEqual([
        "2030-03-10",
        "2030-03-11",
        "2030-03-12",
        "2030-03-13",
        "2030-03-14",
        "2030-03-15",
        "2030-03-16",
      ]);
      expect(maya.dateKeys.every((dateKey) =>
        maya.slots.some((slot) => slot.dateKey === dateKey),
      )).toBe(true);
      expect(maya.slots).toEqual(mayaAgain.slots);
      expect(maya.slots.map((slot) => slot.startAt)).not.toEqual(
        jon.slots.map((slot) => slot.startAt),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects unknown services and specialists who are not qualified for the service", async () => {
    const serviceId = "service-demo-garden-planning";
    const slots = await demoBookingTransport.loadSlots(serviceId, "theo-brooks", "2026-08-06");
    const input = {
      serviceId,
      startAt: slots.slots[0].startAt,
      clientName: "Demo Visitor",
      clientAddress: "14 Sample Street, London",
      clientEmail: "demo@example.com",
      clientPhone: null,
      clientNote: "",
    };

    await expect(demoBookingTransport.createBooking({ ...input, employeeId: "theo-brooks" }))
      .resolves.toMatchObject({ employeeName: "Theo Brooks", reference: "DEMO-ONLY" });
    await expect(demoBookingTransport.createBooking({ ...input, employeeId: "maya-chen" }))
      .rejects.toThrow("not available for this service");
    await expect(demoBookingTransport.loadSlots(serviceId, "maya-chen", "2026-08-06"))
      .rejects.toThrow("not available for this service");
    await expect(demoBookingTransport.loadEmployees("unknown-service"))
      .rejects.toThrow("service is not available");
  });
});

describe("live booking transport", () => {
  const booking = {
    serviceId: "service-camera",
    employeeId: "maya-chen",
    startAt: "2026-08-06T09:00:00.000Z",
    clientName: "Demo Visitor",
    clientAddress: "14 Sample Street, London",
    clientEmail: "demo@example.com",
    clientPhone: null,
    clientNote: "",
  };

  it("returns endpoint slot and confirmation payloads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        employees: [{
          id: "maya-chen",
          publicName: "Maya Chen",
          title: "Camera specialist",
          bio: "Qualified installer.",
          accent: "coral",
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        dateKeys: ["2026-08-06"],
        slots: [{ dateKey: "2026-08-06", startAt: booking.startAt, endAt: "2026-08-06T09:30:00.000Z" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        booking: {
          reference: "DM-7K4P2Q",
          serviceName: "Camera installation",
          serviceDurationMinutes: 90,
          employeeName: "Maya Chen",
          startAt: booking.startAt,
          endAt: "2026-08-06T09:30:00.000Z",
          address: booking.clientAddress,
          contactSummary: "d••••@example.com",
        },
      }), { status: 201 }));

    await expect(liveBookingTransport.loadEmployees("service-camera")).resolves.toEqual([
      expect.objectContaining({ id: "maya-chen" }),
    ]);
    await expect(liveBookingTransport.loadSlots("service-camera", "maya-chen", "2026-08-06")).resolves.toMatchObject({
      dateKeys: ["2026-08-06"],
      slots: [{ startAt: booking.startAt }],
    });
    await expect(liveBookingTransport.createBooking(booking)).resolves.toMatchObject({
      reference: "DM-7K4P2Q",
      serviceName: "Camera installation",
      serviceDurationMinutes: 90,
      contactSummary: "d••••@example.com",
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/public/cedar-house/employees?serviceId=service-camera"), { cache: "no-store" });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/public/cedar-house/slots?serviceId=service-camera"), { cache: "no-store" });
    expect(fetchSpy).toHaveBeenNthCalledWith(3, "/api/public/cedar-house/bookings", expect.objectContaining({ method: "POST" }));
    fetchSpy.mockRestore();
  });

  it("preserves a safe 409 booking error status for conflict recovery", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "That time was just booked. Please choose another." }), { status: 409 }),
    );

    await expect(liveBookingTransport.createBooking(booking)).rejects.toMatchObject({
      name: "BookingTransportError",
      message: "That time was just booked. Please choose another.",
      status: 409,
    } satisfies Partial<BookingTransportError>);
    fetchSpy.mockRestore();
  });

  it("uses generic safe messages for non-JSON endpoint failures", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("gateway detail", { status: 502 }))
      .mockResolvedValueOnce(new Response("database detail", { status: 500 }));

    await expect(liveBookingTransport.loadSlots("service-camera", "maya-chen", "2026-08-06")).rejects.toMatchObject({
      message: "Availability could not be loaded. Please try again.",
      status: 502,
    });
    await expect(liveBookingTransport.createBooking(booking)).rejects.toMatchObject({
      message: "The booking could not be completed. Please try again.",
      status: 500,
    });
    fetchSpy.mockRestore();
  });
});
