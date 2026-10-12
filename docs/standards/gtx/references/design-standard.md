# GTX-ENG-001 / D. Design standard

Tier: **HOUSE**. Applies to every UI Gatxel ships.

The premise: the problem with AI-generated design is not that it is broken. It is that it is *average*, and average is now recognisable in about five seconds. A 2026 study scored 1,590 Show HN submissions with deterministic DOM checks and found 22% showed four or more slop patterns and another 32% showed two or three. Being in the clean 46% is a competitive advantage that costs one file.

---

## D-01 DESIGN.md before the first component

**HOUSE. This is the rule that makes all the others enforceable.**

**EN:** Every project has a filled-in `DESIGN.md` at the repo root before any UI code is written. Every color, font, radius, spacing value, shadow, and easing curve in code must reference a token defined there. No hardcoded hex outside the token file. No arbitrary Tailwind values.
**ID:** Kalau tidak ada kontrak token, hasil generate akan selalu kembali ke rata-rata: Inter, ungu, sudut 16px, tiga kartu sejajar. Bukan karena modelnya jelek, tapi karena itu yang paling sering muncul di data latihnya.

Template in `assets/DESIGN.md`.

**The sequencing question, resolved.** Two schools disagree. The tokens-first school says define everything before building. The `impeccable` school says do not pick colors and type before you know the surface, because "those get decided with the surface, not before it."

Gatxel's position: **the token file is a contract from day one, the token values are decided against a real screen.** Create `DESIGN.md` with named slots immediately so nothing can land untokenised. Fill the actual values after the first real screen exists, then lock them.

---

## D-02 The banned defaults

**State the criterion correctly, because we had it loose.** We ban **the faces an AI reaches for unprompted**, not the faces that are popular. Popularity was a proxy and it was a bad one: our own house face is now more requested per day than two entries on this list. The test is whether a model produces it with no instruction, whether it is the default in shadcn/ui, v0, Lovable or Bolt, and whether it appears in the published slop critiques. All three, or it is not banned.

**`Instrument Sans` is not `Instrument Serif`.** Only the serif is banned. Instrument Sans is OFL, has a width axis and a true italic, and is fine to use.

**HOUSE.** Each of these is a documented, named tell. Banned unless `DESIGN.md` explicitly justifies it in writing.

**Typography**

- **Inter, Geist, Space Grotesk, Instrument Serif** as the chosen face. Also heavily overrepresented: Poppins, Roboto, Montserrat, DM Sans. Six faces account for roughly 94% of AI frontend output.
- One font for everything, with no pairing.
- **Italic serif display headline.** Reads as taste in isolation, has become the universal AI startup hero.
- **Kicker or eyebrow label above the heading**, tracked uppercase or a pill chip. The default AI SaaS hero.
- Flat type hierarchy. Fewer steps at a ratio of 1.25 or more beats many steps that are nearly the same size.
- All-caps body text. Crushed or wide letter spacing on body text.

**Color**

- **Purple to indigo gradients.** The single most recognisable tell. It traces to Tailwind shipping `bg-indigo-500` as its demo default around 2019, which saturated every tutorial and template and then the training data. `from-blue-600 to-indigo-700` is near-universal AI output.
- **Cream and beige "premium" palettes.** These became the *new* default the moment people started avoiding purple. Same problem, one iteration later.
- Cyan on dark. Dark mode with colored glow shadows.
- Gradient text on headings and metrics.
- Permanent dark mode chosen by reflex rather than by decision.
- Pure `#fff` and `#000` with no warm or cool tint.

**Layout and visual detail**

- **Colored left or top border strips on cards.** Described in one study as "almost as reliable a sign of AI-generated design as em dashes for text."
- **Icon tile stacked above a heading.** The universal AI feature-card template.
- **Identical card grids.** Same-sized cards, icon plus heading plus text, repeated endlessly. Exactly three per row by reflex.
- **Hero metric row.** Big number, small label, three supporting stats.
- Tiny numbered section labels: "01" "02" "03".
- Glassmorphism and `backdrop-blur` used as decoration rather than as layering.
- Nested cards inside cards.
- Border radius over 24px on a small card. Use 12 to 16px for cards, full pill for tags and buttons only.
- Hairline border plus wide diffuse shadow. Pick one.
- Decorative grid-line backgrounds, radial glow halos, repeating gradient stripes.
- Monotonous spacing: the same value everywhere, no rhythm.
- **Emoji used as UI icons or in navigation.**
- Floating 3D blobs, abstract gradient meshes, over-smooth plastic illustrations.
- Fake browser chrome, phone bezels, mock IDE windows.
- **Bento grids reached for by default.**

