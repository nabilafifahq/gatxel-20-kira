# Legal pages, Indonesian law

**Tier: GATE.** Every Gatxel project that has users ships a Privacy Notice and Terms, as **two separate pages**, in **Bahasa Indonesia**.

Almost every English-language guide on this topic is written for US or EU law. Applied to an Indonesian client it produces documents that are simultaneously over-engineered and legally void. This file is the Indonesian position.

---

## P-01 The framing everyone gets wrong

**GATE.**

**UU PDP does not mandate a document called "Kebijakan Privasi."** It mandates a **notice**. The distinction matters when you talk to a client.

- **Pasal 21(1)** requires, before consent-based processing: the legal basis, the purpose, the types of data and their relevance, **the retention period**, the detail of information collected, the duration of processing, and the data subject's rights.
- **Pasal 21(2)** requires the controller to notify the subject **before** any change to that information takes effect. That is a statutory versioning obligation, not best practice.
- **Pasal 5** and **Pasal 16(2)** require information about controller identity, legal basis, purpose and accountability **regardless of which lawful basis applies**.

So a published notice is the only realistic way to discharge Pasal 5, 16(2) and 21 at scale. **The page is instrumentally required, not nominally required.** Say it that way to a client and you are correct; say "the law requires a privacy policy page" and you are not.

**Terms of Service is a different instrument with a different statutory hook.** **UU ITE Pasal 9**: "Pelaku usaha yang menawarkan produk melalui Sistem Elektronik harus menyediakan informasi yang lengkap dan benar berkaitan dengan syarat kontrak, produsen, dan produk yang ditawarkan." That is the statutory basis for terms on any commercial site.

**Keep them separate.** A privacy notice folded into terms fails on two counts: it is harder to satisfy Pasal 21's specific disclosure list, and **Pasal 23 UU PDP voids any contract clause requesting personal data processing that does not carry valid explicit consent**. Bundling data consent into an "I agree to the Terms" checkbox is the exact thing Pasal 23 kills.

---

## P-02 Bahasa Indonesia is not optional

**GATE. This is the rule most likely to void a client's terms outright.**

- **UU 24/2009 Pasal 31(1):** Indonesian is **wajib** for any agreement involving Indonesian parties. Pasal 31(2): where a foreign party is involved, the agreement is **also** written in their language and/or English.
- **Perpres 63/2019:** the foreign-language version functions as an equivalent translation, and the parties may agree which text prevails. **A bilingual document is correct practice. A foreign-language-only document is not.**
- **The case: Putusan MA No. 601 K/Pdt/2015**, *Nine AM Ltd v PT Bangun Karya Pratama Lestari*. An English-only loan agreement under Indonesian law was held to have an unlawful cause under Pasal 1335 and 1337 KUHPerdata and declared **null and void from the outset**, upheld through cassation. The parties' express agreement to use English did not save it. Note the asymmetry: **the Indonesian party can invoke its own non-compliance to escape the contract.**
- For consumer sites there are two further rules that leave no argument at all: **PP 71/2019 Pasal 47(1)** and **PP 80/2019 Pasal 55** both require electronic contracts directed at Indonesian residents and consumers to be in Bahasa Indonesia.

**Gatxel rule:** Bahasa Indonesia is the authoritative version and the document says so. English is a convenience translation. Never ship Indonesian consumer terms in English only, including the link labels: "Kebijakan Privasi" and "Syarat & Ketentuan", not "Privacy Policy" and "Terms".

---

## P-03 Clauses that are void, and what to write instead

**GATE.** **UU 8/1999 Pasal 18** lists prohibited standard clauses. **Pasal 18(3) makes them batal demi hukum, void by operation of law**, and **Pasal 62(1) attaches up to 5 years or Rp 2 billion.** These are not unenforceable terms. They are a criminal exposure.

The standard US SaaS trio maps one to one onto three of them:

