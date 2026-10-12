---
name: gatxel-build-standard
description: >-
  The Gatxel build standard (GTX-ENG-001), applied to every Gatxel and client
  project. Use when writing, reviewing, or shipping any Gatxel code, website,
  web app, landing page, dashboard, client copy, proposal, or design; when
  checking a project before go-live; and whenever any of these come up -
  anti-slop, AI slop, security review, pre-launch check, hardening, PDP,
  UU PDP, NIK, KK, Midtrans, RLS, or "the Gatxel standard". Covers hard
  security gates, Indonesian data-protection and payment rules, anti-AI-slop
  copy and design house rules, and UX guidance. Default stack is Next.js App
  Router plus PostgreSQL.
---

# Gatxel Build Standard

| Field | Value |
|---|---|
| Document | Gatxel Build Standard |
| Document ID | GTX-ENG-001 |
| Version | 1.7, draft for review |
| Effective date | 10 August 2026 |
| Change in 1.1 | Added app and store release, conversion and local, code health, and mobile and inputs. Expanded copy, design, and UX |
| Change in 1.2 | Added dashboards, tables and filters. Added the prompt skeleton to the design workflow |
| Change in 1.3 | Added responsive layout and the claims register. Added S-16 on AI-generated code. Corrected `X-XSS-Protection` to `0`. Corrected the target-size and line-height numbers. Triggered by live scans of three production Gatxel sites, see GTX-ENG-001-R01 |
| Change in 1.4.1 | Broke the antithesis frame out as C-03a with the full pattern family, English and Indonesian, plus a tested Vale rule in `assets/ci/vale/Gatxel/` |
| Change in 1.4 | Added search visibility (SEO, AEO, GEO) as its own section, with the crawler inventory and `assets/robots.txt`. Corrected the FAQ carve-out, `Google-Extended`, and the schema-helps-LLMs claim |
| Change in 1.5 | Added seed and demo data, Indonesian legal pages, and login, signup and onboarding. Added C-08 ads and hooks, D-09 type scale. Triggered by the estate audit, see GTX-ENG-001-R02 |
| Change in 1.6 | Plus Jakarta Sans adopted as the house typeface (D-10), with Mohave as the display pairing. Corrected the D-02 ban criterion |
| Change in 1.7 | Added Indonesian sales copy (R), page anatomy and trust (T), and recurring interaction patterns (U). Per-type playbooks in GTX-ENG-001-PB |
| Owner | Nabila (CEO) |
| Approver | Nacha (CTO) |
| Review cycle | Quarterly, plus within 7 days of any Next.js or OWASP advisory |
| Applies to | Every Gatxel project: client work, Gatxel products, internal tools |
| Related | GTX-CHR-001 Team Charter, GTX-SEC-001 Information Security Policy, GTX-QMS-001 Document Control |

Default stack assumption: **Next.js App Router + PostgreSQL + Tailwind**, deployed for Indonesian users. Where a project differs, translate the rule rather than skipping it.

---

## Three tiers, and what each one means

| Tier | Meaning | Who decides | Blocks release? |
|---|---|---|---|
| **GATE** | Security, personal data, payments, legal. Non-negotiable. | Nacha (CTO) signs off | **Yes.** No exceptions without a written, dated, owner-signed waiver |
| **HOUSE** | Gatxel copy and design identity. Machine-checkable, mostly auto-fixable. | Nabila (CEO) owns the house voice | Yes for client-facing surfaces, and CI enforces it |
| **GUIDE** | UX and craft judgment. | Raihan (Design) at design review | No. Tracked as backlog with an owner and a date |

When a rule below carries no tag, it is GUIDE.

---

## Read this first, on every project

Run these four checks before anything else. Each has caught a live, exploited class of bug.

1. **`npx next --version`.** As of 9 August 2026, anything below **15.5.21** or **16.2.11** is exploitable. Next.js 14.x and below are end of life. **These numbers go stale fast**, because Next.js moved to monthly pre-announced security releases in July 2026. Check `nextjs.org/blog/next-security-release-program` rather than trusting this line. If a Gatxel app was internet-facing and unpatched on 4 December 2025, treat it as compromised and rotate every secret: React2Shell (**CVE-2025-55182**, CVSS 10.0, pre-auth RCE) was in CISA KEV and mass-exploited.
2. **`grep -rn "'use server'"`.** Every Server Action is a public POST endpoint. Each one must independently verify authentication and resource ownership. A page-level check does not protect it.
3. **`grep -rn "NEXT_PUBLIC_"`.** Anything after that prefix is baked into the browser bundle forever. A service key there is a breach.
4. **Check the database URL.** It must use a non-superuser, non-owner role and `sslmode=verify-full`.

---

## Routing: which reference to load

Load only what the task needs. Never read them all.

