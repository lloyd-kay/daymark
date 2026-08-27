import { and, asc, desc, eq } from "drizzle-orm";
import {
  employeeProfiles,
  employeeServiceQualifications,
  memberships,
  services,
  workspaces,
} from "../../db/schema";
import type {
  QualificationInput,
  ServiceAdminScope,
  ServiceDetailsInput,
  ServiceUpdateInput,
} from "../service-management";
import {
  normalizeServiceSlug,
  qualificationIsCurrent,
  validDateOnly,
  validServiceDuration,
  validServiceSlug,
} from "../services/eligibility";
import { toLondonDateKey } from "../scheduling/slots";
import type { WorkspaceService } from "./contracts";

export async function listWorkspaceServices(
  scope: { workspaceId: string },
  now = new Date(),
): Promise<WorkspaceService[]> {
  const db = await database();
  const serviceRows = await db
    .select({
      id: services.id,
      workspaceId: services.workspaceId,
      slug: services.slug,
      name: services.name,
      category: services.category,
      description: services.description,
      durationMinutes: services.durationMinutes,
      active: services.active,
      sortOrder: services.sortOrder,
    })
    .from(services)
    .where(eq(services.workspaceId, scope.workspaceId))
    .orderBy(asc(services.sortOrder), asc(services.name));
  const qualificationRows = await db
    .select({
      id: employeeServiceQualifications.id,
      employeeProfileId: employeeServiceQualifications.employeeProfileId,
      serviceId: employeeServiceQualifications.serviceId,
      method: employeeServiceQualifications.method,
      certificateName: employeeServiceQualifications.certificateName,
      certificateReference: employeeServiceQualifications.certificateReference,
      issuedOn: employeeServiceQualifications.issuedOn,
      expiresOn: employeeServiceQualifications.expiresOn,
      active: employeeServiceQualifications.active,
    })
    .from(employeeServiceQualifications)
    .where(eq(employeeServiceQualifications.workspaceId, scope.workspaceId));
  const today = toLondonDateKey(now);

  return serviceRows.map((service) => ({
    ...service,
    qualifications: qualificationRows
      .filter((qualification) => qualification.serviceId === service.id)
      .map((qualification) => ({
        ...qualification,
        current: qualificationIsCurrent(qualification, today),
      })),
  }));
}

