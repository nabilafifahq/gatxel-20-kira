# Search visibility: SEO, AEO and GEO

**Tier: GATE when discovery is in the brief, otherwise HOUSE.** Supersedes and expands H-06.

This file exists because clients now ask for three things by name. The honest answer is that they are one job with three failure points, and most of the advice sold under the newer two names does not survive checking.

---

## N-00 The framing, before any tactic

**SEO** is being findable and rankable. **AEO** is being the extractable answer. **GEO** is being the source a generative system cites. They share one substrate: text a machine can read, from a source that already ranks, making claims it can verify.

Google says this in writing, and it is worth quoting to a client who arrives with a GEO proposal. From Google's own guide to optimising for generative AI features:

> "From Google Search's perspective, optimizing for generative AI search is optimizing for the search experience, and thus still SEO."

> "If you're considering third-party 'AEO' or 'GEO' advice or services, review our guidance on evaluating third-party SEO advice."

> "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add."

> "You don't need to create new machine readable files, AI text files, markup, or Markdown to appear in Google Search (including its generative AI capabilities), as Google Search itself doesn't use them."

> "There's no ideal page length."

> "There's no requirement to break your content into tiny pieces for AI to better understand it."

> "You don't need to write in a specific way just for generative AI search."

> "Seeking inauthentic 'mentions' across the web isn't as helpful as it might seem."

Named Google people say the same thing more bluntly. Gary Illyes at Search Central Live, July 2025: "To get your content to appear in AI Overviews, simply use normal SEO practices. You don't need GEO, LLMO or anything else." Danny Sullivan, September 2025: "Good SEO is good GEO, or AEO, AI SEO, LLM SEO, or LMNOPEO."

**Gatxel position.** We sell one discipline. We do not sell GEO as a separate line item, because we cannot defend the deliverable. What we do sell is the part that is actually broken on most sites, and on the evidence below that is almost always **N-01 to N-04**: the content is invisible to half the crawlers, or the CDN is blocking them outright.

Bahasa: Jangan jual GEO sebagai jasa terpisah. Yang benar-benar rusak di hampir semua situs adalah crawler tidak bisa membaca isinya, atau malah diblokir CDN. Itu yang kita perbaiki.

---

## N-01 Plain HTML, or you do not exist

**GATE when discovery is in the brief.**

**No major AI crawler executes JavaScript.** Vercel measured this across its network in December 2024 and restated it in January 2025: "none of the major AI crawlers currently render JavaScript." They fetch JS files (ChatGPT 11.50% of requests, Claude 23.84%) and never run them.

Googlebot and Bingbot **do** render. So the split is:

| Surface | Renders JS? | Sees client-rendered content? |
|---|---|---|
| Google Search, AI Overviews, AI Mode | Yes | Yes |
| Bing, Microsoft Copilot | Yes | Yes |
| ChatGPT (OAI-SearchBot, ChatGPT-User) | **No** | **No** |
| Claude (Claude-SearchBot, Claude-User) | **No** | **No** |
| Perplexity | **No** | **No** |

### What is safe in Next.js App Router

Safe, because the content is in the initial HTML byte stream: static rendering, `generateStaticParams`, ISR, dynamic SSR, Server Components rendering server-fetched data, and `generateMetadata` output.

Invisible: client components fetching in `useEffect`, SWR or TanStack Query, `next/dynamic(..., { ssr: false })`, content that only exists after hydration, and any SPA shell.

**The subtle one, and the one that actually catches teams: streaming.** Content inside a `<Suspense>` boundary is not in the initial HTML shell. It arrives later as out-of-order chunks that need JavaScript to place. A non-rendering crawler sees the fallback.

**`loading.tsx` creates an implicit Suspense boundary around the whole page segment.** Adding it for perceived performance can move the entire page body out of the initial shell. Partial Prerendering has the same shape: the static shell is visible, the dynamic holes are not.

**Rule.** The primary text of every indexable page, and all JSON-LD, must be present in the initial shell, outside every Suspense boundary. Fetch at page level before streaming starts and stream only visual chrome.

