import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";

let widgetSource = "";

beforeAll(async () => {
  widgetSource = await readFile("public/daymark-widget.js", "utf8");
});

describe("Daymark host script", () => {
  it("refuses to create a booking frame without a valid company workspace", () => {
    const widget = runWidget({ mode: "inline", channel: "missing-workspace", placement: "body", workspace: "" });
    expect(widget.document.querySelector("iframe")).toBeNull();
    expect(widget.script.nextElementSibling?.textContent).toBe("Booking unavailable.");
  });

  it("refuses unsafe explicit service configuration instead of falling back to the catalogue", () => {
    const widget = runWidget({
      mode: "inline",
      channel: "unsafe-service",
      placement: "body",
      service: "javascript:alert(1)",
    });
    expect(widget.document.querySelector("iframe")).toBeNull();
    expect(widget.script.nextElementSibling?.textContent).toBe("Booking unavailable.");
  });

  it("inserts inline after a body script and builds an accessible floating panel", () => {
    const inline = runWidget({
      mode: "inline",
      channel: "inline-channel",
      placement: "body",
      service: "ring-doorbell-installation",
    });
    expect(inline.script.nextElementSibling).toBe(inline.wrapper);
    expect(inline.iframe.title).toBe("Daymark appointment booking");
    expect(inline.iframe.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-same-origin");
    expect(inline.iframe.style.height).toBe("680px");
    expect(inline.iframe.src).toBe("https://widgets.daymark.test/embed?workspace=cedar-house&employee=maya-chen&service=ring-doorbell-installation&channel=inline-channel");

    const floating = runWidget({ mode: "floating", channel: "floating-channel", placement: "body" });
    const launcher = floating.document.querySelector<HTMLButtonElement>(".daymark-widget__launcher");
    expect(launcher?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(floating.wrapper.hidden).toBe(true);
    launcher?.click();
    expect(floating.wrapper.hidden).toBe(false);
    expect(launcher?.getAttribute("aria-expanded")).toBe("true");
    expect(floating.document.activeElement).toBe(floating.document.querySelector(".daymark-widget__close"));
  });

  it("rejects the wrong origin, source, channel, type, and height before accepting a resize", () => {
    const widget = runWidget({ mode: "inline", channel: "secure-channel", placement: "body" });
    const valid = { type: "daymark:resize", channel: "secure-channel", height: 640 };

    post(widget, valid, "https://evil.example", widget.iframe.contentWindow);
    post(widget, valid, widget.origin, widget.window);
    post(widget, { ...valid, channel: "other" }, widget.origin, widget.iframe.contentWindow);
    post(widget, { ...valid, type: "daymark:booking" }, widget.origin, widget.iframe.contentWindow);
    post(widget, { ...valid, height: 1201 }, widget.origin, widget.iframe.contentWindow);
    expect(widget.iframe.style.height).toBe("680px");

    post(widget, valid, widget.origin, widget.iframe.contentWindow);
    expect(widget.iframe.style.height).toBe("640px");
  });

  it("keeps the fallback armed through load and cancels it only after a valid bridge handshake", () => {
    const errorDocument = runWidget({
      mode: "inline",
      channel: "error-channel",
      placement: "body",
      service: "ring-doorbell-installation",
    });
    errorDocument.iframe.dispatchEvent(new errorDocument.window.Event("load"));
    errorDocument.runTimers(10_000);
    expect(errorDocument.wrapper.querySelector<HTMLAnchorElement>("a")?.href).toBe("https://widgets.daymark.test/book/cedar-house?service=ring-doorbell-installation");

    const healthy = runWidget({ mode: "inline", channel: "healthy-channel", placement: "body" });
    post(
      healthy,
      { type: "daymark:resize", channel: "healthy-channel", height: 700 },
      healthy.origin,
      healthy.iframe.contentWindow,
    );
    healthy.runTimers(10_000);
    expect(healthy.wrapper.querySelector("iframe")).toBe(healthy.iframe);
    expect(healthy.wrapper.querySelector("a")).toBeNull();
  });

  it("closes on completion, restores focus, resets privately, and contains focus around the iframe", () => {
    const widget = runWidget({ mode: "floating", channel: "focus-channel", placement: "body" });
    const launcher = widget.document.querySelector<HTMLButtonElement>(".daymark-widget__launcher")!;
    const closeButton = widget.document.querySelector<HTMLButtonElement>(".daymark-widget__close")!;
    launcher.click();

    const resetSpy = vi.spyOn(widget.iframe.contentWindow!, "postMessage");
    const before = widget.document.querySelector<HTMLElement>("[data-daymark-focus='before']");
    const after = widget.document.querySelector<HTMLElement>("[data-daymark-focus='after']");
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();

    widget.iframe.focus();
    before?.dispatchEvent(new widget.window.FocusEvent("focus", { relatedTarget: null }));
    expect(widget.document.activeElement).toBe(closeButton);
    widget.iframe.focus();
    after?.dispatchEvent(new widget.window.FocusEvent("focus", { relatedTarget: null }));
    expect(widget.document.activeElement).toBe(launcher);
    launcher.focus();
    launcher.dispatchEvent(new widget.window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(widget.document.activeElement).toBe(widget.iframe);

    post(
      widget,
      { type: "daymark:close", channel: "focus-channel" },
      widget.origin,
      widget.iframe.contentWindow,
    );
    expect(widget.wrapper.hidden).toBe(true);
    expect(widget.document.activeElement).toBe(launcher);
    expect(resetSpy).toHaveBeenCalledWith(
      { type: "daymark:reset", channel: "focus-channel" },
      widget.origin,
    );
    expect(JSON.stringify(resetSpy.mock.calls)).not.toMatch(/email|phone|address|reference/i);
  });

  it("removes iframe sentinels after fallback and keeps the fallback link in the host focus loop", () => {
    const widget = runWidget({ mode: "floating", channel: "fallback-focus", placement: "body" });
    const launcher = widget.document.querySelector<HTMLButtonElement>(".daymark-widget__launcher")!;
    launcher.click();
    widget.runTimers(10_000);

    expect(widget.document.querySelector("[data-daymark-focus]")).toBeNull();
    const link = widget.wrapper.querySelector<HTMLAnchorElement>("a")!;
    link.focus();
    link.dispatchEvent(new widget.window.KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }));
    expect(widget.document.activeElement).toBe(launcher);

    launcher.dispatchEvent(new widget.window.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(widget.document.activeElement).toBe(link);
  });

  it("defers head initialization until body exists and falls back to valid body placement", () => {
    const widget = runWidget({
      mode: "inline",
      channel: "head-channel",
      placement: "head",
      bodyReady: false,
    });
    expect(widget.document.querySelector(".daymark-widget")).toBeNull();

    widget.makeBodyReady();
    expect(widget.document.head.querySelector(".daymark-widget")).toBeNull();
    expect(widget.document.body.querySelector(".daymark-widget")).toBe(widget.wrapper);
  });

  it("keeps multiple widgets isolated and removes the dead-frame listener after fallback", () => {
    const first = runWidget({ mode: "inline", channel: "first-channel", placement: "body" });
    const deadIframe = first.iframe;
    first.runTimers(10_000);
    post(
      first,
      { type: "daymark:resize", channel: "first-channel", height: 720 },
      first.origin,
      deadIframe.contentWindow,
    );
    expect(deadIframe.style.height).toBe("680px");

    const shared = runMultipleWidgets();
    post(
      shared,
      { type: "daymark:resize", channel: "second-channel", height: 710 },
      shared.origin,
      shared.iframes[1].contentWindow,
    );
    expect(shared.iframes[0].style.height).toBe("680px");
    expect(shared.iframes[1].style.height).toBe("710px");
  });

  it("keeps only the most recently opened floating widget active", () => {
    const shared = runMultipleWidgets("floating");
    const [firstLauncher, secondLauncher] = shared.launchers;
    const [firstPanel, secondPanel] = shared.panels;
    const [firstIframe, secondIframe] = shared.iframes;
    const firstReset = vi.spyOn(firstIframe.contentWindow!, "postMessage");
    const secondReset = vi.spyOn(secondIframe.contentWindow!, "postMessage");

    firstLauncher.click();
    expect(firstPanel.hidden).toBe(false);
    expect(secondPanel.hidden).toBe(true);

    secondLauncher.click();
    expect(firstPanel.hidden).toBe(true);
    expect(firstLauncher.getAttribute("aria-expanded")).toBe("false");
    expect(secondPanel.hidden).toBe(false);
    expect(secondLauncher.getAttribute("aria-expanded")).toBe("true");
    expect(firstReset).toHaveBeenCalledTimes(1);
    expect(firstReset).toHaveBeenLastCalledWith(
      { type: "daymark:reset", channel: "first-channel" },
      shared.origin,
    );

    const inactiveFrameFocus = vi.spyOn(firstIframe, "focus");
    secondLauncher.focus();
    secondLauncher.dispatchEvent(new shared.window.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(inactiveFrameFocus).not.toHaveBeenCalled();
    expect(shared.window.document.activeElement).toBe(secondIframe);
    expect(firstPanel.hidden).toBe(true);

    shared.window.document.dispatchEvent(new shared.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    expect(firstPanel.hidden).toBe(true);
    expect(secondPanel.hidden).toBe(true);
    expect(firstReset).toHaveBeenCalledTimes(1);
    expect(secondReset).toHaveBeenCalledTimes(1);
    expect(shared.window.document.activeElement).toBe(secondLauncher);
  });
});

type WidgetHarness = ReturnType<typeof runWidget>;

function runWidget({
  mode,
  channel,
  placement,
  bodyReady = true,
  workspace = "cedar-house",
  service = "all",
}: {
  mode: "floating" | "inline";
  channel: string;
  placement: "head" | "body";
  bodyReady?: boolean;
  workspace?: string;
  service?: string;
}) {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://host.example/page",
  });
  const { window } = dom;
  const { document } = window;
  const script = document.createElement("script");
  script.src = "https://widgets.daymark.test/daymark-widget.js";
  script.dataset.mode = mode;
  if (workspace) script.dataset.workspace = workspace;
  script.dataset.employee = "maya-chen";
  script.dataset.service = service;
  (placement === "head" ? document.head : document.body).appendChild(script);
  Object.defineProperty(document, "currentScript", { configurable: true, value: script });
  Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: () => channel });
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };

  let currentBody: HTMLBodyElement | null = bodyReady ? document.body : null;
  const actualBody = document.body;
  if (!bodyReady) {
    Object.defineProperty(document, "body", {
      configurable: true,
      get: () => currentBody,
    });
  }

  let timerId = 0;
  const timers = new Map<number, { callback: TimerHandler; timeout: number }>();
  window.setTimeout = ((callback: TimerHandler, timeout = 0) => {
    timerId += 1;
    timers.set(timerId, { callback, timeout });
    return timerId;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id: number) => {
    timers.delete(id);
  }) as typeof window.clearTimeout;

  window.eval(widgetSource);
  return {
    dom,
    window,
    document,
    script,
    get wrapper() {
      return document.querySelector<HTMLDivElement>(".daymark-widget") ?? document.createElement("div");
    },
    get iframe() {
      return document.querySelector<HTMLIFrameElement>("iframe") ?? document.createElement("iframe");
    },
    origin: "https://widgets.daymark.test",
    runTimers(timeout: number) {
      for (const [id, timer] of [...timers]) {
        if (timer.timeout <= timeout) {
          timers.delete(id);
          if (typeof timer.callback === "function") timer.callback();
        }
      }
    },
    makeBodyReady() {
      currentBody = actualBody;
      document.dispatchEvent(new window.Event("DOMContentLoaded"));
    },
  };
}

