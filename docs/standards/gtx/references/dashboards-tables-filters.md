# GTX-ENG-001 / L. Dashboards, tables, and filters

Tier: **GUIDE**, with accessibility items that become **GATE** where accessibility is contracted.

This section exists because most of the Gatxel register is data surfaces: Dashboard CS Omnichannel, KPI per Divisi, Analitik SIPAS, logs.pandumedia.com, the HR web app, SIPOS, and the accounting work. These are the hardest screens to get right and the ones AI generates worst, because a generated dashboard shows every field it can find and calls it done.

**Read the warning in L-09 before quoting any dashboard statistic to a client.** Five of the numbers circulating in dashboard articles do not survive checking, and one widely repeated layout rule is the exact opposite of what its source concluded.

---

## L-01 Decide what the dashboard is before designing it

Five different things get called "dashboard" and they have different rules. Settle which one you are building, in writing, before the first screen.

| Type | Purpose | Data | Example in our register |
|---|---|---|---|
| **Reporting** | Tell a story with data, usually exported or shared | Historical, periodic | Client monthly report, KPI per Divisi |
| **Monitoring** | Alert and warn. Living and ticking | Real time | logs.pandumedia.com, uptime |
| **Exploring** | Let the user find things we did not anticipate | Deep, filterable | Analitik SIPAS, Data Nomor |
| **Functional** | Show where to focus. A calmer monitoring dashboard | Current state | At-risk tickets, low stock |
| **Product home** | Contextual index plus navigation | Summary totals and deltas | The landing screen of most SaaS |

**The most common failure is building a product home page and calling it analytics**, or building an exploration tool when the user wanted an alert.

---

## L-02 Before any design, answer these

**GUIDE, but skipping it is why dashboards get rebuilt twice.**

**Data first.** Sit with whoever owns the database.

- Is the data tracked over time, and how much history exists?
- Is the metadata consistent across customers, or does every client have a different shape?
- Can we compute the if-then statements that would turn a number into an insight?

**Then decisions.** For every metric, ask the stakeholder: **"what will you do differently based on this number?"** If they cannot answer, it does not go on the dashboard. Write it down as a decision map: metric, the decision it supports, who needs it. It takes an hour and prevents months of scope creep.

This is what separates a decision metric from a vanity metric. Total pageviews and registered users feel informative. Conversion rate, churn, and time to resolution cause action.

**Then roles.** An executive checking once a day, a support agent working a queue, and an analyst digging need different depth from the same data. Designing for the most data-literate person in the room and assuming everyone else adapts is how a dashboard gets abandoned. Define two to four personas with their own tasks and acceptable complexity, then build role-aware views.

**Then find where the time goes.** What are users compiling by hand today, and how often? Ask to see their spreadsheets. Daily work earns a place on the dashboard. Quarterly work usually does not.

---

## L-03 The anatomy, moment by moment

A dashboard is a sequence of moments, in this order.

**Getting oriented.** A clear page title and a one-line description of what this page is for. Charts grouped conceptually so the user can tell what belongs together. Overview charts first, detail deeper. **Defaults that do not show everything just because the data exists.**

**Jargon.** One of the most common failures is data shown and never explained. Acronyms without a tooltip, metrics without a definition. Google's own GA4 shipped DAU/MAU with no definition anywhere on screen. Every non-obvious label gets a tooltip.

**Filtering and parsing.** See L-06.

**Drilling in.** Three patterns, in order of increasing cost and disruption:

| Pattern | When |
|---|---|
| **Tooltip or hover** | A peek at more detail without losing the view |
| **Drawer or side panel** | Substantial detail without leaving context. The most scalable option |
| **Details page** | A whole view, when the detail is itself complex |

A **modal** is the most disruptive and should be reserved for something the user must resolve. If a modal needs a scrollbar and three columns, it deserves a page.

**Executing actions.** Prioritise visually so the most important action is the most noticeable. Multi-select needs an obvious affordance and a clear count of what is selected. Multiple actions belong in a dropdown, not a row of equally weighted buttons.

**Always allow CSV export.** If our design does not answer a question the user has, they must be able to take the data and answer it themselves. That is basic data etiquette, and it also relieves the pressure to cram every possible view into the interface.

---

## L-04 Layout

**GUIDE.**

**Do not "design for the F-pattern".** This is the correction that matters most in this section. See L-09.

What actually holds:

