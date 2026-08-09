import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const stoppedStatus = {
  state: "stopped" as const,
  mode: "service" as const,
  access: "local" as const,
  localUrl: "http://127.0.0.1:3210",
  publicUrl: null,
  version: "0.1.0",
  latestMigration: "0002_daymark_company_workspaces.sql",
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

afterEach(() => {
  invokeMock.mockReset();
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
});
