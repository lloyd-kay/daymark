import { noStoreJson, safeJson } from "../../../../lib/http";
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

export async function POST(request: Request) {
  const result = await service.book(await safeJson(request));
  return noStoreJson(result.body, result.status);
}
