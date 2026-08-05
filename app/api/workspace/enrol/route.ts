import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { performEnrolment } from "../../../../lib/auth/enrolment";
import {
  claimAdministrator,
  redeemInvitation,
} from "../../../../lib/data/repository";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const identity = user
    ? { userId: user.userId, email: user.email, displayName: user.displayName }
    : null;
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const result = await performEnrolment(identity, body, {
    claimAdministrator: (actor, code) =>
      claimAdministrator(
        actor,
        code,
        String((env as Record<string, unknown>).DAYMARK_SETUP_CODE ?? ""),
      ),
    redeemInvitation: (actor, code) => redeemInvitation(actor, code),
  });

  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
