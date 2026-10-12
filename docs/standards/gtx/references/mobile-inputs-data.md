# GTX-ENG-001 / J. Mobile, inputs, and data display

Tier: **GUIDE**, except the four WCAG items marked GATE-when-accessibility-is-contracted.

These are the failures that survive desktop review and break on a real phone with real data. Indonesia is mobile-first, so this section carries more weight here than it would elsewhere.

---

## J-01 Mobile layout

| Pattern | Symptom | Fix |
|---|---|---|
| **iOS input auto-zoom** | Tapping any input with computed font-size under 16px makes Safari zoom the whole page and never zoom back | **16px minimum on inputs.** Do **not** fix it with `maximum-scale=1`, which breaks pinch-zoom and fails WCAG 1.4.4 |
| **`100vw` overflow** | `width: 100vw` includes the classic scrollbar width, causing horizontal scroll | Use `100%` or `100dvw` |
| **`min-width: auto` overflow** | The actual root cause of most sideways-scrolling pages. A flex or grid child will not shrink below its content | `min-width: 0` on the flex child. Masking it with `overflow-x: hidden` on `body` does not work on iOS and kills `position: sticky` |
| **Scroll chaining** | Scrolling to the end of a modal scrolls the page behind it, or triggers pull-to-refresh mid-drag | `overscroll-behavior: contain` on the scroll container |
| **Sticky hover** | A tapped card stays lit because `:hover` never reverses on touch | Wrap hover styles in `@media (hover: hover) and (pointer: fine)`. `any-hover` is the wrong query for hybrid devices |
| **Keyboard-covered input** | A `position: fixed` bottom CTA sits under the iOS keyboard, because the layout viewport does not shrink | `visualViewport` resize listener, or the VirtualKeyboard API with `overlaysContent` |
| **Missing safe area** | Content under the notch, home indicator, or Android 15 gesture bar | `viewport-fit=cover` **and** `env(safe-area-inset-*)` padding. Either alone is broken |
| **Tap highlight flash** | The default grey box on every tap reads as amateur | `-webkit-tap-highlight-color: transparent` **plus a real `:active` state**, not nothing |
| **Double-tap zoom delay** | Buttons feel laggy | `touch-action: manipulation` on interactive elements |
| **Untested 320px** | AI writes `md:` and `lg:` variants and tests at 375px. The unprefixed base case is never checked | Test at **320px**, and at 200% zoom (WCAG 1.4.4) and 400% reflow (1.4.10) |
| **Table that never collapses** | A `<table>` in a card forces the whole page horizontal | Wrap in an `overflow-x: auto` container with `tabindex="0"` and an accessible name, or stack into cards |

---

## J-02 Inputs and forms

Extends E-04. **The first three are WCAG failures, not preferences.**

**GATE where accessibility is contracted:**

- **Missing `autocomplete` tokens.** A formal failure of SC 1.3.5 (technique F107), and it breaks password managers and mobile autofill.
- **Paste blocked on OTP, password, or confirm-email.** An explicit SC 3.3.8 failure. Split-digit OTP boxes must accept a full pasted code.
- **Redundant entry.** Asking for the same information twice in one flow fails SC 3.3.7, new in WCAG 2.2 and almost never implemented by generated code. Prefill, or offer to reuse.
- **Errors by colour only.** A red border with no icon and no text fails SC 1.4.1.

**Guidance:**

