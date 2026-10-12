# Recurring interaction patterns

**Tier: GATE for the accessibility items, HOUSE for the rest.**

These patterns appear on every project. Specified once here, so nobody redesigns them per project and nobody gets them wrong.

---

## U-01 Selection: select all, select none, indeterminate

**GATE for the markup, HOUSE for the scope model.**

### The markup, and the rule everyone breaks

**The ARIA APG has no "select all in a table" pattern.** The nearest artefact is the mixed-state checkbox example, which is a **custom `div role="checkbox"`**, not a native input. The two implementations have opposite rules, and mixing them is a spec violation.

**ARIA in HTML, normative:** "Authors **MUST NOT** use the `aria-checked` attribute on `input type=checkbox` elements."

**Use a native input. The mixed state is a DOM property, and there is no HTML attribute for it.**

```tsx
<input
  type="checkbox"
  ref={el => { if (el) el.indeterminate = state === 'some' }}
  checked={state === 'all'}
  onChange={onToggleAll}
  aria-label={`Pilih semua ${rows.length} baris di halaman ini`}
/>
```

MDN: "This is **purely a visual change**. It has no impact on whether the checkbox's value is used in a form submission. That is decided by the `checked` state, regardless of the `indeterminate` state." So **never rely on `indeterminate` for logic.** Keep the real state in your own store.

### Scope, which is where every implementation actually fails

**"Select all" is ambiguous the moment a list is paginated or filtered.** Adopt HashiCorp Helios's three scopes as the mental model, because it is the cleanest:

| Scope | Means | Control |
|---|---|---|
| **Row** | One item | The row checkbox |
| **Page** | Every row on the current page | The header checkbox |
| **Global** | Every row matching the current filter, across all pages | **A separate, explicit action. Never the header checkbox** |

**PatternFly is the only system that solves it properly**, by replacing the ambiguous header checkbox with a split checkbox plus a menu: **Select none**, **Select page**, **Select all**. Its count label "reflects the total number of items selected... across all pages." Use that when a table is genuinely large.

### The escalation banner, specified

This is the Gmail pattern, and Shopify Polaris gives a precise spec. Five rules:

1. **Gate it.** Only show the escalation when there are more pages. No more pages means page selection already is total selection, so no banner.
2. **Sentinel, never a list.** Whole-set selection is a distinct value, not an array of every ID: `selectedItems: string[] | 'ALL'`. Downstream it becomes **a predicate, the filter query**, not an ID list. This is the only way it works at 100,000 rows.
3. **Filtered and unfiltered are different strings.** Never say "Pilih semua 50 pesanan" when a filter is active.
4. **Escalation is one click, and reversal is one click.** After escalating, the same affordance becomes **Undo**.
5. **Two lines: state, then action.**

```
[header checkbox] -> all rows on page selected
  banner: "50 pesanan di halaman ini terpilih."
          [Pilih semua 1.204 pesanan yang sesuai filter]
  escalate -> selection = 'ALL'
  banner: "Semua 1.204 pesanan yang sesuai filter terpilih." [Batalkan]
```

**On submit, send the filter predicate and an expected count, and have the server reject on drift. Never POST 1,204 IDs.**

### The bulk action bar

- **Appears only once something is selected.** Carbon: "Once an item from the table is selected, the batch action bar appears at the top of the table."
- **Position:** top of the table. A fixed bottom bar is a reasonable mobile variant but no design system documents it, so treat it as our convention.
- **Contents:** the count, two or three promoted actions inline, the rest in an overflow menu, and an explicit exit.
- **Exit:** a cancel control, deselecting everything, **and `Escape`**.
- **Carbon, and this one prevents a real class of accident:** "When batch mode is active, single action icons and overflow menus on the row should be disabled." Otherwise the user cannot tell whether they just deleted one row or fifty.
- **Destructive bulk actions get a transactional danger modal** that names the count and the consequence. See U-04 on habituation.

**Announce selection changes** through a polite live region: "12 dari 50 terpilih." Not on every keystroke of a shift-click range, only on settle.

---

## U-02 Reducing typing, with the actual numbers

**HOUSE.** The observation that people will not type or describe things is correct, and there is evidence for what to do about it.