**Motion**

- Pulsing status dots that make a static value look live.
- Decorative blinking cursors on non-editable copy.
- Auto-scrolling marquees.
- Bounce or elastic easing. Use ease-out-quart, quint, or expo.
- The same fade-in on every element. `opacity: 0` plus `translateY(20px)` plus `ease-in-out` appears in a large majority of AI-generated landing pages.
- Hover states that move the element under the cursor.

**Structure**

- The canonical AI landing page order: nav, hero, three feature cards, logo strip, testimonials, pricing, FAQ accordion, CTA band. If our page has exactly this shape, change it.

**Clutter, the 2026 additions**

- **The explanatory subheader under every heading.** A page titled "Hari Ini" does not need two sentences underneath explaining what "Hari Ini" means. Claude Code and Codex both put these under everything. **If it is not tangibly useful, delete it.**
- **Redundant UX writing.** Label, sublabel, helper text, and hint text all saying the same thing in slightly different words. Say it once.
- **The sparkle icon** as the universal AI affordance. It is now so common it reads as a template rather than a feature. If a product has an AI feature, **name the action** ("Buat balasan") rather than sparkling it.
- **A bolted-on "Ask AI" bubble** on a marketing site with nothing behind it.
- **Modal abuse.** Complex settings crammed into a dialog. If it needs a scrollbar and three columns, it deserves its own page.
- **Massive icon containers** larger than the content they introduce.
- **AI image tells in site assets:** over-smooth skin, hands that are symmetric but wrong, garbled text on background signage and screens, and identical lighting across a "team" grid.

---

## D-03 shadcn/ui defaults are a tell

**HOUSE.** shadcn is fine. Shipping it unmodified is not.

The named giveaways: slate or zinc neutrals, radius at roughly half a rem, Inter at default sizes, DataTable and Dialog styled exactly like the docs example, muted indigo or zinc as primary, untouched `rounded-2xl shadow-lg p-6`.

Five token edits fix it without touching a single component: change the neutrals, change the radius (to 0, or 1rem, or full pill), override the font pairing, pick one saturated accent, and add the signature tokens shadcn omits (grain, custom shadow, custom easing).

---

## D-04 States are part of the design

**HOUSE for existence, GUIDE for treatment.**

**EN:** Every interactive element ships with designed focus, hover, active, disabled, and loading states. Every data region ships loading, empty, partial, error, and success. A component without designed states is not finished.
**ID:** Yang paling sering hilang dari hasil generate bukan tampilan normalnya, tapi kondisi lainnya. Fokus keyboard, tombol nonaktif, daftar kosong, semua itu hampir selalu tidak dibuat.

Detail in `references/ux-guide.md`.

---

## D-05 Contrast and target size are not optional polish

**GATE for WCAG 2.2 AA on client-facing surfaces where the client has an accessibility obligation. HOUSE otherwise.**

- Body text: **4.5:1**. Large text (18pt / 24px, or 14pt / 18.5px bold): **3:1**.
- **UI component boundaries and focus indicators: 3:1** against adjacent colors. This is the criterion AI-generated designs fail most often. `border-gray-200` on white is about 1.2:1 and fails.
- Minimum target size **24 x 24 CSS px** (WCAG 2.2 AA), with **44 x 44** as the design target for anything touch-primary.
- Never `outline: none` without a replacement indicator.

Note on legal exposure: Indonesia has no WCAG mandate. UU 8/2016 Pasal 5 and 124 create accessibility obligations in principle, but there is no enforcement mechanism and no WCAG reference in Indonesian law. We adopt WCAG 2.2 AA because it is the quality bar and because any client with European exposure sits under the European Accessibility Act, whose deadline passed on 28 June 2025.

---

