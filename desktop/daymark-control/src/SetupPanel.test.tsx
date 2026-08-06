import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SetupPanel } from "./SetupPanel";

describe("SetupPanel", () => {
  it("keeps the protected code hidden until the user explicitly reveals it", async () => {
    const user = userEvent.setup();
    const setupCode = "AAAAA-AAAAA-AAAAA-AAAAA";

    render(
      <SetupPanel
        configured
        onReveal={async () => setupCode}
        onCopy={async () => undefined}
      />,
    );

    expect(screen.queryByText(setupCode)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reveal setup code" }));
    expect(await screen.findByText(setupCode)).toBeVisible();
  });

  it("clears a revealed code when the window loses focus", async () => {
    const user = userEvent.setup();
    const setupCode = "AAAAA-AAAAA-AAAAA-AAAAA";

    render(
      <SetupPanel
        configured
        onReveal={async () => setupCode}
        onCopy={async () => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reveal setup code" }));
    expect(await screen.findByText(setupCode)).toBeVisible();

    window.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(screen.queryByText(setupCode)).not.toBeInTheDocument());
  });
});
