# GTX-ENG-001 / F. Go-live gate

Copy this into the project's delivery folder as `GO-LIVE-<project>-<date>.md`. Fill it in. **A GATE item that is not verified blocks the launch.** No verbal sign-off.

```
Project:          ______________________
Domain:           ______________________
Delivery owner:   ______________________
Security sign-off: Nacha (CTO)   Date: __________
Design sign-off:   Raihan        Date: __________
Copy sign-off:     Nabila        Date: __________
```

Verification rule: a box is ticked because someone **ran the check and saw the output**, not because it was believed to be true. Paste the command output into the delivery folder.

---

## Part 1. Security gates. All must pass.

### Patch level
- [ ] `npx next --version` is on a supported line and inside the current patch window. Floor as of 9 Aug 2026 is 16.2.11 or 15.5.21, but **check `nextjs.org/blog` for the current one**, since Next.js patches monthly
- [ ] `node --version` is 24 LTS or 26 LTS
- [ ] PostgreSQL is 15 or newer
- [ ] `npm audit --audit-level=high` passes
- [ ] If the app was internet-facing and unpatched on 4 December 2025, every secret has been rotated

### Auth and session
- [ ] No `localStorage` or `sessionStorage` holds a token. `grep -rn "localStorage" src/`
- [ ] Session cookie is `httpOnly`, `Secure`, `SameSite`, and scoped
- [ ] Session ID rotates on login and on every privilege change
- [ ] Logout invalidates server side, not just the cookie
- [ ] Absolute and idle timeouts are set (default 24 h / 1 h)
- [ ] Password hashing is Argon2id, m=19456 t=2 p=1
- [ ] No character-composition rules on passwords. Minimum length 15, or 8 with MFA
- [ ] Password checked against the HaveIBeenPwned range API
- [ ] MFA available on every account with admin rights or customer data
- [ ] Password reset tokens: single use, hashed at rest, 15 to 60 min expiry, constant-time compare, rate limited
- [ ] Reset endpoint returns the same response and the same timing for existing and non-existent accounts

### Authorization
- [ ] Every `'use server'` function verifies authentication **and** resource ownership inside itself. List them and confirm each one
- [ ] No authorization logic lives only in `proxy.ts` or `middleware.ts`
- [ ] No client-supplied role, `isAdmin` flag, or `userId` is trusted anywhere
- [ ] Route handlers use 401 / 403 / 404 correctly
- [ ] A test exists proving user A cannot read user B's record

### Data exposure
- [ ] No `SELECT *` or unfiltered ORM result reaches a client component
- [ ] Data Access Layer marked `import 'server-only'`
- [ ] `grep -rn "NEXT_PUBLIC_"` reviewed line by line, nothing secret
- [ ] Built bundle grepped for secrets
- [ ] `.env*` is gitignored and no secret exists in git history

### Database
- [ ] App connects as a non-superuser, non-owner role with no DDL rights
- [ ] Connection uses `sslmode=verify-full`
- [ ] Multi-tenant tables have `ENABLE` **and** `FORCE ROW LEVEL SECURITY`
- [ ] Tenant context is set transaction-scoped, `set_config(..., true)`, never session-scoped
- [ ] Negative test exists: zero rows with no tenant context, cross-tenant insert throws
- [ ] No `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw`, or `sql.raw` anywhere
- [ ] Backups run, and **a restore has been tested with the actual recovery time recorded**

### Rate limiting
- [ ] Login, signup, password reset, OTP send, and OTP verify are all rate limited
- [ ] Limits apply per account, not only per IP
- [ ] Expensive Server Actions are rate limited

### Headers and transport
- [ ] `assets/next.config.security.mjs` was copied in **at project setup**, not now
- [ ] `securityheaders.com` grade is **A or better**
- [ ] **Raw `curl -sI` output pasted into the PR**, not a screenshot. A screenshot can be of any URL
- [ ] HTTPS forced, HTTP redirects to HTTPS
- [ ] HSTS set. `preload` **not** set unless every subdomain is permanently HTTPS
- [ ] CSP present and does not rely on `'unsafe-inline'` for scripts
- [ ] CSP ran in **report-only** for one traffic cycle before enforcement, and the violations were read
- [ ] `X-XSS-Protection` is **`0`**, not `1; mode=block`. If a scanner asks for `1; mode=block`, the scanner is wrong
- [ ] `X-Powered-By` removed via `poweredByHeader: false`. `Server` on Vercel is in the waiver record as accepted residual risk
- [ ] `productionBrowserSourceMaps: false`