### The test

```bash
curl -s https://site/page | grep -i "<h1"
curl -s https://site/page | grep -c 'application/ld+json'
curl -s https://site/page | grep "the exact headline sentence"
```

If it is not in that output, it does not exist for ChatGPT, Claude or Perplexity. **Test with `curl`, never with DevTools**, because DevTools shows you the rendered DOM and that is exactly the thing these crawlers never build.

One more number from the same Vercel data worth acting on: **ChatGPT and Claude crawlers hit 404 on roughly 34% of their requests**, against 8.22% for Googlebot. They work from stale and invented URLs. So a real 404 page, permanent redirects on every URL change, and stable canonicals are worth more here than they are for Google.

---

## N-02 The crawler inventory, and the split that matters

**GATE.**

The single most repeated error in AI SEO advice is treating one vendor as one bot. Every major vendor runs **at least two**, and they do different jobs.

| Purpose | What it does | Blocking it costs you |
|---|---|---|
| **TRAIN** | Collects corpus for model training | Nothing in search visibility |
| **SEARCH** | Builds the index that answers are drawn from | **Your visibility in that assistant** |
| **USER** | Live fetch because a person just asked about you | **The answer to a real prospect, right now** |
| **CTRL** | A control token only. Never crawls | Varies. Read N-02b |

### Allow these. They are how a client gets seen.

| Token | Operator | Purpose | Obeys robots.txt |
|---|---|---|---|
| `OAI-SearchBot` | OpenAI | SEARCH | Yes |
| `ChatGPT-User` | OpenAI | USER | No |
| `Claude-SearchBot` | Anthropic | SEARCH | Yes |
| `Claude-User` | Anthropic | USER | Yes |
| `PerplexityBot` | Perplexity | SEARCH | Yes, disputed |
| `Perplexity-User` | Perplexity | USER | No |
| `Googlebot` | Google | SEARCH, **and AI Overviews and AI Mode** | Yes |
| `Bingbot` | Microsoft | SEARCH, **and Copilot grounding** | Yes |
| `Applebot` | Apple | SEARCH, Siri, Spotlight, Safari | Yes |
| `DuckAssistBot` | DuckDuckGo | SEARCH | Yes |
| `MistralAI-Index`, `MistralAI-User` | Mistral | SEARCH, USER | Yes |
| `Amzn-SearchBot`, `Amzn-User` | Amazon | SEARCH, USER | Yes, partial |
| `meta-webindexer`, `meta-externalfetcher` | Meta | SEARCH, USER | Yes, no |
| `facebookexternalhit` | Meta | Link previews on FB, IG, WhatsApp | Yes |
| `Google-Agent` | Google | USER, agentic, added March 2026 | No |

`facebookexternalhit` matters more in Indonesia than the ranking of this table suggests, because a large share of link sharing happens in WhatsApp.

### Training-only. Blocking these costs zero visibility.

`GPTBot`, `ClaudeBot`, `meta-externalagent`, `Amazonbot`, `MistralAI-Training`, `CCBot`, `Applebot-Extended`.

**`GPTBot` is not ChatGPT. `ClaudeBot` is not Claude.** Blocking `GPTBot` does not remove a client from ChatGPT; `OAI-SearchBot` does that. This is the error in most published advice, in both directions.

Gatxel default: **leave training crawlers allowed** unless the client instructs otherwise in writing, because presence in training data plausibly helps unprompted brand recall and costs nothing. `Applebot-Extended` is the cheapest concession if a client objects to training on principle, because Apple states plainly that pages disallowing it "can still be included in search results."

### Dead tokens. Do not put these in a robots.txt.

| Token | Status |
|---|---|
| `anthropic-ai`, `Claude-Web` | Deprecated, superseded by `ClaudeBot` |
| `Googlebot-Extended` | **Has never existed** |
| `FacebookBot` | Not in Meta's current documentation |
| `Bingbot-Extended` | Does not exist. Bing's AI opt-out is the `NOCACHE` and `NOARCHIVE` meta tags |
| `omgilibot`, `omgili` | Superseded by Webz.io's `Webzio-Extended` |
| ChatGPT agent, Operator | **Not robots-controllable.** They send a plain Chrome user agent and identify with a `Signature-Agent` header. No token will match them |

