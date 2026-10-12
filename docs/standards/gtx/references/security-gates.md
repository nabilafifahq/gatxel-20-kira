# GTX-ENG-001 / A. Security gates

Every rule here is **GATE**. No launch without it, or a signed waiver.

Format: `EN` is the rule as written for the tool and the reviewer. `ID` is why it matters, in Bahasa Indonesia, for the team.

Threat model baseline: **OWASP Top 10:2025**, whose order changed in ways that matter to us. A01 Broken Access Control (now including SSRF), A02 Security Misconfiguration (up from #5), A03 Software Supply Chain Failures (new at #3), A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions (new).

---

## S-00 Patch level

**GATE. Check before every release.**

- EN: As of **9 August 2026**, minimum `next@16.2.11` or `next@15.5.21`, preferred `next@16.3.0`. Node.js 24 LTS or 26 LTS. PostgreSQL 15 or newer (13 is EOL, 14 EOLs November 2026). **Treat these version numbers as a snapshot, not the rule.** The rule is: be on a supported line and inside the current patch window. Check `nextjs.org/blog` before quoting a number.
- ID: Versi di bawah itu punya lubang yang sudah dieksploitasi di dunia nyata. Bukan teori.

Next.js now ships **monthly pre-announced security releases**. Put a recurring task on the Gatxel board for the 15th of each month: check `nextjs.org/blog`, patch within 7 days, note the version in the project's delivery folder.

Incidents that shaped this rule:

| Advisory | Severity | What broke |
|---|---|---|
| CVE-2025-29927 | 9.1 | `x-middleware-subrequest` header skipped middleware entirely. Any auth in `middleware.ts` was bypassed |
| **CVE-2025-55182** (React2Shell) | **10.0** | Pre-auth RCE via RSC deserialization. In CISA KEV with a 12 Dec 2025 remediation deadline, mass-exploited from 4 Dec 2025. Note CVE-2025-66478 was assigned then **rejected as a duplicate**, so cite 55182 only, or scanners will look up a dead record |
| CVE-2025-55183 | Medium | A crafted request returned the compiled source of *other* Server Functions, leaking build-inlined secrets |
| May 2026 release | 13 advisories | Four more middleware and proxy bypasses, SSRF via WebSocket upgrade, RSC cache poisoning, XSS in nonce-based CSP |
| July 2026 release | 9 CVEs | Server Action DoS, SSRF via `rewrites()`, SVG DoS in the image optimizer, cache confusion returning another request's body |

**If any Gatxel app was internet-facing and unpatched on 4 December 2025, rotate every secret it holds.** Vercel's own instruction.

---

## S-01 Sessions

**GATE.**

- EN: Session tokens live in a cookie set `httpOnly; Secure; SameSite=Lax; Path=/`. Prefer the `__Host-` prefix. Never `localStorage`, never `sessionStorage`, never a non-httpOnly cookie.
- ID: Apa pun yang disimpan di `localStorage` bisa dibaca JavaScript mana pun di origin itu, termasuk dependency npm yang disusupi. Satu XSS berarti token dicuri dan dipakai dari mesin lain, tanpa sinyal apa pun ke server.

```ts
cookieStore.set('__Host-session', token, {
  httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: expiresAt,
})
```

Session ID needs 64 bits of entropy minimum from a CSPRNG, and must be a meaningless identifier. Never embed a user ID, email, or role in it. Do not use framework default cookie names, they fingerprint the stack.

**Timeouts.** Default for a normal business app: **24 hours absolute, 1 hour idle** (NIST SP 800-63B-4 AAL2). Rotate the session ID after login and after **any** privilege change: role change, password change, MFA enrolment, email change. Not doing so is session fixation.

**Logout must invalidate server side.** Clearing the cookie is not logout. If sessions are stateless JWTs, you cannot revoke them, so "log out everywhere" and forced logout after a password change are impossible. For any project with admin roles or customer data, use database sessions.

`Cache-Control: no-store` on every authenticated response.

---

## S-02 Authorization

**GATE.**

- EN: Every authorization decision is made on the server, derived from the verified session, as close to the data as possible. Never from a client-supplied value, a query parameter, a cookie the client can write, or a hidden form field.
- ID: Cek di sisi klien itu urusan tampilan, bukan keamanan. Menyembunyikan tombol admin tidak menghentikan siapa pun yang memanggil endpoint-nya langsung.

The anti-pattern, straight from the Next.js docs:

```tsx
// BANNED
const isAdmin = (await searchParams).isAdmin
if (isAdmin === 'true') return <AdminPanel />
```

**Middleware and proxy are not an authorization boundary.** Next.js 16 renamed `middleware.ts` to `proxy.ts` precisely because teams were misusing it. Vercel's own wording: "this feature is recommended to be used as a last resort." Five distinct bypasses shipped in 15 months. Use it for redirects and cheap edge filtering. Put the real check in a Data Access Layer.

**Required structure:**

```ts
// lib/dal.ts
import 'server-only'
import { cache } from 'react'

export const verifySession = cache(async () => {
  const token = (await cookies()).get('__Host-session')?.value
  const session = await validate(token)
  if (!session) redirect('/login')
  return session
})

export async function getInvoice(id: string) {
  const session = await verifySession()
  const inv = await db.invoice.findUnique({
    where: { id },
    select: { id: true, total: true, status: true, ownerId: true },
  })
  if (!inv || inv.ownerId !== session.userId) throw new Forbidden()
  return toInvoiceDTO(inv)
}
```

Layouts do **not** protect their children. They do not re-render on navigation, and route segments still execute and still appear in the RSC payload. Returning `null` from a layout for unauthorized users is explicitly not recommended.

Route handlers: `401` unauthenticated, `403` authenticated but not permitted, `404` when even the existence of the resource is sensitive.

---

## S-03 Server Actions are public endpoints

**GATE.**

- EN: Every `'use server'` function re-verifies authentication and resource ownership inside itself, validates its input with a schema, and returns a minimal shaped result, never a raw ORM object.
- ID: Server Action bisa dipanggil lewat POST langsung, tanpa lewat UI kita sama sekali. Kalau tidak dikirim ke mana-mana pun, endpoint-nya tetap ada.

Next.js documents this plainly: "even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally." Encrypted action IDs are obfuscation, not authorization, and CVE-2026-64643 leaked them anyway.

```ts
'use server'
import 'server-only'

const Input = z.object({
  orderId: z.uuid(),
  amount: z.number().int().positive().max(100_000_00),
}).strict()

export async function createRefund(raw: unknown) {
  const session = await verifySession()                 // 1 authn
  const parsed = Input.safeParse(raw)                    // 2 validate
  if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }
  const order = await db.order.findUnique({ where: { id: parsed.data.orderId } })
  if (order?.userId !== session.userId) throw new Forbidden()   // 3 authz
  await refund(order, parsed.data.amount)                // 4 work
  return { ok: true }                                    // 5 shaped return
}
```

Use `.strict()` so unexpected keys are rejected instead of silently reaching the ORM (mass assignment). Bound every number and string length: unbounded input is a DoS vector, and CVE-2026-64646 was exactly that. Rate limit expensive actions, they are a documented CPU-exhaustion vector (CVE-2026-64641).

Variables closed over by an action are serialized to the client and back. When self-hosting across multiple instances, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

---

## S-04 Never leak the database row

**GATE.**

- EN: Never pass a raw query result to a client component. Select explicit columns and map to a DTO in the Data Access Layer.
- ID: Semua field yang dikirim ke client component ikut terserialisasi ke browser, dirender atau tidak. Password hash, nomor telepon, flag internal, semuanya ikut.

```tsx
// BANNED
const [rows] = await sql`SELECT * FROM "user" WHERE slug = ${slug}`
return <Profile user={rows[0]} />
```

Controls, strongest first:

1. A `server-only` Data Access Layer that runs authorization and returns field-filtered DTOs. Only the DAL touches `process.env` and the database client.
2. Explicit column selection. Never `SELECT *`, never `findMany()` without `select:`.
3. `import 'server-only'` at the top of any module that must never reach the client. Importing it into a client component becomes a build error.
4. `experimental.taint: true` plus `experimental_taintObjectReference` as a backstop, not a substitute.

---

## S-05 Environment variables

**GATE.**

- EN: `NEXT_PUBLIC_*` is public forever. Only the Data Access Layer reads `process.env`. `.env*` is never committed. Any secret that ever touched git history is rotated, not deleted.
- ID: `NEXT_PUBLIC_` itu di-inline ke bundle browser waktu build. Bukan disembunyikan, benar-benar ditulis ke dalam file JavaScript-nya.

A build carries frozen values, so one Docker image promoted from staging to production carries the staging URL. Add `gitleaks` as a pre-commit hook. Grep the built bundle before every release.

---

## S-06 Passwords and authentication

**GATE.**

- EN: Argon2id at m=19456 (19 MiB), t=2, p=1. Minimum length 15 characters as a single factor, 8 with MFA. **No composition rules.** No forced periodic rotation. No knowledge-based questions. Check the full password against the HaveIBeenPwned range API. Offer TOTP MFA on any account with admin rights or customer data.
- ID: NIST SP 800-63B-4 justru **melarang** aturan "harus ada huruf besar, angka, dan simbol". Aturan itu membuat sandi lebih mudah ditebak, bukan lebih sulit, karena orang jadi memakai pola yang sama. Panjang lebih penting daripada variasi karakter.

The Next.js auth guide example uses `bcrypt(password, 10)` and a Zod schema requiring one letter, one number, one special character. **Do not copy it.** That schema is precisely what NIST forbids.

HaveIBeenPwned range API: SHA-1 the password, send the first 5 characters to `https://api.pwnedpasswords.com/range/{prefix}`, match the remaining 35 locally. The password never leaves our server. No API key, no rate limit. Send `Add-Padding: true`.

**Password reset tokens:** CSPRNG generated, stored hashed, single use, 15 to 60 minute expiry, compared with `crypto.timingSafeEqual`, rate limited. Identical response and identical response time whether the account exists or not. Do not change anything on the account until a valid token is presented, otherwise the reset endpoint is a free denial of service. Invalidate all sessions after a successful reset.

---

## S-07 Rate limiting

**GATE on auth endpoints.**

- EN: Rate limit login, signup, password reset, OTP send, OTP verify, and every expensive Server Action. Lock the **account**, not the IP.
- ID: Kunci per IP gampang dilewati pakai proxy, dan malah memblokir pengguna sah yang berbagi IP. Kunci per akun yang benar.

OWASP's citable numbers: lockout after 5 to 10 failed attempts, 5 to 30 minute lockout duration, exponential backoff starting at 1 second. Always allow password recovery even while locked.

Per-endpoint request rates are convention, not standard. Sane starting points to tune:

| Endpoint | Start at |
|---|---|
| `POST /login` | 5 to 10 per minute per account, 20 to 60 per minute per IP |
| `POST /signup` | 3 to 5 per hour per IP |
| Password reset request | 3 to 5 per hour per account and per IP |
| OTP verify | 5 attempts per code, then invalidate the code |
| OTP send or resend | 1 per 30 to 60 seconds, 5 per hour |

---

## S-08 CSRF

**GATE where applicable.**

- EN: `SameSite` alone is not a CSRF defence. For Server-Actions-only apps on a single apex domain with no state-changing GET endpoints, Next.js's built-in Origin and Host comparison plus `SameSite=Lax` is acceptable. The moment we add a Route Handler that accepts cookie auth, or serve from multiple subdomains, add a signed double-submit token bound to the session ID by HMAC.
- ID: `SameSite=Lax` hanya memblokir method yang mengubah state. Endpoint GET yang mengubah data tetap bisa diserang. Cookie juga terikat domain, bukan origin, jadi subdomain yang jebol bisa menyerang kita.

Never make a mutation a render side effect. Behind a reverse proxy, configure `experimental.serverActions.allowedOrigins`.

---

## S-09 Injection

**GATE.**

- EN: Parameterized queries only. `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw`, and `sql.raw` are banned by lint rule. Identifiers that genuinely cannot be parameterized (column names, sort direction) are validated against a hard-coded allowlist, never sanitized.
- ID: Perhatikan jebakannya. `prisma.$queryRaw` aman hanya kalau dipanggil sebagai tagged template dengan backtick menempel langsung. Kalau string-nya dibangun dulu lalu dikirim dengan kurung biasa, itu tetap bisa di-inject meskipun nama fungsinya sama.

```ts
prisma.$queryRaw`SELECT * FROM u WHERE id = ${id}`     // safe, tagged template
prisma.$queryRaw(`SELECT * FROM u WHERE id = ${id}`)   // VULNERABLE, plain string
```

Add to ESLint `no-restricted-syntax` with an allowlist requiring review.

---

## S-10 PostgreSQL

**GATE.**

- EN: The application connects as a role that is not superuser, not the schema owner, and has no DDL rights. Connection string uses `sslmode=verify-full` with `sslrootcert`. Multi-tenant tables use `ENABLE` **and** `FORCE ROW LEVEL SECURITY`.
- ID: SQL injection ke role terbatas itu kebocoran data. SQL injection ke superuser itu `COPY ... TO PROGRAM`, artinya server diambil alih. Bedanya sebesar itu.

```sql
CREATE ROLE app_owner LOGIN PASSWORD '...';   -- migrations only, owns schema
CREATE ROLE app_user  LOGIN PASSWORD '...' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

REVOKE ALL ON DATABASE appdb FROM PUBLIC;
GRANT CONNECT ON DATABASE appdb TO app_user;
GRANT USAGE ON SCHEMA app TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_user;

-- without this, every future migration creates tables the app cannot read
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

**RLS gotchas that bite in production:**

1. Table owners bypass RLS by default. `ENABLE` alone does nothing if the app connects as the owner. You need `FORCE ROW LEVEL SECURITY`.
2. Superusers and roles with `BYPASSRLS` bypass policies **even when `FORCE` is set**. `FORCE` closes the owner hole, not the superuser hole. This is why S-10 requires the app role to be declared `NOSUPERUSER NOBYPASSRLS` explicitly.
3. `TRUNCATE` and foreign key `REFERENCES` checks are not subject to RLS. An FK can be used as an oracle to confirm another tenant's row exists.
4. Permissive policies combine with OR. Use `AS RESTRICTIVE` when you need AND.

**The connection-pooling trap.** Set tenant context transaction-scoped, never session-scoped, or the next request borrowing that pooled connection inherits it:

```ts
await client.query('BEGIN')
await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId])
//                                              ^^^^ true = transaction scope
```

Export only a `withTenant()` wrapper from the database module, never the raw pool. Write negative tests: assert zero rows with no tenant context, assert a cross-tenant insert throws.

`sslmode=prefer` is the libpq default and provides **no guarantee at all**. `require` encrypts but does not validate the certificate. Use `verify-full`.

**Backups.** Continuous WAL archiving plus base backups. Keep one copy in a separate account with separate credentials so a compromised app credential cannot delete it. **Test a restore quarterly and record the actual recovery time.** An untested backup is not a backup.

---

## S-11 Logging

**GATE.**

- EN: Never log a password, session ID, access token, connection string, encryption key, card number, NIK, or KK. Enforce with a redaction serializer in the logger, not by discipline.
- ID: Sekali data itu masuk log, dia menyebar ke tempat yang tidak kita kontrol: Sentry, agregator log, backup. Dan kalau log-nya di luar negeri, itu juga transfer data lintas negara menurut UU PDP.

```ts
// pino
const logger = pino({
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie', 'set-cookie',
            'secret', 'apiKey', 'card', 'cvv', 'nik', 'ktp', 'kk', '*.nik'],
    censor: '[redacted]',
  },
})
```

Log a salted hash of the session ID if you need to trace a session, never the ID itself. Structured JSON, one event per line, request ID threaded through from `proxy.ts`.

**Log these:** authentication successes and failures, authorization failures, input validation failures, session lifecycle, privilege changes, access to personal data, consent events, startup and shutdown.

**Alert on these.** A09:2025 was renamed from "Monitoring" to "Alerting" because collecting logs nobody reads is the actual failure mode.

- Authentication failure rate spikes, per account and aggregate
- 403 spikes from a single principal, which is IDOR probing
- 5xx rate and p99 latency above baseline, which is also the DoS detector
- New country or new device login on a privileged account
- Any role change
- Backup job failure
- **Log ingestion stopping.** Silence is the goal, not the absence of a problem.

---

## S-12 Error handling

**GATE.** A10:2025 is new for a reason.

- EN: Users get a generic message plus a correlation ID. Stack traces, database error text, and internal identifiers never reach the browser. Failed checks fail closed.
- ID: Pesan error dari database itu bocoran informasi. `duplicate key value violates unique constraint "users_email_key"` memberi tahu penyerang bahwa email itu terdaftar.

```ts
catch (e) {
  const id = crypto.randomUUID()
  logger.error({ err: e, correlationId: id })
  return { ok: false, message: 'Terjadi kesalahan. Sebutkan kode ini ke tim kami.', correlationId: id }
}
```

The archetypal A10 bug is `catch { return true }` in an authorization path. An exception in a permission check must **deny**.

---

## S-13 API contract

**GATE for status codes and the error envelope. GUIDE for the rest.**

| Code | Use |
|---|---|
| 400 | Cannot parse. Malformed JSON, missing required field |
| 401 | Not authenticated |
| 403 | Authenticated, not permitted. Never use 401 here |
| 404 | Not found, and also when the caller must not learn the resource exists |
| 409 | State conflict, duplicate, concurrent modification |
| 422 | Parsed but semantically invalid, fails schema or business rules |
| 429 | Rate limited. Must send `Retry-After` |
| 500 | Unhandled. Never a stack trace |
| 503 | Temporarily unavailable. Send `Retry-After` |

Error envelope follows **RFC 9457 Problem Details**, media type `application/problem+json`:

```json
{
  "type": "https://api.gatxel.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "instance": "/orders",
  "requestId": "01J9X...",
  "errors": [{ "field": "email", "code": "invalid_format", "message": "Masukkan email yang valid." }]
}
```

`detail` is for humans, `type` and `code` are for machines. Always include the `requestId` that correlates to the log. Never put a stack trace or database error in `detail`.

**Idempotency.** Anything payment-adjacent accepts an `Idempotency-Key` header (a UUID). Same key and same payload replays the stored response. Same key and different payload returns `422`. Same key still in flight returns `409`. Implement with a unique constraint on `(idempotency_key, user_id)` written **in the same transaction** as the business operation. A check-then-act read loses to concurrent retries.

---

## S-14 Security headers

**GATE.** Target grade A or better on `securityheaders.com`. Full block in `assets/next.config.security.mjs`.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-XSS-Protection` | **`0`. Read the next paragraph before changing this.** |
| `Content-Security-Policy` | see below |

