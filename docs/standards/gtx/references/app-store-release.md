# GTX-ENG-001 / G. App and store release

All **GATE**. Nothing is submitted to Apple or Google without this sheet signed.

A rejection is not a bug, it is a lost week. Apple reviewed over 9.1 million submissions in 2025 and rejected **over 2 million**, roughly 22%. The largest published rejection bucket is **privacy**, over 443,000, which is the 5.1.x family.

---

## G-00 The three rejections we already ate, diagnosed

| What Apple said | Actual rule | Verdict |
|---|---|---|
| No account deletion | **5.1.1(v)**, mandatory since **30 June 2022** | Written rule, clear cut |
| ToS not shown before sign-up | **Not a published guideline.** It is 1.2 enforcement boilerplate | See G-03, this is the one that bites twice |
| No block and report | **1.2**, bullets 2 and 3 | Written rule, clear cut |

All three cluster into one root cause: we shipped a **user-generated content app** without the 1.2 package. Reviewers apply 1.2 as a **six-item** checklist even though Apple publishes **four**. That gap is why rejection two felt arbitrary.

---

## G-01 Account deletion, built once for both stores

**GATE.**

- EN: One deletion implementation, exposed from **two** surfaces. In-app path in account settings, reachable in three taps or fewer, plus a public web URL that does not require reinstalling the app.
- ID: Apple wajib in-app. Google wajib **dua-duanya**, in-app dan link web. Bikin satu endpoint, pasang di dua tempat.

**Deactivation is not deletion.** Apple's wording: "only offering to temporarily deactivate or disable an account is insufficient."

The flow:

1. Reauthenticate with password, biometric, or OTP.
2. Show exactly what gets deleted and what is retained, with the retention period and the legal basis.
3. Deactivation may appear as a **secondary** option, never as the only one.
4. Destructive confirmation, type DELETE or double confirm.
5. Confirmation screen **and** email.

**What must actually be deleted:** profile, credentials, auth tokens, personal data, payment records, the user's own content, uploaded media, push device tokens, analytics identifiers tied to the account, and **records sitting in third-party processors**. A soft-delete flag in Postgres while the row still lives in Mixpanel is a Data Safety mismatch, which is an enforcement trigger.

**Sign in with Apple: you must call the [revoke tokens REST API](https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens/).** Skipping it is a documented rejection.

**Grace periods.** Neither store publishes a maximum. The safe design is: revoke access immediately, sign out everywhere, hide the user's content, and hard-purge on a fixed timer disclosed in the privacy policy. A grace period during which the user can still log in normally reads to a reviewer as deactivation.

**Legal retention.** Both stores allow retention for security, fraud prevention, and regulatory compliance, but only if disclosed. For the Indonesian telco and payments work this is real. The correct pattern: **delete the account and all product data, retain only the legally mandated transaction records in a segregated, access-restricted store keyed to a pseudonymous ID**, with the retention period stated in the privacy policy. Never use "we have legal obligations" as a reason to skip deletion.

---

## G-02 User-generated content, the six-item bar

**GATE for any app where one user can see another user's content.** That includes comments, reviews, profiles, chat, and photo uploads.

Apple publishes four requirements under 1.2:

1. A method for **filtering objectionable material** before it posts
2. A mechanism to **report offensive content**, with timely response
3. The ability to **block abusive users**
4. **Published contact information** inside the app

The rejection letter adds two more that are not in the published text:

5. **Users must agree to terms that state zero tolerance for objectionable content and abusive users**
6. **Act on reports within 24 hours**, remove the content and eject the user

**Build to six.** Google writes the terms rule down explicitly in its UGC policy: "Require users to accept the app's terms of use and/or user policy **before users can create or upload UGC**." Google also splits the requirements: closed communities need report, direct messaging needs block, public UGC needs both report and block.

**Live deadline: 26 August 2026.** Google's Child Safety Standards, Age-Restricted Content, and Families policies expand to cover **anonymous and random chat apps**. Apple made the same move on 6 February 2026. If any Gatxel product has anonymous or random matching, check it now.

---

## G-03 Legal pages and where each one must live

**GATE.**

| Document | Apple | Google |
|---|---|---|
| Privacy policy | **5.1.1(i): App Store Connect metadata field AND inside the app.** Both, not one | App content, store listing, **and** inside the app |
| Terms of use | Schedule 2 §3.8(b): links accessible in the app for subscriptions. Custom EULA must meet Exhibit D minimums or Apple's standard EULA applies | **Must be accepted before creating or uploading UGC** |
| Data deletion URL | Not separately required | **Required**, declared in the Data safety form |
| Contact info | 1.2, published in the app for UGC apps | Verified developer email and phone shown on Play |

Host these on a stable path on the client's own domain: `/privacy`, `/terms`, `/hapus-akun`. **Not a Notion page, not a Google Doc.** Reviewers flag editable documents as unstable.

**Do not rely on Apple's standard EULA if the app has UGC.** It does not contain the zero-tolerance clause that rejection item 5 requires.

---

