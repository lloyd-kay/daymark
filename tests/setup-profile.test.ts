import { describe, expect, it } from "vitest";

import vectors from "../lib/setup-profile-vectors.json";
import {
  SetupProfileError,
  buildSetupProfileUri,
  decodeSetupProfile,
  encodeSetupProfile,
  type SetupProfileErrorCode,
} from "../lib/setup-profile";

describe("setup profile codec", () => {
  it.each([
    [{ journey: "catalogue", layout: "floating" }, "DM2-C-F-36UR"],
    [{ journey: "catalogue", layout: "inline" }, "DM2-C-I-2SPS"],
    [{ journey: "page-service", layout: "floating" }, "DM2-P-F-34D6"],
    [{ journey: "page-service", layout: "inline" }, "DM2-P-I-2Y6D"],
  ] as const)("encodes the v2 draft %j deterministically", (draft, code) => {
    expect(encodeSetupProfile(draft)).toBe(code);
    expect(decodeSetupProfile(code)).toEqual({ version: 2, ...draft });
  });

  it.each([
    ["DM1-C-F-2ZE7", "floating"],
    ["DM1-C-I-355C", "inline"],
  ] as const)("continues decoding and canonicalizing v1 code %s", (code, layout) => {
    const profile = decodeSetupProfile(`  ${code.toLowerCase()}  `);
    expect(profile).toEqual({ version: 1, journey: "catalogue", layout });
    expect(encodeSetupProfile(profile)).toBe(code);
  });

  it("keeps the TypeScript decoder aligned with the shared contract vectors", () => {
    for (const vector of vectors.valid) {
      expect(decodeSetupProfile(vector.code)).toEqual({
        version: vector.version,
        journey: vector.journey,
        layout: vector.layout,
      });
    }
    for (const code of vectors.invalid) {
      expect(() => decodeSetupProfile(code), code).toThrow(SetupProfileError);
    }
  });

  it("trims only surrounding Unicode whitespace and normalizes ASCII case", () => {
    expect(decodeSetupProfile("\u2003dm2-p-i-2y6d\u2003")).toEqual({
      version: 2,
      journey: "page-service",
      layout: "inline",
    });
    expectError("DM2-P- I-2Y6D", "invalid_format");
    expectError("DM2-P-I-2Y6D\nEXTRA", "invalid_format");
  });

  it("distinguishes checksum, version, format, and value failures", () => {
    expectError("DM2-C-F-36US", "invalid_checksum");
    expectError("DM3-C-F-2GA8", "unsupported_version");
    expectError("DM1-P-F-2ZE7", "unsupported_value");
    expectError("DM2-X-F-36UR", "unsupported_value");
    expectError("DM2-C-X-36UR", "unsupported_value");
    expectError("DM2-C-F-36UR-EXTRA", "invalid_format");
  });

  it.each([
    "",
    "DM2-C-F",
    "DM2-C-F-0ZE7",
    "DM2 C F 36UR",
    "DM2-C-F-36 U",
    "ＤM2-C-F-36UR",
    `DM2-C-F-${"A".repeat(257)}`,
  ])("rejects malformed code %j", (code) => {
    expectError(code, "invalid_format");
  });

  it("builds normalized canonical Daymark app links without upgrading v1", () => {
    expect(buildSetupProfileUri(" dm1-c-f-2ze7 ")).toBe(
      "daymark://import-setup?code=DM1-C-F-2ZE7",
    );
    expect(buildSetupProfileUri(" dm2-p-f-34d6 ")).toBe(
      "daymark://import-setup?code=DM2-P-F-34D6",
    );
    expect(() => buildSetupProfileUri("DM2-P-F-34D7")).toThrow(SetupProfileError);
  });
});

function expectError(value: string, code: SetupProfileErrorCode) {
  try {
    decodeSetupProfile(value);
    throw new Error("Expected setup profile decoding to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SetupProfileError);
    expect((error as SetupProfileError).code).toBe(code);
  }
}
