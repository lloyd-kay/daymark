export type WidgetMode = "floating" | "inline";

export type WidgetConfig = {
  mode: WidgetMode;
  employee: string;
  label: string;
};

export type WidgetMessage =
  | { type: "daymark:resize"; channel: string; height: number }
  | { type: "daymark:close"; channel: string };

const DEFAULT_LABEL = "Book an appointment";
const EMPLOYEE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function normalizeWidgetConfig(input: Record<string, unknown>): WidgetConfig {
  const mode = input.mode === "inline" || input.mode === "floating"
    ? input.mode
    : "floating";
  const employee = typeof input.employee === "string" && EMPLOYEE_ID_PATTERN.test(input.employee)
    ? input.employee
    : "all";
  const trimmedLabel = typeof input.label === "string" ? input.label.trim() : "";
  const label = trimmedLabel.length >= 1 && trimmedLabel.length <= 80
    ? trimmedLabel
    : DEFAULT_LABEL;

  return { mode, employee, label };
}

export function validWidgetMessage(value: unknown, channel: string): value is WidgetMessage {
  if (!isRecord(value) || value.channel !== channel) return false;

  if (value.type === "daymark:close") {
    return Object.keys(value).length === 2;
  }

  if (value.type === "daymark:resize") {
    return (
      Object.keys(value).length === 3 &&
      typeof value.height === "number" &&
      Number.isInteger(value.height) &&
      value.height >= 280 &&
      value.height <= 1200
    );
  }

  return false;
}

export function framePolicyHeaders(pathname: string): Headers {
  const headers = new Headers();
  if (pathname === "/embed") {
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self' https: http://localhost:*",
    );
    return headers;
  }

  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
