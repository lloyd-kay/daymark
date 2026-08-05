import { describe, expect, it, vi } from "vitest";
import {
  BookingTransportError,
  demoBookingTransport,
  liveBookingTransport,
} from "../lib/booking/transport";

describe("demonstration booking transport", () => {
  it("keeps every demo transport operation in-memory with London-current dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-10T12:00:00.000Z"));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const slots = await demoBookingTransport.loadSlots("maya-chen", "2030-03-10");
      const booking = await demoBookingTransport.createBooking({
        employeeId: "maya-chen",
        startAt: slots.slots[0].startAt,
        clientName: "Demo Visitor",
        clientAddress: "14 Sample Street, London",
        clientEmail: "demo@example.com",
        clientPhone: null,
        clientNote: "",
      });
      expect(booking.reference).toBe("DEMO-ONLY");
      expect(slots.dateKeys[0]).toBe("2030-03-10");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("labels the selected fixed demo employee and uses a safe fallback for unknown ids", async () => {
    const slots = await demoBookingTransport.loadSlots("theo-brooks", "2026-08-06");
    const input = {
      startAt: slots.slots[0].startAt,
      clientName: "Demo Visitor",
      clientAddress: "14 Sample Street, London",
      clientEmail: "demo@example.com",
      clientPhone: null,
      clientNote: "",
    };

    await expect(demoBookingTransport.createBooking({ ...input, employeeId: "theo-brooks" }))
      .resolves.toMatchObject({ employeeName: "Theo Brooks", reference: "DEMO-ONLY" });
    await expect(demoBookingTransport.createBooking({ ...input, employeeId: "unknown" }))
      .resolves.toMatchObject({ employeeName: "Daymark demonstration", reference: "DEMO-ONLY" });
  });
});

describe("live booking transport", () => {
  const booking = {
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
        dateKeys: ["2026-08-06"],
        slots: [{ dateKey: "2026-08-06", startAt: booking.startAt, endAt: "2026-08-06T09:30:00.000Z" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        booking: {
          reference: "DM-7K4P2Q",
          employeeName: "Maya Chen",
          startAt: booking.startAt,
          endAt: "2026-08-06T09:30:00.000Z",
          address: booking.clientAddress,
          contactSummary: "d••••@example.com",
        },
      }), { status: 201 }));

    await expect(liveBookingTransport.loadSlots("maya-chen", "2026-08-06")).resolves.toMatchObject({
      dateKeys: ["2026-08-06"],
      slots: [{ startAt: booking.startAt }],
    });
    await expect(liveBookingTransport.createBooking(booking)).resolves.toMatchObject({
      reference: "DM-7K4P2Q",
      contactSummary: "d••••@example.com",
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/public/slots"), { cache: "no-store" });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "/api/public/bookings", expect.objectContaining({ method: "POST" }));
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

    await expect(liveBookingTransport.loadSlots("maya-chen", "2026-08-06")).rejects.toMatchObject({
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
