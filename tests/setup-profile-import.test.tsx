/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupProfileImportPanel } from "../app/setup-profile/SetupProfileImportPanel";
import { PasswordChangeGate } from "../app/workspace/PasswordChangeGate";
import { SignInPanel } from "../app/workspace/sign-in/SignInPanel";
import type { WorkspaceService, WorkspaceSummary } from "../lib/data/contracts";
import { navigate } from "../lib/browser-navigation";

vi.mock("../lib/browser-navigation", () => ({ navigate: vi.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const cedar: WorkspaceSummary = {
  name: "Cedar House",
  slug: "cedar-house",
  role: "admin",
};

const harbour: WorkspaceSummary = {
  name: "Harbour Tech",
  slug: "harbour-tech",
  role: "admin",
};

const employeeWorkspace: WorkspaceSummary = {
  name: "Employee Company",
  slug: "employee-company",
  role: "employee",
};

const cameraService: WorkspaceService = {
  id: "service-camera",
  workspaceId: "workspace-cedar",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Security cameras",
  description: "Install and configure a camera system.",
  durationMinutes: 90,
  active: true,
  sortOrder: 0,
  qualifications: [],
};

const alarmService: WorkspaceService = {
  ...cameraService,
  id: "service-alarm",
  slug: "alarm-installation",
  name: "Alarm installation",
  category: "Alarm systems",
  durationMinutes: 120,
  sortOrder: 1,
};

const inactiveService: WorkspaceService = {
  ...cameraService,
  id: "service-inactive",
  slug: "legacy-installation",
  name: "Legacy installation",
  active: false,
  sortOrder: 2,
};

const roots: Root[] = [];

beforeEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => act(async () => root.unmount())));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("setup profile review", () => {
  it("waits for Review setup before decoding a pasted manual code", async () => {
    const container = await renderPanel();
    expect(container.textContent).not.toContain("Import this setup?");

    await enterCodeAndReview(container, "DM1-C-I-355C");

    expect(container.textContent).toContain("Import this setup?");
    expect(container.textContent).toContain("Full service catalogue");
    expect(container.textContent).toContain("Inline widget");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-code", "That setup code is not valid."],
    ["DM1-C-F-2ZE8", "That setup code looks incomplete or mistyped."],
    ["DM3-C-F-2GA8", "Update Daymark before importing this setup code."],
  ])("gives safe distinct guidance for %s", async (code, guidance) => {
    const container = await renderPanel();

    await enterCodeAndReview(container, code);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(guidance);
    expect(container.querySelector('[role="alert"]')?.textContent).not.toContain(code);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reviews a query-provided Floating code but never imports on mount", async () => {
    const container = await renderPanel({ initialCode: "dm1-c-f-2ze7" });

    expect(container.textContent).toContain("Import this setup?");
    expect(container.textContent).toContain("Floating widget");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["DM2-P-F-34D6", "Floating widget"],
    ["DM2-P-I-2Y6D", "Inline widget"],
  ])("reviews page-specific profile %s with its %s layout", async (code, layout) => {
    const container = await renderPanel({
      initialCode: code,
      installationState: "unclaimed",
      adminWorkspaces: [],
    });

    expect(container.textContent).toContain("Page-specific service");
    expect(container.textContent).toContain(layout);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cancels without a request and clears the pending confirmation", async () => {
    const container = await renderPanel({ initialCode: "DM1-C-F-2ZE7" });

    await act(async () => buttonNamed(container, "Cancel").click());

    expect(container.textContent).not.toContain("Import this setup?");
    expect(buttonNamed(container, "Review setup")).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("existing workspace import", () => {
  it("shows one eligible administrator workspace explicitly and excludes employees", async () => {
    const container = await renderPanel({
      initialCode: "DM1-C-F-2ZE7",
      adminWorkspaces: [cedar, employeeWorkspace],
    });

    expect(container.textContent).toContain("Cedar House");
    expect(container.textContent).not.toContain("Employee Company");
    expect(container.querySelector("select")).toBeNull();
  });

  it("requires an explicit administrator choice when several are eligible", async () => {
    const container = await renderPanel({
      initialCode: "DM1-C-F-2ZE7",
      adminWorkspaces: [cedar, harbour, employeeWorkspace],
    });
    const select = container.querySelector<HTMLSelectElement>("select")!;

    expect(select.value).toBe("");
    expect(buttonNamed(container, "Import setup").disabled).toBe(true);
    expect(Array.from(select.options).map((option) => option.textContent))
      .toEqual(["Choose a workspace", "Cedar House", "Harbour Tech"]);
  });

  it("loads and visibly preselects the only active service for a page profile", async () => {
    vi.mocked(fetch).mockResolvedValue(serviceListResponse([cameraService, inactiveService]));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await settleEffects();

    expect(fetch).toHaveBeenCalledWith(
      "/api/workspace/services?workspace=cedar-house",
      { cache: "no-store" },
    );
    const select = container.querySelector<HTMLSelectElement>("#setup-profile-service")!;
    expect(select.value).toBe("service-camera");
    expect(select.selectedOptions[0]?.textContent).toContain("Camera installation");
    expect(container.textContent).not.toContain("Legacy installation");
    expect(buttonNamed(container, "Import setup").disabled).toBe(false);
  });

  it("requires a deliberate service choice when several active services are available", async () => {
    vi.mocked(fetch).mockResolvedValue(
      serviceListResponse([cameraService, inactiveService, alarmService]),
    );
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await settleEffects();

    const select = container.querySelector<HTMLSelectElement>("#setup-profile-service")!;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Choose a service",
      "Camera installation",
      "Alarm installation",
    ]);
    expect(buttonNamed(container, "Import setup").disabled).toBe(true);

    await changeSelect(select, "service-alarm");

    expect(select.value).toBe("service-alarm");
    expect(buttonNamed(container, "Import setup").disabled).toBe(false);
  });

  it("blocks page import with no active services and links to service management", async () => {
    vi.mocked(fetch).mockResolvedValue(serviceListResponse([inactiveService]));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await settleEffects();

    expect(buttonNamed(container, "Import setup").disabled).toBe(true);
    expect(container.textContent).toContain("No active services");
    expect(container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/cedar-house?view=services"]',
    )?.textContent).toContain("Manage services");
  });

  it("clears a selected service immediately when the workspace changes", async () => {
    let resolveHarbour!: (response: Response) => void;
    vi.mocked(fetch)
      .mockResolvedValueOnce(serviceListResponse([cameraService]))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveHarbour = resolve;
      }));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar, harbour],
    });
    const workspaceSelect = container.querySelector<HTMLSelectElement>("#setup-profile-workspace")!;

    await changeSelect(workspaceSelect, "cedar-house");
    await settleEffects();
    expect(container.querySelector<HTMLSelectElement>("#setup-profile-service")?.value)
      .toBe("service-camera");

    await changeSelect(workspaceSelect, "harbour-tech");

    expect(buttonNamed(container, "Import setup").disabled).toBe(true);
    expect(container.textContent).not.toContain("Camera installation");
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/workspace/services?workspace=harbour-tech",
      { cache: "no-store" },
    );

    await act(async () => resolveHarbour(serviceListResponse([{
      ...alarmService,
      workspaceId: "workspace-harbour",
    }])));
    await settleEffects();
    expect(container.querySelector<HTMLSelectElement>("#setup-profile-service")?.value)
      .toBe("service-alarm");
  });

  it("renders a clean active-service loading message", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await act(async () => Promise.resolve());

    expect(container.querySelector(".setup-profile-service-status")?.textContent)
      .toBe("Loading active services…");
    expect(container.textContent).not.toContain("â€¦");
  });

  it("ignores a stale service response from the previously selected workspace", async () => {
    let resolveCedar!: (response: Response) => void;
    let resolveHarbour!: (response: Response) => void;
    vi.mocked(fetch)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveCedar = resolve;
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveHarbour = resolve;
      }));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar, harbour],
    });
    const workspaceSelect = container.querySelector<HTMLSelectElement>("#setup-profile-workspace")!;

    await changeSelect(workspaceSelect, "cedar-house");
    await changeSelect(workspaceSelect, "harbour-tech");
    await act(async () => resolveHarbour(serviceListResponse([{
      ...alarmService,
      workspaceId: "workspace-harbour",
    }])));
    await settleEffects();
    expect(container.querySelector<HTMLSelectElement>("#setup-profile-service")?.value)
      .toBe("service-alarm");

    await act(async () => resolveCedar(serviceListResponse([cameraService])));
    await settleEffects();
    expect(container.querySelector<HTMLSelectElement>("#setup-profile-service")?.value)
      .toBe("service-alarm");
    expect(container.textContent).not.toContain("Camera installation");
  });

  it("keeps the reviewed page profile available when services fail to load and retries safely", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "private details" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(serviceListResponse([cameraService]));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await settleEffects();

    expect(container.textContent).toContain("Import this setup?");
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Services could not be loaded");
    expect(buttonNamed(container, "Import setup").disabled).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => buttonNamed(container, "Retry services").click());
    await settleEffects();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector<HTMLSelectElement>("#setup-profile-service")?.value)
      .toBe("service-camera");
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("embed-preferences"),
      expect.anything(),
    );
  });

  it("posts the selected stable service ID for a page profile and never its slug", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(serviceListResponse([cameraService, alarmService]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    const container = await renderPanel({
      initialCode: "DM2-P-I-2Y6D",
      adminWorkspaces: [cedar],
    });
    await settleEffects();
    await changeSelect(
      container.querySelector<HTMLSelectElement>("#setup-profile-service")!,
      "service-alarm",
    );

    await act(async () => buttonNamed(container, "Import setup").click());

    const [url, init] = vi.mocked(fetch).mock.calls[1];
    expect(url).toBe("/api/workspace/embed-preferences?workspace=cedar-house");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      action: "import-profile",
      code: "DM2-P-I-2Y6D",
      serviceId: "service-alarm",
    });
    expect(JSON.stringify(body)).not.toContain("alarm-installation");
    expect(navigate).toHaveBeenCalledWith("/workspace/cedar-house?view=embed");
  });

  it("posts the normalized code once, disables submission, and opens Embed on success", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    const container = await renderPanel({
      initialCode: " dm1-c-i-355c ",
      adminWorkspaces: [cedar],
    });
    const submit = buttonNamed(container, "Import setup");

    act(() => submit.click());
    expect(submit.disabled).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/workspace/embed-preferences?workspace=cedar-house",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-profile",
          code: "DM1-C-I-355C",
          serviceId: null,
        }),
      },
    );

    await act(async () => resolveResponse(new Response(JSON.stringify({
      ok: true,
      preference: {
        workspaceId: "workspace-cedar",
        defaultMode: "inline",
        defaultServiceScope: "all",
        defaultServiceId: null,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    expect(navigate).toHaveBeenCalledWith("/workspace/cedar-house?view=embed");
  });

  it("never reflects a profile code in an import failure", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: "The workspace default could not be saved. Try again.",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));
    const container = await renderPanel({
      initialCode: "DM1-C-F-2ZE7",
      adminWorkspaces: [cedar],
    });

    await act(async () => buttonNamed(container, "Import setup").click());

    const alert = container.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("Try again");
    expect(alert).not.toContain("DM1-C-F-2ZE7");
    expect(buttonNamed(container, "Import setup").disabled).toBe(false);
  });
});

