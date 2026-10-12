# GTX-ENG-001 / I. Code health

Tier: **HOUSE**, with three **GATE** items marked below.

Visual and copy slop is embarrassing. Code slop is expensive. It compounds, it is invisible in review because it looks polished, and it is the reason a project that shipped fast in month one takes 20% longer by month six.

---

## The evidence, cited correctly

Several numbers circulating on this topic are mangled. These are the versions that survive checking.

**GitClear, The Maintainability Gap (2026), 623 million analysed changes 2023 to 2026:**

- Block duplication up **81% over 2023**
- Copy-paste at **15.7% of changed lines** in the first half of 2026
- **Moved code, the signal that someone consolidated something into a reusable module, in freefall to 3.8% year to date in 2026**

That last number is the one to internalise. **AI does not refactor. It adds.**

*Note: the widely quoted "211 million lines, 4 to 8x duplication" figures come from GitClear's earlier 2025 report covering 2020 to 2024. Cite the 2026 report instead. The "4x" is clone growth and the "8x" is a narrower five-plus-line-block finding, so quoting them as a range is wrong.*

**CodeRabbit:** AI-generated code contains **1.7x more issues** than human-written code. *The frequently attached "75% more logic errors" sub-figure could not be verified.*

**Veracode 2025 GenAI Code Security Report:** **45%** of AI-generated code contained security flaws, across 100+ models and 80 coding tasks. *Use this, not the "40%, Second Talent" version circulating online, which is a staffing firm's content-marketing roundup citing someone else.*

**GitKraken, The AI Multiplier Effect:** regular AI users show **9x higher code churn**, defined as lines written then revised or deleted within two weeks. *Sample is small at 2,172 developer-weeks. It is GitKraken's number, not GitClear's.*

**DORA:** the real 2024 figures are conditional on a **25% increase in AI adoption**, and give +3.4% code quality against **minus 7.2% delivery stability**. Not a generic "stability drop." And **the 2025 report reversed the throughput finding**, so citing the 2024 pairing in 2026 misrepresents current evidence.

**Symbiotic Security scan of 1,072 vibe-coded apps: 98% had security flaws.** Concrete findings are in I-06.

---

## I-01 The rules that actually stop it

**HOUSE.**

- EN: Search before you generate. Before writing a new helper, grep for an existing one. AI re-derives utilities instead of importing them, measured at 17.2% cross-file duplication versus 24.5% for human code, which is how the same function ends up in six directories.
- ID: AI tidak pernah merapikan kode, dia cuma menambah. Jadi konsolidasi harus dijadwalkan, tidak akan terjadi sendiri.

Concrete practices:

1. **Review the first instance of a pattern hard.** Later copies are cheap for the model to generate, so a bad abstraction metastasises faster than a human could spread it.
2. **Schedule refactoring cycles.** Not "when we have time." A recurring sprint item aimed specifically at collapsing duplication.
3. **Track suppressions as a metric.** Count `@ts-ignore`, `eslint-disable`, and `# noqa`. Fail CI on a net increase. Silencing a linter is not fixing a problem.
4. **Cap changed files per pull request.** An agent asked to fix one bug will happily edit ten unrelated files, producing an unreviewable diff. Nobody reviews a 40-file diff properly.
5. **Require an author-written summary in the reviewer's own words.** Accepting a diff unread is the actual failure mode, and the summary is the cheapest test of whether it was read.
6. **Track two-week churn per file.** High churn is the clearest signal that something should not have been merged.
7. **Never accept "the model hallucinated" as a root cause.** Name the human gate that failed.

---

## I-02 Named code smells to grep for

**HOUSE.** Each is checkable.

