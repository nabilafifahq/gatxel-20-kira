# Login, signup and onboarding

**Tier: GATE for the accessibility and standards items, HOUSE for the rest.**

The security of authentication is in `security-gates.md` S-01 to S-07. This file is the **page**: the markup that makes it work, the states, and what happens after signup. A login page can be cryptographically perfect and still be unusable, untrustworthy, or a WCAG failure.

---

## Q-01 The markup, which is where most login pages actually fail

**GATE where it is a WCAG requirement, HOUSE otherwise.**

| Purpose | `type` | `inputmode` | `autocomplete` | Notes |
|---|---|---|---|---|
| Username or identifier | `email` or `text` | | `username` | add ` webauthn` as the **last** token for passkey autofill |
| Current password | `password` | | `current-password` | |
| New password | `password` | | `new-password` | on **both** the new and the confirm field |
| One-time code | `text` | `numeric` | `one-time-code` | `pattern="\d{6}"`. **Never `type="number"`**, it strips leading zeros and shows a spinner |
| Email as data | `email` | | `email` | |
| Phone with country code | `tel` | `tel` | `tel` | |
| Phone, national `08...` | `tel` | `tel` | `tel-national` | normalise to `+628...` server side |

Also `autocapitalize="none"` and `spellcheck="false"` on username, email and password fields. GOV.UK cites spell-jacking, where a spell-checker sends field contents to a third party.

**What actually breaks password manager autofill:**

1. **No `<form>` element**, or one giant form wrapping the whole page. Sign-in gets its own `<form>`.
2. **Randomly generated or build-hashed `name` and `id`.** Chromium requires stable values that do not change between deployments. CSS-module hashes leaking into `id` kill autofill.
3. **`autocomplete="off"` on a password field.** Chromium has ignored it since **2014**: "autocomplete='off' provides virtually no added security for users and websites and it disables password managers." It achieves nothing.
4. **An SPA that never navigates** and leaves the filled form in the DOM. The browser only offers to save when the form disappears. Navigate, or `history.pushState()` **and remove the form from the DOM**.
5. **Blocking paste.** Also a WCAG failure. See Q-03.
6. **Six `maxlength="1"` OTP boxes.** See Q-02.

**The two-step pattern (email, then password) does not break password managers if done correctly.** Chromium's own guidance: "include a form field containing the username in the form used to collect the password. You can hide this field via CSS." Prefer one `<form>` with JS toggling which field is visible. **The failure to ban: a step-two page containing only a password field with no username anywhere.** The manager then cannot decide what to fill or what pair to save.

---

## Q-02 OTP, and the Indonesian reality

**GATE for the input, HOUSE for delivery.**

**NIST SP 800-63B-4, final 31 July 2025:**

- **SMS is restricted, not banned.** If you ship it you must satisfy §3.2.9, all four: offer at least one **non-restricted alternative** at the same AAL, give users **meaningful notice** of the risk, address it in your risk assessment, and hold a **documented migration plan**.
- **Email SHALL NOT be used for out-of-band authentication** at all. Verifying an address is a different thing from authenticating with one.
- OTP: valid **10 minutes maximum**, **at least 6 digits**, and **single use**. "Verifiers SHALL accept a given OTP only once while it is valid."
- Changing the registered phone number is **binding a new authenticator**, and you must consider SIM swap and porting risk.

**One input, never six boxes.** Six `maxlength="1"` inputs break paste, break `one-time-code` autofill, break WebOTP, need JS focus juggling that fights screen readers, and create a WCAG 3.3.8 exposure. If the client wants the segmented look, **style one input** with letter-spacing and a repeating background.

```html
<input required type="text" inputmode="numeric"
       autocomplete="one-time-code" maxlength="6" pattern="\d{6}">
```

**The Indonesian part that generic advice misses.** `autocomplete="one-time-code"` works on Apple platforms and **does nothing on its own in Chrome on Android**, which needs the WebOTP API. WebOTP requires an exact final SMS line, `@domain #123456`, and its transport is **SMS only**.

**So a WhatsApp-delivered OTP cannot be autofilled.** Given how much Indonesian OTP goes over WhatsApp, design for manual copy and paste: make the code easy to select, **allow paste**, do not auto-submit silently, and do not run a tight countdown that expires while the user switches apps.

---

## Q-03 WCAG 3.3.8, which quietly bans several common patterns

