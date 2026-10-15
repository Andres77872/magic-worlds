# Gap closure: licensing, OEM and reseller terms, content policy and age requirements

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Read-only research. No code, configuration or database was touched, no API key was used and no paid API was called.

## Scope

This note closes critic gaps **G1** (Voice Library licensing for a B2C app, attribution, owner and Live Moderation restrictions, and how a moderated request fails) and **G16** (whether the current 18+ mechanism is adequate). It also covers the policy half of owner decisions **#2** (plan tier) and **#16** (content policy) from [09_research_critic_gaps.md](./09_research_critic_gaps.md).

It answers five questions:
1. May a consumer app let its users pick and hear Voice Library and Default voices? Which plans allow it, and is attribution required?
2. What do the ElevenLabs rules say about content that matters to an AI roleplay and companion app, and what does ElevenLabs do technically when content breaks them?
3. What age rules apply to end users, and what must the app operator do? How does the current magic-worlds mechanism compare?
4. What must the operator do to clone a voice: consent, verification, no-go voices, records?
5. Data obligations, limited to what [05](./05_elevenlabs_platform_pricing_limits_policy.md) is missing or gets wrong.

It ends with what this means for magic-worlds and a list of items that need written confirmation from ElevenLabs.

**Quoting policy.** Contract text is copyrighted. This note paraphrases clauses closely and gives the section number and URL, so a reader can check the exact wording. Apart from defined terms and a few two- or three-word terms of art, it quotes one phrase verbatim: the PUP §12 "more permissive" wording. Every legal reading here is an engineering interpretation, not legal advice. A lawyer must review it before launch.

### Confidence markers

| Marker | Meaning |
|---|---|
| `[verified: URL]` | Read today (2026-10-12) on an official ElevenLabs page. |
| `[secondary: URL]` | Non-official source: press, a law-firm summary, a third-party support page. |
| `[unverified]` | Inference or a claim that could not be confirmed. |
| `[code: path:line]` | Read today in the frontend or backend repository. |

---

## Contents

