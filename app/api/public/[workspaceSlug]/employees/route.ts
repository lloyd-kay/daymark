import { createBooking, listPublicEmployees, listPublicSlots } from "../../../../../lib/data/repository";
import { noStoreJson } from "../../../../../lib/http";
import { createPublicBookingService } from "../../../../../lib/public-booking";
import { resolvePublicWorkspace } from "../../../../../lib/workspaces/public-scope";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string } },
) {
  const { workspaceSlug } = await context.params;
  const scope = await resolvePublicWorkspace(workspaceSlug);
  if (!scope) return notFound();
  const result = await createPublicBookingService(scope, {
    listPublicEmployees,
    listPublicSlots,
    createBooking,
  }).employees();
  return noStoreJson(result.body, result.status);
}

function notFound() {
  return noStoreJson({ ok: false, error: "Booking page not found." }, 404);
}