---

## N-02b `Google-Extended` and `Applebot-Extended` are not a pair

**GATE. This is the most misunderstood control in the whole subject and getting it wrong is expensive.**

**`Google-Extended` is not training-only.** Google's own words:

> "Google-Extended is a standalone product token that web publishers can use to manage whether content Google crawls from their sites may be used for training future generations of Gemini models that power Gemini Apps and Vertex AI API for Gemini **and for grounding** (providing content from the Google Search index to the model at prompt time to improve factuality and relevancy) **in Gemini Apps and Grounding with Google Search on Vertex AI**. Google-Extended does not impact a site's inclusion in Google Search nor is it used as a ranking signal in Google Search."

Read carefully:

| Question | Answer |
|---|---|
| Does blocking it remove you from AI Overviews? | **No** |
| From AI Mode? | **No** |
| From Gemini grounding? | **Yes.** Blocking it makes the client invisible inside the Gemini apps |
| Does it affect Search ranking? | **No** |

So blocking `Google-Extended` is a net loss for anyone who wants visibility. Do not block it.

**What actually controls AI Overviews is Googlebot**, which is the trap. Google: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search," and "AI is built into Search... which is why robots.txt directives for Googlebot is the control." Blocking Googlebot to escape AI Overviews deletes the client from Google Search entirely.

**There is now a real opt-out, and it is not in robots.txt.** Google Search Console, Settings, **Search generative AI**, announced for phased testing on 3 June 2026 after a UK regulator requirement. Property level. Google states it "isn't used as a ranking or inclusion signal affecting other parts of Search" and takes a few days to take effect. If a client ever asks to leave AI Overviews, that is the control, not robots.txt.

**`Applebot-Extended` is training only.** Apple: it "does not crawl webpages", and "Webpages that disallow Applebot-Extended can still be included in search results." To limit Apple's live grounding use, Apple points to `<meta name="robots" content="nosnippet">`, not to this token.

---

## N-03 The failure that actually happens: the CDN, not the robots.txt

**GATE.** In practice the robots.txt says `Allow: /`, the audit tool says allowed, and the crawler still gets a 403 or an unsolvable challenge at the edge before the request ever reaches Next.js.

### Cloudflare, which is the aggressive one

| Date | What changed |
|---|---|
| 1 July 2025 | Cloudflare began **default-blocking AI crawlers for new sign-ups**. "Any new site that signs up for Cloudflare will automatically, by default, set to block AI bots" |
| 24 September 2025 | Content Signals Policy auto-injected into managed robots.txt for millions of domains |
| 1 July 2026 | Three categories: Search, Agent, Training, configurable separately |
| 15 September 2026 | New defaults: Training and Agent blocked by default on ad-bearing pages for new domains |

**The landmine, in Cloudflare's own words:** "multi-purpose crawlers such as Googlebot, Applebot, and BingBot will be blocked by customers who have selected to block Training", because a multi-purpose crawler is judged on **all** of its behaviours. A client who ticks "block Training" in good faith **deletes themselves from Google.** Say this out loud in the handover call.

Two more Cloudflare items:

- **Managed robots.txt** is not on by default, but when it is on it **overwrites** whatever the Next.js app serves at `/robots.txt`, prepending disallows for Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, Google-Extended, GPTBot and meta-externalagent. If a client's robots.txt contains blocks nobody wrote, this is why.
- **Bot Fight Mode** on the free plan serves JavaScript challenges to non-browser traffic. No AI crawler can solve one. Clients switch this on with good intentions.

### The others

