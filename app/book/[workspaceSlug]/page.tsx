import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBookingFlow } from "../../booking/LiveBookingFlow";
import { listPublicEmployees } from "../../../lib/data/repository";
import { resolvePublicWorkspace } from "../../../lib/workspaces/public-scope";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book an appointment — Daymark",
  description: "Choose a person and a private appointment time.",
};

export default async function CompanyBookPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string };
}) {
  const { workspaceSlug } = await params;
  const scope = await resolvePublicWorkspace(workspaceSlug);
  if (!scope) notFound();
  const employees = await listPublicEmployees(scope);
  return (
    <main className="daymark-site" data-workspace={scope.workspaceSlug}>
      <LiveBookingFlow
        workspaceSlug={scope.workspaceSlug}
        initialEmployees={employees}
      />
    </main>
  );
}
