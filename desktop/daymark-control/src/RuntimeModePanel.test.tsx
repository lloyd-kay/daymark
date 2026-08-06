import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RuntimeModePanel } from "./RuntimeModePanel";

describe("RuntimeModePanel", () => {
  it("requires an explicit acknowledgement before enabling manual mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RuntimeModePanel mode="service" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Manual mode" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Client booking links and temporary public links stop working when Daymark is closed. Availability cannot be served while this computer or Daymark is offline.",
    );
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "I understand — use manual mode" }));
    expect(onChange).toHaveBeenCalledWith("manual");
  });

  it("returns to the recommended always-on service without a warning", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RuntimeModePanel mode="manual" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Always-on service" }));

    expect(onChange).toHaveBeenCalledWith("service");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
