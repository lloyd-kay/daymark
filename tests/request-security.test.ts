import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  isSameOriginMutation,
  requestFingerprintHash,
  sessionCookie,
  sessionTokenFromRequest,
} from "../lib/auth/request-security";

describe("session cookies and mutation origin", () => {
  it("round-trips only the Daymark session cookie", () => {
    const setCookie = sessionCookie("opaque-token", new Date("2026-08-12T12:00:00.000Z"));
    expect(setCookie).toContain("daymark_session=opaque-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(sessionTokenFromRequest(new Request("https://daymark.example", {
      headers: { cookie: "theme=paper; daymark_session=opaque-token" },
    }))).toBe("opaque-token");
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("rejects cross-origin writes", () => {
    const request = new Request("https://daymark.example/api/auth/sign-in", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("hashes request fingerprints without retaining raw IP or user agent", async () => {
    const request = new Request("https://daymark.example/api/auth/sign-in", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "Example Browser",
      },
    });
    const fingerprint = await requestFingerprintHash(request);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.10");
  });
});