| Copied clause | Void under | Write instead |
|---|---|---|
| Blanket limitation or exclusion of liability | **18(1)(a)** pengalihan tanggung jawab | Define the **scope of the service** precisely. You may limit what you promised. You may not disclaim liability for what you did promise |
| "All sales final. No refunds." | **18(1)(b) and (c)** | State the remedy and its route. See P-05 |
| "We may modify these Terms at any time." | **18(1)(g)** unilateral change during service | **Prior notice**, an effective date, and a real right for the user to decline and terminate |
| "The user shall indemnify us" | **18(1)(a)** in a consumer contract | Fine in B2B. Delete from consumer terms |
| "The consumer bears the burden of proving the defect" | **18(1)(e)** | Delete |
| Class action waiver, mandatory individual arbitration | Conflicts with **UU 8/1999 Pasal 45 to 46**, which make BPSK and class actions available | Name BPSK and the Indonesian courts as available routes |
| Delaware or Singapore law and forum, for an Indonesian seller and Indonesian buyers | Nothing international about the transaction; UU 8/1999 is mandatory law | Indonesian law, Indonesian forum |

**Pasal 18(2) is a design rule with legal force.** It prohibits standard clauses whose **location or form makes them hard to see, not clearly legible, or hard to understand.** A 10px grey footer link to a wall of unstyled text is a Pasal 18(2) exposure, and 18(3) voids the affected clauses. **Legal pages are subject to the same typography and contrast rules as the rest of the site.** That is not a courtesy, it is the statute.

---

## P-04 What each document must contain

**GATE.** Legend: **[ID]** required by Indonesian law, **[EU/US]** only if serving those users, **[BP]** best practice.

### Kebijakan Privasi

1. **[ID]** Controller identity: full PT name, NIB, registered address, email, phone. Pasal 5 UU PDP, UU ITE Pasal 9, PP 80/2019 Pasal 9(1) and 13(1)
2. **[ID]** The lawful basis for **each** purpose, named against **Pasal 20(2)(a) to (f)**. There is no hierarchy and consent is not the default
3. **[ID]** The purpose of each activity, specific. "To improve our services" does not satisfy Pasal 21(1)(b)
4. **[ID]** Categories of data and their **relevance** to the purpose. Pasal 21(1)(c)
5. **[ID]** **Retention period in time units.** "As long as necessary" fails Pasal 21(1)(d). Write "36 bulan sejak transaksi terakhir"
6. **[ID]** What is actually collected, including automatically: IP, device, cookies. Pasal 21(1)(e)
7. **[ID]** **All nine rights** with the Pasal 14 request mechanism, a working channel, and an SLA. Pasal 5 to 13
8. **[ID]** Third party recipients: processors, payment gateway, analytics, hosting. Pasal 5, 16(2)
9. **[ID]** **Cross-border transfer disclosure** and which Pasal 56 route applies. Every Vercel, Supabase, GA4 and Meta Pixel deployment is a Pasal 56 transfer. **Putusan MK No. 137/PUU-XXIII/2025, 19 January 2026**, rejected a constitutional challenge to Pasal 56, so controllers self-assess adequacy
10. **[ID]** Consent withdrawal mechanism with the **3x24 jam** stop commitment. Pasal 9, Pasal 40
11. **[ID]** Security measures in general terms. Pasal 35
12. **[ID]** Breach notification commitment: **3x24 jam** to the subject and the authority, with the Pasal 46(2) content
13. **[ID]** Children: minimum age and parental consent. Pasal 25 UU PDP, UU ITE Pasal 16A, PP 17/2025. **Note "anak" in Indonesia is under 18**, not the US COPPA 13
14. **[ID]** DPO contact where Pasal 53 triggers. See P-07
15. **[ID]** Automated decision-making and profiling, with the Pasal 10 objection route
16. **[ID]** Version number, effective date, and **prior** notification of material change. Pasal 21(2) says *before*, not "check this page"
17. **[BP]** Cookie table: name, purpose, category, lifetime, first or third party. Hard requirement only under GDPR
18. **[EU/US]** GDPR legal basis table, EU representative, "Do Not Sell or Share." **Do not paste CCPA language into an Indonesia-only site.** It signals a copied template

