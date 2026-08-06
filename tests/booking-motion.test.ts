import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("booking reveal motion", () => {
  it("reveals date cards, time buttons, and summary tokens with compositor-only keyframes", () => {
    expect(stylesheet).toMatch(
      /\.date-card,\s*\.time-tabs button\s*\{[^}]*animation:\s*booking-card-reveal 210ms cubic-bezier\(0\.22, 1, 0\.36, 1\) backwards;/s,
    );
    expect(stylesheet).toMatch(
      /\.selection-slip > span:not\(\.avatar-stamp\)\s*\{[^}]*animation:\s*booking-token-reveal 180ms cubic-bezier\(0\.22, 1, 0\.36, 1\) backwards;/s,
    );
    expect(stylesheet).toMatch(
      /@keyframes booking-card-reveal\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(6px\);\s*}\s*to\s*\{\s*opacity:\s*1;\s*transform:\s*translateY\(0\);\s*}\s*}/s,
    );
    expect(stylesheet).toMatch(
      /@keyframes booking-token-reveal\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateX\(5px\);\s*}\s*to\s*\{\s*opacity:\s*1;\s*transform:\s*translateX\(0\);\s*}\s*}/s,
    );

    const keyframes = stylesheet.match(
      /@keyframes booking-(?:card|token)-reveal\s*\{[\s\S]*?\n}/g,
    )?.join("\n") ?? "";
    expect(keyframes).not.toMatch(
      /\b(?:height|width|margin|padding|filter|box-shadow|top|right|bottom|left):/,
    );
  });

  it("stagger reveals briefly and removes duration and delay for reduced motion", () => {
    expect(stylesheet).toMatch(
      /\.date-card:nth-child\(2\),\s*\.time-tabs button:nth-child\(2\)\s*\{\s*animation-delay:\s*28ms;\s*}/s,
    );
    expect(stylesheet).toMatch(
      /\.date-card:nth-child\(7\),\s*\.time-tabs button:nth-child\(7\)\s*\{\s*animation-delay:\s*168ms;\s*}/s,
    );
    expect(stylesheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms !important;[\s\S]*animation-delay:\s*0ms !important;/s,
    );
  });
});
