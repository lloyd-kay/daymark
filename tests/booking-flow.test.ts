import { describe, expect, it, vi } from "vitest";
import { recoverBookingConflict } from "../app/booking/BookingFlow";

describe("booking conflict recovery", () => {
  it("reloads availability and returns the refreshed time-selection state", async () => {
    const loadSlots = vi.fn().mockResolvedValue({
      dateKeys: ["2026-08-06"],
      slots: [{
        dateKey: "2026-08-06",
        startAt: "2026-08-06T10:00:00.000Z",
        endAt: "2026-08-06T10:30:00.000Z",
      }],
    });

    const recovered = await recoverBookingConflict(
      { loadSlots, createBooking: vi.fn() },
      "maya-chen",
      "2026-08-06",
    );

    expect(loadSlots).toHaveBeenCalledWith("maya-chen", "2026-08-06");
    expect(recovered).toEqual({
      dateKeys: ["2026-08-06"],
      slots: [{
        dateKey: "2026-08-06",
        startAt: "2026-08-06T10:00:00.000Z",
        endAt: "2026-08-06T10:30:00.000Z",
      }],
      nextStep: "time",
      slot: null,
    });
  });
});
