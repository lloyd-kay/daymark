import type { Metadata } from "next";
import { getAccountSession } from "../../../lib/auth/membership";
import {
  administratorExists,
  listAccountWorkspaces,
} from "../../../lib/auth/repository";
import { PasswordChangeGate } from "../../workspace/PasswordChangeGate";
import { SetupProfileImportPanel } from "../SetupProfileImportPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import setup — Daymark",
  description: "Review and import a transferable Daymark setup.",
};

export default async function SetupProfileImportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const initialCode = typeof query.code === "string" ? query.code : "";
  const redirectPath = initialCode
    ? `/setup-profile/import?${new URLSearchParams({ code: initialCode })}`
    : "/setup-profile/import";
  const [claimed, session] = await Promise.all([
    administratorExists(),
    getAccountSession(),
  ]);

  if (claimed && session?.mustChangePassword) {
    return (
      <PasswordChangeGate
        displayName={session.displayName}
        redirectPath={redirectPath}
      />
    );
  }

  const installationState = !claimed
    ? "unclaimed"
    : !session
      ? "sign-in-required"
      : "ready";
  const adminWorkspaces = session
    ? (await listAccountWorkspaces(session.accountId)).filter(
        (workspace) => workspace.role === "admin",
      )
    : [];

  return (
    <main className="workspace-gate setup-profile-gate">
      <header>
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Daymark</span>
        </a>
        <span>Setup import</span>
      </header>
      <SetupProfileImportPanel
        initialCode={initialCode}
        installationState={installationState}
        adminWorkspaces={adminWorkspaces}
        redirectPath={redirectPath}
      />
    </main>
  );
}