### Syarat & Ketentuan

1. **[ID]** Full seller identity: PT name, NIB, address, email, phone. UU ITE Pasal 9, PP 80/2019 Pasal 9(1) and 13(1)
2. **[ID]** Complete, true description of the goods or services with specification
3. **[ID]** Price, all fees, taxes, currency, and the total payable stated **before** commitment
4. **[ID]** Payment terms and methods
5. **[ID]** Delivery procedure and timeframe
6. **[ID]** **Return or exchange procedure, minimum 2 working days** for the PP 80/2019 Pasal 69(2) triggers: not as ordered, late, hidden defect, damaged, expired
7. **[ID]** Cancellation procedure
8. **[ID]** Refund route consistent with **UU 8/1999 Pasal 19: compensation within 7 days of the transaction date**
9. **[ID]** **Consumer complaint channel**, displayed clearly, with contact, procedure, escalation and a stated response time. PP 80/2019 Pasal 27, Permendag 31/2023 Pasal 9
10. **[ID]** How the contract forms: what act constitutes acceptance. UU ITE Pasal 18(1)
11. **[ID]** Dispute resolution naming **BPSK** and the Indonesian courts. UU 8/1999 Pasal 45
12. **[ID]** Minimum age, child user verification, and a misuse reporting mechanism. **UU ITE Pasal 16A**, added by UU 1/2024
13. **[ID]** Content report and takedown mechanism, for any user-generated content. See P-06
14. **[BP]** Acceptable use, prohibited conduct, account suspension grounds, IP ownership, force majeure, severability
15. **[ID]** Version, effective date, and **prior notice of change with a right to decline**. Pasal 18(1)(g) makes silent unilateral change void
16. **[ID]** Bahasa Indonesia text stated as prevailing

---

## P-05 Payments, refunds and the cooling-off myth

**GATE.**

- **Refunds are mandatory.** UU 8/1999 Pasal 19: compensation for loss, as refund, equivalent replacement, or care, **provided within 7 days of the transaction date**. Pasal 19(5) excuses the business only if it proves consumer fault.
- **Exchange window: at least 2 working days** under PP 80/2019 Pasal 69, for the defect triggers. This is a defect right, not a change-of-mind right.
- **There is no Indonesian cooling-off period.** No general 14-day withdrawal right exists. **Do not import one.** Once written into terms it binds contractually even though no law requires it.
- **You cannot push liability to the gateway.** Money debited with no delivery is Pasal 19, refund within 7 days. Pasal 18(1)(a) voids any clause transferring your liability to a third party as against the consumer. Recourse against the gateway is a separate B2B matter and belongs in the gateway contract, not the consumer terms.
- **Never charge the consumer a chargeback fee** or make them waive chargeback rights. Both read as Pasal 18(1)(a) or (f).

**Digital goods and game top-up.** Instant virtual currency has no physical return, but "semua pembelian bersifat final dan tidak dapat dikembalikan" is **void under Pasal 18(1)(b) and (c)** because it excludes the defect case too. Draft it as **scope of remedy, not exclusion of remedy**:

> State clearly **before purchase** that delivery is instant and irreversible once successfully credited. That disclosure is what makes non-return reasonable, and it is required anyway by UU ITE Pasal 9 and Pasal 4(c) UU 8/1999. Then provide a real remedy with a stated SLA for **failed or mis-credited** top-ups: wrong game ID, credit not delivered, double charge.

---

## P-06 The special cases in our own portfolio

**GATE.**

### A site collecting NIK and KK for SIM registration

**The rule changed this year. Permen Komdigi No. 7 Tahun 2026**, enacted 19 January 2026 with a six-month transition, fully effective around July 2026. It replaced the Permenkominfo 5/2021 registration articles.

- WNI registration now requires **MSISDN + NIK + facial biometric**. **NIK and KK alone are no longer sufficient for new registrations.**
- Operators must validate against Dukcapil, hold **ISO 27001**, meet **ISO/IEC 30107-3** for presentation attack detection, and report quarterly.
- **Maximum 3 prepaid numbers per identity per operator.**
- The distribution chain must keep SIMs inactive until the customer registers. Komdigi has already warned two major operators over NIK-and-KK-only registration during rollout.

