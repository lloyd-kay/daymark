// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { WidgetLivePreview } from "../app/home/WidgetLivePreview";
import type { WidgetPlacement } from "../app/home/WidgetOptionsShowcase";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("widget live presentation", () => {
  it("opens Floating with only the dialog visible and closes back to its launcher", async () => {
    const container = await renderHarness();
    const surface = container.querySelector<HTMLElement>("#widget-live-booking");
    const launcher = container.querySelector<HTMLButtonElement>("button.widget-live-launcher");

    expect(surface?.hidden).toBe(true);
    expect(launcher).not.toBeNull();
    expect(launcher?.hidden).toBe(false);
    await click(launcher);

    expect(surface?.hidden).toBe(false);
    expect(surface?.getAttribute("role")).toBe("dialog");
    expect(surface?.getAttribute("aria-labelledby")).toBe("widget-live-dialog-title");
    expect(launcher?.hidden).toBe(true);
    const close = container.querySelector<HTMLButtonElement>(".widget-live-close");
    expect(close).not.toBeNull();
    expect(document.activeElement).toBe(close);

    await click(close);

    expect(surface?.hidden).toBe(true);
    expect(launcher?.hidden).toBe(false);
    expect(document.activeElement).toBe(launcher);
  });

  it("closes an open Floating presentation with Escape", async () => {
    const container = await renderHarness();
    const surface = container.querySelector<HTMLElement>("#widget-live-booking");
    const launcher = container.querySelector<HTMLButtonElement>("button.widget-live-launcher");
    expect(surface).not.toBeNull();
    expect(launcher).not.toBeNull();

    await click(launcher);
    await keyDown(surface, "Escape");

    expect(surface?.hidden).toBe(true);
    expect(launcher?.hidden).toBe(false);
    expect(document.activeElement).toBe(launcher);
  });

  it("keeps one stateful child across open Floating, Inline, and closed Floating", async () => {
    const container = await renderHarness();
    await click(container.querySelector("button.widget-live-launcher"));
    await click(container.querySelector(".stateful-probe"));
    expect(container.querySelector(".stateful-probe")?.textContent).toBe("Step 2");

    await clickButtonByText(container, "Use Inline");

    const inlineSurface = container.querySelector<HTMLElement>("#widget-live-booking");
    expect(inlineSurface?.hidden).toBe(false);
    expect(inlineSurface?.getAttribute("role")).toBeNull();
    expect(container.querySelector(".widget-live-launcher")).toBeNull();
    expect(container.querySelector(".widget-live-close")).toBeNull();
    expect(container.querySelector(".stateful-probe")?.textContent).toBe("Step 2");

    await clickButtonByText(container, "Use Floating");

    const floatingSurface = container.querySelector<HTMLElement>("#widget-live-booking");
    const launcher = container.querySelector<HTMLButtonElement>("button.widget-live-launcher");
    expect(floatingSurface?.hidden).toBe(true);
    expect(launcher?.hidden).toBe(false);
    await click(launcher);
    expect(container.querySelector(".stateful-probe")?.textContent).toBe("Step 2");
  });
});

function StatefulProbe() {
  const [step, setStep] = useState(1);
  return (
    <button type="button" className="stateful-probe" onClick={() => setStep(2)}>
      Step {step}
    </button>
  );
}

function PreviewHarness() {
  const [layout, setLayout] = useState<WidgetPlacement>("floating");
  return (
    <>
      <button type="button" onClick={() => setLayout("floating")}>Use Floating</button>
      <button type="button" onClick={() => setLayout("inline")}>Use Inline</button>
      <WidgetLivePreview layout={layout}><StatefulProbe /></WidgetLivePreview>
    </>
  );
}

async function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(createElement(PreviewHarness)));
  return container;
}

async function click(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  await act(async () => {
    (element as HTMLElement | null)?.click();
    await Promise.resolve();
  });
}

async function keyDown(element: Element | null | undefined, key: string) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
    await Promise.resolve();
  });
}

async function clickButtonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent === text);
  expect(button).not.toBeUndefined();
  await click(button);
}
