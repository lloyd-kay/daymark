/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlow } from "../app/booking/BookingFlow";
import { DemoBookingFlow } from "../app/demo/DemoBookingFlow";
import { EmbedBridge } from "../app/embed/EmbedBridge";
import type { BookingTransport } from "../lib/booking/transport";
import type { PublicEmployee, PublicService } from "../lib/data/contracts";
import { resolveWidgetBooking } from "../lib/widget/booking-selection";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  disconnected = false;
  observed: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }

  unobserve() {}
}

beforeEach(() => {
  document.body.replaceChildren();
  TestResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  Object.defineProperty(document, "referrer", { configurable: true, value: "" });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 640 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EmbedBridge behavior", () => {
  it("posts bounded metadata for resize, completion, and Escape, accepts a no-referrer reset, and cleans up", async () => {
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    let resets = 0;
    const onReset = () => { resets += 1; };
    window.addEventListener("daymark:reset", onReset);
    const { root } = await render(createElement(EmbedBridge, { channel: "bridge-channel" }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "daymark:resize", channel: "bridge-channel", height: 640 },
      "*",
    );
    window.dispatchEvent(new Event("daymark:complete"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(postMessage).toHaveBeenCalledWith(
      { type: "daymark:close", channel: "bridge-channel" },
      "*",
    );
    expect(postMessage.mock.calls.filter(([message]) => (
      message as { type?: string }
    ).type === "daymark:close")).toHaveLength(2);

    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      origin: "https://host-with-no-referrer.example",
      data: { type: "daymark:reset", channel: "bridge-channel" },
    }));
    expect(resets).toBe(1);
    expect(JSON.stringify(postMessage.mock.calls)).not.toMatch(/email|phone|address|reference/i);

    const resizeObserver = TestResizeObserver.instances[0];
    await act(async () => root.unmount());
    const callsAfterUnmount = postMessage.mock.calls.length;
    window.dispatchEvent(new Event("daymark:complete"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      origin: "https://host-with-no-referrer.example",
      data: { type: "daymark:reset", channel: "bridge-channel" },
    }));
    expect(postMessage).toHaveBeenCalledTimes(callsAfterUnmount);
    expect(resets).toBe(1);
    expect(resizeObserver.disconnected).toBe(true);
    window.removeEventListener("daymark:reset", onReset);
  });

  it("requires the known referrer origin and exact parent/source/channel/type shape for reset", async () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://known-host.example/page",
    });
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);
    let resets = 0;
    const onReset = () => { resets += 1; };
    window.addEventListener("daymark:reset", onReset);
    const { root } = await render(createElement(EmbedBridge, { channel: "known-channel" }));

    const attempts = [
      { source: window, origin: "https://evil.example", data: { type: "daymark:reset", channel: "known-channel" } },
      { source: null, origin: "https://known-host.example", data: { type: "daymark:reset", channel: "known-channel" } },
      { source: window, origin: "https://known-host.example", data: { type: "daymark:reset", channel: "other" } },
      { source: window, origin: "https://known-host.example", data: { type: "daymark:resize", channel: "known-channel", height: 640 } },
      { source: window, origin: "https://known-host.example", data: { type: "daymark:reset", channel: "known-channel", extra: true } },
    ];
    for (const attempt of attempts) {
      window.dispatchEvent(new MessageEvent("message", attempt));
    }
    expect(resets).toBe(0);

    window.dispatchEvent(new MessageEvent("message", {
      source: window,
      origin: "https://known-host.example",
      data: { type: "daymark:reset", channel: "known-channel" },
    }));
    expect(resets).toBe(1);
    await act(async () => root.unmount());
    window.removeEventListener("daymark:reset", onReset);
  });
});

describe("BookingFlow embed lifecycle", () => {
  it("emits completion only for embedded success and routes reset through the real cleared booking state", async () => {
    const complete = vi.fn();
    window.addEventListener("daymark:complete", complete);

    const embedded = await completeBooking(true);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(embedded.container.textContent).toContain("Your time is marked.");

    await act(async () => {
      window.dispatchEvent(new Event("daymark:reset"));
    });
    expect(embedded.container.textContent).toContain("Who should deliver this service?");
    expect(embedded.container.textContent).not.toContain("Your time is marked.");
    expect(embedded.container.querySelector("input[name='name']")).toBeNull();
    await act(async () => embedded.root.unmount());

    complete.mockClear();
    const standalone = await completeBooking(false);
    expect(complete).not.toHaveBeenCalled();
    expect(standalone.container.textContent).toContain("Your time is marked.");
    await act(async () => standalone.root.unmount());
    window.removeEventListener("daymark:complete", complete);
  });
});

