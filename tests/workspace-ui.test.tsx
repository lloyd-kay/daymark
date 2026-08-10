/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedPanel, buildEmbedSnippet } from "../app/workspace/EmbedPanel";
import { ServicesPanel } from "../app/workspace/ServicesPanel";
import { TeamAccessPanel } from "../app/workspace/TeamAccessPanel";
import { WorkspaceClient } from "../app/workspace/WorkspaceClient";
import type { WorkspaceActor } from "../lib/auth/membership";
import type {
  ScheduleEntry,
  TeamProfile,
  WorkspaceEmbedPreference,
  WorkspaceService,
} from "../lib/data/contracts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const profiles: TeamProfile[] = [
  {
    id: "maya-chen",
    membershipId: "membership-maya",
    publicName: "Maya Chen",
    title: "Client partner",
    bio: "Thoughtful planning.",
    accent: "coral",
    active: true,
    sortOrder: 0,
    memberEmail: "maya@example.com",
    memberDisplayName: "Maya Chen",
    hasCredential: true,
  },
  {
    id: "theo-brooks",
    membershipId: null,
    publicName: "Theo Brooks",
    title: "Operations specialist",
    bio: "Practical sessions.",
    accent: "sage",
    active: true,
    sortOrder: 1,
    memberEmail: null,
    memberDisplayName: null,
    hasCredential: false,
  },
];

const admin: WorkspaceActor = {
  accountId: "account-admin",
  membershipId: "membership-admin",
  workspaceId: "workspace-cedar",
  workspaceName: "Cedar House",
  workspaceSlug: "cedar-house",
  employeeProfileId: null,
  role: "admin",
  email: "admin@example.com",
  displayName: "Admin User",
  mustChangePassword: false,
};

const employee: WorkspaceActor = {
  accountId: "account-maya",
  membershipId: "membership-maya",
  workspaceId: "workspace-cedar",
  workspaceName: "Cedar House",
  workspaceSlug: "cedar-house",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
  mustChangePassword: false,
};

const cameraService: WorkspaceService = {
  id: "service-camera",
  workspaceId: "workspace-cedar",
  slug: "camera-installation",
  name: "Camera installation",
  category: "Smart security",
  description: "Install and configure a camera.",
  durationMinutes: 90,
  active: true,
  sortOrder: 1,
  qualifications: [],
};

const qualifiedCamera: WorkspaceService = {
  ...cameraService,
  qualifications: [{
    id: "qualification-camera-maya",
    employeeProfileId: "maya-chen",
    serviceId: cameraService.id,
    active: true,
    method: "manual",
    certificateName: null,
    certificateReference: null,
    issuedOn: null,
    expiresOn: null,
    current: true,
  }],
};

const alarmService: WorkspaceService = {
  ...cameraService,
  id: "service-alarm",
  slug: "alarm-installation-v2",
  name: "Alarm installation",
  durationMinutes: 120,
  sortOrder: 2,
  qualifications: [{
    id: "qualification-alarm-theo",
    employeeProfileId: "theo-brooks",
    serviceId: "service-alarm",
    active: true,
    method: "manual",
    certificateName: null,
    certificateReference: null,
    issuedOn: null,
    expiresOn: null,
    current: true,
  }],
};

