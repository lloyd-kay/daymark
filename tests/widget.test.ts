import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  framePolicyHeaders,
  normalizeWidgetConfig,
  validWidgetMessage,
} from "../lib/widget/protocol";

describe("widget boundaries", () => {
  it("supports both modes and rejects unsafe employee identifiers", () => {
    expect(normalizeWidgetConfig({ mode: "floating", employee: "maya-chen" })).toEqual({
      mode: "floating",
      employee: "maya-chen",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({ mode: "unknown", employee: "<script>" })).toEqual({
      mode: "floating",
      employee: "all",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({
      mode: "inline",
      employee: "theo-brooks",
      label: "  Meet the team  ",
    })).toEqual({
      mode: "inline",
      employee: "theo-brooks",
      label: "Meet the team",
    });
    expect(normalizeWidgetConfig({
      mode: "floating",
      employee: "-unsafe",
      label: "x".repeat(81),
    })).toEqual({
      mode: "floating",
      employee: "all",
      label: "Book an appointment",
    });
  });

  it("accepts only the matching channel and known message types", () => {
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 640 }, "abc")).toBe(true);
    expect(validWidgetMessage({ type: "daymark:close", channel: "abc" }, "abc")).toBe(true);
    expect(validWidgetMessage({ type: "daymark:resize", channel: "other", height: 640 }, "abc")).toBe(false);
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 279 }, "abc")).toBe(false);
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 1201 }, "abc")).toBe(false);
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 640.5 }, "abc")).toBe(false);
    expect(validWidgetMessage({ type: "daymark:resize", channel: "abc", height: 640, reference: "DM-PRIVATE" }, "abc")).toBe(false);
    expect(validWidgetMessage({ type: "daymark:booking", channel: "abc", email: "private@example.com" }, "abc")).toBe(false);
  });

  it("allows framing only for the embed route", () => {
    expect(framePolicyHeaders("/embed").get("content-security-policy")).toContain("frame-ancestors 'self' https:");
    expect(framePolicyHeaders("/workspace").get("x-frame-options")).toBe("DENY");
  });

  it("ships one script with floating and inline modes", async () => {
    const source = await readFile("public/daymark-widget.js", "utf8");
    expect(source).toMatch(/floating/);
    expect(source).toMatch(/inline/);
    expect(source).toMatch(/iframe/);
    expect(source).toMatch(/document\.currentScript/);
    expect(source).toMatch(/crypto\.randomUUID/);
    expect(source).toMatch(/allow-scripts allow-forms allow-same-origin/);
    expect(source).toMatch(/daymark:resize/);
    expect(source).toMatch(/daymark:close/);
    expect(source).toMatch(/daymark:reset/);
    expect(source).toMatch(/10000/);
    expect(source).toMatch(/event\.origin/);
    expect(source).toMatch(/event\.source/);
    expect(source).not.toMatch(/clientEmail|clientPhone|clientAddress/);
    expect(source).not.toMatch(/booking(?:Reference|Payload)|daymark:booking/i);
  });
});
