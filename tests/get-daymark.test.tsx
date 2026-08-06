import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GetDaymarkPage from "../app/get-daymark/page";
import Home from "../app/page";

describe("Get Daymark choices", () => {
  it("shows the honest self-hosted and managed-service states", () => {
    const html = renderToStaticMarkup(createElement(GetDaymarkPage));
    expect(html).toContain("Choose how Daymark runs.");
    expect(html).toContain("Self-hosted");
    expect(html).toContain("View public repository");
    expect(html).toContain('href="https://github.com/lloyd-kay/daymark"');
    expect(html).not.toContain("Repository access is invitation-only while Daymark remains private.");
    expect(html).toContain("Daymark Hosted");
    expect(html).toContain("Coming soon");
    expect(html).toContain("Interested in early access or joining the trial programme?");
    expect(html).toContain("Enquiries opening soon");
    expect(html).toContain("disabled");
  });

  it("sends marketing acquisition links to Get Daymark rather than an unscoped booking page", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('href="/get-daymark"');
    expect(html).not.toContain('href="/book"');
  });
});
