# GTX-ENG-001 / C. Copy standard

Tier: **HOUSE**. Applies to everything a client or user reads: UI copy, landing pages, proposals, emails, WhatsApp templates, documentation, commit messages, and pull request descriptions.

Machine-checkable and mostly auto-fixable. CI configuration in `assets/ci/`.

---

## C-01 Zero em dashes

**EN:** No em dashes (—) in any Gatxel copy. Use a comma, a colon, a period, or parentheses.
**ID:** Ganti dengan koma, titik dua, titik, atau tanda kurung. Hampir selalu ada pilihan yang lebih jelas.

```
Salah:  Kami bangun cepat — dan tetap rapi.
Benar:  Kami bangun cepat, dan tetap rapi.
Benar:  Kami bangun cepat. Dan tetap rapi.
```

**One honest caveat, so nobody oversells this rule.** The em dash is no longer the reliable AI tell it was in 2024. The Economist analysed 55,940 sentences in July 2026 and found that only Claude exceeds human em dash rates, while ChatGPT now uses them *less* than humans do, because OpenAI explicitly tuned it down. Measured density per 1,000 words: GPT-4.1 at 10.62, Claude Opus at 9.09, human control at 3.23, but Mark Twain at 10.13 and Melville at 8.12. Presence alone tells you almost nothing.

So why keep the rule? Because it is **house style, not a detector**. It is unambiguous, auto-fixable, costs nothing, and forces a sentence to commit to its own structure. Keep it. Just do not tell a client that removing em dashes makes text "not AI".

**The tells that actually survive are the ones in C-02 through C-06.**

---

## C-02 Banned vocabulary

**EN:** These words do not appear in Gatxel copy. Enforced by Vale.
**ID:** Kalau salah satu kata ini muncul, hampir pasti kalimatnya bisa ditulis ulang lebih jelas dan lebih pendek.

**Verbs:** leverage, harness, navigate, embark, foster, spearhead, unleash, democratize, streamline, empower, supercharge, elevate, unlock, delve, utilize, facilitate, commence.

**Adjectives and nouns:** seamless, robust, comprehensive, sophisticated, salient, paramount, pivotal, crucial, intricate, holistic, cutting-edge, world-class, enterprise-grade, mission-critical, production-ready, game-changing, next-generation, realm, landscape, tapestry, testament, journey (used metaphorically).

**Phrases:** "in today's fast-paced world", "rich tapestry", "intricate interplay", "paradigm shift", "double-edged sword", "stands as a testament", "plays a significant role", "cannot be overstated", "the stakes have never been higher", "at the end of the day", "it's worth noting", "needless to say".

**Marketing headline templates:** "Transform your workflow", "Built for the modern team", "Your all-in-one platform", "Scale without limits", "Elevate your X", "Unlock the power of X", "Seamlessly integrate", "Get started today".

**Indonesian equivalents to avoid:** "solusi terdepan", "revolusioner", "mengubah cara Anda bekerja", "tanpa batas", "one-stop solution", "meningkatkan efisiensi secara signifikan" tanpa angka, "di era digital saat ini".

---

## C-03 Banned constructions

These are structural, and they are the strongest surviving signals.

| Pattern | Example | Fix |
|---|---|---|
| **Antithesis** | "It's not just a tool, it's a partner" | Say the thing. Delete the negated half. **Full family in C-03a** |
| **Stacked negation** | "No setup. No config. No hassle." | One claim, with a number |
| **Verb tricolon** | "We design, we build, we ship" | Two, or a real sentence |
| **Rule of three on autopilot** | Three parallel items in every list | Vary the count. Use two or four when that is the truth |
| **Rhetorical self-answer** | "The result? Faster delivery." | "Delivery got faster." |
| **Mic drop** | "It matters." "Full stop." | Delete |
| **Participial padding** | "...improving efficiency, reflecting broader trends" | End the sentence |
| **Cataphoric forecasting** | "Three pillars support this approach" | Just list them |
| **Label and explain bullets** | "**Speed:** we ship fast" everywhere | Write prose, or use a table |
| **Vague attribution** | "Studies have shown", "Experts agree" | Name the study or delete the claim |
| **Formal transitions** | Furthermore, Moreover, Additionally, What's more | Delete. The paragraph break already did the work |
| **Signposted conclusion** | "In conclusion", "In summary", "To wrap up" | Delete, unless the document is genuinely long enough to need one |
| **Wrap-up headings** | "Final Thoughts", "Key Takeaways", "Putting It All Together" | Delete the section, or give it a real title |
| **Anthropomorphic justification** | "does the heavy lifting", "earns its keep" | Say what it does |
| **Closing pleasantries** | "I hope this helps!" | Delete |