**GATE. Level AA, new in WCAG 2.2, and it targets login specifically.**

> "A cognitive function test (such as remembering a password or solving a puzzle) is not required for any step in an authentication process unless that step provides at least one of the following: **Alternative, Mechanism, Object Recognition, Personal Content**."

A cognitive function test is "a task that requires the user to remember, manipulate, or transcribe information." What that bans, concretely:

- **Text and audio transcription CAPTCHA fails AA.** W3C is explicit that an audio alternative requiring transcription cannot satisfy the Alternative exception.
- Object-recognition CAPTCHA ("select the traffic lights") passes AA and **fails AAA** (3.3.9).
- **Blocking paste in a password or OTP field fails.** "Blocking people from pasting into authentication fields would force the user to transcribe information and therefore fail this criterion."
- **Blocking password managers fails.**
- **Manual transcription of a 2FA code fails.** "A service that requires manual transcription of a verification code is not compliant. It must be possible for a user to at least paste the code."
- Memorised security questions, and "type the 3rd and 5th character of your password."

Three independent standards agree on paste, which makes it non-negotiable: **WCAG 3.3.8, NIST §3.1.1** ("SHOULD permit claimants to use the paste function"), and **OWASP** ("allow users to paste into the username, password, and MFA fields").

**SC 3.3.7 Redundant Entry, Level A**, adds one more: previously entered information must be auto-populated or selectable. Re-entering a **new password** for validation is explicitly carved out, so "confirm password" is defensible. **"Confirm email" is not** — you already have it.

**Default to honeypots plus rate limiting.** Escalate to a challenge only on risk signals. W3C's own note reports researchers defeating Google's audio reCAPTCHA at a **90% success rate using Google's own speech-to-text**.

---

## Q-04 Passkeys: implement, do not mandate

**HOUSE.**

**Recommendation: ship conditional UI on every login page, offer enrolment after first successful login and at password reset, and keep password plus OTP as full-status alternatives forever.**

Passkeys are the only mechanism here that is phishing-resistant by definition. NIST names WebAuthn as the example, and states that OTP and out-of-band methods "SHALL NOT be considered phishing-resistant."

**But the Indonesian device reality argues against defaulting:**

- Creating a passkey **requires a device screen lock**. Many low-end Android users run none.
- Third-party credential providers only from **Android 14+**. Below that the passkey is welded to a Google account the user may share, lose, or not be signed into.
- Cross-device sign-in needs Bluetooth, a camera and a second device. That is not a shared-family-phone user.
- **Samsung Internet is not on the conditional-UI support matrix at all**, and it is a real share of Indonesian mobile browsing.

FIDO's own guidance agrees: allow account creation with or without a passkey, and prompt at settings and recovery moments rather than during sign-in.

**Be adversarial about the adoption numbers.** The widely quoted "75% have enabled a passkey" figures come from a self-reported online panel commissioned by the trade body that promotes the technology, sampling ten countries, **and Indonesia is not one of them.** Directionally interesting. Not a planning input, and not for a client deck.

---

## Q-05 Social login: fewer buttons than you think

**HOUSE.**

**The hard constraints, which are not opinions:**

- **Apple App Store Guideline 4.8.** If you use **any** third-party social login to set up the primary account, you must also offer Sign in with Apple or an equivalent. The exception: "Your app exclusively uses your company's own account setup and sign-in systems." **Adding one Google button to an iOS app buys you an entire Sign in with Apple integration. Adding no social button costs you nothing.**
- **Guideline 5.1.1(v).** Account creation requires **in-app account deletion**. Budget for it. This is also G-21 in the store release section.

**Account linking is a security problem, not a UX problem.** *Pre-hijacked accounts*, USENIX Security 2022, found **35 of 75 popular services** vulnerable to at least one of five pre-hijacking classes, some "completely undetectable from the victim's perspective." The root cause is exactly this feature. Rules:

1. An account is not usable until the email is verified, **or**, on verification, invalidate every session, token and credential created before it.
2. **Never auto-link** a federated identity to an existing password account on email match alone. Require the existing credential first.
3. Auto-link only on `email_verified: true` from a provider whose verification you trust. Facebook may return no email, or an unverified one.
4. On any credential or linked-identity change, invalidate all sessions.

**Conversion evidence does not exist.** Every "social login increases conversion by X%" result traces to a company selling social login. Do not quote one.

