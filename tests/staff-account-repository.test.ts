import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudflare = vi.hoisted(() => ({ env: { DB: null as unknown } }));
vi.mock("cloudflare:workers", () => ({ env: cloudflare.env }));

import {
  insertStaffCredential,
  replaceStaffPasswordVerifier,
  setStaffActiveState,
} from "../lib/auth/repository";

const verifier = {
  hash: "derived-password-hash",
  salt: "random-salt",
  iterations: 210_000,
};

type BatchResponse = Array<{ meta: { changes: number }; results: unknown[]; success: true }>;

class FakeD1Statement {
  params: unknown[] = [];

  constructor(
    readonly query: string,
    private readonly owner: FakeD1,
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async raw() {
    return this.owner.rawResults.shift() ?? [];
  }

  async all() {
    return { results: this.owner.objectResults.shift() ?? [] };
  }

  async run() {
    return changed(1);
  }
}

class FakeD1 {
  readonly batches: FakeD1Statement[][] = [];
  readonly prepared: FakeD1Statement[] = [];
  readonly rawResults: unknown[][][] = [];
  readonly objectResults: Record<string, unknown>[][] = [];
  private outcomes: Array<BatchResponse | Error>;

  constructor(...outcomes: Array<BatchResponse | Error>) {
    this.outcomes = outcomes;
  }

