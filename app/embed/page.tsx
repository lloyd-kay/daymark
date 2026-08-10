import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBookingFlow } from "../booking/LiveBookingFlow";
import {
  listPublicEmployees,
  listPublicServices,
} from "../../lib/data/repository";
import { resolvePublicWorkspace } from "../../lib/workspaces/public-scope";
import { resolveWidgetBooking } from "../../lib/widget/booking-selection";
import { normalizeWidgetConfig } from "../../lib/widget/protocol";
import { EmbedBridge } from "./EmbedBridge";

export const metadata: Metadata = {
  title: "Daymark appointment booking.",
  description: "Book a private appointment with Daymark.",
};

const CHANNEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,79})$/;

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (Array.isArray(query.workspace)) notFound();
  const workspace = singleValue(query.workspace);
  if (!workspace) notFound();
  const scope = await resolvePublicWorkspace(workspace);
  if (!scope) notFound();
  if (Array.isArray(query.employee)) notFound();
  const employee = singleValue(query.employee) ?? "all";
  if (Array.isArray(query.service)) notFound();
  const service = singleValue(query.service) ?? "all";
  const channel = singleValue(query.channel);
  const config = normalizeWidgetConfig({ mode: "inline", employee, service });

  if (
    config.employee !== employee
    || config.service !== service
    || !channel
    || !CHANNEL_PATTERN.test(channel)
  ) {
    notFound();
  }
  const selection = await resolveWidgetBooking(
    scope,
    config,
    {
      listServices: listPublicServices,
      listEmployees: listPublicEmployees,
    },
  );
  if (!selection) notFound();

  return (
    <main className="embed-shell">
      <LiveBookingFlow
        workspaceSlug={scope.workspaceSlug}
        embedded
        initialServices={selection.initialServices}
        initialEmployees={selection.initialEmployees}
        initialServiceId={selection.initialServiceId}
        initialEmployeeId={selection.initialEmployeeId}
      />
      <EmbedBridge channel={channel} />
    </main>
  );
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
