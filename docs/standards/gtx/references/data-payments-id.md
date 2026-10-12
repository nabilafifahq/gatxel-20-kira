# GTX-ENG-001 / B. Personal data and payments, Indonesia

Every rule here is **GATE**.

This is engineering guidance, not legal advice. The framework is actively moving: two Constitutional Court decisions changed it in 2025 and 2026, the implementing regulation still has not been issued, and an amendment to UU PDP sits in the 2026 Prolegnas. Before any telco engagement handling NIK or KK at scale, have an Indonesian privacy lawyer review the DPA.

---

## 1. Where the law actually stands, August 2026

| Item | Status |
|---|---|
| UU No. 27 Tahun 2022 (UU PDP) | In force. Transition period **expired 17 October 2024** |
| Implementing regulation (RPP PDP) | **Not issued as of February 2026**, awaiting presidential signature. No source found covering February to August 2026, so **re-check before relying on this** |
| Lembaga PDP (the supervisory authority) | **Not established as of February 2026.** Roughly two years overdue. Komdigi has said it targets completion during 2026 |
| Interim supervisor | Kemkomdigi, Ditjen Pengawasan Ruang Digital |
| Administrative fines issued so far | **None.** No agency exists to issue them |
| Criminal enforcement | **Active.** First conviction March 2023: 4 years imprisonment plus Rp 1 billion |

**This is the part people misread.** The absence of the agency does not mean the absence of risk. The criminal provisions in Pasal 65 to 70 do not need the agency. Police and prosecutors can act today, they reach individuals as well as companies, and there has already been a conviction. Unlawfully obtaining another person's data carries up to 5 years and Rp 5 billion. Falsifying personal data carries up to 6 years and Rp 6 billion. **Pasal 70: corporate fines up to 10 times the maximum, so up to Rp 60 billion**, plus possible licence revocation or dissolution.

Administrative fine cap, once the agency exists: Pasal 57(3) sets **2% of annual revenue or annual receipts**, and the statute scopes it "terhadap variabel pelanggaran", meaning **against the revenue attributable to the violating variable, not 2% of the company's total turnover**. The calculation method is exactly the sort of thing the missing implementing regulation was meant to specify, so do not quote a flat 2% of revenue to a client.

*Note: DLA Piper's country page states criminal fines of Rp 200 to 500 million. That contradicts the statute text and every other source. Use the billion-rupiah figures.*

**Two Constitutional Court decisions that changed the operating rules:**

- **MK 151/PUU-XXII/2024 (30 July 2025).** The word "dan" in Pasal 53(1)(b) is unconstitutional. The three DPO triggers are now **alternative, not cumulative**. Any single trigger creates the obligation. The old cumulative reading is what let small studios out. It no longer does.
- **MK 137/PUU-XXIII/2025 (19 January 2026).** The challenge to Pasal 56 on cross-border transfer was rejected in full. The three-tier hierarchy stands, and adequacy determinations belong to the authority that does not yet exist.

---

## 2. NIK and KK: the classification, and why we ignore it