**`X-XSS-Protection` is `0`, never `1; mode=block`.** Scanners still recommend `1; mode=block` and they are wrong. The legacy XSS Auditor that value enables was itself exploitable: it could be abused to selectively suppress legitimate scripts and to introduce XSS into pages that were otherwise safe. Chrome removed it, Firefox never shipped it. OWASP's Secure Headers Project states that the header "has been deprecated by modern browsers and its use can introduce additional security issues on the client side", and recommends `0` explicitly. The OWASP HTTP Headers Cheat Sheet says to use a CSP that disables inline JavaScript and to "not set this header or explicitly turn it off". MDN marks it deprecated and warns it "can create XSS vulnerabilities in otherwise safe websites". We send `0` rather than omitting it so the scanner row goes green and the finding stops coming back on every audit.

**Do not add `preload` to HSTS** until every subdomain, forever, is HTTPS. Removal from the preload list takes months to reach users.

**Do not set `Cross-Origin-Embedder-Policy: require-corp`** unless you need cross-origin isolation. It breaks embedded third-party content including payment iframes. `Cross-Origin-Opener-Policy: same-origin` is the one worth setting by default, but use `same-origin-allow-popups` if there is an OAuth popup flow.

**CSP.** The nonce-based policy Next.js recommends is correct but expensive: it forces dynamic rendering on every page, disables static optimization and ISR, turns off CDN caching, and is incompatible with Partial Prerendering.