## G-04 Sign-in rules that catch web-first teams

**GATE.**

- **5.1.1(v):** "If your app doesn't include significant account-based features, let people use it without a login." A login wall over a browsable catalogue is a rejection.
- **5.1.1(x):** basic contact information requests must be **optional**, and features may not be conditional on providing it.
- **5.1.2(i):** you may not require push notifications, location, or tracking to access functionality. As of 13 November 2025 this also requires clear disclosure and explicit permission where **personal data will be shared with third-party AI**.
- **4.8:** if you offer any third-party social login as the primary account, you must **also** offer an option that limits collection to name and email, allows the user to keep their email private, and does not collect app interactions for advertising. Sign in with Apple satisfies it. Email and password only does not trigger 4.8. Adding "Continue with Google" triggers it immediately.

---

## G-05 The agency trap

**GATE.**

**4.2.6:** apps from "a commercialized template or app generation service will be rejected unless they are submitted directly by the provider of the app's content."

**Submit every client app from the client's own Apple Developer account, not from Gatxel's.** A pile of similar apps under one agency account reads as a template farm. The same logic sits in 5.1.1(ix): regulated-field apps "should be submitted by a legal entity that provides the services."

**4.2 Minimum Functionality:** "Your app should include features, content, and UI that elevate it beyond a repackaged website." A WebView wrapper around a Next.js site is a rejection. 4.2.2 names "web clippings" explicitly.

**4.3(b), tightened June 2026:** Apple may remove apps that are indistinguishable from what already exists "if they are not updated, improved, **or do not attract customers**." Low-install client apps can now be removed after launch. Tell the client this before they commission a thin app.

---

## G-06 Payments

**GATE.**

Unlocking features or content inside the app **must use In-App Purchase**. No license keys, no QR codes.

Where IAP is **not** allowed or not required (3.1.3):

- **(e) Goods and services consumed outside the app.** Physical goods and real-world services "must use purchase methods other than in-app purchase." Mandatory, not optional. Physical SIM cards, handsets, and pulsa delivered to a real number belong here.
- (d) person-to-person real-time services between two individuals, (a) reader apps, (b) multiplatform services, (c) enterprise, (f) free companion apps.

**External purchase links are a United States carve-out only.** The guideline says so directly: the prohibition on external purchase CTAs applies "in all other storefronts, except for the United States storefront." For Indonesia you need a StoreKit External Purchase Link Entitlement, and only where Apple enables it. Do not ship one binary with an external payment button and hope.

*The US commission rate on external links was still moving through the courts as of August 2026. Check App Store Connect before modelling revenue.*

**Personal loans, both stores.** Apple 3.2.2(ix) caps APR at **36% globally** and bans repayment in full in 60 days or less. Google requires the same disclosures and, for Indonesia specifically, requires a copy of a valid licence under **OJK Regulation No. 77/POJK.01/2016** for IT-based money lending. Google also bars lending apps from accessing contacts, photos, precise location, external storage, phone numbers, and video. Financial apps must be submitted by the licensed legal entity, which is the client, not Gatxel.

---

## G-07 Privacy plumbing

**GATE.**

**Privacy Nutrition Labels** must cover data collected by **third-party SDKs**, not just our own code.

**Privacy manifests (`PrivacyInfo.xcprivacy`)** have been hard-enforced since **1 May 2024**. This is an **upload-time block in App Store Connect**, so you never even reach a reviewer. The required-SDK list hits common stacks: Flutter, Capacitor, Cordova, all the Firebase pods, GoogleSignIn, FBSDKCoreKit, OneSignal, Alamofire, Lottie, SDWebImage, and most Flutter plugins.

**Required-reason APIs:** file timestamp, system boot time, disk space, active keyboard, user defaults. *Verify the exact `NSPrivacyAccessedAPIType` key strings in Xcode's privacy manifest editor. Apple's documentation page is JavaScript-gated and could not be retrieved for this standard.*

**App Tracking Transparency:** the prompt is required to track or to read IDFA. Prohibited: gating functionality on consent, incentivising consent in the prompt, and falling back to hashed email, phone, or fingerprinting after a decline.

**Play Data safety form:** declare data types, required versus optional, encryption in transit, and the deletion mechanism. Third-party liability is explicit: "This includes data collected and handled through any third-party libraries or SDKs." A mismatch between the form and actual behaviour is an enforcement trigger. Zero-collection apps still have to complete the form.

---

## G-08 Google Play specifics with live deadlines

**GATE. Three of these land within weeks of this document's effective date.**

| Deadline | Requirement |
|---|---|
| **31 August 2026** | New apps and updates must target **Android 16 / API 36** (phone and tablet). Extension available to 1 November 2026 via Play Console. Below the bar, the app stops being discoverable to users on newer Android versions |
| **26 August 2026** | UGC policy expansion to anonymous and random chat. Also, geofencing is removed as an approved foreground-service use case |
| **30 September 2026** | **Android developer verification. Indonesia is in the first wave**, with Brazil, Singapore, and Thailand. Apps must be registered by a verified developer to be installed or updated on certified Android devices, **including by sideloading**. Register package names in Play Console with an APK signed by the production key |
| January 2027 | Broad contacts access requires the Android Contact Picker. `READ_CALL_LOG` may no longer be used for phone-call account verification, which affects telco onboarding flows |

