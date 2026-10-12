# Page anatomy and trust

**Tier: HOUSE, GATE where a page is legally required.**

What each project type actually needs on the page, in what order, and what evidence supports it. The per-type blueprints are in `GTX-ENG-001_Playbooks.md`.

---

## T-01 Trust: what is evidenced, and what is asserted

**HOUSE.**

**The Stanford Web Credibility study is real and is routinely misquoted.** Fogg et al., ACM CHI 2003, **n = 2,684**. Participants compared two live sites and wrote free-text comments, which researchers content-coded. Top factors by share of participants mentioning them: design look 46.1%, information design 28.5%, information focus 25.1%, company motive 15.5%, name recognition 14.1%.

**Three caveats that must travel with it.** It measured **what people say when comparing two sites**, not behaviour and not conversion. **"Design look 46.1%" does not mean design is 46% of credibility**, it means 46% of people mentioned it, and mention frequency is not causal weight. And it is from **2003**, before mobile, Google reviews and social. The structural claims hold up in every later study; the percentages are historical.

### What users actually check, sorted honestly

| Signal | Status |
|---|---|
| **Phone number** | **Evidenced.** NN/g Contact Us, 20 business professionals across 40 sites. A participant: *"There are companies that don't even give you a phone number anymore. I don't like it at all... it makes them seem suspicious."* |
| **Physical address** | **Evidenced.** NN/g Contact Us guideline 5, and NN/g's China study on local physical presence |
| **Named past work** | **Evidenced.** NN/g China; Stanford guideline 3 |
| **External verifiability**, third-party reviews and ratings | **Evidenced.** Users "frequently cross-referenced corporate sites with third-party reviews (Google, Yelp, Glassdoor)" |
| Live chat | Weakly evidenced. 5 of 8 in one small study, and chat logs create an accountability record |
| Real names and faces | **Asserted.** Stanford guideline 4 says show honest people, but no study isolates headshots. **NN/g does find stock photography actively hurts** |
| Company registration number | **Asserted.** No study. Legally relevant in Indonesia, not evidenced as a trust driver |
| **Trust seals and badges** | **Weak to nil. See T-06** |

### Indonesia raises the threshold, not the mechanism

Komdigi reports roughly **1,700 digital fraud reports per day**, with about 574,000 of 839,000 cumulative reports relating to online commerce. Hidayat et al. 2021, *Information* 12(4):145, **n = 468** Indonesian online shoppers, PLS-SEM: trust to perceived value **beta = 0.64**, trust to buying interest **beta = 0.33**. **Trust is the upstream antecedent, not a decoration.**

There is **no Indonesia-specific credibility study** of the Fogg kind. The defensible position: **the mechanism is the same, the threshold is higher.** The best proxy is NN/g's study of a high-counterfeit market, which points at **local physical presence, verifiable past work, uniformly professional production quality, and a live human channel**, not badges. That matches Indonesian consumer advice, which tells buyers to check a bank account against cekrekening.id and look for a reachable phone or WhatsApp. **That verification path only works if you publish those things.**

---

## T-02 The IT consulting site, and the mumbling problem

**HOUSE.** Eight real sites read in August 2026: Thoughtworks, thoughtbot, 8th Light, Netguru, Ice House, SoftwareSeni, Mitrais, Suitmedia.

**The converged section order, which is not the AI-slop order:**

1. Hero, a positioning claim
2. **Client logos immediately after the hero.** Seven of eight. 8th Light puts logos **first, before anything else**
3. **Case studies and named work.** Eight of eight, and on the strong sites **before** the service list
4. Services and capabilities
5. Process or engagement model
6. Stats, credentials, certifications
7. Testimonials **where present. Absent entirely from Thoughtworks and 8th Light**
8. Insights
9. Careers
10. Contact and footer

**The inversion that matters: the clear sites lead with evidence, then explain services. The vague ones lead with abstractions.**

### Clarity markers, usable as a lint rule

Compare directly:

> **Ice House:** "Founded in South Jakarta, Ice House is the first Google Certified Developer in South East Asia. **We design, build and maintain mobile apps and their backends**."
> **Suitmedia:** "Unlock Your Business Potential with Digital Transformation... We provide strategic guidance and data-driven insights to achieve your digital transformation goals."

