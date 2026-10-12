# Claims, statistics and sources

**Tier: HOUSE.** Applies to every proposal, deck, article, and rule in this standard.

Gatxel is a small studio competing on being right. The fastest way to lose that is to put a number in a client deck that the client's own team can disprove in one search. This file is the register of what we checked and what it turned out to be.

---

## M-01 The rule

**Every number we publish carries its provenance, and provenance has a hierarchy.**

| Tier | What it is | How to cite it |
|---|---|---|
| 1 | Peer reviewed research, or a standards body: W3C, WCAG, NIST, OWASP cheat sheets, RFCs | Cite freely. Name the paper or the SC number |
| 2 | Primary measurement with published methodology: WebAIM Million, HTTP Archive and Web Almanac, BLS, Statcounter, Netcraft, Baymard | Cite with the year and the exact denominator |
| 3 | Vendor research with stated methodology: Veracode, Escape.tech, Contentsquare, Level Access | Cite **with the vendor named in the sentence**. "Veracode's 2026 report found" is fine. "Research shows" is not |
| 4 | Preprints and university trackers | Cite with "preprint" or "tracker" said out loud, plus any selection caveat |
| 5 | Vendor surveys of their own customers, content-marketing aggregators, statistics roundup blogs | **Do not cite.** Not softened, not hedged. Do not cite |

**Four practical rules that follow from that table:**

1. **Never cite an article that cites another article.** Follow it to the source. Roughly a third of the numbers we traced did not survive that step.
2. **State the denominator.** "68% of developers" and "68% of a design tool's own customers who chose to answer a survey" are different sentences.
3. **Re-date everything.** An article dated "for 2026" routinely cites data from early 2025, and the trend has sometimes reversed since.
4. **If it does not survive, it does not appear.** Not in a footnote, not with "reportedly". Delete it.

---

## M-02 Numbers we verified and will use

Safe to put in a deck, cited as written here.

| Number | Source and caveat |
|---|---|
| **95.9%** of the top million home pages have detectable WCAG 2 failures; **83.9%** have low contrast text; average **56.1** errors per page | WebAIM Million, February **2026**. Carry WebAIM's own caveat: these are only **automatically detectable** errors, so it is a floor. **The widely quoted 94.8% and 79.1% are the 2025 figures and are stale.** The trend also reversed: errors per page fell in 2025 and rose again in 2026 |
| **33.1%** of home pages have missing form input labels | WebAIM Million 2026 |
| **48%** of mobile sites achieved a Good Core Web Vitals score in 2025 | HTTP Archive Web Almanac 2025, July 2025 CrUX data. Desktop 56% |
| Median mobile page: **2,164 KB** total, **646 KB** of JavaScript | Web Almanac 2025. **Not** the 2,362 KB and 632 KB in circulation |
| Median requests: **77 desktop, 72 mobile**. Desktop scripts **23**, images **17** | Web Almanac 2025. The directional claim that JavaScript has overtaken images holds |
| **41.3%** of mobile sites used at least one variable font in 2025 | Web Almanac 2025 Fonts. Keep "at least one" |
| Cart abandonment **70.22%** | Baymard. **Framing matters**: it is an average across roughly 50 studies spanning 2006 to 2025, not a current measurement. Never present it as a trend |
| US checkout flows average **23.48 form elements**; an ideal flow is **12 to 14** | Baymard. This is the best hard ceiling we have for checkout design |
| A large ecommerce site can gain **35.26%** conversion by redesigning checkout | Baymard. The source says "by redesigning its checkout process", not "solely through" |
| AI-generated code passes security testing **56%** of the time; XSS **15%**, log injection **13%**, SQLi **82%**, insecure crypto **86%** | Veracode 2026 and Spring 2026. Vendor, methodology stated. See S-16 |
| Developers using an AI assistant wrote **less secure** code and were **more confident** it was secure. SQLi introduced by **36%** vs **7%** | Perry et al., ACM CCS 2023. **Peer reviewed.** 47 participants, Codex-era |
| **~40%** of Copilot-generated programs contained a vulnerability, across 89 scenarios and 1,689 programs | Pearce et al., IEEE S&P 2022. **Peer reviewed.** Copilot-era |
| **1.39 billion** websites, of which roughly **206 million** are active | Netcraft, December 2025. **Say which number you mean.** The 1.39 billion counts hostnames and overstates real sites by roughly 7x |
| Web developer and digital designer employment projected **+7%** 2024 to 2034, roughly **14,500** openings a year | US BLS. Note the median wage of $98,090 is for **digital interface designers**; web developers are $90,930 |

---

## M-03 Numbers in wide circulation that do not survive

**Strike these on sight, including from our own older documents.**