- **Vercel is safe by default.** Both the bot protection and AI bots managed rulesets are inactive out of the box, and verified bots are excluded from evaluation. **But** Vercel's bot protection does not work at all when a reverse proxy such as Cloudflare sits in front of it, and in that topology Cloudflare's defaults govern.
- **AWS WAF.** The `AWSManagedRulesBotControlRuleSet` contains a `CategoryAI` rule that **blocks all matches regardless of whether the bot is verified**. Merely enabling Bot Control blocks GPTBot, ClaudeBot, PerplexityBot and OAI-SearchBot even when they are cryptographically verified. Override it to Count.

### Ranked, the real causes of accidental invisibility

1. Edge bot mitigation. robots.txt and reality disagree.
2. A staging `Disallow: /` promoted to production, or `app/robots.ts` returning a blanket disallow behind an env flag that is unset in prod.
3. **Geo-fencing to Indonesia.** Clients ask for this constantly. Every AI crawler egresses from US or EU cloud ASNs. This kills AI visibility silently and is **invisible to any QA done from inside Indonesia.**
4. Cloudflare managed robots.txt overwriting the app's file.
5. "Block Training" ticked, taking Googlebot with it.

### The go-live check, run from a non-Indonesian egress IP

```bash
for UA in "GPTBot/1.4" "OAI-SearchBot/1.4" "ClaudeBot/1.0" "Claude-SearchBot" \
          "PerplexityBot/1.0" "Googlebot/2.1" "Bingbot/2.0" "Applebot"; do
  printf '%-22s ' "$UA"
  curl -sS -o /dev/null -w "%{http_code} %{size_download}\n" -A "$UA" https://client.co.id/
done
```

Anything other than `200` with a realistic byte count is a fail.

---

## N-04 robots.txt correctness, and the five rules people get wrong

**GATE.** Per RFC 9309 and Google's specification.

1. **A named group does not inherit from `*`.** If `User-agent: *` disallows `/admin/` and a later `User-agent: GPTBot` group says only `Allow: /`, GPTBot is now allowed into `/admin/`. Google picks the single most specific matching group and ignores all others. **Every named group must restate every path rule.** The duplication in our template is deliberate.
2. **Line order does not matter.** It is longest-path-match wins, not first match. `Allow` does not automatically beat `Disallow`. Google's own example: `Allow: /page` against `Disallow: /*.htm`, for `/page.htm`, **Disallow wins** because it is longer. Only on an exact tie does Allow win.
3. **Scope is scheme plus host plus port.** `https://example.com/robots.txt` does not govern `www.example.com`, a subdomain, or `http://`. Every host needs its own file, and every Vercel preview deployment serves its own.
4. **`Disallow` is not `noindex`.** A blocked URL can still be indexed and cited from external links, just without a snippet. To remove a page, **allow** the crawl and serve `X-Robots-Tag: noindex`. `noindex` inside robots.txt has been unsupported since 2019.
5. **A 5xx on `/robots.txt` means complete disallow for the whole site.** Google stops crawling for the first 12 hours then falls back to cache. **Serve `/robots.txt` statically. Never make it depend on a database.**

Also: user-agent tokens are case insensitive, **paths are case sensitive**, an empty `Disallow:` allows everything, a 4xx means full allow, `Crawl-delay` is ignored by Google but honoured by Bing and Anthropic, and the parse limit is 500 KiB.

The Gatxel template lives in `assets/robots.txt`.

---

## N-05 Structured data, and what is actually left

**HOUSE.** Google currently documents **25** structured data features. Anything not in that gallery is dead.

### Dead. Do not ship these on new builds.

| Type | Died |
|---|---|
| **FAQPage** | Restricted to government and health sites in August 2023, then **fully removed on 7 May 2026**. **The carve-out is gone.** No site class gets FAQ rich results now. Search Console reporting ended June 2026, API support August 2026 |
| **HowTo** | Mobile August 2023, **desktop 13 September 2023** |
| **Sitelinks Searchbox** | **21 November 2024** |
| Vehicle listing, Course info, ClaimReview, Estimated salary, Learning video, Special announcement, Book actions | All seven in one announcement, **12 June 2025** |
| Practice problems | Documentation January 2025, tooling January 2026 |

Existing FAQPage markup causes no harm and need not be ripped out urgently. Do not write new.

