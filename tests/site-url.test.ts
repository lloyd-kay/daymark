import { describe, expect, it } from "vitest";

import { requestOrigin } from "../lib/site-url";

describe("requestOrigin", () => {
  it("uses the public proxy host and protocol for hosted metadata", () => {
    expect(
      requestOrigin({
        forwardedHost: "daymark.example.com",
        forwardedProto: "https",
        host: "internal.worker",
      }),
    ).toBe("https://daymark.example.com");
  });

  it("falls back to the request host and local protocol", () => {
    expect(
      requestOrigin({
        forwardedHost: null,
        forwardedProto: null,
        host: "localhost:3000",
      }),
    ).toBe("http://localhost:3000");
  });

  it("uses the first value from forwarded header chains", () => {
    expect(
      requestOrigin({
        forwardedHost: "daymark.example.com, internal.worker",
        forwardedProto: "https, http",
        host: "internal.worker",
      }),
    ).toBe("https://daymark.example.com");
  });
});