**Minimal correct set for an Indonesian consumer audience:** Google, and that is usually it. Apple only if you ship an iOS app **and** you already offer another provider. **Skip Facebook**: weaker email guarantees, an App Review dependency on Meta's schedule, it triggers 4.8, and there is no credible evidence of a lift. Add **WhatsApp or SMS OTP as an identifier**, not as a social provider. That is the real Indonesian pattern.

Store `last_used_auth_method` per account and hint it on the email step. **Never render a password field for an account that has no password.** That is where support tickets come from.

---

## Q-06 States, and where security and UX genuinely conflict

**GATE.**

| State | Correct behaviour |
|---|---|
| **Wrong password** | One generic message. Same status code, same response time |
| **Unknown account** | Byte for byte identical to wrong password |
| **Locked or throttled** | Generic message plus delay. **You cannot say "account locked" without confirming the account exists.** Tell the real owner by email |
| **Unverified email** | Reveal only **after** successful authentication. At that point the user has proven credential possession, so it leaks nothing |
| **Expired session** | Never lose work. Re-authenticate in place and return to the same URL. Accept only same-origin **relative** return paths |
| **Password reset** | Always the same message, same timing. Token: CSPRNG, hashed at rest, **single use**, short expiry. **Do not auto-login after reset.** Invalidate other sessions. Rate limit per account so an attacker cannot spam a victim's inbox |

Session timeouts, from NIST: AAL1 overall **30 days** maximum; AAL2 **12 hours overall, 15 minutes inactivity**... use AAL2's stricter shape for anything holding money or personal data, and see S-01 for the Gatxel default.

**Three places where the conflict is real, and we resolve them explicitly:**

1. **Enumeration versus "you do not have an account yet."** If signup is open and keyed on email, the service is **already enumerable through the registration endpoint**. So: be enumeration-resistant on login and reset, where it costs nothing, accept that registration leaks, and mitigate with rate limiting plus a "someone tried to register with your address" notice to the existing owner.
2. **Lockout versus denial of service.** A hard "lock after 5 failures" hands any attacker a free account-DoS. **NIST's actual number is 100 consecutive failures**, plus escalating delays from 30 seconds up to an hour, plus risk signals, and reset the counter after a success.
3. **Not auto-logging in after a reset.** Users hate it, OWASP says do not. Resolution: pre-fill the username, land on the login form with a success banner.

---

## Q-07 What a professional login page looks like

**HOUSE.** Checkable properties, not taste.

- A **dedicated route**, server-rendered, not modal-only. One `<form>` with only the auth fields.
- Above the fold: heading, **two fields maximum**, one primary button, "Lupa kata sandi?". Everything else below. This is so the mobile keyboard does not bury the button.
- Single column. **Labels above inputs**, never placeholder-as-label.
- The button says what it does: **"Masuk"**, **"Buat akun"**. Never "Submit" or "Kirim".
- Input font **at least 16px** or iOS zooms and does not zoom back. See K-06.
- Touch targets: 24x24 CSS px is the AA floor, 44x44 is the house target. See K-01.
- **Visible input borders.** `#ccc` or darker on white.
- `autofocus` on the username field on a dedicated desktop route (it also triggers passkey conditional UI). Be careful on mobile, where it raises the keyboard immediately. Never autofocus inside a modal.
- **A show-password toggle, yes.** NIST: verifiers "SHOULD offer an option to display the password." Implement it as GOV.UK does: `type="button"` never submit, `aria-controls` on the input, label swaps Show and Hide, live region announces the state, and the button is hidden until JS loads.

**What makes a login page read as cheap or untrustworthy:**

Mixed content, or the form inside a third-party iframe. "Submit" as the label. Browser-default validation bubbles. Password rules revealed only after the first rejection. A CAPTCHA on the very first attempt. No "Lupa kata sandi?" link. A "Remember me" checkbox with no explanation. Five social buttons in a row. An auto-rotating carousel next to the form. Error text exposing internal state, `user_not_found` or `Error 400`. Mixed Indonesian and English microcopy in one flow.

And the one that matters most in Indonesia: **a footer with no legal entity, no support contact and no privacy link.** Under UU PDP an identifiable controller and a reachable notice are a legal expectation, and their absence is the fastest possible read of "this is not a real company." See P-04.

---

## Q-08 Onboarding: what has evidence, and what does not

**GUIDE.** Almost the entire onboarding literature is written by companies selling onboarding tooling. Be honest about this with clients; it is more valuable than repeating their numbers.

