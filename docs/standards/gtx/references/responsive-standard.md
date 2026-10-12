# Responsive layout standard

**Tier: HOUSE for the checkable rules, GATE where a rule is also a WCAG conformance requirement.** Stack assumption: Next.js App Router with Tailwind v4.

Indonesian traffic is majority mobile and it is a long tail of Android widths that fits no device table. Design for the content, verify at the extremes.

---

## K-01 Touch target size, and the number everyone gets wrong

**GATE where it is a conformance requirement.**

Three different numbers circulate and people quote them interchangeably. They are not interchangeable.

| Source | Number | Status |
|---|---|---|
| **WCAG 2.2 SC 2.5.8 Target Size (Minimum)** | **24 x 24 CSS px** | **Level AA. This is the conformance requirement** |
| WCAG 2.2 SC 2.5.5 Target Size (Enhanced) | 44 x 44 CSS px | Level AAA. Aspiration, not conformance |
| Apple Human Interface Guidelines, iOS | 44 x 44 pt **default**, **28 x 28 pt minimum** | Platform recommendation |
| Material, Android | 48 x 48 dp with 8 dp spacing | Platform recommendation |

**"44px is the WCAG AA minimum" is wrong and we have written it in briefs before.** It is AAA. AA is 24 x 24, and it carries a **spacing exception** that AAA does not: a target smaller than 24 x 24 still passes AA if a 24 px diameter circle centred on it does not intersect another target's circle. The other exceptions are Equivalent, Inline, User Agent Control and Essential.

Apple's current wording is also not what the folklore says. The HIG lists 44 x 44 pt as the **default** control size and **28 x 28 pt as the minimum**, per platform, alongside spacing advice of about 12 pt of padding around bezelled elements and about 24 pt around unbezelled ones.

**Gatxel rule.** 24 x 24 CSS px is the floor and is a GATE item, because falling below it is a WCAG 2.2 AA failure. 44 x 44 is the house target on touch surfaces, as craft rather than conformance. When a control has to be smaller, satisfy the spacing exception deliberately and write down that you did.

---

## K-02 The viewport meta tag

**GATE.**

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

That is the whole rule. In Next.js App Router, export `viewport` from the root layout rather than hand-writing the tag.

**`user-scalable=no` and `maximum-scale=1` are accessibility failures**, under **SC 1.4.4 Resize Text, Level AA**. The authoritative mapping is W3C ACT rule **b4f0c3, "Meta viewport allows for zoom"**, whose expectations are that `user-scalable` is not `no` and that `maximum-scale` is not less than 2. So `maximum-scale=5` passes and `maximum-scale=1` fails.

They are also pointless. iOS has ignored both by default since iOS 10. If someone added `maximum-scale=1` to stop the iOS input zoom, they added a WCAG failure that does not even do the thing they wanted. The actual fix is K-06.

---

## K-03 Breakpoints come from the content

**HOUSE.**

Google's own guidance, verbatim: "Don't define breakpoints based on device classes, or any product, brand name, or operating system. This makes your code difficult to maintain. Instead, let the content determine how its layout changes to fit the container." MDN adds that best practice is to define breakpoints in **relative units** rather than absolute device sizes.

**Delete every device-name breakpoint table you find.** The "320 iPhone SE, 375 iPhone, 414 Plus, 768 iPad, 1024 iPad landscape" list is contradicted by the primary source and by the data. The current single most common mobile resolution worldwide holds roughly 13% share. There is no modal device to design for, least of all in Indonesia.

Method: start at one column, widen the browser slowly, and add a breakpoint at the width where the layout stops looking right. That width is the breakpoint. It will rarely equal a device size.

**Tailwind v4 defaults, for reference.** These are **rem** in v4, where they were px in v3, so copy-pasted v3 values silently change behaviour:

| Prefix | Min width |
|---|---|
| `sm` | 40rem, 640px |
| `md` | 48rem, 768px |
| `lg` | 64rem, 1024px |
| `xl` | 80rem, 1280px |
| `2xl` | 96rem, 1536px |

There is no `xs`. Customise with `@theme { --breakpoint-3xl: 120rem; }` in CSS. `tailwind.config.js` is no longer the default mechanism in v4.

Use `em` or `rem` in hand-written media queries. Media Queries Level 4 specifies that relative units in a media query resolve against the **initial** value, so they track the user's browser default font size and are immune to `html { font-size: 62.5% }`. Px media queries move with page zoom but ignore the browser font-size setting, which is the setting low-vision users on Android actually change.

---

## K-04 Container queries are the default now, not the advanced option

**HOUSE.**

A component's layout should respond to **its container**, not to the viewport. A card in a sidebar and the same card in a full-width grid are the same component at two sizes, and a viewport media query cannot tell them apart.

Support is **Baseline widely available since February 2023**. Chrome 105, Safari 16.0, Firefox 110. There is no polyfill decision to make in 2026, and in Tailwind v4 there is no plugin to install either.