1. **A concrete transitive verb with a real object.** "design, build and maintain mobile apps and their backends" versus "unlock your business potential".
2. **A named constraint or domain.** thoughtbot: "reliability, compliance, and long-term maintainability matter as much as speed". That is a positioning move, not a boast.
3. **Falsifiability.** "first Google Certified Developer in South East Asia" can be checked. "leading digital agency" cannot.
4. **No abstract-noun stack.** "solutions", "potential", "transformation", "excellence" in one sentence is the tell. Suitmedia's four pillars are Strategy, Creative, Technology, Communication, labels that partition nothing.
5. **A stated scope, including what you are not.** 8th Light: "The hype is loud. The potential is great. The work is what matters."

**Grep for the mumble:**

```bash
rg -i 'unlock your|business potential|digital transformation|end-to-end solutions|cutting.edge|solusi terbaik untuk|potensi bisnis' --glob '*.{tsx,md,json}'
```

### Proof without inventing testimonials

**Thoughtworks and 8th Light both carry zero testimonials on their homepages.** Their proof is named case studies plus partner badges, which are third-party verifiable. Netguru attaches outcome numbers to named clients and shows Clutch and B Corp. Mitrais publishes operational metrics instead of praise: 62% client retention, 3% churn, 500+ certified developers, ISO 27001:2022.

**For a young studio with no case studies, in descending order of defensibility:**

1. **Partner and vendor certifications.** Third-party verifiable.
2. **Named clients with written permission**, even without a quote.
3. **Publicly verifiable artefacts:** shipped apps with store links, open-source repos, published uptime.
4. **Operational facts about your own practice:** team size, stack, response-time SLA, security posture. "Grade A on securityheaders.com across every site we ship" is a claim we can now actually make, and prove.

A fabricated testimonial fails Stanford guideline 10, "avoid errors of all types", the moment anyone checks. And see O-02 for why it is also criminal here.

---

## T-03 SaaS: where the email field actually goes

**HOUSE.**

**There is no controlled evidence for hero email capture.** Searching for it returns only page-builder and CRO-vendor blogs. That absence is the finding.

What four real 2026 SaaS sites do:

| Site | Hero CTAs | Inline email in hero? |
|---|---|---|
| Linear | "Coding Sessions", sign up in the utility nav | **No** |
| Attio | "Start for free" plus "Talk to sales" | **No** |
| Resend | "Get started" plus "Documentation" | **No** |
| Vercel | "Deploy now" plus "Talk to sales" | **No** |

**Zero of four. All four use a two-button pattern: self-serve primary plus sales-assisted secondary.** That is the same shape as the Indonesian pattern in R-07, where the sales-assisted button is WhatsApp.

**"Above the fold" as a rule is dead, and the real number is better.** NN/g eye-tracking, 120 participants, 130,000+ fixations: in 2010, 80% of viewing time was above the fold. **In 2018 it was 57%**, with **74% in the first two screenfuls and 81% in the first three.** The gradient is real and steep. The hard fold is not.

**So: put the decision-enabling thing in the first screenful: what it is, who it is for, one action. Email capture belongs where the visitor has a reason to give an address**, which is after the product has been shown, or on a resource page. **A newsletter field in a SaaS hero competes with signup and wins nothing.**

### What belongs on one and not the other

| SaaS | Consulting |
|---|---|
| Pricing tiers, free tier or trial | Engagement model. A **starting range** is a differentiator, see T-06 |
| Product screenshots, interactive demo | Case studies with client names and outcomes |
| Changelog. Linear, Vercel and Attio all have one | Process page |
| Docs, API reference, status page | Team page with real named people |
| Integrations page | Industries served |
| Security and compliance page | Certifications |
| Login and Sign up in the utility nav | "Hubungi Kami" as the terminal nav item |

**The asymmetry: SaaS proves by letting you try it, consulting proves by showing what it already built.** A consulting site with a "free trial" CTA and a SaaS site whose only CTA is "book a call" are both confused about which they are.

---

## T-04 The pages that must exist

**GATE where marked.** Full legal detail is in `legal-pages-id.md`. This is the placement decision.

