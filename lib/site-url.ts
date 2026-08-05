type RequestOriginHeaders = {
  forwardedHost: string | null;
  forwardedProto: string | null;
  host: string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function requestOrigin({
  forwardedHost,
  forwardedProto,
  host,
}: RequestOriginHeaders) {
  const resolvedHost =
    firstHeaderValue(forwardedHost) ?? firstHeaderValue(host) ?? "localhost:3000";
  const forwardedProtocol = firstHeaderValue(forwardedProto);
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : resolvedHost.startsWith("localhost") || resolvedHost.startsWith("127.0.0.1")
        ? "http"
        : "https";

  return `${protocol}://${resolvedHost}`;
}