**Consent is the wrong lawful basis here, and using it creates a trap.** The duty is imposed by regulation, so the basis is **Pasal 20(2)(c), pemenuhan kewajiban hukum**, with 20(2)(b) for the subscription contract. If you build a consent checkbox as the basis, **Pasal 9** lets the customer withdraw it and **Pasal 40** forces you to stop within 3x24 jam, which you cannot lawfully do because the registration data must be retained. Use consent **only** for genuinely optional extras like marketing, separately toggleable per Pasal 22(2).

**Biometric data is "specific" personal data under Pasal 4(2)(b)**, which triggers:
- **DPIA mandatory**, Pasal 34(2)(b) and (c)
- **DPO mandatory**, Pasal 53(c), large-scale processing of specific personal data
- The highest tier of Pasal 35 security

If the client is a retailer registering on behalf of a telco, it is a **Prosesor**, and the operator is the **Pengendali**. Paper it: instruction-only processing, no independent use, no local copies. **The moment the retailer keeps its own customer database for its own marketing, it becomes a controller for that purpose** and picks up the whole Pasal 20 to 46 stack.

Also note **NIK carries an Adminduk law layer** on top of UU PDP, under UU 23/2006 as amended by UU 24/2013. Get the exact Pasal numbers from counsel before citing them.

### Game top-up, and the child dimension

This is now a live obligation, not an afterthought.

- **UU ITE Pasal 16A**, added by UU 1/2024: publish the **minimum age**, operate a **child user verification mechanism**, and provide a **misuse reporting mechanism**. Sanctions escalate to access termination.
- **PP 17/2025**, signed 28 March 2025, applies to any PSE whose product has child indicators such as a predominantly young user base. **Explicit child targeting is not required**, which catches game top-up squarely. It requires a self-assessment risk classification, age tiers (3 to 5, 6 to 9, 10 to 12, 13 to 15, 16 to 17), **parental consent**, high-privacy defaults, a DPIA, a bar on profiling and targeted advertising to children, and **no deceptive design patterns**.
- Confirm the exact PP 17/2025 compliance date with counsel. Signed March 2025, commentary indicates implementation from March 2026. **Treat the obligations as live now.**

### User-generated content

**The Indonesian safe harbour is a circular, not a statute.** SE Menkominfo No. 5 Tahun 2016 is administrative guidance. Tell clients that plainly rather than selling it as a DMCA equivalent. To come within it the platform must publish terms in-product, provide a reporting facility, follow up complaints, observe removal timeframes, and actively supervise.

**The binding obligations are elsewhere and have clocks:** Permenkominfo 5/2020 as amended by 10/2021 requires takedown within **1x24 jam** of a government request, and **4 jam** for urgent categories including terrorism and child sexual abuse material. **Build the clock into the product**, as a moderation queue with timers and a logged takedown trail, not into the policy document.

---

## P-07 PSE registration, cookies, and the DPO

**GATE.**

**PSE registration (TDPSE).** PP 71/2019 Pasal 6: register **before the system is used by users**. Get the NIB first, then register at oss.go.id. Websites and mobile apps register separately. Penalty escalates from written warning to **pemutusan akses**, and Komdigi enforces publicly in batches.

| Project | Register? |
|---|---|
| Brochure landing page, no forms | No |
| Landing page with a contact or lead form | **Grey, likely yes.** Limb (f) turns on processing personal data for operational activity serving the public. Register if the client is risk-averse |
| Ecommerce | **Yes** |
| SIM or perdana retailer | **Yes** |
| Game top-up | **Yes** |
| Internal tool, no public users | No |

Trap: **Permenkomdigi 5/2025 covers PSE Lingkup Publik**, government systems only. It does not replace Permenkominfo 5/2020 for private operators. Several Indonesian advisories conflate them.