| Pattern | What it looks like | Fix |
|---|---|---|
| **Placeholder residue** | `pass`, `...`, `NotImplementedError`, empty `return None`, `TODO`, `FIXME`, `HACK` shipped as if complete | Grep-gate the build |
| **Hedging comments** | `// this should work`, `// probably handles the edge case` | Treat as an unfinished-work flag, not a comment |
| **Phantom import** | Importing a real package but a function that does not exist **in that version** | Resolve every import against the installed version, not just the package name |
| **Cross-language idiom leak** | `.push()` or `.forEach` in Python, `.equals()` in Ruby | Lint rule |
| **Interface-only class** | A fully plumbed abstraction wired through the app that does nothing | Delete. Architecture as ceremony |
| **Redundant state layer** | A store mirroring another store because the model learned that real apps have stores | Collapse to one source of truth |
| **Defensive-abstraction residue** | A wrapper guarding a failure mode removed three commits ago | Delete on sight |
| **Debug harness in production** | Mock switches, test scaffolding, `console.log` on production paths | Build-time dead-code elimination |
| **Comment volume as clarity proxy** | Verbose narration accumulating because each agent turn adds explanation | Strip comments that restate the line below |
| **Coverage illusion** | Tests assert implementation details, not contract. Coverage looks fine, refactors break everything | Review test files for contract assertions |
| **`key={index}`** | React lists keyed by array index | Breaks on reorder and corrupts input state in list rows. Use stable IDs |
| **Unbounded query** | `SELECT *` with no `LIMIT` and no index. Fine on 50 seeded rows, full scan at 50,000 | `EXPLAIN` every list endpoint against production-shaped data |
| **Unconstrained schema** | Every column nullable, no foreign keys, no unique constraints, because the model optimised for "the insert works" | Add constraints before launch. The violations you surface are the corruption you already have |
| **Env-var drift** | A missing key falls back to a default and the app half-works instead of failing loudly | `requireEnv()` that throws at boot |
| **Migration with no down path** | No rollback, never rehearsed | Rehearse the rollback |
| **Context-window regression** | The same bug comes back because the agent can no longer see the whole repo | That recurrence **is** the signal that the codebase outgrew the workflow |
| **Concurrency-only failure** | Cache stampede, pool exhaustion, unsynchronised counters. Invisible to single-threaded review and demo traffic | Load-test the like, vote, and toggle endpoints specifically |

---

## I-03 Supply chain: slopsquatting

**GATE.** Extends S-15.

Open models hallucinate package names at about **21.7%**, commercial models about **5.2%**. The number that makes it an economic attack: **43% of hallucinated names recur across ten separate queries**, so an attacker can predict and pre-register them.

**Never install a package name that came out of a model without checking the registry for age, download history, and repository link.** Combine with the existing rules: lockfile, `npm ci`, `ignore-scripts=true`, and a 24 to 72 hour cooldown.

---

## I-04 Fix the outdated-API problem at the source

**HOUSE.**

The complaint that AI writes code against outdated library APIs is real and has a real fix. Models were trained on year-old documentation, so they hallucinate APIs and generate examples for old major versions.

