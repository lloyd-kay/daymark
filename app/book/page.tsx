import Link from "next/link";

export default function BookPage() {
  return (
    <main className="workspace-gate booking-link-gate">
      <header>
        <Link className="brand-lockup" href="/"><span className="brand-mark" aria-hidden="true"><span /></span><span>Daymark</span></Link>
        <span>Company booking</span>
      </header>
      <section className="auth-card">
        <p className="eyebrow">A company link is required</p>
        <h1>Use the booking link supplied by the company.</h1>
        <p>Every Daymark booking page is privately scoped to one company. Ask the company for its booking link, or open its widget on its own website.</p>
        <Link className="workspace-primary" href="/">Return to Daymark →</Link>
      </section>
    </main>
  );
}
