export type SetupLayout = "floating" | "inline";
export type SetupJourney = "catalogue" | "page-service";

export type SetupProfileV1 = {
  version: 1;
  journey: "catalogue";
  layout: SetupLayout;
};

export type SetupProfileV2 = {
  version: 2;
  journey: SetupJourney;
  layout: SetupLayout;
};

export type SetupProfile = SetupProfileV1 | SetupProfileV2;
export type SetupProfileDraft = Pick<SetupProfileV2, "journey" | "layout">;

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

export function encodeSetupProfile(profile: SetupProfileDraft | SetupProfile): string;
/** @deprecated Pass a journey/layout draft. Retained while existing callers migrate. */
export function encodeSetupProfile(layout: SetupLayout): string;
export function encodeSetupProfile(
  input: SetupProfileDraft | SetupProfile | SetupLayout,
): string {
  const version = typeof input === "string"
    ? 1
    : "version" in input
      ? input.version
      : 2;
  const journey = typeof input === "string" ? "catalogue" : input.journey;
  const layout = typeof input === "string" ? input : input.layout;
  if (version !== 1 && version !== 2) {
    throw new SetupProfileError("unsupported_version");
  }
  if (journey !== "catalogue" && journey !== "page-service") {
    throw new SetupProfileError("unsupported_value");
  }
  if (version === 1 && journey !== "catalogue") {
    throw new SetupProfileError("unsupported_value");
  }

  const journeyMarker = journey === "catalogue" ? "C" : "P";
  const layoutMarker = layout === "floating"
    ? "F"
    : layout === "inline"
      ? "I"
      : null;
  if (!layoutMarker) throw new SetupProfileError("unsupported_value");

  const body = `DM${version}-${journeyMarker}-${layoutMarker}`;
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
  if (versionMarker !== "1" && versionMarker !== "2") {
    throw new SetupProfileError("unsupported_version");
  }
  if (
    (versionMarker === "1" && journeyMarker !== "C")
    || (versionMarker === "2" && journeyMarker !== "C" && journeyMarker !== "P")
  ) {
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

  if (versionMarker === "1") {
    return { version: 1, journey: "catalogue", layout };
  }
  return {
    version: 2,
    journey: journeyMarker === "P" ? "page-service" : "catalogue",
    layout,
  };
}

export function buildSetupProfileUri(code: string): string {
  const canonicalCode = encodeSetupProfile(decodeSetupProfile(code));
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