### Logging and errors
- [ ] Logger redaction list covers password, token, session, cookie, secret, apiKey, card, cvv, nik, kk
- [ ] No stack trace or database error text reaches the browser
- [ ] Users get a correlation ID they can quote
- [ ] Alerts configured for auth failure spikes, 403 spikes, 5xx rate, and backup failure
- [ ] Alert configured for **log ingestion stopping**
- [ ] Every authorization catch block fails closed

### Supply chain
- [ ] Lockfile committed, CI uses `npm ci`
- [ ] `ignore-scripts=true` in `.npmrc`, with an explicit allowlist
- [ ] Auth, crypto, and payment dependencies pinned to exact versions
- [ ] SBOM generated for this release
- [ ] No package installed on a name the model produced without checking registry age and download history

### Signup hygiene
- [ ] Email verification required before persistent, shareable, or billable actions
- [ ] Verification tokens stored hashed, single use, short TTL, rate limited on send and attempt
- [ ] Disposable email domains blocked on abuse-prone flows, with a clear message and an allowlist override
- [ ] Privacy relays not blocked (Apple Hide My Email, Firefox Relay, SimpleLogin). Subaddressing `user+tag@` not blocked
- [ ] `123456` rejected. Verified by trying it

### Data exposure, the vibe-coded failure modes
- [ ] No endpoint returns rows the caller should not see and relies on the client to hide them
- [ ] Supabase or Firebase rules are deny-by-default. Unauthenticated `DELETE` and `PATCH` verified as blocked
- [ ] No third-party API key in the client bundle
- [ ] Database has real constraints: not-null where it matters, foreign keys, unique constraints
- [ ] Missing env vars throw at boot rather than silently falling back to a default

---

## Part 2. Personal data and payments. GATE where applicable.

Skip this part only if the project touches no personal data and no payments. Say so explicitly and have the delivery owner sign it.

- [ ] Written DPA signed with the client, naming every sub-processor including Vercel, AWS, Midtrans, Sentry
- [ ] Confirmed **in writing** who holds the TDPSE, Gatxel or the client, and it is registered **before** users touch the system
- [ ] Someone is appointed to the DPO function
- [ ] Lawful basis recorded per field per purpose. SIM registration data is on legal obligation, not consent
- [ ] Consent is append-only, one purpose per checkbox, no pre-ticked boxes, notice version stored
- [ ] Withdrawal actually propagates to every downstream vendor
- [ ] Retention period defined per category, displayed at collection, enforced by an automated job
- [ ] Data subject request endpoints exist: access, export, correction, deletion, objection, withdrawal
- [ ] NIK and KK encrypted at application level with a KMS-managed key
- [ ] NIK and KK masked to last 4 digits by default, full reveal is permission-gated and logged
- [ ] Append-only audit trail of personal data access: who, whose record, which fields, when, why
- [ ] No NIK or KK in any log, trace, breadcrumb, or analytics event. Verified by grep, not by belief
- [ ] Personal data hosted in Indonesia, or explicit consent plus binding contract terms plus the Permenkominfo 20/2016 report exist for the transfer
- [ ] No production personal data in dev, staging, or test
- [ ] Breach runbook written, template drafted, decision-maker named, 24-hour internal SLA to the client, rehearsed once