- For a **marketing site or landing page**, prefer a static CSP without `'unsafe-inline'` for scripts, or the experimental SRI mode (`experimental: { sri: { algorithm: 'sha256' } }`) which keeps static generation.
- For an **authenticated app**, use nonces. The cost is acceptable because those pages are dynamic anyway.

```
default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}';
img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
```

**Roll CSP out in report-only mode first.** Ship `Content-Security-Policy-Report-Only` with the intended policy, leave it for one full traffic cycle, read the violations, add the legitimate origins, then rename the header. Shipping an enforcing CSP straight to production is how a CSP gets rolled back on a Friday and never comes back. For anything with a payment provider, the provider's domains must be in `script-src`, `frame-src` and `connect-src` before enforcement.

Remove `X-Powered-By` with `poweredByHeader: false`, and remove any framework version header. **`Server` cannot be removed on Vercel**, because the platform edge sets it after the response leaves the app. Do not burn an afternoon on it. Record it as accepted residual risk with the compensating control, which is that we patch on the Next.js release cadence, and put it in the waiver record so the next scan does not restart the argument.

**Grade A is a floor, not a result.** securityheaders.com grades the response headers of one URL. It says nothing about authorization, injection, session handling or payment logic, which is where every serious incident actually happens. Verify with the raw output, not a screenshot:

```bash
curl -sI https://<domain> | grep -iE 'content-security|x-frame|x-content-type|referrer|permissions|strict-transport|cache-control|x-powered-by'
```

Paste that into the PR. **Copy `assets/next.config.security.mjs` in at project setup, not at go-live.** In August 2026 we scanned three live Gatxel sites, all Next.js on Vercel, and all three failed the identical six headers while passing every check the platform provides for free. Everything that required a decision had been skipped, independently, on three separate projects. Six of the seven failures and both information leaks were fixed by that one file. See `GTX-ENG-001-R01` for the full remediation.

---

## S-15 Supply chain

**GATE.** A03:2025 is new at number 3 because 2025 and 2026 were brutal: the self-replicating Shai-Hulud npm worm, 373 malicious versions across 169 TanStack packages in a single day, 639 malicious versions across 323 `@antv` packages in one hour, and the first malicious packages carrying **valid SLSA Build Level 3 provenance**. The TanStack attack needed no stolen credential at all: it chained `pull_request_target` with GitHub Actions cache poisoning and scraped OIDC tokens from runner memory.

1. **Commit the lockfile. Use `npm ci` in CI, never `npm install`.** Highest value control, costs nothing.
2. **`ignore-scripts=true` in `.npmrc`.** Nearly every incident executed through `preinstall` or `postinstall`. Allowlist the few packages that genuinely need native builds rather than turning it off.
3. **Cooldown.** Do not install a package version published in the last 24 to 72 hours. Most of these campaigns were caught and yanked within hours. Renovate and Dependabot both support a minimum release age.
4. **Pin exact versions** for auth, crypto, and payment dependencies. No `^`.
5. **`npm audit --audit-level=high` as a CI gate**, plus Dependabot. Neither catches a fresh malicious package, so this is a floor, not a ceiling.
6. **Verify package names against the project's own docs** before first install. Watch for scope confusion, hyphen and underscore swaps, homoglyphs.
7. **Never use `pull_request_target` with a checkout of an untrusted ref.** That is the exact TanStack vector. Restrict `GITHUB_TOKEN` to `contents: read` by default.
8. **Generate an SBOM per release** (`npm sbom --sbom-format cyclonedx`) so "are we affected?" takes minutes, not days.