### Radios, dropdowns, comboboxes

The design systems disagree, and NN/g reports the disagreement: USWDS says radios below 7, Material 3 says 6, Carbon says 3. NN/g's own position: "For fewer than 5 options, radio buttons are usually better", optimal dropdown range is "roughly 5 to 10", and above "roughly 15 options... the interaction cost of visually scanning it and the fine-motor control required to scroll through it can be overwhelming."

**The reasoning matters more than the number. A dropdown costs three interactions where a radio costs one:** open, scroll, select. And scrolling is error prone, "on both desktop (where scroll speed can overshoot) and mobile (where fat-finger problems and accidental dismissals are common)."

| Options | Control |
|---|---|
| 2 | Radios, or one checkbox if genuinely binary |
| **3 to 4** | **Radios** |
| 5 to 10 | `<select>`, or radios if vertical space allows. Radios still win on scannability |
| 11 to 15 | `<select>` |
| **Over 15** | **Combobox with type-ahead.** Never a bare `<select>` |

**Radios must have a default.** NN/g: "By definition, radio buttons always have exactly one option selected." If there is genuinely no safe default, add an explicit "Belum tahu" or "Tidak berlaku" option rather than shipping an unselected group.

### Forced choice beats check-all, and by a lot

**This is the strongest evidence in this file.** Smyth et al., *Public Opinion Quarterly* 2006, replicated by **Pew Research Center in 2019**. Presenting each option as an explicit yes or no rather than a check-all list raised endorsement:

| Item | Forced choice | Check-all | Difference |
|---|---|---|---|
| Health insurance denial | 19% | 13% | 6 points |
| Job loss or struggle | 63% | 51% | 12 points |
| Overcharged by a mechanic | 52% | 36% | **16 points** |
| **Average across 12 items** | | | **8 points** |

Pew's conclusion: they "adopted a policy of using a **forced-choice format instead of a select-all-that-apply** list in its online surveys whenever possible."

**Check-all lists get satisficed.** People stop at the first few plausible boxes. **So: if the data matters (bug symptoms, affected areas, consent scopes) use explicit yes or no per item. If it does not matter, check-all is fine and cheaper.** The cost is real: forced choice needs more scrolling or more screens.

**"Other, please specify":** always last, and the text field appears only when that option is chosen. Never a permanently visible free-text box next to a radio group.

---

## U-03 The issue reporter

**HOUSE.** One reusable component, on every project.

**Be honest about the evidence.** There is **no published data** showing GitHub Issue Forms improved report quality. GitHub's own announcement makes no measured claim, and the one academic paper on issue templates is a **dataset** paper that lists "how does an issue template affect resolution time" as an **open research question**. Its most interesting finding is about adoption: roughly **5%** of repositories with more than 10 stars use templates at all, ten years on. **Structured forms are justified by the survey evidence in U-02, not by anything GitHub proved.** Do not let anyone say otherwise in a design review.

### Four asks, maximum

| Field | Control | Required | Why |
|---|---|---|---|
| Masalahnya apa? | **Radios**, 4 to 6 options plus "Lainnya" | Yes | U-02: 4 to 6 means radios, not a dropdown |
| Di bagian mana? | **Region picker**, prefilled | Prefilled | Never make them describe a location |
| Apa yang terjadi? | Textarea, 2 lines | **No** | Required free text is a filter that loses reports |
| Boleh kami hubungi? | Email, prefilled if known | No | Say what you will use it for |

**Expected-versus-actual, reproduction steps and severity are engineer-shaped fields. Asking a user for them is asking the user to do triage.**

### Capture the rest, and mind what you capture

| Signal | Capture | Note |
|---|---|---|
| `location.pathname` and allowlisted query params | **Yes** | **Strip the query string by default.** Never capture the fragment: SPAs put access tokens there |
| Route **pattern**, not the resolved path | **Yes** | `/pelanggan/:id`, never `/pelanggan/1234`. Path segments are PII |
| Viewport, device pixel ratio | Yes | Negligible risk, high value |
| User agent | Yes | Already sent on every request |
| **App version or build SHA** | **Yes** | Yours, not theirs. **The single most useful field** |
| Correlation ID | Yes | Your own identifier |
| Authenticated user ID | Yes if logged in | **Internal ID only.** Never email or name in the payload |
| Recent console errors | **Conditional** | Apps log PII to console. Capture only **structured errors you emitted**. Never raw `console.log` |
| `localStorage`, `sessionStorage` | **Never** | Tokens live there |
| Cookies | **Never** | A session hijack vector in your own logs |
| Form field values | **Never** | Passwords, cards, NIK |