**The 30 September developer verification deadline is the most Indonesia-specific item in this whole standard.** Every APK we hand a client to sideload, every internal build, every staging distribution to an Indonesian device needs a registered package name. Audit signing keys and package names now.

**Closed testing:** personal developer accounts created after 13 November 2023 need **12 testers opted in for 14 continuous days**, and the testers must actually install and use the app. **Organisation accounts are exempt.** So: register client apps under **organisation accounts** with a D-U-N-S number. D-U-N-S issuance can take up to 30 days, so start it at kickoff, not at launch.

**Restricted permissions.** For an avatar upload, use the **Android Photo Picker**. Never request `READ_MEDIA_IMAGES`. Having your own custom picker does not qualify you for broad access. `QUERY_ALL_PACKAGES` is prohibited for analytics or ads. SMS and Call Log require being the default handler.

**Android vitals thresholds.** Breach these and the app becomes less discoverable, with a warning possible on the listing:

| Metric | Bad behaviour threshold |
|---|---|
| User-perceived crash rate, all devices | 1.09% of daily users |
| User-perceived ANR rate, all devices | **0.47%** of daily active users |
| Either, on a single device model | 8% |

That ANR number is tight. On 10,000 daily users, **47 people hitting one input-dispatch ANR in a day trips it.** Watch main-thread work in WebView-heavy hybrid apps.

---

## G-09 The demo account, and why reviews reset

**GATE. Guideline 2.1(a).**

Apple: "include demo account info (and turn on your back-end service!) if your app includes a login."

If the reviewer cannot log in, you get a 2.1 rejection and lose a full review cycle. The realistic causes:

- Demo credentials expired
- The rate limiter blocked the reviewer's IP
- OTP sent to a phone number nobody monitors
- **Geofencing that blocks a US-based reviewer from an Indonesia-only backend**
- Staging backend switched off over a weekend

**If the app uses SMS OTP, ship a fixed test OTP for the demo account.** A demo video is not accepted as a substitute.

---

## G-10 Push notifications

**GATE.**

Apple 4.5.4: push "must not be required for the app to function," and may not be used for promotion or marketing without explicit in-app opt-in and an in-app opt-out.

Android 13 and above: `POST_NOTIFICATIONS` is a runtime permission and notifications are **off by default**. Since we must target API 33 or higher anyway, we control when the dialog appears. If the user denies, we cannot re-prompt.

**Rule: never prompt on launch.** Prompt at the moment of value, with our own explainer screen first, and provide per-category opt-out in settings.

---

## G-11 Age ratings

**GATE.**

Apple retired 12+ and 17+. The tiers are now **4+, 9+, 13+, 16+, 18+**. "An Unrated app can't be published."

**Live item:** the questionnaire added **social media questions** on 9 July 2026, and responses become **required in September 2026** for new apps, updates, and notarization, regardless of category. A social media capability means "the ability to redistribute, amplify, or interact with user-generated content through a social feed or similar discovery method." Any Gatxel UGC app is in scope.

---

## G-12 Pre-submission smoke test

**GATE. Run on a clean device, clean install, a non-developer account, from a non-office network, ideally from a US IP.**

Any failure stops the submission.

- [ ] Fresh install, first launch, no crash. Background, foreground, kill, relaunch
- [ ] **The demo account logs in right now**, from a US IP, not rate limited, OTP resolvable
- [ ] Account deletion works end to end from inside the app, and the web URL works without reinstalling
- [ ] Report and block both work, and produce a visible result
- [ ] ToS acceptance appears **before** account creation, and the ToS contains the zero-tolerance clause
- [ ] Privacy policy link works from inside the app **and** is set in the store metadata
- [ ] No feature is gated on granting push, location, or tracking
- [ ] Every permission prompt appears in context, after a user action, with a purpose string that names the benefit
- [ ] IAP items are complete, visible, and functional in the sandbox
- [ ] `targetSdk` meets the current Play requirement
- [ ] Package name registered in Play Console under a verified developer
- [ ] Data safety form matches actual behaviour, including every SDK
- [ ] Privacy manifest present for every listed third-party SDK
- [ ] Age rating questionnaire complete, including the social media questions
- [ ] App works with no network, and with a slow network, without hanging forever
- [ ] Nothing in the build says Lorem, Test, John Doe, or points at a staging URL

---

## G-13 Indonesian angle

- **PSE registration** applies to the app operator the same way it applies to a website. Settle in the contract whether Gatxel or the client registers, and register **before** users touch the system. See section B-8.
- **Developer verification for certified Android devices lands in Indonesia on 30 September 2026**, ahead of the global rollout in 2027.
- Financial and lending apps need the OJK licence copy for Google, and must be submitted by the licensed entity for Apple.