describe("unclaimed and signed-out installations", () => {
  it.each([
    [" dm1-c-i-355c ", "DM1-C-I-355C"],
    [" dm2-c-i-2sps ", "DM2-C-I-2SPS"],
  ])("retains only normalized catalogue profile %s and reveals first setup", async (
    initialCode,
    canonicalCode,
  ) => {
    const container = await renderPanel({
      initialCode,
      installationState: "unclaimed",
      adminWorkspaces: [],
    });

    await act(async () => buttonNamed(container, "Import setup").click());

    expect(container.textContent).toContain("Set up Daymark.");
    expect(container.querySelector<HTMLInputElement>("#setup-code")).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>("#setup-code")?.value).toBe("");
    expect(container.textContent).not.toContain(canonicalCode);

    const form = container.querySelector("form")!;
    setInput(form, "setupCode", "separate-installer-secret");
    setInput(form, "workspaceName", "Cedar House");
    setInput(form, "workspaceSlug", "cedar-house");
    setInput(form, "displayName", "Maya Chen");
    setInput(form, "email", "maya@example.com");
    setInput(form, "password", "a secure password");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      workspaceSlug: "cedar-house",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      setupCode: "separate-installer-secret",
      setupProfileCode: canonicalCode,
    });
    expect(navigate).toHaveBeenCalledWith("/workspace/cedar-house?view=embed");
  });

  it("preserves an unclaimed page profile for mapping after first setup", async () => {
    const container = await renderPanel({
      initialCode: " dm2-p-i-2y6d ",
      installationState: "unclaimed",
      adminWorkspaces: [],
    });

    expect(container.textContent).toContain("Page-specific service");
    await act(async () => buttonNamed(container, "Import setup").click());
    expect(container.textContent).toContain("Set up Daymark.");
    expect(container.textContent).not.toContain("DM2-P-I-2Y6D");

    const form = container.querySelector("form")!;
    setInput(form, "setupCode", "separate-installer-secret");
    setInput(form, "workspaceName", "Cedar House");
    setInput(form, "workspaceSlug", "cedar-house");
    setInput(form, "displayName", "Maya Chen");
    setInput(form, "email", "maya@example.com");
    setInput(form, "password", "a secure password");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      workspaceSlug: "cedar-house",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await act(async () => form.dispatchEvent(new Event("submit", {
      bubbles: true,
      cancelable: true,
    })));

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      setupCode: "separate-installer-secret",
      setupProfileCode: "DM2-P-I-2Y6D",
    });
    expect(navigate).toHaveBeenCalledWith(
      "/setup-profile/import?code=DM2-P-I-2Y6D",
    );
  });

  it("requires sign-in and preserves the exact local return path", async () => {
    const container = await renderPanel({
      initialCode: "DM1-C-F-2ZE7",
      installationState: "sign-in-required",
      adminWorkspaces: [],
      redirectPath: "/setup-profile/import?code=DM1-C-F-2ZE7",
    });

    expect(container.textContent).toContain("Staff sign in.");
    expect(container.textContent).not.toContain("First-time setup");
    expect(container.textContent).not.toContain("Import this setup?");

    const form = container.querySelector("form")!;
    setInput(form, "email", "admin@example.com");
    setInput(form, "password", "a secure password");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(navigate).toHaveBeenCalledWith("/setup-profile/import?code=DM1-C-F-2ZE7");
  });

  it("offers setup-code import from ordinary first-time setup", async () => {
    const { container } = await render(createElement(SignInPanel, { initialView: "setup" }));

    expect(container.querySelector<HTMLAnchorElement>('a[href="/setup-profile/import"]')?.textContent)
      .toContain("Import setup code");
  });

  it("returns a forced-password-change session to the encoded import route", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const redirectPath = "/setup-profile/import?code=DM1-C-F-2ZE7";
    const { container } = await render(createElement(PasswordChangeGate, {
      displayName: "Maya Chen",
      redirectPath,
    }));
    const form = container.querySelector("form")!;
    setInput(form, "password", "a replacement password");
    setInput(form, "confirmation", "a replacement password");

    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

    expect(navigate).toHaveBeenCalledWith(redirectPath);
  });
});

type PanelProps = Parameters<typeof SetupProfileImportPanel>[0];

async function renderPanel(change: Partial<PanelProps> = {}) {
  return render(createElement(SetupProfileImportPanel, {
    initialCode: "",
    installationState: "ready",
    adminWorkspaces: [cedar],
    redirectPath: "/setup-profile/import",
    ...change,
  })).then(({ container }) => container);
}

async function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return { container, root };
}

async function enterCodeAndReview(container: HTMLElement, code: string) {
  const input = container.querySelector<HTMLInputElement>("#setup-profile-code")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => buttonNamed(container, "Review setup").click());
}

function serviceListResponse(services: WorkspaceService[]) {
  return new Response(JSON.stringify({ services }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function settleEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function buttonNamed(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(name));
  if (!button) throw new Error(`Missing button: ${name}`);
  return button;
}

function setInput(form: HTMLFormElement, name: string, value: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
