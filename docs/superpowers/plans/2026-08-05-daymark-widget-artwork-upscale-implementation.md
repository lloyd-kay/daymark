# Daymark Widget Artwork Sharpness Upscale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both widget-preview image references with a sharper, higher-density 4:3 Daymark raster while keeping the text, composition, crop, and floating panel at exactly the same apparent size and position.

**Architecture:** Create one non-destructive sibling image asset from the approved readable master, using the original user artwork as a supporting visual reference, then change the shared `HostHero` image source so both widget cards consume it. Preserve the existing responsive CSS and cover the change with the focused component regression plus desktop/mobile Chrome evidence.

**Tech Stack:** React 19, TypeScript, Vinext, CSS, Vitest/jsdom, built-in ImageGen editor, Chrome browser QA.

## Global Constraints

- Keep `DAYMARK` and `Book the right person. Keep every calendar private.` verbatim.
- Do not enlarge, shrink, move, re-space, recolour, or recompose either text line; apparent bounding boxes may vary by no more than two percent.
- Preserve the cream paper texture, orange binding and stitches, green/lilac/ochre/blue folders, 4:3 framing, lighting, colour balance, and negative space.
- Keep `public/daymark-widget-art-4x3-readable.png` and `public/daymark-widget-art-4x3-textured.png` untouched for rollback.
- Save the selected sibling as a true two-times-density asset and accept it only if it is at least 2896 x 2172 and visibly sharper at the real widget size.
- Keep desktop `object-fit: cover`, mobile `object-fit: contain`, artwork-slot dimensions, the 205 px floating panel, widget choice behaviour, and all booking behaviour unchanged.
- Do not deploy or publish.

---

### Task 1: Generate and wire the sharper widget artwork

**Files:**
- Create: `public/daymark-widget-art-4x3-readable-2x.png`
- Modify: `tests/homepage-showcase.test.tsx:35-44`
- Modify: `app/home/WidgetOptionsShowcase.tsx:28-32`

**Interfaces:**
- Consumes: approved edit target `public/daymark-widget-art-4x3-readable.png`, the original user artwork as a supporting visual reference, and the shared `HostHero` component.
- Produces: decorative `<img src="/daymark-widget-art-4x3-readable-2x.png" alt="" loading="lazy" decoding="async" />` used by both widget previews.

- [ ] **Step 1: Change the focused regression to require the new asset**

Replace only the source expectation in `tests/homepage-showcase.test.tsx`:

```tsx
expect(images.every((image) => image?.getAttribute("src") === "/daymark-widget-art-4x3-readable-2x.png")).toBe(true);
expect(images.every((image) => image?.getAttribute("loading") === "lazy")).toBe(true);
expect(images.every((image) => image?.getAttribute("decoding") === "async")).toBe(true);
```

Also validate the full eight-byte PNG signature, the `IHDR` chunk, minimum 2896 x 2172 dimensions, exact 4:3 ratio, and a 6,000,000-byte maximum.

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
npm.cmd run unit -- tests/homepage-showcase.test.tsx
```

Expected: the image-source/delivery regression and the true-density asset regression fail; the other two tests pass.

- [ ] **Step 3: Generate the non-destructive high-fidelity edit**

First inspect `public/daymark-widget-art-4x3-readable.png` with `view_image`, then use the built-in ImageGen editor with that file as the edit target and the original user artwork as supporting reference, using this exact prompt:

```text
Use case: precise-object-edit
Asset type: 4:3 raster artwork used inside two small website widget previews
Input image: Image 1 is the sole edit target; Image 2 is the original supporting reference
Primary request: Create a higher-density, visibly sharper version of this exact artwork. Reconstruct crisp anti-aliased edges and fine-stroke contrast only for the existing navy typography while keeping its apparent size and placement unchanged.
Text (verbatim): "DAYMARK"
Text (verbatim): "Book the right person. Keep every calendar private."
Composition: preserve every object, proportion, bounding box, baseline, spacing, colour, crop, and all negative space exactly; keep the 4:3 framing.
Materials/textures: preserve the prominent cream paper grain, orange binding and stitches, and green, lilac, ochre, and blue textured folders exactly.
Constraints: do not enlarge, shrink, move, reflow, recolour, replace, omit, or add any text; do not redraw or reposition the folders; no new marks, shadows, borders, or watermark. Output a high-resolution 4:3 master suitable for sharp downscaling.
```

Save the selected result from the generated-images location to:

```text
public/daymark-widget-art-4x3-readable-2x.png
```

Do not overwrite either prior readable or textured asset.

- [ ] **Step 4: Validate the new asset before wiring it**

Open the old and new assets together at original detail. Reject and iterate if either text line changes, if any letter is malformed, if the text bounding boxes visibly change by more than two percent, or if any paper/folder/binding detail moves.

Check file dimensions:

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path 'public\daymark-widget-art-4x3-readable-2x.png'))
[pscustomobject]@{ Width = $img.Width; Height = $img.Height; Ratio = [math]::Round($img.Width / $img.Height, 4) }
$img.Dispose()
```

Expected: width at least 2896, height at least 2172, ratio approximately `1.3333`, exact text preserved, and visibly cleaner typography edges.

- [ ] **Step 5: Point both widget previews at the new asset**

Change the shared image in `app/home/WidgetOptionsShowcase.tsx` to:

```tsx
<img src="/daymark-widget-art-4x3-readable-2x.png" alt="" loading="lazy" decoding="async" />
```

Do not change `app/globals.css`.

- [ ] **Step 6: Run the focused test and verify the green state**