### Worth shipping, for a Gatxel project

`Organization` on the **homepage or a single about page only** (Google explicitly says "You don't need to include it on every page"), `BreadcrumbList`, `Article`, `Product` and merchant listing for ecommerce and top-up, `LocalBusiness` with name, address, hours and geo, `VideoObject`, `JobPosting`. `Article` has **zero required properties**, so every audit finding claiming "missing required fields" on Article is noise.

**Not available in Indonesia:** loyalty program markup ships in eight markets and Indonesia is not one of them. `Speakable` is beta, US English and Google Home only, so it is worthless here.

### The client request to refuse

Star ratings on the client's own site. Google's rule: if the entity being reviewed controls the reviews about itself, pages using `LocalBusiness` or any `Organization` type are **ineligible** for the star review feature. Doing it anyway is a textbook spammy structured markup manual action. **Refuse this, in writing, and explain why.**

### Does schema help an LLM cite you?

**No direct evidence, and the best available study found none.** This is worth stating plainly because the industry asserts the opposite constantly.

- **Ahrefs, May 2026.** Difference-in-differences on 1,885 pages that added JSON-LD against 4,000 matched controls. Google AI Overviews **-4.6%** (statistically significant), AI Mode +2.4% and ChatGPT +2.2% (both indistinguishable from zero). Conclusion: "Adding schema produced no major uplift in citations on any platform." Vendor research, but a real quasi-experiment. Caveat the authors state: the sample was already-cited pages.
- **searchVIU, October 2025.** Placed the same product price in different layers and queried each system. Finding: **"JSON-LD Schema Markup is NOT extracted by ANY system during direct fetch"**, even when the value appeared nowhere else. Claude extracted it 0 times out of 8.
- **Google:** "There's also no special schema.org structured data that you need to add."
- The only affirmative vendor claim is a Bing principal PM saying on a conference stage in March 2025 that schema helps Copilot. That is the entire corpus.

**Gatxel position: sell schema for the rich results it still produces, which is a real and checkable deliverable. Never sell it as an AI citation lever.**

### Implementation, App Router

Next.js has an official recommendation, updated March 2026: render JSON-LD as a `<script>` tag in `layout.tsx` or `page.tsx`.

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
  }}
