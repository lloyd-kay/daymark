import { describe, expect, it } from "vitest";
import {
  computeBookableSlots,
  overlaps,
  toLondonDateKey,
} from "../lib/scheduling/slots";
import type { AvailabilityRule } from "../lib/scheduling/types";

const mondayRule = (bufferMinutes = 0): AvailabilityRule => ({
  weekday: 1,
  startMinute: 9 * 60,
  endMinute: 11 * 60,
  slotMinutes: 30,
  bufferMinutes,
});

describe("overlaps", () => {
  it("treats touching ranges as separate", () => {
    expect(
      overlaps(
        {
          startAt: "2026-08-10T08:00:00.000Z",
          endAt: "2026-08-10T08:30:00.000Z",
        },
        {
          startAt: "2026-08-10T08:30:00.000Z",
          endAt: "2026-08-10T09:00:00.000Z",
        },
      ),
    ).toBe(false);
  });
});

describe("computeBookableSlots", () => {
  it("emits stable UTC slots inside a London working window", () => {
    const slots = computeBookableSlots({
      dateKeys: ["2026-08-10"],
      now: new Date("2026-08-01T12:00:00.000Z"),
      rules: [mondayRule()],
      busy: [],
      durationMinutes: 30,
      zone: "Europe/London",
    });

    expect(slots).toEqual([
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T08:00:00.000Z",
        endAt: "2026-08-10T08:30:00.000Z",
      },
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T08:30:00.000Z",
        endAt: "2026-08-10T09:00:00.000Z",
      },
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T09:00:00.000Z",
        endAt: "2026-08-10T09:30:00.000Z",
      },
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T09:30:00.000Z",
        endAt: "2026-08-10T10:00:00.000Z",
      },
    ]);
  });

  it("removes busy slots and applies the configured buffer", () => {
    const slots = computeBookableSlots({
      dateKeys: ["2026-08-10"],
      now: new Date("2026-08-01T12:00:00.000Z"),
      rules: [mondayRule(10)],
      busy: [
        {
          startAt: "2026-08-10T09:00:00.000Z",
          endAt: "2026-08-10T09:30:00.000Z",
        },
      ],
      durationMinutes: 30,
      zone: "Europe/London",
    });

    expect(slots.map((slot) => slot.startAt)).toEqual([
      "2026-08-10T08:00:00.000Z",
    ]);
  });

  it("omits slot starts that are not in the future", () => {
    const slots = computeBookableSlots({
      dateKeys: ["2026-08-10"],
      now: new Date("2026-08-10T09:00:00.000Z"),
      rules: [mondayRule()],
      busy: [],
      durationMinutes: 30,
      zone: "Europe/London",
    });

    expect(slots.map((slot) => slot.startAt)).toEqual([
      "2026-08-10T09:30:00.000Z",
    ]);
  });

  it("uses British Summer Time after the March clock change", () => {
    const [slot] = computeBookableSlots({
      dateKeys: ["2026-03-30"],
      now: new Date("2026-03-01T12:00:00.000Z"),
      rules: [mondayRule()],
      busy: [],
      durationMinutes: 30,
      zone: "Europe/London",
    });

    expect(slot.startAt).toBe("2026-03-30T08:00:00.000Z");
  });

  it("uses Greenwich Mean Time after the October clock change", () => {
    const [slot] = computeBookableSlots({
      dateKeys: ["2026-10-26"],
      now: new Date("2026-10-01T12:00:00.000Z"),
      rules: [mondayRule()],
      busy: [],
      durationMinutes: 30,
      zone: "Europe/London",
    });

    expect(slot.startAt).toBe("2026-10-26T09:00:00.000Z");
  });

  it("fits a 90-minute service into 30-minute start intervals", () => {
    const slots = computeBookableSlots({
      dateKeys: ["2026-08-10"],
      now: new Date("2026-08-01T12:00:00.000Z"),
      rules: [mondayRule()],
      busy: [],
      durationMinutes: 90,
      zone: "Europe/London",
    });

    expect(slots).toEqual([
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T08:00:00.000Z",
        endAt: "2026-08-10T09:30:00.000Z",
      },
      {
        dateKey: "2026-08-10",
        startAt: "2026-08-10T08:30:00.000Z",
        endAt: "2026-08-10T10:00:00.000Z",
      },
    ]);
  });
});

describe("toLondonDateKey", () => {
  it("returns the London date across a UTC midnight boundary", () => {
    expect(toLondonDateKey(new Date("2026-08-10T23:30:00.000Z"))).toBe(
      "2026-08-11",
    );
  });
});
