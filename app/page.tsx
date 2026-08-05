import { ArrowUpRight, CalendarRange, LockKeyhole } from "lucide-react";
import { BookingFlow } from "./booking/BookingFlow";
import {
  PUBLIC_PROFILE_SEEDS,
  toPublicEmployee,
} from "../lib/data/repository";

const employees = PUBLIC_PROFILE_SEEDS.map((profile) =>
  toPublicEmployee({ ...profile }),
);

export default function Home() {
  return (
    <main className="daymark-site">
      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label="Daymark home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>Daymark</span>
        </a>
        <p className="header-note">
          <LockKeyhole size={14} aria-hidden="true" /> Private by design
        </p>
        <a className="workspace-link" href="/workspace">
          Open team workspace <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">A calmer way to find time together</p>
          <h1>
            Book time with
            <span>the right person.</span>
          </h1>
          <p className="hero-summary">
            Choose a person and a time. You’ll only ever see the moments they’ve
            chosen to make available—the rest of their calendar stays private.
          </p>
          <a className="hero-action" href="#book">
            Find a time <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="hero-stamp" aria-label="Scheduling window: the next two weeks">
          <CalendarRange size={22} aria-hidden="true" />
          <span>Now booking</span>
          <strong>14</strong>
          <small>days ahead</small>
        </div>
      </section>

      <BookingFlow initialEmployees={employees} />

      <footer className="site-footer">
        <p>Daymark keeps calendars private and appointments clear.</p>
        <a href="/workspace">Team sign in</a>
      </footer>
    </main>
  );
}
