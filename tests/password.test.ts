import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  generateTemporaryPassword,
  hashOpaqueValue,
  hashPassword,
  validPermanentPassword,
  verifyPassword,
} from "../lib/auth/password";

describe("password protection", () => {
  it("derives a salted PBKDF2 verifier and rejects the wrong password", async () => {
    const verifier = await hashPassword("correct horse battery staple");
    expect(verifier.iterations).toBe(210_000);
    expect(verifier.hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", verifier)).toBe(true);
    expect(await verifyPassword("incorrect horse battery staple", verifier)).toBe(false);
  });

  it("enforces 12 to 128 characters without composition rules", () => {
    expect(validPermanentPassword("long passphrase")).toBe(true);
    expect(validPermanentPassword("too short")).toBe(false);
    expect(validPermanentPassword("x".repeat(129))).toBe(false);
  });

  it("creates non-readable temporary passwords and opaque session tokens", async () => {
    const temporary = generateTemporaryPassword();
    const token = generateSessionToken();
    expect(temporary).toMatch(/^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashOpaqueValue(token)).not.toBe(token);
  });
});
