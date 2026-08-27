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

describe("unified homepage setup experience", () => {
  it("renders one semantic setup region with one live host presentation", async () => {
    const container = await renderBuilder();
    const legends = Array.from(container.querySelectorAll("legend"))
      .map((legend) => legend.textContent?.trim());

    expect(container.querySelectorAll(".homepage-setup-builder")).toHaveLength(1);
    expect(container.querySelectorAll(
      "#widget-options .widget-choice .widget-host-browser",
    )).toHaveLength(2);
    expect(container.querySelectorAll(
      ".widget-presentation .widget-host-browser",
    )).toHaveLength(1);
    expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
    expect(container.querySelectorAll(".widget-choice .demo-booking-flow")).toHaveLength(0);
    expect(legends.some((legend) => legend?.includes("Choose how booking starts"))).toBe(true);
    expect(legends.some((legend) => legend?.includes("Choose where booking appears"))).toBe(true);
    expect(container.querySelectorAll(".journey-choice-select")).toHaveLength(2);
    expect(container.querySelectorAll(".widget-choice-select")).toHaveLength(2);
    expect(container.textContent).toContain("Which service do you need?");
  });

  it("separates two illustrated journey choices from two illustrated placement choices", async () => {
    const container = await renderBuilder();
    const journey = container.querySelector<HTMLElement>(".homepage-journey-section");
    const placement = container.querySelector<HTMLElement>(".homepage-placement-section");

    expect(journey).not.toBeNull();
    expect(placement).not.toBeNull();
    expect(journey?.querySelectorAll(".journey-choice")).toHaveLength(2);
    expect(journey?.querySelectorAll(".journey-choice-preview")).toHaveLength(2);
    expect(journey?.querySelector(".journey-preview-catalogue")).not.toBeNull();
    expect(journey?.querySelector(".journey-preview-page-service")).not.toBeNull();
    expect(placement?.querySelectorAll(".widget-choice")).toHaveLength(2);
    expect(journey?.contains(placement as Node)).toBe(false);
    expect(journey?.compareDocumentPosition(placement as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("shows each customer journey inside the same website-preview anatomy as the widget choices", async () => {
    const container = await renderBuilder();
    const catalogue = container.querySelector<HTMLElement>(".journey-choice-catalogue");
    const pageService = container.querySelector<HTMLElement>(".journey-choice-page-service");

    expect(catalogue?.querySelector(".widget-host-browser")).not.toBeNull();
    expect(pageService?.querySelector(".widget-host-browser")).not.toBeNull();
    expect(catalogue?.querySelector(".journey-preview-booking")?.textContent)
      .toContain("Choose a service");
    expect(catalogue?.querySelector(".journey-preview-result")?.textContent)
      .toContain("Qualified people appear next");
    expect(pageService?.querySelector(".journey-preview-booking")?.textContent)
      .toContain("Interior consultation selected");
    expect(pageService?.querySelector(".journey-preview-result")?.textContent)
      .toContain("Start with qualified people");
    expect(catalogue?.querySelector(".journey-choice-copy")?.textContent)
      .toContain("Let customers choose a service");
    expect(pageService?.querySelector(".journey-choice-copy")?.textContent)
      .toContain("Start with this service selected");
    const pageServiceControl = pageService?.querySelector<HTMLButtonElement>(".journey-choice-select");
    const describedBy = pageServiceControl?.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toContain("journey-page-service-best-for");
  });

  it("keeps the page-service journey illustration synchronized with the selected demonstration service", async () => {
    const container = await renderBuilder();
    await chooseJourneyCard(container, "page-service");
    await chooseRadio(container, "homepage-demo-service", "garden");
    await flushReset();

    const preview = container.querySelector<HTMLElement>(
      ".journey-choice-page-service .journey-choice-preview",
    );
    const previewText = preview?.textContent ?? "";

    expect(previewText).toContain("Garden planning");
    expect(previewText).toContain("Theo");
    expect(previewText).toContain("Priya");
    expect(previewText).not.toContain("Interior consultation");
    expect(previewText).not.toContain("Maya");
    expect(previewText).not.toContain("Jon");
  });

  it("keeps a plain-language summary of both decisions beside the selector", async () => {
    const container = await renderBuilder();
    const summary = container.querySelector<HTMLElement>(".homepage-current-selection");
    const legends = Array.from(container.querySelectorAll("legend"))
      .map((legend) => legend.textContent?.trim());

    expect(container.querySelector("#homepage-setup-title")?.textContent)
      .toContain("Two choices. One clear setup.");
    expect(legends.some((legend) => legend?.includes("Choose where booking appears"))).toBe(true);
    expect(summary).not.toBeNull();
    expect(summary?.getAttribute("aria-live")).toBe("polite");
    expect(summary?.textContent).toContain("Your current setup");
    expect(summary?.textContent).toContain("Booking starts");
    expect(summary?.textContent).toContain("Full catalogue");
    expect(summary?.textContent).toContain("Widget appears");
    expect(summary?.textContent).toContain("Floating button");

    await chooseJourneyCard(container, "page-service");
    await chooseLayoutCard(container, "inline");

    expect(summary?.textContent).toContain("This page's service");
    expect(summary?.textContent).toContain("Inline section");
  });

  it("uses a neutral public demonstration without smart-home installation copy", async () => {
    const container = await renderBuilder();
    const text = container.textContent ?? "";

    expect(text).toContain("Interior consultation");
    expect(text).toContain("Garden planning");
    expect(text).not.toMatch(/smart home|camera installation|alarm installation/i);
  });

  it.each([
    ["catalogue", "floating", "DM2-C-F-36UR", "Full service catalogue · Floating widget"],
    ["catalogue", "inline", "DM2-C-I-2SPS", "Full service catalogue · Inline widget"],
    ["page-service", "floating", "DM2-P-F-34D6", "Page-specific service · Floating widget"],
    ["page-service", "inline", "DM2-P-I-2Y6D", "Page-specific service · Inline widget"],
  ] as const)(
    "transfers the %s / %s profile with its matching native link and portable code",
    async (journey, layout, code, summary) => {
      const container = await renderBuilder();
      await chooseJourneyCard(container, journey);
      await chooseLayoutCard(container, layout);
      await clickButton(container, "Use on another machine");

      expect(container.querySelector(".homepage-setup-summary")?.textContent)
        .toContain(summary);
      expect(container.querySelector<HTMLAnchorElement>('a[href^="daymark://"]')?.getAttribute("href"))
        .toBe(`daymark://import-setup?code=${code}`);
      expect(container.querySelector<HTMLInputElement>("#homepage-setup-code")?.value)
        .toBe(code);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("keeps the page-specific transfer profile independent from the sample service", async () => {
    const container = await renderBuilder();
    await chooseJourneyCard(container, "page-service");
    await clickButton(container, "Use on another machine");

    const link = container.querySelector<HTMLAnchorElement>('a[href^="daymark://"]');
    const input = container.querySelector<HTMLInputElement>("#homepage-setup-code");
    expect(link?.getAttribute("href")).toBe("daymark://import-setup?code=DM2-P-F-34D6");
    expect(input?.value).toBe("DM2-P-F-34D6");

    await chooseRadio(container, "homepage-demo-service", "garden");
    await flushReset();

    expect(link?.getAttribute("href")).toBe("daymark://import-setup?code=DM2-P-F-34D6");
    expect(input?.value).toBe("DM2-P-F-34D6");
    expect(container.textContent).toContain("Garden planning");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("filters the catalogue and preserves booking progress when only layout changes", async () => {
    const container = await renderBuilder();
    const surface = container.querySelector<HTMLElement>("#widget-live-booking");
    const launcher = container.querySelector<HTMLButtonElement>(".widget-live-launcher");

    expect(surface?.hidden).toBe(true);
    expect(launcher?.hidden).toBe(false);
    await clickButton(container, "Book an appointment", ".widget-live-launcher");
    expect(surface?.hidden).toBe(false);
    expect(launcher?.hidden).toBe(true);
    expect(container.textContent).toContain("Which service do you need?");

    await clickButton(container, "Interior consultation", ".service-choice-card");
    expect(container.textContent).toContain("Who should deliver this service?");
    expect(container.textContent).toContain("Maya Chen");
    expect(container.textContent).toContain("Jon Bell");
    expect(container.textContent).not.toContain("Theo Brooks");
    expect(container.textContent).not.toContain("Priya Shah");

    await chooseLayoutCard(container, "inline");

    expect(surface?.hidden).toBe(false);
    expect(container.querySelector(".widget-live-launcher")).toBeNull();
    expect(container.textContent).toContain("Who should deliver this service?");
    expect(container.textContent).toContain("Interior consultation");
    expect(container.textContent).toContain("Maya Chen");
    expect(container.textContent).toContain("Jon Bell");
    expect(container.querySelector(".widget-presentation")?.getAttribute("data-layout"))
      .toBe("inline");
    expect(container.querySelector(".homepage-layout-status")?.textContent)
      .toContain("Booking progress kept");

    await chooseLayoutCard(container, "floating");

    const restoredLauncher = container.querySelector<HTMLButtonElement>(".widget-live-launcher");
    expect(surface?.hidden).toBe(true);
    expect(restoredLauncher?.hidden).toBe(false);
    await clickButton(container, "Book an appointment", ".widget-live-launcher");
    expect(surface?.hidden).toBe(false);
    expect(restoredLauncher?.hidden).toBe(true);
    expect(container.textContent).toContain("Who should deliver this service?");
    expect(container.textContent).toContain("Maya Chen");
    expect(container.textContent).toContain("Jon Bell");
    expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
    expect(container.querySelector(".widget-live-surface-compact")).not.toBeNull();
    expect(container.querySelector(".widget-live-surface-inline")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resets an advanced page-specific preview when its sample service changes", async () => {
    const container = await renderBuilder();
    const surface = container.querySelector<HTMLElement>("#widget-live-booking");
    const launcher = container.querySelector<HTMLButtonElement>(".widget-live-launcher");
    await chooseJourneyCard(container, "page-service");
    await flushReset();

    expect(surface?.hidden).toBe(false);
    expect(launcher?.hidden).toBe(true);
    expect(container.textContent).toContain("Who should deliver this service?");
    expect(container.textContent).not.toContain("Which service do you need?");
    expect(container.textContent).toContain("Interior consultation");
    expect(container.textContent).toContain("1 hr 30 min");
    expect(container.textContent).toContain("Maya Chen");
    expect(container.textContent).toContain("Jon Bell");

    await clickButton(container, "Maya Chen", ".person-tab");
    expect(container.textContent).toContain("Which day suits you?");

    await clickButton(container, "Close booking", ".widget-live-close");
    expect(surface?.hidden).toBe(true);
    expect(launcher?.hidden).toBe(false);

    await chooseRadio(container, "homepage-demo-service", "garden");
    await flushReset();

    expect(surface?.hidden).toBe(false);
    expect(launcher?.hidden).toBe(true);
    expect(container.textContent).toContain("Who should deliver this service?");
    expect(container.textContent).toContain("Garden planning");
    expect(container.textContent).toContain("2 hours");
    expect(container.textContent).toContain("Theo Brooks");
    expect(container.textContent).toContain("Priya Shah");
    expect(container.textContent).not.toContain("Maya Chen");
    expect(container.textContent).not.toContain("Jon Bell");
    expect(document.activeElement).toBe(container.querySelector(".stage-title h3"));
    expect(container.querySelector(".demo-booking-flow [role='status']")?.textContent)
      .toContain("Demonstration reset for Garden planning.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("restores two illustrated layout choices and keeps artwork out of the live preview", async () => {
    const container = await renderBuilder();
    const choiceImages = container.querySelectorAll<HTMLImageElement>(
      '#widget-options .widget-choice img[src="/daymark-widget-art-4x3-background-2x.png"]',
    );
    const livePreview = container.querySelector<HTMLElement>(".widget-presentation");

    expect(container.querySelectorAll("#widget-options .widget-choice")).toHaveLength(2);
    expect(choiceImages).toHaveLength(2);
    expect(Array.from(choiceImages).every((image) => image.alt === "")).toBe(true);
    expect(Array.from(choiceImages).every(
      (image) => image.getAttribute("loading") === "lazy",
    )).toBe(true);
    expect(Array.from(choiceImages).every(
      (image) => image.getAttribute("decoding") === "async",
    )).toBe(true);
    expect(container.querySelector(".widget-choice-floating .floating-panel")).not.toBeNull();
    expect(container.querySelector(".widget-choice-floating .widget-daymark-fab")).not.toBeNull();
    expect(container.querySelector(".widget-choice-inline .inline-panel")).not.toBeNull();
    expect(container.querySelector(".widget-choice-inline .widget-daymark-fab")).toBeNull();
    expect(livePreview?.querySelector(".widget-host-art")).toBeNull();
    expect(livePreview?.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".widget-choice .widget-host-art-wordmark")).toHaveLength(2);
    expect(container.querySelectorAll(".widget-choice .widget-host-art-tagline")).toHaveLength(2);
    expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
    expect(container.querySelectorAll(".widget-choice .demo-booking-flow")).toHaveLength(0);
  });

  it("renders a fuller artwork-free Cedar House studio behind the live booking surface", async () => {
    const container = await renderBuilder();
    const live = container.querySelector<HTMLElement>(".widget-presentation");
    const host = live?.querySelector<HTMLElement>(".widget-live-host-page");

    expect(host?.querySelector(".widget-live-host-hero")).not.toBeNull();
    expect(host?.querySelector(".widget-live-host-collage")).not.toBeNull();
    expect(host?.querySelectorAll(".widget-live-host-service")).toHaveLength(2);
    expect(host?.querySelector(".widget-live-host-proof")).not.toBeNull();
    expect(host?.textContent).toContain("Interior consultation");
    expect(host?.textContent).toContain("Garden planning");
    expect(live?.querySelector(".widget-host-art")).toBeNull();
    expect(live?.querySelector("img")).toBeNull();
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
    expect(stylesheet).toContain("@font-face");
    expect(stylesheet).toContain('font-family: "Daymark Bodoni"');
    expect(stylesheet).toContain('url("/fonts/libre-bodoni-latin-400.woff2")');
    expect(stylesheet).toContain('font-family: "Daymark Sans"');
    expect(stylesheet).toContain('url("/fonts/dm-sans-latin-variable.woff2")');
    expect(stylesheet).toMatch(/\.widget-host-art-wordmark\s*\{[^}]*font-family:\s*"Daymark Bodoni"/s);
    expect(stylesheet).toMatch(/\.widget-host-art-tagline\s*\{[^}]*font-family:\s*"Daymark Sans"/s);
    expect(stylesheet).toMatch(/\.widget-host-art-tagline\s*\{[^}]*font-size:\s*2\.75cqw;/s);
  });

  it("reveals and copies the current portable profile without a network request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const container = await renderBuilder();

    expect(container.querySelector<HTMLInputElement>("#homepage-setup-code")).toBeNull();
    await clickButton(container, "Use on another machine");
    await clickButton(container, "Copy setup code");

    expect(writeText).toHaveBeenCalledWith("DM2-C-F-36UR");
    expect(container.querySelector(".homepage-copy-status")?.textContent)
      .toContain("Setup code copied.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the portable fallback selectable when clipboard access is unavailable", async () => {
    const container = await renderBuilder();
    await clickButton(container, "Use on another machine");
    await clickButton(container, "Copy setup code");

    expect(container.querySelector<HTMLInputElement>("#homepage-setup-code")?.value)
      .toBe("DM2-C-F-36UR");
    expect(container.querySelector(".homepage-copy-status")?.textContent)
      .toContain("Select the code and copy it manually.");
  });
});

describe("homepage setup integration", () => {
  it("joins the introduction, controls, preview, and transfer card without breaking anchors", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(createElement(Home)));

    const experience = container.querySelector<HTMLElement>("#demo.homepage-setup-experience");
    const controls = container.querySelector<HTMLElement>("#widget-options");
    const contact = container.querySelector<HTMLElement>(".widget-contact-note");

    expect(experience).not.toBeNull();
    expect(controls && experience?.contains(controls)).toBe(true);
    expect(container.querySelectorAll(".homepage-setup-builder")).toHaveLength(1);
    expect(container.querySelectorAll(
      "#widget-options .widget-choice .widget-host-browser",
    )).toHaveLength(2);
    expect(container.querySelectorAll(
      ".widget-presentation .widget-host-browser",
    )).toHaveLength(1);
    expect(container.querySelectorAll(".demo-booking-flow")).toHaveLength(1);
    expect(container.querySelector(".demo-notice")?.textContent)
      .toContain("only qualified people");
    expect(experience?.querySelector('a[href="daymark://import-setup?code=DM2-C-F-36UR"]'))
      .not.toBeNull();
    expect(contact?.textContent).toContain("For custom widgets or integrations, contact us.");
    expect(contact?.querySelector("a, button, [tabindex]")).toBeNull();
    expect(container.querySelector('a[href="/get-daymark"]')).not.toBeNull();
    expect(container.querySelector('a[href="/workspace/sign-in"]')).not.toBeNull();
  });
});

async function renderBuilder() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(createElement(HomepageSetupBuilder)));
  return container;
}

async function chooseRadio(container: HTMLElement, name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  );
  expect(input).not.toBeNull();
  await act(async () => input?.click());
}

async function chooseJourneyCard(
  container: HTMLElement,
  journey: "catalogue" | "page-service",
) {
  const button = container.querySelector<HTMLButtonElement>(
    `.journey-choice-${journey} .journey-choice-select`,
  );
  expect(button).not.toBeNull();
  await act(async () => button?.click());
}

async function chooseLayoutCard(
  container: HTMLElement,
  layout: "floating" | "inline",
) {
  const button = container.querySelector<HTMLButtonElement>(
    `.widget-choice-${layout} .widget-choice-select`,
  );
  expect(button).not.toBeNull();
  await act(async () => button?.click());
}

async function clickButton(
  container: HTMLElement,
  text: string,
  selector = "button",
) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>(selector))
    .find((candidate) => candidate.textContent?.includes(text));
  expect(button).toBeDefined();
  await act(async () => {
    button?.click();
    await Promise.resolve();
  });
}

async function flushReset() {
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
}