## D-06 The workflow that avoids slop

**GUIDE**, but it is the part that actually changes the output.

**1. Build a taste library.** Screenshots of work we admire, grouped by aesthetic family, with the vocabulary that describes each one. Dribbble, Pinterest, and X are the practical sources. Without this, every brief starts from "modern and clean", which is a request for the mean.

**2. Prompt with four things, not adjectives.** Never the words "clean", "modern", or "make it look good". Each is a request for the statistical mean.

| Give it | Not this | This |
|---|---|---|
| **Aesthetic** | "modern, clean, premium" | "like a Linear product page from late 2024: strong sans headings, generous negative space, thin separators, almost no color until the CTA" |
| **Reference** | nothing | Two screenshots from the taste library, plus a live URL. We are matching feel, not copying |
| **Intent** | "a landing page" | "a landing page for an Indonesian SME accounting tool. The one action is booking a demo. Audience is a finance manager, 35 to 50, on a laptop" |
| **Guardrails** | nothing | The D-02 list, verbatim, plus anything project-specific |

**3. Generate wide, then narrow.** Five directions in five aesthetic families, viewed side by side. Pick one. Three variations of that one. Pick one. Then tweak. Do not iterate on a first output, and never say "make it look more premium" and hope.

**4. Nail the hero image before the body.** If there is a hero visual, settle it first. Everything else calibrates against it.

**5. Iterate by deleting.** Name three generic elements, remove them, replace with space. Repeat until the page stops surviving subtraction.

**The prompt skeleton.** Fill every slot. An empty slot is where the model inserts a default.

```
CONTEXT   Who this is for, and the one emotion it should carry.
PLATFORM  Mobile or desktop first, and the column grid.
AESTHETIC A named family plus a concrete reference, not an adjective.
TYPE      Named display and body faces, and the scale ratio.
COLOR     Named tokens, three hues maximum, 60/30/10.
SPACE     Base unit, section rhythm, divider treatment.
MOTION    Easing curve, duration range, what is allowed to animate.
COPY      Tone, person, and whether it is Indonesian or English.
COMPONENTS The exact functional blocks on this screen, nothing more.
BANNED    The D-02 list verbatim, plus anything the client rejected.
```

**Replace vague words with constraints.** "Clean" becomes "two sections maximum, generous whitespace, muted tones, one accent". "Premium" becomes a named reference and a type scale. If a word in the prompt cannot be checked against the built page, it is doing no work.

**Build in steps, not one shot.** Layout first. Then states. Then error handling. Then motion. Asking for a whole app at once guarantees the happy path only, which is exactly the failure in E-00.

---

## D-07 Tooling

Two mature open-source tools do most of this mechanically. Both are worth installing on the Gatxel machine.