Run:

```powershell
npm.cmd run unit -- tests/homepage-showcase.test.tsx
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 7: Commit the asset and source change**

```powershell
git add public/daymark-widget-art-4x3-readable-2x.png app/home/WidgetOptionsShowcase.tsx tests/homepage-showcase.test.tsx
git commit -m "feat: sharpen Daymark widget artwork"
```

### Task 2: Verify the sharpness fix in Chrome and record evidence

**Files:**
- Create: `qa-evidence/daymark-homepage/true-2x-widget-after-chrome.png`
- Create: `qa-evidence/daymark-homepage/true-2x-widget-mobile-floating-chrome.png`
- Create: `qa-evidence/daymark-homepage/true-2x-widget-mobile-inline-chrome.png`
- Create: `qa-evidence/daymark-homepage/chrome-true-2x-widget-qa.json`
- Modify: `design-qa.md`
- Modify: `qa-evidence/daymark-homepage/README.md`

**Interfaces:**
- Consumes: `/daymark-widget-art-4x3-readable-2x.png` from Task 1 and the local preview at `http://localhost:3000/#widget-options`.
- Produces: durable desktop/mobile visual evidence and a compact machine-readable QA record.

- [ ] **Step 1: Inspect the desktop implementation at the available Chrome desktop viewport**

In the already selected Chrome browser, open `http://localhost:3000/#widget-options`, use the available 1303 x 1231 desktop viewport, and verify in the rendered page:

```json
{
  "imageCount": 2,
  "src": "/daymark-widget-art-4x3-readable-2x.png",
  "objectFit": "cover",
  "floatingPanelWidth": 205,
  "horizontalOverflow": false,
  "pressed": [true, false]
}
```

Capture the same-state page as `qa-evidence/daymark-homepage/true-2x-widget-after-chrome.png`.

- [ ] **Step 2: Inspect both mobile cards at 390 x 844**

Set the viewport to 390 x 844. Capture the floating and inline cards separately and verify:

```json
{
  "objectFit": "contain",
  "completeInlineWordmark": true,
  "floatingPanelVisible": true,
  "floatingPanelWidth": 205,
  "horizontalOverflow": false
}
```

Save the captures as:

```text
qa-evidence/daymark-homepage/true-2x-widget-mobile-floating-chrome.png
qa-evidence/daymark-homepage/true-2x-widget-mobile-inline-chrome.png
```

- [ ] **Step 3: Compare the source, user report, and implementation together**

Open these three images in one comparison input:

```text
public/daymark-widget-art-4x3-readable.png
C:/Users/Lloyd/AppData/Local/Temp/codex-clipboard-e62092a1-5b77-401b-b1a2-40e9b923aacd.png
qa-evidence/daymark-homepage/true-2x-widget-after-chrome.png
```

Confirm the text size and composition are unchanged while the letter edges are visibly crisper in the implementation. If the difference is not visible at the same viewport, reject the asset and return to Task 1 Step 3 for one targeted sharpness iteration.

- [ ] **Step 4: Verify interaction and console state**

Activate the inline option, confirm `aria-pressed` becomes `[false, true]`, restore floating to `[true, false]`, and confirm the URL remains `http://localhost:3000/#widget-options`. Read Chrome logs and require zero warnings and zero errors.

- [ ] **Step 5: Write the QA record and update evidence documentation**

Create `qa-evidence/daymark-homepage/chrome-true-2x-widget-qa.json` with the observed natural dimensions, desktop/mobile slot sizes, object-fit values, overflow state, panel geometry, selection states, delivery settings, and console counts. Update `design-qa.md` so the final line remains exactly:

```text
final result: passed
```

Add all four new evidence files to `qa-evidence/daymark-homepage/README.md`.

- [ ] **Step 6: Commit the QA evidence**

```powershell
git add design-qa.md qa-evidence/daymark-homepage/README.md qa-evidence/daymark-homepage/true-2x-widget-after-chrome.png qa-evidence/daymark-homepage/true-2x-widget-mobile-floating-chrome.png qa-evidence/daymark-homepage/true-2x-widget-mobile-inline-chrome.png qa-evidence/daymark-homepage/chrome-true-2x-widget-qa.json
git commit -m "test: verify sharper Daymark artwork in Chrome"
```

### Task 3: Run the complete verification gate and hand off the preview

**Files:**
- Verify only: no planned source changes.

**Interfaces:**
- Consumes: committed implementation and QA evidence from Tasks 1 and 2.
- Produces: a clean working tree, passing verification evidence, and an open deliverable Chrome tab.

- [ ] **Step 1: Run the full unit suite**

```powershell
npm.cmd run unit
```

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run lint**

```powershell
npm.cmd run lint
```

Expected: exit code 0 with zero errors and zero warnings.

- [ ] **Step 3: Run the production build**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
& '.\node_modules\.bin\vinext.cmd' build
```

Expected: `Build complete` with exit code 0.

- [ ] **Step 4: Run rendered-route checks**

```powershell
node --test tests/rendered-html.test.mjs
```

Expected: 6 tests pass, 0 fail.

- [ ] **Step 5: Verify the repository state**

```powershell
git diff --check
git status --short
git log -3 --oneline
```

Expected: no whitespace errors, no uncommitted files, and both implementation and QA commits present.

- [ ] **Step 6: Leave the verified preview open**

Reset temporary Chrome viewport overrides, return to `http://localhost:3000/#widget-options` with the floating option selected, and keep that tab as the deliverable preview. Do not deploy.