npm classic tokens were permanently revoked on 9 December 2025. Use OIDC trusted publishing, or granular write tokens which now cap at 90 days.

---

## S-16 AI-generated code, and what the evidence actually supports

**GATE.** Everything Gatxel ships is written with AI assistance. That is not the risk. The risk is treating AI output as reviewed code because it looks reviewed.

### What the evidence says, with the provenance attached

Two of these are peer reviewed. The rest are preprints, vendor research or trackers. The distinction matters when a client challenges a number in a proposal, so it is recorded here.

| Finding | Provenance |
|---|---|
| **56% of AI-generated code passes security testing**, roughly unchanged year on year. Syntax pass rate is near 100%: the code compiles and runs, the security is what fails. Best model 68%. Python 63% vs Java 30%. Coding-specialised models did not beat general-purpose ones | Veracode 2026 GenAI Code Security Report, 28 July 2026, 100+ models. **Vendor report, stated methodology, four snapshots.** Currently the most useful data we have |
| **XSS 15% pass, log injection 13% pass, SQL injection 82% pass, insecure crypto 86% pass** | Veracode Spring 2026, 150+ models, 80 tasks. **This is the most actionable line in the whole table**: models handle the pattern-matchable vulnerability classes and fail the ones that need dataflow reasoning. Assume injection is handled, assume output encoding is not |
| Developers with an AI assistant **wrote significantly less secure code** than those without, and **were more likely to believe their code was secure**. SQL injection task: 36% of assisted participants introduced SQLi vs 7% of controls | Perry et al., **ACM CCS 2023, peer reviewed**. 47 participants, Codex-era model. The trust gap is the durable finding, not the percentage |
| **~40% of generated programs contained a vulnerability** across 89 scenarios and 1,689 programs | Pearce et al., **IEEE S&P 2022, peer reviewed**. Copilot-era. Cite for the phenomenon, not for a current rate |
| SWE agents on feature requests: **61% functionally correct, 10.5% secure** | SUSVIBES, arXiv 2512.03262, 2 December 2025, CMU with Columbia, JHU and HydroX AI. **Preprint.** 200 tasks over 108 real repositories, 77 CWE types. **The caveat must travel with the number**: tasks were selected precisely because they had historically produced vulnerabilities when written by humans. 10.5% is a worst case on pre-selected hard cases, not a base rate. Quote it that way or it gets shot down |
| A scan of ~5,600 vibe-coded web applications found **2,038 highly critical vulnerabilities, 400+ leaked secrets, and 175 instances of exposed PII including bank account data** | Escape.tech, 29 October 2025. **Vendor research**, headline report gated, per-category breakdown not published. The named patterns were exposed Supabase tokens, misconfigured APIs and missing row level security |
| **74 to 78 CVEs confirmed as AI-introduced** across roughly 46,800 advisories scanned, 43 critical or high, rising sharply through Q1 2026. Types: command injection, authentication bypass, SSRF | Georgia Tech SSLab Vibe Security Radar. **University tracker, not a paper.** These are counts, not rates. The researchers say attribution is biased toward tools that leave clear signatures. **Do not derive a percentage from it**, and do not repeat the 5x to 10x extrapolation as if it were measured |