**Supported by real research:**

- **Endowed progress / goal gradient.** Kivetz, Urminsky and Zheng, *Journal of Marketing Research*, 2006. A 12-stamp card with 2 pre-filled beat a 10-stamp card for identical real effort: completion in **12.7 versus 15.6 days**. Replicated. **But it is loyalty-card research, not software onboarding.** Treat "pre-fill the first checklist step" as a well-grounded hypothesis to test, not an established fact.
- **Progress indicators, and the common belief is backwards.** Villar, Callegaro and Yang, meta-analysis of **32 randomised experiments**: constant progress indicators **did not significantly reduce dropout**, slow-to-fast indicators **increased** it, and only **fast-to-slow** reduced it. So "add a progress bar to reduce abandonment" is unsupported. **"Front-load the easy steps so early progress feels fast" is supported.**
- **Product tours help complex products and can hurt simple ones.** Andersen et al., CHI 2012, **45,000+ players** across three games. Tutorials raised play time up to **29% in the most complex game** and **did not significantly improve engagement in the two simpler games**. On-demand help **hurt** the simplest game. **Default to no tour. Earn it with complexity.**
- **Password feedback: the text, not the bar.** Ur et al., CHI 2017, n=4,509. Detailed **text** feedback produced roughly **44% stronger** passwords with no memorability cost. A bare coloured bar is near-worthless. Use specific, actionable text.

**No independent evidence at all.** Onboarding checklists, "time to value" targets, "aha moment" benchmarks, welcome carousels, permission priming, and every "we increased activation by X%" case study. Every source is a vendor selling the thing.

**Strike these two, permanently.** "77% of users abandon an app within 3 days" and "90% within 30 days" trace to Quettra data published by Andrew Chen in **2015**. The numbers are real but the claim is not: it is **DAU decay, not abandonment**, **Android only**, **eleven years old**, and a cross-app mean dominated by a long tail of low-quality apps. It is purely descriptive and says nothing about whether onboarding design moves the curve, which is the only reason anyone cites it. Also strike **"Facebook's 7 friends in 10 days"**, which was never published and is correlational anyway.

**What we actually do**, on judgment rather than false evidence: get the user to the first real outcome with the fewest steps, ask nothing we can derive, defer every optional field, and never prompt for push, location or tracking on launch (that is also G-25).

---

## Q-09 The strike list

| Claim | Verdict |
|---|---|
| Password composition rules: uppercase, digit, symbol | **NIST: "SHALL NOT impose other composition rules."** Use a length floor, a max of at least 64, and a blocklist |
| Forced periodic rotation | NIST: "SHALL NOT require subscribers to change passwords periodically." Zhang et al., CCS 2010: **41% of successor passwords cracked in under 3 seconds** from a known prior |
| Maximum length 16, stripping spaces, rejecting Unicode | NIST: accept at least 64 characters, all printing ASCII **including space**, and Unicode. A short max length is a tell that you are not hashing |
| Blocking paste | Fails NIST, OWASP **and WCAG 3.3.8** |
| `autocomplete="off"` on passwords | Ignored by Chromium since 2014. Pure downside |
| "Confirm email" field | WCAG 3.3.7 Redundant Entry exposure. You already have it |
| Disabled submit until the form validates | A disabled button is not focusable and announces nothing. Validate on submit, show an error summary, move focus to it |
| CAPTCHA on every login | Transcription CAPTCHAs **fail WCAG 3.3.8 at AA**, and audio reCAPTCHA is defeated at a 90% rate using Google's own speech-to-text |
| "Lock the account after 5 failed attempts" | NIST says **100**, with escalating delays. A 5-strike lock is a free DoS against your own users |
| Security questions | Gone from NIST, and a textbook 3.3.8 cognitive function test with no exception available |
| SMS OTP as the only second factor | **Restricted.** §3.2.9 requires an alternative, user notice, a risk assessment, and a **migration plan** |
| Six separate OTP boxes | Breaks paste, `one-time-code` autofill and WebOTP. Style one input |
| A bare coloured strength bar | Underperforms detailed text feedback by a wide margin |
| Leading with "Login with Facebook" | Triggers Apple 4.8, adds a Meta review dependency, weakest email guarantee, and no credible evidence of a lift |
| "77% abandon in 3 days" | Android-only DAU decay from 2015, misstated. See Q-08 |