1. [Key findings](#1-key-findings)
2. [Q1. Library and Default voices in a consumer app](#2-q1-library-and-default-voices-in-a-consumer-app)
3. [Q2. Content rules and ElevenLabs enforcement](#3-q2-content-rules-and-elevenlabs-enforcement)
4. [Q3. Age requirements and the current magic-worlds age gate](#4-q3-age-requirements-and-the-current-magic-worlds-age-gate)
5. [Q4. Voice cloning consent, verification and records](#5-q4-voice-cloning-consent-verification-and-records)
6. [Q5. Data obligations not covered or wrong in 05](#6-q5-data-obligations-not-covered-or-wrong-in-05)
7. [Corrections to earlier notes](#7-corrections-to-earlier-notes)
8. [What this means for magic-worlds](#8-what-this-means-for-magic-worlds)
9. [Items needing written confirmation from ElevenLabs sales or legal](#9-items-needing-written-confirmation-from-elevenlabs-sales-or-legal)
10. [Status of critic gaps and owner decisions](#10-status-of-critic-gaps-and-owner-decisions)
11. [Sources](#sources)

---

## 1. Key findings

1. **No ElevenLabs document says a consumer app may, or may not, let its users choose Voice Library voices.** The Voice Library Addendum records only the sharer's permission for ElevenLabs to offer the voice to other users, and is silent on how users of shared voices may use them. It sets no attribution duty and no ban on use inside apps [verified: https://elevenlabs.io/vla]. The question therefore reduces to the general one: is a consumer app that plays ElevenLabs output an ordinary paid customer, or is it **Making Available** the Services?

2. **The OEM Terms cannot authorise consumer distribution on any self-serve plan.** Free, Starter, Creator and Pro are expressly barred from Making Available (OEM §2.B). A **Business Entity** is an organisation on Scale, Business, Enterprise or an equivalent plan, and the definition expressly excludes individuals acting personally (§1.D). An OEM **End User** must both use the Customer Solution only for its own internal business operations and have signed an End User Agreement (§1.I). A consumer can never be an OEM End User [verified: https://elevenlabs.io/oem-terms]. So **"Scale makes us OEM-eligible" (05 §2.1, §6.9) is only true for B2B.**

3. **The base terms support reading magic-worlds as an ordinary paid customer, provided our terms are no looser than ElevenLabs'.** The evidence:
   - The Prohibited Use Policy (PUP) applies to use through any product or application built with ElevenLabs technology [verified: https://elevenlabs.io/use-policy].
   - PUP §12 forbids making the Services or Output available to your own end users "on terms more permissive than those that apply to you". That wording presupposes that doing so on equal terms is allowed [verified: https://elevenlabs.io/use-policy].
   - The ElevenAPI Terms (new, 2026-10-09) define a **Customer Application** as any app of yours that reaches the Services through the API, and make you responsible for authenticating and authorising its users (§2.3) [verified: https://elevenlabs.io/elevenapi-terms].
   - The ElevenAgents Terms say that letting **Agent Users** (any individual) talk to your deployed agent is not resale, bundling, sublicensing or making the Services available (§1.4). This covers agents and Speech Engine only, not plain TTS [verified: https://elevenlabs.io/agents-terms].

   The risk in this reading is a feature that looks like handing end users the Service itself. PUP §12 bans operating a client, wrapper or proxy that gives anyone else access to the Services outside the applicable terms [verified: https://elevenlabs.io/use-policy]. Free-text "speak anything in any voice" previews, end-user cloning and a live Voice Library browser are the features closest to that line.

4. **Attribution is not required on any paid plan, for any voice type.** It is required only for Free-plan or out-of-subscription output: the title must contain "elevenlabs.io" or "11.ai" [verified: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform.md]. No attribution to a Voice Library owner is required [verified: https://elevenlabs.io/vla]. Using ElevenLabs names or logos as branding (a "Powered by" badge) needs prior written permission (ToS §5(c)) [verified: https://elevenlabs.io/terms-of-use].

5. **Content rules.** The PUP was updated 2026-10-09 and has no fiction or creative carve-out.
   - Banned: sexual content involving minors; explicit sexual imagery; erotic material involving incest, bestiality or necrophilia; non-consensual intimate content; gratuitous gore; encouraging self-harm; hate; impersonating real people without consent; exploiting vulnerability or creating harmful emotional dependency.
   - **Consensual adult erotic text-to-audio is neither allowed nor banned explicitly.** The PUP introduction lets ElevenLabs require prior approval or extra safeguards for higher-risk uses, or restrict them [verified: https://elevenlabs.io/use-policy].

6. **Enforcement is asynchronous and lands on the account, not on the request.** The error catalog has **no moderation error code** [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md]. What exists:
   - AI classifiers, human reviewers and investigations [verified: https://elevenlabs.io/safety];
   - automated flagging of accounts for additional moderation [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md];
   - safety-team access to customer content to check PUP compliance (DPA §13.1.3) [verified: https://elevenlabs.io/dpa];
   - disabling a single API key for misuse without the usual notice and cure period (ElevenAPI Terms §5.1) [verified: https://elevenlabs.io/elevenapi-terms];
   - per-voice `safety_control` values (`BAN`, `CAPTCHA`, `ENTERPRISE_BAN`, `ENTERPRISE_CAPTCHA`) [verified: https://elevenlabs.io/docs/api-reference/voices/search.md].

   One public case: TTS text in a user's own clone was flagged as a threat; ElevenLabs sent an email warning, then a human moderator banned the voice; an appeal reinstated it [secondary: https://technologyreview.com/2025/02/14/1111900/ai-voice-clone-say-arse-then-banned].

7. **Live Moderation:**
   - It is opt-in by the owner of a shared Professional Voice Clone (PVC).
   - It checks request text against prohibited categories that ElevenLabs does not list.
   - It adds latency and is not guaranteed to work.
   - A change to the setting applies only to accounts that add the voice afterwards [verified: https://elevenlabs.io/vla; https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md].

   **How a refused request surfaces is not documented anywhere.** The account voice-search API includes moderated voices by default (`include_live_moderated` defaults to included) [verified: https://elevenlabs.io/docs/api-reference/voices/search.md]. Exclude them explicitly.

8. **Age:**
   - ElevenLabs requires the **account holder** to be 18, or the local age of majority if higher (ToS §1(a)) [verified: https://elevenlabs.io/terms-of-use].
   - It bans apps directed at under-18s unless approved in writing (PUP §1) [verified: https://elevenlabs.io/use-policy].
   - No ElevenLabs document requires the operator to *verify* end-user age.
   - But the "not more permissive" rule (PUP §12), and the OEM flow-down if it applies, mean our end-user terms must also say 18+, and we must be able to show that users agreed.

   **The current magic-worlds gate cannot show that.** It is one dismissible first-run modal per browser, stored in `localStorage` [code: /home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.tsx:7-42]. Nothing is recorded per user on the server. Registration sends only username and password [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py:52-58]. There is no Terms of Service page to accept [code: /home/andres/WebstormProjects/magic-worlds/src/features/legal/components/legalContent.ts:21].

9. **The app's own policy today is "no NSFW at all."** The modal, the About page and the Disclaimer all say so [code: /home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:884,1962,2102]. **No adventure or card has a content rating** in either repository (grep, §4.2). Owner decision #16 ("disable narration for NSFW-rated adventures") therefore has nothing to act on yet. Voice must launch under the existing no-NSFW policy, with a pre-TTS moderation step that does not exist today.

10. **Cloning:**
    - The PUP requires explicit and informed consent from any living person whose voice is cloned, and bans recordings of anyone under 18 [verified: https://elevenlabs.io/use-policy].
    - The Instant Voice Clone (IVC) API has **no consent field** [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create.md]. In the UI, the creator must confirm they have the right and consent [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning.md].
    - Both IVC and PVC can require a voice-CAPTCHA verification by the speaker [verified: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning.md].
    - ElevenLabs' own Creative and Agents terms set the record-keeping standard: keep consent records for the longer of the legal period or **five years**, and produce them on request [verified: https://elevenlabs.io/creative-terms; https://elevenlabs.io/agents-terms]. Adopt the same rule for the root clone console, which today records no consent at all [code: /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:43-150].

11. **The licensing floor for production is Scale, contracted by a legal entity, plus written confirmation from ElevenLabs.**
    - **Licence floor.** Any paid plan grants a commercial licence. The app sells subscriptions [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/billing_subscriptions.py:425-555], so Free is out.
    - **Why Scale.** It is the lowest **Business Entity** tier. If any feature drifts into Making Available, Starter to Pro would be expressly barred.
    - **Why confirmation.** Even Scale does not cover consumers *if* ElevenLabs says we are Making Available; that would need Enterprise or custom terms.

    §8.1 has the reasoning, §9 the questions.

---

## 2. Q1. Library and Default voices in a consumer app

### 2.1 The documents and which ones bind us

| Document | Last updated | Binds us when | Source |
|---|---|---|---|
| Terms of Service (non-EEA) | 9 Oct 2026 | Always, unless a signed agreement replaces it. It covers residents outside the EEA, Switzerland and UK. | [verified: https://elevenlabs.io/terms-of-use] |
| Terms of Service (EEA/UK/CH) | 9 Oct 2026 | If the contracting party resides in the EEA, Switzerland or UK. Same age, commercial-use and OEM references. | [verified: https://elevenlabs.io/terms-of-use-eu] |
| Prohibited Use Policy | 9 Oct 2026 | Everyone, including use through apps built on ElevenLabs, so it reaches our users. | [verified: https://elevenlabs.io/use-policy] |
| ElevenAPI Terms (*new; not in 05*) | 9 Oct 2026 | All API use. They cover keys, Customer Applications and suspension. | [verified: https://elevenlabs.io/elevenapi-terms] |
| ElevenAgents Terms | 9 Oct 2026 | Agents and Speech Engine, if calls move there (decision #4) | [verified: https://elevenlabs.io/agents-terms] |
| ElevenCreative Terms | 9 Oct 2026 | Dubbing, Studio, Ads, SFX, Image & Video. It does not name TTS, cloning, design or the Library. | [verified: https://elevenlabs.io/creative-terms] |
| OEM Terms | 28 Feb 2025 | When we bundle, make available or sublicense Services | [verified: https://elevenlabs.io/oem-terms] |
| Voice Library Addendum (VLA) | 6 Mar 2026 | Use of the Voice Library service. It is written mainly for sharers. An EU variant exists at /vlaeu, but both ToS versions link /vla. | [verified: https://elevenlabs.io/vla] |
| Beta Services Addendum | 13 Nov 2024 | Anything labelled alpha, beta, pilot, preview or similar | [verified: https://elevenlabs.io/bsa] |
| DPA | 8 Apr 2026 | Personal data in content, including self-serve accounts through the ToS | [verified: https://elevenlabs.io/dpa] |
| Privacy Policy | 9 Oct 2026 | ElevenLabs as the processor of voice data | [verified: https://elevenlabs.io/privacy-policy] |
| Service-Specific Terms | 9 Oct 2026 | An index only, linking the Agents, Creative, API, Music and STT terms | [verified: https://elevenlabs.io/service-specific-terms] |

### 2.2 What the base terms allow

| Clause | Paraphrase | Effect for a consumer app |
|---|---|---|
| ToS §1(c) | Free users: non-commercial use only. Paid users: commercial use, subject to the PUP. | The app charges consumers through Stripe and Patreon [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/billing_subscriptions.py:425-555] [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/patreon.py:32]. **A paid plan is mandatory.** |
| ToS §5(b) | ElevenLabs grants a limited, non-exclusive, non-transferable, **non-sublicensable**, revocable licence to access and use the Services. | We cannot sublicense *access to the Services* to users. We may still deliver *Output* inside our product, as the next rows show. |
| ToS §4(a), §4(c)(ii) | Output may be used outside the Services, subject to the ToS and PUP. As between us and ElevenLabs, we keep the rights in our Output. | Narration audio we generate is our Output, and we may serve it to our users. |
| ToS §10 | Output generated for other ElevenLabs users is not ours. | Not relevant to us. |
| ToS supplemental list | Lists OEM Terms for bundling, making available or sublicensing, such as building the Services into your own solution. | This is the ambiguity: is a consumer app "your own solution"? See §2.3. |
| ElevenAPI §2.3 | A Customer Application is any app of ours that reaches the Services through the API. We are responsible for it, including authenticating and authorising its users, so that no user reaches resources we did not grant. | The API terms expect apps with users. This duty supports 05's per-user voice access map and the BFF-only design. |
| ElevenAPI §2.1 | We must secure, rotate and revoke credentials, and must not expose them in clients reachable by third parties. | Keys stay in the BFF. This confirms 05 §4.4: no browser-side keys or tokens for users. |
| ElevenAPI §2.2 | All activity on a credential is attributed to our account and workspace, whether we authorised it or not. | Every user's abuse is our account's abuse. |
| ElevenAPI §5.1 | ElevenLabs may disable a single credential, or restrict a single feature, for misuse or compromise without the usual notice and cure periods. | **New.** It argues for separate keys per surface (05 §11.2): a disabled preview key must not take narration down. |
| PUP scope | Covers use directly, through an authorised reseller, or through a product or application built with ElevenLabs technology. | Our users are bound by the PUP. Our terms must say so. |
| PUP §12 | Bans: accessing the Services other than through official interfaces; running a client, wrapper or proxy that gives others access outside the applicable terms; making Services or Output available to your own end users on terms looser than the ones that bind you; using Output to train any AI model; scraping; abusing multiple accounts. | Making Output available to our users on equal terms is the expected pattern. **The proxy ban is the line not to cross** (§8.2, §8.5). |

### 2.3 OEM Terms: the clauses that decide "Making Available"

All rows are from [verified: https://elevenlabs.io/oem-terms].

| Clause | Paraphrase |
|---|---|
| Preamble | The OEM Terms supplement the existing agreement, or the ToS if there is none. They govern when a Customer may bundle, make available and sublicense Services (**Make Available**), as expressly permitted by the underlying agreement. An OEM exhibit in a signed agreement overrides them. |
| §1.D Business Entity | An organisation that holds an underlying agreement on a Scale, Business, Enterprise or equivalent plan and uses the Services in a commercial or organisational capacity, including startups. **Individuals acting personally are expressly excluded.** |
| §1.E Customer Solution | The Customer's subscription-based, hosted, supported, on-demand service provided to End Users. |
| §1.I End User | The Customer's customer that (a) uses the Customer Solution **only for its own internal business operations** and (b) has signed an End User Agreement. The two conditions are joined by "and", so there is **no consumer prong**. |
| Bundled Service | The Services combined with the Customer Solution. The Services cannot be used apart from the Customer Solution. |
| §2.A | The licence lets the Customer develop an integration, demonstrate and Make Available the Bundled Service, and support End Users. |
| §2.B | No onward resale through a third party that will itself Make Available. No sale to government without consent. No public statements about the ElevenLabs business without approval. **No Making Available unless the Customer accesses the Services as a Business Entity. Free, Starter, Creator and Pro are expressly barred.** |
| §2.C(b), (f) | Use best efforts to prevent unauthorised use. Promote the Services in a way that protects ElevenLabs' reputation. |
| §2.D | The Customer must obtain any consents ElevenLabs needs to access, store and process Data. |
| §3.A | Each End User must have signed an End User Agreement that: (a) binds them to restrictions at least as strict as the ToS, including the PUP; (b) disclaims agency; (c) names ElevenLabs as a third-party beneficiary; and (d) grants ElevenLabs the right to process their Data. |
| §3.C | Audits at most once a year. |
| §6 | The Customer gives first-line support. ElevenLabs owes End Users nothing. |
| Attribution, age, moderation | **None.** No "Powered by" clause, no age clause and no explicit moderation duty. §3.A(a) brings in the PUP. |

**Reading.** The OEM Terms are a B2B resale framework. They are built for a customer that resells an ElevenLabs-powered business tool to other businesses. They neither grant nor forbid consumer apps; they are silent. Two readings follow:

| | Reading A: ordinary paid use (preferred) | Reading B: we "Make Available" Services to consumers |
|---|---|---|
| Basis | PUP scope and PUP §12 (Output to own end users on equal terms); ElevenAPI §2.3 (Customer Applications with users); ToS §4 (we own Output); Agents §1.4 (agent users are not Making Available). Also an ElevenLabs marketing FAQ: commercial voices may be used in your commercial project, but the tools must not be sold or licensed [verified: https://elevenlabs.io/voice-library/commercial]. | ToS §5(b) is non-sublicensable. The ToS supplemental list sends "building into your own solution" to the OEM Terms. |
| Plan needed for licensing | Any paid plan (Starter and up). | **No self-serve plan works**: consumers are never OEM End Users. This needs Enterprise or a custom OEM exhibit. |
| Conditions | Users bound by terms no looser than ours (PUP flow-down, 18+). No proxy-like features. Users never touch the API. | Everything in §3.A, plus whatever ElevenLabs negotiates. |
| Confidence | [unverified: legal interpretation], but it rests on several verified clauses. | [unverified]. Nothing found supports this reading for a product that only renders Output server-side. |

**Why Scale is still the floor** (§8.1): it is the cheapest plan that is not *expressly barred* if ElevenLabs takes a middle position, for example "fine on Scale or above". It also gives multi-seat service accounts (05 §4.2). It does not, by itself, settle Reading B.

### 2.4 Voice Library specifics

| Topic | Finding | Source |
|---|---|---|
| What the Library contains | Community-shared **PVCs only**. IVCs and Voice Design voices cannot be shared. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md] |
| Licence chain | The sharer authorises ElevenLabs to make the voice available to other users. Those users may generate Output with it. The sharer treats ElevenLabs and **all other users** as having discharged any royalty duty (VLA §8). Payment flows only from ElevenLabs to the owner (VLA §4, §7). | [verified: https://elevenlabs.io/vla] |
| Users' rights and restrictions | The VLA defers users' rights to the ToS. It says **nothing** about commercial use, use in apps, use by a user's own end users, resale or attribution. | [verified: https://elevenlabs.io/vla] |
| Payouts | Owners earn only from paid users' use. The page sets no duty on the voice's user. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/payouts.md] |
| API by plan | Not available through the API on Free. Owners may also exclude free users. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md] |
| Owner controls that affect us | (1) Notice period: none, or 30 days to 2 years. It can be lengthened, never shortened (VLA §4). (2) Live Moderation (§3.4). (3) Exclude free users, which is irrelevant on a paid plan. (4) A legacy custom rate, or credit multiplier. **No owner-set content-category restrictions exist beyond Live Moderation.** | [verified: https://elevenlabs.io/vla; https://elevenlabs.io/docs/eleven-creative/voices/payouts.md] |
| ElevenLabs' own rights | ElevenLabs may review and **remove any shared voice at any time, with or without notice**, and may rename or re-describe it (VLA §8). The VLA does not say whether the notice-period access survives a removal by ElevenLabs [unverified]. | [verified: https://elevenlabs.io/vla] |
| Notice-period protection | It covers users who **added** the voice before removal (VLA §4). The help center also extends it to users who had used the voice before. Outputs made before the end remain. | [verified: https://elevenlabs.io/vla]; 03 §4.5 |
| API fields to store | `sharing.live_moderation_enabled`, `sharing.notice_period`, `sharing.disable_at_unix`, `sharing.rate` / `fiat_rate`, `sharing.free_users_allowed`, `sharing.category` (`generated`, `cloned`, `premade`, `professional`, **`famous`**, `high_quality`), `safety_control`, `voice_verification`, `sharing.moderation_check`. Filters: `include_live_moderated` (**defaults to included**), `include_custom_rates` (**defaults to included**), `min_notice_period_days`. | [verified: https://elevenlabs.io/docs/api-reference/voices/search.md] |
| Famous and Iconic voices | The `famous` category exists in the API enum. ElevenLabs' Iconic Marketplace (Nov 2025) licenses celebrity and estate voices **per use**, with the rights holder approving scripts. That is incompatible with user-driven roleplay text. | [verified: API enum above]; [secondary: https://the-decoder.com/elevenlabs-opens-a-marketplace-for-iconic-ai-voices/; https://alternativeto.net/news/2025/11/elevenlabs-launches-a-new-iconic-marketplace-for-licensing-ai-generated-celebrity-voices/] |
| Child-like voices | Children's or child-like voices cannot be added to the Library. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library.md] |
| Commercial use (marketing page) | A Voice Library marketing FAQ says commercial voices may be used in your commercial project, but the tools must not be sold or licensed, and the output must not be used to build competing products. It is not a contract, but it is consistent with Reading A. | [verified: https://elevenlabs.io/voice-library/commercial] |

**Answer to G1 (licensing half).** Nothing in the VLA, the ToS or the Library docs forbids a paid customer's app from letting its users *select among voices the customer has added* and hear Output generated server-side. No attribution is owed. The open risks are:
- the Making Available question (§2.3);
- voice removal by the owner or by ElevenLabs (VLA §8);
- Live Moderation (§3.4).

Confirm in writing anyway (§9, item 1).

### 2.5 Default (premade) voices

- **Licensing.** Default voices are ElevenLabs' own voices and are covered by the paid commercial licence. No document adds any condition for apps [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices.md; https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform.md].
- **Lifecycle.** They are not usable as a target. They expire on 2026-12-31, and only accounts created before March 2026 have them (C1, 03 §2.2).
- **Replacements.** The help center lists named replacement voices, such as Roger → Darian, Sarah → Talia and George → Eldrin, and says they can be used indefinitely. Their category, owner and notice period are not stated [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices.md; same default-voices page]. If they turn out to be ElevenLabs-owned library voices with an unlimited notice period, they would be the lowest-risk library voices [unverified; staging check in G2/G5].

### 2.6 Attribution summary

| Situation | Attribution required? | Source |
|---|---|---|
| Output on any paid plan (Starter to Enterprise), any voice type | **No** | [verified: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform.md] |
| Free plan, not signed in, or generated outside an active subscription | Yes: "elevenlabs.io" or "11.ai" in the title, and no commercial use. **Keep the production subscription from lapsing.** | same |
| Credit to the Voice Library voice owner | No requirement in the VLA, ToS, Library docs or Payouts page | [verified: https://elevenlabs.io/vla; https://elevenlabs.io/docs/eleven-creative/voices/payouts.md] |
| Displaying the owner's name or social handles | Not required. ElevenLabs may rename the voice (VLA §8), so keep our own display names. | [verified: https://elevenlabs.io/vla] |
| ElevenLabs name or logo used as branding | Needs prior written permission (ToS §5(c)). Naming ElevenLabs as a processor in the privacy notice is descriptive, not branding. | [verified: https://elevenlabs.io/terms-of-use] |
| OEM, if it ever applies | No attribution clause. No public statements about the ElevenLabs business without approval (§2.B). | [verified: https://elevenlabs.io/oem-terms] |
| Beta Services output | Banned from commercial and production use. Check the release stage of each feature before shipping it: the models page shows no alpha or beta label today on v4, v4 Turbo, v3, Flash, Text to Dialogue or Scribe. | [verified: https://elevenlabs.io/bsa; https://elevenlabs.io/docs/overview/models.md] |

### 2.7 Licensing matrix by plan

| Plan | Commercial licence | Library via API | IVC | PVC slots | Business Entity (OEM) | Multi-seat or service accounts | ZRM, EU residency, custom DPA |
|---|---|---|---|---|---|---|---|
| Free | **No** (ToS §1(c)(i); PUP §12) | No | No | 0 | No | No | No |
| Starter | Yes | Yes | Yes | 0 | **Expressly barred** | No | No |
| Creator | Yes | Yes | Yes | 1 | Expressly barred | No | No |
| Pro | Yes | Yes | Yes | 1 | Expressly barred | No | No |
| Scale | Yes | Yes | Yes | 3 | Yes, for B2B End Users only | Yes (3 seats) | No |
| Business | Yes | Yes | Yes | 10 | Yes, for B2B End Users only | Yes (10 seats) | No |
| Enterprise | Yes | Yes | Yes | Custom | Yes; custom OEM exhibit possible | Yes | Yes |

Sources:
- commercial licence and plans: [verified: https://elevenlabs.io/pricing; https://elevenlabs.io/terms-of-use];
- Library via API: [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md];
- OEM column: [verified: https://elevenlabs.io/oem-terms];
- IVC and PVC: 03 §5–§6;
- seats, ZRM and residency: 05 §2.1, §5.

---

## 3. Q2. Content rules and ElevenLabs enforcement

### 3.1 PUP rules that matter for roleplay narration and calls

PUP last updated 9 Oct 2026. Rows are paraphrased; section numbers are the PUP's own [verified: https://elevenlabs.io/use-policy].

| PUP section | Rule (paraphrase) | Roleplay consequence |
|---|---|---|
| §1 Protection of Minors | No content that exploits, endangers or sexualises anyone under 18, including AI-generated material. No grooming. Accounts are 18+. Apps directed at under-18s need written approval and, if approved, parental consent with records. No voice recordings of under-18s for cloning or training. No voice or likeness of a specific real minor. | Hard block, with no fiction exemption. Applies to fictional characters described as minors, and to sexual content with child-like characters. |
| §2 Dangerous activities | No encouraging, promoting, instructing or facilitating suicide, self-harm or eating disorders. No glorifying serious violence or abuse. | Self-harm detection before TTS (§8.5). Villains may act; narration must not glorify. |
| §3 Deception, manipulation, impersonation | No cloning or impersonating a living person's voice, identity or likeness without explicit, informed consent or other valid authorisation. Deceased persons are covered where harm is likely or post-mortem rights are infringed. No exploiting vulnerability due to age, disability or finances, and **no creating harmful emotional dependency or undue influence**. | Real-person character cards get a generic voice. Companion features need anti-dependency safeguards (§8.5). |
| §4 Elections | No impersonating candidates or officials. Political campaigning needs consent (05 §6.2). | Block real politicians from narration. |
| §5 Hate, harassment | No hateful attacks on protected characteristics, targeted harassment or threats. | Slur filter before TTS. |
| §6 Sexual and graphic content | No visual depictions of explicit sex. No erotic material involving incest, bestiality or necrophilia. No non-consensual intimate content. No gratuitous gore that dwells on serious injury, death or abuse. | Consensual adult erotic *audio* is not addressed (§3.2). Ordinary fantasy combat is presumably fine [unverified]. Torture-style detail is not. |
| §7 Privacy | No exposing private information. No profiling by voice or biometrics. Health, payment and ID numbers need a prior written agreement. | Do not narrate user-supplied PII (the existing modal already tells users not to share it, en.ts:886). |
| §8 Platform integrity | No circumventing safety guardrails, including voice verification, or usage limits. No coordinated activity to evade limits. | No multi-account sharding (05 §6.2). |
| §9 Lawful use | You must not use the Services, or **permit them to be used**, for prohibited purposes. ElevenLabs may review usage, but responsibility for compliance stays with you. | We are responsible for what our users make us generate. |
| §10 AI transparency | Disclose AI interaction where the law requires it or where silence would materially mislead. Do not remove watermarks, metadata or provenance. | AI-voice labels. Store provider bytes unmodified (05 §6.7). |
| §12 Commercial and technical | See §2.2: no proxy, no looser end-user terms, no training on Output, no scraping. | Our terms must flow these down. |
| Intro | Some higher-risk uses may need prior approval or extra safeguards, or be restricted. Attempting a violation is itself a violation. | A mature-fiction companion app is plausibly "higher-risk": ask (§9). **Never send prohibited text to ElevenLabs, even to test.** |
| Enforcement | Content removal; restricting, suspending or terminating access; preservation or disclosure to authorities where required; notice with appeal instructions; appeal by contacting ElevenLabs. | The whole workspace is at risk (§8.6). |

### 3.2 What the PUP does not address

- **Consensual adult erotic text-to-audio.** It is not banned (§6 bans *visual* explicit content and named categories) and not allowed. No age-verified adult path is described.
  - A third-party tracker rates ElevenLabs "allowed with conditions" [secondary: https://aihaven.com/ai-adult-content-policy-tracker/].
  - That tracker also claims the Agents terms ban sexual content from customer-provided LLMs. **Today's Agents terms contain no such clause** [verified: https://elevenlabs.io/agents-terms].
  - Treat it as **not permitted until ElevenLabs confirms in writing**.
- **A fiction or creative exemption.** None exists. The PUP applies §1 and §6 with no creative carve-out, and the professional-advice section notes that nothing in it permits an otherwise prohibited use [verified: https://elevenlabs.io/use-policy].
- **Companion or romantic AI.** Only the §3 "harmful emotional dependency" bullet applies. There is no companion-specific section [verified: same].
- **Profanity.** Not listed. The 2025 case shows that classifiers may still flag profanity as a threat [secondary: https://technologyreview.com/2025/02/14/1111900/ai-voice-clone-say-arse-then-banned].

### 3.3 What ElevenLabs does technically

| Layer | Mechanism | How it surfaces to us | Source |
|---|---|---|---|
| Platform monitoring | AI classifiers, human reviewers and internal investigations against the PUP. Safeguards can also wrongly block good actors. Bans for persistent or serious violators. | Not a per-request error. Removal of content or voices, account restriction, suspension or termination, with notice and appeal instructions. | [verified: https://elevenlabs.io/safety; https://elevenlabs.io/use-policy] |
| Example of async text moderation on TTS | In 2025, a user's own IVC produced text flagged as a threat. The next day she got an email warning; on reuse, a human moderator banned the voice; it was reinstated after an appeal. | **Email warning, then voice ban.** No synchronous error was reported. | [secondary: https://technologyreview.com/2025/02/14/1111900/ai-voice-clone-say-arse-then-banned; https://boingboing.net/2025/02/19/woman-banned-from-assistive-ai-app-after-teaching-it-to-say-arse.html] |
| Automated account flagging | Accounts can be flagged by an automated system for additional moderation. ZRM may then be withheld, and the admin is notified. | Notification to the workspace admin | [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md] |
| Human access to content | DPA §13.1.3: the safety team may access customer personal data to check PUP compliance. | None. **Our users' stories may be read by ElevenLabs staff.** | [verified: https://elevenlabs.io/dpa] |
| Key-level action | ElevenAPI §5.1: one credential can be disabled, or one feature restricted, for misuse without notice or cure. | 401 or 403 on that key [unverified: exact code] | [verified: https://elevenlabs.io/elevenapi-terms] |
| Voice-level controls | `safety_control`: `NONE`, `BAN`, `CAPTCHA`, `ENTERPRISE_BAN`, `ENTERPRISE_CAPTCHA`. `voice_verification`. `sharing.moderation_check` covers name, description, samples and CAPTCHAs. | Probably 403 `voice_access_denied` or `forbidden` when a voice is banned [unverified]. A third-party support page reports an ElevenLabs error saying a voice may violate the ToS and needs verification [secondary: https://support.sync.so/articles/5652909924-why-am-i-getting-the-voice-may-violate-elevenlabs-terms-of-service-error-during-tts]. | [verified: https://elevenlabs.io/docs/api-reference/voices/search.md] |
| No-go voices | Clones that approximate prominent public figures are blocked and unusable. Warnings, voice removal and bans for misuse. | Voice blocked | [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md] |
| Live Moderation | §3.4 | Undocumented | §3.4 |
| Error catalog | 79 codes. **None for moderation, policy, blocked text, live moderation, suspension or unaccepted terms.** The nearest are 403 `forbidden`, 403 `voice_access_denied` and 402 `insufficient_credits`. | — | [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md] |
| Agents guardrails | Configurable content guardrails exist for ElevenAgents, not for plain TTS. Since 2026-08-10, triggered guardrails show in transcripts. | Agent transcripts | [verified: https://elevenlabs.io/docs/changelog]; 05 §6.6 |

**Conclusion.** For plain TTS and Text to Dialogue there is **no synchronous moderation contract**. The failure mode is delayed and account-level: an email, a banned voice, a disabled key, or a suspended workspace. App-side moderation before every TTS call is therefore the only control we own (§8.5). 05 §6.6 said the same, and this note adds the evidence above.

### 3.4 Live Moderation: what it is and how a refusal surfaces

| Question | Answer | Source |
|---|---|---|
| What | When the owner enables it, ElevenLabs tools check whether request text falls into prohibited categories, which are not named. | [verified: https://elevenlabs.io/vla §4; https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md] |
| Which voices | Shared Library PVCs whose owner enabled it | same |
| Categories | **Not listed anywhere** | same; [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md] |
| Reliability | Intended to stop prohibited use, but not guaranteed. It may add latency. | [verified: https://elevenlabs.io/vla] |
| Snapshot rule | An owner's change applies only to accounts that **add** the voice afterwards. Our copy keeps the setting that was in force when we added it. | [verified: https://elevenlabs.io/vla] |
| How a refusal surfaces | **Undocumented.** No error code exists in the catalog. It may be a 4xx with a `detail.message`, a silent refusal, or async enforcement [unverified]. | [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md] |
| Detection in our account | `sharing.live_moderation_enabled` on the voice. Exclude with `include_live_moderated=false` on both `/v1/shared-voices` and `/v2/voices` (the latter filter arrived 2026-08-10). | [verified: https://elevenlabs.io/docs/api-reference/voices/search.md; https://elevenlabs.io/docs/changelog] |

**On the staging test G1 proposes** ("send mature roleplay text to one live-moderated library voice"): the PUP says an attempted violation is itself a violation [verified: https://elevenlabs.io/use-policy]. Sending prohibited text on purpose would breach the PUP and could flag the account.
- If a test is needed, use only **policy-compliant but edgy text**, such as dark-fantasy combat or mild profanity, and record the status, body and latency.
- Better: **exclude live-moderated voices from the catalog**, which makes the test unnecessary, and ask ElevenLabs for the refusal shape (§9, item 6).

---

## 4. Q3. Age requirements and the current magic-worlds age gate

### 4.1 What ElevenLabs requires

| Requirement | Applies to | Source |
|---|---|---|
| Under 18, or under the local age of majority, may not use the Services | The account holder (ToS §1(a), both ToS versions) | [verified: https://elevenlabs.io/terms-of-use; https://elevenlabs.io/terms-of-use-eu] |
| Accounts must be 18+. Apps, products or experiences directed at under-18s are banned unless approved in writing; if approved, parental consent with records. | Account and app (PUP §1) | [verified: https://elevenlabs.io/use-policy] |
| Services are not meant for under-18s. No uploading voice data of or about anyone under 18. | Data (Privacy Policy) | [verified: https://elevenlabs.io/privacy-policy] |
| **Age verification, age assurance or attestation of end users** | **Not required by any ElevenLabs document read.** PUP §1 does not address general-audience apps or apps "likely to be accessed" by minors. | [verified: https://elevenlabs.io/use-policy] |
| Indirect duty: our terms must not be looser than ElevenLabs' | PUP §12. The account holder must be 18+, so offering voice to under-18s would be "more permissive" [unverified: interpretation]. | [verified: https://elevenlabs.io/use-policy] |
| Indirect duty (if OEM applies): signed End User Agreement with ToS-level restrictions, which include the age rule | OEM §3.A | [verified: https://elevenlabs.io/oem-terms] |
| Agents: no Reception agent directed to children under 13 | Agents Exhibit 1 §3.2. Not our use, but it shows ElevenLabs' threshold style. | [verified: https://elevenlabs.io/agents-terms] |

**Regulatory overlay (not ElevenLabs, but it decides how strong the gate must be).** California SB 243 (in force 2026-01-01) regulates companion chatbots. It requires:
- AI disclosure;
- a public suicide and self-harm protocol with crisis referral;
- a notice that companions may not suit minors;
- for known minors, break reminders every three hours and steps to prevent sexual content;
- a private right of action [secondary: https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law; https://fpf.org/blog/understanding-the-new-wave-of-chatbot-legislation-california-sb-243-and-beyond/].

Other jurisdictions (EU, UK, other US states) may require stronger age assurance, especially if adult content is ever allowed [unverified: legal review].

### 4.2 The current magic-worlds mechanism

| Element | Evidence | Behaviour |
|---|---|---|
| First-run modal | [code: /home/andres/WebstormProjects/magic-worlds/src/ui/components/AppWarningModal.tsx:30-104], mounted globally [code: /home/andres/WebstormProjects/magic-worlds/src/app/router/AppRouter.tsx:214] | A 9–10 item list. The 18+ statement is item 1: you must be 18+, and accepting confirms it [code: /home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:879; es.ts:889]. One button, "I understand and accept"; no close button (lines 47, 50, 54-61). The age statement is **bundled** with nine other notices. There is no separate checkbox and no date of birth. |
| Storage | `localStorage` key `magic_worlds:app-warning-accepted:v1` = `accepted` (lines 7-8, 14-20, 35-42) | One per browser, not per user. Several accounts on one browser share it. Cleared storage or a private window re-prompts. If storage throws, the modal still closes and nothing is saved (lines 36-41). |
| Bypass | `LEGAL_HASH_PREFIXES = ['#/disclaimer', '#/privacy']` (line 12). `isOpen` is computed once at mount (line 32). | Landing on `#/privacy` and then navigating inside the SPA never shows the modal. This is by inspection, not tested [code]. |
| Registration | `RegisterData {username, password, email?}` [code: /home/andres/WebstormProjects/magic-worlds/src/shared/types/auth.types.ts:217-221]; `apiService.register` [code: /home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:1075-1081]; the backend DTO `UserRegister` has only `username` and `password` with `extra="forbid", strict=True` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py:52-58]; the route forwards only those plus `user_group_hash` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py:1845-1890] | **No age or terms field.** Adding one requires a DTO change, because the strict DTO would reject a new field. |
| OAuth sign-up | `/auth/google/exchange`, `/auth/oauth/{connection}/exchange` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py:1824,1832] | No attestation step. |
| User table | `tb_user` (user_id, user_hash, username, user_type, display_name, creation_at) [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1-18] | No age or attestation column. |
| Backend grep | `grep -rn -i -w "age\|adult\|adults\|attest\|attestation\|age_verified\|birthdate\|date_of_birth\|dob\|is_adult\|age_confirmed\|minor\|minors"`, plus `18+`, `terms_version`, `tos_version`, `accepted_at`, over `src/` (excluding agent graphs) | The only hits are `Cache-Control: max-age` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/media_assets.py:111,115; src/routes/tts.py:139] and the voice-consent table. **No age acceptance is recorded per user anywhere.** |
| Voice-call consent (a good pattern to reuse) | `voice_consent(user_id, scope, consent_version, accepted_at, revoked_at)` [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:195-206]; enforced server-side [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/admission.py:96-105] at call start [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:484]; version `voice-v1` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26] | Server-side, versioned and revocable. It does **not** include age. |
| Narration gating | `_handle_chat_tts_request` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1224]; quota is checked only for segment 0 [code: same file:1433] | No consent, age or moderation gate. |
| Recipe preview | `POST /voice-presets/preview` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99], free text up to 400 characters (07 §2) | Authenticated only. It is the closest thing to a "speak any text" proxy. |
| Terms of Service | Legal pages are only `about`, `contact`, `privacy` and `disclaimer` [code: /home/andres/WebstormProjects/magic-worlds/src/features/legal/components/legalContent.ts:21; src/shared/types/ui.types.ts:18-62] | **There is no end-user agreement** to flow down the PUP, set 18+, name ElevenLabs as a third-party beneficiary, or record acceptance. |
| Content policy copy | "NSFW content is not currently allowed" [code: /home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:884]; About and Disclaimer repeat it [code: same file:1962,2102] | There is no content rating field on cards or adventures. A frontend search for rating, nsfw and mature in `src/shared/types` and a backend search for nsfw, content_rating and mature found only the fal image-safety flag [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/fal_adapter.py:270]. |

### 4.3 Is it adequate? (G16)

**As a technical gate: no. As a contractual record: no.** ElevenLabs does not demand verification. However, to rely on Reading A (§2.3) we must show that our users are bound by terms no looser than ours, including 18+. To meet OEM §3.A, if it ever applies, we need a "signed" End User Agreement per user.

A browser-local, bundled, bypassable acknowledgement that no server records cannot show either. It also gives no basis for blocking voice for a user later found to be a minor.

The changes are in §8.4.

---

## 5. Q4. Voice cloning consent, verification and records

### 5.1 Obligations

| Obligation | Source |
|---|---|
| Cloning or synthesising a living person's voice needs their explicit, informed consent or other valid authorisation. Deceased persons: no use likely to cause harm or that infringes post-mortem rights. | PUP §3, §9 [verified: https://elevenlabs.io/use-policy] |
| No recordings of anyone under 18 for cloning or training. No voice or likeness of a specific real minor. | PUP §1; Privacy Policy [verified: https://elevenlabs.io/use-policy; https://elevenlabs.io/privacy-policy] |
| Upload only your own voice or one you are authorised to share. Do not provide Input you lack the rights for. | ToS §4(b), §4(g) [verified: https://elevenlabs.io/terms-of-use] |
| UI flow: the creator confirms they have the right and consent to clone the voice. **The API has no consent field.** By calling it, we make the same representation implicitly [unverified: inference]. | [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning.md; https://elevenlabs.io/docs/api-reference/voices/ivc/create.md] |
| Both IVC and PVC include voice verification (voice CAPTCHA) to show the requester is the speaker. It proves presence, not ownership. Responsibility stays with the creator. | [verified: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning.md] |
| PVC: only your own voice, even with the other person's consent. A voice actor must create and verify it in their own account and share it. | 03 §6 [verified there] |
| No-go voices: clones approximating prominent public figures are blocked. Misuse leads to warnings, voice removal or a ban. | [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md] |
| All generated audio is traceable to the account responsible. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/are-there-any-restrictions-on-what-voices-i-can-upload-for-voice-cloning.md] |
| ZRM never covers IVC or PVC samples: the clone must be stored. | 05 §5.2 [verified there] |
| Voice data is kept at most 3 years after the last interaction unless law requires otherwise. Verification may involve biometric or special-category data. | [verified: https://elevenlabs.io/privacy-policy] |
| **Record-keeping benchmark.** The Creative Terms §2 and Agents Terms §3.5 require consent records for the longer of the legal period or five years, produced on written request. They do not name TTS or IVC, but they show what ElevenLabs expects. | [verified: https://elevenlabs.io/creative-terms; https://elevenlabs.io/agents-terms] |

### 5.2 Verification over the API

- `POST /v1/voices/add` (IVC) returns `requires_verification`. The reference does not say what triggers it or how to complete it through the API [verified: https://elevenlabs.io/docs/api-reference/voices/ivc/create.md].
- Voices carry `voice_verification` and `safety_control` (`CAPTCHA`, `ENTERPRISE_CAPTCHA`, …) [verified: https://elevenlabs.io/docs/api-reference/voices/search.md].
- PVC has CAPTCHA and manual-verification endpoints (03 §6). IVC has none.
- **Operational rule:** the speaker may have to be available to read a CAPTCHA prompt. Book them for the session. Treat `requires_verification=true` as `blocked_verification` until it is completed in the dashboard (03 §5) [unverified for IVC].

**Docs conflict on audio length:**
- The Default-voices help page says IVC works from as little as 10 seconds and PVC from as little as 10 minutes [verified: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices.md].
- The IVC guide recommends 1–2 minutes [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning.md], and 03 §6 gives a 30-minute PVC minimum.
- Keep 03's guidance as the quality target.

### 5.3 What to collect from a consenting speaker (root console)

This is a minimum set. It merges the PUP, the ToS, Creative §2 and Agents §3.5. Legal must review it.

1. **Identity:** legal name, contact details, and the document or method used to check identity.
2. **Age:** confirmation that the speaker is 18+. Refuse otherwise (PUP §1).
3. **Explicit, informed consent text**, version-stamped and signed or click-signed, that names:
   - ElevenLabs Inc. and its subprocessors as processors of the recordings and the voice model, with US storage (05 §5.1);
   - **the use**: AI character voices in a consumer roleplay app, saying lines written by AI and by users, within our content policy;
   - commercial use, any compensation, and the term;
   - that the voice will **not** be shared to the Voice Library or used for other customers;
   - withdrawal: how to revoke, what happens on revocation (the voice is deleted, and existing generated audio may remain), and response time.
4. **Biometric notice and consent**, where local law requires it. [unverified: per-jurisdiction review; candidates include Illinois BIPA, Texas and Washington.]
5. **Provenance of the samples:** recorded by whom, when and where. Confirm the recordings contain only the consenting speaker.
6. **Verification:** the speaker is available for a voice CAPTCHA if `requires_verification` is returned.
7. **Retention:** keep the consent record for the longer of the legal period or **5 years after the voice is deleted** [unverified: proposal]. Keep the original samples, encrypted and root-only, for as long as the voice exists, because clones cannot be exported (03 §5). Delete the samples when consent is revoked.
8. **Audit link:** the `voice_id` and `consent_version`; per-generation audit rows (user, voice, text hash, `request_id`), because generations trace back to our account.

Today neither the clone form nor `minimax_voice_admin` captures anything like this. A grep for consent, rights, owner and attest found nothing [code: /home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/VoiceCloneForm.tsx:43-150; /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py]. Re-creating MiniMax custom voices as IVCs (decision #12) needs **fresh consent naming ElevenLabs**, because a MiniMax-era consent, if any exists, does not cover a new processor.

---

## 6. Q5. Data obligations not covered or wrong in 05

| Topic | 05 says | Finding today | Action |
|---|---|---|---|
| Notice and consent to data subjects | Only through OEM §2.D (05 §5.5) | **DPA §2.2 applies to every self-serve customer.** The customer must give notice to data subjects about ElevenLabs' processing and obtain consent where the law requires. The DPA forms part of the self-serve agreement through the ToS, and the SCCs are deemed executed. | Rewrite the privacy notice now, whether or not OEM applies. [verified: https://elevenlabs.io/dpa] |
| Human access to content | Not mentioned | DPA §13.1.3: the safety team may access customer personal data to review PUP compliance. | The privacy notice must say that the voice provider may review content for safety. [verified: https://elevenlabs.io/dpa] |
| Training licence | Perpetual licence; opt-out (05 §5.4) | ToS §4(d): the licence is perpetual and irrevocable and includes developing new products. §4(i): the opt-out does not reach uses made before it is processed. | Switch off "Data use → Improve the models" **before the first request carrying real user content**, in staging too. [verified: https://elevenlabs.io/terms-of-use] |
| Which ToS applies | Non-EEA only | A separate EEA/UK/CH version exists, with the same substance on the points checked. The contracting entity's residence decides which applies. | Record which one applies in the plan. [verified: https://elevenlabs.io/terms-of-use-eu] |
| ZRM eligibility | Enterprise only; may be refused for high risk | Same. It targets healthcare and banking, is for *select* Enterprise customers, and may be restricted for high-risk use cases or accounts flagged for additional moderation. | A mature-fiction app may be refused ZRM. Ask before buying Enterprise for ZRM (§9, item 9). [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md] |
| Beta features and personal data | Not mentioned | The Beta Services Addendum bans production use and bans sending personal information to Beta Services. | Do not route user content to any alpha or beta feature. [verified: https://elevenlabs.io/bsa] |
| The API terms' security scope | Not mentioned | ElevenAPI §4.1: ElevenLabs' DPA and security commitments do not cover systems we control. | The BFF, our stored MP3s and our logs are ours to secure. [verified: https://elevenlabs.io/elevenapi-terms] |
| EU residency | Enterprise only; moderation may run outside the region | Unchanged. Voice replication across residencies was added 2026-08-03. | No change. [verified: https://elevenlabs.io/docs/changelog] |
| Self-serve content deletion | May delete after 180 days of inactivity | Unchanged. It is "may", not "must". | Do not rely on ElevenLabs history as storage. Keep the history-deletion sweep (05 §11.3). [verified: https://elevenlabs.io/dpa] |
| Country restrictions | Not mentioned | ElevenLabs blocks access from Belarus, Cuba, Iran, North Korea, Russia, Syria and occupied Ukrainian regions. | BFF egress is unaffected. Whether our users in those regions may receive Output is a sanctions question for legal [unverified]. [verified: https://elevenlabs.io/docs/help-center/legal/do-you-restrict-access-to-the-service-and-platform-for-any-specific-countries.md] |
| Our own copy | — | The privacy page and call consent name MiniMax [code: /home/andres/WebstormProjects/magic-worlds/src/app/i18n/locales/en.ts:2047,4823]. "Raw microphone audio … not stored" (en.ts:4825) is true of *our* storage. Without ZRM, ElevenLabs keeps TTS text and audio in history, and STT audio if Scribe replaces Groq. | Rewrite and bump `VOICE_CONSENT_VERSION` (07 §11.5, 08 §6.5). |

---

## 7. Corrections to earlier notes

| Note and section | Claim | Correction |
|---|---|---|
| 05 §2.1 row "OEM Make Available allowed?" (Scale, Business, Enterprise: Yes); 05 §6.9; 05 §11.1 ("the OEM-eligible tier") | Scale makes us OEM-eligible. | Scale and above qualify as a **Business Entity**, but OEM End Users must be businesses using the product for internal operations (§1.I). **No self-serve tier lets consumers be OEM End Users.** Scale is a hedge, not a fix (§2.3). This affects C11. |
| 05 §1 item 8 | "Choosing Scale or above avoids the tier problem either way." | It avoids the *tier* bar only. If ElevenLabs reads our app as Making Available, consumer distribution needs custom (Enterprise) terms. |
| 05 §6.6 | Monitoring is "mostly asynchronous", by inference. | Now evidenced: automated account flagging (ZRM page), safety-team access (DPA §13.1.3), key-level disabling (ElevenAPI §5.1), and the 2025 email-warning-then-voice-ban case [secondary]. |
| 05 §6.4 | IVC consent is a dashboard self-attestation [secondary]. | Verified for the UI. The API has **no** consent field. Both IVC and PVC can require voice-CAPTCHA verification (§5.1). |
| 05 §6.5 and §11.6 item 4; 01 §18.2 | Prefer default voices for mature fiction. | Default voices are licence-clean but expire 2026-12-31 (C1). For mature or edgy text, use **owned designed voices**, or library voices with Live Moderation **off at the time we add them**. |
| 03 §4.1 and §4.6 | Use `include_live_moderated=false` (recommended). | It is **required**. The API default includes moderated voices, and so does `include_custom_rates`. Exclude `sharing.category = famous` as well. |
| 09 G1 "How to close it" | Send mature roleplay text to a live-moderated voice in staging. | Sending deliberately prohibited text would breach the PUP's attempt clause. Use policy-compliant edgy text only, or skip the test by excluding moderated voices (§3.4). |
| 09 decision #16 | "Disable narration for NSFW-rated adventures." | No content rating exists in either repo, and the current policy bans NSFW everywhere (§4.2). |
| 05 §5.5 | End-user consent is needed only through OEM. | The DPA §2.2 notice and consent duty applies to every self-serve customer (§6). |

---

## 8. What this means for magic-worlds

### 8.1 Required plan tier, from a licensing standpoint

| Step | Decision | Why |
|---|---|---|
| Floor | **No Free plan anywhere user content flows.** Staging on Creator or Pro may use only synthetic, policy-safe text. | Free is non-commercial and has no Library through the API. The app sells subscriptions. |
| Production | **Scale (or Business), held by a legal entity**, with a non-personal workspace email | Scale is the lowest Business Entity plan (OEM §1.D), so the tier bar never bites if ElevenLabs takes a middle position. It also unlocks service accounts, separate from the licensing question (05 §4.2). A Business Entity must be an organisation, not an individual acting personally. Whether a sole proprietor qualifies is [unverified] (§9, item 3). |
| Precondition for launch | **Written confirmation of Reading A** (§9, items 1–4) | It is the only way to close G1 and the OEM question. |
| Escalation | **Enterprise or a custom OEM exhibit**, if ElevenLabs says consumer distribution is Making Available, if adult audio needs approval, or if ZRM or EU residency become requirements | OEM §1.I leaves no consumer path on self-serve plans. |
| Never | Launch production on Starter, Creator or Pro | They are expressly barred from Making Available, and they lack service accounts. |

**Product design to stay inside Reading A:**
- Users never call ElevenLabs. Keys stay in the BFF, with no single-use tokens for users (ElevenAPI §2.1, PUP §12).
- No end-user voice cloning, design or remix (decision #8).
- **No free-text "speak anything" preview for users.** Use fixed per-language preview texts, or catalog `preview_url` audio (03 §12.4, C12 claim B, G10). The free-text preview at `voice_presets.py:99` is the most proxy-like endpoint we have.
- The catalog is **curated and served from our DB**. Users never search the live Library. This supports C12 claim B and keeps users away from the Library service itself.
- Narration text is always our product's own story output, after moderation.

### 8.2 Voice sources allowed in the catalog

| Source | Status | Conditions |
|---|---|---|
| Our own Voice Design voices, and Remixes of owned voices | **Allowed (preferred for mature or edgy narration)** | Owned, cannot be withdrawn by a third party, no Live Moderation. Uses slots. No child-like designs in the public catalog (§8.5). Audition on v4 (05 §11.6). |
| Curated Library voices, added to our account | **Allowed, with filters** | `include_live_moderated=false` (record `sharing.live_moderation_enabled=false` at add time); `include_custom_rates=false` (no `rate` or `fiat_rate` multiplier); `min_notice_period_days ≥ 365`; `sharing.category ≠ famous`; no names or descriptions of public figures; not child-like; `safety_control` is `NONE` or null. Keep our own display name. Track `disable_at_unix`. Never treat the notice period as a guarantee, because ElevenLabs can remove voices at will (VLA §8). |
| ElevenLabs replacement voices (Darian, Talia, Eldrin and so on) | **Candidate, pending G2/G5 checks** | Allowed if they show an owner of ElevenLabs and no notice period, or an unlimited one [unverified]. |
| Root-only IVC of a consenting speaker | **Allowed with the §5.3 record** | Consent record, 18+, verification handled, never shared to the Library, deleted on revocation. |
| PVC shared to us by a commissioned voice actor | **Allowed with a contract** | The actor creates and verifies it in their own account (03 §6). We need a written licence from the actor covering the app's use and content scope, plus a notice period or a contractual term. |
| Default or premade voices | **Not allowed as targets** | They expire 2026-12-31 and are absent on new accounts (C1). Licence-clean, but they have no future. |
| Library voices with Live Moderation | **Not allowed** | The refusal shape is undocumented, they add latency in calls, and they block unpredictably. |
| Famous or Iconic voices | **Not allowed** | They need a per-use rights-holder licence and script approval. |
| End-user uploads (clone, design, remix) | **Not allowed** | It would need a full consent and verification flow, abuse handling, slot metering and legal review (decision #8). |
| Voices resembling real public figures, or "sound-alike" prompts in Voice Design | **Not allowed** | PUP §3, no-go voices. |

### 8.3 Required UI disclosures and consent texts

All texts below are **drafts for legal review**, in English. Spanish equivalents go in `es.ts`.

| Surface | What is required | Source of the duty | Draft wording |
|---|---|---|---|
| **New Terms of Service page**, accepted by click-wrap at sign-up (password and OAuth) and on each version change, and recorded server-side | 18+; a PUP flow-down (prohibited content list, no impersonation, no extraction or scraping, no training AI on outputs, no automated abuse); our right to block, remove or suspend; third-party providers process content. If the OEM framework is ever used: ElevenLabs as third-party beneficiary, no agency, and a data-processing grant. | PUP §12 (not more permissive); OEM §3.A if applicable; DPA §2.2 | "You must be 18 or older. You may not use Magic Worlds to create content that sexualises minors, encourages self-harm, harasses or impersonates real people, or breaks the policies of our AI providers, including the ElevenLabs Prohibited Use Policy, which applies to all voice features." |
| Privacy Policy, voice section (replaces en.ts:2047, es.ts:2057) | Name ElevenLabs as the processor for narration and calls; US storage; provider history retention without ZRM; possible provider safety review; training opt-out enabled; our retention. | DPA §2.2, §13.1.3; 05 §5 | "Voice narration and call replies are generated by ElevenLabs. The text to be spoken, and for calls the generated audio, is processed and may be stored by ElevenLabs in the United States, and may be reviewed by its safety team to enforce its usage policy. We have opted out of ElevenLabs using this data to train its models." |
| Call consent modal (en.ts:4823/4825, es.ts:4833/4835); bump `VOICE_CONSENT_VERSION` from `voice-v1` | Provider names; scope "not stored" to *our* storage. If calls move to Speech Engine or Agents, the disclosure must come **before access** and state AI, ElevenLabs (plus the LLM provider) processing, and recording if enabled. Keep proof for 5 years or the legal period. | PUP §10; Agents §3.5 | "Replies are spoken by an AI voice generated by ElevenLabs. Your speech is transcribed by {STT provider}. Magic Worlds does not store raw microphone audio; our providers may keep request data under their own retention policies." |
| Narration player and call screen | A persistent "AI voice" label. Never present a character voice as a human. | PUP §10; SB 243 [secondary] | "AI voice" badge on every narrated turn and on the call header. |
| Voice pickers (user Voice Studio, card editor) | AI-voice badge. A notice that catalog voices can be retired and replaced. No owner credit needed. | VLA §4, §8 | "Voices are AI-generated. A voice may occasionally be retired; we will switch you to a similar voice and let you know." |
| First-run modal (`warning.*`) | Keep as a UX summary, but **split the 18+ item into its own control** (§8.4) and link to the new ToS. Update `warning.voice` (en.ts:888) for the new provider. | — | — |
| Companion safety copy | AI disclosure; "not suitable for minors"; crisis resources shown when self-harm signals trigger. | PUP §2, §3; SB 243 [secondary] | "If you are thinking about harming yourself, voice is paused. Please contact {local crisis line}." |
| Root IVC console | The §5.3 consent record fields, plus a mandatory checkbox stating that the speaker gave explicit, informed, written consent covering ElevenLabs processing and this app's use. | PUP §3; ToS §4(b); Creative §2 benchmark | — |

### 8.4 Age-gate changes

1. **A server-side attestation record.** Add a table `user_attestation(user_id, scope, kind, version, accepted_at, revoked_at, method)`, modelled on `voice_consent` [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:195-206]. Values:
   - `kind` ∈ {`age_18_plus`, `terms_of_service`};
   - `method` ∈ {`signup_password`, `signup_oauth`, `reprompt`}.
2. **Capture at sign-up**, as a separate unticked checkbox with neutral wording, or a date-of-birth field that does not reveal the threshold:
   - extend `UserRegister` (strict DTO, so this is a contract change) [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_auth.py:56-58];
   - for OAuth users, a blocking first-login screen;
   - existing users are prompted on their next login.
3. **Gate server-side.** Narration (`route_chat.py:1224`), calls (next to `require_current_voice_consent`, `admission.py:96`), recipe preview (`voice_presets.py:99`) and any future voice endpoint return **428 `attestation_required`** when the current `age_18_plus` and `terms_of_service` versions are missing. The existing `consent_required` and `consent_stale` handling in the SPA is the template (07 §11.5).
4. **Keep the `localStorage` modal only as UX.** Fix the legal-hash bypass, so that it re-evaluates on navigation, or simply rely on the server gate.
5. **A minor-report path.** Reports of minors lead to voice being disabled at once and the account being reviewed. Add a "report a minor" option on the Contact page.
6. **Stronger age assurance** (age estimation or ID checks) is needed **only if** adult content is ever enabled, or a jurisdiction requires it [unverified: legal]. Do not build it for the no-NSFW launch.
7. **No youth marketing.** No under-18 positioning anywhere. This is a PUP §1 condition for avoiding written approval.

### 8.5 Content guardrails before narrating

Today narration goes straight to the provider. The only moderation-like handling is mapping MiniMax error codes 1026 and 1027 to `content_blocked` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:20; src/services/tts_generation/errors.py:17,104]. With ElevenLabs there is no synchronous signal at all (§3.3), so:

1. **A pre-TTS moderation step** runs on every narration segment, call sentence and preview text, before any ElevenLabs request.
   - **Hard block:**
     - sexual content of any kind while the no-NSFW policy stands, and always for minors or child-like characters;
     - incest, bestiality, necrophilia and non-consent;
     - encouragement of self-harm or suicide;
     - slurs and hate;
     - sexual or defamatory content about real people;
     - impersonation of real politicians;
     - gratuitous gore, as opposed to ordinary combat;
     - private data (PII, payment numbers, IDs).
   - **Outcome:** the turn keeps its text, the segment gets `content_blocked`, the user is charged 0 credits, nothing is sent to ElevenLabs, and the event is logged for abuse scoring (05 §11.6).
2. **Keep NSFW off for voice**, matching the app-wide policy (en.ts:884). Enabling adult audio later needs all of:
   - ElevenLabs' written approval (§9, item 5);
   - a content-rating field on cards and adventures;
   - age assurance (§8.4, item 6);
   - an updated ToS.
3. **Real people.** Flag cards whose name or description matches a public-figure list, and force a generic voice. Never clone or design sound-alikes.
4. **Minors in fiction.** Child characters may be narrated in non-sexual contexts with an adult or neutral voice. No child-like voices in the public catalog: the Library bans them, and designing them carries high PUP §1 risk.
5. **Companion safeguards** against "harmful emotional dependency":
   - no guilt-tripping or retention prompts in character voice;
   - session-length or break nudges (every 3 hours at most for any user flagged as a minor, per SB 243 [secondary]);
   - self-harm detection that pauses voice and shows crisis resources;
   - a published self-harm protocol.
6. **Bracket injection.** User and LLM text containing `[...]` must be escaped or stripped before v3 and v4, so that users cannot inject audio tags (G11). This is also a moderation bypass vector.
7. **Never test with prohibited content against ElevenLabs.** Test the moderation path with mocks (PUP intro).
8. **Beta gate.** Before shipping any ElevenLabs feature, check that its docs carry no alpha, beta or preview label (Beta Services Addendum).

### 8.6 Account-risk operations

- **Route the ElevenLabs account email to a monitored shared inbox.** Warnings arrive by email before bans [secondary: MIT TR case].
- **Separate service-account keys per surface** (05 §11.2). ElevenAPI §5.1 lets ElevenLabs disable one credential, and per-surface keys limit the blast radius.
- **Per-user audit trail** (`user_id`, `voice_id`, text hash, `request_id`, time). All activity is attributed to our account (ElevenAPI §2.2), and ElevenLabs can trace generations back to us.
- **A per-user voice kill switch**, and an incident runbook for voice bans, key disables and workspace suspension, with a text-only fallback (05 §11.6).
- **Error mapping.** Treat these as non-retryable and refunded:
  - any 4xx not in the documented validation, auth and not-found sets;
  - 403 `voice_access_denied` or `forbidden` on a voice that worked before;
  - any `detail.message` mentioning terms, verification or moderation.

  Mark the voice `suspended_by_provider` and alert root (05 §6.6, 08 guards).

---

## 9. Items needing written confirmation from ElevenLabs sales or legal

Send these as one written request to sales, with legal@elevenlabs.io copied (the Voice Library page names that address [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md]). Keep the replies with the plan.

1. **B2C status.** magic-worlds is a paid consumer web app. Our backend alone calls the TTS, Text to Dialogue and (possibly) STT APIs, and plays the resulting audio to our own 18+ users inside our product. Users never get API access. Does this count as **Making Available** under the OEM Terms? If not, confirm that it is ordinary commercial use under the ToS on our plan. If yes, what agreement is needed, given that OEM §1.I excludes consumers?
2. **Library voices for consumers.** May our users choose, inside our app, among Voice Library voices that we have added to our account, and hear Output generated with them? Is any attribution, owner credit or owner approval required? Does the answer change for voices with financial rewards enabled?
3. **Contracting party and tier.** Which plan is the minimum for item 1: is Pro acceptable, or must it be Scale or above? Must the account holder be an incorporated entity (OEM §1.D), or may a sole proprietor hold it?
4. **End-user terms.** For PUP §12 ("not more permissive"), is a click-wrap ToS that incorporates the PUP and requires 18+ sufficient? Must ElevenLabs be named as a third-party beneficiary outside the OEM framework?
5. **Adult content.** Is consensual adult (erotic) fiction narration permitted for API customers under the PUP of 2026-10-09? If so, under what prior approval or safeguards (PUP introduction), and does it depend on the voice type (owned designed, IVC, Library)? Until the answer is yes, voice stays no-NSFW.
6. **Moderation signals.** What HTTP status and `detail.code` or `detail.message` does a request get when blocked by Live Moderation, or when a voice is banned or needs CAPTCHA? Is a refused request billed? Which categories does Live Moderation check?
7. **Account enforcement.** Is there any notice to the workspace before a key, voice or workspace is restricted? Which email or webhook receives warnings? Can enforcement target a single service account or key (ElevenAPI §5.1) rather than the whole workspace?
8. **Higher-risk use.** Does an 18+ AI roleplay and companion app count as one of the higher-risk uses described in the PUP introduction, so that prior approval or specific safeguards are needed? If so, which?
9. **ZRM eligibility.** Would ZRM be granted to this use case on Enterprise, or is mature-fiction roleplay "high risk" under the ZRM page?
10. **Removal by ElevenLabs.** If ElevenLabs removes a shared voice under VLA §8, do accounts that added it keep notice-period access? How are they notified?
11. **Preview caching.** May we store Library `preview_url` audio, and our own generated previews, on our servers and serve them to our users (G3)?
12. **Replacement voices.** Are the Default-voice replacements (Darian, Talia, Eldrin and so on) ElevenLabs-owned, and is their availability guaranteed indefinitely, with no notice period?
13. **IVC verification.** When does an IVC return `requires_verification=true`, and how is it completed for a consenting third-party speaker without the dashboard (G13)?
14. **Startup Grant.** Does a Scale-level Startup Grant count as a Business Entity plan for OEM §1.D and §2.B (05 §2.1)?

---

## 10. Status of critic gaps and owner decisions

| Item | Status after this note |
|---|---|
| **G1: Library licensing** | **Mostly resolved on paper.** No clause forbids it. No attribution is owed. The owner controls are notice period, Live Moderation, exclude-free-users and legacy rates. ElevenLabs can remove voices at will. Live Moderation's refusal shape is undocumented, so we exclude it. **Open:** written confirmation of B2C use (§9, items 1–2). The G1 staging test is replaced by policy-safe text, or dropped (§3.4). |
| **G16: age gate** | **Resolved as an analysis.** The current gate is client-only, bundled, unrecorded and bypassable, and the backend records no age acceptance anywhere. The fix is in §8.4. **Open:** legal sign-off on attestation vs assurance per jurisdiction. |
| Decision #2: plan, policy half | **Resolved conditionally:** Scale held by an entity, plus written confirmation, escalating to Enterprise if B2C counts as Making Available (§8.1). The operational half (concurrency, slots) stays with 05 and G15. |
| Decision #16: content policy, policy half | **Resolved conditionally:** voice launches under the existing no-NSFW policy with mandatory pre-TTS moderation and companion safeguards (§8.5). The localStorage attestation is **not** sufficient (§4.3). Adult audio waits for §9, item 5. **Open:** who signs off the legal review. |
| C11 (plan tier) | Corrected (§7): Scale is a hedge, not OEM eligibility for consumers. |
| C1 (default voices) | Licensing is fine; the expiry rules them out (§2.5). |
| G3 (preview caching rights) | Still open. Added to §9, item 11. |
| G13 (IVC compliance) | Partly closed: obligations and record set (§5). Open: the verification path and `generated_voice_id` lifetime. |

---

## Sources

### ElevenLabs legal documents (read 2026-10-12)

- Terms of Service (non-EEA), updated 2026-10-09: https://elevenlabs.io/terms-of-use [verified]
- Terms of Service (EEA/UK/CH), updated 2026-10-09: https://elevenlabs.io/terms-of-use-eu [verified]
- Prohibited Use Policy, updated 2026-10-09: https://elevenlabs.io/use-policy [verified]
- ElevenAPI Terms, updated 2026-10-09: https://elevenlabs.io/elevenapi-terms [verified]
- ElevenAgents Terms, updated 2026-10-09: https://elevenlabs.io/agents-terms [verified]
- ElevenCreative Terms, updated 2026-10-09: https://elevenlabs.io/creative-terms [verified]
- Service-Specific Terms index, updated 2026-10-09: https://elevenlabs.io/service-specific-terms [verified]
- OEM Terms, updated 2025-02-28: https://elevenlabs.io/oem-terms [verified]
- Voice Library Addendum, updated 2026-03-06: https://elevenlabs.io/vla [verified]; EU variant https://elevenlabs.io/vlaeu [listed in search; not read]
- Beta Services Addendum, updated 2024-11-13: https://elevenlabs.io/bsa [verified]
- Data Processing Addendum, updated 2026-04-08: https://elevenlabs.io/dpa [verified]
- Privacy Policy, updated 2026-10-09: https://elevenlabs.io/privacy-policy [verified]

### ElevenLabs docs, help center and product pages (read 2026-10-12)

- Can I publish the content I generate?: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform.md [verified]
- Legal and Safety FAQ index: https://elevenlabs.io/docs/help-center/legal.md [verified]
- What are No-Go Voices?: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md [verified]
- Country restrictions: https://elevenlabs.io/docs/help-center/legal/do-you-restrict-access-to-the-service-and-platform-for-any-specific-countries.md [verified]
- What is Live Moderation?: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md [verified]
- Children's or child-like voices: https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library.md [verified]
- Restrictions on voices for cloning: https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/are-there-any-restrictions-on-what-voices-i-can-upload-for-voice-cloning.md [verified]
- What are Default voices?: https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices.md [verified]
- How do I access Default voices?: https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-access-eleven-labs-default-voices.md [verified]
- Can users have more than one account?: https://elevenlabs.io/docs/help-center/account/general/can-users-have-more-than-one-account.md [verified]
- Voice Library guide: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md [verified]
- Payouts: https://elevenlabs.io/docs/eleven-creative/voices/payouts.md [verified]
- Instant Voice Cloning guide: https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning.md [verified]
- Voice cloning concepts: https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning.md [verified]
- Create IVC (API): https://elevenlabs.io/docs/api-reference/voices/ivc/create.md [verified]
- List voices (API, moderation and safety fields): https://elevenlabs.io/docs/api-reference/voices/search.md [verified]
- Errors reference: https://elevenlabs.io/docs/eleven-api/resources/errors.md [verified]
- Zero Retention Mode: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md [verified]
- Models: https://elevenlabs.io/docs/overview/models.md [verified]
- Changelog: https://elevenlabs.io/docs/changelog [verified; latest entry 2026-10-05]
- llms.txt index: https://elevenlabs.io/docs/llms.txt [verified]
- Safety page: https://elevenlabs.io/safety [verified]
- Pricing: https://elevenlabs.io/pricing [verified]; API pricing: https://elevenlabs.io/pricing/api [verified]
- Commercial voices marketing page: https://elevenlabs.io/voice-library/commercial [verified; marketing, not contractual]

### Secondary

- MIT Technology Review, 2025-02-14, voice clone warning and ban: https://technologyreview.com/2025/02/14/1111900/ai-voice-clone-say-arse-then-banned [secondary; summary via search]
- Boing Boing summary of the same case: https://boingboing.net/2025/02/19/woman-banned-from-assistive-ai-app-after-teaching-it-to-say-arse.html [secondary; returned 403 to fetch]
- Sync support article, report of an ElevenLabs error saying a voice may violate the ToS and needs verification: https://support.sync.so/articles/5652909924-why-am-i-getting-the-voice-may-violate-elevenlabs-terms-of-service-error-during-tts [secondary]
- AI adult-content policy tracker: https://aihaven.com/ai-adult-content-policy-tracker/ [secondary; its Agents-terms claim is not in today's Agents terms]
- Iconic Marketplace coverage: https://the-decoder.com/elevenlabs-opens-a-marketplace-for-iconic-ai-voices/; https://alternativeto.net/news/2025/11/elevenlabs-launches-a-new-iconic-marketplace-for-licensing-ai-generated-celebrity-voices/ [secondary]
- California SB 243 summaries: https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law; https://fpf.org/blog/understanding-the-new-wave-of-chatbot-legislation-california-sb-243-and-beyond/ [secondary]

### Codebase (read-only, 2026-10-12)

Frontend `/home/andres/WebstormProjects/magic-worlds`:
- `src/ui/components/AppWarningModal.tsx:7-104`
- `src/app/router/AppRouter.tsx:214`
- `src/app/i18n/locales/en.ts:879,884,886,888,1962,2047,2080,2102,4823,4825`
- `src/app/i18n/locales/es.ts:889,894` (2057, 4833 and 4835 per 07)
- `src/features/legal/components/legalContent.ts:21`
- `src/shared/types/ui.types.ts:18-62`
- `src/shared/types/auth.types.ts:217-221`
- `src/infrastructure/api/index.ts:1075-1081`
- `src/features/admin/voices/components/VoiceCloneForm.tsx:43-150`

Backend `/home/andres/PycharmProjects/magic-worlds-api`:
- `src/routes/user/route_auth.py:52-58,1824,1832,1845-1890`
- `src/database/mysql/db.sql:1-18,195-206`
- `src/services/voice_orchestration/config.py:26`
- `src/services/voice_orchestration/admission.py:96-105`
- `src/routes/user/route_voice_call.py:484`
- `src/routes/user/route_chat.py:1224,1433`
- `src/routes/voice_presets.py:87,99`
- `src/routes/billing_subscriptions.py:425-555`
- `src/routes/patreon.py:32`
- `src/routes/card_sharing.py:77`
- `src/services/tts_generation/minimax_adapter.py:20`
- `src/services/tts_generation/errors.py:17,104`
- `src/services/image_generation/fal_adapter.py:270`
- `src/services/minimax_voice_admin.py`
- `src/routes/media_assets.py:111,115`
- `src/routes/tts.py:139`

### Earlier research notes

- [00_current_tts_review.md](./00_current_tts_review.md)
- [03_elevenlabs_voices_catalog_cloning_design.md](./03_elevenlabs_voices_catalog_cloning_design.md) (§4–§6, §10, §12, §14)
- [05_elevenlabs_platform_pricing_limits_policy.md](./05_elevenlabs_platform_pricing_limits_policy.md) (§2, §4–§6, §11, §12)
- [07_frontend_minimax_inventory.md](./07_frontend_minimax_inventory.md) (§7.4, §11.5)
- [08_voice_data_model_migration_surface.md](./08_voice_data_model_migration_surface.md) (§6.5)
- [09_research_critic_gaps.md](./09_research_critic_gaps.md) (G1, G13, G16, decisions #2 and #16)