/>
```

- **The `.replace` is mandatory, not decorative.** `JSON.stringify` does not sanitise strings used for XSS injection. For anything user-supplied (reviews, CMS fields, a supplier product feed) use a real serialiser.
- Use a native `<script>`, not `next/script`. JSON-LD is data, not executable code.
- **Server component only.** Never in a `'use client'` component: it will only exist after hydration.
- **Never inject schema through Google Tag Manager.** Invisible to every AI crawler.
- Emit it in the initial shell, outside every Suspense boundary. See N-01.
- Verify: `curl -s <url> | grep 'application/ld+json'`.

Mixing JSON-LD and microdata on one page has been allowed since October 2023, and entities merge across syntaxes via `@id` and `itemid`. Use `@id` for genuine deduplication, not as a ritual. Current tools: Rich Results Test for Google features, validator.schema.org for generic validation. The old Structured Data Testing Tool is retired.

---

## N-06 Content, and the only interventions with real evidence

**HOUSE.**

The one piece of peer-reviewed causal work is the **GEO paper**, Aggarwal et al., KDD 2024. Read what it actually did before quoting it.

**Method:** take the top 5 Google results for a query, feed them to GPT-3.5-turbo, have it write a cited answer, then rewrite **one of those five sources** with a single tactic and measure how much of the answer that source now occupies. So the measured quantity is **share of one generated answer, conditional on already having been retrieved into a five-document context.** It measures neither retrieval, nor ranking, nor traffic.

| Tactic | Effect on position-adjusted word count |
|---|---|
| **Quotation addition** | **+40.9%** |
| **Statistics addition** | +30.6% |
| Fluency optimisation | +28.0% |
| **Cite sources** | +27.5% |
| Technical terms | +17.6% |
| Easy to understand | +14.0% |
| **Authoritative tone** | +10.4% |
| Unique words | +6.2%, noise |
| **Keyword stuffing** | **-8.3%** |

**What the industry never quotes.** Keyword stuffing made things **worse**. Unique words did nothing. **"Authoritative tone", the single most repeated GEO tactic in circulation, ranks seventh of nine on the objective metric.** It scores better on the metric graded by an LLM, which is a known judge bias, not a visibility effect. And the effects are **domain dependent**: the authors' own conclusion is that owners "should strive towards making domain-specific targeted adjustments". Every "9 proven GEO tactics" listicle inverts that.

The "up to 40%" figure is specifically quotation addition, on a synthetic metric, on GPT-3.5-turbo. Validated on a 200-query subset of a real engine it returned roughly **22%**.

**So the defensible content rule is narrow, and we state it narrowly:**

> Make claims extractable and verifiable. A direct quotation with a named speaker, a statistic with a named source, and an explicit citation are the only content interventions with peer-reviewed causal support, and only once the page is already being retrieved.

Which is, conveniently, exactly what C-05 in our copy standard already requires. Every claim carries a number, a name, or a source. We were doing GEO before it had a name, because it is just writing that can be checked.

**Structure.** Answer-first, scannable, question-shaped headings, short self-contained blocks: all of this is good writing and good UX, and none of it has evidence behind it as a citation lever. Do it because it serves the reader. Do not bill it as GEO.

**A caution worth carrying.** An independent 2026 survey of the GEO literature reports **34 to 42% daily variance in AI answer sets** for the same prompts, which is larger than most claimed effects, and a benchmark where body-only optimisation **cut** top-20 retrieval by about 9%. Optimising the text can lose you the retrieval step. Preprint, not peer reviewed, but the variance point matches everything else we found.

---

## N-07 Ranking still matters, and the numbers do not agree

**HOUSE.** Do not put a single overlap statistic in a client deck. Credible vendor estimates for "share of AI citations that rank in Google's top 10" span **16.7%, 32%, and 76%**, and **12%** for ChatGPT, Gemini and Copilot. They disagree because they count different things: one counts only the three most prominent citations, one counts all citations, one is domain-level rather than URL-level.

**The defensible statement:**

> Ranking well in classic search substantially raises the probability of being cited, but is neither necessary nor sufficient. Roughly a third to a half of AI Overview citations come from outside the top 10. For standalone assistants like ChatGPT, Google ranking is close to uninformative.

Ahrefs' own analyst put the correlation as "positive yet moderate... a coin flip at best". One vendor measurement that is at least internally consistent: rank 1 gets cited about 43% of the time, rank 20 about 7%.

**Citation share is volatile.** ChatGPT's Reddit and Wikipedia citation share collapsed in mid-September 2025 alongside a model rollout that cut platform-wide outbound citations. Any baseline has a half-life of weeks. Never build a client's reporting on a single snapshot.

---

## N-08 Local, and what actually moves it in Indonesia

**HOUSE.**

**LocalBusiness schema does not affect local ranking.** Google's local ranking guidance names exactly three factors, **relevance, distance, prominence**, and does not mention structured data anywhere on the page. John Mueller, April 2025: **"Structured data won't make your site rank better."**

What actually moves local visibility, in order:

1. **Google Business Profile** completeness and correct primary category. This is the dominant lever by a wide margin and it is not on the website at all.
2. Proximity, which cannot be influenced.
3. Review volume, velocity and recency on the profile, not on the site.
4. NAP consistency across the web.
5. Prominence signals from the wider web.

**So for an Indonesian local business client, the honest scope is GBP work plus a fast crawlable site, not schema work.** Sell what moves the number.

---

## N-09 Measurement, and what cannot be measured

**HOUSE.**

| Source | Available since | Gives you | Does not give you |
|---|---|---|---|
| **Google Search Console**, generative AI performance reports | Announced 3 June 2026, phased | AI Overviews **and AI Mode** impressions, by page, country, device, date | **Queries, clicks, CTR, position, placement.** Impressions only |
| **Bing Webmaster Tools**, AI Performance | 11 February 2026 | Copilot citations, and **grounding queries**, the only real observed query fan-out data available anywhere | Anything about ChatGPT, Perplexity, Gemini or Google |
| **Server logs** | Always | The truth | Nothing. This is the good one |
| Referral traffic | Always | A floor, never a total | Zero-click answers, and in-app browsers strip referrers |

GSC and classic Search data are reported **separately and must not be summed.**

**Log-based measurement is the one we own.** Segment crawler hits by purpose:

- Training: `GPTBot`, `ClaudeBot`, `meta-externalagent`, `Amazonbot`
- Index: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`
- **User-triggered: `ChatGPT-User`, `Claude-User`, `Perplexity-User`.** A hit from one of these means **a real person asked an assistant about this client, just now.** It is the highest-value line in the log and nobody watches it.

