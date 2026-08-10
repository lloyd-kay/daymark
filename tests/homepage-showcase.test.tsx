/** @vitest-environment jsdom */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { HomepageSetupBuilder } from "../app/home/HomepageSetupBuilder";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  Reflect.deleteProperty(navigator, "clipboard");
  vi.unstubAllGlobals();
});

describe("WidgetOptionsShowcase", () => {
  it("renders both restored Cedar House presentations", async () => {
    const container = await renderShowcase();
    expect(container.textContent).toContain("Always close, never in the way");
    expect(container.textContent).toContain("A booking section with presence");
    expect(container.querySelectorAll(".widget-host-browser")).toHaveLength(2);
    expect(container.textContent).toContain("Maya");
    expect(container.textContent).toContain("Theo");
    expect(container.textContent).toContain("Priya");
    expect(container.textContent).toContain("Jon");
  });

  it("uses a text-free background with live typography in both previews", async () => {
    const container = await renderShowcase();
    const artwork = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art"));
    const images = artwork.map((element) => element.querySelector<HTMLImageElement>("img"));
    const canvases = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art-canvas"));
    const wordmarks = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art-wordmark"));
    const taglines = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art-tagline"));

    expect(artwork).toHaveLength(2);
    expect(artwork.every((element) => element.classList.contains("widget-host-art-full-wordmark"))).toBe(true);
    expect(canvases).toHaveLength(2);
    expect(images.every((image) => image?.getAttribute("src") === "/daymark-widget-art-4x3-background-2x.png")).toBe(true);
    expect(images.every((image) => image?.getAttribute("alt") === "")).toBe(true);
    expect(images.every((image) => image?.getAttribute("loading") === "lazy")).toBe(true);
    expect(images.every((image) => image?.getAttribute("decoding") === "async")).toBe(true);
    expect(wordmarks).toHaveLength(2);
    expect(wordmarks.every((wordmark) => wordmark.textContent === "DAYMARK")).toBe(true);
    expect(taglines).toHaveLength(2);
    expect(taglines.every((tagline) => tagline.textContent === "Book the right person. Keep every calendar private.")).toBe(true);
    expect(container.querySelector(".widget-choice-floating .floating-panel")).not.toBeNull();
  });

  it("ships the text-free background at a true two-times pixel density", () => {
    const artworkPath = resolve(process.cwd(), "public/daymark-widget-art-4x3-background-2x.png");
    const artworkExists = existsSync(artworkPath);

    expect(artworkExists).toBe(true);
    if (!artworkExists) return;

    const png = readFileSync(artworkPath);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);

    expect(png.subarray(0, 8)).toEqual(pngSignature);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(width).toBeGreaterThanOrEqual(2896);
    expect(height).toBeGreaterThanOrEqual(2172);
    expect(width * 3).toBe(height * 4);
    expect(png.byteLength).toBeLessThanOrEqual(6_000_000);
  });

  it("self-hosts the live Daymark wordmark font", () => {
    const wordmarkFontPath = resolve(process.cwd(), "public/fonts/libre-bodoni-latin-400.woff2");
    const taglineFontPath = resolve(process.cwd(), "public/fonts/dm-sans-latin-variable.woff2");
    const stylesheet = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(existsSync(wordmarkFontPath)).toBe(true);
    expect(existsSync(taglineFontPath)).toBe(true);
    expect(stylesheet).toContain('@font-face');
    expect(stylesheet).toContain('font-family: "Daymark Bodoni"');
    expect(stylesheet).toContain('url("/fonts/libre-bodoni-latin-400.woff2")');
    expect(stylesheet).toContain('font-family: "Daymark Sans"');
    expect(stylesheet).toContain('url("/fonts/dm-sans-latin-variable.woff2")');
    expect(stylesheet).toMatch(/\.widget-host-art-wordmark\s*\{[^}]*font-family:\s*"Daymark Bodoni"/s);
    expect(stylesheet).toMatch(/\.widget-host-art-tagline\s*\{[^}]*font-family:\s*"Daymark Sans"/s);
    expect(stylesheet).toMatch(/\.widget-host-art-tagline\s*\{[^}]*font-size:\s*2\.75cqw;/s);
  });

  it("turns accessible layout selection into a deterministic setup profile", async () => {
    const container = await renderShowcase();
    const controls = Array.from(container.querySelectorAll<HTMLButtonElement>(".widget-choice-select"));
    expect(controls).toHaveLength(2);
    expect(controls[0].getAttribute("aria-pressed")).toBe("true");
    expect(controls[1].getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".homepage-setup-summary")?.textContent)
      .toContain("Full service catalogue · Floating widget");
    expect(container.querySelector<HTMLAnchorElement>('a[href^="daymark://"]')?.getAttribute("href"))
      .toBe("daymark://import-setup?code=DM1-C-F-2ZE7");

    await act(async () => controls[1].click());

    expect(controls[0].getAttribute("aria-pressed")).toBe("false");
    expect(controls[1].getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".homepage-setup-summary")?.textContent)
      .toContain("Full service catalogue · Inline widget");
    expect(container.querySelector<HTMLAnchorElement>('a[href^="daymark://"]')?.getAttribute("href"))
      .toBe("daymark://import-setup?code=DM1-C-I-355C");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reveals and copies a portable code without a network request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const container = await renderShowcase();
    const reveal = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Use on another machine"));

    expect(reveal).toBeDefined();
    expect(container.querySelector<HTMLInputElement>("#homepage-setup-code")).toBeNull();
    await act(async () => reveal!.click());

    const code = container.querySelector<HTMLInputElement>("#homepage-setup-code");
    expect(code?.value).toBe("DM1-C-F-2ZE7");
    expect(code?.readOnly).toBe(true);
    const copy = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Copy setup code"));
    await act(async () => copy!.click());
    expect(writeText).toHaveBeenCalledWith("DM1-C-F-2ZE7");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Setup code copied.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the portable fallback visible when protocol launch cannot be detected", async () => {
    const container = await renderShowcase();
    const link = container.querySelector<HTMLAnchorElement>('a[href^="daymark://"]')!;
    link.addEventListener("click", (event) => event.preventDefault());
    await act(async () => link.click());

    expect(container.textContent).toContain(
      "If Daymark does not open, install it first or use this setup code on the other machine.",
    );
    expect(container.textContent).not.toMatch(/detected|successfully opened/i);
  });

  it("leaves the code selectable when clipboard access is unavailable", async () => {
    const container = await renderShowcase();
    const reveal = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Use on another machine"));
    await act(async () => reveal!.click());
    const copy = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Copy setup code"));
    await act(async () => copy!.click());

    expect(container.querySelector<HTMLInputElement>("#homepage-setup-code")?.value)
      .toBe("DM1-C-F-2ZE7");
    expect(container.querySelector('[role="status"]')?.textContent)
      .toContain("Select the code and copy it manually.");
  });
});

describe("homepage setup integration", () => {
  it("explains service-first filtering and renders the transferable builder", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(Home)));

    const setup = container.querySelector<HTMLElement>(".homepage-setup-builder");
    const contact = container.querySelector<HTMLElement>(".widget-contact-note");

    expect(container.querySelector(".demo-heading")?.textContent)
      .toContain("Clients choose a service first");
    expect(setup?.textContent).toContain("Your Daymark setup");
    expect(setup?.querySelector('a[href="daymark://import-setup?code=DM1-C-F-2ZE7"]'))
      .not.toBeNull();
    expect(contact?.textContent).toContain("For custom widgets or integrations, contact us.");
    expect(contact?.querySelector("a, button, [tabindex]")).toBeNull();
  });
});

async function renderShowcase() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(createElement(HomepageSetupBuilder)));
  return container;
}