let roots: Root[] = [];

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(async () => {
  for (const root of roots) await act(async () => root.unmount());
  roots = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("staff access controls", () => {
  it("creates a single-use invitation without creating or exposing another account", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(201, {
      code: "private-invitation-code",
      expiresAt: "2026-08-13T00:00:00.000Z",
      message: "Access invitation created. Existing Daymark users keep their current password.",
    }));
    const { container } = await render(createElement(TeamAccessPanel, {
      workspaceSlug: "cedar-house",
      profiles,
      onProfilesChange: vi.fn(),
    }));

    await changeInput(
      container.querySelector<HTMLInputElement>('input[name="staff-email-theo-brooks"]')!,
      "theo@example.com",
    );
    const createButton = buttonNamed(container, "Create private invitation");
    await act(async () => createButton.click());

    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/team?workspace=cedar-house", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-invitation",
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        role: "employee",
        confirm: true,
      }),
    });
    expect(container.textContent).toContain("/join/private-invitation-code");
    expect(container.textContent).toContain("Existing Daymark users keep their current password.");
    await act(async () => buttonNamed(container, "Copy invitation link").click());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/join/private-invitation-code`,
    );
    await act(async () => buttonNamed(container, "Dismiss invitation link").click());
    expect(container.textContent).not.toContain("/join/private-invitation-code");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before invitation and company deactivation requests", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.mocked(fetch);
    const { container } = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange: vi.fn() }),
    );

    await changeInput(
      container.querySelector<HTMLInputElement>('input[name="staff-email-theo-brooks"]')!,
      "theo@example.com",
    );
    await act(async () => buttonNamed(container, "Create private invitation").click());
    await act(async () => buttonNamed(container, "Remove company access").click());

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores only the selected company membership after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }));
    const onProfilesChange = vi.fn();
    const inactiveProfiles = [{ ...profiles[0], active: false }];
    const { container } = await render(
      createElement(TeamAccessPanel, {
        profiles: inactiveProfiles,
        onProfilesChange,
      }),
    );

    await act(async () => buttonNamed(container, "Restore company access").click());

    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/team?workspace=daymark", expect.objectContaining({
      body: JSON.stringify({
        action: "set-active",
        employeeProfileId: "maya-chen",
        active: true,
        confirm: true,
      }),
    }));
    expect(onProfilesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "maya-chen", active: true }),
    ]);
  });
});

describe("embed configuration", () => {
  it("builds and escapes the exact hosted snippet", () => {
    expect(buildEmbedSnippet(
      "https://appointments.daymark.test",
      "floating",
      "maya-chen",
      "camera-installation",
      "Book an appointment",
    )).toBe(
      '<script src="https://appointments.daymark.test/daymark-widget.js" data-workspace="daymark" data-mode="floating" data-employee="maya-chen" data-service="camera-installation" data-label="Book an appointment"></script>',
    );
    expect(buildEmbedSnippet(
      'https://appointments.daymark.test/" onload="alert(1)',
      "inline",
      'maya-chen" onload="alert(1)',
      'camera" onload="alert(1)',
      'Book "now" & return',
    )).toBe(
      '<script src="https://appointments.daymark.test/daymark-widget.js" data-workspace="daymark" data-mode="inline" data-employee="all" data-service="all" data-label="Book &quot;now&quot; &amp; return"></script>',
    );
  });

  it("uses public profile IDs and makes no API calls", async () => {
    const fetchMock = vi.mocked(fetch);
    const { container } = await render(createElement(EmbedPanel, {
      profiles: [
        ...profiles,
        { ...profiles[1], id: "priya-shah", active: false },
        { ...profiles[1], id: 'bad" onclick="alert(1)' },
      ],
    }));

    const options = [...container.querySelectorAll("option")].map((option) => option.value);
    expect(options).toEqual(["all", "maya-chen", "theo-brooks"]);
    expect(container.querySelector("textarea")?.value).toBe(
      `<script src="${window.location.origin}/daymark-widget.js" data-workspace="daymark" data-mode="floating" data-employee="all" data-service="all" data-label="Book an appointment"></script>`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts from the persisted Inline full-catalogue workspace default", async () => {
    const initialPreference: WorkspaceEmbedPreference = {
      workspaceId: "workspace-cedar",
      defaultMode: "inline",
      defaultServiceScope: "all",
      defaultServiceId: null,
    };
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      workspaceSlug: "cedar-house",
      initialPreference,
    }));

    expect(container.querySelector<HTMLInputElement>('input[value="inline"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[value="catalogue"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-mode="inline"');
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="all"');
    expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
      .toBe(`${window.location.origin}/book/cedar-house`);
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Inline widget · Show all services");
  });

  it("restores a persisted page-specific service by stable ID and current public slug", async () => {
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      services: [qualifiedCamera, alarmService],
      workspaceSlug: "cedar-house",
      initialPreference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "service",
        defaultServiceId: "service-camera",
      },
    }));

    expect(container.querySelector<HTMLInputElement>('input[value="floating"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[value="preselected"]')?.checked).toBe(true);
    expect(container.querySelector<HTMLSelectElement>('select[name="embed-service"]')?.value)
      .toBe("service-camera");
    expect([...container.querySelectorAll<HTMLSelectElement>(
      'select[name="embed-employee"] option',
    )].map((option) => option.value)).toEqual(["all", "maya-chen"]);
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="camera-installation"');
    expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
      .toBe(`${window.location.origin}/book/cedar-house?service=camera-installation`);
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Floating widget · Camera installation");
  });

  it("keeps snippet experimentation separate until the administrator saves a default", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {
      ok: true,
      preference: {
        workspaceId: "workspace-cedar",
        defaultMode: "inline",
        defaultServiceScope: "service",
        defaultServiceId: "service-alarm",
      },
    }));
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      services: [qualifiedCamera, alarmService],
      workspaceSlug: "cedar-house",
      initialPreference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "all",
        defaultServiceId: null,
      },
    }));

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="inline"]')!.click();
      container.querySelector<HTMLInputElement>('input[value="preselected"]')!.click();
    });
    await changeSelect(
      container.querySelector<HTMLSelectElement>('select[name="embed-service"]')!,
      "service-alarm",
    );
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-mode="inline"');
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="alarm-installation-v2"');
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Floating widget · Show all services");

    await act(async () => buttonNamed(container, "Save as workspace default").click());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/embed-preferences?workspace=cedar-house",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-default",
          defaultMode: "inline",
          defaultServiceScope: "service",
          serviceId: "service-alarm",
        }),
      },
    );
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Inline widget · Alarm installation");
    expect(container.textContent).toContain("Workspace default saved.");
    expect(container.querySelector<HTMLAnchorElement>('a[href="/setup-profile/import"]'))
      .not.toBeNull();
  });

  it("saves a catalogue default with an explicit null service ID", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {
      ok: true,
      preference: {
        workspaceId: "workspace-cedar",
        defaultMode: "inline",
        defaultServiceScope: "all",
        defaultServiceId: null,
      },
    }));
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      services: [qualifiedCamera],
      workspaceSlug: "cedar-house",
      initialPreference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "service",
        defaultServiceId: "service-camera",
      },
    }));

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="inline"]')!.click();
      container.querySelector<HTMLInputElement>('input[value="catalogue"]')!.click();
    });
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="all"');
    expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
      .toBe(`${window.location.origin}/book/cedar-house`);

    await act(async () => buttonNamed(container, "Save as workspace default").click());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/embed-preferences?workspace=cedar-house",
      expect.objectContaining({
        body: JSON.stringify({
          action: "set-default",
          defaultMode: "inline",
          defaultServiceScope: "all",
          serviceId: null,
        }),
      }),
    );
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Inline widget · Show all services");
  });

  it("retains the previous default and offers retry after a failed save", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, {
      ok: false,
      error: "The workspace default could not be saved. Try again.",
    }));
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      initialPreference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "all",
        defaultServiceId: null,
      },
    }));

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="inline"]')!.click();
      buttonNamed(container, "Save as workspace default").click();
      await Promise.resolve();
    });

    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Floating widget · Show all services");
    expect(container.textContent).toContain("The workspace default could not be saved. Try again.");
    expect(buttonNamed(container, "Save as workspace default").disabled).toBe(false);
  });

  it("switches between catalogue and preselected service links and filters unqualified calendars", async () => {
    const qualifiedCamera: WorkspaceService = {
      ...cameraService,
      qualifications: [{
        id: "qualification-camera-maya",
        employeeProfileId: "maya-chen",
        serviceId: cameraService.id,
        active: true,
        method: "manual",
        certificateName: null,
        certificateReference: null,
        issuedOn: null,
        expiresOn: null,
        current: true,
      }],
    };
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      services: [qualifiedCamera],
      workspaceSlug: "cedar-house",
    }));

    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="all"');
    expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
      .toBe(`${window.location.origin}/book/cedar-house`);

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="preselected"]')!.click();
    });
    await changeSelect(
      container.querySelector<HTMLSelectElement>('select[name="embed-service"]')!,
      "service-camera",
    );

    const calendarOptions = [...container.querySelectorAll<HTMLSelectElement>(
      'select[name="embed-employee"] option',
    )].map((option) => option.value);
    expect(calendarOptions).toEqual(["all", "maya-chen"]);
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="camera-installation"');
    expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
      .toBe(`${window.location.origin}/book/cedar-house?service=camera-installation`);
  });

  it.each([
    ["missing", "service-missing", [qualifiedCamera]],
    ["inactive", "service-camera", [{ ...qualifiedCamera, active: false }, alarmService]],
  ] as const)(
    "blocks public output for a persisted %s service without falling back",
    async (_label, defaultServiceId, services) => {
      const { container } = await render(createElement(EmbedPanel, {
        profiles,
        services: [...services],
        workspaceSlug: "cedar-house",
        initialPreference: {
          workspaceId: "workspace-cedar",
          defaultMode: "floating",
          defaultServiceScope: "service",
          defaultServiceId,
        },
      }));

      expect(container.querySelector<HTMLInputElement>('input[value="preselected"]')?.checked)
        .toBe(true);
      expect(container.querySelector('[role="alert"]')?.textContent)
        .toContain("saved service is unavailable");
      expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
        .toBe("");
      expect(container.querySelector<HTMLInputElement>("#daymark-direct-booking-link")?.value)
        .toBe("");
      expect(buttonNamed(container, "Copy snippet").disabled).toBe(true);
      expect(container.querySelector(".embed-default-summary")?.textContent)
        .toBe("Workspace default: Floating widget · Unavailable service");
      expect(container.querySelector<HTMLSelectElement>('select[name="embed-service"]')?.value)
        .toBe(defaultServiceId);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("repairs an unavailable persisted mapping only after an active service is chosen and saved", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {
      ok: true,
      preference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "service",
        defaultServiceId: "service-camera",
      },
    }));
    const { container } = await render(createElement(EmbedPanel, {
      profiles,
      services: [qualifiedCamera],
      workspaceSlug: "cedar-house",
      initialPreference: {
        workspaceId: "workspace-cedar",
        defaultMode: "floating",
        defaultServiceScope: "service",
        defaultServiceId: "service-missing",
      },
    }));

    await changeSelect(
      container.querySelector<HTMLSelectElement>('select[name="embed-service"]')!,
      "service-camera",
    );

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="camera-installation"');
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Floating widget · Unavailable service");

    await act(async () => buttonNamed(container, "Save as workspace default").click());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/embed-preferences?workspace=cedar-house",
      expect.objectContaining({
        body: JSON.stringify({
          action: "set-default",
          defaultMode: "floating",
          defaultServiceScope: "service",
          serviceId: "service-camera",
        }),
      }),
    );
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Floating widget · Camera installation");
  });

  it("retains the snippet and shows safe feedback when clipboard access is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const { container } = await render(createElement(EmbedPanel, { profiles }));
    const snippet = container.querySelector("textarea")?.value;

    await act(async () => buttonNamed(container, "Copy snippet").click());

    expect(container.querySelector("textarea")?.value).toBe(snippet);
    expect(container.textContent).toContain(
      "Copy unavailable. Select the snippet and copy it manually.",
    );
  });
});

describe("workspace role gates and protected details", () => {
  it("excludes Team, Services, and Embed from employees and includes them for administrators", async () => {
    const adminView = await renderWorkspace(admin, profiles, [], [cameraService]);
    expect(findButton(adminView.container, "Team")).not.toBeNull();
    expect(findButton(adminView.container, "Services")).not.toBeNull();
    expect(findButton(adminView.container, "Embed")).not.toBeNull();

    const employeeView = await renderWorkspace(employee, [profiles[0]], []);
    expect(findButton(employeeView.container, "Team")).toBeNull();
    expect(findButton(employeeView.container, "Services")).toBeNull();
    expect(findButton(employeeView.container, "Embed")).toBeNull();
  });

  it("renders the protected service address and both available contact methods", async () => {
    const entry: ScheduleEntry = {
      id: "appointment-1",
      reference: "DM-7K4P2Q",
      serviceName: "Camera installation",
      serviceDurationMinutes: 90,
      employeeProfileId: "maya-chen",
      employeeName: "Maya Chen",
      accent: "coral",
      startAt: "2026-08-06T09:00:00.000Z",
      endAt: "2026-08-06T09:30:00.000Z",
      clientName: "Lloyd Example",
      clientAddress: "14 Example Street, London, N1 1AA",
      clientEmail: "lloyd@example.com",
      clientPhone: "+44 20 7946 0958",
      clientNote: "Planning conversation",
      status: "booked",
    };
    const { container } = await renderWorkspace(employee, [profiles[0]], [entry]);

    expect(container.textContent).toContain("14 Example Street, London, N1 1AA");
    expect(container.textContent).toContain("lloyd@example.com");
    expect(container.textContent).toContain("+44 20 7946 0958");
    expect(container.textContent).toContain("Camera installation · 1 hr 30 min");
  });

  it("opens the allowlisted Embed view supplied after a successful import", async () => {
    const { container } = await renderWorkspace(admin, profiles, [], [], "embed");

    expect(container.querySelector(".embed-panel")).not.toBeNull();
    expect(buttonNamed(container, "Embed").classList.contains("is-active")).toBe(true);
  });

  it("keeps a saved Embed default after leaving and returning to the view", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {
      ok: true,
      preference: {
        workspaceId: "workspace-cedar",
        defaultMode: "inline",
        defaultServiceScope: "service",
        defaultServiceId: "service-alarm",
      },
    }));
    const { container } = await renderWorkspace(
      admin,
      profiles,
      [],
      [qualifiedCamera, alarmService],
      "embed",
    );

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="inline"]')!.click();
      container.querySelector<HTMLInputElement>('input[value="preselected"]')!.click();
    });
    await changeSelect(
      container.querySelector<HTMLSelectElement>('select[name="embed-service"]')!,
      "service-alarm",
    );
    await act(async () => buttonNamed(container, "Save as workspace default").click());

    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Inline widget · Alarm installation");

    await act(async () => buttonNamed(container, "Schedule").click());
    expect(container.querySelector(".embed-panel")).toBeNull();
    await act(async () => buttonNamed(container, "Embed").click());

    expect(container.querySelector<HTMLInputElement>('input[value="inline"]')?.checked)
      .toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[value="preselected"]')?.checked)
      .toBe(true);
    expect(container.querySelector<HTMLSelectElement>('select[name="embed-service"]')?.value)
      .toBe("service-alarm");
    expect(container.querySelector(".embed-default-summary")?.textContent)
      .toBe("Workspace default: Inline widget · Alarm installation");
    expect(container.querySelector<HTMLTextAreaElement>("#daymark-embed-snippet")?.value)
      .toContain('data-service="alarm-installation-v2"');
  });
});

describe("service qualification controls", () => {
  it("submits a certificate-backed qualification and refreshes protected data", async () => {
    const onServicesChange = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, {
        services: [{
          ...cameraService,
          qualifications: [{
            id: "qualification-camera-maya",
            employeeProfileId: "maya-chen",
            serviceId: "service-camera",
            active: true,
            method: "certificate",
            certificateName: "Eufy Alarm Installer",
            certificateReference: "CERT-1042",
            issuedOn: "2026-01-10",
            expiresOn: "2027-01-10",
            current: true,
          }],
        }],
      }));
    const { container } = await render(createElement(ServicesPanel, {
      workspaceSlug: "cedar-house",
      profiles,
      initialServices: [cameraService],
      onServicesChange,
    }));

    await changeSelect(
      container.querySelector<HTMLSelectElement>("select[name='qualification-maya-chen']")!,
      "certificate",
    );
    await changeInput(
      container.querySelector<HTMLInputElement>("input[name='certificate-name-maya-chen']")!,
      "Eufy Alarm Installer",
    );
    await changeInput(
      container.querySelector<HTMLInputElement>("input[name='certificate-reference-maya-chen']")!,
      "CERT-1042",
    );
    await changeInput(
      container.querySelector<HTMLInputElement>("input[name='certificate-issued-maya-chen']")!,
      "2026-01-10",
    );
    await changeInput(
      container.querySelector<HTMLInputElement>("input[name='certificate-expiry-maya-chen']")!,
      "2027-01-10",
    );
    await act(async () => buttonNamed(container, "Save Maya Chen qualification").click());

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/workspace/services?workspace=cedar-house", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set-qualification",
        serviceId: "service-camera",
        employeeProfileId: "maya-chen",
        active: true,
        method: "certificate",
        certificateName: "Eufy Alarm Installer",
        certificateReference: "CERT-1042",
        issuedOn: "2026-01-10",
        expiresOn: "2027-01-10",
      }),
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/workspace/services?workspace=cedar-house",
      { cache: "no-store" },
    );
    expect(container.textContent).toContain("Current");
    expect(container.textContent).toContain("Eufy Alarm Installer");
    expect(onServicesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: cameraService.id,
        qualifications: [expect.objectContaining({ current: true })],
      }),
    ]);
  });

  it("requires confirmation before removing an existing qualification", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const qualifiedService: WorkspaceService = {
      ...cameraService,
      qualifications: [{
        id: "qualification-camera-maya",
        employeeProfileId: "maya-chen",
        serviceId: "service-camera",
        active: true,
        method: "manual",
        certificateName: null,
        certificateReference: null,
        issuedOn: null,
        expiresOn: null,
        current: true,
      }],
    };
    const { container } = await render(createElement(ServicesPanel, {
      workspaceSlug: "cedar-house",
      profiles,
      initialServices: [qualifiedService],
    }));

    await changeSelect(
      container.querySelector<HTMLSelectElement>("select[name='qualification-maya-chen']")!,
      "none",
    );
    await act(async () => buttonNamed(container, "Save Maya Chen qualification").click());

    expect(confirm).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function renderWorkspace(
  actor: WorkspaceActor,
  workspaceProfiles: TeamProfile[],
  entries: ScheduleEntry[],
  initialServices: WorkspaceService[] = [],
  initialView: "schedule" | "embed" = "schedule",
) {
  return render(createElement(WorkspaceClient, {
    actor,
    profiles: workspaceProfiles,
    initialServices,
    initialEmbedPreference: actor.role === "admin" ? {
      workspaceId: actor.workspaceId,
      defaultMode: "floating",
      defaultServiceScope: "all",
      defaultServiceId: null,
    } : null,
    initialView,
    initialEntries: entries,
    initialAvailability: {
      employeeProfileId: "maya-chen",
      rules: [],
      blocked: [],
    },
    initialRange: {
      from: "2026-08-05T00:00:00.000Z",
      to: "2026-08-12T00:00:00.000Z",
    },
    nowIso: "2026-08-05T12:00:00.000Z",
  }));
}

async function render(element: ReturnType<typeof createElement>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return { container, root };
}

function findButton(container: HTMLElement, name: string) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name,
  ) ?? null;
}

function buttonNamed(container: HTMLElement, name: string) {
  const button = findButton(container, name);
  if (!button) throw new Error(`Missing button: ${name}`);
  return button;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
}

async function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  setter?.call(select, value);
  await act(async () => select.dispatchEvent(new Event("change", { bubbles: true })));
}
