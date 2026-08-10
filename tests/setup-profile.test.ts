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
    ["floating", "DM1-C-F-2ZE7"],
    ["inline", "DM1-C-I-355C"],
  ] as const)("encodes %s deterministically", (layout, code) => {
    expect(encodeSetupProfile(layout)).toBe(code);
    expect(decodeSetupProfile(code)).toEqual({
      version: 1,
      journey: "catalogue",
      layout,
    });
  });

  it("keeps the TypeScript decoder aligned with the shared contract vectors", () => {
    expect(vectors.valid.map(({ code }) => decodeSetupProfile(code).layout)).toEqual([
      "floating",
      "inline",
    ]);
    for (const code of vectors.invalid) {
      expect(() => decodeSetupProfile(code), code).toThrow(SetupProfileError);
    }
  });

  it("trims only surrounding Unicode whitespace and normalizes ASCII case", () => {
    expect(decodeSetupProfile("\u2003dm1-c-i-355c\u2003").layout).toBe("inline");
    expectError("DM1-C- I-355C", "invalid_format");
    expectError("DM1-C-I-355C\nEXTRA", "invalid_format");
  });

  it("distinguishes checksum, version, format, and value failures", () => {
    expectError("DM1-C-F-2ZE8", "invalid_checksum");
    expectError("DM2-C-F-2ZE7", "unsupported_version");
    expectError("DM1-X-F-2ZE7", "unsupported_value");
    expectError("DM1-C-X-2ZE7", "unsupported_value");
    expectError("DM1-C-F-2ZE7-EXTRA", "invalid_format");
  });

  it.each([
    "",
    "DM1-C-F",
    "DM1-C-F-0ZE7",
    "DM1 C F 2ZE7",
    "DM1-C-F-2Z E",
    "ＤM1-C-F-2ZE7",
    `DM1-C-F-${"A".repeat(257)}`,
  ])("rejects malformed code %j", (code) => {
    expectError(code, "invalid_format");
  });

  it("builds only a normalized canonical Daymark app link", () => {
    expect(buildSetupProfileUri(" dm1-c-f-2ze7 ")).toBe(
      "daymark://import-setup?code=DM1-C-F-2ZE7",
    );
    expect(() => buildSetupProfileUri("DM1-C-F-2ZE8")).toThrow(SetupProfileError);
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
