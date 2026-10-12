# GTX-ENG-001 / H. Conversion, local business, and AI search

Tier: **GUIDE**, except the accessibility floor and the legal pages, which are covered elsewhere as GATE.

This section exists because a client website checklist circulating online is roughly half evidence and half folklore, and we should know which half we are selling.

Evidence grades used below: **[E]** evidence-backed, **[P]** plausible practice with no controlled evidence, **[F]** folklore or contradicted.

---

## H-01 The checklist, graded

The list a practitioner sent us, item by item.

| Item | Grade | What the evidence actually says |
|---|---|---|
| Real customer reviews | **[E]** strongest item on the list | 97% of consumers read reviews. **47% will not use a business with fewer than 20 reviews.** 31% require 4.5 stars or better, up from 17%. **74% weight reviews from the last three months.** 80% favour businesses that reply to all reviews, and 50% distrust templated replies |
| Unique page titles | **[E]** | Long-confirmed ranking input. One of the few real levers here |
| Internal links | **[E]** | Crawl discovery and link equity. A dedicated page per service is the top local-organic factor |
| Alt text | **[E]**, but for legal reasons | Marginal SEO value. **Missing alt text is the single most-claimed defect in US accessibility lawsuits** |
| Maps and directions | **[E]** indirectly | Proximity is a top-two local pack factor, but the ranking work happens in Google Business Profile, not in an embedded map. The embed is a conversion asset |
| Thank-you page | **[E]** rationale, **[P]** as a hard rule | A distinct URL is a stable, debuggable conversion trigger. A GA4 `generate_lead` event is equally valid, so "you cannot track without one" is overstated |
| CTA above the fold | **[E]** but overstated | See H-02 |
| Privacy policy | **[E]** as legal hygiene | Not SEO. Required in spirit by UU PDP and by every ad platform |
| Google Analytics | **[P]** | GA4 only. Consent detail in H-05 |
| Breadcrumbs | **[P]**, **[F]** as a ranking factor | Google's own docs describe appearance only, and only on desktop |
| Case study section | **[P]** | No controlled evidence. Reasonable trust signal. Do not sell it as a ranking factor |
| Response-time promise | **[P]** | No conversion study found |
| Sticky mobile CTA | **[P]** with a real accessibility caveat | See H-03 |
| Social share images | **[P]**, **[F]** as SEO | Zero search effect. Real effect on **WhatsApp link previews**, which for Indonesian SMEs is a high-traffic surface |
| Custom 404 | **[F]** as SEO, **[P]** as UX | No ranking benefit. Only **soft** 404s (returning 200 for a missing page) are a real problem |
| Meta descriptions | **[E]** for click-through, **[F]** as ranking | Google has confirmed repeatedly that these are not a ranking factor, and rewrites them often |
| robots.txt | **[F]** as a must-have | Google does not require one and warns it is not a way to keep a page out of search. Its 2026 relevance is AI crawler control, see H-06 |
| Five FAQs | **[F]**, at least the number | **The number five is invented.** And FAQ rich results were dropped by Google on 7 May 2026, so the original SEO payoff is gone. FAQs still help AI citation, but "five" is folklore |
| LocalBusiness schema | **[F]** as a local ranking lever | Whitespark's 2026 study of 187 factors ranked schema **161st of 187 for the local pack**. Its value has migrated from local SEO to AI citation |

---

## H-02 Above the fold, honestly

Nielsen Norman Group eyetracking, 120 participants and over 130,000 fixations:

- **57% of viewing time is above the fold**, down from **80% in 2010**
- **74% in the first two screenfuls**, 81% in the first three

NN/g's own framing is that the fold **moved down**, not that it disappeared. So "put the important thing high" is evidence-backed. "The CTA must be visible without scrolling" is a 2010 rule that lost 23 percentage points of force. **The defensible standard is that the first two screenfuls carry the offer**, not that everything gets crammed above 600 pixels.

---

## H-03 Sticky mobile CTA

Conversion evidence is weak and vendor-sourced. The accessibility caveat is not.

W3C failure technique **F110** describes exactly this pattern: "Failure of SC 2.4.11 Focus Not Obscured (Minimum) due to a sticky footer or header completely hiding focused elements." A keyboard user tabs down the page and the focused element disappears behind the bar. That is a **Level AA failure**.

Rules if we ship one: tab through the whole page against the bar, set `scroll-padding-bottom` equal to the bar height, cap the bar height, and consider hiding it while a keyboard focus is active.

---

## H-04 What the checklist is missing, and it matters more than most of what is on it