**Adopt [Context7](https://github.com/upstash/context7)** (Upstash, actively maintained). It injects current library documentation into the agent's context. Install with `npx ctx7 setup`. *Note this replaced the older `npx -y @upstash/context7-mcp` command that most blog posts still show.* An API key is optional, and a free tier exists.

**Limitations, stated by Upstash themselves:** the docs are community-contributed and they "cannot guarantee the accuracy, completeness, or security of all library documentation." Only the MCP server is open source, the backend is private. Coverage varies by library and it spends context tokens on every lookup. **It reduces the problem. It does not eliminate it.**

If sending a dependency list to a third party is not acceptable for a client, use the self-hostable [docs-mcp-server](https://github.com/arabold/docs-mcp-server) instead.

**Do this regardless of tooling:** put a rule in `CLAUDE.md` telling the agent to read the installed version from `package.json` before writing against a library, and pin versions in the lockfile.

---

## I-05 Tooling we evaluated and what we concluded

**Advisory.** All five SEO and GEO skill repos we were pointed at **do exist**, so nothing was hallucinated. That is not the same as being safe to install.

| Repo | Verdict |
|---|---|
| `AgriciDaniel/claude-seo` (note the spelling) | MIT, active, no credentials required by default, local-first. **The defensible pick if we want one** |
| `zubair-trabzada/geo-seo-claude` | Popular, but installs via `curl ... \| bash`. **Do not run as-is** |
| `aaron-he-zhu/seo-geo-claude-skills` | Real but small |
| `infrasity-labs/dev-gtm-claude-skills` | Real, narrow, one skill |
| `Hainrixz/claude-seo-ai` | About five commits. Skip |

**Two cautions.** The high-star repos were created in early 2026 with unusually high fork-to-star ratios in a hype category, so do not read the star count as vetted users. And third-party "best skills" listicles are contaminated evidence here, because at least one repo author publishes exactly those listicles.

**Rule: install any third-party skill in a container or throwaway VM first, read the install script, and never on a machine holding production credentials.** A skill is executable code with your privileges.

**Other tools checked:**

- **DataForSEO MCP** is official and Apache-2.0, but the underlying API is **pay-as-you-go with no free tier**, and every tool call spends money and sends query data to a third party. Budget it as a metered dependency.
- **Unicorn Studio** is a real WebGL motion tool, but the **free tier is personal and non-commercial only**, caps at 8 publishes, and forces a watermark. Any client work is on the paid tier at 20 USD a month. Because it is canvas and WebGL it must be a client component with `dynamic(..., { ssr: false })` and lazy-loaded, or it will wreck LCP and INP on exactly the pages the SEO work is meant to help.

---

## I-06 What actually goes wrong in shipped vibe-coded apps

**GATE.** From a scan of 1,072 vibe-coded applications, 98% of which had security flaws. These are additions to section A, not repeats.

| Pattern | Detail |
|---|---|
| **Overfetch then filter on the client** | The API returns every row and the frontend hides the ones you should not see. **The data is sitting in the network tab.** Filter server-side, always |
| **Default-permissive row security** | Supabase and Firebase rules left open. In the scan: 172 apps allowed unauthenticated `DELETE`, 172 allowed unauthenticated `PATCH`, 39 had fully readable tables, 34 exposed emails, password hashes, or tokens. Deny by default, then allow |
| **Exposed RPC and GraphQL introspection** | 44 apps exposed callable database functions. Allowlist what is reachable |
| **Email verification disabled** | 69 apps. The model turned it off to make the demo signup flow work, and nobody turned it back on |
| **Third-party API keys in the client bundle** | 24 apps. Distinct from the localStorage token problem |
| **Missing security headers** | Over 1,000 apps. CORS set to `*` on 197 |

---

## I-07 Signup hygiene

**GATE.**

The reviewer of a vibe-coded app got in with a ten-minute disposable email and the password `123456`, and was never sent a verification code. All three are separate failures.

**Email verification.** Verify before granting access to anything persistent, shareable, or billable. Single-use token with a 15 to 60 minute TTL, or a 6 to 8 digit OTP. **Store only a hash of the token.** Rate limit both sends and attempts. Expire abandoned pending signups. Progressive access converts better than a hard wall: let unverified users look around, gate writes, sharing, billing, and invites.

On email change, send a notification to the **old** address and verification to the new one.

*Email verifies address ownership. It is not an MFA factor.*

**Disposable email addresses.** Use the maintained [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) list (CC0), or the built-in toggle if the project uses Clerk, whose "Block disposable email addresses" restriction is real.

**The false-positive risk is real and under-appreciated.** Blocklists routinely catch legitimate privacy relays: Apple Hide My Email, Firefox Relay, DuckDuckGo Duck Addresses, SimpleLogin. Those are used by paying customers, not abusers. So:

- Apply blocking only to abuse-prone flows such as free trials and credit grants
- **Never fail silently.** Show a clear message with a support path
- Maintain an allowlist override
- **Never block subaddressing** (`user+tag@`), it is legitimate and widely used
- Prefer verification plus rate limiting over hard blocking

**Weak passwords.** The HaveIBeenPwned range API catches `123456` trivially, it is the single most common password in the corpus. Ship the offline top-10,000 list as a fallback for when the API is unreachable, and **fail open on network error but log it**, since failing closed locks out legitimate signups during an outage.

---

## I-08 Prompts and process

**HOUSE.**

- **Version the prompts.** Generation prompts living in someone's personal IDE config is a prompt graveyard. Keep an in-repo prompt library.
- **Pin the model** for any shared prompt, or the same prompt produces different output across versions.
- **Record which tool wrote a diff.** A pull request field. Without it the audit trail is gone and you cannot measure anything.
- **Never paste `.env` contents or production credentials into a chat.** Configure IDE-side scrubbing and workspace exclusions.
- **Where AI is encouraged:** boilerplate, test generation, documentation, well-understood problems.
- **Where it needs extra review:** core business logic, anything security-sensitive, distributed coordination, payments.
- **Where it is prohibited:** cryptographic implementations, and anything touching NIK or KK where the data itself would reach the model.
