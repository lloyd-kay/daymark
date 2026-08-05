const ITERATIONS = 210_000;
const encoder = new TextEncoder();
const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PasswordVerifier = {
  hash: string;
  salt: string;
  iterations: number;
};

export async function hashPassword(password: string): Promise<PasswordVerifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    hash: await derive(password, salt, ITERATIONS),
    salt: toBase64Url(salt),
    iterations: ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  verifier: PasswordVerifier,
): Promise<boolean> {
  const actual = await derive(
    password,
    fromBase64Url(verifier.salt),
    verifier.iterations,
  );
  return timingSafeTextEqual(actual, verifier.hash);
}

export function validPermanentPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}

export function generateTemporaryPassword(): string {
  const characters: string[] = [];
  const cutoff = 256 - (256 % TEMPORARY_PASSWORD_ALPHABET.length);

  while (characters.length < 20) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte >= cutoff) continue;
    characters.push(TEMPORARY_PASSWORD_ALPHABET[byte % TEMPORARY_PASSWORD_ALPHABET.length]);
  }

  return characters.join("").match(/.{1,5}/g)?.join("-") ?? "";
}

export function generateSessionToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashOpaqueValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
