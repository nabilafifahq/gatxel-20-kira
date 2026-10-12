# GTX-ENG-001 / E. UX and craft guide

Tier: **GUIDE** unless marked. Reviewed at design review by Raihan, tracked as backlog with an owner and a date. Not a launch blocker.

Exception: **crawlability (E-06) is GATE for any project whose brief includes being found**, because a client who paid for a website that search engines cannot read did not get a website.

---

## E-00 The happy path problem

The framing worth keeping in front of the team.

**UI is what it looks like. UX is what happens when it does not go to plan.** A user clicks a button, gets an unpredictable result or nothing at all, tries again, gets confused, and often blames themselves before leaving.

**AI tools build the happy path.** They render what the screen looks like when everything works. They miss the loading state, the empty state, the partial state, and the error state, because those were never described in the prompt.

The person building the app knows it inside out and behaves nothing like a real user. So the states below are not polish. They are most of the work, and they are the part that has to be asked for explicitly.

---

## E-01 Five states, not four

Every screen and every data region handles: **loading, empty, partial, error, success.**

The framing is Scott Hurff's UI Stack, and it has five states, not four. The one usually dropped is **partial**: some data, but not enough to be useful. One photo, two contacts, a chart with three points. It is the state that most often looks broken in production, because nobody designed it.

Attribute it to Hurff, not to Nielsen Norman Group. NN/g has no "four states" article.

---

## E-02 Which loader, and when

Nielsen's response time limits, from 1993 and still correct:

| Threshold | Meaning | What to show |
|---|---|---|
| **0.1 s** | Feels instantaneous | Nothing. Just the result |
| **1.0 s** | Flow of thought stays unbroken | Nothing |
| **10 s** | Limit of attention on the task | Percent-done indicator and a way to cancel |

Selection rules:

| Situation | Use |
|---|---|
| Under 1 second | **No indicator at all.** A flashed loader is worse than none. NN/g: "the quick flashing page can cause users to feel like they can't keep up" |
| 1 to 10 s, whole page or large region | **Skeleton screen** with real content shapes. Header-and-footer-only skeletons carry no layout information and are useless |
| 1 to 10 s, one module or one button | **Inline spinner** scoped to that element |
| Over 10 s, duration knowable | **Progress bar** showing percent of the entire operation. Uploads, exports, imports |
| Likely to succeed, cheap to be wrong | **Optimistic UI.** No loader. Render the expected result, roll back on failure. Likes, follows, adding to a list |
| **Payments, deletions, anything irreversible** | **Never optimistic.** Wait for the server |

React's `useOptimistic` is the sanctioned primitive. `setOptimistic` must be called inside an Action or `startTransition`, or the state flickers.

**How long a spinner holds attention, and what buys more time.** These thresholds are practitioner consensus rather than published research, so treat them as a sensible default rather than a citation:

| Duration | What happens | What to ship |
|---|---|---|
| Blank screen, no indicator | Users leave in 2 to 3 seconds | Never ship this |
| Under 1 s | A spinner flashes and registers as a glitch, making it feel **slower** | Show the result |
| 2 to 5 s | A plain spinner with no text is fine | Spinner |
| Past 5 s | A textless spinner starts to read as broken | Add static text: "Menyimpan..." |
| Static text | Buys roughly one more second | |
| **Changing text** | Buys significantly longer, because progress feels real. "Menghubungkan ke akun", then "Hampir selesai" | Use this for anything 5 to 10 s |
| **Past 10 s** | Looped animation stops working and actively erodes patience | Progress bar or a step indicator. Not a spinner |

**And if it fails, show the error immediately.** Do not make someone wait 20 seconds on a spinner only to be told it did not work.

Honest caveat: the most-cited evidence that skeletons beat spinners is an informal 2018 study whose own author wrote "the sample sizes in this study are too small to conclude anything definitively." Treat it as a reasonable default, not a proven result. And skeletons are not a substitute for actually being fast.

---

## E-03 Where the error goes

The closer the error is to its cause, the better. That is the whole rule.

