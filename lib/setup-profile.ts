export type SetupLayout = "floating" | "inline";

export type SetupProfile = {
  version: 1;
  journey: "catalogue";
  layout: SetupLayout;
};

export type SetupProfileErrorCode =
  | "invalid_format"
  | "unsupported_version"
  | "invalid_checksum"
  | "unsupported_value";

export class SetupProfileError extends Error {
  constructor(readonly code: SetupProfileErrorCode) {
    super(code);
    this.name = "SetupProfileError";
  }
}

const CHECKSUM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_PATTERN = /^DM([0-9])-([A-Z])-([A-Z])-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})$/;

export function encodeSetupProfile(layout: SetupLayout): string {
  const layoutMarker = layout === "floating"
    ? "F"
    : layout === "inline"
      ? "I"
      : null;
  if (!layoutMarker) throw new SetupProfileError("unsupported_value");

  const body = `DM1-C-${layoutMarker}`;
  return `${body}-${checksum(body)}`;
}

export function decodeSetupProfile(value: string): SetupProfile {
  const normalized = normalize(value);
  if (normalized.length !== 12) {
    throw new SetupProfileError("invalid_format");
  }

  const match = CODE_PATTERN.exec(normalized);
  if (!match) throw new SetupProfileError("invalid_format");

  const [, versionMarker, journeyMarker, layoutMarker, suppliedChecksum] = match;
  if (versionMarker !== "1") {
    throw new SetupProfileError("unsupported_version");
  }
  if (journeyMarker !== "C") {
    throw new SetupProfileError("unsupported_value");
  }

  const layout = layoutMarker === "F"
    ? "floating"
    : layoutMarker === "I"
      ? "inline"
      : null;
  if (!layout) throw new SetupProfileError("unsupported_value");

  const body = normalized.slice(0, 7);
  if (checksum(body) !== suppliedChecksum) {
    throw new SetupProfileError("invalid_checksum");
  }

  return { version: 1, journey: "catalogue", layout };
}

export function buildSetupProfileUri(code: string): string {
  const canonicalCode = encodeSetupProfile(decodeSetupProfile(code).layout);
  return `daymark://import-setup?code=${canonicalCode}`;
}

function normalize(value: string): string {
  return value.trim().replace(/[a-z]/g, (character) => character.toUpperCase());
}

function checksum(body: string): string {
  let crc = 0xffff;
  for (let index = 0; index < body.length; index += 1) {
    crc ^= body.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }

  let value = crc;
  let encoded = "";
  for (let digit = 0; digit < 4; digit += 1) {
    encoded = CHECKSUM_ALPHABET[value & 31] + encoded;
    value >>>= 5;
  }
  return encoded;
}