| Pattern | Fix |
|---|---|
| **`type="number"` for identifiers** | Phone numbers, national IDs, and card numbers lose leading zeros, accept `e` and `+`, and get a useless spinner. Use `type="tel" inputmode="numeric" pattern`. **Critical for Indonesian phone numbers starting `08`** |
| Wrong `inputmode` | Email without `inputmode="email"`, currency without `inputmode="decimal"` |
| **Disabled submit as validation UI** | See J-03, this one is contested |
| **No error summary** | Inline errors only means a screen reader user submits and hears nothing. Render a summary at the top, `tabindex="-1"`, move focus to it, link each item to its field |
| `aria-invalid` and `aria-describedby` not wired | Visual error text exists but is not programmatically associated with the input |
| **`autoFocus` on load** | Steals the screen reader's position, scrolls the page, pops the mobile keyboard. Only autofocus after an explicit user action |
| **No state persistence in multi-step forms** | Browser back or an accidental refresh wipes everything. Persist per step, warn on unload if dirty |
| **Success with no destination** | Form clears, toast fires, and the user has no reference number and no idea what happens next. Confirmation view with a record ID and a next action |
| **Currency as float** | `parseFloat` plus `toFixed(2)` accumulates rounding error. Store integer minor units |
| **No double-submit prevention** | Client-side disable alone does not stop retries, network replays, or back-button resubmit. Three layers: client disable, server idempotency key, database unique constraint |
| **`<input type="date">` locale assumption** | The browser renders it in the **user's** locale, so an AI-written "MM/DD/YYYY" hint is wrong for an Indonesian user seeing DD/MM/YYYY. Drop the hint or use a controlled component |
| **Character count missing on limited fields** | Show remaining characters as the user types, rather than letting them write a paragraph and then truncating |
| **Password rules revealed only on submit** | Show requirements as they type, with each one ticking off |
| **Formatting intolerance** | Accept a phone number with dashes, spaces, parentheses, or nothing, and normalise server-side. Same for card numbers |
| **Prefill what you already know** | A logged-in user should never retype their own email |

---

## J-03 The disabled submit button, resolved

Two credible sources disagree, so we take a position.

**The case for disabling:** it prevents a wasted round trip and signals that the form is incomplete.

**The case against:** a disabled button is **not focusable**, so a screen reader user tabbing through the form never reaches it and never learns why they cannot proceed. It also hides which field is the problem.

**Gatxel's rule: keep the submit button enabled.** Validate on submit, then move focus to an error summary that names each missing field and links to it.

If a project insists on disabling it, then it is only acceptable with **all three** of: a visible list of what is still missing, required fields marked, and the button remaining focusable with an accessible explanation. That is more work than doing it the right way.

---

## J-04 Data display

Most of this list produces bugs that only appear with real Indonesian data.

| Pattern | Detail |
|---|---|
| **Fixture fingerprints in production** | `John Doe`, `Jane Smith`, `jane@example.com`, `+1 555-0100`, `Acme Inc`, `i.pravatar.cc`, `randomuser.me`, `via.placeholder.com`, `picsum.photos`, `source.unsplash.com`. **Grep-gate these strings in the production build.** This is the most checkable data tell there is |
| **Mononym breakage** | A `firstName` and `lastName` schema with `${first} ${last}` rendering **breaks for the very large number of Indonesians with a single legal name**, producing "Suharto undefined" or a blank surname column. Use one `full_name` field with an optional `display_name`. This is the single most Indonesia-specific bug on the list |
| **Indonesian number formatting** | Indonesian uses `.` for thousands and `,` for decimals, and IDR is conventionally shown with **no decimals**: `Rp1.500.000`, not `Rp1,500,000.00`. Generated code emits `$` and a bare `toLocaleString()` |
| **`toLocaleString()` with no locale argument** | Output follows the **server's** locale, so snapshot tests pass in CI and production is wrong. Always pass an explicit locale |
| **Date-only UTC shift** | `new Date('2026-08-10')` parses as UTC midnight, while `new Date(y, m, d)` parses as local. Mixing them in one file lands dates a day early or late. Use a date-only type |
| **String sort instead of collation** | `a < b` sorts accented and non-ASCII names wrong. Use `Intl.Collator(locale).compare` |
| **Pluralisation by appending `s`** | `${n} item${n===1?'':'s'}` and the awkward `0 items`. Use `Intl.PluralRules`, and a real empty state instead of a zero count |
| **Offset pagination drift** | `LIMIT/OFFSET` over a table with concurrent inserts duplicates and skips rows between pages, and ties in the sort key make it non-deterministic. Add a unique tiebreaker to `ORDER BY`, or use cursor pagination |
| **Count and rows mismatch** | The total comes from a separate query without the same filters, so "24 results" shows 12. Derive both from one query |
| **Null rendered raw** | `null`, `undefined`, `NaN`, `Invalid Date`, `[object Object]` reaching the DOM. Treat any of these strings appearing in a rendered page as a build failure |
| **Skeleton forever** | The API returns `[]`, the loading flag never clears because the code only flips it on non-empty data. **The empty case must exit the loading state** |
| **Truncation with no recovery** | `text-overflow: ellipsis` with no `title` and no tooltip means the full value is unreachable |
| **Long unbroken strings** | Email addresses and URLs blow out a card. `overflow-wrap: anywhere` plus `min-width: 0` |