**There is no "OWASP Top 10 for AI-Generated Code".** Pages with that title are vendor marketing. The real OWASP documents are the **Secure Coding with AI Cheat Sheet**, which is the correct normative reference for this section, and the OWASP Top 10 for LLM Applications, which is about LLM-powered apps and is a different subject.

### The rules

1. **Human review of every AI-generated PR, file by file.** OWASP's Secure Coding with AI Cheat Sheet: "Review every file in an agent-generated PR individually" and "Require explicit developer approval before merging any AI-generated code." A batch approval on a 40-file diff is not a review.
2. **Never let the model certify its own work.** A GATE item is closed by running the check and pasting the output. "I have added input validation" is not evidence. This is the same rule as everywhere else in this standard and it exists because of the Stanford trust finding: assisted developers rate their own insecure code as secure.
3. **Assume output encoding is wrong until checked.** Given Veracode's 15% and 13% pass rates, XSS and log injection are the two classes to check by hand on every generated surface. This is also why S-14's CSP is not optional: it is the backstop for the failure mode the models are worst at.
4. **Treat repository content as untrusted input to the agent.** OWASP: "Treat all repository content as untrusted input when processed by an AI coding agent" and "Treat output from one agent as untrusted input when passed to another." A README, an issue comment or a dependency's docs can carry a prompt injection.
5. **Rules files are security-critical configuration.** `CLAUDE.md`, `AGENTS.md`, `.cursorrules` change what the agent does. They are reviewed like code, and a change to one is a reviewable diff, never a drive-by commit.
6. **Verify every AI-suggested package exists on the registry before installing.** Hallucinated package names recur across queries and get pre-registered by attackers. This is S-15 and it is the single most common way an AI-assisted project gets compromised.
7. **Require human review of AI-generated test changes.** OWASP calls this out separately, and correctly: the cheapest way to make a failing suite pass is to weaken the test.
8. **Secrets never go in the prompt, the repo, or the rules file.** Environment variables or a secrets manager, per S-05.