| Task | Load |
|---|---|
| Writing or reviewing any code, auth, API, database | `references/security-gates.md` |
| Anything touching NIK, KK, customer identity, or Midtrans | `references/data-payments-id.md` |
| Writing any words a client or user will read | `references/copy-standard.md` |
| Building or reviewing any UI, page, component, or theme | `references/design-standard.md` |
| Designing flows, states, forms, errors, loading | `references/ux-guide.md` |
| **Submitting to the App Store or Google Play** | `references/app-store-release.md` |
| **Client website scope, conversion, local business** | `references/conversion-local-geo.md` |
| **Code review, refactoring, dependency and tooling decisions** | `references/code-health.md` |
| **Mobile layout, form inputs, or displaying real data** | `references/mobile-inputs-data.md` |
| **Any dashboard, data table, chart, or filter** | `references/dashboards-tables-filters.md` |
| **Breakpoints, container queries, fluid type, images, touch targets** | `references/responsive-standard.md` |
| **SEO, AEO, GEO, AI crawlers, schema, or being cited by an LLM** | `references/search-visibility.md` |
| **Any placeholder content, dummy testimonial, or seed data** | `references/seed-and-demo-data.md` |
| **Privacy policy, terms, cookies, PSE registration, or anything legal** | `references/legal-pages-id.md` |
| **A login page, signup flow, OTP, or onboarding** | `references/auth-and-onboarding.md` |
| **Writing any Indonesian marketing or sales copy** | `references/copy-indonesian.md` |
| **Deciding what goes on a page, or a trust or support question** | `references/page-anatomy.md` |
| **Select all, bulk actions, errors, empty states, issue reporting, form spam** | `references/interaction-patterns.md` |
| **Quoting any statistic in a proposal, deck, or article** | `references/claims-and-sources.md` |
| Preparing to launch, or auditing a live project | `references/go-live-checklist.md` |

Drop-in files to copy into a project live in `assets/`:

- `assets/CLAUDE.md` goes in the repo root so Claude Code, Cursor, and Codex follow this standard. Copy it to `AGENTS.md` too.
- `assets/DESIGN.md` is the per-project design token contract. Fill it in **before** writing UI code.
- `assets/next.config.security.mjs` is the security headers block.
- `assets/robots.txt` is the AI crawler allow list. Read `references/search-visibility.md` N-02 before editing it.
- `assets/ci/` holds the lint configuration that enforces the HOUSE tier.

---

## The non-negotiables, in one card

Memorise these. Everything else is elaboration.

**Security (GATE)**

1. Session tokens live in `httpOnly; Secure; SameSite=Lax` cookies, never in `localStorage`.
2. Every authorization check runs on the server, as close to the data as possible. Proxy and middleware are filters, not boundaries. Five separate Next.js middleware bypasses shipped in 15 months.
3. Every Server Action and Route Handler re-verifies authentication and ownership on its own.
4. Rate limit login, signup, password reset, and OTP. Lock the account, not the IP.
5. Passwords: Argon2id (m=19456, t=2, p=1), 15 characters minimum as a single factor, 8 with MFA, no composition rules, checked against the HaveIBeenPwned range API.
6. Parameterized queries only. `$queryRawUnsafe`, `Prisma.raw`, and `sql.raw` are banned.
7. The app connects to Postgres as a least-privilege role over `sslmode=verify-full`.
8. Never return a raw database row to a client component. Select explicit columns, return a DTO.
9. Never log a password, token, session ID, card number, NIK, or KK.
10. Users see a generic error plus a correlation ID. Stack traces go to the log, never the screen. Failed checks fail closed.
10a. `assets/next.config.security.mjs` is copied in **at project setup**, not at go-live. Grade A on securityheaders.com, verified with raw `curl -I` output in the PR. `X-XSS-Protection` is `0`, never `1; mode=block`.
10b. Every AI-generated PR is reviewed file by file, and no GATE item is ever closed by the model reporting that it did the thing.

**Data and payments (GATE)**

11. NIK and KK are encrypted at application level, masked to last 4 digits in the UI, and never leave Indonesia in logs, traces, or analytics.
12. Never build a card input. Snap or Midtrans-hosted tokenization only.
13. Verify the Midtrans webhook signature in constant time, then re-verify status against the Get Status API before fulfilling anything.
14. Breach notification clock is **3 x 24 hours** to the data subject and the regulator. Gatxel notifies the client within 24 hours of detection.
15. Never use production personal data in dev, staging, or test. Under Pasal 51 UU PDP that shifts liability from the client onto Gatxel.

**Copy (HOUSE)**

16. Zero em dashes in anything a client or user reads. Use a comma, colon, period, or parentheses.
17. No banned vocabulary, no antithesis frame in any of its shapes (C-03a), no rule-of-three on autopilot, no "In conclusion" on a page that needs no conclusion. Full list in `references/copy-standard.md`.
18. Every claim carries a number, a name, or a source. Delete any sentence that survives deletion.

**Design (HOUSE)**

19. `DESIGN.md` exists and is filled in before the first component. Every color, font, radius, and spacing value in code must reference a token from it.
20. **The house face is Plus Jakarta Sans**, with Mohave for display, unless `DESIGN.md` overrides it in writing. Banned by default: Inter and Geist and Space Grotesk as the chosen face, purple to indigo gradients, colored left-border cards, icon-tile-above-heading feature cards, glassmorphism as decoration, emoji used as icons.

