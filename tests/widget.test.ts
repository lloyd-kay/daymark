import { describe, expect, it } from "vitest";
import {
  applyFramePolicy,
  framePolicyHeaders,
  normalizeWidgetConfig,
  validWidgetMessage,
} from "../lib/widget/protocol";

describe("widget boundaries", () => {
  it("supports both modes and service journeys while rejecting unsafe identifiers", () => {
    expect(normalizeWidgetConfig({ mode: "floating", employee: "maya-chen" })).toEqual({
      mode: "floating",
      employee: "maya-chen",
      service: "all",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({
      mode: "inline",
      employee: "all",
      service: "ring-doorbell-installation",
    })).toEqual({
      mode: "inline",
      employee: "all",
      service: "ring-doorbell-installation",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({
      mode: "unknown",
      employee: "<script>",
      service: "javascript:alert(1)",
    })).toEqual({
      mode: "floating",
      employee: "all",
      service: "all",
      label: "Book an appointment",
    });
    expect(normalizeWidgetConfig({
      mode: "inline",
      employee: "theo-brooks",
      service: "all",
      label: "  Meet the team  ",
    })).toEqual({
      mode: "inline",
      employee: "theo-brooks",
      service: "all",
      label: "Meet the team",
    });
    expect(normalizeWidgetConfig({
      mode: "floating",
      employee: "-unsafe",
      service: "-unsafe",
      label: "x".repeat(81),
    })).toEqual({
      mode: "floating",
      employee: "all",
      service: "all",
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

  it.each([
    ["normal", "/book", 202, "Accepted", "text/plain"],
    ["static", "/daymark-widget.js", 404, "Missing Asset", "application/javascript"],
    ["image-like", "/_vinext/image", 206, "Partial Content", "image/webp"],
  ])("wraps %s responses without losing response metadata", async (
    _kind,
    pathname,
    status,
    statusText,
    contentType,
  ) => {
    const original = new Response("preserved body", {
      status,
      statusText,
      headers: {
        "content-type": contentType,
        "x-original": "kept",
      },
    });
    const wrapped = applyFramePolicy(original, pathname);

    expect(wrapped.status).toBe(status);
    expect(wrapped.statusText).toBe(statusText);
    expect(wrapped.headers.get("content-type")).toBe(contentType);
    expect(wrapped.headers.get("x-original")).toBe("kept");
    expect(wrapped.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    expect(wrapped.headers.get("x-frame-options")).toBe("DENY");
    await expect(wrapped.text()).resolves.toBe("preserved body");
  });

  it("removes inherited frame denial only for the embed response", () => {
    const wrapped = applyFramePolicy(new Response(null, {
      headers: { "x-frame-options": "DENY", "x-original": "kept" },
    }), "/embed");

    expect(wrapped.headers.get("x-frame-options")).toBeNull();
    expect(wrapped.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self' https: http://localhost:*",
    );
    expect(wrapped.headers.get("x-original")).toBe("kept");
  });
});