  prepare(query: string) {
    const statement = new FakeD1Statement(query, this);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeD1Statement[]) {
    this.batches.push(statements);
    const outcome = this.outcomes.shift() ?? [];
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}

beforeEach(() => {
  cloudflare.env.DB = null;
});

describe("staff repository validation", () => {
  it("rejects direct mutations when the administrator membership is not active", async () => {
    const createD1 = configureD1(successfulCreate());
    await expect(insertStaffCredential(
      "inactive-admin",
      createInput(),
    )).resolves.toBeNull();
    expect(createD1.batches).toHaveLength(0);

    const resetD1 = configureD1([changed(1), changed(1)]);
    await expect(replaceStaffPasswordVerifier(
      "inactive-admin",
      "maya-chen",
      verifier,
      true,
    )).resolves.toBe(false);
    expect(resetD1.batches).toHaveLength(0);

    const activeD1 = configureD1([changed(1), changed(1), changed(1)]);
    await expect(setStaffActiveState(
      "inactive-admin",
      "maya-chen",
      false,
      true,
    )).resolves.toBeNull();
    expect(activeD1.batches).toHaveLength(0);
  });

  it("rejects missing confirmation and unsafe direct create inputs before D1", async () => {
    for (const input of [
      createInput({ confirm: false }),
      createInput({ employeeProfileId: "../maya" }),
      createInput({ email: " MAYA@example.com " }),
      createInput({ email: "not-an-email" }),
      createInput({ displayName: " Maya Chen " }),
      createInput({ displayName: "" }),
      createInput({ displayName: "x".repeat(81) }),
    ]) {
      const d1 = configureD1(successfulCreate());
      seedCreateLookups(d1);
      await expect(insertStaffCredential("membership-admin", input)).resolves.toBeNull();
      expect(d1.batches).toHaveLength(0);
    }
  });

  it("rejects missing confirmation and unsafe IDs for reset and active changes", async () => {
    const resetD1 = configureD1([changed(1), changed(1)]);
    seedResetLookups(resetD1);
    await expect(replaceStaffPasswordVerifier(
      "membership-admin",
      "maya-chen",
      verifier,
      false,
    )).resolves.toBe(false);
    expect(resetD1.batches).toHaveLength(0);

    const activeD1 = configureD1([changed(1), changed(1), changed(1)]);
    seedActiveLookups(activeD1);
    await expect(setStaffActiveState(
      "membership-admin",
      "../maya",
      false,
      true,
    )).resolves.toBeNull();
    expect(activeD1.batches).toHaveLength(0);
  });
});

describe("staff repository atomic write contracts", () => {
  it("creates all three linked records conditionally and returns the real membership ID", async () => {
    const d1 = configureD1(successfulCreate());
    seedCreateLookups(d1);

    const account = await insertStaffCredential(
      "membership-admin",
      createInput(),
    );

    expect(account?.membershipId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(d1.batches).toHaveLength(1);
    expect(d1.batches[0]).toHaveLength(3);
    const queries = d1.batches[0].map((statement) => statement.query).join("\n");
    expect(queries).toContain("select");
    expect(queries).toContain('"employee_profiles"."membership_id" is null');
    expect(queries).toContain('"memberships"."role" = ?');
    expect(queries).toContain('"memberships"."active" = ?');
    expect(JSON.stringify(d1.batches[0].map((statement) => statement.params)))
      .not.toContain("temporary-password");
  });

  it("does not report creation success when a concurrency-shaped link write changes zero rows", async () => {
    const d1 = configureD1([changed(1), changed(1), changed(0)]);
    seedCreateLookups(d1);

    await expect(insertStaffCredential(
      "membership-admin",
      createInput(),
    )).resolves.toBeNull();
  });

  it("does not report password reset success when its conditional verifier write changes zero rows", async () => {
    const d1 = configureD1([changed(0), changed(0)]);
    seedResetLookups(d1);

    await expect(replaceStaffPasswordVerifier(
      "membership-admin",
      "maya-chen",
      verifier,
      true,
    )).resolves.toBe(false);
  });

  it("requires an active administrator and current linked employee in every active-state write", async () => {
    const d1 = configureD1([changed(0), changed(0), changed(0)]);
    seedActiveLookups(d1);

    await expect(setStaffActiveState(
      "membership-admin",
      "maya-chen",
      false,
      true,
    )).resolves.toBeNull();

    const queries = d1.batches[0].map((statement) => statement.query).join("\n");
    expect(queries).toContain('"memberships"."role" = ?');
    expect(queries).toContain('"memberships"."active" = ?');
    expect(queries).toContain('"employee_profiles"."membership_id"');
  });

  it("atomically revokes sessions with deactivation and never revives them on activation", async () => {
    const d1 = configureD1(
      new Error("atomic D1 batch failed"),
      [changed(1), changed(1)],
    );
    seedActiveLookups(d1);

    await expect(setStaffActiveState(
      "membership-admin",
      "maya-chen",
      false,
      true,
    )).rejects.toThrow("atomic D1 batch failed");
    await expect(setStaffActiveState(
      "membership-admin",
      "maya-chen",
      true,
      true,
    )).resolves.toEqual({ membershipId: "membership-maya" });

    expect(d1.batches[0]).toHaveLength(3);
    expect(d1.batches[0][2].query).toContain('update "auth_sessions" set "revoked_at"');
    expect(d1.batches[1]).toHaveLength(2);
    expect(d1.batches[1].map((statement) => statement.query).join("\n"))
      .not.toContain('"revoked_at" = null');
  });
});

function createInput(change: Record<string, unknown> = {}) {
  return {
    employeeProfileId: "maya-chen",
    email: "maya@example.com",
    displayName: "Maya Chen",
    verifier,
    confirm: true,
    ...change,
  };
}

function changed(changes: number) {
  return { meta: { changes }, results: [], success: true as const };
}

function successfulCreate() {
  return [changed(1), changed(1), changed(1)];
}

function configureD1(...outcomes: Array<BatchResponse | Error>) {
  const d1 = new FakeD1(...outcomes);
  cloudflare.env.DB = d1;
  return d1;
}

function seedCreateLookups(d1: FakeD1) {
  d1.rawResults.push([["membership-admin"]], [["maya-chen"]]);
}

function seedResetLookups(d1: FakeD1) {
  d1.rawResults.push(
    [["membership-admin"]],
    [["membership-maya", "employee", true, true, "membership-maya"]],
  );
}

function seedActiveLookups(d1: FakeD1) {
  d1.rawResults.push(
    [["membership-admin"]],
    [["membership-maya", "employee", "membership-maya"]],
    [["membership-admin"]],
    [["membership-maya", "employee", "membership-maya"]],
  );
}