Referrer hosts worth a channel in analytics: `chatgpt.com` and `chat.openai.com` (often with `utm_source=chatgpt.com`), `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com`, `edgeservices.bing.com`.

**A fixed prompt panel is the only honest visibility report.** Pick 30 to 50 prompts that matter commercially, freeze them, run them on a schedule across ChatGPT, Perplexity, Gemini and AI Mode, log the model version, and report "cited on N of 50 tracked prompts, week over week". An auditable count against a disclosed denominator.

**Do not buy or resell a black-box AI visibility score.** The prompt universe is effectively infinite, so there is no valid denominator. Vendors pick a small arbitrary static prompt set and present the output as representative. It is not auditable the way a keyword list is, and daily answer-set variance runs 34 to 42%.

---

## N-10 What to tell a client about traffic

**HOUSE.** Be honest here, because the client will find the headlines anyway.

| Study | Provenance | Finding |
|---|---|---|
| Pew Research Center, July 2025 | **Independent research organisation. Strongest provenance available** | 900 US adults, 68,879 real searches. Clicked a result on **8%** of visits with an AI summary against **15%** without. Clicked a link inside the summary on **1%**. Ended the session: 26% against 16% |
| Ahrefs, 2025 | Vendor | **-34.5%** CTR at position 1 when an AI Overview is present, 300,000 keywords |
| Ahrefs, updated to Dec 2025 | Vendor | **-58%.** "For every 100 clicks that would have gone to the first-ranking page in the past, only 42 clicks remain" |
| Google, August 2025 | The party holding the data | "Total organic click volume from Google Search to websites has been relatively stable year-over-year", and click quality has increased. Called the Pew study "flawed methodology and skewed queryset" |

**Read both sides adversarially, and say so.** Google's post contains **no numbers at all**: no percentages, no totals, no methodology. But the vendor studies are observational, the queries that trigger AI Overviews are systematically different from those that do not, and a December 2023 to December 2025 comparison conflates AI Overviews with two years of unrelated change.

**Both can be true at once.** Aggregate clicks can stay flat if query volume grows, while per-query click-through on affected informational terms falls hard. Nobody has published the data that would settle it.

**The honest client expectation:** material click-through loss on informational head terms where an AI Overview appears. Commercial and transactional queries are less affected so far, but the surface is spreading into them fast: one vendor measured transactional keywords triggering AI Overviews rising from **1.98% to 13.94% during 2025**.

**What follows for scope.** If a client's model depends on informational traffic, say early that the traffic is going and the work is to be the cited source and to convert the smaller number of visits harder. That is a different brief than "rank for these keywords" and it should be priced as one.

---

## N-11 IndexNow

**GUIDE.** A push protocol: tell participating engines a URL changed instead of waiting to be crawled. Consumed by **Bing, Yandex, Seznam, Naver, Yep and Amazon**. **Google does not participate**, having trialled it in 2021 and never adopted it.

Implementation is small: a key file at `public/<key>.txt` containing only the key, and a POST to `https://api.indexnow.org/indexnow` with `{ host, key, keyLocation, urlList }`, up to 10,000 URLs. Fire it from the CMS webhook alongside `revalidatePath`, never from a build, or you resubmit unchanged URLs and get rate limited.