| Placement | Use for | Rules |
|---|---|---|
| **Inline** | Form field errors, failed action next to the button that triggered it | The default. Adjacent to the offending field. This is what you will use most |
| **Toast** | Low-urgency system events: "Connection lost, retrying" | **Never for a critical error.** NN/g documented a user missing an error that faded after 5 seconds. Use `role="status"` (polite). Reserve `role="alert"` for genuine urgency. **A toast with an Undo button is the wrong component**, live-region roles do not support interactive children. Auto-dismissal conflicts with WCAG 2.2.1 unless the user can extend it |
| **Modal** | The user genuinely cannot continue: payment failed, permission missing | **Must offer a way forward**, not just OK. A blocking dialog with no action is a dead end |

**Never clear a form on error.** Re-render with the user's values intact. This is both a usability rule and an error-state rule.

---

## E-04 Forms

- **Validate on blur, not on every keystroke.** Baymard's tested user quote: "Why are you telling me my email address is wrong, I haven't had a chance to fill it all out yet."
- **Asymmetric timing:** errors appear on blur, but clear at the keystroke level the moment the input becomes valid.
- **Never validate an empty field on focus.**
- Positive validation (a checkmark on valid fields) is worth adding.
- **`autocomplete` attributes are a WCAG AA requirement**, not a nicety. SC 1.3.5 Identify Input Purpose. Use the fixed tokens: `name`, `email`, `tel`, `street-address`, `postal-code`, `one-time-code`, `current-password`, `new-password`.
- **Never block paste into a password or OTP field.** That is a direct WCAG 2.2 SC 3.3.8 failure, and it defeats password managers.
- Mobile keyboards: `type="email"`, `type="tel"`, and `inputmode="numeric"` for OTP and postal codes. **Prefer `type="text" inputmode="numeric"` over `type="number"`** for identifiers, because `type="number"` adds spinners, mutates values on scroll, and silently drops leading zeros. That last one matters for Indonesian phone numbers starting `08`.

**On the "multi-step forms convert 300% better" claim: it is not supported.** It traces to a single agency blog with no controlled tests, no sample sizes, and no significance testing, whose own strongest anecdote reports 743% and contradicts its headline. The "7 or more fields" threshold appears nowhere in the source. Do not put this in a client proposal.

Defensible version: splitting a long form into steps can reduce perceived effort and improve completion, but the published uplifts are vendor case studies rather than controlled research. Measure it on the client's own funnel.

---

## E-05 Fewer choices, honestly

**Hick's Law** is real for reaction-time tasks with pre-learned, equally likely options. It does not cleanly model visual search through a menu or a product grid, where scanning cost dominates. "Fewer options is always faster" is an over-extension.

**The jam study** (Iyengar and Lepper, 2000): 60% of passers-by stopped at the 24-jam display versus 40% at the 6-jam display, but roughly 3% of the 24 group bought versus 30% of the 6 group. Those numbers are correct. **The replication record is not.** A 2010 meta-analysis (Scheibehenne, Greifeneder and Todd) found the mean effect of choice-set size across studies to be effectively zero, with named failed replications.

**How to use this with a client:** reduce options because it clarifies the decision, not because "research proves it." Do not quote the jam study as a law.

**Progressive disclosure** (NN/g): defer advanced or rarely used features to a secondary layer. Two hard requirements: the primary and secondary split must come from task analysis or usage data rather than intuition, and the disclosure control must carry strong information scent. The real limit NN/g states is **no more than two disclosure levels**, beyond which users get lost. There is no NN/g 80/20 rule, do not cite one.

The caveat that matters: do not bury the primary feature so deep it needs a tutorial.

---

## E-11 Graceful degradation

**The architectural rule behind the partial state.** This is the part usually skipped.

A page looks like one thing, but almost nothing on it comes from the same place. The profile comes from one service, the feed from another, the charts from a third. They arrive at different speeds and they fail independently.

**Every section owns its own data, its own loading state, and its own error, with its own retry.** If one section fails, it shows its own error and the rest of the page stays fully usable.

The failure modes this replaces:

- A single full-page loading screen that waits for the slowest call
- One failed request that renders a whole-page error and hides everything that did work

If three restaurants deliver and one is late, you eat what arrived. You do not throw all the food away.

In Next.js this maps directly onto the framework:

- A **`<Suspense>` boundary per section**, each with its own skeleton, so sections stream in independently
- An **`error.tsx` per route segment**, not just one at the root, so a failure is contained to its segment and `reset()` gives a retry
- **Stale while revalidate.** Show cached content immediately and swap in fresh data when it arrives. Instagram shows you a cached feed while the new one loads and you never notice

