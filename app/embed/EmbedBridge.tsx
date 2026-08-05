"use client";

import { useEffect } from "react";

export function EmbedBridge({ channel }: { channel: string }) {
  useEffect(() => {
    const root = document.documentElement;
    const parentOrigin = referrerOrigin(document.referrer);
    let lastHeight = 0;

    function postResize() {
      const height = Math.min(1200, Math.max(280, Math.ceil(root.scrollHeight)));
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage(
        { type: "daymark:resize", channel, height },
        parentOrigin ?? "*",
      );
    }

    function postClose() {
      window.parent.postMessage(
        { type: "daymark:close", channel },
        parentOrigin ?? "*",
      );
    }

    function receiveReset(event: MessageEvent<unknown>) {
      if (
        !parentOrigin ||
        event.origin !== parentOrigin ||
        event.source !== window.parent ||
        !isResetMessage(event.data, channel)
      ) {
        return;
      }
      window.dispatchEvent(new Event("daymark:reset"));
    }

    const observer = new ResizeObserver(postResize);
    observer.observe(root);
    window.addEventListener("daymark:complete", postClose);
    window.addEventListener("message", receiveReset);
    postResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("daymark:complete", postClose);
      window.removeEventListener("message", receiveReset);
    };
  }, [channel]);

  return null;
}

function isResetMessage(value: unknown, channel: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return (
    Object.keys(message).length === 2 &&
    message.type === "daymark:reset" &&
    message.channel === channel
  );
}

function referrerOrigin(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).origin;
  } catch {
    return null;
  }
}