Screenshot capture is possible but is a consent event, not a default. Ask, show a preview, and let the user redact before sending. **Under B-6 none of this may reach a foreign error tracker unscrubbed.**

### Letting the user say where without describing it

Give every major region of the app a stable `data-region` attribute, and let the reporter pick from the regions actually present on the current route. The user selects "Tabel transaksi", not types "the table thing on the payments page".

---

## U-04 Errors: what happened, what caused it, what to do

**GATE for the WCAG parts.**

**WCAG, exactly:**

| SC | Level | Requirement |
|---|---|---|
| **3.3.1 Error Identification** | **A** | If an input error is detected automatically, the item in error **is identified and described to the user in text** |
| **3.3.3 Error Suggestion** | **AA** | If an error is detected and a correction is known, **suggest it**, unless that would jeopardise security or purpose |
| 3.3.4 Error Prevention | AA | For legal, financial or data-modifying submissions: reversible, checked, **or confirmed** |

**Text, not colour. Description, not just identification.** A red border alone fails 3.3.1.

### The Gatxel error shape

Three parts, in this order, and never more than three:

1. **What happened**, in the user's terms. Not the system's.
2. **What to do next**, as an action they can actually take.
3. **A reference**, if there is nothing they can do.

```
Buruk:  "Terjadi kesalahan." / "Error 500" / "Oops! Something went wrong."

Baik:   "Pembayaran belum bisa diproses.
         Coba metode lain, atau ulangi dalam beberapa menit.
         Kode: 01J9X4"

Baik:   "Nomor HP harus diawali 08 atau +62."

Baik:   "File terlalu besar. Maksimal 4 MB, file ini 7,2 MB.
         Kompres dulu, atau kirim per bagian."
```

Notice the third one gives **the limit and the actual value**. That is 3.3.3 satisfied properly: the correction is known, so state it.

**Do not blame the user, and do not apologise theatrically.** "Kami sedang bermasalah di sisi kami" for a server error. "Nomor HP harus diawali 08" for a user error. State which it is, because that tells them whether to retry or to fix something.

**The correlation ID.** Every server error the user sees carries a short reference that also appears in the log. Make it **selectable, copyable, and short enough to read over the phone**. See S-12 and S-13.

**Placement is inline, adjacent to the cause.** See E-03. A toast is for low-urgency system events only, and a toast is never the only copy of a critical error.

**Confirmation dialogs habituate.** NN/g: use them "before committing to actions with serious consequences", and be specific about the consequence. A confirmation on every action trains people to click through them, which means the one that mattered gets clicked through too.

---

## U-05 Empty states and placeholders, which are different things

**GATE for the placeholder rule.**

### The `placeholder` attribute

**Placeholder text as a label is an accessibility failure, and it is the single most common form defect in generated code.** The problems are documented and they compound: it disappears on focus so the user loses the label, it fails contrast in most implementations, it is not reliably announced, and it makes a filled field indistinguishable from an empty one for anyone reviewing their answers.

**Rule:** a visible `<label>` always. `placeholder` only for a **format example**, never for the label, and the format hint is better in `aria-describedby` where it persists:

```html
<label for="hp">Nomor HP</label>
<input id="hp" type="tel" inputmode="tel" autocomplete="tel-national"
       aria-describedby="hp-hint">
<p id="hp-hint">Contoh: 0812 3456 7890</p>
```

### Empty states

**Be honest: there is no research showing a good empty state improves activation. That is a vendor claim.** Design them well anyway, because they are the state a new user sees first and they are cheap.

**Four distinct types, and they need different copy. Conflating them is the usual mistake:**