```css
.card-wrap { container-type: inline-size; container-name: sidebar; }
@container sidebar (width > 30rem) { .card { grid-template-columns: 1fr 2fr; } }
```

Tailwind v4, container queries in core:

```html
<div class="@container">
  <div class="flex flex-col @md:flex-row @max-md:gap-2">
```

Container scale runs `@3xs` 16rem through `@7xl` 80rem, named containers work as `@container/main` with `@sm/main:`, and stacking works: `@min-md:@max-xl:hidden`.

**What `container-type: inline-size` actually breaks.** It applies inline-size containment, so the container's own inline size is computed as if it had no content. Shrink-to-fit stops working: `width: fit-content`, `display: inline-block`, and content-based grid and flex track sizing no longer size the container. It fills its available inline space instead. It also establishes an independent formatting context, so floats are contained and margins do not collapse through it. **`container-type: size` additionally applies block-size containment and the element collapses to zero height** unless you give it one.

You cannot query the element itself, only an ancestor. Add a wrapper.

**Correction to widely repeated advice.** The claim that `container-type` creates a containing block for `position: fixed` descendants and a new stacking context is **out of date**. The CSSWG removed layout containment from `container-type` in July 2024, and it now only establishes an independent formatting context. That shipped in Chrome, Firefox and Safari. Any blog post warning about trapped fixed-position children is describing behaviour that no longer exists.

---

## K-05 Fluid type with `clamp()`, without failing WCAG

**GATE, because the failure mode is a conformance failure.**

`clamp(MIN, VAL, MAX)` resolves as `max(MIN, min(VAL, MAX))`. It is the right tool. It is also the most common way a site fails **SC 1.4.4 Resize Text at Level AA**, and there are two separate ways to fail:

1. **Viewport units as the sizing mechanism.** W3C **Technique F94** is titled "Failure of Success Criterion 1.4.4 due to incorrect use of viewport units to resize text". Viewport units are relative to the viewport, so they do not respond to zoom or to text-size adjustment.
2. **A maximum that clamps too early.** If the max stops the text before 200%, the user cannot reach 200% and 1.4.4 fails.

**The three rules that make it safe:**

```css
/* wrong: pure viewport unit, F94 */
font-size: clamp(1rem, 2.5vw, 2rem);

/* right: a rem term in the middle value so zoom still moves it */
font-size: clamp(1rem, 1rem + 1.5vw, 2.5rem);
```

- **Put a `rem` term in the middle value.** Zoom then still changes the computed size.
- **The maximum must be a relative unit and at least twice the minimum.** MDN states this directly.
- **Test it.** 200% zoom for 1.4.4, and 320 CSS px width or 400% zoom for **SC 1.4.10 Reflow**, which requires no two-dimensional scrolling.

Container query units (`cqi` and friends) have the identical problem and the identical fix.

---

## K-06 Inputs, and the iOS zoom trap

**HOUSE.**

If an `<input>`, `<textarea>` or `<select>` has a `font-size` of **15px or less, Safari on iOS zooms the viewport on focus**. At 16px or larger it does not. **It does not zoom back out afterwards.** The user is left zoomed in and horizontally scrolled for the rest of the form.

**The Tailwind trap:** `text-sm` is 0.875rem, 14px, and `text-xs` is 0.75rem, 12px. Both trigger it. **`<input class="text-sm">` is a defect.** Grep for it.

Fix with font size. Never with `maximum-scale=1`, see K-02.

---

## K-07 Responsive images

**HOUSE.**

`srcset` describes the **files**. `sizes` describes **how wide the image will be rendered in the page**. Writing `sizes` as if it described the file is the single most common mistake, and omitting it silently defaults to `100vw`, which ships a 1920px file into a 400px card.

Rules from MDN: `w` descriptors require `sizes`; `x` descriptors ignore it; never mix `w` and `x` in one `srcset`; the last entry in `sizes` has no media condition; `sizes="auto"` is only valid with `loading="lazy"`.

**What `next/image` does automatically:** srcset generation from `deviceSizes` and `imageSizes`, format negotiation from the `Accept` header, `loading="lazy"` by default, and aspect-ratio reservation from `width` and `height` so there is no layout shift.

**What it cannot do:** know your CSS layout width. From the Next.js docs, verbatim: "If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`). This can cause unnecessarily large images to be downloaded." And: "Without `sizes`: Next.js generates a limited `srcset` (e.g. 1x, 2x)... With `sizes`: Next.js generates a full `srcset` (e.g. 640w, 750w, etc.)."

**`sizes` is mandatory when the image uses `fill`, and when CSS makes the image responsive.** Without it the small 32 to 384px variants are never generated at all, because `imageSizes` only applies to images that provide a `sizes` prop.

Use `<picture>` only for **art direction and format fallback**. Plain resolution switching is `srcset` plus `sizes`, or `next/image`. Reaching for `<picture>` to do resolution switching produces markup `next/image` cannot optimise.

---

## K-08 Viewport units on mobile

**HOUSE.**

`100vh` is the **large** viewport, equivalent to `100lvh`. On mobile that means the height with the browser chrome hidden, so a `100vh` hero is cut off while the URL bar is showing.

