/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedPanel, buildEmbedSnippet } from "../app/workspace/EmbedPanel";
import { TeamAccessPanel } from "../app/workspace/TeamAccessPanel";
import { WorkspaceClient } from "../app/workspace/WorkspaceClient";
import type { WorkspaceActor } from "../lib/auth/membership";
import type { ScheduleEntry, TeamProfile } from "../lib/data/contracts";

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
  membershipId: "membership-admin",
  employeeProfileId: null,
  role: "admin",
  email: "admin@example.com",
  displayName: "Admin User",
  mustChangePassword: false,
};

const employee: WorkspaceActor = {
  membershipId: "membership-maya",
  employeeProfileId: "maya-chen",
  role: "employee",
  email: "maya@example.com",
  displayName: "Maya Chen",
  mustChangePassword: false,
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
  it("confirms account creation and keeps the temporary password in a dismissible one-time slip", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      jsonResponse(201, {
        membershipId: "membership-theo",
        temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV",
      }),
    );
    const onProfilesChange = vi.fn();
    const { container, root } = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange }),
    );

    await changeInput(
      container.querySelector<HTMLInputElement>('input[name="staff-email-theo-brooks"]')!,
      "theo@example.com",
    );
    const createButton = buttonNamed(container, "Create staff account");
    await act(async () => createButton.click());

    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-account",
        employeeProfileId: "theo-brooks",
        email: "theo@example.com",
        displayName: "Theo Brooks",
        confirm: true,
      }),
    });
    expect(container.textContent).toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    expect(onProfilesChange).toHaveBeenCalledWith([
      profiles[0],
      expect.objectContaining({
        id: "theo-brooks",
        membershipId: "membership-theo",
        memberEmail: "theo@example.com",
        memberDisplayName: "Theo Brooks",
        hasCredential: true,
      }),
    ]);

    await act(async () => buttonNamed(container, "Copy temporary password").click());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "ABCDE-FGHJK-LMNPQ-RSTUV",
    );
    await act(async () => buttonNamed(container, "Dismiss temporary password").click());
    expect(container.textContent).not.toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    roots = roots.filter((candidate) => candidate !== root);
    const remounted = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange }),
    );
    expect(remounted.container.textContent).not.toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before reset and deactivation requests", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.mocked(fetch);
    const { container } = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange: vi.fn() }),
    );

    await act(async () => buttonNamed(container, "Reset temporary password").click());
    await act(async () => buttonNamed(container, "Deactivate").click());

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replaces a successful reset slip without retaining the previous password", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(200, {
        temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV",
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        temporaryPassword: "VWXYZ-23456-789AB-CDEFG",
      }));
    const { container } = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange: vi.fn() }),
    );

    await act(async () => buttonNamed(container, "Reset temporary password").click());
    expect(container.textContent).toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    await act(async () => buttonNamed(container, "Reset temporary password").click());

    expect(container.querySelectorAll(".temporary-password-slip")).toHaveLength(1);
    expect(container.textContent).not.toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    expect(container.textContent).toContain("VWXYZ-23456-789AB-CDEFG");
  });

  it("retains the one-time password and shows safe feedback when clipboard access is denied", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {
      temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV",
    }));
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("clipboard permission denied"),
    );
    const { container } = await render(
      createElement(TeamAccessPanel, { profiles, onProfilesChange: vi.fn() }),
    );
    await act(async () => buttonNamed(container, "Reset temporary password").click());

    await act(async () => buttonNamed(container, "Copy temporary password").click());

    expect(container.textContent).toContain("ABCDE-FGHJK-LMNPQ-RSTUV");
    expect(container.textContent).toContain(
      "Copy unavailable. Select the temporary password and copy it manually.",
    );
  });

  it("activates a linked staff account after confirmation", async () => {
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

    await act(async () => buttonNamed(container, "Activate").click());

    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/team", expect.objectContaining({
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
      "Book an appointment",
    )).toBe(
      '<script src="https://appointments.daymark.test/daymark-widget.js" data-mode="floating" data-employee="maya-chen" data-label="Book an appointment"></script>',
    );
    expect(buildEmbedSnippet(
      'https://appointments.daymark.test/" onload="alert(1)',
      "inline",
      'maya-chen" onload="alert(1)',
      'Book "now" & return',
    )).toBe(
      '<script src="https://appointments.daymark.test/daymark-widget.js" data-mode="inline" data-employee="all" data-label="Book &quot;now&quot; &amp; return"></script>',
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
      `<script src="${window.location.origin}/daymark-widget.js" data-mode="floating" data-employee="all" data-label="Book an appointment"></script>`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
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
  it("excludes Team and Embed from employees and includes both for administrators", async () => {
    const adminView = await renderWorkspace(admin, profiles, []);
    expect(findButton(adminView.container, "Team")).not.toBeNull();
    expect(findButton(adminView.container, "Embed")).not.toBeNull();

    const employeeView = await renderWorkspace(employee, [profiles[0]], []);
    expect(findButton(employeeView.container, "Team")).toBeNull();
    expect(findButton(employeeView.container, "Embed")).toBeNull();
  });

  it("renders the protected service address and both available contact methods", async () => {
    const entry: ScheduleEntry = {
      id: "appointment-1",
      reference: "DM-7K4P2Q",
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
  });
});

async function renderWorkspace(
  actor: WorkspaceActor,
  workspaceProfiles: TeamProfile[],
  entries: ScheduleEntry[],
) {
  return render(createElement(WorkspaceClient, {
    actor,
    profiles: workspaceProfiles,
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
