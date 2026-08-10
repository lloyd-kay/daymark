export type TimeRange = {
  startAt: string;
  endAt: string;
};

export type AvailabilityRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  bufferMinutes: number;
};

export type SlotSearchInput = {
  dateKeys: string[];
  now: Date;
  rules: AvailabilityRule[];
  busy: TimeRange[];
  durationMinutes: number;
  zone: "Europe/London";
};

export type BookableSlot = {
  dateKey: string;
  startAt: string;
  endAt: string;
};
