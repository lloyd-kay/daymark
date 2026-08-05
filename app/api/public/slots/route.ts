import { noStoreJson } from "../../../../lib/http";
import { createPublicBookingService } from "../../../../lib/public-booking";
import {
  createBooking,
  listPublicEmployees,
  listPublicSlots,
} from "../../../../lib/data/repository";

const service = createPublicBookingService({
  listPublicEmployees,
  listPublicSlots,
  createBooking,
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await service.slots({
    employeeId: url.searchParams.get("employeeId"),
    from: url.searchParams.get("from"),
  });
  return noStoreJson(result.body, result.status);
}
