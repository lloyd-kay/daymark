import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBookingFlow } from "../booking/LiveBookingFlow";
import { PUBLIC_PROFILE_SEEDS, toPublicEmployee } from "../../lib/data/repository";
import { normalizeWidgetConfig } from "../../lib/widget/protocol";
import { EmbedBridge } from "./EmbedBridge";

export const metadata: Metadata = {
  title: "Daymark appointment booking.",
  description: "Book a private appointment with Daymark.",
};

const employees = PUBLIC_PROFILE_SEEDS.map((profile) =>
  toPublicEmployee({ ...profile }),
);
const CHANNEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,79})$/;

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const employee = singleValue(query.employee) ?? "all";
  const channel = singleValue(query.channel);
  const config = normalizeWidgetConfig({ mode: "inline", employee });

  if (config.employee !== employee || !channel || !CHANNEL_PATTERN.test(channel)) {
    notFound();
  }

  return (
    <main className="embed-shell">
      <LiveBookingFlow
        embedded
        initialEmployees={employees}
        initialEmployeeId={employee === "all" ? undefined : employee}
      />
      <EmbedBridge channel={channel} />
    </main>
  );
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
