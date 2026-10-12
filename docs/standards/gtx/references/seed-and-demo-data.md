# Seed, demo and placeholder data

**Tier: HOUSE for the craft, GATE for the containment.**

Gatxel builds every screen with realistic artificial data, never Lorem ipsum. Then we replace it with the client's real content. This file makes that safe, because the same practice that produces honest layouts also produces a lawsuit if the placeholder ships.

---

## O-01 Why realistic seed data, and not Lorem ipsum

**HOUSE.**

Lorem ipsum lies about your layout. It has even word lengths, no numbers, no capitals mid-sentence, no long Indonesian compound words, no single-word names, no IDR figures in the millions, and no empty fields. A design that looks balanced in Latin filler falls apart the moment a real product name runs to 64 characters.

**Rule.** Every screen is built against data shaped like the real thing:

- The **longest** realistic value and the **shortest**. One-word names, because many Indonesians have a single legal name. Product titles at the real maximum.
- Real number magnitudes, formatted: `Rp 1.250.000`, not `$99`.
- The empty case, the one-item case, the 10,000-item case.
- Real Indonesian names, cities, and phone shapes (`0812...`, `+62812...`).
- At least one value that breaks: a missing avatar, a null date, a failed payment, a name with an apostrophe.

If the design only survives median data, it is not finished. This is the same rule as E-01's five states, applied to content instead of loading.

---

## O-02 The hard line: what may never ship

**GATE.**

**A testimonial, review, rating, or case-study result that was invented by us and presented as real is a legal violation in at least three jurisdictions, and it is the single easiest way for Gatxel to damage a client.**

| Jurisdiction | Instrument | What it says |
|---|---|---|
| **Indonesia** | **EPI 1.17** | A testimonial must be an event the person genuinely experienced, provable by a **signed written statement** held on file |
| **Indonesia** | **UU 8/1999 Pasal 17(1)(c)** | An advertisement must not contain incorrect, wrong, or inaccurate information |
| **Indonesia** | **UU 8/1999 Pasal 17(1)(e)** | Must not exploit a person or event without their consent |
| **Indonesia** | **UU 8/1999 Pasal 20** | **"Pelaku usaha periklanan bertanggung jawab atas iklan yang diproduksi dan segala akibat yang ditimbulkan."** The producer of the advertisement is liable, not only the client. **That is us.** |
| **Indonesia** | **UU 8/1999 Pasal 62** | Breach of 17(1)(c) or (e): up to **5 years or Rp 2 billion**. Breach of 17(1)(f): up to 2 years or Rp 500 million |
| **United States** | **16 CFR Part 465**, effective 21 October 2024 | §465.2 makes it a violation to **write, create, or sell** a review or testimonial misrepresenting that the reviewer exists, that they used the product, or their actual experience. §465.2(b) extends it to disseminating where you **"knew or should have known."** The definition of "consumer testimonial" is broad enough to catch a marketing-page quote block |
| **United States** | 16 CFR Part 465 | §465.5 insider reviews (employees, agents, relatives) without disclosure. §465.8 fake follower and engagement counts |
| **EU and UK** | UCPD, UK DMCC Act 2024 | Fake reviews are a banned practice |

Read Pasal 20 again. **The studio that produced the advertisement is liable for it and for its consequences.** A fake testimonial on a client site is not the client's problem alone. It is ours, criminally.

**So the rule is absolute:**

> Invented testimonials, reviews, ratings, logos, client names, case study numbers, follower counts and "trusted by" strips exist **only** in non-production environments, and the build fails if one reaches production.

There is no waiver for this. It is not a design decision.

Bahasa: Testimoni karangan itu bukan cuma tidak etis, itu pidana, dan Pasal 20 UU 8/1999 menaruh tanggung jawabnya pada pembuat iklan, artinya kita. Data dummy hanya hidup di staging.

---

## O-03 Containment, so it cannot ship by accident

**GATE.** Good intentions are not a control. The containment is structural.

**1. Namespace everything.** All synthetic records carry a marker that is trivially greppable and impossible to type by accident.

```ts
// lib/seed/marker.ts
export const SEED_MARKER = '__GTX_SEED__'
// every seeded row: { ...data, source: SEED_MARKER }
```

**2. Seed scripts are environment-gated and fail closed.**

```ts
// prisma/seed.ts
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  throw new Error('GTX-ENG-001 O-03: seed script must never run against production')
}
if (!process.env.ALLOW_SEED) {
  throw new Error('GTX-ENG-001 O-03: set ALLOW_SEED=1 to confirm the target database')
}
```

**3. Deterministic seeds.** Set a fixed seed so the same data appears for everyone. A designer, a developer and a reviewer looking at different random names cannot have the same conversation.

```ts
import { faker } from '@faker-js/faker/locale/id_ID'
faker.seed(20260811)
```

Use the maintained `@faker-js/faker` package with the **`id_ID` locale**, which gives real Indonesian name, address and phone shapes. Note the history: the original `faker.js` was self-sabotaged by its author in January 2022. `@faker-js/faker` is the community fork and is the correct one.

**4. Visible watermark outside production.** Every non-production build renders a persistent band naming the environment. If someone screenshots staging for a client deck, the screenshot says so.