describe("Embed service resolution", () => {
  it("keeps catalogue mode unlocked while limiting services for a fixed employee", async () => {
    const scope = {
      workspaceId: "workspace-cedar",
      workspaceSlug: "cedar-house",
      workspaceName: "Cedar House",
    };
    const listServices = vi.fn().mockResolvedValue([service]);
    const listEmployees = vi.fn();

    await expect(resolveWidgetBooking(
      scope,
      { employee: "maya-chen", service: "all" },
      { listServices, listEmployees },
    )).resolves.toEqual({
      initialServices: [service],
      initialEmployees: [],
      initialEmployeeId: "maya-chen",
    });
    expect(listServices).toHaveBeenCalledWith(scope, "maya-chen");
    expect(listEmployees).not.toHaveBeenCalled();
  });

  it("locks an explicit service and validates a fixed employee against its qualified team", async () => {
    const scope = {
      workspaceId: "workspace-cedar",
      workspaceSlug: "cedar-house",
      workspaceName: "Cedar House",
    };
    const listServices = vi.fn().mockResolvedValue([service]);
    const listEmployees = vi.fn().mockResolvedValue([employee]);

    const booking = await resolveWidgetBooking(
      scope,
      { employee: "maya-chen", service: "camera-installation" },
      { listServices, listEmployees },
    );

    expect(listServices).toHaveBeenCalledWith(scope, "maya-chen");
    expect(listEmployees).toHaveBeenCalledWith(scope, service.id);
    expect(booking).toMatchObject({
      initialServices: [service],
      initialServiceId: service.id,
      initialEmployees: [employee],
      initialEmployeeId: "maya-chen",
    });
  });

  it("keeps catalogue mode explicit and rejects an unavailable employee-service pair", async () => {
    const scope = {
      workspaceId: "workspace-cedar",
      workspaceSlug: "cedar-house",
      workspaceName: "Cedar House",
    };
    const listServices = vi.fn().mockResolvedValue([]);
    const listEmployees = vi.fn().mockResolvedValue([]);

    await expect(resolveWidgetBooking(
      scope,
      { employee: "theo-brooks", service: "camera-installation" },
      { listServices, listEmployees },
    )).resolves.toBeNull();
  });
});

describe("DemoBookingFlow", () => {
  it("resets a controlled page-specific demonstration when its sample service changes", async () => {
    const view = await render(createElement(DemoBookingFlow, {
      journey: "page-service",
      demoService: "interior",
    }));

    expect(view.container.textContent).toContain("Who should deliver this service?");
    expect(view.container.textContent).toContain("Interior consultation");
    expect(view.container.textContent).toContain("1 hr 30 min");
    expect(view.container.textContent).toContain("Maya Chen");
    expect(view.container.textContent).toContain("Jon Bell");
    expect(view.container.textContent).not.toContain("Theo Brooks");
    expect(view.container.textContent).not.toContain("Priya Shah");
    expect(view.container.textContent).not.toContain("Which service do you need?");

    const maya = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".person-tab"))
      .find((button) => button.textContent?.includes("Maya Chen"));
    await click(maya!);
    expect(view.container.textContent).toContain("Which day suits you?");

    await act(async () => {
      view.root.render(createElement(DemoBookingFlow, {
        journey: "page-service",
        demoService: "garden",
      }));
    });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    expect(view.container.textContent).toContain("Who should deliver this service?");
    expect(view.container.textContent).toContain("Garden planning");
    expect(view.container.textContent).toContain("2 hours");
    expect(view.container.textContent).toContain("Theo Brooks");
    expect(view.container.textContent).toContain("Priya Shah");
    expect(view.container.textContent).not.toContain("Maya Chen");
    expect(view.container.textContent).not.toContain("Jon Bell");
    expect(view.container.querySelector('[role="status"]')?.textContent)
      .toContain("Demonstration reset for Garden planning");
    expect(document.activeElement).toBe(
      view.container.querySelector(".stage-title h3"),
    );

    await act(async () => view.root.unmount());
  });

  it("announces the catalogue rather than a sample service when scope resets", async () => {
    const view = await render(createElement(DemoBookingFlow, {
      journey: "page-service",
      demoService: "garden",
    }));

    await act(async () => {
      view.root.render(createElement(DemoBookingFlow, {
        journey: "catalogue",
        demoService: "garden",
      }));
    });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    expect(view.container.textContent).toContain("Which service do you need?");
    expect(view.container.querySelector('[role="status"]')?.textContent)
      .toContain("Demonstration reset for the full service catalogue.");
    expect(view.container.querySelector('[role="status"]')?.textContent)
      .not.toContain("Garden planning");
    expect(document.activeElement).toBe(view.container.querySelector(".stage-title h3"));

    await act(async () => view.root.unmount());
  });

  it("filters the neutral service catalogue and completes locally without a widget event", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const complete = vi.fn();
    window.addEventListener("daymark:complete", complete);
    let view: Awaited<ReturnType<typeof render>> | undefined;

    try {
      view = await render(createElement(DemoBookingFlow));
      expect(view.container.textContent).toContain("Which service do you need?");
      const interior = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".service-choice-card"))
        .find((button) => button.textContent?.includes("Interior consultation"));
      expect(interior).toBeDefined();
      await click(interior!);
      expect(view.container.textContent).toContain("Maya Chen");
      expect(view.container.textContent).toContain("Jon Bell");
      expect(view.container.textContent).not.toContain("Theo Brooks");
      expect(view.container.textContent).not.toContain("Priya Shah");

      await click(view.container.querySelector<HTMLButtonElement>(".back-button")!);
      const garden = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".service-choice-card"))
        .find((button) => button.textContent?.includes("Garden planning"));
      expect(garden).toBeDefined();
      await click(garden!);
      expect(view.container.textContent).toContain("Theo Brooks");
      expect(view.container.textContent).toContain("Priya Shah");
      expect(view.container.textContent).not.toContain("Maya Chen");
      expect(view.container.textContent).not.toContain("Jon Bell");

      const theo = Array.from(view.container.querySelectorAll<HTMLButtonElement>(".person-tab"))
        .find((button) => button.textContent?.includes("Theo Brooks"));
      expect(theo).toBeDefined();
      await click(theo!);
      await click(view.container.querySelector<HTMLButtonElement>(".date-card:not([disabled])")!);
      await click(view.container.querySelector<HTMLButtonElement>(".time-tabs button")!);
      await change(view.container.querySelector<HTMLInputElement>("input[name='name']")!, "Alex Morgan");
      await change(view.container.querySelector<HTMLInputElement>("input[name='address']")!, "14 Sample Street, London");
      await act(async () => {
        view!.container.querySelector<HTMLFormElement>("form")!.dispatchEvent(
          new SubmitEvent("submit", { bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });

      const text = view.container.textContent ?? "";
      expect(text).toContain("Demonstration complete");
      expect(text).toContain("No appointment was created.");
      expect(text).toContain("Theo Brooks");
      expect(text).toContain("Garden planning (2 hours)");
      expect(text).toContain("Demo reference");
      expect(text).toContain("DEMO-ONLY");
      expect(text).not.toContain("Appointment confirmed");
      expect(text).not.toContain("Your time is marked.");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
    } finally {
      if (view) await act(async () => view!.root.unmount());
      window.removeEventListener("daymark:complete", complete);
      fetchSpy.mockRestore();
    }
  });
});

