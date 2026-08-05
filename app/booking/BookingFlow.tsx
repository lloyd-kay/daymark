"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FormEvent, forwardRef, useMemo, useRef, useState } from "react";
import {
  isBookingConflict,
  type BookingTransport,
} from "../../lib/booking/transport";
import type { PublicEmployee } from "../../lib/data/contracts";
import type { BookableSlot } from "../../lib/scheduling/types";

type BookingStep = "person" | "date" | "time" | "details" | "confirmed";

type BookingDraft = {
  employee: PublicEmployee | null;
  dateKey: string | null;
  slot: BookableSlot | null;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  clientNote: string;
};

type Confirmation = {
  reference: string;
  employeeName: string;
  startAt: string;
  endAt: string;
  address: string;
  contactSummary: string;
};

const STEP_LABELS: Array<{ step: Exclude<BookingStep, "confirmed">; label: string }> = [
  { step: "person", label: "Person" },
  { step: "date", label: "Date" },
  { step: "time", label: "Time" },
  { step: "details", label: "Details" },
];

export function BookingFlow({
  initialEmployees,
  transport,
  initialEmployeeId,
  embedded = false,
  demonstration = false,
}: {
  initialEmployees: PublicEmployee[];
  transport: BookingTransport;
  initialEmployeeId?: string;
  embedded?: boolean;
  demonstration?: boolean;
}) {
  const [step, setStep] = useState<BookingStep>("person");
  const [draft, setDraft] = useState<BookingDraft>({
    employee: null,
    dateKey: null,
    slot: null,
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    clientNote: "",
  });
  const [dateKeys, setDateKeys] = useState<string[]>(() => nextDateKeys(14));
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stageHeading = useRef<HTMLHeadingElement>(null);

  const selectedDate = draft.dateKey ?? dateKeys[0] ?? todayKey();
  const slotsForDate = useMemo(
    () => slots.filter((slot) => slot.dateKey === selectedDate),
    [selectedDate, slots],
  );
  const dateParts = formatDateParts(selectedDate);
  const currentStep = step === "confirmed" ? 4 : STEP_LABELS.findIndex((item) => item.step === step);
  const displayedEmployees = initialEmployeeId
    ? initialEmployees.filter((employee) => employee.id === initialEmployeeId)
    : initialEmployees;

  async function chooseEmployee(employee: PublicEmployee) {
    setDraft((current) => ({
      ...current,
      employee,
      dateKey: null,
      slot: null,
    }));
    setStep("date");
    setError("");
    setLoading(true);
    try {
      const payload = await transport.loadSlots(employee.id, todayKey());
      const keys = payload.dateKeys.length ? payload.dateKeys : nextDateKeys(14);
      setDateKeys(keys);
      setSlots(payload.slots ?? []);
      setDraft((current) => ({ ...current, dateKey: keys[0] ?? null }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Availability could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
      focusStage();
    }
  }

  function chooseDate(dateKey: string) {
    setDraft((current) => ({ ...current, dateKey, slot: null }));
    setStep("time");
    setError("");
    focusStage();
  }

  function chooseSlot(slot: BookableSlot) {
    setDraft((current) => ({ ...current, slot }));
    setStep("details");
    setError("");
    focusStage();
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.employee || !draft.slot) return;
    setLoading(true);
    setError("");
    try {
      const booking = await transport.createBooking({
        employeeId: draft.employee.id,
        startAt: draft.slot.startAt,
        clientName: draft.clientName,
        clientAddress: draft.clientAddress,
        clientEmail: draft.clientEmail || null,
        clientPhone: draft.clientPhone || null,
        clientNote: draft.clientNote,
      });
      setConfirmation(booking);
      setStep("confirmed");
    } catch (caught) {
      if (isBookingConflict(caught)) {
        const refreshed = await recoverBookingConflict(
          transport,
          draft.employee.id,
          todayKey(),
        ).catch(() => null);
        if (refreshed) {
          setDateKeys(refreshed.dateKeys);
          setSlots(refreshed.slots);
          setDraft((current) => ({ ...current, slot: refreshed.slot }));
          setStep(refreshed.nextStep);
        } else {
          setDraft((current) => ({ ...current, slot: null }));
          setStep("time");
        }
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "The booking could not be completed. Please try again.",
      );
    } finally {
      setLoading(false);
      focusStage();
    }
  }

  function goBack() {
    const previous: Partial<Record<BookingStep, BookingStep>> = {
      date: "person",
      time: "date",
      details: "time",
    };
    const target = previous[step];
    if (target) {
      setStep(target);
      setError("");
      focusStage();
    }
  }

  function reset() {
    setStep("person");
    setDraft({
      employee: null,
      dateKey: null,
      slot: null,
      clientName: "",
      clientAddress: "",
      clientEmail: "",
      clientPhone: "",
      clientNote: "",
    });
    setConfirmation(null);
    setError("");
    setSlots([]);
    focusStage();
  }

  function focusStage() {
    window.setTimeout(() => stageHeading.current?.focus(), 0);
  }

  return (
    <section className={embedded ? "booking-studio is-embedded" : "booking-studio"} id="book" aria-labelledby="booking-title">
      <aside className="daymark-rail" aria-label={`Active date: ${dateParts.full}`}>
        <span className="rail-kicker">Daymark</span>
        <strong>{dateParts.day}</strong>
        <span className="rail-month">{dateParts.month}</span>
        <span className="rail-year">{dateParts.year}</span>
        <span className="rail-line" aria-hidden="true" />
        <small>Europe / London</small>
      </aside>

      <div className="booking-workbench">
        <div className="booking-toolbar">
          <div>
            <p className="eyebrow">Make an appointment</p>
            <h2 id="booking-title">A clear path to a good conversation.</h2>
          </div>
          <ol className="step-track" aria-label="Booking progress">
            {STEP_LABELS.map((item, index) => (
              <li key={item.step} className={index <= currentStep ? "is-reached" : ""}>
                <span>{index < currentStep ? <Check size={12} /> : index + 1}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </div>

        {step !== "person" && step !== "confirmed" && draft.employee ? (
          <div className="selection-slip" data-accent={draft.employee.accent}>
            <span className="avatar-stamp" aria-hidden="true">
              {initials(draft.employee.publicName)}
            </span>
            <div>
              <small>You’re booking with</small>
              <strong>{draft.employee.publicName}</strong>
            </div>
            {draft.dateKey ? <span>{formatShortDate(draft.dateKey)}</span> : null}
            {draft.slot ? <span>{formatTime(draft.slot.startAt)}</span> : null}
          </div>
        ) : null}

        <div className="booking-stage">
          {step === "person" ? (
            <>
              <StageTitle
                ref={stageHeading}
                overline="01 / Pick a person"
                title="Who would you like to meet?"
                note="Each person controls their own availability. No one else on the team can see it."
              />
              <div className="people-list">
                {displayedEmployees.map((employee, index) => (
                  <button
                    className="person-tab"
                    data-accent={employee.accent}
                    key={employee.id}
                    onClick={() => chooseEmployee(employee)}
                    type="button"
                  >
                    <span className="person-index">0{index + 1}</span>
                    <span className="avatar-stamp" aria-hidden="true">
                      {initials(employee.publicName)}
                    </span>
                    <span className="person-copy">
                      <strong>{employee.publicName}</strong>
                      <small>{employee.title}</small>
                      <span>{employee.bio}</span>
                    </span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === "date" ? (
            <>
              <StageTitle
                ref={stageHeading}
                overline="02 / Choose a date"
                title="Which day suits you?"
                note="We show only days inside the next two weeks."
              />
              {loading ? <LoadingNote label="Gathering private availability…" /> : null}
              {!loading ? (
                <div className="date-strip" role="list" aria-label="Available dates">
                  {dateKeys.map((dateKey) => {
                    const parts = formatDateParts(dateKey);
                    const available = slots.some((slot) => slot.dateKey === dateKey);
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className="date-card"
                        disabled={!available}
                        onClick={() => chooseDate(dateKey)}
                        aria-label={`${parts.full}${available ? "" : ", no availability"}`}
                      >
                        <small>{parts.weekday}</small>
                        <strong>{parts.day}</strong>
                        <span>{parts.monthShort}</span>
                        <i aria-hidden="true">{available ? "open" : "—"}</i>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {!loading && slots.length === 0 && !error ? (
                <EmptyNote text="No times are open in this window. Choose another person to see their availability." />
              ) : null}
            </>
          ) : null}

          {step === "time" ? (
            <>
              <StageTitle
                ref={stageHeading}
                overline="03 / Choose a time"
                title={`Open moments on ${formatShortDate(selectedDate)}`}
                note="Times are shown in Europe/London. Busy periods and calendar details stay hidden."
              />
              {slotsForDate.length > 0 ? (
                <div className="time-tabs">
                  {slotsForDate.map((slot) => (
                    <button type="button" key={slot.startAt} onClick={() => chooseSlot(slot)}>
                      <Clock3 size={16} aria-hidden="true" />
                      <strong>{formatTime(slot.startAt)}</strong>
                      <span>30 min</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyNote text="That day has no remaining slots. Return to the date list and choose another." />
              )}
            </>
          ) : null}

          {step === "details" ? (
            <>
              <StageTitle
                ref={stageHeading}
                overline="04 / Your details"
                title="Where should we send the booking details?"
                note="Your information is visible only to the person you book and a Daymark administrator."
              />
              <form className="details-form" onSubmit={submitBooking}>
                <label>
                  <span>Your name</span>
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                    value={draft.clientName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientName: event.target.value }))
                    }
                    placeholder="e.g. Alex Morgan"
                  />
                </label>
                <label className="form-wide">
                  <span>Appointment address</span>
                  <input
                    name="address"
                    autoComplete="street-address"
                    required
                    maxLength={240}
                    value={draft.clientAddress}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientAddress: event.target.value }))
                    }
                    placeholder="14 Example Street, London, N1 1AA"
                  />
                </label>
                <p className="form-wide contact-help" id="contact-help">
                  Add an email address or phone number so we can contact you about this appointment.
                </p>
                <label>
                  <span>Email address <small>Optional</small></span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    aria-describedby="contact-help"
                    value={draft.clientEmail}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientEmail: event.target.value }))
                    }
                    placeholder="alex@example.com"
                  />
                </label>
                <label>
                  <span>Phone number <small>Optional</small></span>
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={25}
                    aria-describedby="contact-help"
                    value={draft.clientPhone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientPhone: event.target.value }))
                    }
                    placeholder="+44 20 7946 0000"
                  />
                </label>
                <label className="form-wide">
                  <span>Anything useful to know? <small>Optional</small></span>
                  <textarea
                    name="note"
                    rows={4}
                    maxLength={500}
                    value={draft.clientNote}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientNote: event.target.value }))
                    }
                    placeholder="A short note about what you’d like to discuss."
                  />
                </label>
                <button className="confirm-button" type="submit" disabled={loading}>
                  {loading ? "Holding your time…" : demonstration ? "Complete demonstration" : "Confirm appointment"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
            </>
          ) : null}

          {step === "confirmed" && confirmation ? (
            <div className="confirmation-card">
              <CheckCircle2 size={34} aria-hidden="true" />
              <p className="eyebrow">Appointment confirmed</p>
              <h3 ref={stageHeading} tabIndex={-1}>Your time is marked.</h3>
              <p>
                You’re meeting <strong>{confirmation.employeeName}</strong> on{" "}
                <strong>{formatFullDateTime(confirmation.startAt)}</strong>.
              </p>
              <p>{confirmation.address} · {confirmation.contactSummary}</p>
              <div className="reference-slip">
                <small>Booking reference</small>
                <strong>{confirmation.reference}</strong>
              </div>
              <button type="button" onClick={reset}>
                <RotateCcw size={16} aria-hidden="true" /> Book another time
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="booking-error" role="status" aria-live="polite">
              {error}
            </p>
          ) : (
            <span className="sr-only" aria-live="polite">
              {loading ? "Loading" : ""}
            </span>
          )}

          {step !== "person" && step !== "confirmed" ? (
            <button className="back-button" type="button" onClick={goBack}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : null}
        </div>
      </div>

      <aside className="privacy-note">
        <div className="note-pin" aria-hidden="true" />
        <ShieldCheck size={24} aria-hidden="true" />
        <p className="eyebrow">The quiet part</p>
        <h3>Your details stay private.</h3>
        <p>
          You see bookable moments—not someone’s calendar. Other employees can’t see
          this appointment, and records disappear 30 days after it ends.
        </p>
        <ul>
          <li><LockKeyhole size={14} /> No free/busy calendar</li>
          <li><UserRound size={14} /> Only your chosen person</li>
          <li><Clock3 size={14} /> 30-day retention</li>
        </ul>
      </aside>
    </section>
  );
}

export async function recoverBookingConflict(
  transport: BookingTransport,
  employeeId: string,
  from: string,
): Promise<{
  dateKeys: string[];
  slots: BookableSlot[];
  nextStep: "time";
  slot: null;
}> {
  const availability = await transport.loadSlots(employeeId, from);
  return {
    ...availability,
    nextStep: "time",
    slot: null,
  };
}

const StageTitle = forwardRef<
  HTMLHeadingElement,
  { overline: string; title: string; note: string }
>(function StageTitle({ overline, title, note }, ref) {
  return (
    <div className="stage-title">
      <p>{overline}</p>
      <h3 ref={ref} tabIndex={-1}>{title}</h3>
      <span>{note}</span>
    </div>
  );
});

function LoadingNote({ label }: { label: string }) {
  return (
    <div className="loading-note" role="status">
      <span aria-hidden="true" /> {label}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="empty-note">{text}</p>;
}

function nextDateKeys(count: number): string[] {
  const start = Date.parse(`${todayKey()}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDateParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const long = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    day: new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date),
    weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date),
    month: new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date),
    monthShort: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
    year: new Intl.DateTimeFormat("en-GB", { year: "numeric" }).format(date),
    full: long.format(date),
  };
}

function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
