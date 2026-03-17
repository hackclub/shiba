# Shiba Archive Security Review — AI Agent Prompt

## Objective

Perform a comprehensive security and functionality review of the **`site/`** directory (Next.js on Vercel) in the Shiba monorepo (`hackclub/shiba`) to ensure it is safe to deploy as a **read-only archive**. The Airtable API key will be swapped to a **read-only Personal Access Token (PAT)** scoped to base `appg245A41MWc6Rej`. All other services (Go API, hackatimeSync, gitSync, playtestScript) are **shut down** — only the Next.js site on Vercel is live.

---

## Context

- **Stack**: Next.js 16, JavaScript, hosted on Vercel
- **Data layer**: Airtable (read-only PAT). No traditional database.
- **Auth**: OTP email + Slack OAuth. Token in `localStorage`, passed as `req.body.token`. Auth will be non-functional in archive mode — this is expected.
- **Game hosting**: Godot WASM games served via Next.js routes and R2. Upload/play all goes through Next.js API routes (no separate Go API was used in production).
- **Goal**: Visitors can browse games, profiles, and posts. No write operations should be possible. No crashes, no PII leaks, no dangling errors.

---

## Review Scope & Checklist

### 1. Classify Every API Route as READ or WRITE

Open and read **every file** in `site/pages/api/` including subdirectories (`analytics/`, `gameStore/`, `slack/`, `utils/`).

**Known WRITE routes (must fail gracefully with read-only PAT — return a clean error, not crash):**

- `newLogin.js`, `tryOTP.js`, `slackLogin.js` — Auth
- `CompleteOnboarding.js` — Onboarding
- `createPost.js`, `deletePost.js` — Post CRUD
- `CreateNewGame.js`, `updateGame.js`, `deleteGame.js` — Game CRUD
- `CreateGameFeedback.js`, `updateFeedbackResponse.js` — Feedback
- `CreatePlay.js` — Play tracking
- `CreateRSVP.js` — Event RSVPs
- `CreateCamp.js` — Camp creation
- `Purchase.js` — Shop purchases
- `LogActivity.js` — Activity logging
- `PawProject.js`, `UnpawProject.js` — Following/unfollowing
- `sendShomatoToPost.js`, `unsendShomatoToPost.js` — Reactions
- `updateMyProfile.js`, `updateMySlackId.js` — Profile updates
- `updatePostTimeSpent.js` — Time tracking
- `adjustGameChallenge.js` — Challenge adjustments
- `submitPlaytest.js` — Playtest submissions
- `SyncUserWithYSWSDB.js` — External DB sync

**Known READ routes (must continue to work with read-only PAT):**

- `GetAllGames.js`, `GetAllPosts.js`, `GetAllPostsPreload.js`
- `GetMyGames.js`, `GetMyOrders.js`, `GetMyPlaytests.js`
- `GetPostsForGame.js`, `GetPostsForUser.js`
- `GetRSVPs.js`, `GetShopItems.js`, `GetSiteSettings.js`
- `GetUserGamesForUpload.js`
- `getMyPaws.js`, `getMyProfile.js`, `getMySlackProfile.js`
- `getFeedbackResponse.js`, `getMyCampground.js`
- `hackatimeProjects.js`, `slackProfiles.js`
- `TestAirtableConnection.js`

**Tasks:**

- [ ] Open and read EVERY file in `site/pages/api/` and all subdirectories
- [ ] Confirm each route's READ/WRITE classification
- [ ] Verify that write routes fail safely with a read-only PAT (return an error response, not crash or expose stack traces)
- [ ] Check if any READ routes have hidden write side-effects (e.g., logging to Airtable, updating "last seen", creating records)
- [ ] Check which read routes require a valid `req.body.token` — document which data is inaccessible without auth

### 2. Security Headers & Middleware

- [ ] Review `site/middleware.js`:
  - CSP `connect-src` — remove origins that are no longer needed (e.g., Go API endpoint)
  - Verify Cross-Origin Isolation headers for Godot game pages still make sense (games won't load since Go API is down, but headers shouldn't cause issues)
  - Confirm all standard security headers are present
- [ ] Review `site/next.config.mjs` for header configs, redirects, rewrites
- [ ] Check for any middleware that could leak info or error on missing services

### 3. Sensitive Data & PII Exposure

