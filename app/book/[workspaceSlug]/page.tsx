import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBookingFlow } from "../../booking/LiveBookingFlow";
import {
  listPublicEmployees,
  listPublicServices,
} from "../../../lib/data/repository";
import { validServiceSlug } from "../../../lib/services/eligibility";
import { resolvePublicWorkspace } from "../../../lib/workspaces/public-scope";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book an appointment — Daymark",
  description: "Choose a person and a private appointment time.",
};

export default async function CompanyBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const { workspaceSlug } = await params;
  const scope = await resolvePublicWorkspace(workspaceSlug);
  if (!scope) notFound();
  const query = searchParams ? await searchParams : {};
  if (Array.isArray(query.service)) notFound();
  const requestedSlug = typeof query.service === "string" ? query.service : undefined;
  if (requestedSlug && !validServiceSlug(requestedSlug)) notFound();
  const catalogue = await listPublicServices(scope);
  const selectedService = requestedSlug
    ? catalogue.find((service) => service.slug === requestedSlug) ?? null
    : null;
  if (requestedSlug && !selectedService) notFound();
  const employees = selectedService
    ? await listPublicEmployees(scope, selectedService.id)
    : [];
  return (
    <main className="daymark-site" data-workspace={scope.workspaceSlug}>
      <LiveBookingFlow
        workspaceSlug={scope.workspaceSlug}
        initialServices={selectedService ? [selectedService] : catalogue}
        initialServiceId={selectedService?.id}
        initialEmployees={employees}
      />
    </main>
  );
}