| Claim | Why it fails |
|---|---|
| "92% of top-ranking pages on Google load in under three seconds" | Traced to an SEO affiliate stats roundup that carries **no primary source at all**, and the claim is not even on the page cited. Google has no three-second ranking threshold. Use the actual Core Web Vitals thresholds: **LCP under 2.5s, INP under 200ms, CLS under 0.1**, at the 75th percentile of field data |
| "Visuals are encoded in the brain 74% faster than text" | The primary source says 74% faster than **dull content**, not than text. Comparator swapped. Vendor marketing research, not peer reviewed. It is a reskin of the debunked "60,000x faster than text" myth |
| "The most common mobile screen resolution is 360x800, so design for it" | Superseded, and useless as a rule either way. The current leader holds roughly **13%**. There is no modal device. See K-03 |
| "Only 10.5% of AI-generated code is secure" | The number is real but the framing is not. SUSVIBES tasks were **selected because they had historically produced vulnerabilities**. It is a worst case on pre-selected hard cases, not a base rate. It is also a preprint. See S-16 |
| "AI-introduced vulnerabilities are 5x to 10x more common than reported" | The Georgia Tech tracker's own **extrapolation**, not a measurement. The measured figure is a count of 74 to 78 CVEs, and the researchers state their attribution is biased toward tools that leave clear signatures |
| "There is an OWASP Top 10 for AI-Generated Code" | **It does not exist.** Pages with that title are vendor marketing. The real documents are the OWASP **Secure Coding with AI Cheat Sheet** and the OWASP Top 10 for **LLM Applications**, which is a different subject |
| "Agentic AI projects doubled from 21% to 51%" | 21 to 51 is **2.4x**, not a doubling, and the base is a narrow sub-population. Two articles from the same publisher state the same datapoint two different ways |
| "Organisations with supportive executives are 7x more likely to see revenue gains" | The source's own detailed findings page says **3.5x** for the same relationship. Its summary page says seven. Cite neither until that is resolved |
| "Core Web Vitals pass rates decline steadily as you go down the site rankings" | The published series is **U-shaped**: 51, 42, 37, 42, 48. The declining version is produced by truncating at the trough |
| "Pages using ARIA average twice as many errors, so avoid ARIA" | The correlation is real, the inference is not. ARIA use tracks with page complexity. The rule is the **First Rule of ARIA**: use native HTML semantics where they exist, ARIA where they do not |
| "Sites that get users to view 10% more content see 5.4% higher conversion" | Correlation stated causally. Engagement depth is largely a proxy for pre-existing intent, and manufacturing it with infinite scroll or padded content is a known dark pattern that does not transfer |
| "X% of designers say Y" from a design tool's annual report | Self-selected survey of one vendor's own customers, published with no recruitment method, no field dates, no margin of error and no questionnaire. The articles then drop the "our users" qualifier and print it as "68% of developers". **Tier 5. Do not cite** |
| Anything from a résumé-scraping demographics aggregator, a statistics roundup blog, or a "market size" press release | Not independently checkable, frequently recycled, and in one case the company that published the demographic figures has since wound down |

---

## M-04 Reading the reference libraries adversarially

We audited the design resource library that most clients and juniors treat as authoritative. The pattern is worth writing down, because it repeats across every vendor's content marketing.

**The tell is the gap between what an article is about and what it never mentions.**

Across nine articles about building and shipping AI-generated applications, totalling roughly **24,000 words**, the words "security" or "secure" appear in a substantive sense in **one**. The two articles most likely to be read by a non-engineer about to ship something, roughly 3,950 words combined, mention security **zero times**, while asserting that the output is production ready. One of them walks through a four-step method ending in "bridge the code" with no review gate anywhere. Another includes a hospital management system, an HR dashboard and a city government portal as examples, with no mention of data handling.

The single best artefact: one article has an FAQ entry titled **"How do I make sure my AI coding tool is set up securely?"** The entire answer is about model selection, cost, context management and version support. It answers a security question with procurement advice.

**Three more structural things to check before citing any listicle:**

1. **Are the examples real?** In one "16 landing page examples" article, all sixteen are the publisher's own templates, and the only real brands named are two ticketing companies mentioned as integrations. An examples article containing zero real examples is a catalogue.
2. **Is the top-ranked tool the publisher's own product, undisclosed?** In three separate tool roundups, the publisher's own product ranks first in all three, with no disclosure, no byline and no sponsorship notice.
3. **Does the count in the title match the page?** Titles advertise 12 where the page has 10, and 15 where the page has 11. These are listicles rotated in place at a fixed URL. **Any citation must be dated and archived**, because the article you quote today is not the article at that URL next quarter.

**What this changes for us.** When a client or a junior says "but the reference says", the honest answer is that the reference is content marketing with a design-tool CTA at the bottom, and we can show exactly which of its rules contradict WCAG. That is worth more to the client than agreeing.

One genuinely useful thing did come out of it. The same library's landing page best practices endorse, individually and by name, **six of the seven blocks** in the canonical AI-slop page structure: hero with a strong visual, above-the-fold primary CTA, testimonials, star ratings, company logo strips, and pricing tiers. It declines to give an order. So when we ban that structure in D-02, we are not banning something obscure. We are banning what the industry's own most-linked reference recommends, which is precisely why every generated page looks the same.