---

## J-05 Accessibility failures specific to generated code

**GATE where accessibility is contracted, HOUSE otherwise.**

WebAIM's 2026 scan of the top million home pages, ordered by prevalence:

| Failure | Prevalence | Fix |
|---|---|---|
| **Missing alt** | 53.1% | Descriptive alt, or `alt=""` for decorative. Generated alt that is the filename or "image" is worse than empty |
| **Empty links** | 46.3% | An `<a>` wrapping only an icon. Give it an accessible name |
| **Empty buttons** | 30.6% | Icon-only buttons with no accessible name. The single most common thing generated toolbars get wrong |
| **Missing `lang`** | 13.5% | And worse for us: **`lang="en"` hardcoded on Indonesian content makes screen readers pronounce Bahasa with English phonemes** |

**Two findings that should change how we treat ARIA:**

- **Pages with ARIA have more errors than pages without: 59.1 versus 42.0 on average.** ARIA attribute counts are up 27% in one year and over 600% since 2019. Generated code sprays ARIA as a proxy for accessibility work.
- **Delete ARIA that duplicates native semantics.** The first rule of ARIA is not to use ARIA.

Structural failures:

- **`<div>` or `<span>` as a button.** Not focusable, no Enter or Space handling. Use `<button>`
- **Custom modal instead of `<dialog>`.** No `role`, no `aria-modal`, no initial focus, no focus restore on close. Native `<dialog>` gets most of this free
- **`aria-hidden` over focusable content.** The region is hidden from assistive tech while its buttons remain tab-reachable. Use `inert`
- **Nested interactive elements.** A `<button>` inside an `<a>`. Generated cards do this constantly
- **`tabindex` greater than 0.** Breaks natural order
- **Missing `aria-expanded` and `aria-controls`** on disclosures, accordions, and menu triggers. Missing `aria-current="page"` on the active nav item
- **Custom combobox without the APG keyboard model.** No arrow keys, no Escape, no typeahead
- **Carousel with no pause control.** Fails SC 2.2.2 for anything auto-advancing past 5 seconds
- **Broken in forced-colors mode.** Gradient backgrounds and background-image icons vanish in Windows High Contrast. Add a `forced-colors` media query with real border and text fallbacks

---

## J-06 Performance patterns

Extends E-07.

| Pattern | Fix |
|---|---|
| **Barrel-file blowup** | `import { Check } from 'lucide-react'` pulls the whole re-export chain, thousands of modules for one icon. Deep imports or `optimizePackageImports`. **The highest-yield single fix in generated Next.js apps** |
| **Lazy-loaded LCP image** | `loading="lazy"` applied uniformly, including the hero. Eager plus `fetchpriority="high"` plus preload on the LCP resource only |
| **Missing intrinsic dimensions** | No width, height, or `aspect-ratio` on images and embeds. Straight to CLS |
| **Font weight over-fetch** | Five to seven weights loaded, two used. Subset, WOFF2, `font-display: swap`, and a metric-matched fallback |
| **Over-hydration** | A static marketing page shipped as a client component tree |
| **Client fetch waterfall** | Chained `useEffect` fetches where request two waits on request one's state |
| **No facade for third-party embeds** | YouTube, Intercom, Calendly, maps loaded on page load. Use a click-to-load facade |
| **Long tasks blocking INP** | A single 300ms hydration or parse task on interaction. **INP is the metric generated apps fail most** |
| **Animation library for one fade** | framer-motion or GSAP for a single scroll reveal. CSS keyframes plus IntersectionObserver |
| **Whole date library for one format** | `Intl.DateTimeFormat` |
| **Unvirtualised long lists** | The model renders 5,000 rows because the demo had 20 |
| **Testing only on a fast machine** | 4x CPU throttle and Slow 4G as the default local check. **Especially relevant for an Indonesian audience** |