### Payments
- [ ] Midtrans Server Key is backend only, in a secret manager, never in `NEXT_PUBLIC_*`, never in git
- [ ] Webhook signature verified with `crypto.timingSafeEqual`, using `gross_amount` as the raw string
- [ ] Handler returns 200 in under 5 seconds and processes asynchronously
- [ ] Idempotency enforced by a unique database constraint on `order_id`, written in the same transaction
- [ ] Status re-verified against the Get Status API before any fulfilment
- [ ] Fulfilment requires `status_code` 200 **and** `transaction_status` settlement or capture **and** `fraud_status` accept
- [ ] Amount re-checked against our own order record
- [ ] Order state machine is monotonic, a late `pending` cannot regress a settled order
- [ ] No card input rendered by us. Snap or Midtrans-hosted tokenization only
- [ ] 3DS enabled, or the client has signed off in writing on disabling it
- [ ] No session replay tool records the payment iframe

---

## Part 3. House standards. Enforced by CI.

- [ ] Zero em dashes in any user-facing or client-facing copy
- [ ] Vale passes with the Gatxel vocabulary
- [ ] Burstiness ratio above 0.4 on landing page and proposal copy
- [ ] No invented metrics anywhere. Every number is traceable to a measurement
- [ ] `DESIGN.md` exists, is filled in, and is current
- [ ] No hex color outside the token file
- [ ] No arbitrary Tailwind values
- [ ] Font allowlist passes
- [ ] `npx impeccable detect` is within the agreed rule budget
- [ ] Language of the interface is consistent, no mixed Indonesian and English in one flow
- [ ] `<html lang>` matches the interface language

---

## Part 4. Craft. Tracked, not blocking.

Anything unticked here needs an owner and a date, not a waiver.

- [ ] Every screen has loading, empty, partial, error, and success designed
- [ ] Loader choice matches duration: nothing under 1 s, skeleton 1 to 10 s, progress bar over 10 s
- [ ] No optimistic UI on payments or destructive actions
- [ ] Errors appear inline next to their cause. No critical error lives only in a toast
- [ ] Forms validate on blur, clear on keystroke, and never clear on error
- [ ] `autocomplete` attributes set. Paste not blocked on password or OTP fields
- [ ] Every interactive element has focus, hover, active, disabled, and loading states
- [ ] Contrast: 4.5:1 body, 3:1 large text and UI borders
- [ ] Touch targets 24 px minimum, 44 px on touch-primary surfaces
- [ ] Keyboard operable end to end, no traps, focus never obscured by a sticky header
- [ ] `prefers-reduced-motion` honoured
- [ ] Animations use `transform` and `opacity` only

### Responsive. GATE where the item is a WCAG conformance requirement.
- [ ] Viewport meta is `width=device-width, initial-scale=1`. **No `user-scalable=no`, no `maximum-scale=1`**
- [ ] No horizontal scroll at **320 CSS px** wide. SC 1.4.10 Reflow
- [ ] Text reaches **200% zoom** without clipping. If `clamp()` is used, the middle value contains a `rem` term
- [ ] Every touch target is at least **24 x 24 CSS px**, SC 2.5.8 at AA, or satisfies the spacing exception deliberately
- [ ] No input, textarea or select below **16px**. Grep for `text-sm` and `text-xs` on form controls
- [ ] `sizes` set on every `next/image` using `fill` or made responsive by CSS
- [ ] No `100vh` for a full-height mobile section. `svh` or `dvh`
- [ ] Checked on a real touch device, not just a narrow browser window
- [ ] Checked at 800 x 400 landscape, which breaks fixed headers and modals

### AI-generated code. GATE.
- [ ] Every generated PR was reviewed file by file, not batch approved
- [ ] Output encoding checked by hand on every generated surface. This is the class models fail hardest
- [ ] No GATE item was closed by the model reporting that it did the work. Command output exists for each
- [ ] AI-generated test changes reviewed specifically
- [ ] Every AI-suggested package verified to exist on the registry, with plausible age and download history
- [ ] The vibe-code review pass in S-16 was run, starting with RLS, unprotected routes, committed secrets, IDOR, and client-side keys

### Search visibility, SEO / AEO / GEO. GATE if discovery is in the brief.

Ordered by what actually breaks. The first four are the ones that make a site invisible.

