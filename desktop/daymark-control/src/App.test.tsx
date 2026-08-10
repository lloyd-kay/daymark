import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const invokeMock = vi.hoisted(() => vi.fn());
const deepLinkListenerMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("./deep-links", () => ({
  listenForSetupProfileLinks: deepLinkListenerMock,
}));

const stoppedStatus = {
  state: "stopped" as const,
  mode: "service" as const,
  access: "local" as const,
  localUrl: "http://127.0.0.1:3210",
  publicUrl: null,
  version: "0.1.0",
  latestMigration: "0005_daymark_embed_preferences.sql",
  message: "Daymark is ready to start.",
};

const runningStatus = {
  ...stoppedStatus,
  state: "running" as const,
  message: null,
};

const needsAttentionStatus = {
  ...stoppedStatus,
  state: "needs_attention" as const,
  message: "Daymark is running but needs attention before it can accept bookings.",
};

beforeEach(() => {
  deepLinkListenerMock.mockResolvedValue(vi.fn());
});

afterEach(() => {
  invokeMock.mockReset();
  deepLinkListenerMock.mockReset();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

describe("Daymark Control", () => {
  it("keeps the stopped service status and primary recovery action understandable without colour", () => {
    render(<App initialStatus={stoppedStatus} />);

    expect(screen.getByRole("heading", { name: "Daymark Control" })).toBeVisible();
    expect(screen.getByText("Stopped")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start Daymark" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Open administrator workspace" })).toHaveAttribute(
      "href",
      "http://127.0.0.1:3210/workspace/sign-in",
    );
    expect(screen.getByRole("button", { name: "Create temporary test link" })).toBeEnabled();
  });

  it("uses one fixed restart command for a running Windows service", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_runtime_status") return Promise.resolve(runningStatus);
      return Promise.resolve();
    });

    render(<App initialStatus={runningStatus} />);
    fireEvent.click(screen.getByRole("button", { name: "Restart Daymark" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("restart_runtime");
    });
    expect(invokeMock).not.toHaveBeenCalledWith("stop_runtime");
    expect(invokeMock).not.toHaveBeenCalledWith("start_runtime");
  });

  it("restarts a responding service that needs attention instead of starting it again", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_runtime_status") return Promise.resolve(needsAttentionStatus);
      return Promise.resolve();
    });

    render(<App initialStatus={needsAttentionStatus} />);
    fireEvent.click(screen.getByRole("button", { name: "Restart Daymark" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("restart_runtime");
    });
    expect(invokeMock).not.toHaveBeenCalledWith("start_runtime");
  });

  it("shows only generic guidance when a setup deep link is rejected", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    deepLinkListenerMock.mockImplementation(async (onError: () => void) => {
      onError();
      return vi.fn();
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_runtime_status") return Promise.resolve(runningStatus);
      if (command === "get_setup_state") return Promise.resolve({ configured: true });
      return Promise.resolve();
    });

    render(<App initialStatus={runningStatus} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That Daymark setup link could not be opened. Use the setup code instead.",
    );
    expect(screen.queryByText(/DM1-C-|daymark:\/\//)).not.toBeInTheDocument();
  });

  it("stops the deep-link listener when Control closes", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const stopListening = vi.fn();
    deepLinkListenerMock.mockResolvedValue(stopListening);
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_runtime_status") return Promise.resolve(runningStatus);
      if (command === "get_setup_state") return Promise.resolve({ configured: true });
      return Promise.resolve();
    });

    const view = render(<App initialStatus={runningStatus} />);
    await waitFor(() => expect(deepLinkListenerMock).toHaveBeenCalledOnce());
    view.unmount();

    expect(stopListening).toHaveBeenCalledOnce();
  });
});