- Put the most important content high and left for left-to-right languages, because that is where scanning starts.
- **Inverted pyramid:** summary metrics in the top band, trends in the middle, granular tables at the bottom.
- **Attention drops across a repeated series.** In a row of five KPI cards, the last two barely register. If you have five equally important metrics, that layout is telling the user they are not equally important. Fix the information architecture, not the card count.
- **Group related metrics** so patterns surface without effort. Revenue with revenue, engagement with engagement.
- A **12 or 16 column grid on an 8px base** so components align and responsive behaviour stays manageable.
- **Consistent card anatomy.** Title always top left, legend always in the same place, date picker always in the same slot. Consistency is what lets the eye stop hunting.

**Every KPI needs context or it is meaningless.** "Revenue: Rp 142.000.000" tells you nothing on its own. Each metric card carries at least one of:

1. A temporal comparison, week over week or month over month
2. A benchmark or target
3. A trend indicator, sparkline or direction

But stop there. More than that belongs in a drill-down, not on the card.

---

## L-05 Data tables

**GUIDE for layout, GATE for the accessibility items in L-07.**

### Alignment

Confirmed in Material Design:

- **Left-align text columns.** Column headers align with their content.
- **Right-align numeric columns**, so decimals line up and the eye can compare magnitudes.
- **Never centre-align** either. It makes the eye jump and destroys scanning.
- **Qualitative numbers may be left-aligned**: dates, postal codes, phone numbers. Quantitative numbers always right: money, quantities, measures, percentages.
- **Use tabular figures for numerals**: `font-variant-numeric: tabular-nums`. Without it, `$1,111.11` looks visually narrower than `$999.99` because the digits have different widths. This is a genuine CSS feature with good support. *Cite it to MDN, not to a design system. Neither Material nor Carbon document it.*
- **Do not repeat the column name in every cell.** If the column is "Lead type", the cells say "Qualified" and "Nurturing", not "Qualified Lead".

### Row height

**Use Carbon's real scale, not the 40 / 48 / 56 triple circulating online**, which matches no published design system and appears to be a misreading of Material's 56dp column padding.

Carbon specifies **24, 32, 40, 48, 64 px** (extra small through extra large). Material specifies a **48dp data row**. Pick three from Carbon's scale as our condensed, default, and relaxed options.

### Rows and separators

- **Line divisions** are the safe default. Keep the border light enough to disappear.
- **Zebra stripes are now a liability.** With hover, focus, selected, and disabled states you end up with five overlapping shades of grey and no visual continuity. Only use them on read-only tables with no row interaction.
- **Vertical column separators are optional** and usually add noise. If used, 1px maximum, light grey.
- Vertical alignment: **centre when rows vary by up to three lines, top-align beyond that**, so nothing is clipped.

### Controls

- **Sticky header** so column context survives scrolling. Sticky first column when there is horizontal scroll, and often the last column if it holds totals.
- **Column management:** show and hide, reorder, resize, freeze. Resizing matters less if the default spacing is right, but it is expected on editable tables.
- **Display density switcher** outside the table.
- **Preserve state** across the session or the user account, and **always provide reset to default.** Users only explore a customisable interface if they trust they can get back.
- **Too many columns is usually an information architecture problem**, not a layout problem. Before adding column management, ask which columns actually matter on load.

### Actions

Table interfaces are dense, so reveal actions rather than displaying them all.

- **Hover reveals**: a whole row that looks clickable hints at a detail view. A checkbox appearing on hover hints that rows are actionable. A text cursor on a cell hints that it is editable.
- **Bulk actions appear only once something is selected**, ideally in a bar fixed to the bottom of the viewport so context is preserved.
- **Inline cell editing** is the lowest friction. Add friction deliberately for high-stakes data by requiring an expand or a side panel first.
- **Confirmation on edit** matters. Clicking out, Enter, or an explicit save, with visible success feedback. See E-12.

---

## L-06 Filters, sorting, and search are three different things

**GUIDE.** Most implementations blur them, and users then cannot predict what any control will do.

| Control | What it does | Primary use |
|---|---|---|
| **Search** | Finds a specific known item | "Where is invoice 4471" |
| **Sort** | Reorders everything, nothing disappears | "Which is largest" |
| **Filter** | Narrows the set, things disappear | "Only unpaid, this month" |

### Search

Global search at the top for text matching across the set, plus per-column search where the data warrants. **Highlight the matching substring in the results**, so the user immediately sees why a row appeared. Always design the zero-results state with a one-click reset.

### Sort

Clickable column headers toggling ascending and descending, with a visible directional indicator. **Set a sensible default**: most recently modified, or most urgent. The sort indicator must not disturb the header alignment.