**ALL-CAPS section labels** are a documented tell. Title Case headings are not, so that one is a preference, not evidence.

---

## C-03a The antithesis frame, in full

Broken out because it is the most common single pattern in AI marketing copy, because it survives paraphrase, and because the one regex most teams ship catches about a twentieth of it.

**The mechanism.** Negate a small claim, then reveal a bigger one. It reads as insight and carries none, because **the negated half was never in dispute.** Nobody thought it was just a tool. The sentence manufactures an opponent so it can defeat one.

**The test.** Delete everything before the comma or the full stop. If what remains is a real claim, that was your sentence. If what remains cannot stand up alone, there was never a claim, only a shape.

### Every shape it takes

| Shape | Example |
|---|---|
| Not just X, it's Y | "It's not just a tool, it's a partner" |
| Not merely, simply, only, really | "We're not merely building sites, we're building trust" |
| Not just X **but** Y | "Not just a landing page but a conversion engine" |
| **The two-sentence variant**, now the most common, because writers learned to avoid the comma splice | "This isn't a redesign. It's a rebuild." |
| Not about X, it's about Y | "Security is not just about headers. It's about authorization." |
| More than just | "More than just a dashboard" |
| Less X, more Y | "Less about speed, more about certainty" / "Think less agency, more partner" |
| Goes beyond | "It goes well beyond a simple checklist" |
| The real question isn't | "The real question isn't how fast, it's how safe" |
| Not that X, it's that Y | "It's not that we are cheap, it's that we are fast" |
| Stacked negation into a reveal | "No setup. No config. No hassle. Just results." |
| X is dead, long live Y | "SEO is dead. Long live GEO." |

**Indonesian, same frame:**

| Shape | Example |
|---|---|
| bukan sekadar X, tapi Y | "Kami bukan sekadar vendor, tapi partner jangka panjang" |
| bukan soal X, tapi soal Y | "Ini bukan soal harga, tapi soal kepercayaan" |
| lebih dari sekadar | "Lebih dari sekadar website" |
| Ini bukan X. Ini adalah Y. | "Ini bukan template. Ini adalah sistem." |

### Fixing it

```
Salah:  Kami bukan sekadar vendor, tapi partner jangka panjang.
Benar:  Kami pegang situsnya setelah launch, dengan SLA 24 jam.

Bad:    This isn't a redesign. It's a rebuild.
Good:   We replaced the data layer, not the theme. Nothing from the old
        codebase survives except the content.

Bad:    Security is not just about headers. It's about authorization.
Good:   Headers are the cheap part. Authorization is where breaches
        actually happen, and it is checked in the data access layer.
```

Notice what happens in every fix: **the sentence gets longer and gains a fact.** That is the point. The frame is short because it is empty.

### The one legitimate use

Antithesis is a real rhetorical device and it works when the negated half is **something the reader actually believes right now**. "Blocking GPTBot does not remove you from ChatGPT" is a correct use, because most readers do believe that and are about to act on it. The rule is not "never negate". The rule is: **only negate a belief someone actually holds.**

### Enforcement

`assets/ci/vale/Gatxel/Antithesis.yml` covers all of the above in English and Indonesian, including the two-sentence variant, which needs `scope: raw` because it crosses a sentence boundary. Tested at 19 out of 19 on known slop and 12 out of 12 clean on legitimate technical prose.

---

### Newer tells, catalogued in 2026

These postdate most of the lists circulating and are worth learning, because they survive after people start avoiding the obvious ones.

| Pattern | Example |
|---|---|
| **"Quietly" as a universal intensifier** | "quiet confidence", "quietly growing", "quietly becoming the standard" |
| **Therapist mode** | Unsolicited "You're not alone", "That's completely valid" in a business context |
| **Coaching questions** | "Ready to go deeper?", "What would it look like if..." |
| **Metaphors that almost land** | A comparison that sounds apt but does not actually map onto the thing |
| **Argument teleportation** | Sentence B does not follow from sentence A. The connective tissue was never written |
| **Missing emotional spikes** | Flat affect on a topic that demands a position |
| **Faux balance without consequence** | "On the other hand" is performed, then neither side is weighed |
| **Too-tidy internal callbacks** | Every motif introduced early gets neatly resurrected later |
| **Too clean to be human** | Zero irrelevant detail, every sentence serving the thesis. Real writing has loose ends |
| **Significance amplifiers** | A process change described as a game-changer |
| **Tourism and heritage language** | "nestled in", "vibrant community", "rich heritage" applied to an office |
| **False ranges** | "from innovation to implementation to cultural transformation", where the items are not on a scale |
| **Invented concept labels** | "the supervision paradox", "the acceleration trap" |
| **Unicode decoration** | Arrows in prose, "Input → Processing → Output" |
| **Fractal summaries** | A summary at every level of the document |
| **One-point dilution** | A single idea stretched across a whole piece |

