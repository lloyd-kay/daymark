import type { Metadata } from "next";
import { SignInPanel } from "./SignInPanel";

export const metadata: Metadata = {
  title: "Staff sign in — Daymark",
  description: "Secure access to the Daymark team workspace.",
};

export default function StaffSignInPage() {
  return (
    <main className="workspace-gate">
      <header>
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </a>
        <span>Team workspace</span>
      </header>
      <SignInPanel />
    </main>
  );
}