- `100svh`, small viewport, is the safe "always fully visible" choice.
- `100dvh` tracks the current viewport and animates during URL bar transitions, which can cause layout thrash.
- `100lvh` is the old `100vh` behaviour, stated explicitly.

Support: Safari 15.4, Firefox 101, Chrome 108, roughly 94% globally.

---

## K-09 Modality is not width

**HOUSE.**

Do not infer touch from viewport width. A 1366px Windows touch laptop and a 1024px Android tablet both break width sniffing, and both are real in Indonesian offices.

```css
@media (pointer: coarse) { /* bigger targets */ }
@media (hover: none) { /* do not hide anything behind hover */ }
```

Baseline widely available since December 2018. Wrap every hover-only affordance in `@media (hover: hover)`, or it is unreachable on touch.

---

## K-10 Mobile first is convention, and we follow it anyway

**HOUSE.**

Be honest about the status of this rule. **No W3C, WCAG, MDN or web.dev document mandates `min-width` ordering.** Mobile first is a 2009 coinage that hardened into framework convention. Tailwind's own docs frame it comparatively, as "similar to what you might be used to in other frameworks like Bootstrap".

We follow it for two real reasons. It is mandatory in practice inside Tailwind, whose variants are min-width and source-ordered, so mixing `max-*` and `min-*` gets ugly fast. And it forces the content priority decision early, which is the actual design benefit.

Tailwind's own framing is the one to teach: "to style something for mobile, you need to use the unprefixed version of a utility, not the `sm:` prefixed version... Don't think of `sm:` as meaning 'on small screens', think of it as 'at the small breakpoint'."

---

## K-11 How to actually verify a responsive build

**HOUSE.** A screenshot at 390px is not verification.

1. **320 CSS px wide, no horizontal scroll.** This is **SC 1.4.10 Reflow** territory and it is where `min-width: 0` on flex children matters. Never fix overflow with `overflow-x: hidden`, that hides the symptom.
2. **400% zoom at 1280px wide**, which is the same 320px reflow requirement expressed the other way.
3. **200% text zoom**, for K-05.
4. **A wide, short viewport**, roughly 800 x 400, which is a landscape phone and breaks fixed headers and `100vh` modals.
5. **Real content, at the extremes.** The longest Indonesian product name you actually have, a single-word name, an empty state, and a number in the millions with thousands separators.
6. **Touch, not a mouse.** Hover-dependent controls do not exist on the device most of the traffic arrives on.

Automate what you can: Lighthouse mobile in CI with a score floor, plus a Playwright pass that loads each key route at 320, 390, 768 and 1280 and asserts `document.documentElement.scrollWidth <= window.innerWidth`. That one assertion catches most overflow regressions and costs nothing to run.

---

## K-12 Responsive advice that is obsolete, and should be deleted on sight

**Read this before copying a snippet from a blog post.**

| Still widely written | Reality |
|---|---|
| "44 x 44 is the WCAG minimum" | AAA. **AA is 24 x 24** with a spacing exception. See K-01 |
| "Apple requires a 44 x 44 minimum" | Current HIG: 44 x 44 pt is the **default**, **28 x 28 pt is the minimum** |
| `user-scalable=no` or `maximum-scale=1` to stop iOS input zoom | Fails **SC 1.4.4 via ACT b4f0c3**, and iOS has ignored it since iOS 10. Use 16px |
| `height: 100vh` for a full-screen mobile section | `vh` equals `lvh`, so it is cut off. Use `svh` or `dvh`. See K-08 |
| "`container-type` traps `position: fixed` children and makes a stacking context" | **CSSWG removed layout containment in July 2024.** Shipped in all three engines |
| "Container queries need a polyfill" | **Baseline widely available since February 2023** |
| "Install `@tailwindcss/container-queries` and edit `tailwind.config.js`" | Both obsolete in v4. In core, configured in CSS via `@theme` |
| Device-name breakpoint tables | Contradicted by Google's own guidance. No device exceeds roughly 13% share |
| FastClick, and the 300 ms tap delay | Removed in **Chrome 32, 2014** and **iOS 9.3, 2016** for any page with `width=device-width`. FastClick is archived and now causes ghost clicks. Delete it |
| `max-width: 767.98px` and the `-1px` gap hack | Bootstrap-era. Use range syntax, `@media (40rem <= width < 64rem)`, roughly 94% support. Tailwind v4 already emits `width >= 40rem` |
| "px breakpoints are fine, zoom handles it" | Zoom moves them, the **browser default font-size setting does not**. Use `rem` or `em` |
| "Detect mobile by viewport width" | Width is not input modality. Use `pointer: coarse` and `hover: none`. See K-09 |
| "`<picture>` for responsive images" | `<picture>` is for art direction and format fallback. Resolution switching is `srcset` plus `sizes`. See K-07 |
| Tailwind v3 px breakpoint values pasted into v4 | v4 defaults are **rem**. Same names, different behaviour |