**App and store release (GATE, if the project ships to a store)**

21. Account deletion works from inside the app **and** from a public web URL. Deactivation is not deletion.
22. Any app where one user sees another user's content needs all six: content filtering, reporting, blocking, published contact info, terms accepted before posting with a zero-tolerance clause, and action on reports within 24 hours.
23. The demo account logs in, right now, from a US IP, with a fixed test OTP. If the reviewer cannot log in you lose a full cycle.
24. Client apps are submitted from the **client's** developer account, never Gatxel's. Agency accounts read as template farms under 4.2.6.

**Craft (GUIDE)**

25. Every screen handles five states: loading, empty, partial, error, success. AI builds only the happy path.
26. Every section owns its own data, loading state, error, and retry. One failed request must not blank the page.
27. Every action produces feedback. Anything irreversible gets a reference number.
28. Content that matters for discovery is server-rendered. AI crawlers do not execute JavaScript.
29. WCAG 2.2 AA is the target: 4.5:1 body contrast, 3:1 for UI borders and large text, visible focus, 24px minimum touch targets, keyboard operable, paste never blocked.
30. Follow convention where the user has a habit (Jacob's Law), and absorb complexity on our side rather than passing it to the user (Tesler's Law).
31. On any dashboard, every metric traces to a decision someone makes. If the stakeholder cannot say what they would do differently, it does not ship.
32. Applied filters are shown three times: in the control, as a marker on the control, and as removable chips near the results. Plus a result count and clear all.
33. Breakpoints come from the content, never from a device table. Components respond to their container, not the viewport.
34. Verify responsive at 320px wide, 400% zoom, 200% text zoom, and on touch. Not at one screenshot width.
35. Every number we publish carries its provenance. Never cite an article that cites another article.
36. No AI crawler executes JavaScript. If the headline is not in `curl -s <url>`, it does not exist for ChatGPT, Claude or Perplexity.
37. `GPTBot` is training, `OAI-SearchBot` is visibility. Blocking `Google-Extended` costs Gemini and does nothing about AI Overviews.
38. Check the CDN, not the robots.txt. Cloudflare's "block Training" setting takes Googlebot with it.
39. We do not sell GEO as a separate service. Google's own guidance is that optimising for generative search is still SEO.

**Legal and content (GATE)**

40. **Every project ships a Privacy Notice and Terms as two separate pages, in Bahasa Indonesia**, with the Indonesian text stated as prevailing. English-only is void under Putusan MA 601 K/Pdt/2015.
41. **Never write "we may modify these terms at any time", "all sales final", or a blanket liability cap.** All three are void under Pasal 18 UU 8/1999 and carry criminal exposure under Pasal 62.
42. **An invented testimonial, review, rating or logo strip never reaches production.** Under **Pasal 20 UU 8/1999 the producer of the advertisement is liable**, and that is Gatxel. Build with realistic seed data, contain it structurally, and gate it in CI.
43. **No superlative in an ad without proof on file.** EPI 1.2.2 is imported into criminal law by Pasal 17(1)(f) and Pasal 62(2).
44. Paste is never blocked in a password or OTP field. That fails NIST, OWASP and **WCAG 3.3.8** at once.

**Indonesian copy and page craft (HOUSE)**

45. **Default to no address pronoun.** Indonesian is pro-drop, and naming the reader on every clause is the loudest tell of English-first copy. `Anda` for B2B, `kamu` for consumer, chosen per project in `DESIGN.md`.
46. **`TERPERCAYA` is burnt**, along with the rest of the R-04 list. On a transactional site, replace every claim with a checkable fact.
47. **Lead with evidence, then explain services.** Named work before the service list. The vague sites lead with abstractions.
48. **A support page lives in the main nav, not the footer**, and carries a human escape hatch in the first screenful. Only 14% of issues resolve in self-service.
49. **The header checkbox means this page.** Global selection is always a separate, explicit, escalated action.
50. **Every error says what happened, what to do, and gives a reference.** Every filtered-empty state names the filters.

---

## How Gatxel works with AI on a project

The failure mode is not that the model writes bad code. It is that the model writes *average* code, and average is now recognisable on sight.

1. **Constrain before generating.** Fill in `DESIGN.md` and drop `CLAUDE.md` into the repo first. A generation run with no token contract regresses to the mean, every time.
2. **Generate wide, then narrow.** For any new surface, ask for five distinct directions and compare them side by side. Do not iterate on the first output. One-shot plus "make it look more premium" is the slop pipeline.
3. **Iterate by deleting.** Name three generic elements on the page, remove them, replace with space. Repeat until the page stops surviving subtraction.
4. **Never let the model self-certify.** A GATE item is verified by running the check, not by the model reporting that it did.

---

## Waivers

A GATE item can only be skipped with a waiver recorded in the project's delivery folder containing: the rule ID, why it cannot be met, the compensating control, the expiry date, and Nacha's signature. No waiver, no launch. HOUSE and GUIDE items need no waiver, only an owner and a date in the backlog.
