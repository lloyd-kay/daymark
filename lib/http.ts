export function noStoreJson(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
