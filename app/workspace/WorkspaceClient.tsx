"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Code2,
  Eye,
  LockKeyhole,
  LogOut,
  Plus,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { WorkspaceActor } from "../../lib/auth/membership";
import type {
  EmployeeAvailability,
  ScheduleEntry,
  TeamProfile,
  WorkspaceService,
} from "../../lib/data/contracts";
import { EmbedPanel } from "./EmbedPanel";
import { ServicesPanel } from "./ServicesPanel";
import { TeamAccessPanel } from "./TeamAccessPanel";

type WorkspaceView = "schedule" | "availability" | "team" | "services" | "embed";

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

export function WorkspaceClient({
  actor,
  profiles: initialProfiles,
  initialServices,
  initialEntries,
  initialAvailability,
  initialRange,
  nowIso,
}: {
  actor: WorkspaceActor;
  profiles: TeamProfile[];
  initialServices: WorkspaceService[];
  initialEntries: ScheduleEntry[];
  initialAvailability: EmployeeAvailability | null;
  initialRange: { from: string; to: string };
  nowIso: string;
}) {
  const [view, setView] = useState<WorkspaceView>("schedule");
  const [profiles, setProfiles] = useState(initialProfiles);
  const [entries, setEntries] = useState(initialEntries);
  const [range, setRange] = useState(initialRange);
  const [scheduleFilter, setScheduleFilter] = useState(
    actor.role === "admin" ? "all" : actor.employeeProfileId ?? "",
  );
  const [selectedProfileId, setSelectedProfileId] = useState(
    actor.employeeProfileId ?? initialProfiles.find((profile) => profile.active)?.id ?? "",
  );
  const [availability, setAvailability] = useState(initialAvailability);
  const initialRule = initialAvailability?.rules[0];
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>(
    initialAvailability?.rules.map((rule) => rule.weekday) ?? [1, 2, 3, 4, 5],
  );
  const [startTime, setStartTime] = useState(
    minutesToTime(initialRule?.startMinute ?? 9 * 60),
  );
  const [endTime, setEndTime] = useState(
    minutesToTime(initialRule?.endMinute ?? 17 * 60),
  );
  const [slotMinutes, setSlotMinutes] = useState(initialRule?.slotMinutes ?? 30);
  const [bufferMinutes, setBufferMinutes] = useState(initialRule?.bufferMinutes ?? 10);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockNote, setBlockNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const workspaceQuery = `workspace=${encodeURIComponent(actor.workspaceSlug)}`;

  const dateKeys = useMemo(() => rangeDateKeys(range.from, 7), [range.from]);
  const today = londonDateKey(new Date());
  const nextAppointment = entries.find(
    (entry) => entry.status === "booked" && Date.parse(entry.startAt) > Date.parse(nowIso),
  );

  async function changeWeek(direction: -1 | 1) {
    const nextStart = new Date(Date.parse(range.from) + direction * 7 * 86_400_000);
    const nextRange = {
      from: nextStart.toISOString(),
      to: new Date(nextStart.getTime() + 7 * 86_400_000).toISOString(),
    };
    setRange(nextRange);
    await loadSchedule(nextRange, scheduleFilter);
  }

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  async function changeScheduleFilter(employeeId: string) {
    setScheduleFilter(employeeId);
    if (employeeId !== "all") setSelectedProfileId(employeeId);
    await loadSchedule(range, employeeId);
  }

  async function loadSchedule(
    nextRange: { from: string; to: string },
    employeeId: string,
  ) {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ workspace: actor.workspaceSlug, from: nextRange.from, to: nextRange.to });
      if (employeeId && employeeId !== "all") query.set("employeeId", employeeId);
      const response = await fetch(`/api/workspace/schedule?${query}`, { cache: "no-store" });
      const body = (await response.json()) as { entries?: ScheduleEntry[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "The schedule could not be loaded.");
      setEntries(body.entries ?? []);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The schedule could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(entry: ScheduleEntry) {
    if (!window.confirm(`Cancel ${entry.clientName}’s appointment?`)) return;
    setLoading(true);
    const response = await fetch(`/api/workspace/schedule?${workspaceQuery}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: entry.id, confirm: true }),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status: "cancelled" } : item,
        ),
      );
      setMessage("Appointment cancelled.");
    } else {
      setMessage(body.error ?? "The appointment could not be cancelled.");
    }
    setLoading(false);
  }

  async function openAvailability(employeeId: string) {
    setSelectedProfileId(employeeId);
    setView("availability");
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/workspace/availability?${workspaceQuery}&employeeId=${encodeURIComponent(employeeId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        availability?: EmployeeAvailability;
        error?: string;
      };
      if (!response.ok || !body.availability) {
        throw new Error(body.error ?? "Availability could not be loaded.");
      }
      applyAvailability(body.availability);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Availability could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function applyAvailability(next: EmployeeAvailability) {
    setAvailability(next);
    setActiveWeekdays(next.rules.map((rule) => rule.weekday));
    const first = next.rules[0];
    if (first) {
      setStartTime(minutesToTime(first.startMinute));
      setEndTime(minutesToTime(first.endMinute));
      setSlotMinutes(first.slotMinutes);
      setBufferMinutes(first.bufferMinutes);
    }
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setLoading(true);
    setMessage("");
    const rules = activeWeekdays.map((weekday) => ({
      weekday,
      startMinute: timeToMinutes(startTime),
      endMinute: timeToMinutes(endTime),
      slotMinutes,
      bufferMinutes,
    }));
    const response = await fetch(`/api/workspace/availability?${workspaceQuery}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedProfileId, rules }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Availability updated." : body.error ?? "Availability could not be updated.");
    if (response.ok && availability) setAvailability({ ...availability, rules });
    setLoading(false);
  }

  async function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId || !blockStart || !blockEnd) return;
    setLoading(true);
    const response = await fetch(`/api/workspace/availability?${workspaceQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: selectedProfileId,
        startAt: new Date(blockStart).toISOString(),
        endAt: new Date(blockEnd).toISOString(),
        note: blockNote,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) {
      setMessage("Time blocked.");
      setBlockStart("");
      setBlockEnd("");
      setBlockNote("");
      await openAvailability(selectedProfileId);
    } else {
      setMessage(body.error ?? "That time could not be blocked.");
    }
    setLoading(false);
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </a>
        <nav aria-label="Workspace sections">
          <button className={view === "schedule" ? "is-active" : ""} onClick={() => setView("schedule")}>
            <CalendarDays size={16} /> Schedule
          </button>
          <button
            className={view === "availability" ? "is-active" : ""}
            onClick={() => selectedProfileId && openAvailability(selectedProfileId)}
          >
            <Settings2 size={16} /> Availability
          </button>
          {actor.role === "admin" ? (
            <>
              <button className={view === "team" ? "is-active" : ""} onClick={() => setView("team")}>
                <UsersRound size={16} /> Team
              </button>
              <button className={view === "services" ? "is-active" : ""} onClick={() => setView("services")}>
                <Wrench size={16} /> Services
              </button>
              <button className={view === "embed" ? "is-active" : ""} onClick={() => setView("embed")}>
                <Code2 size={16} /> Embed
              </button>
            </>
          ) : null}
        </nav>
        <div className="workspace-user">
          <div>
            <small>{actor.role}</small>
            <strong>{actor.displayName}</strong>
          </div>
          <button type="button" onClick={signOut} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="workspace-main">
        <aside className="workspace-sidebar">
          <p className="eyebrow">Private desk</p>
          <h1>{actor.role === "admin" ? "Team view" : "My week"}</h1>
          <p>
            {actor.role === "admin"
              ? "You can coordinate every calendar and booking."
              : "Only you and an administrator can see this schedule."}
          </p>
          <div className="privacy-seal">
            {actor.role === "admin" ? <Eye size={19} /> : <LockKeyhole size={19} />}
            <span>{actor.role === "admin" ? "Full team visibility" : "Employee-isolated"}</span>
          </div>
          {actor.role === "admin" ? (
            <div className="sidebar-roster">
              <small>Calendar filter</small>
              <button
                className={scheduleFilter === "all" ? "is-selected" : ""}
                onClick={() => changeScheduleFilter("all")}
              >
                <span className="roster-dot roster-all" /> Everyone
              </button>
              {profiles.filter((profile) => profile.active).map((profile) => (
                <button
                  key={profile.id}
                  className={scheduleFilter === profile.id ? "is-selected" : ""}
                  onClick={() => changeScheduleFilter(profile.id)}
                >
                  <span className="roster-dot" data-accent={profile.accent} />
                  {profile.publicName}
                </button>
              ))}
            </div>
          ) : null}
          <a className="quiet-link" href="/">
            <ArrowLeft size={14} /> Public booking page
          </a>
        </aside>

        <section className="workspace-content">
          {message ? <p className="workspace-message" role="status">{message}</p> : null}
          {loading ? <span className="workspace-loading" role="status">Updating Daymark…</span> : null}

          {view === "schedule" ? (
            <>
              <div className="week-toolbar">
                <div>
                  <p className="eyebrow">Seven-day ledger</p>
                  <h2>{formatWeekRange(dateKeys)}</h2>
                </div>
                <div>
                  <button onClick={() => changeWeek(-1)} aria-label="Previous week"><ArrowLeft size={17} /></button>
                  <button onClick={() => changeWeek(1)} aria-label="Next week"><ArrowRight size={17} /></button>
                </div>
              </div>

              <div className="workspace-board">
                <div className="workspace-date-rail">
                  <small>{formatMonth(dateKeys[0])}</small>
                  <strong>{formatDay(dateKeys[0])}</strong>
                  <span>—</span>
                  <strong>{formatDay(dateKeys[6])}</strong>
                  <i>{new Date(`${dateKeys[0]}T12:00:00Z`).getUTCFullYear()}</i>
                </div>
                <div className="agenda-grid">
                  {dateKeys.map((dateKey) => {
                    const dayEntries = entries.filter(
                      (entry) => londonDateKey(new Date(entry.startAt)) === dateKey,
                    );
                    return (
                      <section className={dateKey === today ? "agenda-day is-today" : "agenda-day"} key={dateKey}>
                        <header>
                          <small>{formatWeekday(dateKey)}</small>
                          <strong>{formatDay(dateKey)}</strong>
                          {dateKey === today ? <span>Today</span> : null}
                        </header>
                        <div className="agenda-stack">
                          {dayEntries.length === 0 ? (
                            <p className="agenda-empty">No appointments</p>
                          ) : (
                            dayEntries.map((entry) => (
                              <article
                                key={entry.id}
                                className={entry.status === "cancelled" ? "appointment-tab is-cancelled" : "appointment-tab"}
                                data-accent={entry.accent}
                              >
                                <time>{formatTime(entry.startAt)}</time>
                                {actor.role === "admin" ? <small>{entry.employeeName}</small> : null}
                                <small className="appointment-service">
                                  {entry.serviceName} · {formatDuration(entry.serviceDurationMinutes)}
                                </small>
                                <strong>{entry.clientName}</strong>
                                <span>{entry.clientAddress}</span>
                                {entry.clientEmail ? <span>{entry.clientEmail}</span> : null}
                                {entry.clientPhone ? <span>{entry.clientPhone}</span> : null}
                                {entry.clientNote ? <p>{entry.clientNote}</p> : null}
                                {entry.status === "booked" ? (
                                  <button onClick={() => cancel(entry)} aria-label={`Cancel appointment with ${entry.clientName}`}>
                                    <X size={13} /> Cancel
                                  </button>
                                ) : (
                                  <em>Cancelled</em>
                                )}
                              </article>
                            ))
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>

              <div className="week-footnotes">
                <div>
                  <Clock3 size={18} />
                  <span>Next appointment</span>
                  <strong>
                    {nextAppointment
                      ? `${formatFullDate(nextAppointment.startAt)} · ${nextAppointment.clientName}`
                      : "Nothing scheduled yet"}
                  </strong>
                </div>
                <div>
                  <ShieldCheck size={18} />
                  <span>Retention</span>
                  <strong>Records disappear after 30 days</strong>
                </div>
              </div>
            </>
          ) : null}

          {view === "availability" ? (
            <div className="settings-layout">
              <div className="settings-primary">
                <p className="eyebrow">Availability pattern</p>
                <h2>Mark the time you want to offer.</h2>
                {actor.role === "admin" ? (
                  <label className="profile-select">
                    <span>Editing</span>
                    <select value={selectedProfileId} onChange={(event) => openAvailability(event.target.value)}>
                      {profiles.filter((profile) => profile.active).map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.publicName}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <form className="availability-form" onSubmit={saveAvailability}>
                  <fieldset>
                    <legend>Working days</legend>
                    <div className="weekday-pills">
                      {WEEKDAYS.map(([value, label]) => (
                        <label key={value}>
                          <input
                            type="checkbox"
                            checked={activeWeekdays.includes(value)}
                            onChange={(event) =>
                              setActiveWeekdays((current) =>
                                event.target.checked
                                  ? [...current, value]
                                  : current.filter((day) => day !== value),
                              )
                            }
                          />
                          <span>{activeWeekdays.includes(value) ? <Check size={13} /> : null}{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="availability-fields">
                    <label><span>From</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
                    <label><span>Until</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
                    <label>
                      <span>Appointment</span>
                      <select value={slotMinutes} onChange={(event) => setSlotMinutes(Number(event.target.value))}>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </label>
                    <label>
                      <span>Buffer</span>
                      <select value={bufferMinutes} onChange={(event) => setBufferMinutes(Number(event.target.value))}>
                        <option value={0}>No buffer</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </label>
                  </div>
                  <button className="workspace-primary" type="submit" disabled={loading}>
                    Save availability <ArrowRight size={17} />
                  </button>
                </form>
              </div>

              <aside className="block-panel">
                <p className="eyebrow">One-off block</p>
                <h3>Keep a moment to yourself.</h3>
                <form onSubmit={addBlock}>
                  <label><span>Starts</span><input type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></label>
                  <label><span>Ends</span><input type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required /></label>
                  <label><span>Private note</span><input value={blockNote} maxLength={160} onChange={(event) => setBlockNote(event.target.value)} placeholder="e.g. Focus time" /></label>
                  <button type="submit" disabled={loading}><Plus size={15} /> Block this time</button>
                </form>
                <div className="blocked-list">
                  <small>Upcoming blocks</small>
                  {availability?.blocked.length ? availability.blocked.slice(0, 5).map((block) => (
                    <span key={block.id}><strong>{formatFullDate(block.startAt)}</strong>{block.note || "Unavailable"}</span>
                  )) : <p>No one-off blocks.</p>}
                </div>
              </aside>
            </div>
          ) : null}

          {view === "team" && actor.role === "admin" ? (
            <TeamAccessPanel workspaceSlug={actor.workspaceSlug} profiles={profiles} onProfilesChange={setProfiles} />
          ) : null}

          {view === "services" && actor.role === "admin" ? (
            <ServicesPanel workspaceSlug={actor.workspaceSlug} profiles={profiles} initialServices={initialServices} />
          ) : null}

          {view === "embed" && actor.role === "admin" ? (
            <EmbedPanel workspaceSlug={actor.workspaceSlug} profiles={profiles} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function rangeDateKeys(from: string, count: number): string[] {
  const start = Date.parse(from);
  return Array.from({ length: count }, (_, index) =>
    londonDateKey(new Date(start + index * 86_400_000)),
  );
}

function londonDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00.000Z`);
}

function formatDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(dateFromKey(key));
}

function formatMonth(key: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(dateFromKey(key));
}

function formatWeekday(key: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(dateFromKey(key));
}

function formatWeekRange(keys: string[]) {
  const first = dateFromKey(keys[0]);
  const last = dateFromKey(keys.at(-1) ?? keys[0]);
  return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(first)} — ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(last)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