**5. A build-time gate.** O-04.

---

## O-04 The placeholder grep, as a CI gate

**GATE.** Run this on the production build output, not on source. Non-zero exit blocks the deploy.

```bash
#!/usr/bin/env bash
# assets/ci/no-placeholder.sh — GTX-ENG-001 O-04
set -uo pipefail
PATTERNS=(
  # Filler text
  'lorem ipsum' 'dolor sit amet' 'consectetur' 'ipsum dolor'
  # Placeholder people
  'John Doe' 'Jane Doe' 'John Smith' 'Foo Bar' 'Test User' 'Budi Santoso Test'
  # Placeholder companies
  'Acme' 'Contoso' 'Globex' 'Initech' 'Your Company' 'Company Name'
  'Nama Perusahaan' 'PT Contoh' 'Brand Name' 'Client Logo'
  # Placeholder contact
  'example\.com' 'example\.org' 'test@' 'noreply@example' 'mailtrap'
  '555-01[0-9][0-9]' '08123456789' '\+628123456789' '0812-3456-7890'
  # Placeholder media
  'placehold\.co' 'placeholder\.com' 'picsum\.photos' 'placekitten'
  'unsplash\.it' 'dummyimage' 'loremflickr' 'via\.placeholder'
  # Scaffolding left behind
  'Create Next App' 'Get started by editing' 'Vercel logo'
  'shadcn' 'Your Name Here' 'TODO:' 'FIXME:' 'XXX:'
  # Our own seed marker
  '__GTX_SEED__'
  # Indonesian placeholders
  'Lorem ipsum bahasa' 'Nama Lengkap Anda' 'Judul Artikel' 'Deskripsi singkat di sini'
  'Testimoni pelanggan' 'Isi testimoni' 'Alamat lengkap di sini'
  # Fabricated proof
  'Trusted by 10,000' 'Dipercaya oleh ribuan' 'Rating 5\.0 dari 5\.0'
)
FAIL=0
for p in "${PATTERNS[@]}"; do
  if rg -i --no-messages "$p" .next/server .next/static public 2>/dev/null | head -3 | grep -q .; then
    echo "GTX-ENG-001 O-04 FAIL: placeholder found -> $p"
    rg -i --no-messages -l "$p" .next/server .next/static public | head -3
    FAIL=1
  fi
done
exit $FAIL
```

Add project-specific patterns as they appear. **When a false positive blocks a build, do not delete the pattern. Narrow it.** Deleting the pattern is how the gate stops working.

---

## O-05 How to write a placeholder testimonial that looks real

**HOUSE.** This is a craft skill and it is worth doing well, because a placeholder that reads as fake produces a design that has never been tested against real copy. Real testimonials have properties invented ones lack.

| Real testimonials have | Invented ones have |
|---|---|
| **A specific, small detail** the writer had no reason to invent. "Kami sempat salah kirim tiga nomor di minggu pertama" | Only the outcome |
| **A number that is odd.** "turun dari 40 menit jadi sekitar 12 menit" | Round numbers: 50%, 2x, 100% |
| **A mild reservation.** "Awalnya agak bingung sama menu laporannya" | Uniform praise |
| **Their own vocabulary**, including the wrong technical word | The vendor's marketing vocabulary |
| **Uneven length.** One is two lines, one is a paragraph | All three the same length |
| **A concrete role and place.** "Owner, 3 outlet di Malang dan Batu" | "CEO, Tech Company" |
| **Imperfect grammar and mixed register.** Real Indonesians write "udah", "banget", and switch to English mid-sentence | Clean, complete sentences |
| **A reason they were asked**, visible in what they answer | An answer to no question |

Write three placeholders with **different lengths, different registers, and at least one containing a mild complaint that was resolved.** That is the layout stress test the design actually needs: it will reveal that the card has no room for four lines and that the quote marks collide with a long name.

**Then mark every one of them with the seed marker, and never let one ship.** The craft is for the layout. The content comes from the client.

---

## O-06 Getting the real thing

**HOUSE.** The reason placeholders ship is that nobody made collecting the real content anybody's job. Fix that in the contract, not in the code.

1. **Content is a named deliverable with a named owner on the client side and a date**, in the proposal, before the first component is built.
2. **Send the client the placeholder as the brief.** "Here are three fake testimonials in the shape we need. Send us three real ones in this shape." A filled-in example gets returned far more often than an empty form does.
3. **For each real testimonial collect, and keep on file:** the person's full name, role, company, a way to contact them, the date, written permission to publish, and the text in their own words. **EPI 1.17 requires a signed written statement.** No signed statement, no testimonial on the site. Keep it in the project delivery folder, not in someone's WhatsApp.
4. **If the client cannot supply real proof, the section is deleted, not filled.** A page with no testimonial section is honest. A page with invented ones is a criminal exposure under Pasal 20 with our name on it. Offer the alternatives that are true: a named case study the client will stand behind, a real usage number, a real client logo used with written permission, or nothing.
5. **A logo strip is a claim.** "Dipercaya oleh" plus a logo asserts a commercial relationship. Written permission for each logo, on file, or the strip does not ship.
