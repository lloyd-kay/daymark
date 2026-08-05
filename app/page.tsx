import { ArrowDown, ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { DemoBookingFlow } from "./demo/DemoBookingFlow";

const privacyPromises = [
  { number: "01", title: "Discrete slots only", copy: "Clients choose from the times a person offers. They never see the calendar behind them." },
  { number: "02", title: "Employee-isolated workspaces", copy: "Each employee works from their own private schedule, without browsing anyone else’s appointments." },
  { number: "03", title: "Administrator oversight", copy: "Administrators can keep the team organised while personal calendars stay exactly that—personal." },
];

export default function Home() {
  return (
    <main className="daymark-site product-home" id="top">
      <header className="site-header product-header">
        <a className="brand-lockup" href="#top" aria-label="Daymark home">
          <span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span>
        </a>
        <nav className="product-nav" aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#widget-options">Widget options</a>
          <a href="/workspace/sign-in">Staff sign in</a>
        </nav>
      </header>

      <section className="hero product-hero" aria-labelledby="product-title">
        <div className="hero-copy">
          <p className="eyebrow">Private team scheduling</p>
          <h1 id="product-title">Scheduling without shared calendars</h1>
          <p className="hero-summary">Let clients choose the right person and a clear time to meet, while every employee’s working calendar remains private to them.</p>
          <div className="hero-actions">
            <a className="hero-action" href="#demo">Try the demonstration <ArrowDown size={16} aria-hidden="true" /></a>
            <a className="quiet-link hero-secondary" href="/book">Start real booking <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
        <aside className="hero-stamp product-stamp" aria-label="Daymark privacy promise">
          <LockKeyhole size={22} aria-hidden="true" /><span>Private by design</span><strong>1:1</strong><small>calendar visibility</small>
        </aside>
      </section>

      <section className="privacy-promises" id="how-it-works" aria-labelledby="privacy-title">
        <div className="section-intro">
          <p className="eyebrow">How it works</p>
          <h2 id="privacy-title">A booking page that reveals only what matters.</h2>
        </div>
        <ol>
          {privacyPromises.map((promise) => (
            <li key={promise.number} className="privacy-tab">
              <span>{promise.number}</span><div><h3>{promise.title}</h3><p>{promise.copy}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <div className="demo-section" id="demo">
        <div className="demo-heading">
          <div><p className="eyebrow">A safe place to try it</p><h2 id="demo-title">Interactive demonstration</h2></div>
          <p className="demo-notice"><ShieldCheck size={18} aria-hidden="true" /> No appointment will be created.</p>
        </div>
        <DemoBookingFlow />
      </div>

      <section className="widget-options" id="widget-options" aria-labelledby="widget-title">
        <div className="widget-heading">
          <p className="eyebrow">Widget options</p><h2 id="widget-title">Place booking where it belongs.</h2>
          <p>Choose the surface that feels native to your site; the private scheduling rules stay the same.</p>
        </div>
        <div className="widget-grid">
          <article className="widget-card launcher-card">
            <span className="widget-index">Option 01</span><div className="launcher-preview" aria-hidden="true"><span>Book a time</span><ArrowUpRight size={18} /></div>
            <h3>Floating widget</h3><p>A compact launcher anchored to the lower corner of your pages.</p>
          </article>
          <article className="widget-card panel-card">
            <span className="widget-index">Option 02</span>
            <div className="panel-preview" aria-hidden="true"><span>Daymark</span><i /><strong>Choose a time</strong><small>Private availability, clearly shared.</small></div>
            <h3>Inline panel</h3><p>A complete booking panel placed directly inside a contact or service page.</p>
          </article>
        </div>
        <p className="widget-setup">Use the embed position that suits your layout, then <a href="/workspace/sign-in">sign in to the staff workspace</a> to set it up.</p>
      </section>

      <footer className="site-footer product-footer">
        <p>Daymark keeps private calendars private and appointments clear.</p>
        <div><a href="/book">Start real booking</a><a href="/workspace/sign-in">Staff sign in</a></div>
      </footer>
    </main>
  );
}