| Page | Status | Where it lives |
|---|---|---|
| **Kebijakan Privasi** | **GATE.** UU PDP Pasal 21(1). See P-01 | Footer on every page, plus at every collection point |
| **Syarat & Ketentuan** | **GATE for transactional.** PP 80/2019 Pasal 39(1) and 53(1); the contract must be downloadable under Pasal 56 | Footer, plus linked at checkout |
| **Kontak and address** | **GATE for PMSE.** PP 80/2019 Pasal 9(1) requires a clear legal-subject identity; Pasal 13(1) requires it "benar, jelas, dan jujur" | **Footer on every page and a dedicated page in the main nav** |
| **Layanan pengaduan / support** | **GATE for PMSE.** PP 80/2019 Pasal 27(2) requires complaint address and number, procedure, and follow-up mechanism. **Permendag 31/2023 Pasal 9** requires it "ditampilkan dengan jelas pada laman yang mudah dibaca" with a responsive phone or email | **Main nav or utility nav. Not buried in the footer** |
| Product compliance numbers | GATE for regulated goods. Permendag 31/2023 Pasal 11 | Product page |
| PSE registration number | Where held | Footer |
| Social links | Not required. Commercially useful, because users cross-check off-site | **Footer only. Never in the main nav**, they leak traffic |
| Mobile: privacy policy plus support URL | **GATE.** Apple 1.5 and 5.1.1(i), Google Play | Store listing **and** in-app settings |

### What a good support page contains

**Design it against the real number: Gartner, n = 5,728, December 2023, found only 14% of customer service issues are fully resolved in self-service.** Even for issues customers rate very simple, 36%. **In 43% of failures the customer could not find content relevant to their issue.** Building support as a deflection wall is optimising for the minority case.

**NN/g's hub-and-spoke model**, from eight 90-minute sessions across 23 sites:

- **At most three hubs: Customer Service, FAQ, Contact.** Nothing else.
- **Name it "Bantuan" or "Layanan Pelanggan", not "Help".** Users read "Help" as help with the **website**, not with the company.
- **Every hub links to the other two, and every spoke links back to a hub.** Users who fail once do not return to the footer.

**The spec:**

1. A search box that searches support content only.
2. **The top five to eight actual inbound questions**, harvested from the client's inbox and WhatsApp, **phrased the way customers phrase them**, not the way marketing does.
3. Task spokes: order status, returns, payment problems, account and data deletion.
4. **A visible human escape hatch in the first screenful:** WhatsApp or phone, with stated hours and a response time.
5. Links to the other two hubs.

**On FAQs**, from NN/g's analysis of 22 sites: order by what people most want to know, write questions in **users' search vocabulary**, **answer closed questions with Ya, Tidak or Tergantung first**, provide jump links and expand-all, and never require JavaScript to read the text. **An FAQ hurts when it masks a UI problem or when the questions were invented rather than harvested.**

---

## T-05 Navigation, and the map

**HOUSE.**

**The measured cost of hiding navigation**, NN/g with WhatUsersDo, n = 179 across six live sites:

| | Hidden (hamburger) | Visible or combo |
|---|---|---|
| Desktop navigation use | **27%** | 48 to 50% |
| Desktop task time | **At least 39% slower** | |
| Content discoverability | **Down over 20%** | |
| Mobile navigation use | 57% | **86%** |

**Guidance: "If your site has 4 or fewer top-level navigation links, display them as visible links."** Above four, hide some, but pair the hamburger with a visible partial nav. The combo pattern beat both pure alternatives on mobile.

**The recommended service-business navbar, from the eight-site pattern plus the above:**

> **Work · Layanan · Tentang · Insight · Kontak**

Five items. **Work first, because every strong site in the sample leads with evidence.** Kontak terminal and visually distinct. Careers and legal in the footer.

**On labels:** there is **no controlled study** comparing "Solutions" against a concrete label. The converging indirect evidence is NN/g's mega-menu rule to lead with the information-carrying word, NN/g's finding that "Help" was systematically misread, and the observation that the vaguest navbars belong to the vaguest sites. Suitmedia's nine items include *Expertises*, *Roles* and *Sustainability*. **Report this as our design position, not as research.**

### Google Maps

**The architecture, verified:** the Maps Embed API is an **iframe**, requires an API key, and is free at unlimited usage. **Google publishes no performance characteristics**, and **every page-weight figure in circulation traces to an agency blog with no method, so do not quote one.** Iframe embeds **set cookies**, and the end user's IP and browser data reach Google.