const employee: PublicEmployee = {
  id: "maya-chen",
  publicName: "Maya Chen",
  title: "Advisor",
  bio: "Private appointments",
  accent: "coral",
};

const service: PublicService = {
  id: "service-camera",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Smart security",
  description: "Install and configure a camera.",
  durationMinutes: 90,
};

async function completeBooking(embedded: boolean) {
  const startAt = "2026-08-06T09:00:00.000Z";
  const transport: BookingTransport = {
    loadEmployees: vi.fn().mockResolvedValue([employee]),
    loadSlots: vi.fn().mockResolvedValue({
      dateKeys: ["2026-08-06"],
      slots: [{ dateKey: "2026-08-06", startAt, endAt: "2026-08-06T09:30:00.000Z" }],
    }),
    createBooking: vi.fn().mockResolvedValue({
      reference: "DM-TEST",
      serviceName: "Camera installation",
      serviceDurationMinutes: 90,
      employeeName: "Maya Chen",
      startAt,
      endAt: "2026-08-06T09:30:00.000Z",
      address: "14 Sample Street, London",
      contactSummary: "a••••@example.com",
    }),
  };
  const view = await render(createElement(BookingFlow, {
    initialServices: [service],
    initialServiceId: service.id,
    initialEmployees: [employee],
    transport,
    embedded,
  }));

  await click(view.container.querySelector<HTMLButtonElement>(".person-tab")!);
  await click(view.container.querySelector<HTMLButtonElement>(".date-card:not([disabled])")!);
  await click(view.container.querySelector<HTMLButtonElement>(".time-tabs button")!);
  await change(view.container.querySelector<HTMLInputElement>("input[name='name']")!, "Alex Morgan");
  await change(view.container.querySelector<HTMLInputElement>("input[name='address']")!, "14 Sample Street, London");
  await change(view.container.querySelector<HTMLInputElement>("input[name='email']")!, "alex@example.com");
  await act(async () => {
    view.container.querySelector<HTMLFormElement>("form")!.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
  });
  return view;
}

async function render(element: React.ReactNode): Promise<{
  root: Root;
  container: HTMLDivElement;
}> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { root, container };
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
