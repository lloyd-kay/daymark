/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedPanel, buildEmbedSnippet } from "../app/workspace/EmbedPanel";
import { TeamAccessPanel } from "../app/workspace/TeamAccessPanel";
import type { TeamProfile } from "../lib/data/contracts";

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
      jsonResponse(201, { temporaryPassword: "ABCDE-FGHJK-LMNPQ-RSTUV" }),
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
});

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