**NIK is legally *data umum*, not *data spesifik*.** It does not appear in the Pasal 4(2) closed list (health, biometric, genetic, criminal records, children's data, personal financial data). It falls under Pasal 4(3) as data combined to identify a person. Some Indonesian consultancy blogs claim NIK is spesifik via UU Adminduk. That claim does not hold: Pasal 84(1) UU 24/2013 defines the protected subset narrowly as physical or mental disability, fingerprints, iris, signature, and other elements constituting a person's *aib*. NIK and KK are Data Kependudukan, not that subset.

**Build to the spesifik standard anyway.** Three concrete reasons:

1. **A KK contains children's data.** Children's data *is* data spesifik under Pasal 4(2)(e). If we ingest a KK, we are processing data spesifik, full stop, and that pulls in the DPO trigger in Pasal 53(1)(c).
2. Pasal 4(2)(g) is an open catch-all. The pending RPP could reclassify NIK at any time.
3. NIK is the single highest-value identifier in Indonesia for account takeover and identity fraud. **The legal classification is not the risk classification.**

---

## 3. Gatxel is usually the Prosesor, and that has one sharp edge

- **Pengendali** decides why data is collected and controls the processing. For client work, that is the client.
- **Prosesor** processes on the controller's behalf. That is normally Gatxel.

**Pasal 51 is the line that matters most to a dev studio.** A processor must process *only* on the controller's instructions. **If we process beyond those instructions, liability shifts onto Gatxel and we are treated as a controller for that processing.**

In practice that means these are not sloppiness, they are liability transfers:

- Pulling a production database dump to a laptop to debug
- Using real NIK or KK data in staging or test
- Sending a production stack trace containing personal data to a foreign error tracker
- Feeding real customer records to an LLM API

Gatxel *is* the Pengendali for its own data: staff records, leads, the CRM. If we ever operate a product as SaaS for multiple clients and decide retention and architecture ourselves, we are likely a joint controller.

**Every client engagement needs a written DPA** covering processing scope, methods, duration, supervision, sub-processors, security measures, breach notification SLA, return or deletion at termination, and audit rights. **Vercel, AWS, Midtrans, Sentry, and any LLM API are sub-processors and must be named.**

---

## 4. Lawful basis: do not default to consent

Pasal 20(2) gives six bases. Consent is only one, and it is the most fragile because it is withdrawable under Pasal 9.

**For SIM registration, use legal obligation (Pasal 20(2)(c)), not consent.** The telco's collection of NIK and KK is mandated by the prepaid registration rules. If we build the flow on consent and someone withdraws it, we cannot honour the withdrawal without breaching a regulatory retention duty, and we have designed ourselves into a contradiction.

Use consent for what is genuinely optional: marketing, analytics, and cross-border transfer.

**Consent requirements (Pasal 21 to 24):**

- Pasal 21: before consent, disclose the lawful basis, purpose, data types, **retention period**, what is collected, and the subject's rights. Retention has to be decided **before we build**, because we have to display it at collection.
- Pasal 22: consent must be written or recorded, electronic or not.
- Pasal 23: **any contract clause requesting processing without valid explicit consent is null and void by law.** Bundled consent buried in T&Cs is worthless.
- Pasal 24: we must be able to **produce proof** of the consent given.

Engineering translation: **consent is an append-only table, never a boolean column.** Store subject ID, purpose, the hash or version of the notice actually shown, timestamp, channel, IP and user agent, and the withdrawal event. Never `UPDATE` a consent row. One checkbox per purpose, no pre-ticked boxes, no bundling.

And withdrawal must actually propagate. A withdrawal that leaves data flowing to Meta Pixel or an email vendor is worse than having no consent UI at all.

---

## 5. Breach notification: 3 x 24 hours

Pasal 46. **"Pemberitahuan secara tertulis paling lambat 3 x 24 jam."**

Notify **both** the data subject and the Lembaga (in practice, Komdigi today). Minimum content: what data was disclosed, when and how, and the handling and recovery efforts undertaken.

Some English sources render this as "72 hours". Same duration, but use the Indonesian formulation in the runbook, because that is the operative text.

**Gatxel's internal SLA: notify the client within 24 hours of detection.** As processor we must give the controller enough runway to hit their own 3 x 24. Put that number in the DPA.

**The runbook must be pre-written and rehearsed**, with the notification template drafted and the decision-maker named. In an incident nobody drafts well.

**This is why the audit trail in section 7 is not optional.** Without a record of who accessed which record, a breach cannot be scoped, and an unscopeable breach must be assumed to be total.

---

## 6. Cross-border transfer, hosting, and the recommendation

Pasal 56 gives a three-tier hierarchy: adequacy, then binding appropriate safeguards, then explicit consent.

**The practical problem: there is no authority, so there is no adequacy list, and the statute never defines what makes safeguards "memadai dan mengikat."** The burden has effectively shifted onto controllers to self-verify. Indonesian counsel consistently say explicit consent is the safest available route today.

There is also a live reporting duty under Permenkominfo 20/2016, still in force: a pre-transfer report naming the destination country, recipient, date, and purpose, plus an implementation report after.

**There is no general private-sector data localisation mandate.** PP 71/2019 abolished the blanket rule PP 82/2012 imposed. Public-sector operators must stay in Indonesia, except where the storage technology is genuinely unavailable domestically. Private operators (us) may host abroad, subject to Pasal 21 supervisory access. So Vercel and AWS abroad are not illegal. The binding constraint is Pasal 56, not localisation.

**Two carve-outs that will catch us.** Financial-sector operators remain bound by **Bank Indonesia and OJK** localisation and approval rules, which are stricter than PP 71/2019. If a client is a telco with a financial arm, handles e-money, or touches payment system infrastructure, check the sector regulator before assuming this section applies.

**Gatxel's rule anyway: for anything containing NIK or KK, host in Indonesia.** AWS Jakarta (ap-southeast-3), GCP Jakarta, Biznet, or the client's own infrastructure. It removes the single least-resolved question from our compliance surface for near-zero engineering cost.

If Vercel is needed, run it as a **stateless frontend layer** with the database and all personal data in region, and be deliberate about which fields cross the boundary. **Sentry, Datadog, LogRocket, and PostHog are cross-border transfers of whatever personal data ends up in a stack trace or a session replay.** Scrub before it leaves.

**Never send NIK or KK to a third-party LLM API.** There is no defensible basis for it under the current framework.

---

## 7. Engineering rules for NIK and KK

Each maps to a specific obligation, not general hygiene.

1. **Never log NIK or KK.** Not in application logs, access logs, error traces, Sentry breadcrumbs, request body dumps, or analytics. Regex redaction for 16-digit sequences at the logger as a backstop. *Pasal 35, Pasal 36, and Pasal 56 if the log leaves Indonesia.*
2. **Encrypt at application level, not just at disk level.** Disk encryption protects against a stolen drive. It does nothing against SQL injection or a leaked read-replica credential. Envelope encryption with a KMS-managed key. *Pasal 35.*
3. **Store a keyed HMAC blind index** alongside the ciphertext so lookup and uniqueness work without decrypting or storing plaintext.
4. **Mask in the UI by default, last 4 digits only** (`************1234`). Full reveal is a deliberate, permission-gated, logged action with a stated reason.
5. **Field-level access control.** NIK and KK visibility is its own permission, not folded into a general admin role. Support, ops, and finance need the masked value only. *Pasal 37, Pasal 39.*
6. **Immutable, append-only audit trail of personal data access**: who, whose record, which fields, when, from where, and why. This is what makes a Pasal 46 notification possible and what proves Pasal 37 supervision.
7. **Never use production personal data in dev, staging, or test.** Synthetic data with valid checksum structure. No production dumps to laptops. If a developer must debug production, they do it against masked views. *Pasal 51: this is the rule whose breach moves liability from the client onto Gatxel.*
8. **Retention period per data category, enforced by an automated job, decided before launch.** *Pasal 21 requires disclosing it at collection.*
9. **Build the data subject request endpoints as product features from day one**: access and export (Pasal 7, 13), correction (Pasal 6), deletion (Pasal 8), objection to automated decisions (Pasal 10), consent withdrawal (Pasal 9). Retrofitting these into a live schema costs far more than designing for them.
10. **Soft delete is not deletion under Pasal 43 and 44.** Plan for hard deletion across backups, replicas, search indexes, caches, and any warehouse. Where backup deletion is infeasible, use crypto-shredding: destroy the per-subject key.

**Dukcapil.** The validation channel belongs to the telco, not to us. Gatxel should never hold a direct Dukcapil credential. We call the client's or the operator's verification endpoint. Access to Dukcapil data is tightly controlled under UU 24/2013 Pasal 86.

---

## 8. Two registrations to settle before launch

**PSE registration (PP 71/2019 Pasal 6).** Registration is required **before users start using the system**, not after. A SIM-registration app taking NIK and KK and processing payments clearly hits two triggers: providing financial transaction services, and processing personal data for operational activities relating to electronic transactions. Sanctions escalate from written warning to temporary suspension to **access blocking**, which means the app becomes unreachable inside Indonesia.

**Whoever operates the system registers.** If the client runs it in production under their own name, the client holds the TDPSE. If Gatxel hosts and operates it, Gatxel registers. **Make this explicit in the contract.** It is a common gap.

**DPO (Pasal 53).** Post-MK, the triggers are alternative. If an app processes KK data (therefore children's data, therefore data spesifik) at scale, limb (c) is arguably met, and SIM registration arguably meets limb (a) too. "Large scale" is undefined in the statute and was meant to be defined in the RPP that has not issued, so this is genuinely uncertain. **Recommendation: appoint someone to the DPO function formally, even part-time.** It may be internal or external. The cost of appointing is trivial next to the cost of arguing about it after an incident.

Also on the radar: **PP 17/2025** on child protection in electronic systems, effective 28 March 2026, with **Permenkomdigi 9/2026** implementing it. Children under 16 may not create accounts on high-risk platforms. Relevant because KK data includes minors.

---

## 9. Midtrans

### Keys

| Key | Where it may appear | Purpose |
|---|---|---|
| **Client Key** | Frontend only | Snap init, client-side card tokenization. Public by design |
| **Server Key** | Backend only | Every other call, **and the HMAC secret for webhook verification** |

**The Server Key cannot be self-rotated.** Rotation requires a Midtrans support ticket. A leak is therefore an incident with a support-ticket-length recovery time. Never in `NEXT_PUBLIC_*`, never in a mobile binary, never in git, never in a client bundle. Separate sandbox and production keys by environment.

### Webhook verification

```
signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
```

**The most common integration bug:** `gross_amount` must be used **exactly as it appears in the notification body, as a string** (typically `"10000.00"`). Parsing it to a number and re-serialising breaks the hash.

Compare with `crypto.timingSafeEqual`, never `===`. Reject with `403` on mismatch and log the mismatch without the body's personal data.

### Never trust the webhook body alone

Midtrans is explicit: call the Get Status API on every notification.

- Notifications can arrive **out of order**. A stale `pending` arriving after a `settlement` will silently downgrade an order if you trust the body.
- A valid signature on a replayed old notification is still a valid signature. The signature proves authenticity, not currency.

**Fulfil only when all three hold:** `status_code == 200`, `transaction_status` in {`settlement`, `capture`}, `fraud_status == accept`. Note `capture` is **not final for cards**: it settles the next day and can still be denied by fraud detection. For anything of value, wait for `settlement`.

**Also re-check `gross_amount` against our own order record before fulfilling.**

### Handler shape

Midtrans retries up to 5 times at 2 min, 10 min, 30 min, 1.5 h, 3.5 h, and expects a response in **under 5 seconds**.

1. Verify signature, in constant time.
2. Persist the raw event.
3. Return `200` immediately.
4. Process asynchronously via a queue. Fulfilment work inside the handler will blow the 5-second budget and trigger spurious retries.
5. Idempotency via a **unique database constraint on `order_id`**, inserted in the same transaction as the state change. A read-then-write check loses to concurrent retries.
6. **Monotonic state machine** so a late `pending` cannot regress a settled order.
7. Return `200` for duplicates too. A duplicate is not an error, and a `500` just triggers more retries.

### IP allowlisting: do not rely on it

Midtrans warns that their IPs change without notice, and for outbound calls says plainly: "Do not whitelist IP addresses, as this will cause integration failures." Allowlist the **domains** (`api.midtrans.com`, `app.midtrans.com`). Signature verification is the security control. IP filtering is at most a WAF hint.

### PCI DSS scope

Midtrans is a certified PCI DSS Service Provider Level 1, and states that "merchants are strictly prohibited to record card credentials to their own system, unless PCI DSS certified."

**Gatxel rule: never render a card input we control. Snap or Midtrans-hosted tokenization only.** With a hosted flow, raw card data never touches our servers, which keeps us at the lowest self-assessment tier instead of the full audit programme.

What silently drags us back into scope:

- Building our own card form and posting the number to our backend, even as pass-through
- Logging request bodies from any card-adjacent endpoint
- Storing full card numbers "for reconciliation". Store the Midtrans `transaction_id`, masked number, and card type only
- Session replay tools (LogRocket, FullStory, Hotjar) recording the payment iframe
- Support tooling that screenshots or records a screen with a card field visible

**Always enable 3DS.** Midtrans: "Always enable 3DS, to prevent unnecessary security and chargeback risks." 3DS 1.0 was decommissioned in October 2022, so use EMV 3DS 2.0: create the token without the `secure` parameter and send `Authentication: true` on the charge. If a client wants non-3DS for conversion reasons, that shifts chargeback liability to them and needs their written sign-off, not a default.

*Note: we could not verify a statutory 3DS mandate in Indonesia. It appears to be acquirer and scheme driven. Enable it regardless.*

---

## 10. Verify before relying on it

These are the points where public sources were thin or contradictory. Do not build on them without checking.

| Item | Status |
|---|---|
| Prepaid SIM registration rules (Permenkominfo 12/2016 as amended by 14/2017 and 21/2017) | **Substantially unverified.** Primary text was not reachable. Article numbers, the current per-NIK number limit, and outlet confidentiality duties are unconfirmed. **Obtain the consolidated text and the client telco's own SOP before building** |
| PP 71/2019 five-year minimum retention | Reported by DLA Piper, primary article not verified |
| Permenkominfo 20/2016 cross-border reporting articles | Duty confirmed by counsel, article numbers unverified |
| RPP PDP issuance after March 2026 | Confirmed not issued as of March 2026. Re-check |
| "Large scale" threshold in Pasal 53 | Undefined in statute. Genuinely uncertain |
| OJK and Bank Indonesia sector rules | Not researched. If a client has a financial services arm or handles e-money, sector rules may be stricter than PP 71/2019 |
| Merchant PCI SAQ level with Snap | Inferred from standard practice. Confirm with the acquirer |