| Type | Says | Offers |
|---|---|---|
| **First use** | What this screen is for, and what will appear here | **One** action that creates the first item |
| **No results after filtering** | Which filters produced zero. **Never "no data"** | Clear all, or relax the narrowest filter |
| **Cleared by the user** | Confirms the state is intentional | Undo, if recent |
| **Error, not empty** | This is **not** an empty state. It is U-04 | Retry |

```
Buruk:  "Tidak ada data."

Baik (pertama kali):
        "Belum ada transaksi.
         Transaksi pertama akan muncul di sini setelah pelanggan bayar."

Baik (hasil filter kosong):
        "Tidak ada transaksi antara 1 sampai 15 Agustus dengan status Gagal.
         [Hapus filter status] [Hapus semua filter]"
```

**The filtered-empty state must name the filters.** Otherwise the user concludes the system is broken, which is exactly the report that reaches support.

---

## U-06 Keeping forms clean without breaking WCAG

**GATE.** Every public form is a spam target, and the obvious defence is banned.

**WCAG 3.3.8 at AA bans transcription CAPTCHA**, and audio alternatives that require transcription do not satisfy the exception. See Q-03. So the ladder is:

**Layer 1, always, and invisible: a honeypot.** A field a human never sees and a bot fills.

```html
<div aria-hidden="true" style="position:absolute; left:-9999px; top:0; overflow:hidden;">
  <label for="perusahaan_alt" tabindex="-1">Jangan isi kolom ini</label>
  <input id="perusahaan_alt" name="perusahaan_alt" type="text"
         tabindex="-1" autocomplete="off">
</div>
```

**`display: none` is wrong.** Some screen readers and some autofill implementations still reach it, and a legitimate user who fills it gets silently rejected. Position it off screen, set `aria-hidden`, set `tabindex="-1"`, disable autocomplete, and **give it a plausible name a bot will want to fill**, never `honeypot`.

**Layer 2: a time check.** A form submitted under about 2 seconds after render was not filled by a person. Sign the render timestamp so it cannot be forged.

**Layer 3: rate limiting**, per IP **and** per target, in Postgres. See S-07.

**Layer 4, only on risk signal: a managed challenge**, such as Cloudflare Turnstile. Never on the first attempt. Never as a permanent fixture on a contact form.

**Never fail silently.** A rejected human must be told, and must be given a way through. That is also 3.3.1.

**On email:** block disposable domains on abuse-prone flows only, and **never block privacy relays** (Apple Hide My Email, Firefox Relay, SimpleLogin) **or subaddressing** (`user+tag@`). See the signup hygiene rules.

---

## U-07 Interaction claims that fail checking

| Claim | Verdict |
|---|---|
| "7 plus or minus 2 items in a navigation menu" | **NN/g rejects it explicitly:** "it's not 7, despite a common myth." Miller 1956 was about recall of **unseen** items. A visible, persistent, scannable menu does not load short-term memory |
| "GitHub proved structured issue forms work" | **No published data exists.** The academic paper on templates lists effectiveness as an **open question**, and finds only about 5% adoption |
| "A good empty state improves activation by X%" | Vendor claim. No independent evidence found |
| "Use `aria-checked="mixed"` on the select-all checkbox" | **Spec violation** on a native input. ARIA in HTML: authors **MUST NOT** use `aria-checked` on `input type=checkbox`. Use the `indeterminate` DOM property |
| "`indeterminate` affects what gets submitted" | It does not. **Purely visual.** Submission follows `checked` |
| "Select all means select everything" | Only if there is one page. Paginated or filtered, the header checkbox means **this page**, and global selection needs an explicit second action |
| "Hide navigation behind a hamburger to keep it clean" | Measured cost: on desktop, navigation use falls from about 48% to 27%, tasks run at least 39% slower, discoverability drops over 20%. **Four or fewer top-level links: show them** |
| "Confirm every destructive action" | Habituation. Confirm the serious ones and name the consequence; confirming everything trains people to click through the one that mattered |
| "Placeholder text is fine as a label" | Disappears on focus, usually fails contrast, unreliably announced, and makes a filled field indistinguishable from an empty one |
| "Check-all-that-apply is the natural control for multi-select" | It gets satisficed. **Forced choice raised endorsement by 8 points on average, and 16 on one item.** Use it when the data matters |
