"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { SetupProfile } from "../../lib/setup-profile";

export function SetupProfileConfirmation({
  profile,
  busy,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  profile: SetupProfile;
  busy: boolean;
  confirmDisabled?: boolean;
  onConfirm(): void;
  onCancel(): void;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [busy, onCancel]);

  return (
    <section className="setup-profile-confirmation" aria-labelledby="setup-profile-confirmation-title">
      <p className="eyebrow">Review before importing</p>
      <h1 id="setup-profile-confirmation-title" ref={heading} tabIndex={-1}>
        Import this setup?
      </h1>
      <dl className="setup-profile-summary">
        <div>
          <dt>Booking journey</dt>
          <dd>Full service catalogue</dd>
        </div>
        <div>
          <dt>Default layout</dt>
          <dd>{profile.layout === "inline" ? "Inline widget" : "Floating widget"}</dd>
        </div>
      </dl>
      {children}
      <div className="setup-profile-actions">
        <button
          className="workspace-primary"
          type="button"
          disabled={busy || confirmDisabled}
          onClick={onConfirm}
        >
          {busy ? "Importing…" : "Import setup"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}