- [ ] Review which user fields are returned by read routes — the Users table contains PII: `email`, `street address`, `birthday`, `zipcode`, `city`, `country`
- [ ] Ensure unauthenticated visitors cannot access PII through read routes
- [ ] Check if any API response includes full user records with address/birthday fields
- [ ] Search for hardcoded secrets, API keys, or tokens in the `site/` codebase
- [ ] Verify `.env` vars are not committed and `.gitignore` covers them
- [ ] Check if error responses ever expose Airtable API keys or internal details

### 4. Input Validation & Airtable Formula Injection

- [ ] Review `site/pages/api/utils/security.js`:
  - `safeEscapeFormulaString()` — verify it prevents Airtable formula injection in read queries
  - Check coverage: grep for ALL `filterByFormula` usage and confirm each uses the escape function
- [ ] Search for raw string interpolation in Airtable filter formulas without escaping
- [ ] Review `site/pages/api/utils/rateLimit.js` — is it still useful for archive? (Vercel serverless resets state per invocation anyway)

### 5. Frontend Security

- [ ] Check for XSS vectors in rendering of user-generated content (post content, game descriptions, usernames)
- [ ] Verify the `sanitizeHtml()` function in `security.js` is actually called where UGC is rendered
- [ ] Review Godot game iframe/embed handling — ensure embeds don't create security issues
- [ ] Check for open redirects or SSRF in any API routes
- [ ] Review any `dangerouslySetInnerHTML` usage in React components

### 6. Dependency Audit

- [ ] Review `site/package.json` and `site/pnpm-lock.yaml` for outdated or vulnerable dependencies
- [ ] Run or recommend `pnpm audit` results
- [ ] Flag any dependencies with known CVEs
- [ ] Check if any unused dependencies can be removed for reduced attack surface

### 7. Hardcoded Secrets

- [ ] **`site/components/utils/uploadGame.js` line 11** has a hardcoded upload token: `NeverTrustTheLiving#446` — flag this
- [ ] Search the entire `site/` directory for any other hardcoded tokens, passwords, or API keys
- [ ] Check for secrets in comments, console.log statements, or disabled code

### 8. Graceful Degradation

Since auth won't work in archive mode:

- [ ] Verify the site doesn't show broken UI or infinite loading states when auth-dependent features fail
- [ ] Check if there are client-side redirects that send users to login loops
- [ ] Identify pages that will be fully broken vs. partially degraded vs. fully functional

### 9. Vercel-Specific Concerns

- [ ] Check `vercel.json` or Vercel config if present
- [ ] Review environment variable requirements — document exactly which env vars are needed
- [ ] Check if any API routes make outbound calls to external services and whether timeouts are configured
- [ ] Verify serverless function size/timeout limits are appropriate

---

## Output Format

Produce a report with these sections:

1. **Executive Summary** — Overall risk level and top 3 priorities
2. **Critical Issues** — Must-fix before deploying archive (PII exposure, secret leaks, crashes)
3. **High Issues** — Should-fix (write routes that crash, missing input validation)
4. **Medium Issues** — Recommended (tighten CSP, update deps, remove dead code)
5. **Low Issues** — Nice-to-have hardening
6. **Route Classification Table** — Every API route with: file path, READ/WRITE, requires auth?, notes
7. **Deployment Checklist** — Step-by-step to safely deploy as archive on Vercel
8. **Environment Variables** — What to set (`AIRTABLE_API_KEY` = read-only PAT, `AIRTABLE_BASE_ID` = `appg245A41MWc6Rej`), what to remove

---

## Key Files to Review

```
site/pages/api/**/*.js            # All 40+ API routes
site/pages/api/analytics/         # Analytics sub-routes
site/pages/api/gameStore/         # Game store sub-routes
site/pages/api/slack/             # Slack integration sub-routes
site/pages/api/utils/security.js  # Formula escaping, sanitization
site/pages/api/utils/rateLimit.js # Rate limiting
site/middleware.js                 # Security headers
site/next.config.mjs              # Headers, rewrites, redirects
site/package.json                  # Dependencies
site/jsconfig.json                 # Path aliases
site/pages/**/*.js                 # Frontend pages (check for XSS, UGC rendering)
site/components/**/*.js            # Components (check for dangerouslySetInnerHTML)
```

---

## Constraints

- **Scope is `site/` only** — all other directories are irrelevant (those services are shut down)
- Do NOT modify any code — this is a read-only analysis
- Do NOT attempt to access external services (Airtable, Slack, etc.)
- Flag issues by severity: **CRITICAL / HIGH / MEDIUM / LOW**
- Be specific: include **file paths, line numbers, and code snippets** for each finding
- For each finding, include a **recommended remediation**
