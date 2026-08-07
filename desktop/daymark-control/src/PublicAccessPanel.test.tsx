import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PublicAccessPanel } from "./PublicAccessPanel";

describe("PublicAccessPanel", () => {
  it("warns before creating a temporary public link", async () => {
    const user = userEvent.setup();
    const onStartQuick = vi.fn(async () => undefined);

    render(<PublicAccessPanel access="local" onStartQuick={onStartQuick} />);
    await user.click(screen.getByRole("button", { name: "Create temporary test link" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Testing only");
    expect(screen.getByText(/address may change or stop/i)).toBeVisible();
    expect(screen.getByText(/not for real client bookings/i)).toBeVisible();
    expect(onStartQuick).not.toHaveBeenCalled();
  });

  it("starts only after the testing warning is accepted", async () => {
    const user = userEvent.setup();
    const onStartQuick = vi.fn(async () => undefined);

    render(<PublicAccessPanel access="local" onStartQuick={onStartQuick} />);
    await user.click(screen.getByRole("button", { name: "Create temporary test link" }));
    await user.click(screen.getByRole("button", { name: "I understand — create test link" }));

    expect(onStartQuick).toHaveBeenCalledTimes(1);
  });
});