export async function createWorkspaceService(
  admin: ServiceAdminScope,
  input: ServiceDetailsInput,
): Promise<boolean> {
  if (!validServiceDetails(input)) return false;
  const db = await database();
  if (!await administratorIsActive(db, admin)) return false;

  const slugBase = normalizeServiceSlug(input.name);
  if (!validServiceSlug(slugBase)) return false;
  const existing = await db
    .select({ slug: services.slug })
    .from(services)
    .where(eq(services.workspaceId, admin.workspaceId));
  const slug = availableSlug(slugBase, new Set(existing.map((row) => row.slug)));
  if (!slug) return false;
  const [lastService] = await db
    .select({ sortOrder: services.sortOrder })
    .from(services)
    .where(eq(services.workspaceId, admin.workspaceId))
    .orderBy(desc(services.sortOrder))
    .limit(1);
  const timestamp = new Date().toISOString();

  try {
    await db.insert(services).values({
      id: crypto.randomUUID(),
      workspaceId: admin.workspaceId,
      slug,
      ...input,
      active: true,
      sortOrder: (lastService?.sortOrder ?? -1) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return true;
  } catch (error) {
    if (isUniqueConstraint(error)) return false;
    throw error;
  }
}

export async function updateWorkspaceService(
  admin: ServiceAdminScope,
  input: ServiceUpdateInput,
): Promise<boolean> {
  if (!validOpaqueId(input.serviceId) || !validServiceDetails(input)) return false;
  const db = await database();
  if (!await administratorIsActive(db, admin)) return false;
  const [updated] = await db
    .update(services)
    .set({
      name: input.name,
      category: input.category,
      description: input.description,
      durationMinutes: input.durationMinutes,
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(services.id, input.serviceId),
      eq(services.workspaceId, admin.workspaceId),
    ))
    .returning({ id: services.id });
  return Boolean(updated);
}

export async function setWorkspaceServiceActive(
  admin: ServiceAdminScope,
  serviceId: string,
  active: boolean,
): Promise<boolean> {
  if (!validOpaqueId(serviceId) || typeof active !== "boolean") return false;
  const db = await database();
  if (!await administratorIsActive(db, admin)) return false;
  const [updated] = await db
    .update(services)
    .set({ active, updatedAt: new Date().toISOString() })
    .where(and(
      eq(services.id, serviceId),
      eq(services.workspaceId, admin.workspaceId),
    ))
    .returning({ id: services.id });
  return Boolean(updated);
}

export async function setEmployeeServiceQualification(
  admin: ServiceAdminScope,
  input: QualificationInput,
): Promise<boolean> {
  if (!validQualificationInput(input)) return false;
  const db = await database();
  if (!await administratorIsActive(db, admin)) return false;
  const [[service], [profile]] = await Promise.all([
    db
      .select({ id: services.id })
      .from(services)
      .where(and(
        eq(services.id, input.serviceId),
        eq(services.workspaceId, admin.workspaceId),
      ))
      .limit(1),
    db
      .select({ id: employeeProfiles.id })
      .from(employeeProfiles)
      .where(and(
        eq(employeeProfiles.id, input.employeeProfileId),
        eq(employeeProfiles.workspaceId, admin.workspaceId),
      ))
      .limit(1),
  ]);
  if (!service || !profile) return false;

  const timestamp = new Date().toISOString();
  if (!input.active) {
    const [updated] = await db
      .update(employeeServiceQualifications)
      .set({ active: false, updatedAt: timestamp })
      .where(and(
        eq(employeeServiceQualifications.workspaceId, admin.workspaceId),
        eq(employeeServiceQualifications.serviceId, input.serviceId),
        eq(employeeServiceQualifications.employeeProfileId, input.employeeProfileId),
      ))
      .returning({ id: employeeServiceQualifications.id });
    return Boolean(updated);
  }

  const certificate = input.method === "manual"
    ? {
        certificateName: null,
        certificateReference: null,
        issuedOn: null,
        expiresOn: null,
      }
    : {
        certificateName: input.certificateName,
        certificateReference: input.certificateReference,
        issuedOn: input.issuedOn,
        expiresOn: input.expiresOn,
      };
  await db
    .insert(employeeServiceQualifications)
    .values({
      id: crypto.randomUUID(),
      workspaceId: admin.workspaceId,
      employeeProfileId: input.employeeProfileId,
      serviceId: input.serviceId,
      method: input.method,
      ...certificate,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [
        employeeServiceQualifications.workspaceId,
        employeeServiceQualifications.employeeProfileId,
        employeeServiceQualifications.serviceId,
      ],
      set: {
        method: input.method,
        ...certificate,
        active: true,
        updatedAt: timestamp,
      },
    });
  return true;
}

function availableSlug(base: string, used: Set<string>): string | null {
  if (!used.has(base)) return base;
  for (let index = 2; index <= 99; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, 64 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (validServiceSlug(candidate) && !used.has(candidate)) return candidate;
  }
  return null;
}

function validServiceDetails(input: ServiceDetailsInput): boolean {
  return validBoundedText(input.name, 80, false)
    && validBoundedText(input.category, 80, false)
    && validBoundedText(input.description, 500, true)
    && validServiceDuration(input.durationMinutes);
}

function validQualificationInput(input: QualificationInput): boolean {
  if (
    !validOpaqueId(input.serviceId)
    || !validOpaqueId(input.employeeProfileId)
    || typeof input.active !== "boolean"
    || (input.method !== "manual" && input.method !== "certificate")
  ) return false;
  if (!input.active || input.method === "manual") return true;
  return validBoundedText(input.certificateName, 120, false)
    && validNullableBoundedText(input.certificateReference, 120)
    && validNullableDate(input.issuedOn)
    && validDateOnly(input.expiresOn)
    && (!input.issuedOn || input.issuedOn <= input.expiresOn);
}

function validBoundedText(
  value: unknown,
  maximum: number,
  allowEmpty: boolean,
): value is string {
  return typeof value === "string"
    && value === value.trim()
    && (allowEmpty || value.length > 0)
    && value.length <= maximum
    && !value.includes(String.fromCharCode(0));
}

function validNullableBoundedText(value: unknown, maximum: number): boolean {
  return value === null || validBoundedText(value, maximum, false);
}

function validNullableDate(value: unknown): value is string | null {
  return value === null || validDateOnly(value);
}

function validOpaqueId(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
}

async function administratorIsActive(
  db: Awaited<ReturnType<typeof database>>,
  admin: ServiceAdminScope,
): Promise<boolean> {
  const [administrator] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(
      eq(memberships.id, admin.membershipId),
      eq(memberships.workspaceId, admin.workspaceId),
      eq(memberships.role, "admin"),
      eq(memberships.active, true),
      eq(workspaces.active, true),
    ))
    .limit(1);
  return Boolean(administrator);
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

async function database() {
  const { getDb } = await import("../../db");
  return getDb();
}
