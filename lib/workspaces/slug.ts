const RESERVED_WORKSPACE_SLUGS = new Set([
  "api",
  "book",
  "embed",
  "get-daymark",
  "join",
  "sign-in",
  "workspace",
]);

export function normalizeWorkspaceSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function workspaceSlugError(value: string): string | null {
  const slug = normalizeWorkspaceSlug(value);
  if (!slug) return "Enter a booking URL.";
  if (RESERVED_WORKSPACE_SLUGS.has(slug)) {
    return "Choose a different booking URL.";
  }
  if (
    slug.length < 2
    || slug.length > 64
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
  ) {
    return "Use 2 to 64 lowercase letters, numbers, and hyphens.";
  }
  return null;
}
