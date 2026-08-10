"use client";

import { Copy, ExternalLink, Laptop } from "lucide-react";
import { useState } from "react";
import {
  buildSetupProfileUri,
  encodeSetupProfile,
} from "../../lib/setup-profile";
import {
  WidgetOptionsShowcase,
  type WidgetPlacement,
} from "./WidgetOptionsShowcase";

export function HomepageSetupBuilder() {
  const [selected, setSelected] = useState<WidgetPlacement>("floating");
  const [codeVisible, setCodeVisible] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const code = encodeSetupProfile(selected);
  const appLink = buildSetupProfileUri(code);
  const layoutLabel = selected === "floating" ? "Floating widget" : "Inline widget";

  function chooseLayout(placement: WidgetPlacement) {
    setSelected(placement);
    setCopyMessage("");
  }

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      setCopyMessage("Setup code copied.");
    } catch {
      setCopyMessage("Copy unavailable. Select the code and copy it manually.");
    }
  }

  return (
    <section className="homepage-setup-builder" aria-labelledby="homepage-setup-title">
      <WidgetOptionsShowcase selected={selected} onSelect={chooseLayout} />

      <div className="homepage-setup-card">
        <div>
          <p className="eyebrow">Ready for installation</p>
          <h3 id="homepage-setup-title">Your Daymark setup</h3>
          <p className="homepage-setup-summary">
            <strong>Full service catalogue</strong>
            <span aria-hidden="true"> · </span>
            <strong>{layoutLabel}</strong>
          </p>
          <p>
            This becomes the workspace default after you review and confirm it in Daymark.
            Administrators can still make either kind of widget later.
          </p>
        </div>

        <div className="homepage-setup-transfer">
          <div className="homepage-setup-actions">
            <a className="homepage-setup-primary" href={appLink}>
              Open in Daymark <ExternalLink size={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              aria-expanded={codeVisible}
              onClick={() => {
                setCodeVisible(true);
                setCopyMessage("");
              }}
            >
              <Laptop size={16} aria-hidden="true" /> Use on another machine
            </button>
          </div>

          <p className="homepage-setup-fallback">
            If Daymark does not open, install it first or use this setup code on the other machine.
          </p>

          {codeVisible ? (
            <div className="homepage-setup-code">
              <label htmlFor="homepage-setup-code">Portable setup code</label>
              <div>
                <input id="homepage-setup-code" value={code} readOnly spellCheck={false} />
                <button type="button" onClick={copyCode}>
                  <Copy size={15} aria-hidden="true" /> Copy setup code
                </button>
              </div>
              {copyMessage ? (
                <p role="status" aria-live="polite">{copyMessage}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