Design review question: for every screen, what does it look like when two of the four data sources are slow and one is down?

---

## E-12 Success states

Every action needs feedback. When someone presses a button, likes a photo, or submits a payment, they need to know it worked.

The failure this prevents: you pay for a flight, click confirm, and nothing visibly happens. Did it go through? Was I charged? Should I press it again? **That uncertainty is worse than an error message.**

Calibrate the confirmation to the weight of the action:

| Action | Confirmation |
|---|---|
| Payment, booking, account creation, anything irreversible | A dedicated success screen with a **reference number** and a clear next step |
| Saving, submitting, sending | Inline confirmation near the trigger, or a toast |
| Dragging a card from To Do to Done | **The action itself.** It moved and it stayed. Nothing else needed |
| A genuine milestone, first project created, a goal hit | A moment worth celebrating, used sparingly |

**Do not overdo it.** Confetti on every save trains people to ignore confirmations. And the cleanest confirmation is often the state change itself, so ask whether a message is adding anything the screen has not already said.

---

## E-13 Jacob's Law: conventions beat invention

**Users spend most of their time on other people's sites, so they expect ours to work the same way.**

The shopping cart is top right on desktop, on Amazon, Target, and Shopify. Put it bottom right and you have not innovated, you have added a microsecond of "wait, where is it" to the single interaction that should have zero friction.

Two qualifications the rule usually loses:

1. **The convention differs by platform.** On mobile the cart lives in the bottom navigation, because the thumb lives at the bottom of the screen and the top right is one of the hardest places to reach one-handed. Desktop and mobile do not share a convention.
2. **The convention differs by locale.** Open Amazon in Arabic and the whole layout mirrors, with the cart at top left. If a Gatxel product ships in more than one direction of script, the layout mirrors with it.

"Everything looks the same" is the point. Predictable structure is what frees the user to think about the thing they actually came to do.

Where to be conventional: navigation position, cart and account placement, form layout, the meaning of icons, checkout flow, search placement.
Where there is room to be distinctive: typography, colour, motion, imagery, copy voice, and the parts of the product that are genuinely new.

---

## E-14 Tesler's Law: complexity is conserved

Larry Tesler, who invented copy and paste, argued that complexity in a system cannot be removed, only moved. **The only question is who absorbs it: the person building the product, or the person using it.**

His framing: "If one million users each waste a minute on a complexity that an engineer could have solved within a week's time, you are penalising the user to make the engineer's job easier."

Everything that feels effortless is somebody having absorbed the complexity upstream. Netflix's Skip Intro required someone to find the exact start and end second of the intro across thousands of titles. Apple Pay replaced typing a card number with one tap by moving the hard part into the platform.

Applied to Gatxel work, this is the rule that decides arguments about scope:

- Accept a phone number in any format and normalise it server-side, rather than telling the user which format to use
- Look up the address from the postal code instead of asking for both
- Infer what can be inferred. A logged-in user should never retype their own email
- If a field can be derived, derive it
- If a step can be removed by doing more work on our side, remove it

And remember we are not building for a patient, rational user with time. Real people are busy and distracted and want the shortest path. Carrying the hard part for them is the job.

---

## E-06 Crawlability

**GATE where the brief includes discovery.**

**AI crawlers do not execute JavaScript.** This is measured, not theoretical. From Vercel's network data:

| Crawler | Renders JS |
|---|---|
| GPTBot (OpenAI) | **No.** Fetches JS files in 11.5% of requests, never executes them |
| ClaudeBot (Anthropic) | **No.** Fetches JS in 23.8% of requests, "and never executes them" |
| PerplexityBot | **No** |
| Googlebot | Yes, via a headless Chromium render queue that can lag |
| Bingbot | Partial, not at scale |

So the commenter in the source material who said "generate a sitemap and you are fine" was wrong, and the reply was right. A sitemap only points at URLs. If the URL returns an empty container, the crawler learns nothing.

**The one-line test:**

```bash
curl -s https://site.com | grep "the actual headline text"
```

If the headline is not in the raw HTML, the page does not exist for AI search, and it is delayed for Google.

Anything behind `useEffect` fetching, `ssr: false` dynamic imports, or client-only routing is invisible. Also: do not block `/_next/static/` in robots.txt, because Google will not render JavaScript from blocked files and you break your own rendering.