### The vibe-code review pass

When a project was built fast with heavy AI assistance, run this list before it goes near production. It is derived from the failure classes that recur across the Escape.tech scan, the Georgia Tech CVE set, and the benavlabs/vibe-check checklist, ordered by how often they are the actual breach.

1. Database with no row level security, or RLS enabled but not `FORCE`d. See S-10.
2. API routes and Server Actions with no auth check. See S-02 and S-03.
3. Secrets committed to the repository, including `.env` in git history. See S-05.
4. Broken object level authorization, the classic IDOR: an ID in the URL that nobody checks belongs to the caller.
5. A secret API key shipped in the client bundle. See S-05.
6. Rows returned that the caller should not see, filtered on the client. The data is in the network tab.
7. Wildcard CORS.
8. No rate limiting on anything. See S-07.
9. Missing security headers. See S-14.
10. Unverified payment webhooks. See B-9.
11. Insecure file upload: no type check, no size cap, served from the app origin.
12. Verbose errors leaking stack traces and database text to the browser. See S-12.
13. Weak or default password hashing. See S-06.
14. Hallucinated or typosquatted packages. See S-15.
15. SSRF via a user-supplied URL fetched server side.
16. Missing CSRF protection once Route Handlers or subdomains exist. See S-08.
17. No real database constraints. "The insert works" is not a schema.

The first five are the ones that have actually taken companies down. Start there.