- [ ] `curl -s <url> | grep "<headline>"` finds the headline in raw HTML. **Use curl, not DevTools**
- [ ] `curl -s <url> | grep 'application/ld+json'` finds the JSON-LD in raw HTML
- [ ] Primary text and all JSON-LD are **outside every `<Suspense>` boundary**. Check whether `loading.tsx` or PPR moved the page body out of the initial shell
- [ ] **The UA loop below returns 200 for every agent, run from a non-Indonesian IP:**
```bash
for UA in "GPTBot/1.4" "OAI-SearchBot/1.4" "ClaudeBot/1.0" "Claude-SearchBot" \
          "PerplexityBot/1.0" "Googlebot/2.1" "Bingbot/2.0" "Applebot"; do
  printf '%-22s ' "$UA"; curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" -A "$UA" https://DOMAIN/
done
```
- [ ] **Cloudflare, if present:** "block Training" is **NOT** ticked (it takes Googlebot, Bingbot and Applebot with it). Managed robots.txt is **off**. Bot Fight Mode is **off**
- [ ] **AWS WAF, if present:** `CategoryAI` overridden to Count
- [ ] **No geo-fencing to Indonesia.** Every AI crawler egresses from a US or EU ASN
- [ ] `Google-Extended` is **not** blocked. It gates Gemini grounding, not AI Overviews
- [ ] `assets/robots.txt` copied in, with the path rules **repeated** in every named group
- [ ] `/robots.txt` is served statically and cannot 5xx. A 5xx there disallows the whole site
- [ ] No dead tokens in robots.txt: `anthropic-ai`, `Claude-Web`, `Googlebot-Extended`, `FacebookBot`, `Bingbot-Extended`
- [ ] Permanent redirects on every changed URL, and a real 404 page. AI crawlers 404 on roughly a third of requests
- [ ] **No FAQPage or HowTo markup on a new build.** Both are dead
- [ ] **No self-serving `aggregateRating`.** Ineligible by rule and a manual action risk
- [ ] `Organization` markup on the homepage or one about page only, not in the global layout
- [ ] Rich Results Test passes for every type actually claimed
- [ ] IndexNow wired to the CMS webhook, if the site publishes regularly. Bing and Yandex only, not Google
- [ ] Client has been told, in writing, what AI Overviews do to informational click-through
- [ ] `app/sitemap.ts` present and correct
- [ ] `/_next/static/` is **not** blocked in robots.txt
- [ ] Unique title and description per route. Not "Create Next App"
- [ ] Canonical URL set. `metadataBase` set
- [ ] Open Graph image at 1200 x 630, route-specific where it matters
- [ ] Favicon and apple icon present
- [ ] Exactly one h1 per page, no skipped heading levels
- [ ] JSON-LD: Organization, plus Breadcrumb, Product, or LocalBusiness where they apply
- [ ] Custom 404 and error pages
- [ ] Custom domain, not `*.vercel.app`
- [ ] `curl -I <url>/_next/static/chunks/*.js.map` returns 404, no source maps in production
- [ ] Browser console clean on load and on the primary interaction
- [ ] Core Web Vitals in the green: LCP under 2.5 s, INP under 200 ms, CLS under 0.1
- [ ] No "Lorem", "Your Company", or "example.com" anywhere. `rg -i "lorem|your company|example\.com"`

### Email, if the project sends any
- [ ] Table-based layout, inline CSS
- [ ] Tested in Gmail web, Gmail iOS, classic Outlook Windows, Apple Mail
- [ ] Dark mode tested, no pure white or pure black
- [ ] Raw HTML under 100 KB
- [ ] Unsubscribe link present and above the clipping threshold

---

## Part 5. App and store release. GATE, only if the project ships to a store.

Run on a clean device, clean install, non-developer account, non-office network, ideally a US IP.