**Does it help AI visibility? There is no verified evidence.** Bing's index grounds Copilot, so faster Bing indexing plausibly shortens time to citation there, but no Microsoft statement confirms it. Perplexity, Claude and Gemini do not consume it. **Ship it as search hygiene. Do not bill it as an AI lever.**

---

## N-12 The strike list

**Read this before quoting anything in a proposal.**

| Claim | Verdict |
|---|---|
| "GEO delivers a 40% visibility lift" | Misreads the paper. It is a relative gain in **share of one generated answer**, conditional on already being one of five retrieved documents, on GPT-3.5-turbo, on a synthetic metric. Real-engine validation gave about 22% |
| "Authoritative tone is a top GEO tactic" | Seventh of nine on the objective metric. It only scores well on the metric graded by an LLM, which is judge bias |
| "Keyword density and repetition help AI pick you up" | **Keyword stuffing measured -8.3%.** It is the only tactic that made things actively worse |
| "Publish `llms.txt`" | No vendor consumes it. Gary Illyes, July 2025: "Google doesn't support LLMs.txt and isn't planning to." Google's guide says you do not need AI text files. Server-log analyses find almost no AI crawler ever requests it |
| "Schema gets you cited by ChatGPT and Claude" | No evidence. Ahrefs measured null to slightly negative. searchVIU found **zero JSON-LD extraction by any system on direct fetch**, Claude 0 out of 8. Google says no special schema is needed |
| "FAQ schema still works for government and health sites" | **The carve-out is gone.** Fully removed 7 May 2026. No site class qualifies |
| "Add LocalBusiness `aggregateRating` for stars" | Ineligible by rule, self-serving reviews, **and a manual action risk.** The most requested and most dangerous client ask |
| "Article schema requires headline, image, datePublished, author, publisher" | **Article has zero required properties** |
| "Structured data is a ranking factor" | Mueller, April 2025: "Structured data won't make your site rank better." Google's local ranking doc does not mention it at all |
| "1,500+ words to get cited", "chunk into 300-word blocks" | Google: "There's no ideal page length" and "There's no requirement to break your content into tiny pieces" |
| "40 to 60 words under a question-formatted H2 wins the snippet" | Inverts a **display truncation measurement** into a causal writing rule. Google's own doc answers "how do I optimise for featured snippets" with **"You can't."** |
| "50% of searches are voice", attributed to ComScore | **ComScore never published it and denies it.** It is a mangled 2014 Andrew Ng prediction about **Baidu**, about "images **or** speech" combined, over five years |
| "40.7% of voice answers come from featured snippets" | One vendor study, February 2018, 10,000 Google Home results, never replicated, measuring a product that no longer works that way |
| "Write conversational, voice-style long-tail keywords" | Google: "You don't need to write in a specific way just for generative AI search." The premise rests on the fabricated voice statistic above |
| "X% of AI citations come from the top 10" | Credible estimates span 12%, 16.7%, 32% and 76%. Quoting one is cherry-picking |
| "Featured snippet visibility fell 64%, from 15.41% to 5.53%" | Circulates with no attributable source or method. The direction is right, the number is unusable |
| "We can reveal and target your query fan-out" | Google documents that fan-out exists and discloses **neither the count nor the text**. Tools showing "your fan-out queries" are generating plausible ones. The only observed fan-out data is Bing's grounding queries, Copilot only |
| "Get mentioned everywhere, seed listicles and forums" | Google: "Seeking inauthentic 'mentions' across the web isn't as helpful as it might seem" |
| "AI share of voice" as a KPI | No valid denominator, vendor-chosen static prompts, unauditable, and 34 to 42% daily variance |
| "Block GPTBot to control ChatGPT" | Wrong bot. `GPTBot` is training. `OAI-SearchBot` is visibility |
| "Block Google-Extended, it is just training" | Wrong. It also governs **Gemini grounding**, so blocking it makes the client invisible in the Gemini apps while doing nothing about AI Overviews |