1. **Google Business Profile itself.** The entire top five of local pack ranking is GBP configuration: primary category, proximity, business title, city in the address, and open hours. A perfect website with a neglected GBP loses the map pack. This is the biggest omission by a wide margin. **[E]**
2. **NAP consistency.** Name, address, phone matching GBP ranks around 15th for the local pack. Modest but real, and regaining relevance for AI search. **[E]**
3. **Click-to-call `tel:` links.** Trivially cheap, removes a step from the highest-intent mobile action. **[E]**
4. **WhatsApp click-to-chat.** For Indonesian SMEs this is plausibly the highest-value single element on the page. *Honest caveat: every percentage circulating about Indonesian WhatsApp business preference traces to vendor marketing with no methodology. The market practice is well established, the numbers are not. Do not quote a figure to a client.* **[P]**
5. **Mobile performance.** With Indonesia's mobile-first access pattern this outweighs most of the checklist. **[E]**
6. **Form length, contested.** The famous "fewer fields converts better" claim rests largely on one case study. Shorter forms raise **volume** and lower **lead quality**. The honest metric is downstream, not form completions. Standard is right-sized capture, not minimum fields. **[P]**, and actively do not present it as settled.
7. **Trust signals:** real photos, named people, a physical address, registration numbers. **[P]**

---

## H-05 Analytics and consent, Indonesia

GA4 is the only option. Universal Analytics stopped processing in July 2023.

For a purely Indonesian audience, a GDPR-style blocking consent banner is **not legally required today**. Indonesia has no cookie or tracker-specific regulation. What **is** required is transparency: a real privacy policy stating what is collected and why.

Deploy a full consent gate when the client has EU or UK traffic. Build the banner as a switchable component now, because this will change once the PDP authority is appointed.

---

## H-06 AI search, and the corrections that matter

### The bot names are wrong in most advice

**Blocking GPTBot does not remove you from ChatGPT search.** The agents split by purpose:

| Agent | What it controls |
|---|---|
| **`OAI-SearchBot`** | **ChatGPT search visibility.** Opted out means you will not appear in ChatGPT search answers |
| `GPTBot` | Training only |
| `ChatGPT-User` | Live fetch when a user asks |
| **`Claude-SearchBot`** | Claude search indexing |
| `ClaudeBot` | Training |
| `Claude-User` | Live user queries |
| `PerplexityBot` | Indexing. `Perplexity-User` is live fetch |

So the common advice "allow GPTBot so ChatGPT can find you" is **technically wrong**. If a client wants AI search visibility while opting out of training, allow the **SearchBot and User** agents and disallow the training agents.

**Check Cloudflare.** Since 1 July 2025 every **new** domain on Cloudflare is asked whether to allow AI crawlers, and the default can block them. This is a real and common accidental self-block. Verify the setting on any zone created after that date.

### The "134 to 167 words" rule is fabricated

We traced it. It originates in a single agency blog post with **no sample size, no methodology, no dataset, and no citation**, and that same article contradicts itself elsewhere by giving a different "precise" range. Downstream blogs repeat it as fact.

A meta-analysis scoring 54 studies, experiments, and patents across ChatGPT, Gemini, and Perplexity **found no optimal word count** for passages or headings.

**Strike the number.** The directional advice survives: self-contained answers under question-shaped headings, answer first. That is consistent with how retrieval chunking works, and a 2026 evaluation of chunking methods found that **semantic coherence matters more than chunk size**, with no universal optimum.

### What the actual research supports

The KDD 2024 GEO paper (Aggarwal et al., 10,000 queries, validated on Perplexity) tested nine tactics:

| Tactic | Measured effect |
|---|---|
| **Add statistics** | +41% visibility, +37% subjective impression. Best overall |
| **Cite sources** | **+115% for a page sitting at position 5.** Biggest equaliser for low-ranked sources |
| **Add quotations** | +28% |
| **Fluency optimisation** | Combined with statistics, beat every single method |
| **Keyword stuffing** | **Minus 10%. Actively harmful** |

Caveats to carry into any client deck: the setup is zero-sum with only five competing sources per query, which inflates relative gains, all the optimisations were LLM-written, and it measures visibility inside an answer, not traffic.

**So the actionable core is narrow and unglamorous: add statistics, add quotations, cite sources, write fluently, do not keyword stuff.**

### Your own domain is about 3% of the citation surface

A 2026 study of 102,025 prompt responses across 102 brands found **75.2% of citations go to third-party and corporate pages, and only 2.9% to the brand's own domain**. YouTube was 4.2%, editorial 3.8%, forums 3.3%. **Ranked "best of" listicles were 35.7% of content citations.**