| Option | When |
|---|---|
| **Default: a static map image plus a link out** | One request from your own origin, zero third-party requests, zero cookies, no consent obligation. The click goes where the user wanted, which is directions in their own maps app |
| Click-to-load iframe | If an interactive map is genuinely needed. Ship the static image, load the iframe on click |
| Always-on embed | **Effectively never**, and never in the first screenful of a contact page |

**The Indonesian hook:** UU PDP Pasal 21(1) requires disclosing purpose and third-party recipients before processing. An always-on Google iframe sends every visitor's IP to Google on page load. **Cheaper to avoid than to paper over.**

---

## T-06 Landing page and trust claims that fail

**HOUSE.**

| Claim | Verdict |
|---|---|
| **"Trust seals increase conversion"** | The two most-cited studies **both measured stated preference only, and both say so.** 49% of Baymard's respondents chose "don't know or no preference." **Worse: Baymard found homemade padlock icons with no technical function perform as well as real SSL seals**, and that **visually encapsulating the card fields** drives perceived security more than any badge. If the fake works as well as the real one, you are not measuring trust in the seal |
| **"Everything important must be above the fold"** | NN/g's own eye-tracking went from **80% above the fold in 2010 to 57% in 2018**. 81% is in the first three screenfuls. Design for three, not one |
| **"94% of first impressions are design-related"** | Traces to Sillence et al., CHI 2004: **15 women, aged 41 to 66, evaluating health advice sites**. The 94% is the share of **rejection comments** attributable to design. It is now routinely misattributed to Stanford, which is a different study with different numbers |
| **"You have 50 milliseconds"** | Lindgaard et al. 2006 is real research, but it measured **visual appeal ratings**. Not trust, not credibility, not conversion, not abandonment |
| **"A 1-second delay cuts conversions 7%"** | A 2008 vendor press release. The underlying study is paywalled and its method has never been published. Site speed matters, but cite something readable |
| **"Self-service deflects support load"** | **Only 14% of issues fully resolve in self-service.** Designing support as a deflection wall optimises for the minority |
| **"7 plus or minus 2 nav items"** | Explicitly rejected by NN/g. See U-07 |
| **"Hide pricing to qualify the lead"** | Universal convention, not evidence. NN/g's position is that hiding pricing "makes the organization seem dubious for the simple reason that it is hiding something." **All eight agencies hide it, which makes publishing a starting range a live differentiator** |
| **"Testimonials build trust"** | Two of the most credible engineering consultancies in the world carry **zero** on their homepages. A self-published quote is the weakest proof available. A named client logo, a verifiable certification, or a public rating all outrank it |
| **"Tell your brand story"** | See T-07 |

---

## T-07 Storytelling in B2B, honestly

**HOUSE.** There is real research. **It does not support the claims made for it.**

**O'Keefe and Hoeken 2021**, *Frontiers in Psychology*, a synthesis of meta-analyses across **30 message-design variations**:

| Variation | Effect size, r |
|---|---|
| Sidedness, two-sided vs one-sided | **-0.002** |
| Gain vs loss framing | 0.016 |
| **Narrative vs statistical evidence** | **0.044** |
| Strong vs weak threat appeal | 0.100 |
| **Including vs omitting an explicit conclusion** | **0.102** |
| **Median across all 30** | **0.10** |

Their conclusion, verbatim: *"it doesn't make much difference to persuasiveness which option is chosen"*, and **93% of prediction intervals include both positive and negative values.**

The narrative transportation meta-analysis (287 effect sizes, 199 studies) reports transportation to intentions at rho = .22, but that is **a correlation between how absorbed someone was and how persuaded they were**, not a comparison of narrative against non-narrative. It cannot tell you that writing a story works.

**Zebregs et al. 2015 gives the one practically useful split: statistical evidence has a stronger influence on beliefs and attitudes; narrative has a stronger influence on intentions.**

**So the rule is:**

> **Use numbers for the claim. Use a story for the ask. And state your conclusion explicitly rather than letting the reader infer it**, which is the one message-design variable with a defensible effect, and the opposite of what narrative advice teaches.

A case study is therefore: **named client, named problem, what we built, measured outcome.** The narrative does the framing, the numbers do the persuading. Not a hero's journey.
