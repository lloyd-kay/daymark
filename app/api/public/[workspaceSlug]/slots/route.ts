import {
  createBooking,
  listPublicEmployees,
  listPublicServices,
  listPublicSlots,
} from "../../../../../lib/data/repository";
import { noStoreJson } from "../../../../../lib/http";
import { createPublicBookingService } from "../../../../../lib/public-booking";
import { resolvePublicWorkspace } from "../../../../../lib/workspaces/public-scope";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceSlug: string }> | { workspaceSlug: string } },
) {
  const { workspaceSlug } = await context.params;
  const scope = await resolvePublicWorkspace(workspaceSlug);
  if (!scope) return notFound();
  const url = new URL(request.url);
  const result = await createPublicBookingService(scope, {
    listPublicServices,
    listPublicEmployees,
    listPublicSlots,
    createBooking,
  }).slots({
    serviceId: url.searchParams.get("serviceId"),
    employeeId: url.searchParams.get("employeeId"),
    from: url.searchParams.get("from"),
  });
  return noStoreJson(result.body, result.status);
}

function notFound() {
  return noStoreJson({ ok: false, error: "Booking page not found." }, 404);
}
