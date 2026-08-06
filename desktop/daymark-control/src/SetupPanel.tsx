import { useEffect, useState } from "react";

interface SetupPanelProps {
  configured: boolean;
  onReveal: () => Promise<string>;
  onCopy: () => Promise<void>;
}

export function SetupPanel({ configured, onReveal, onCopy }: SetupPanelProps) {
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!revealedCode) return;

    const clear = () => setRevealedCode(null);
    const clearWhenHidden = () => {
      if (document.visibilityState === "hidden") clear();
    };
    const timer = window.setTimeout(clear, 60_000);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clearWhenHidden);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, [revealedCode]);

  const reveal = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setRevealedCode(await onReveal());
    } catch {
      setMessage("The protected setup code could not be revealed.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setMessage(null);
    try {
      await onCopy();
      setMessage("Setup code copied. Clear your clipboard after use.");
    } catch {
      setMessage("The setup code could not be copied.");
    }
  };

  return (
    <section className="file-card file-sky setup-card" aria-labelledby="setup-heading">
      <p className="file-number">04 / FIRST SETUP</p>
      <h2 id="setup-heading">A protected first key.</h2>
      <p>
        {configured
          ? "Use this private code only when creating the first administrator. It stays encrypted on this computer."
          : "The installer will create a protected setup code before Daymark starts."}
      </p>

      {revealedCode ? (
        <div className="secret-reveal" aria-live="polite">
          <code>{revealedCode}</code>
          <div className="secret-actions">
            <button type="button" className="button button-primary" onClick={copy}>Copy setup code</button>
            <button type="button" className="text-action" onClick={() => setRevealedCode(null)}>Hide now</button>
          </div>
          <small>Hidden automatically after 60 seconds or when this window loses focus.</small>
        </div>
      ) : (
        <button
          type="button"
          className="text-action"
          disabled={!configured || busy}
          onClick={reveal}
        >
          {busy ? "Revealing…" : "Reveal setup code"}
        </button>
      )}

      {message ? <p className="panel-message" role="status">{message}</p> : null}
    </section>
  );
}
