import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

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
  });
});