The same study found a brand-stature ladder: tier one global brands hit 73% unbranded visibility, mid-market 44%, small and niche **11%**.

A separate 2026 experiment found brand identity explains only **1.2%** of ranking variance while product parameters (rating, price, review count) explain **82.4%**. Brand acts as a tiebreaker when quality signals are ambiguous, and a **0.075 star** rating advantage was enough to flip a fictional brand past a real incumbent.

**Implication for a Gatxel client: the leverage is not on-page. It is third-party presence and legible quality signals.** Directories, roundups, YouTube, forums, and real review counts. That is closer to digital PR than to SEO.

### AI search does not send traffic

Pew Research, 900 US adults with browser tracking, 68,879 searches:

- Clicked a traditional result: **8% with an AI summary versus 15% without**
- Clicked a source link **inside** the AI summary: **1%**
- Ended the session entirely: 26% with a summary versus 16% without

Cloudflare's crawl-to-referral ratios for July 2025: Anthropic **38,065:1**, OpenAI **1,091:1**, Perplexity 194:1, Google 5:1.

**Sell GEO as brand presence inside the answer, never as traffic.** A studio that promises sessions from AI search will fail to deliver.

---

## H-07 Accessibility legal exposure, honestly

A video claimed an inaccessible app will get you sued. That is **true for US-facing businesses and false as a general statement** for an Indonesian studio serving Indonesian clients.

**The US numbers are real.** Over 5,000 ADA digital accessibility lawsuits in 2025. **64% of defendants had under 25 million dollars of revenue.** eCommerce was 70% of filings. Typical settlements run 5,000 to 20,000 dollars, with small businesses usually under 10,000, though those figures are practitioner estimates rather than court records. The three most-claimed defects are **missing alt text, missing form labels, and no keyboard navigability**, all three cheap to prevent.

**Accessibility overlay widgets do not protect you.** Between 95 and 155 lawsuits per month in 2025 were filed against sites that had one installed.

**Two corrections to common sales pitches:**

- The DOJ's April 2024 web rule applies to **state and local government only**, not private business. Anyone citing it to sell compliance to a private company is misrepresenting it. Its deadlines also moved to April 2027 and April 2028.
- The European Accessibility Act has a **microenterprise exemption**: fewer than 10 employees **and** 2 million euro or less turnover. That exempts a large share of SME clients outright. No public enforcement actions were found, so treat "EAA fines are being issued" as a marketing claim.

**When it becomes real for us.** The trigger list, in order of likelihood:

1. The client sells to **US consumers**. eCommerce is 70% of filings and small businesses are the majority of targets
2. The client sells to EU consumers **and** exceeds the microenterprise threshold
3. The client supplies a government body with procurement accessibility rules
4. The client is a subsidiary or vendor of a multinational pushing WCAG down through supplier agreements. Increasingly the most common real route
5. **Our own contract.** If we warrant "accessible" and do not deliver, that is a plain breach claim under Indonesian law, jurisdiction irrelevant

**Gatxel's position:** build to WCAG 2.2 AA by default because the cheap 80% is exactly the list that generates lawsuits and costs almost nothing at build time. **Never buy or sell an overlay widget.** And do not use lawsuit fear to sell to Indonesian-only clients, that is the same unfounded-claim behaviour this standard exists to prevent.

Note the trend: **WebAIM's 2026 survey of the top million home pages found detected errors up 10.1% year over year**, reversing years of improvement, and WebAIM attributes part of it to "automated or AI-assisted coding practices." 95.9% of home pages still fail.

---

## H-08 Fake social proof is now illegal in the US

**GATE where a client sells to US consumers, HOUSE everywhere.**

The FTC Rule on Consumer Reviews and Testimonials took effect **21 October 2024**, with civil penalties per violation. It specifically bans:

- **AI-generated reviews and testimonials** from people who do not exist or never used the product
- Insider testimonials from founders, employees, or family without disclosure
- **Buying or selling fake follower and view counts**, which puts a fake counter widget in scope
- Company-controlled "independent" review sites
- Suppressing negative reviews while implying you show all of them

Adjacent patterns to ban as house style regardless of jurisdiction:

- **Unlinked press logos.** An "as seen in" strip where no logo links to a real article
- **Uncited statistics.** Also poisons AI citation, since answer engines prefer sourced claims
- **Round-number case study results.** Real results are ugly numbers, not "+300%"
- **Testimonials with no verifiable person.** Full name plus company plus link, or delete it
- **Countdown timers that reset on reload**
- **Unearned compliance badges.** SOC 2 or ISO 27001 with nothing behind them
- **Template legal pages** still containing `[Company Name]`, or governed-by-California boilerplate on an Indonesian product
