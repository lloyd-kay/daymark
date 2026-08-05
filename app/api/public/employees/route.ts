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

export async function GET() {
  const result = await service.employees();
  return noStoreJson(result.body, result.status);
}
