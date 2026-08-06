import type { Metadata } from "next";
import { ArrowLeft, Code2, HardDrive, ServerCog } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get Daymark",
  description: "Choose a private Daymark setup for your company.",
};

export default function GetDaymarkPage() {
  return (
    <main className="daymark-site get-daymark-page">
      <header className="site-header product-header">
        <Link className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></Link>
        <Link className="quiet-link" href="/"><ArrowLeft size={14} /> Back to the demonstration</Link>
      </header>

      <section className="get-daymark-intro">
        <p className="eyebrow">Choose your setup</p>
        <h1>Choose how Daymark runs.</h1>
        <p>Keep the booking experience the same while choosing who operates the service behind it.</p>
      </section>

      <section className="get-daymark-options" aria-label="Daymark setup options">
        <article className="get-option get-option-self-hosted">
          <span className="get-option-tab">Available first</span>
          <HardDrive size={30} aria-hidden="true" />
          <p className="eyebrow">Your infrastructure</p>
          <h2>Self-hosted</h2>
          <p>Run Daymark locally or on infrastructure you control, with the full company-isolation and private booking model included.</p>
          <ul>
            <li>Company-scoped staff and booking links</li>
            <li>Private invitation-only employee access</li>
            <li>Your database, backups, and operating policies</li>
          </ul>
          <a
            className="get-option-action"
            href="https://github.com/lloyd-kay/daymark"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={17} /> View public repository
          </a>
        </article>

        <article className="get-option get-option-hosted">
          <span className="get-option-tab">Coming soon</span>
          <ServerCog size={30} aria-hidden="true" />
          <p className="eyebrow">Managed for you</p>
          <h2>Daymark Hosted</h2>
          <p>A managed service for teams who want Daymark operated, maintained, and updated for them.</p>
          <div className="hosted-enquiry-note">
            <strong>Interested in early access or joining the trial programme?</strong>
            <span>We are preparing the first managed spaces now.</span>
          </div>
          <button className="get-option-action" type="button" disabled>Enquiries opening soon</button>
        </article>
      </section>
    </main>
  );
}
