/** @vitest-environment jsdom */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WidgetOptionsShowcase } from "../app/home/WidgetOptionsShowcase";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
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

  it("uses the true 2x artwork in both previews without removing the floating panel", async () => {
    const container = await renderShowcase();
    const artwork = Array.from(container.querySelectorAll<HTMLElement>(".widget-host-art"));
    const images = artwork.map((element) => element.querySelector<HTMLImageElement>("img"));

    expect(artwork).toHaveLength(2);
    expect(artwork.every((element) => element.classList.contains("widget-host-art-full-wordmark"))).toBe(true);
    expect(images.every((image) => image?.getAttribute("src") === "/daymark-widget-art-4x3-readable-2x.png")).toBe(true);
    expect(images.every((image) => image?.getAttribute("alt") === "")).toBe(true);
    expect(container.querySelector(".widget-choice-floating .floating-panel")).not.toBeNull();
  });

  it("ships the widget artwork at a true two-times pixel density", () => {
    const artworkPath = resolve(process.cwd(), "public/daymark-widget-art-4x3-readable-2x.png");
    const artworkExists = existsSync(artworkPath);

    expect(artworkExists).toBe(true);
    if (!artworkExists) return;

    const png = readFileSync(artworkPath);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(2896);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(2172);
  });

  it("changes only local accessible selection state", async () => {
    const container = await renderShowcase();
    const controls = Array.from(container.querySelectorAll<HTMLButtonElement>(".widget-choice-select"));
    expect(controls).toHaveLength(2);
    expect(controls[0].getAttribute("aria-pressed")).toBe("true");
    expect(controls[1].getAttribute("aria-pressed")).toBe("false");

    await act(async () => controls[1].click());

    expect(controls[0].getAttribute("aria-pressed")).toBe("false");
    expect(controls[1].getAttribute("aria-pressed")).toBe("true");
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function renderShowcase() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(createElement(WidgetOptionsShowcase)));
  return container;
}