### Blocking
- [ ] Fresh install, first launch, no crash. Background, foreground, kill, relaunch
- [ ] **Demo account logs in right now**, from a US IP, not rate limited, fixed test OTP shipped
- [ ] Account deletion works in-app in three taps or fewer, **and** from a public web URL with no reinstall
- [ ] Deletion actually removes data from third-party processors, not just our database
- [ ] Sign in with Apple tokens revoked via the REST API on deletion, if SIWA is used
- [ ] For UGC: filtering, reporting, blocking, published contact info, **ToS accepted before first post with a zero-tolerance clause**, and a documented 24-hour response process
- [ ] Privacy policy reachable **inside the app** and set in store metadata
- [ ] Terms and privacy hosted on the client's own stable path, not Notion or Google Docs
- [ ] No feature gated on granting push, location, or tracking
- [ ] Permission prompts appear in context after a user action, never on launch
- [ ] IAP items complete, visible, and functional in sandbox. Physical goods use external payment, not IAP
- [ ] Submitted from the **client's** developer account, not Gatxel's
- [ ] App is not a WebView wrapper around the website

### Google Play specific
- [ ] `targetSdk` meets the current requirement (Android 16 / API 36 from 31 August 2026)
- [ ] Package name registered in Play Console under a **verified developer** (Indonesia deadline 30 September 2026)
- [ ] Organisation account used, not a personal account, to skip the 12-tester 14-day gate
- [ ] Data safety form matches actual behaviour, including every SDK
- [ ] Data deletion URL declared
- [ ] Avatar upload uses the Android Photo Picker, not `READ_MEDIA_IMAGES`
- [ ] Crash rate under 1.09% and ANR rate under 0.47%

### Apple specific
- [ ] Privacy manifest present for every listed third-party SDK
- [ ] Privacy nutrition labels cover SDK-collected data, not just ours
- [ ] Age rating questionnaire complete, including the social media questions
- [ ] Guideline 4.8 satisfied if any social login is offered

---

## Part 6. Conversion and local, if the brief includes being found.

Tracked, not blocking, except the accessibility items.

- [ ] Google Business Profile configured: primary category, business title, address, hours. **This outranks every website item for local search**
- [ ] NAP consistent between the site and GBP
- [ ] Click-to-call `tel:` link and WhatsApp click-to-chat present
- [ ] Real reviews, and a process for responding to all of them
- [ ] Offer carried within the first two screenfuls, not crammed above 600px
- [ ] Sticky mobile CTA tested with keyboard tab-through, `scroll-padding-bottom` set
- [ ] Thank-you page or a `generate_lead` event, one or the other, wired and tested
- [ ] `robots.txt` allows `OAI-SearchBot`, `Claude-SearchBot`, and `PerplexityBot` if AI visibility is in scope
- [ ] Cloudflare AI crawler setting checked on any zone created after July 2025
- [ ] No fake reviews, fake logos, fake counters, or resetting countdown timers
- [ ] No uncited statistics anywhere
- [ ] Legal page templates have no `[Company Name]` left in them

---

## Part 7. Dashboards, tables and filters, if the project has any.

- [ ] The dashboard type is settled in writing: reporting, monitoring, exploring, functional, or product home
- [ ] Every metric traces to a named decision and a named person. Decision map exists
- [ ] Every KPI carries context: a comparison, a target, or a trend indicator
- [ ] Every acronym and non-obvious metric has a tooltip definition
- [ ] Defaults do not show everything just because the data exists
- [ ] CSV export available
- [ ] Text left-aligned, quantitative numbers right-aligned, nothing centred
- [ ] `font-variant-numeric: tabular-nums` on numeric columns
- [ ] Row density options taken from Carbon's scale, not the invented 40/48/56 triple
- [ ] Sticky header, and sticky first column if there is horizontal scroll
- [ ] View state preserved, and a reset to default exists
- [ ] Applied filters shown three ways: in the control, as a count marker, and as removable chips
- [ ] Result count displayed. Clear all present at both individual and global level
- [ ] Search highlights the matching substring. Zero-results state has a one-click reset
- [ ] Sort has a sensible default and a visible direction indicator
- [ ] Saved filter queries available if users repeat the same combination

