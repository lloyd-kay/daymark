import { ArrowDown, ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { DemoBookingFlow } from "./demo/DemoBookingFlow";
import { HomepageSetupBuilder } from "./home/HomepageSetupBuilder";

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
          <h1 id="product-title" aria-label="Scheduling without shared calendars.">
            <span className="product-title-line title-line-coral" aria-hidden="true">
              <span className="product-title-paper">Scheduling</span>
            </span>
            <span className="product-title-line title-line-lilac" aria-hidden="true">
              <span className="product-title-paper">without shared</span>
            </span>
            <span className="product-title-line title-line-sky" aria-hidden="true">
              <span className="product-title-paper">calendars.</span>
            </span>
          </h1>
          <p className="hero-summary">Let clients choose the right person and a clear time to meet, while every employee’s working calendar remains private to them.</p>
          <div className="hero-actions">
            <a className="hero-action" href="#demo">Try the demonstration <ArrowDown size={16} aria-hidden="true" /></a>
            <a className="quiet-link hero-secondary" href="/get-daymark">Get Daymark <ArrowUpRight size={16} aria-hidden="true" /></a>
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
          <p className="demo-notice"><ShieldCheck size={18} aria-hidden="true" /> Clients choose a service first; Daymark then shows only qualified people. No appointment will be created.</p>
        </div>
        <DemoBookingFlow />
      </div>

      <section className="widget-options" id="widget-options" aria-labelledby="widget-title">
        <div className="widget-heading">
          <p className="eyebrow">Widget options</p><h2 id="widget-title">Place booking where it belongs.</h2>
          <p>Choose the surface that feels native to your site; the private scheduling rules stay the same.</p>
        </div>
        <HomepageSetupBuilder />
        <div className="widget-setup">
          <p>
            The transferred choice sets a starting default. It never prevents your team from generating another layout.
          </p>
          <p className="widget-contact-note">
            <span className="widget-contact-label">Custom fit</span>
            <span>For custom widgets or integrations, <strong>contact us.</strong></span>
          </p>
        </div>
      </section>

      <footer className="site-footer product-footer">
        <p>Daymark keeps private calendars private and appointments clear.</p>
        <div><a href="/get-daymark">Get Daymark</a><a href="/workspace/sign-in">Staff sign in</a></div>
      </footer>
    </main>
  );
}
