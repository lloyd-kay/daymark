import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BackupPanel } from "./BackupPanel";

const verifiedBackup = {
  manifestFile: "C:\\ProgramData\\Daymark\\backups\\daymark-verified.json",
  createdAt: "2026-08-06T12:00:00.000Z",
  integrity: "verified" as const,
};

describe("BackupPanel", () => {
  it("creates a backup and reports its verified result", async () => {
    const user = userEvent.setup();
    render(
      <BackupPanel
        onCreate={async () => verifiedBackup}
        onVerify={async () => verifiedBackup}
        onRestore={async () => undefined}
      />,
    );

    const createButton = screen.getByRole("button", { name: "Create verified backup" });
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    expect(await screen.findByText("Integrity verified")).toBeVisible();
    expect(screen.getByText("6 August 2026 at 13:00")).toBeVisible();
  });

  it("requires an exact typed confirmation before restoring", async () => {
    const user = userEvent.setup();
    render(
      <BackupPanel
        onCreate={async () => verifiedBackup}
        onVerify={async () => verifiedBackup}
        onRestore={async () => undefined}
      />,
    );

    await user.click(screen.getByText("Restore from a backup"));
    await user.type(screen.getByLabelText("Backup manifest path"), verifiedBackup.manifestFile);
    await user.click(screen.getByRole("button", { name: "Verify backup" }));
    expect(await screen.findByText("Ready to restore")).toBeVisible();

    const restoreButton = screen.getByRole("button", { name: "Restore verified backup" });
    expect(restoreButton).toBeDisabled();
    await user.type(screen.getByLabelText("Type RESTORE to confirm"), "RESTORE");
    expect(restoreButton).toBeEnabled();
  });
});