### Accessibility, GATE where contracted
- [ ] `<th>` with `scope`, and a `<caption>` on every table
- [ ] Sortable headers use a real `<button>` and `aria-sort` on the sorted column only
- [ ] **Scrollable table wrapped in `tabindex="0"` with `role="region"` and `aria-labelledby`.** Verified by tabbing to it and scrolling with the keyboard
- [ ] Virtualised tables set `aria-rowcount` to the total and `aria-rowindex` to the absolute index
- [ ] Sticky header does not fully obscure a focused element. Tab through and watch
- [ ] No chart conveys meaning by colour alone
- [ ] Every chart has a text alternative, preferably a real data table behind a view-as-table toggle
- [ ] Categorical palette is colourblind safe, capped at five to eight series

---

## Part 8. Legal pages, seed data, and auth. GATE.

### Legal pages
- [ ] **Kebijakan Privasi** and **Syarat & Ketentuan** exist as **two separate pages**, linked in the footer of every page and again at the point of consent
- [ ] Both are in **Bahasa Indonesia**, and the document states the Indonesian text prevails
- [ ] Link labels are Indonesian, not "Privacy Policy" / "Terms"
- [ ] **No void clauses:** no blanket liability cap, no "all sales final", no "we may modify at any time", no consumer indemnity, no burden-shifting. `rg -i "sewaktu-waktu tanpa pemberitahuan|tidak dapat dikembalikan|final dan tidak"`
- [ ] Legal pages meet the same contrast and font-size rules as the rest of the site. **Pasal 18(2) voids clauses that are hard to read**
- [ ] Retention period stated **in time units**, not "as long as necessary"
- [ ] All nine UU PDP rights listed, with a working channel and an SLA
- [ ] Cross-border transfer disclosed (Vercel, Neon, GA4, Pixel are all Pasal 56 transfers)
- [ ] Consumer complaint channel displayed with contact, procedure and a stated response time
- [ ] Version number, effective date, and a **prior** notice mechanism for changes
- [ ] Consent is an unticked checkbox with a real link, and the acceptance is logged: user, timestamp, IP, terms version
- [ ] **PSE registration** done, or a written decision recorded that it does not apply
- [ ] Cookie banner matches reality: none if essentials-only; if analytics or pixels exist, **tags do not fire before consent** and consent is logged
- [ ] No CCPA or GDPR-only language pasted into an Indonesia-only site

### Seed and placeholder data
- [ ] `assets/ci/no-placeholder.sh` passes against the **build output**
- [ ] **Zero invented testimonials, reviews, ratings, star counts or "trusted by" logos** on the live site
- [ ] Every real testimonial has a **signed written statement on file** in the delivery folder (EPI 1.17)
- [ ] Every client logo used has written permission on file
- [ ] No `__GTX_SEED__` marker anywhere in the production bundle
- [ ] Seed scripts throw on a production `NODE_ENV` or `VERCEL_ENV`

### Login and signup
- [ ] `autocomplete` tokens correct on every field, and the sign-in form is its own `<form>` with stable `name`/`id`
- [ ] Password manager fills and **saves** on a real device, tested by hand
- [ ] **Paste works** in password and OTP fields
- [ ] One OTP input, not six boxes. Auto-submit is not silent, and the countdown survives an app switch
- [ ] No CAPTCHA on the first attempt. If a challenge exists, it is not a transcription task
- [ ] Wrong password and unknown account are identical in body, status and timing
- [ ] Lockout uses escalating delays, not a hard 5-strike lock
- [ ] Input font is at least 16px, labels are above inputs, and the button says what it does
- [ ] Show-password toggle is `type="button"` with `aria-controls` and a live-region announcement
- [ ] Footer carries the legal entity, a support contact, and the privacy link
- [ ] Account deletion works in-app and from a public URL, if the project ships to a store

### Ads, if the project includes any
- [ ] A **claims evidence file** exists: one line per claim, with the document or measurement behind it
- [ ] No superlative (`paling`, `nomor satu`, `ter-`) without proof on file
- [ ] No fear framing, no before-and-after, no improbable-result claims
- [ ] Health client: no testimonials, no before/after, SIREKA registration done
- [ ] Financial client: OJK licence statement on **every** promotion

---

## Waiver record

| Rule ID | Why it cannot be met | Compensating control | Expires | Signed |
|---|---|---|---|---|
| | | | | |
