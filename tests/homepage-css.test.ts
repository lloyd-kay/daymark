import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("homepage widget artwork CSS", () => {
  it("scales the full Daymark artwork down at the narrow breakpoint", () => {
    const breakpointStart = styles.indexOf("@media (max-width: 520px)");
    const breakpointEnd = styles.indexOf("\n}", breakpointStart) + 2;
    const narrowStyles = styles.slice(breakpointStart, breakpointEnd);

    expect(narrowStyles).toContain(".widget-host-art-full-wordmark { background-size: auto 52%; }");
  });
});
