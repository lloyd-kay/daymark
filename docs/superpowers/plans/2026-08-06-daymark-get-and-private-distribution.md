# Daymark Get Page and Private Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Get Daymark choice page, prepare a safe self-hosted release, and connect it to a private GitHub repository without publishing Daymark.

**Architecture:** Keep marketing acquisition at `/get-daymark` separate from company booking routes. The self-hosted card links to one configured repository URL; the managed service remains an honest, disabled coming-soon option. Distribution documentation lives with the source and is verified from a clean checkout before any private push.

**Tech Stack:** Vinext, React 19, TypeScript, CSS, Git, GitHub private repository.

## Global Constraints

- Do not publish the site, repository, or a Daymark domain.
- Do not create an enquiry backend or collect trial contact details.
- Keep Daymark Hosted visibly marked Coming soon.
- Review all files for credentials, setup codes, local databases, logs, and temporary assets before any push.
- GitHub repository creation and the initial push require confirmation at action time.

---

### Task 1: Get Daymark route and homepage entry points

**Files:**
- Create: `app/get-daymark/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `tests/get-daymark.test.tsx`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `/get-daymark` with Self-hosted and Daymark Hosted choices.
- Changes: every marketing `Start real booking` link points to `/get-daymark`; company `/book/[workspaceSlug]` links are unaffected.

- [ ] **Step 1: Write failing route and copy tests**

Assert the page contains `Choose how Daymark runs.`, `Self-hosted`, `View private repository`, `Daymark Hosted`, `Coming soon`, `Interested in early access or joining the trial programme?`, and a disabled `Enquiries opening soon` control. Assert homepage links use `/get-daymark` rather than `/book`.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run unit -- tests/get-daymark.test.tsx`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the editorial choice page**

Use the existing paper background, navy ink, coral edge, and sage/lilac/ochre/blue file-tab colours. Lay out two asymmetric option panels with one real repository action and one disabled hosted-service action. Preserve keyboard focus, responsive stacking, and reduced-motion behaviour.

- [ ] **Step 4: Run tests and commit**

Run: `npm run unit -- tests/get-daymark.test.tsx`

Expected: PASS.

```text
git add app/get-daymark app/page.tsx app/globals.css tests
git commit -m "feat: add Get Daymark setup choices"
```

### Task 2: Self-hosted release documentation and secret audit

**Files:**
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/self-hosting.md`
- Create: `docs/security.md`
- Create: `tests/distribution.test.ts`

**Interfaces:**
- Produces: documented Node `>=22.13.0`, D1 binding `DB`, `DAYMARK_SETUP_CODE`, build, migration, backup, restore, upgrade, and security procedures.

- [ ] **Step 1: Write failing distribution tests**

Assert `.gitignore` excludes `.env`, local D1 state, runtime logs, generated outputs, and backup archives while retaining `.env.example` and migrations. Assert documentation names every required variable and never contains a live setup code or credential-shaped placeholder.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run unit -- tests/distribution.test.ts`

Expected: FAIL because the release documentation and audit contract are missing.

- [ ] **Step 3: Write self-hosting and security guidance**

Document prerequisites, first setup, D1 migration order, environment variables, local/production builds, reverse-proxy HTTPS requirements, backup/restore, upgrades, 30-day retention, password/session protections, company isolation, and incident-response basics. Use clearly fake examples such as `replace-with-a-random-setup-code`.

- [ ] **Step 4: Audit the repository**

Run focused searches across tracked files for setup-code values, private keys, tokens, password assignments, `.sqlite`/`.db` files, `.wrangler` state, and clipboard/temp paths. Inspect every match; remove or ignore only true sensitive/runtime material. Do not delete the verified local backup.

- [ ] **Step 5: Run tests and commit**

Run: `npm run unit -- tests/distribution.test.ts`

Expected: PASS.

```text
git add .gitignore .env.example README.md docs tests/distribution.test.ts
git commit -m "docs: prepare private self-hosted release"
```

### Task 3: Fresh-checkout release verification

- [ ] **Step 1: Create a temporary clone from the local repository**

Clone the current repository into a newly created temporary directory outside the workspace. Do not copy `node_modules`, local D1 state, `.env`, outputs, or backups.

- [ ] **Step 2: Install and verify from documented inputs**

Run `npm ci`, `npm run unit`, `npm run lint`, the Windows-compatible production build, and rendered-route tests in the temporary clone. Confirm the documented migration files are present and no local-only state is required for compilation.

- [ ] **Step 3: Remove the temporary clone safely**

Resolve its absolute path, confirm it remains inside the newly created temporary directory, then remove only that temporary clone.

### Task 4: Create and connect the private GitHub repository

**Files:**
- Modify: `app/get-daymark/page.tsx`
- Modify: `tests/get-daymark.test.tsx`

- [ ] **Step 1: Confirm the external action**

State the authenticated GitHub account, proposed private repository name `daymark`, and that the complete reviewed history will be pushed. Obtain confirmation immediately before creation.

- [ ] **Step 2: Create the private repository**

Use the authenticated GitHub account to create `daymark` with private visibility, no generated README, no generated licence, and no generated `.gitignore`, because those files already exist locally.

- [ ] **Step 3: Add the remote and push**

Add the repository as `origin`, verify the resolved remote URL, and push `master` with upstream tracking. Do not change repository visibility.

- [ ] **Step 4: Connect the Self-hosted action**

Set the Get Daymark repository link to the exact private GitHub URL. Keep the invitation-only note visible. Update the test to assert that exact URL.

- [ ] **Step 5: Verify and commit the link**

Run: `npm run unit -- tests/get-daymark.test.tsx`

Expected: PASS.

```text
git add app/get-daymark/page.tsx tests/get-daymark.test.tsx
git commit -m "feat: connect the private Daymark repository"
git push
```

### Task 5: Final local verification

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run unit`

Run: `npm run lint`

Run in PowerShell: `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build`

Run: `node --test tests/rendered-html.test.mjs`

Expected: all pass.

- [ ] **Step 2: Verify private distribution state**

Confirm the GitHub repository remains private, the pushed commit equals local `HEAD`, the working tree is clean, and no site/domain deployment was created.
