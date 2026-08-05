import type {
  BookableSlot,
  SlotSearchInput,
  TimeRange,
} from "./types";

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return (
    Date.parse(a.startAt) < Date.parse(b.endAt) &&
    Date.parse(b.startAt) < Date.parse(a.endAt)
  );
}

export function computeBookableSlots(_input: SlotSearchInput): BookableSlot[] {
  const { dateKeys, now, rules, busy, zone } = _input;
  const slots: BookableSlot[] = [];

  for (const dateKey of dateKeys) {
    const weekday = weekdayForDateKey(dateKey);

    for (const rule of rules.filter((item) => item.weekday === weekday)) {
      for (
        let startMinute = rule.startMinute;
        startMinute + rule.slotMinutes <= rule.endMinute;
        startMinute += rule.slotMinutes
      ) {
        const start = londonWallTimeToDate(dateKey, startMinute, zone);
        const end = londonWallTimeToDate(
          dateKey,
          startMinute + rule.slotMinutes,
          zone,
        );

        if (!start || !end || start.getTime() <= now.getTime()) continue;

        const candidate = {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        };
        const unavailable = busy.some((range) =>
          overlaps(candidate, expandRange(range, rule.bufferMinutes)),
        );

        if (!unavailable) {
          slots.push({ dateKey, ...candidate });
        }
      }
    }
  }

  return slots.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export function toLondonDateKey(value: Date): string {
  const parts = zonedParts(value, "Europe/London");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function weekdayForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function londonWallTimeToDate(
  dateKey: string,
  minuteOfDay: number,
  zone: "Europe/London",
): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day, 0, minuteOfDay));
  const target = {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
    hour: normalized.getUTCHours(),
    minute: normalized.getUTCMinutes(),
  };
  const wallClockAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );

  let offset = zoneOffsetAt(new Date(wallClockAsUtc), zone);
  let instant = new Date(wallClockAsUtc - offset);
  const correctedOffset = zoneOffsetAt(instant, zone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = new Date(wallClockAsUtc - offset);
  }

  const actual = zonedParts(instant, zone);
  if (
    actual.year !== target.year ||
    actual.month !== target.month ||
    actual.day !== target.day ||
    actual.hour !== target.hour ||
    actual.minute !== target.minute
  ) {
    return null;
  }

  return instant;
}

function zoneOffsetAt(date: Date, zone: "Europe/London"): number {
  const parts = zonedParts(date, zone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedParts(date: Date, zone: "Europe/London") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function expandRange(range: TimeRange, bufferMinutes: number): TimeRange {
  const bufferMs = bufferMinutes * 60_000;
  return {
    startAt: new Date(Date.parse(range.startAt) - bufferMs).toISOString(),
    endAt: new Date(Date.parse(range.endAt) + bufferMs).toISOString(),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