### Filters: the anatomy

A filter condition is **identifier plus relative plus value**. The property, the relationship, and the target. "Amount" plus "greater than" plus "1.000.000".

**The relative is usually our job, not the user's.** Presets like "this week", "month to date", "last 30 days" are the highest-value time saver in any filter UI. Expose the raw relative only for genuinely technical users.

**Positioning:**

| Position | Context | Scalability |
|---|---|---|
| **Left sidebar** | Low, affects the whole page | High. Nest many values in expandable sections |
| **Horizontal filter bar** | Hybrid, can scope to a section | Medium, limited by page width |
| **Inline, per component** | High, scoped to one chart or table | Low, runs out of space fast |

A sidebar implies every element on the page is affected. If that is not true, it will confuse people. On a dashboard with different data shapes per chart, filters belong inline or on a per-section bar.

**When to fetch:**

- **Live**, on every selection, for small sets and low-stakes filters
- **Per filter**, applying when a dropdown closes, for multi-select
- **Batch**, with a global Apply button, for heavy datasets or slow backends

Pick based on what the backend can actually do, and tell the user which mode they are in by whether an Apply button exists.

### Displaying applied filters: embrace redundancy

This is the part almost everyone gets wrong. Once applied, filters hide inside their dropdowns and the user forgets they set them, then concludes the data is wrong.

Show applied state **three times**:

1. **Preserved inside the control** itself
2. **A marker on the control**, bold label plus a count like "Status (3)"
3. **A dedicated applied-filters summary** as removable chips near the results

Plus:

- **Show the result count.** It is the feedback that tells the user their filter did something.
- **Clear all**, at both the individual filter and the global level. It also serves as a reminder that filters are active.
- **Show counts at the input level** where you can, so users avoid selecting a combination that yields zero.
- **Saved filter queries** for anything users repeat. If someone runs the same four filters every Monday, that is our failure to notice.
- Plan the **wrapping behaviour** for chips. Two or three lines maximum, then show more.
- **Autofocus the search field** when a filter dropdown opens.

---

## L-07 Accessibility for tables and charts

**GATE where accessibility is contracted. These are the ones generated code fails.**

### Tables

- `<th>` for headers with **`scope="col"` or `scope="row"`** whenever direction is ambiguous. `id` and `headers` for multi-level headers.
- A **`<caption>`** identifying the table.
- **Never a layout table.** W3C is explicit.
- **Sortable headers:** a real `<button>` inside the `<th>`, and `aria-sort="ascending|descending"` on **only the currently sorted header**.
- **A scrollable table region must be keyboard reachable.** Wrap it in a container with `tabindex="0"`, `role="region"`, and `aria-labelledby` pointing at the caption. Without this, a keyboard-only user cannot scroll the table at all, which fails SC 2.1.1. **This is one of the most common automated audit failures and generated code never does it.**

### Virtualised tables

Virtualisation breaks accessibility in a specific way: only rendered rows exist in the DOM, so the row count and positions reported to assistive technology are wrong, and focus is destroyed when a focused row is recycled out.

- **`aria-rowcount`** on the table with the **total**, not the rendered count. Use `-1` if unknown.
- **`aria-rowindex`** on each rendered row with its **absolute** 1-based index.
- Same pattern with `aria-colcount` and `aria-colindex` if columns virtualise.
- **Never virtualise the header.**
- Restore focus by a stable row key, not a DOM node reference.

### Sticky headers

A sticky header that completely hides the focused element **fails SC 2.4.11 Focus Not Obscured**, which is Level AA in WCAG 2.2. Tabbing through in-row controls under a sticky table header is the classic trigger.

Fix with `scroll-margin-top` on focusable descendants equal to the sticky header height, or `scroll-padding-top` on the scroll container. Also note `<caption>` will not stick, and a sticky region that is tall relative to the viewport becomes unusable.

### Charts