function post(
  widget: Pick<WidgetHarness, "window">,
  data: Record<string, unknown>,
  origin: string,
  source: MessageEventSource | null,
) {
  widget.window.dispatchEvent(new widget.window.MessageEvent("message", { data, origin, source }));
}

function runMultipleWidgets(mode: "floating" | "inline" = "inline") {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "https://host.example/page",
  });
  const { window } = dom;
  const channels = ["first-channel", "second-channel"];
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value: () => channels.shift(),
  });
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  window.setTimeout = (() => 1) as typeof window.setTimeout;
  window.clearTimeout = (() => undefined) as typeof window.clearTimeout;

  for (const employee of ["maya-chen", "theo-brooks"]) {
    const script = window.document.createElement("script");
    script.src = "https://widgets.daymark.test/daymark-widget.js";
    script.dataset.mode = mode;
    script.dataset.workspace = "cedar-house";
    script.dataset.employee = employee;
    script.dataset.service = "all";
    window.document.body.appendChild(script);
    Object.defineProperty(window.document, "currentScript", { configurable: true, value: script });
    window.eval(widgetSource);
  }

  return {
    window,
    origin: "https://widgets.daymark.test",
    iframes: [...window.document.querySelectorAll("iframe")],
    launchers: [...window.document.querySelectorAll<HTMLButtonElement>(".daymark-widget__launcher")],
    panels: [...window.document.querySelectorAll<HTMLDivElement>(".daymark-widget__panel")],
  };
}
