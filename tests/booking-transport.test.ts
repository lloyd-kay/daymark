import { describe, expect, it, vi } from "vitest";
import { demoBookingTransport } from "../lib/booking/transport";

describe("demonstration booking transport", () => {
  it("completes the sample flow without network access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const slots = await demoBookingTransport.loadSlots("maya-chen", "2026-08-06");
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
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