- **Never rely on colour alone.** SC 1.4.1. Add direct labels, marker shapes, line styles, or fill patterns. The red and green status system is the classic failure, and roughly 8% of men have some form of colour vision deficiency.
- **3:1 minimum contrast** for meaningful graphical objects, SC 1.4.11.
- **Provide a text alternative.** The W3C pattern for complex images is a short `alt` naming the chart plus a long description. For data visualisation the best long description **is a real `<table>` of the underlying data**, exposed to everyone through a "view as table" toggle rather than hidden off-screen. W3C recommends making long descriptions available to all users, and it is genuinely useful to sighted users too.
- **Colourblind-safe categorical palettes**, in order of defensibility: **Okabe-Ito** (8 colours, the de facto scientific standard), Tableau's colorblind-safe set, then IBM Carbon. **Viridis is perceptually uniform but sequential, so do not use it for categories.** Carbon's 14-colour categorical palette optimises for neighbour contrast and harmony and **does not claim colourblind safety across the full set**, so cap categorical series at five to eight.
- For a full testable framework, use **[Chartability](https://chartability.fizz.studio/)**, which is peer reviewed at EuroVis 2022 and turns accessibility into concrete heuristics.

---

## L-08 Dashboard performance

**GUIDE.**

**There is no credible published threshold for how many charts is too many.** Tableau's own performance checklist deliberately gives no number and says performance tuning is highly individualised. Treat any specific figure you see as invented.

Real techniques, in order of impact:

1. **Server-side aggregation.** Never ship row-level data to the client to render an aggregate. This is also a security rule, see I-06.
2. **Materialised aggregates or extracts** rather than live queries against the transactional database.
3. **Windowing or virtualisation** for long tables, with the accessibility caveats in L-07.
4. **Progressive drill-down** instead of rendering everything up front.
5. **Downsampling for dense time series.** The standard algorithm is **LTTB, Largest-Triangle-Three-Buckets**, which preserves peaks and visual shape far better than every-Nth sampling or averaging. Set the bucket count to the chart's pixel width. More data points than horizontal pixels is wasted work by definition.

Also: users cannot test a dashboard against fake data. Figma prototypes with invented numbers do not surface the problems, because the participant cannot recognise whether the data is wrong. Pair with a developer and use real or realistically shaped data if at all possible.

---

## L-09 Dashboard claims that do not survive checking

**Read this before quoting a number in a client deck.** We checked the statistics circulating in dashboard design articles. Most of them fail.

| Claim | Verdict |
|---|---|
| "Information overload affects **46.7% of users**, per a systematic review of 75 studies" | **Wrong twice.** Research Square is a **preprint server**, and the paper carries a not-peer-reviewed banner. And 46.7% is **35 of 75 papers** that mentioned overload, not a share of users |
| "Dashboards improve decision speed by **58.7%** and productivity by **40%**" | **Category error.** Same preprint. Those are the share of papers that *measured* those outcomes, not effect sizes. Nothing supports "improves speed by 58.7%" |
| "Organisations with BI tools saw a **24% revenue increase**, per Dresner" | **Uncited vendor claim.** Dresner's reports are commercial research licensed by BI vendors, and their actual finding is that revenue growth is a top **stated objective** of BI projects, not a measured outcome |
| "Stripe's dashboard redesign drove **$10 million** in new partnerships" | **Distorted.** The source says accessibility **compliance** helped close that business, in the author's own portfolio, uncontrolled. Not a redesign result |
| "A cross-industry study found user-centric dashboards drive adoption" | **Predatory venue.** Published in a journal whose publisher sells publication for $200 standard or $300 fast track. It is also six case studies, not a cross-industry study |
| **"Design for the F-pattern"** | **Backwards.** NN/g's 2017 update is titled around the finding that **"The F-shape is bad for users and businesses"**, and describes it as the default pattern that appears *when there are no strong cues*. It is a symptom of weak formatting to design **against**, using headings, front-loaded keywords, and bolding. The 232-user figure from the 2006 study is real |
| "Row density is 40 / 48 / 56 px" | **Matches no design system.** Carbon is 24 / 32 / 40 / 48 / 64. Material is a 48dp row. The 56 appears to be a misread of Material's 56dp column **padding** |
| "Working memory holds 3 to 5 items, per Sweller" | **Misattributed.** Cognitive load theory does not specify a count. The number is **Cowan 2001, about four**, superseding Miller's 7 plus or minus 2 |
| "86% preferred progress bars **even if inaccurate**" | **Number right, rider wrong.** Myers, CHI 1985: **86.1% of 48 subjects** preferred progress indicators, p = 0.0006. The accuracy question was tested separately and was **not statistically significant** |
| Tableau eye-tracking findings | **Usable, but label it vendor research.** Run at their own conference on 10 dashboards, with **no participant count and no statistics published**. Stephen Few published a rebuttal |

**Confirmed and safe to cite:** Kahneman and Beatty 1966 on pupil dilation as a cognitive load indicator. Sweller 1988 for cognitive load theory itself. Material Design for table alignment. Myers 1985 for the progress bar preference, stated correctly.