**Cookies.** There is **no cookie-specific regulation in Indonesia**, and no ePrivacy analogue. But UU ITE Pasal 26(1) requires consent for use of personal data by electronic means, and UU PDP Pasal 4 treats an IP address as general personal data. So:

- A site running **only essential cookies** (session, auth, CSRF, cart) needs **no banner**. Those sit under Pasal 20(2)(b), contract performance. Running a banner anyway is theatre, and if it says "by continuing you consent" it is a false statement about a legal basis.
- A site running **GA4, Meta Pixel, TikTok Pixel or Hotjar** needs **prior, granular, refusable opt-in**, with the tags **not firing before consent**, and the consent **logged**, because Pasal 24 puts the burden of proving consent on the controller.
- **The common Indonesian failure is a decorative banner**: the tags fire on page load regardless and nothing is recorded. That fails Pasal 22 and 24 more clearly than having no banner at all.

No Indonesian regulator has ruled on cookies and there is no enforcement precedent. This is the majority practitioner reading, not settled law. Say so to clients.

**DPO, Pasal 53.** Mandatory where processing is for public service, or the core activity requires **regular and systematic large-scale monitoring**, or the core activity is **large-scale processing of specific personal data**. No registration of the DPO with any authority is required.

| Project | DPO? |
|---|---|
| Landing pages, brochure sites, internal tools | No |
| Ordinary ecommerce | Usually no |
| Game top-up with behavioural tracking and children in the user base | Likely yes, 53(b) |
| **SIM or perdana with NIK, KK and biometrics** | **Yes, 53(c), clearly** |

**Status check, and say this to any client who is stalling.** The Pasal 74 transition **expired 17 October 2024**. There is no grace period. The implementing PP has **not** been enacted and the Pasal 58 supervisory body **does not yet exist** as of August 2026. **None of that suspends the obligations, and the criminal provisions in Pasal 67 to 69 do not need an authority to bite.** Komdigi's Ditjen Pengawasan Ruang Digital is the interim enforcer, with OJK for financial and BSSN for cyber incidents.

---

## P-08 The strike list

**Delete these from any Indonesian client's legal pages.**

| Item | Why |
|---|---|
| "We may modify these Terms at any time without notice" | **Void**, Pasal 18(1)(g). Replace with prior notice plus a right to decline |
| "All sales are final, no refunds" | **Void**, Pasal 18(1)(b) and (c), and Pasal 19 requires compensation within 7 days |
| Blanket limitation of liability | **Void**, Pasal 18(1)(a) |
| "You have 14 days to cancel for any reason" | No Indonesian law requires it. Once written, it binds you |
| CCPA "Do Not Sell My Personal Information" on an Indonesia-only site | Signals a copied template. Not applicable |
| Governing law: Delaware or Singapore, for an Indonesian seller and Indonesian buyers | Inert at best. UU 8/1999 is mandatory law |
| One combined "Terms and Privacy Policy" page | **Pasal 23** voids bundled data-processing consent, and Pasal 21's disclosure list is harder to satisfy |
| A consent checkbox as the lawful basis for NIK and KK in SIM registration | Creates a withdrawal right you cannot honour. The basis is legal obligation |
| Pre-ticked consent boxes, or "by continuing you agree" | Pasal 22 requires explicit consent, and Pasal 24 requires you to prove it |
| "You must be 13 or older" | Indonesian "anak" is **under 18** |
| A cookie banner on a site with only essential cookies | No basis needed, and the banner misstates the law |
| A cookie banner where the tags fire before consent | Worse than no banner. Fails Pasal 22 and 24 |
| Browsewrap: "by using this site you agree" in the footer | Fails the notice limb of Pasal 1320 and collides with Pasal 18(2). Use an unticked checkbox and log user ID, timestamp, IP and terms version |
| Legal pages in English only | **Putusan MA No. 601 K/Pdt/2015.** Null and void from the outset |
| Legal pages set in small grey type | **Pasal 18(2)** voids clauses that are hard to see or read. Same contrast and size rules as the rest of the site |
