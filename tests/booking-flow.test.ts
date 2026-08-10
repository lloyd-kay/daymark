/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlow, recoverBookingConflict } from "../app/booking/BookingFlow";
import type { BookingTransport } from "../lib/booking/transport";
import type { PublicEmployee, PublicService } from "../lib/data/contracts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const camera: PublicService = {
  id: "service-camera",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Smart security",
  description: "Install and configure a camera.",
  durationMinutes: 90,
};
const alarm: PublicService = {
  id: "service-alarm",
  slug: "alarm-installation",
  name: "Alarm installation",
  category: "Smart security",
  description: "Install and configure an alarm.",
  durationMinutes: 120,
};
const maya: PublicEmployee = {
  id: "maya-chen",
  publicName: "Maya Chen",
  title: "Camera specialist",
  bio: "Qualified camera installer.",
  accent: "coral",
};
const theo: PublicEmployee = {
  id: "theo-brooks",
  publicName: "Theo Brooks",
  title: "Alarm specialist",
  bio: "Qualified alarm installer.",
  accent: "sage",
};
const startAt = "2026-08-10T08:00:00.000Z";

let roots: Root[] = [];

beforeEach(() => {
  document.body.replaceChildren();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
});

afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  roots = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("service-first booking journeys", () => {
  it("starts catalogue mode with services and then shows only loaded qualified employees", async () => {
    const transport = serviceAwareTransport();
    const view = await render(createElement(BookingFlow, {
      initialServices: [camera, alarm],
      initialEmployees: [],
      transport,
    }));

    expect(view.container.textContent).toContain("Which service do you need?");
    await click(buttonContaining(view.container, "Camera installation"));

    expect(transport.loadEmployees).toHaveBeenCalledWith("service-camera");
    expect(view.container.textContent).toContain("Maya Chen");
    expect(view.container.textContent).not.toContain("Alarm installation");
    expect(view.container.textContent).not.toContain("Theo Brooks");
  });

  it("returns from person selection to the catalogue only in catalogue mode", async () => {
    const view = await render(createElement(BookingFlow, {
      initialServices: [camera, alarm],
      initialEmployees: [],
      transport: serviceAwareTransport(),
    }));
    await click(buttonContaining(view.container, "Camera installation"));

    await click(buttonContaining(view.container, "Back"));

    expect(view.container.textContent).toContain("Which service do you need?");
    expect(view.container.textContent).toContain("Alarm installation");
  });

  it("locks a preselected service and submits its internal id", async () => {
    const transport = serviceAwareTransport();
    const view = await render(createElement(BookingFlow, {
      initialServices: [camera],
      initialServiceId: "service-camera",
      initialEmployees: [maya],
      transport,
    }));

    expect(view.container.textContent).not.toContain("Which service do you need?");
    await click(buttonContaining(view.container, "Maya Chen"));
    await click(view.container.querySelector<HTMLButtonElement>(".date-card:not([disabled])")!);
    await click(view.container.querySelector<HTMLButtonElement>(".time-tabs button")!);
    await change(view.container.querySelector<HTMLInputElement>("input[name='name']")!, "Alex Morgan");
    await change(view.container.querySelector<HTMLInputElement>("input[name='address']")!, "14 Sample Street, Oxford");
    await change(view.container.querySelector<HTMLInputElement>("input[name='email']")!, "alex@example.com");
    await submit(view.container.querySelector<HTMLFormElement>("form")!);

    expect(view.container.textContent).toContain("Camera installation");
    expect(view.container.textContent).toContain("1 hr 30 min");
    expect(transport.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: "service-camera",
    }));
  });

  it("shows a fixed service unavailable state without falling back to the catalogue", async () => {
    const view = await render(createElement(BookingFlow, {
      initialServices: [camera],
      initialServiceId: "service-camera",
      initialEmployees: [],
      transport: serviceAwareTransport(),
    }));

    expect(view.container.textContent).toContain("No qualified team members are available");
    expect(view.container.textContent).not.toContain("Alarm installation");
    expect(buttonContaining(view.container, "Back", false)).toBeNull();
  });
});

describe("booking conflict recovery", () => {
  it("reloads service-aware availability and returns the refreshed time-selection state", async () => {
    const loadSlots = vi.fn().mockResolvedValue({
      dateKeys: ["2026-08-06"],
      slots: [{
        dateKey: "2026-08-06",
        startAt: "2026-08-06T10:00:00.000Z",
        endAt: "2026-08-06T11:30:00.000Z",
      }],
    });

    const recovered = await recoverBookingConflict(
      { loadEmployees: vi.fn(), loadSlots, createBooking: vi.fn() },
      "service-camera",
      "maya-chen",
      "2026-08-06",
    );

    expect(loadSlots).toHaveBeenCalledWith(
      "service-camera",
      "maya-chen",
      "2026-08-06",
    );
    expect(recovered).toEqual({
      dateKeys: ["2026-08-06"],
      slots: [{
        dateKey: "2026-08-06",
        startAt: "2026-08-06T10:00:00.000Z",
        endAt: "2026-08-06T11:30:00.000Z",
      }],
      nextStep: "time",
      slot: null,
    });
  });
});

function serviceAwareTransport(): BookingTransport & {
  loadEmployees: ReturnType<typeof vi.fn>;
  loadSlots: ReturnType<typeof vi.fn>;
  createBooking: ReturnType<typeof vi.fn>;
} {
  return {
    loadEmployees: vi.fn(async (serviceId: string) => (
      serviceId === camera.id ? [maya] : [theo]
    )),
    loadSlots: vi.fn().mockResolvedValue({
      dateKeys: ["2026-08-10"],
      slots: [{
        dateKey: "2026-08-10",
        startAt,
        endAt: "2026-08-10T09:30:00.000Z",
      }],
    }),
    createBooking: vi.fn().mockResolvedValue({
      reference: "DM-CAMERA",
      serviceName: "Camera installation",
      serviceDurationMinutes: 90,
      employeeName: "Maya Chen",
      startAt,
      endAt: "2026-08-10T09:30:00.000Z",
      address: "14 Sample Street, Oxford",
      contactSummary: "a••••@example.com",
    }),
  };
}

async function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return { root, container };
}

function buttonContaining(container: HTMLElement, text: string): HTMLButtonElement;
function buttonContaining(container: HTMLElement, text: string, required: false): HTMLButtonElement | null;
function buttonContaining(container: HTMLElement, text: string, required = true) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.includes(text)) ?? null;
  if (!button && required) throw new Error(`Missing button containing: ${text}`);
  return button;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

async function change(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}