**Checklist:**

- `app/sitemap.ts` returning `MetadataRoute.Sitemap`. Split at 50,000 URLs with `generateSitemaps()`
- `app/robots.ts` returning `MetadataRoute.Robots`. Both files at the root of `app/`
- `metadataBase`, unique `title` per route with a `title.template` on the root layout, `description`, `alternates.canonical`
- Open Graph image at **1200 x 630**. `twitter.card: 'summary_large_image'`. Note `ImageResponse` supports flexbox only, `display: grid` will not work
- `favicon.ico`, `icon.png`, `apple-icon.png` in `app/`
- `<html lang="id">` per locale. A hardcoded `lang="en"` on an Indonesian page fails both SEO and WCAG 3.1.1
- `hreflang` via `alternates.languages` for bilingual sites, reciprocated on every page including itself, and mirrored into the sitemap
- Exactly one `h1` per page, no skipped heading levels
- Custom `app/not-found.tsx` and `error.tsx`
- JSON-LD in a Server Component: **Organization** site-wide, **BreadcrumbList**, plus **Product** or **LocalBusiness** where they apply

**Two corrections to the common advice:**

- **FAQ schema is dead.** Google stopped showing FAQ rich results on 7 May 2026, removed Search Console reporting in June 2026 and the API in August 2026. The markup is harmless but produces nothing. **Do not sell FAQ schema as an SEO deliverable.**
- **`llms.txt` does essentially nothing today.** John Mueller, a Google Search Advocate, posted in June 2025 that "no AI system currently uses llms.txt", and in June 2026 that "it's purely speculative for now." Attribute that to Mueller personally, not to Google as an institution: Google's own documentation update of 15 June 2026 puts it more softly, saying llms.txt files "aren't needed for Google Search" while allowing that you may keep one "for other services that use them." Independent evidence points the same way. A 90-day server log study found 84 of 62,100 AI bot requests touched it, which is 0.1%, performing three times worse than an average content page. Ship it if you like, it costs a few kilobytes. **Do not budget effort for it and do not sell it as an AI-SEO deliverable.** The thing that determines AI visibility is server-rendered HTML.

---

## E-07 Performance

Core Web Vitals, measured at the 75th percentile, mobile and desktop separately:

| Metric | Good |
|---|---|
| **LCP** | 2.5 s or less |
| **INP** (replaced FID on 12 March 2024) | 200 ms or less |
| **CLS** | 0.1 or less |

**The animation rule.** At 60 Hz the browser has 16.66 ms per frame, and after browser overhead your work must fit in about **10 ms**. Only `transform` and `opacity` are compositor-only. Animating `top`, `left`, `width`, or `height` forces layout recalculation then repaint on every frame. web.dev measured a side-by-side demo: `top`/`left` cost 37 ms rendering plus 79 ms painting, the `transform` version cost zero for both.

This is what the "menu slide-in is slow on my phone" example in the source material was about, and the explanation there was correct. It is not JavaScript versus CSS. It is which property you animate. A CSS transform also runs on the compositor thread, so it keeps moving even when the main thread is blocked.

**Next.js specifics:**

- `next/image` with `width` and `height` or `fill`, `priority` on the LCP hero image, and `sizes` whenever using `fill` or responsive widths, or the browser over-downloads
- `next/font` self-hosts at build time, so no request reaches Google from the browser. Leave `adjustFontFallback` on, that metric-matched fallback is what actually eliminates the font-swap layout shift
- Heavy data-to-UI work (syntax highlighting, markdown parsing, chart rendering) belongs in a **Server Component**. Putting a tokenizer in a `'use client'` component ships the whole library to the browser to produce static markup
- `optimizePackageImports` for barrel-file libraries. `next/dynamic` for genuinely heavy interactive widgets, but remember `ssr: false` removes content from the HTML, with the crawler consequences in E-06
- First-load JS budget per route. Anything above about 200 KB gzipped on a landing page needs justification
- `npx next experimental-analyze` to diff bundle size before and after

---

## E-08 Accessibility, WCAG 2.2 AA

New in 2.2 and in AA scope:

| SC | Requirement |
|---|---|
| **2.4.11 Focus Not Obscured** | Sticky headers, cookie banners, and chat widgets must not hide the focused element. Fix with `scroll-margin-top` equal to the sticky header height |
| **2.5.7 Dragging Movements** | Any drag interaction (reorder, slider, map pan, kanban) needs a single-pointer alternative |
| **2.5.8 Target Size** | 24 x 24 CSS px minimum |
| **3.2.6 Consistent Help** | A help mechanism appearing on multiple pages must be in the same relative order on each |
| **3.3.7 Redundant Entry** | Do not ask for the same information twice in one flow |
| **3.3.8 Accessible Authentication** | No cognitive function test at any authentication step. Concretely: `autocomplete="current-password"` and `="one-time-code"` must work, and **paste must not be blocked** |

SC 4.1.1 Parsing was removed in 2.2.

Baseline AA, in checkable form: 4.5:1 body contrast, 3:1 large text and UI component boundaries, full keyboard operability with no traps, visible focus, programmatic labels on every control (placeholder is not a label), errors identified in text with a suggested fix, `alt` on every image with `alt=""` for decorative ones, correct heading order, and `@media (prefers-reduced-motion: reduce)` honoured with a fade or no animation.

**WCAG 3.0 is still a Working Draft** as of March 2026, with no conformance obligation and no firm timeline. Build to 2.2 AA.

**European Accessibility Act:** deadline passed 28 June 2025. The legally binding harmonised standard is still EN 301 549 v3.2.1, which maps to WCAG **2.1** AA. Version 4.1.1, mapping to 2.2, is expected in the Official Journal around October 2026. So build to 2.2 AA now, but describe the legal floor accurately if a client asks.

---

## E-09 Product quality, the five checks

Cheap, and they separate a product that feels considered from one that feels assembled.

1. **Time to first value.** How fast does a new user get something worth having? Front-load it. Measure it in seconds.
2. **Study the products people already trust** and borrow what works. Onboarding patterns converge for a reason. They spent the money on the testing.
3. **Build one coherent world.** The ads, the app, the settings screen, the error messages, and the invoice email should all sound like the same company.
4. **Cut the fluff.** Every feature outside the core value is a distraction from it. Simplicity is a decision, not an absence of work.
5. **Be opinionated.** Software is commoditised. Anyone can build anything. The remaining differentiator is a point of view about how it should work. This turns some people off and makes the rest loyal.

---

## E-10 HTML email

**Tables and inline CSS remain mandatory in 2026.** Confirmed, but for a narrower reason than usually given.

Flexbox is at roughly 83% support across email clients, and the 17% that fails is exactly the 17% that matters: **all classic Outlook for Windows versions (2007 through 2019) use the Microsoft Word rendering engine and do not support it.** Grid is identical. Gmail on iOS and Android is partial and breaks for non-Google accounts.

So: **tables are the skeleton. Flexbox is progressive enhancement on top, never the structure.**

Note the source material said "css5 for email templates". There is no CSS5. The real rule is **inline CSS**, because Gmail strips external stylesheets entirely, and a single syntax error or any `background-image` rule anywhere in a `<style>` block drops the whole block. The `<style>` block also has an 8,192-character ceiling. Use it for enhancement only.

**Outlook is genuinely changing.** New Outlook for Windows uses WebView2 and Chromium, renders `border-radius`, flexbox, and media queries correctly, and ignores MSO conditional comments, so supporting both versions works without conflict. Microsoft ends support for perpetual desktop Outlook in October 2026, but the Word engine will persist in enterprises into 2028 or 2029. **Keep the table plus MSO conditional stack through at least 2028.**

**Dark mode.** Apple Mail, Outlook macOS, and Thunderbird honour `prefers-color-scheme` when paired with `<meta name="color-scheme" content="light dark">`. Gmail and classic Outlook force inversion regardless. Never use pure `#FFFFFF` or `#000000`, they trigger the most aggressive inversion. Use off-white (`#FAFAFA`) and dark grey (`#222222`). Logos need padding or a dark-mode swap or they vanish. Test in Gmail iOS specifically.

**Size.** Keep raw HTML under 100 KB, budget to 80 KB. Gmail clips at approximately 102 KB, though that number has no official documentation and clipping has been observed below it. What counts is the raw message source including inline CSS, text, link URLs, tracking parameters, and any base64 data. Externally hosted images do not count. When clipped, everything after the cut is hidden, **including the unsubscribe link**, which is a compliance problem and not just a UX one.
