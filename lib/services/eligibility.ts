export type QualificationMethod = "manual" | "certificate";

const SERVICE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const RESERVED_SERVICE_SLUGS = new Set(["all"]);

export function normalizeServiceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function validServiceSlug(value: unknown): value is string {
  return typeof value === "string"
    && SERVICE_SLUG.test(value)
    && !RESERVED_SERVICE_SLUGS.has(value);
}

export function validServiceDuration(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 15
    && value <= 480
    && value % 15 === 0;
}

export function validDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

export function qualificationIsCurrent(
  value: {
    active: boolean;
    method: QualificationMethod;
    expiresOn: string | null;
  },
  today: string,
): boolean {
  if (!value.active) return false;
  if (value.method === "manual") return true;
  return validDateOnly(value.expiresOn) && value.expiresOn >= today;
}