**[`impeccable`](https://github.com/pbakaus/impeccable)** ([impeccable.style](https://impeccable.style/slop/)) publishes a named taxonomy of **64 documented patterns**, of which **59 are deterministic CLI rules**, no API key, no LLM. (Their own site quotes 64, 59, and 58 in three different places, so quote the 64/59 split and say which you mean.)

- `npx impeccable detect src/` on source, or `npx impeccable detect https://url` against a live page
- `npx impeccable detect --json` for CI
- `/impeccable init` writes `PRODUCT.md` and `DESIGN.md` by scanning the codebase
- `/impeccable live` drops an element picker onto the running dev server and offers three production-quality variants per element, then writes the chosen one back to source. This is the tweak panel, already built
- `/audit`, `/clarify`, `/harden` before shipping

**[`Nutlope/hallmark`](https://github.com/Nutlope/hallmark)** (`npx skills add nutlope/hallmark`) ships 22 named themes and 21 page macrostructures, plus a `study` verb that extracts design DNA from screenshots or a URL into a portable `design.md`. `study` is the fastest way to turn the taste library into a constraints file.

**CI enforcement of the token contract:**

| Check | Tool |
|---|---|
| No hex outside the token file | `stylelint-color-whitelist`, or `rg '#[0-9a-fA-F]{3,8}' --glob '!**/tokens.css' --glob '!**/*.svg'` |
| No arbitrary Tailwind values | `eslint-plugin-tailwindcss` rule `no-arbitrary-value` |
| No raw Tailwind color utilities | `no-restricted-syntax` on `/(bg\|text\|border\|ring\|shadow\|from\|via\|to)-(indigo\|violet\|purple\|slate\|zinc\|gray)-\d{2,3}/` |
| Font allowlist | stylelint `declaration-property-value-allowed-list` on `font-family`, plus grep `next/font` imports |
| The gradient | `rg 'from-(blue\|indigo\|violet\|purple)-\d00.*to-(indigo\|violet\|purple\|fuchsia)-\d00'` |
| Everything else | `npx impeccable detect --json` against the preview URL |

Set a **rule-count budget** for `impeccable`, not zero tolerance, so it does not become unmergeable on day one. Ratchet it down each sprint.

---

## D-08 Type and colour, checked against the source everyone copies

**HOUSE.** We read the whole Figma resource library, which is the most-linked design reference on the web and the thing a client will quote back at you. Ten articles on typography and colour. **Three rules survived checking.** The rest is either unmeasured or contradicts WCAG 2.2.

### The three that survived, and are now Gatxel rules

1. **Contrast: 4.5:1 for normal text, 3:1 for large text.** Correct, and it is WCAG 2.2 SC 1.4.3 at AA. Add what the source omits: **large text** means 18pt / 24px, or 14pt / 18.66px bold, and **SC 1.4.11 requires 3:1 for UI components and graphical objects** including focus indicators and input borders.
2. **60-30-10.** 60% dominant, 30% secondary, 10% accent. Old interior design heuristic, still the fastest way to stop a palette looking arbitrary.
3. **Palette structure: one primary, one secondary, one or two accents.** Consistent with D-02's three-hue cap.

### The bans, now with evidence behind them

Our banned-typeface list was a judgement call. It is now an evidenced one.

**Four of our seven banned faces are Figma's own top recommendations.** Inter is ranked **number one** in "24 best fonts for websites". DM Sans, Poppins and Montserrat appear in both that list and the sans-serif list. Geist appears in the pairings article. Instrument Sans appears twice. HTTP Archive usage data independently confirms why: Roboto is on roughly 10.7% of pages, Poppins 6.0%, Open Sans 5.6%, Montserrat 3.9%.

That is the whole argument. These are not the best fonts, they are the **most used** fonts, and the "best fonts" list is the Google Fonts popularity ranking with adjectives attached. Choosing from it is choosing to look like everything else, which is the definition of the problem this standard exists to solve.

**The cream and beige "premium" palette ban now has an accessibility justification too.** The library's 100 colour combinations ship with **no hex values at all**, only palette JPEGs, and with exactly one throwaway sentence about accessibility and zero per-palette contrast checking. We measured a sample using conventional values for the named colours:

| Combination | Pair | Ratio | 4.5:1 | 3:1 |
|---|---|---|---|---|
| Burnt sienna, sandy on soft beige | E1C699 on F5F5DC | **1.49:1** | fail | fail |
| Wisteria bloom, soft lavender on lavender | B39DDB on E6E6FA | **1.95:1** | fail | fail |
| Golden taupe, muted gold on soft cream | C9A227 on FFFDD0 | **2.33:1** | fail | fail |
| Chocolate truffle, caramel on cream | C68E17 on FFFDD0 | **2.78:1** | fail | fail |
| Stormy morning, blue-gray on mist | 7393B3 on EAF0F6 | **2.79:1** | fail | fail |
| Ink wash, cool gray on soft ivory | 8B8C89 on FFFFF0 | 3.35:1 | fail | pass |
| Chocolate truffle, dark brown on cream | 3D2B1F on FFFDD0 | 12.93:1 | pass | pass |

**Nine of thirteen sampled pairs failed body text contrast. Eight of those also failed the 3:1 floor.** This is structural, not bad luck: a large share of the 100 are explicitly monochromatic, and adjacent tones inside one hue family cannot clear 4.5:1. The palettes named "dark brown, caramel and cream", "muted gold, warm taupe and soft cream" and "terracotta, soft beige and sandy neutrals" **are** the cream and beige premium palette we ban, and they measure between 1.49:1 and 2.78:1.

**Gatxel rule: a palette is not a palette until you have named which pair carries body text and measured it.** A named mood and a swatch strip is a mood board, not a design token set.

### Type rules we are explicitly overriding

| Widely published | Gatxel rule |
|---|---|
| "Line height 1.125 to 1.200 times the font size results in better readability" | **Wrong for screen body copy, and it fights WCAG.** SC 1.4.8 at AAA asks for at least **1.5** within paragraphs, and SC 1.4.12 at **AA** requires content to survive a user override to 1.5. A layout built at 1.2 has no vertical slack and clips under that override. 1.2 is roughly the browser default and is InDesign's print auto-leading, imported to the wrong medium. **Use 1.4 to 1.6 for body, 1.1 to 1.25 for display only** |
| "40 to 60 characters per line is ideal for accessibility" | Not a WCAG rule. SC 1.4.8 caps at **80** characters, 40 for CJK. The conventional measure is **45 to 75**. And 40 to 60 set at 1.2 line height produces exactly the dense block that low-vision and dyslexic readers struggle with. The two bad rules compound |
| "Apply phi scaling, 1.618, to font sizes" | **Unusable for UI.** From a 16px base it gives 16 / 25.9 / 41.9 / 67.8 / 109.7. Nothing between 16 and 26px, so no caption tier, no label tier, no subhead tier. Real UI scales are **1.125 to 1.25** |
| "Body 16px, H1 48px at 3em" | Fine as a starting point, and the only concrete number in the source. Put it in `DESIGN.md` as a decision, not as a default |

Note the inversion in the source material: it recommends **1.2 for line height**, which is far too tight, and **1.618 for the type scale**, which is far too loose. Each number applied to the wrong axis.

### What is missing from the reference everyone uses

Across ten articles on type and colour there is no type scale ratio for UI, no minimum body size, no letter-spacing guidance, no non-text contrast, no focus indicator contrast, and no target size. Contrast is mentioned correctly in exactly one article out of ten. **When a client says "but Figma says", that is what they are citing.**

### Two claims to strike on sight

- **"High-quality visuals are encoded in the brain 74% faster than text."** The primary source says 74% faster than **dull content**, not than text. The comparator was swapped, which turns it into a version of the debunked "visuals process 60,000x faster than text" myth. The underlying study is vendor marketing research, not peer reviewed.
- **"Open Sans is one of the most readable fonts", "even GitHub and Mozilla use Inter".** Uncited, and the second is stale: GitHub shipped its own Mona Sans in 2022.

---

## D-09 Type scale, size and measure, with the evidence attached

**HOUSE.** The numbers in circulation are mostly convention presented as law. Here is what each one actually is, so nobody defends the wrong thing in a client review.

### Base size

**No standard specifies a minimum font size. Not WCAG, not any of them.** SC 1.4.4 requires text to resize to 200% and SC 1.4.8 covers width, spacing, colour and justification, and **neither specifies a size**. "WCAG requires 16px" is false.

Nor does CSS. The initial value of `font-size` is the keyword `medium`, and **no specification defines what `medium` resolves to.** Browsers typically use 16px for proportional and **13px for monospace**, which is why `<code>` renders small by default.

So 16px is a user-agent default that became convention. **Keep it as the Gatxel floor for body text anyway**, because it is what users have calibrated to and because it is the iOS input-zoom threshold (K-06). Long-form reading goes to 18 to 20px. Just do not tell a client it is a legal requirement.

### Measure, and the three competing numbers

| Number | What it actually is |
|---|---|
| **80 characters, 40 for CJK** | **The only normative number.** WCAG SC 1.4.8, **Level AAA**, and phrased as "a mechanism is available", so it requires a mechanism to reach 80, not that your default is 80 |
| **45 to 75, ideal 66** | **Bringhurst**, and his words are "widely regarded as ideal". He is reporting craft consensus and **cites no study**. His 40 to 50 figure applies to **multi-column** work only, which is almost certainly where the "40 to 60" claim leaked in from |
| **50 to 120** | WebAIM, explicitly hedged: "there is not a universally optimal number of characters per line" |

**Gatxel rule: 45 to 75 characters for body prose, and never above 80.** Cite it as craft convention, not as research, because it is not.

One correction worth carrying: **"longer lines are always slower to read" is contradicted by the screen literature.** Most studies found *faster* reading with longer lines. The shorter-line advantage shows up in **comprehension**, not speed.

### Ratios, and how many sizes

**No evidence supports any specific ratio, and no major design system ships a strict one.** Material 3, Carbon, GOV.UK, Primer, Apple HIG and Tailwind all hand-tune. Carbon's published rule is **additive, not multiplicative**: increments grow by 2, then 4, then 6, then 8. Tailwind's implied ratios wander between 1.111 and 1.333. GDS describes its own process as prototyping with real content and then refining.

**So: pick 1.2 or 1.25 as a starting point, round every step to a whole pixel, and hand-adjust for optical fit against real content.** Never claim a ratio is optimal, and never use 1.618 for a UI scale: from a 16px base it gives 16 / 25.9 / 41.9 / 67.8, with nothing between 16 and 26, so no caption tier, no label tier and no subhead tier.

**"NN/g says three type sizes" is unverified** and no such publication could be located. The "three" traces to Nathan Curtis and is about **body sizes only**. The "seven" traces to Dan Mall, arguing from Miller's 1956 working-memory paper, which is about recall span and not design.

What real systems ship: Primer 6 base sizes, GOV.UK 7 scale points, Apple 10, Material 3 eleven, Tailwind 13, Carbon 17.

**Gatxel default: 3 body sizes, 4 heading sizes, 1 caption. Eight tokens in `DESIGN.md`.** Expand only on evidence of need.

### rem, px, and what actually breaks

Keep `rem` for `font-size`, but fix the reason we give. **`px` is not a WCAG 1.4.4 failure**: px scales correctly under page zoom and under text-only zoom, and 1.4.4's own Understanding document says scaling is "primarily a user agent responsibility."

What `px` actually breaks is the **browser default font-size preference**, and only in desktop Chrome and Firefox. Safari on macOS ignores that setting for both units, and all mobile browsers treat px and rem identically under text scaling. That is still a real population and a sufficient reason for the rule.

| Mechanism | `px` responds? | `rem` responds? |
|---|---|---|
| Page zoom | Yes | Yes |
| Text-only zoom | Yes | Yes |
| **Browser default font-size preference** | **No** | **Yes** |
| Mobile OS text scaling | Yes | Yes |

The far more important unit rule is the one in K-05: **bare `vw` for `font-size` is an explicit WCAG failure**, technique F94. That is what actually fails an audit, and it is everywhere in fluid-type snippets.

`html { font-size: 62.5% }` reduces the user's chosen default to 62.5% of itself, working directly against the preference `rem` exists to honour. Do not use it.

### Line height

**"Line height must be at least 1.5 for accessibility" is a misreading** of SC 1.4.12 Text Spacing at AA. That criterion requires content **not to break when the user applies** 1.5 line height, 2x paragraph spacing, 0.12em letter spacing and 0.16em word spacing. It does not require you to ship 1.5.

Our 1.4 to 1.6 for body and 1.1 to 1.25 for display is compliant. **The testable requirement is that the layout survives the user override**, so test it with the Text Spacing bookmarklet rather than arguing about the shipped value.

### Two more corrections

- **"ALL CAPS is always harder to read" is false as stated.** MIT AgeLab found lowercase required **26% more time** than uppercase for glanceable isolated words. The all-caps penalty applies to continuous prose, not to labels and single words. Our D-02 ban on all-caps **body** stands; a small-caps or uppercase label is fine.
- **"Web design is 95% typography."** Oliver Reichenstein, iA, **19 October 2006**. The essay's actual claim is that "95% of the information on the web is written language", so the 95% is about the proportion of web *information* that is text, **not** a claim that 95% of design work is typography. Quote the body, not the headline.

---

## D-10 The house typeface: Plus Jakarta Sans

**HOUSE.** The Gatxel default for body and UI on every project, **unless Nabila specifies otherwise for that project**. Recorded in `DESIGN.md` like any other token, and overridable there in writing.

### Why this one, and the client story is true

| Fact | Value |
|---|---|
| Designer | **Gumpita Rahayu**, founder of **Tokotype**, an Indonesian foundry |
| Commissioned by | **6616 Studio** |
| For | The **Jakarta Provincial Government**, as part of the "+Jakarta, City of Collaboration" city identity |
| Released | **2020**, v1.000 on 21 February |
| Licence | **SIL Open Font License 1.1.** Free for commercial and web use, embedding and modification. No paid or pro version exists |

That provenance is verified and safe to tell a client. It is a geometric sans referencing Neuzeit Grotesk and Futura, not a UI grotesque like Inter, which matters for the sizing notes below.

### The slop check, honestly

Google Fonts request telemetry, peak daily requests, August 2026:

| Face | Requests/day | Status |
|---|---|---|
| Inter | 2,783,791,565 | banned |
| Montserrat | 1,805,600,362 | banned |
| Poppins | 1,577,387,664 | banned |
| DM Sans | 296,966,681 | banned |
| **Plus Jakarta Sans** | **117,364,186**, roughly 250,000 sites | **house default** |
| Space Grotesk | 74,360,070 | banned |
| Instrument Serif | 53,829,636 | banned |

Evidence it is not in the AI-default cluster: **absent from the HTTP Archive Web Almanac 2025 font rankings entirely**, while Roboto, Poppins, Open Sans, Montserrat and Inter all chart. Not named in any AI-slop critique found. Not the default in shadcn/ui, v0, Lovable or Bolt, which cluster on Inter and Geist. On a landing page gallery, Inter has 200 catalogued pages and Plus Jakarta Sans has **five**. Growth is roughly **+12% over 90 days**, which is drift rather than a takeover.

**The honest counterweight, which forces a correction to our own rule.** At 117M requests a day, Plus Jakarta Sans is **more used than two faces already on our ban list**. If the ban criterion were raw popularity, the standard would be internally inconsistent.

**So state the criterion correctly, in D-02 and here: we ban the faces an AI reaches for unprompted, not the faces that are popular.** Popularity is a proxy we were using badly. On the real criterion, Plus Jakarta Sans passes today.

**Review trigger.** Re-check the Google Fonts telemetry once a year. **Reconsider if it crosses roughly 300 million requests a day, or if it appears as the default in any major AI UI generator.** Write the date of the last check into this section when you do it.

### What we verified in the binary, not from blog posts

- **True italic, not an oblique.** Un-shearing the italic by its 8 degree angle leaves different point counts on `a`, `g`, `y` and `n`, so the forms are redrawn.
- **Variable, `wght` 200 to 800, default 400. That is the only axis.** Roman and italic are two separate variable files. **Do not pass an `axes` option**, Next.js does not expose one for this family.
- **605 codepoints.** Subsets: latin, latin-ext, vietnamese, cyrillic-ext. **Indonesian is fully covered.** Vietnamese is fully covered.
- **There is no usable Cyrillic and no Greek.** The `cyrillic-ext` subset contains **7 codepoints**, and all 64 Russian letters are missing. **If a client needs Russian or Greek, this font cannot do the job.** Use Onest.
- **It ships `tnum`**, plus `frac`, `numr` and `dnom`. That matters: **L-05 requires `font-variant-numeric: tabular-nums` on numeric columns, and this font can honour it.** Financial tables in GatBooks will align.

### Sizing, because it is not a drop-in for Inter

| Metric, upm 1000 | Plus Jakarta Sans | Inter |
|---|---|---|
| x-height | 0.536 em | 0.5459 em |
| cap height | **0.745 em**, tallest measured | 0.7275 em |
| x/cap ratio | **0.719**, lowest of the group | 0.750 |
| `n` width | **0.573 em**, narrowest | 0.5908 em |
| descender | **-0.222 em**, shallowest | |

Three consequences, and they are all practical:

1. **At the same pixel size it reads slightly smaller than Inter.** Body floor stays 16px, and **when porting a design from Inter, expect to add about 1px.**
2. **It is narrow**, which is a real advantage for Indonesian: "pemberitahuan", "menggunakan" and "penyelenggaraan" fit in fewer pixels.
3. **The descender is shallow against a tall ascender**, so tight leading looks cramped. **Use 1.6 line-height for body**, at the top of the D-09 range.

One honest limitation, from typographer Oliver Schöndorfer: word spacing is "not spaced out enough, especially in longer text" and can "become a bit blurry in smaller sizes." It is a geometric sans, so **at 12 to 13px in a dense data table it will not match a purpose-built UI grotesque.** Either bump the size or keep a grotesque for the densest tabular surfaces, and note that choice in `DESIGN.md`.

No Windows ClearType problems were found, which is worth saying because the same comparison measured Geist reading about 8% slower at 16px on Windows.

### The finding that changes implementation

**The Google Fonts build has no stylistic sets.** Tokotype's original ships three: **ss01 Lancip (sharp), ss02 Lurus (straight), ss03 Lingkar (swirl)**. Verified twice: the GSUB feature list on the Google build contains only `calt, ccmp, dnom, frac, liga, locl, numr, pnum, tnum`, and there are no `.ss01`-style alternates among the unmapped glyphs.

**Those alternates are exactly our anti-slop lever**, because they let us set a face nobody else is customising. So:

- **Default: `next/font/google`.** Correct for most projects, zero setup, self-hosted at build time so no request reaches Google, which also helps the P-04 privacy position.
- **When the brand needs a distinctive setting: self-host Tokotype's original release via `next/font/local`** and use the stylistic sets. Record which set, and why, in `DESIGN.md`.

### Implementation

```ts
// app/fonts.ts
import { Plus_Jakarta_Sans } from 'next/font/google'

export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],       // add 'latin-ext' or 'vietnamese' ONLY if actually shipped
  display: 'swap',
  variable: '--font-jakarta',
  adjustFontFallback: true, // generates the CLS-reducing fallback face
  // Do NOT set `weight`  -> that collapses the variable axis to static instances
  // Do NOT pass `axes`   -> wght is the only axis and Next.js exposes no option
})
```

```tsx
// app/layout.tsx
<html lang="id" className={`${jakarta.variable} antialiased`}>
```

```css
/* app/globals.css, Tailwind v4 */
@import 'tailwindcss';

@theme inline {
  --font-sans: var(--font-jakarta);
}
```

`@theme inline` is required because the value references another CSS variable.

If self-hosting for the stylistic sets, these are the metric overrides, computed from the real font metrics against Arial:

```css
@font-face {
  font-family: 'Plus Jakarta Sans Fallback';
  src: local('Arial');
  ascent-override: 98.88%;
  descent-override: 21.15%;
  line-gap-override: 0%;
  size-adjust: 104.98%;   /* PJS is wider than Arial on average */
}
```

### Pairings, and the one to lead with

**Mohave** for display, and this is the recommendation. **Same foundry, same designer, same OFL licence.** Variable `wght` 300 to 700 with a true italic. It gives an **all-Indonesian, single-foundry, two-face system with one provenance story**: a commissioned city identity and its sibling display face. At roughly 3,000 sites it is effectively undiscovered, so the slop risk is near zero. Mohave for the hero and H1, where it began life as a titling face. Plus Jakarta Sans for everything below.

Other approved pairings, all OFL and none on the ban list:

| Face | Use |
|---|---|
| **Fraunces** | Brand-led marketing sites wanting warmth. Variable `opsz`, `wght`, plus SOFT and WONK |
| **Newsreader** | Long-form: publishing, knowledge bases, documentation. Vietnamese coverage matches Plus Jakarta Sans exactly |
| **Young Serif** | Headlines only. One static weight, so it cannot carry body |
| **Anuphan** or **Bai Jamjuree** | Regional clients needing Thai. Cadson Demak, Bangkok |
| **IBM Plex Mono** or **Martian Mono** | Monospace. **Not Geist Mono**, which is on the ban list |

**Do not adopt Bricolage Grotesque**, despite it being widely recommended as the escape from slop. It already sits level with Plus Jakarta Sans at 117.5M requests a day and is on a faster track to becoming a default.

**When Plus Jakarta Sans is the wrong answer:** a client with existing brand guidelines that specify a face, a project needing Cyrillic or Greek, a dense data-heavy interface where a UI grotesque is genuinely better at 12 to 13px, or any project where Nabila says otherwise. In every one of those cases the override goes in `DESIGN.md` in writing, with the reason.