**Curly quotes** in markdown or plain-text source are a paste-from-chatbot artefact. Use straight quotes in source. In rendered product copy, curly is correct typography, so this rule applies to the source file, not the output.

---

## C-04 Rhythm

**EN:** Vary sentence length. Aim for a burstiness ratio (standard deviation of sentence word count divided by the mean) above 0.4.
**ID:** Ciri paling kuat tulisan AI bukan pilihan kata, tapi irama. Semua kalimat sepanjang 18 sampai 24 kata, semua paragraf 3 sampai 5 kalimat. Manusia menulis dengan panjang yang tidak rata.

Human writing sits at 0.6 to 1.2. LLM output sits at 0.2 to 0.4. This is measurable, and none of the standard prose linters check it, so `assets/ci/burstiness.mjs` does.

Practical version: after drafting, read it aloud. If every sentence lands at the same length, break two of them and merge two others.

---

## C-05 Every claim carries weight

**EN:** Every sentence must survive the deletion test. If removing it loses no name, number, date, cause, or trade-off, delete it.
**ID:** Kalau kalimatnya dihapus dan tidak ada informasi yang hilang, memang seharusnya dihapus.

Applied to Gatxel client work specifically:

- No invented metrics. Never write "3x faster" or "40% more efficient" unless we measured it and can show the measurement.
- No claiming a capability we have not built.
- Prices, timelines, and scope in a proposal are commitments. Write them as commitments or do not write them.
- A hedge stack ("this may potentially help improve...") means we do not know. Say we do not know.

---

## C-06 UI copy specifically

**EN:** Error messages say what happened and what to do next. Empty states say what this is, why it is empty, and offer one action. Buttons are verbs. Nothing says "Oops!".
**ID:** Pesan error yang paling buruk adalah yang sopan tapi tidak berguna. "Terjadi kesalahan" tanpa langkah berikutnya membuat pengguna berhenti.

| Bad | Good |
|---|---|
| "Oops! Something went wrong." | "Pembayaran gagal diproses. Coba lagi, atau gunakan metode lain." |
| "Error 500" | "Kami sedang bermasalah di sisi kami. Kode: `01J9X4`. Kirim kode ini kalau menghubungi kami." |
| "Invalid input" | "Nomor HP harus diawali 08 atau +62." |
| "Submit" | "Kirim pendaftaran" |
| "No data" | "Belum ada transaksi. Transaksi pertama akan muncul di sini setelah pelanggan bayar." |

Language policy per project: pick Indonesian or English for the interface and stay consistent. Mixed-language UI ("Submit pendaftaran Anda") is the most common polish failure in Indonesian products. Set `<html lang="id">` to match, which is both an SEO and a WCAG 3.1.1 requirement.

---

## C-07 Commit messages and pull requests

**EN:** No emoji prefixes, no "Generated with" attribution lines, no "All 47 tests passing", no marketing adjectives.
**ID:** Riwayat git itu dokumen teknis, bukan pengumuman.

```
Bad:   ✨ feat: add comprehensive robust error handling for production-ready auth
Good:  auth: return 403 instead of 500 when session is valid but role is insufficient
```

---

## Enforcement

Off-the-shelf tooling covers most of this. Wire it into CI:

| Tool | Covers |
|---|---|
| `vale` plus [`tbhb/vale-ai-tells`](https://github.com/tbhb/vale-ai-tells) | 76 rules covering C-02 and C-03, plus a 13-rule commit message pack. Best in class |
| Vale `Vocab` `reject.txt` | The Gatxel-specific banned list, one regex per line, zero code |
| [`nordscope-fi/plain-english`](https://github.com/nordscope-fi/plain-english) | Sentence shapes with a semantic layer that downgrades legitimate technical usage. Has a GitHub Action and lints PR bodies |
| [`eslint-plugin-no-comment-slop`](https://github.com/jantimon/eslint-plugin-no-comment-slop) | AI slop in code comments, several rules auto-fixable |
| `assets/ci/burstiness.mjs` | C-04, which no existing linter checks |

Run Vale and plain-english on `**/*.md` and on PR bodies. Start every rule at warning level for two weeks, then promote to error, so the first run does not block every merge.

---

## Note on existing Gatxel documents

The current Gatxel Team Charter, the Pandumedia briefs, and the strategy documents in the project all use em dashes heavily. They predate this standard. Bring them into line at the next revision of each document rather than doing a bulk rewrite, since a bulk find-and-replace across formal documents will produce comma splices.

---

## C-08 Ads and hooks: what is legally required, what platforms mandate, and what is evidenced

**HOUSE for craft, GATE for the legal items.** Read this before writing a single ad.

### The line that changes everything

**UU 8/1999 Pasal 20: "Pelaku usaha periklanan bertanggung jawab atas iklan yang diproduksi dan segala akibat yang ditimbulkan oleh iklan tersebut."**

**The producer of the advertisement is liable for it and for its consequences. That is Gatxel, not only the client.** This turns ad copy from a style question into a liability question, and it makes a **claims evidence file a named deliverable on every campaign**: one line per claim, with the document or measurement that supports it, held in the project folder.

### Tier 1: required by Indonesian law. Not negotiable.

| Rule | Source |
|---|---|
| No superlative (**paling, nomor satu, ter-**, or any equivalent) without documented proof **held on file** | EPI Bab III A.1.2.2; UU 8/1999 Pasal 9 forbids "kata-kata yang berlebihan" |
| No **"satu-satunya"** unless the specific respect is named and evidenced | EPI 1.4 |
| **A testimonial must be genuinely experienced and provable by a signed written statement** | EPI 1.17. See O-02 |
| Endorsers must be competent in what they endorse | EPI 1.18 |
| Comparisons: technical aspects only, identical criteria, disclosed methodology | EPI 1.19 |
| **No fear-mongering.** "Iklan tidak boleh menimbulkan atau mempermainkan rasa takut" | EPI 1.9 |
| No exploiting a person or event without consent | UU 8/1999 Pasal 17(1)(e), **5 years or Rp 2 billion** |
| Disclose usage risk where applicable | Pasal 17(1)(d) |
| Refund promises stated clearly and completely | EPI 1.8 |

Note the structure: **Pasal 17(1)(f) criminalises breach of advertising ethics, and Pasal 62(2) attaches a penalty.** So EPI, which is formally voluntary self-regulation, is **imported into criminal law by reference.**

**Financial clients (OJK).** Every offer, promotion or ad must carry the PUJK name or logo **and** the statement that the PUJK is "berizin dan diawasi oleh Otoritas Jasa Keuangan" (POJK 6/POJK.07/2022 Pasal 21). Pasal 22 prohibits offering products by "menyalahgunakan keadaan atau kondisi calon Konsumen", which is Indonesia's own version of Meta's personal-attributes rule, and it is law rather than policy. **POJK 6/2026**, 24 June 2026, adds finfluencer rules: licensing where required, disclosure of "kepentingan ekonomis", no guaranteed-return claims, risk disclaimers, and OJK can order takedown.

**Health clients (BPOM).** For obat tradisional and suplemen kesehatan: **testimonials prohibited outright**, before-and-after images prohibited, outcome guarantees prohibited, exploiting health anxiety prohibited, and ads require registration through SIREKA.

### Tier 2: platform-mandated. Breach means rejection.

**Google Ads Misrepresentation policy** explicitly prohibits **"clickbait tactics or sensationalist text or imagery to drive traffic"**, **"claims that entice the user with an improbable result (even if this result is possible) as the likely outcome"**, and exploiting **"negative life events such as death, accidents, illness, arrests or bankruptcy to induce fear, guilt or other strong negative emotions."**

Read that against the standard hook list. It bans, by name: **curiosity-gap clickbait, fear-based "harsh truth" hooks, and result-tease with improbable outcomes.**

**Google Responsive Search Ads:** 3 to 15 headlines at **30 characters**, 2 to 4 descriptions at **90 characters**. Pin sparingly. **Legally required text must be pinned to Headline 1, Headline 2 or Description 1** to be guaranteed to appear. **Ad Strength is not used in Ad Rank** — it is guidance, not an auction input, so optimising copy for it buys no reach.

**Meta personal attributes.** Ads must not assert or imply knowledge of a protected attribute: health condition, financial status, disability, race, religion, age, sexual orientation, criminal record. **The precise rule matters:** it is not a ban on second-person address. "Are you struggling with slow internet?" is fine. **"Are you struggling with depression?", "Drowning in debt?"** imply a protected attribute and are non-compliant. The compliant reframe is **to describe the service, not the viewer**: "Konseling untuk depresi", not "Atasi depresi Anda".

**Meta health and wellness:** no before-and-after images, no unlikely results, and nothing that generates **negative self-perception** to sell a diet or health product.

**TikTok:** 9:16, at least 720p, **5 to 10 words per second** of on-screen text, value proposition in the first 3 seconds, hook by 6 seconds, 3 to 5 differentiated creatives per ad group.

### Tier 3: genuinely evidenced, with the ceiling stated

There is real research here, from very large A/B corpora. **State its limits every time you use it.**

- **Negative-valence wording beats positive in headline click-through.** Robertson et al., *Nature Human Behaviour*, 22,743 randomised tests, 53,699 variants, 205M impressions: each negative word **+2.3%**, each positive word **−1.0%**. But the effect is carried by **sadness**, not fear or anger. Fear was **negative**. Anger was null.
- **Concreteness has an optimum, not a direction.** Aubin Le Quéré and Matias, *Scientific Reports*, 8,977 A/B tests: in low-concreteness sets more concreteness gave **+5.5%**; in already-concrete sets it gave **−9.9%**.
- **Person reference:** first-person singular and third-person singular help. **"We" hurts.** **"You" is unproven** (β=0.05, p=0.044, failed threshold). Gligorić et al., *PLOS ONE*, registered report, 24,333 headline pairs.
- **The ceiling, and it must be in every deck that quotes the above:** the best published linguistic model picks the winning headline **54.4% of the time against a 50% baseline.** No formula substitutes for testing.
- **Mandatory caveat:** all of this comes from one US publisher, 2013 to 2015, viral news on Facebook, measuring **click-through only**. Not conversion, not paid social, not Indonesian. Import as hypotheses to test, never as rules.

### The strike list

| Claim | Verdict |
|---|---|
| "You have 3 seconds to stop the scroll" | No study says 3 seconds. Traces to a vendor study of **80 ads**. Measured reality: recall at 0.25s, ~1.5s to encode, and 85% of digital ads get under 2.5s. **TikTok's own documentation says the hook belongs in the first 6 seconds.** Meta's "3-second video play" is a **billing threshold**, not an attention finding |
| "8-second attention span, worse than a goldfish" | **Fabricated.** Traced from a 2015 Microsoft Canada report to Statistic Brain, whose cited institutions could not verify it and who never responded to the BBC. The real underlying study measured webpage dwell time and never mentions goldfish |
| "Curiosity gap hooks outperform" | 8,977 A/B tests: the effect is curvilinear, and more concreteness **hurts by 9.9%** in already-concrete sets. Neither style universally wins |
| "Loewenstein proved curiosity gaps work" | Loewenstein 1994 is a theoretical review of curiosity with **no advertising or click data**. Citation laundering |
| "Pattern interrupt" | Term imported from NLP, which is classified as pseudoscience. No ad-copy evidence exists |
| "Fear and harsh-truth hooks drive action" | Fear words measured **negative** on click-through. Also banned by Google (exploiting fear) and **EPI 1.9** |
| "Open with a question, speak to 'you'" | Second-person pronouns **did not significantly predict** click-through. "We" was significantly negative |
| "Positive, uplifting hooks win" | Positive emotion words null to negative, **−1.0% per word** |
| "Before and after is the strongest proof" | Prohibited by Meta's health policy and by **BPOM** for health products |
| "Maximise Ad Strength to win the auction" | **Google states Ad Strength is not used in Ad Rank** |
| "Tool X writes better hooks than tool Y" | No comparative evaluation with a methodology exists anywhere. Every source is a listicle or affiliate page |
| Superlatives grab attention (terbaik, nomor 1) | **EPI 1.2.2** forbids them without proof on file, **UU 8/1999 Pasal 9** forbids "kata-kata yang berlebihan", and Google forbids improbable-result claims |

**The single highest-risk pattern in circulating advice is the problem call-out hook.** It is simultaneously restricted by Meta (protected attributes), Google (exploiting negative life events), OJK Pasal 22 (exploiting the prospect's condition) and EPI 1.9 (fear), while the evidence that second-person address works at all is null.
