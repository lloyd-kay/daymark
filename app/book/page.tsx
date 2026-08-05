import { LiveBookingFlow } from "../booking/LiveBookingFlow";
import { PUBLIC_PROFILE_SEEDS, toPublicEmployee } from "../../lib/data/repository";

const employees = PUBLIC_PROFILE_SEEDS.map((profile) =>
  toPublicEmployee({ ...profile }),
);

export default function BookPage() {
  return (
    <main className="daymark-site">
      <LiveBookingFlow initialEmployees={employees} />
    </main>
  );
}
