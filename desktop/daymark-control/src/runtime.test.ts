import { describe, expect, it } from "vitest";

import { assertSafeLocalUrl, parseRuntimeStatus, runtimeActionErrorMessage } from "./runtime";

describe("runtime contracts", () => {
  it("accepts a complete Daymark runtime status", () => {
    expect(
      parseRuntimeStatus({
        state: "running",
        mode: "service",
        access: "local",
        localUrl: "http://127.0.0.1:3210",
        publicUrl: null,
        version: "0.1.0",
        latestMigration: "0006_service_scope_widget_defaults.sql",
        message: null,
      }).state,
    ).toBe("running");
  });

  it("rejects incomplete or unknown runtime states", () => {
    expect(() => parseRuntimeStatus({ state: "online" })).toThrow(
      "Daymark returned an invalid runtime status",
    );
  });

  it("accepts the temporary-link starting state and rejects insecure public addresses", () => {
    const startingStatus = {
      state: "running",
      mode: "service",
      access: "temporary_starting",
      localUrl: "http://127.0.0.1:3210",
      publicUrl: null,
      version: "0.1.0",
      latestMigration: "0006_service_scope_widget_defaults.sql",
      message: null,
    };

    expect(parseRuntimeStatus(startingStatus).access).toBe("temporary_starting");
    expect(() => parseRuntimeStatus({
      ...startingStatus,
      access: "temporary",
      publicUrl: "http://careful-leaf-7.trycloudflare.com",
    })).toThrow("Daymark returned an unsafe public address");
  });

  it("allows only the loopback Daymark application", () => {
    expect(assertSafeLocalUrl("http://127.0.0.1:3210/workspace/sign-in").href).toBe(
      "http://127.0.0.1:3210/workspace/sign-in",
    );
    expect(assertSafeLocalUrl("http://localhost:3210/api/health").hostname).toBe("localhost");
    expect(() => assertSafeLocalUrl("https://example.com/workspace")).toThrow(
      "Only the local Daymark address can be opened",
    );
    expect(() => assertSafeLocalUrl("http://127.0.0.1:3210.evil.example/workspace")).toThrow(
      "Only the local Daymark address can be opened",
    );
  });

  it("maps service action failures without exposing arbitrary error text", () => {
    expect(runtimeActionErrorMessage({ code: "service_action_cancelled" })).toBe(
      "Administrator approval was cancelled. Daymark was not changed.",
    );
    expect(runtimeActionErrorMessage({ code: "service_action_failed" })).toBe(
      "Windows could not change the Daymark service. Open Recovery tools for details.",
    );
    expect(runtimeActionErrorMessage("untrusted backend text")).toBe(
      "Windows could not change the Daymark service.",
    );
  });
});
