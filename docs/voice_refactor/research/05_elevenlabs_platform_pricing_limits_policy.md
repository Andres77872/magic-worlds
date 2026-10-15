# ElevenLabs platform: pricing, limits, security, policy and SDKs

> **Research scope (reviewed 2026-10-14):** Historical evidence from the dates stated below, including the retired MiniMax baseline. Vendor prices, model/API facts and policy claims were not reverified in this documentation pass. Current application status is **WIP** and is tracked in [00](../00_current_status_and_roadmap.md); later native ElevenLabs code/cutover supersedes migration-era implementation assumptions here.

Research date: **2026-10-12**. Read-only research. No code was changed.

## Scope

This note covers the **platform and operations** side of running ElevenLabs in production for magic-worlds. The app is an AI roleplay product. It bills users server-side in its own credits, and the FastAPI BFF (`magic-worlds-api`) is the only process that talks to providers.

Topics covered:
- plans and pricing, and how API usage is billed;
- concurrency, queueing and 429 handling;
- API keys, service accounts and single-use tokens;
- data handling (residency, Zero Retention Mode, history, training, DPA, certifications);
- the content and usage policy as it applies to narrating user-driven stories;
- the official SDKs, and whether the backend should use them;
- webhooks and reliability;
- a cost comparison with today's MiniMax stack.

It ends with concrete recommendations mapped to the current config (`TTS_GLOBAL_CONCURRENCY`, `VOICE_GLOBAL_CONCURRENCY`, and so on). The baseline it builds on is [00_current_tts_review.md](./00_current_tts_review.md).

Model capabilities (voices, v3/v4 audio tags, WebSocket protocols, voice design and cloning flows) are covered only where they affect cost, limits or policy. Other notes in this folder cover them in depth.

### Confidence markers

| Marker | Meaning |
|---|---|
| `[verified: URL]` | Read today (2026-10-12) on an official ElevenLabs page, an official ElevenLabs package registry entry, or ElevenLabs SDK source code. |
| `[secondary: URL]` | Non-official source, such as a blog, aggregator or reseller. |
| `[unverified]` | From memory or inference. Check it before relying on it. |
| `[code: path:line]` | Read in this repository or in the backend repository. |

ElevenLabs ships weekly, and its own changelog confirms the cadence [verified: https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy.md]. On the research date, **Eleven v4 had launched two weeks earlier** (2026-09-28) [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md], and a **v4 launch promotion runs "until Oct 12"**, the research date itself; the API pricing page still showed it on 2026-10-12 [verified: https://elevenlabs.io/pricing/api]. Treat it as expired for planning. Re-check every price in this note before a purchase decision.

---

## Table of contents

1. [Key findings (TL;DR)](#1-key-findings-tldr)
2. [Plans and pricing](#2-plans-and-pricing)
3. [Concurrency, queueing and rate limits](#3-concurrency-queueing-and-rate-limits)
4. [API keys and access control](#4-api-keys-and-access-control)
5. [Data handling, privacy and compliance](#5-data-handling-privacy-and-compliance)
6. [Content and usage policy for an AI roleplay app](#6-content-and-usage-policy-for-an-ai-roleplay-app)
7. [SDKs, and SDK vs raw httpx/websockets](#7-sdks-and-sdk-vs-raw-httpxwebsockets)
8. [Webhooks](#8-webhooks)
9. [Reliability: status, SLAs, regions, timeouts and retries](#9-reliability-status-slas-regions-timeouts-and-retries)
10. [Cost comparison: MiniMax vs ElevenLabs](#10-cost-comparison-minimax-vs-elevenlabs)
11. [Recommendations for magic-worlds](#11-recommendations-for-magic-worlds)
12. [Open questions](#12-open-questions)
13. [Sources](#13-sources)

---

## 1. Key findings (TL;DR)

**Billing and price**
1. **API usage is billed in US dollars, not credits** [verified: https://elevenlabs.io/pricing/api].
   - The plan fee works as a prepaid dollar allowance spent at per-unit list rates. Starter at $6 buys 75,000 v2 characters at $0.08 per 1K, which is exactly $6 / $0.08.
   - Below Enterprise, a bigger plan therefore buys **concurrency, seats, voice slots and features, not a lower unit price** (§2.2).
2. **Unit prices today** [verified: https://elevenlabs.io/pricing/api]:

   | Model | $ per 1K characters |
   |---|---|
   | Flash / Turbo | 0.04 |
   | v3 Conversational | 0.04 |
   | Multilingual v2 | 0.08 |
   | v3 | 0.08 |
   | v4 | 0.08 list (0.022 during the promotion that ends 2026-10-12) |
   | v4 Turbo | 0.04 list (0.011 during the promotion) |

   Speech to text is $0.22/h for Scribe v2 and $0.39/h for Scribe v2 Realtime.

   *Added during verification:* the per-plan "characters included" for v4 and v4 Turbo on the API pricing table are computed at the **promo** rate (for example Starter 273,000 v4 characters = $6 / $0.022, Pro 4,500,000), not at list price. After the promotion, expect the v4 allowance to fall to the v2/v3 figures (Starter 75,000, Pro 1,238,000) [verified: https://elevenlabs.io/pricing/api; the post-promo figure is inference].
3. **MiniMax speech-2.8-turbo costs $0.06 per 1K characters**, and HD costs $0.10 [verified: https://platform.minimax.io/docs/pricing/overview]. At list prices, ElevenLabs Flash v2.5 and v4 Turbo are **about 33% cheaper** than our current turbo. Multilingual v2, v3 and v4 are **about 33% more expensive** (§10).

**Concurrency**

4. **Concurrency is per plan and per model family.**

   | Plan | Multilingual v2 and other non-Flash | Flash |
   |---|---|---|
   | Pro | 10 | 20 |
   | Scale | 15 | 30 |

   - Requests over the limit are **queued** (about 50 ms extra), not rejected outright [verified: https://elevenlabs.io/docs/overview/models.md].
   - Text to Speech WebSockets count **only while generating**.
   - Text to Dialogue WebSockets, the only realtime path for `eleven_v4_turbo`, hold a **session for the whole connection lifetime**. That pool is separate: Pro 70, Scale 105 [verified: https://elevenlabs.io/docs/overview/models.md].
   - *Corrected during verification:* the queueing behaviour does **not** apply to that session pool. A new Text to Dialogue WebSocket opened while all sessions are in use "is rejected with a `too_many_concurrent_requests` error" [verified: https://elevenlabs.io/docs/overview/models.md].
   - *Added during verification:* `eleven_v4_turbo` on the Text to Dialogue WebSocket accepts **exactly one registered voice per connection**; `eleven_v4` accepts up to 10 [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd.md]. A call that switches between several character voices would need one session per voice.

**Access control**

5. **Use service-account keys in production.** They can be scoped to endpoint permissions, given a per-billing-period credit cap (`character_limit`), and IP-allowlisted. They do not expire, so rotation is manual. Service accounts need a **multi-seat workspace**, which means Scale (3 seats) or above [verified: https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md; https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts.md; https://elevenlabs.io/pricing].

**Data and privacy**

6. **Zero Retention Mode (`enable_logging=false`), data residency (EU, IN, SG), HIPAA BAAs, SLAs and per-key concurrency are Enterprise-only** [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md; https://elevenlabs.io/docs/overview/administration/data-residency.md].
   - Without ZRM, every TTS request's text and audio is kept in ElevenLabs history.
   - Deleting it later still leaves "debugging and moderation logs" and up to 30 days of backups.
   - Training on customer data is **opt-out**, and only for non-Enterprise accounts [verified: https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models.md].

**Policy**

7. **The policy was updated 2026-10-09** [verified: https://elevenlabs.io/use-policy]. It matters for roleplay in these ways:
   - 18+ accounts only;
   - youth-directed apps need written approval;
   - no CSEA;
   - no erotic content involving incest, bestiality or necrophilia, and no non-consensual intimate content;
   - no gratuitous gore;
   - no impersonation of real people without consent;
   - a ban on "creating harmful emotional dependency", which bears on companion AI;
   - "Attempting to violate this Policy is itself a violation."

   ElevenLabs documents **no synchronous moderation error code** for standard TTS. The risk is enforcement at the **account level** (suspension), so **app-side moderation before narration is mandatory**.
8. **The OEM Terms bar Free, Starter, Creator and Pro accounts from "Making Available" the Services**, and their End User definition excludes consumers [verified: https://elevenlabs.io/oem-terms]. Whether a B2C roleplay app that plays generated audio counts as "Making Available" is a **legal question to raise with ElevenLabs sales**. Choosing Scale or above avoids the tier problem either way.

**SDK**

9. **Python SDK `elevenlabs` 2.71.0** (2026-10-05; `3.0.0a1` is in pre-release) [verified: https://pypi.org/pypi/elevenlabs/json]:
   - it has an async client;
   - it defaults to **240 s timeouts** and **2 automatic retries on 408/409/429/5xx**;
   - it has **no async WebSocket client for TTS stream-input or Text to Dialogue**, only a sync helper built on `websockets.sync` [verified: elevenlabs-python 2.71.0 wheel source].

   Recommendation: keep **raw httpx/websockets adapters with strict contracts** for the hot paths. The SDK is optional and should be pinned, used only for low-volume admin work.

**Reliability**

10. **Self-serve has no SLA.** The terms say "as is" and "as available" [verified: https://elevenlabs.io/terms-of-use]. The status page shows several TTS/STT latency or error incidents in Aug–Oct 2026 [verified: https://status.elevenlabs.io/history]. Plan for:
    - short timeouts;
    - budget-aware retries that honour `Retry-After`;
    - a circuit breaker;
    - refunds on failure.

---

## 2. Plans and pricing

### 2.1 Subscription plans (self-serve + Enterprise)

All values were read today from [verified: https://elevenlabs.io/pricing], except where a row says otherwise.

| | Free | Starter | Creator | Pro | Scale | Business | Enterprise |
|---|---|---|---|---|---|---|---|
| Monthly price | $0 | $6 (promo: $1 first month, "Until Oct 18") | $22 (promo: $11 first month) | $99 | $299 | $990 | Custom |
| Annual price | n/a | $60/yr | $220/yr | $990/yr | $2,990/yr | $9,900/yr | Custom |
| Monthly credits (UI accounting) | 10,000 | 30,000 | 121,000 | 600,000 | 1,800,000 | 6,000,000 | Custom |
| Commercial use | **No** (ToS: non-commercial only) | Yes | Yes | Yes | Yes | Yes | Yes |
| Custom voice slots (IVC + Voice Design) | 3 (Voice Design only) | 10 | 30 | 160 | 660 | 2,200 | Custom |
| Instant Voice Cloning | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Professional Voice Clones | No | No | 1 | 1 | 3 | 10 | Custom |
| Max MP3 quality | 128 kbps / 44.1 kHz | 128 kbps | 192 kbps | 192 kbps + 44.1 kHz PCM via API | 192 kbps + PCM | 192 kbps + PCM | Custom |
| Concurrency, as shown on the pricing page | 2 | 3 | 5 | 10 | 15 | **25** (conflict: see §3.6) | Elevated |
| Workspace seats | 1 | 1 | 1 | 1 | **3** | **10** | Custom |
| OEM "Make Available" allowed? | No | No | No | No | Yes | Yes | Yes |

Sources for rows not taken from the pricing page:
- Commercial use: [verified: https://elevenlabs.io/terms-of-use].
- Free voice slots usable only with Voice Design, and cloning available on Starter and above: [verified: https://elevenlabs.io/docs/overview/administration/billing.md].
- Output-format plan gates (`mp3_44100_192` needs Creator+; `pcm_44100` and `wav_44100` need Pro+): [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md].
- OEM row: [verified: https://elevenlabs.io/oem-terms].

Notes:
- **Free tier is unusable in production.** The ToS says "Free Users … may only use the Services for non-commercial purposes" [verified: https://elevenlabs.io/terms-of-use], and the use policy also bans "commercial use on free plans" [verified: https://elevenlabs.io/use-policy].
  - *Corrected during verification:* the pricing page and ToS do not mention attribution, but the help center still says "audio generated outside of a subscription will always require attribution" [verified: https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-content-after-my-subscription-ends.md]. This doesn't matter for us, because Free can't be used commercially anyway. It does mean audio generated on a lapsed subscription is a problem, so keep the production subscription from lapsing.
  - *Added during verification:* "Voice Library voices are not available via the API to free tier users" [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md].
- **Voice Library voices do not use custom voice slots.** Only Voice Design and cloned voices do [verified: https://elevenlabs.io/docs/overview/administration/billing.md]. This matters for the voice catalog design: a catalog built from library voices does not consume slots.
- **Startup Grants:** 12 months free with 33M characters, aimed at startups building conversational AI agents [verified: https://elevenlabs.io/pricing/api]. Recipients get **Scale-level benefits** [verified: https://elevenlabs.io/docs/overview/models.md]. Worth applying for (see §12).
- **Enterprise extras:** custom DPA and SLA terms, BAAs, SSO, volume discounts, priority support and custom rate limits [verified: https://elevenlabs.io/pricing; https://elevenlabs.io/pricing/api].

### 2.2 How API usage is billed in 2026 (USD, not credits)

- **"API usage is billed in US dollars, not credits."** It is metered per character for TTS, per audio minute for STT, per generation for Music and SFX, and per source minute for Dubbing [verified: https://elevenlabs.io/pricing/api].
- **What a plan includes is its price converted at the per-unit list rate.** The API pricing table gives, for Multilingual v2 and v3: Starter 75,000, Creator 275,000, Pro 1,238,000, Scale 3,738,000 and Business 12,375,000 characters [verified: https://elevenlabs.io/pricing/api]. These are exactly the plan prices divided by $0.08 per 1K.
  - **Inference:** below Enterprise there is no per-unit volume discount. A bigger plan buys concurrency, priority, seats, slots and features.
- **Pay As You Go (PAYG)** is how new self-serve subscriptions pay for usage beyond the plan [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md]. How it works:
  - You prepay a USD or INR balance, used after subscription credits. The minimum top-up is $5.
  - PAYG credits expire 12 months after purchase.
  - **Auto Top Up** defaults to a $20 top-up at a $10 threshold.
  - **"With Auto Top Up off, or after a failed attempt, usage pauses immediately"**, with no overage debt.
  - Without 2FA, monthly purchases are capped: Free, Starter and Creator $100; Pro $200; **Scale $600**; Business $2,000. Enabling 2FA removes the cap.
  - Top-ups are non-refundable.
  - *Added during verification:* at most **250 top-ups per month**; an **optional monthly spend cap** in the Top Up settings (off by default), separate from the 2FA purchase cap; with Auto Top Up on, a **minimum balance of $5** is required; the PAYG balance is stored in dollars and re-converted to credits at the new plan's rate on a plan change [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md].
- **Usage-based billing (legacy overage)** is not available on new self-serve subscriptions; it stays on Enterprise and legacy plans [verified: https://elevenlabs.io/docs/help-center/account/general/what-is-the-price-for-usage-based-billing.md; https://elevenlabs.io/docs/overview/administration/billing.md].
- **Rollover:** unused credits roll over for up to two months while on an active paid plan. A downgrade or cancellation forfeits them [verified: https://elevenlabs.io/pricing; https://elevenlabs.io/docs/overview/administration/billing.md].
- **Burst cap:** "there is a limit on the number of credits that can be used at once… twice the usual monthly quota" [verified: https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-to-how-many-credits-i-can-use-at-once.md].
- **Refunds:** only within 14 days, and only if no credits were used [verified: https://elevenlabs.io/docs/overview/administration/billing.md].
- **Operational consequence:** if the PAYG balance hits zero and auto top-up fails, **narration and calls stop at once**. We need monitoring of the subscription and balance (§11.5).

### 2.3 API per-unit prices (verified today)

All rows are from [verified: https://elevenlabs.io/pricing/api] unless marked otherwise.

| Product / model | Price | Per-request limit and notes |
|---|---|---|
| TTS `eleven_v4` | **$0.08 / 1K chars list**; $0.022 promo ("72% off until Oct 12") | 10,000 chars per request; served through the **Text to Dialogue API** [verified: https://elevenlabs.io/docs/overview/models.md; https://elevenlabs.io/docs/changelog/2026/9/28.md]. Plan allowances shown for v4 are computed at the promo rate (§1). |
| TTS `eleven_v4_turbo` | **$0.04 / 1K list**; $0.011 promo | Served through the **Text to Dialogue WebSocket**; ~100 ms median inference; one voice per connection [verified: https://elevenlabs.io/docs/overview/models.md; https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd.md] |
| TTS `eleven_v3` | $0.08 / 1K | 5,000 chars per request; multi-speaker dialogue |
| TTS `eleven_v3_conversational` | $0.04 / 1K | ~280 ms; realtime through the **Text to Dialogue WebSocket** (session-metered, like v4 Turbo) [verified: https://elevenlabs.io/docs/overview/models.md] |
| TTS `eleven_multilingual_v2` | $0.08 / 1K | 10,000 chars |
| TTS Flash / Turbo (`eleven_flash_v2_5`, `eleven_flash_v2`) | $0.04 / 1K | ~75 ms; 40,000 chars (v2.5). Turbo IDs are deprecated in favour of Flash [verified: https://elevenlabs.io/docs/overview/models.md] |
| STT Scribe v2 (batch) | $0.22 / hour | +$0.05/h keyterm prompting; +$0.07/h transcript editing |
| STT Scribe v2 Realtime | $0.39 / hour | +$0.08/h keyterms; +$0.12/h editing |
| Speech Engine (ElevenLabs STT + TTS + turn-taking; you bring the LLM) | $0.08 / min extra; burst $0.16 / min | Included minutes and concurrent calls per plan: Free 15/4, Starter 75/6, Creator 275/10, Pro 1,238/20, Scale 3,738/30, Business 12,375/40 |
| Music | $0.15 / min | 5 min per generation; commercial use on Starter+ |
| Sound effects | $0.12 / min (the FAQ says per generation: conflicting) | |
| Voice Changer / Voice Isolator | $0.12 / min | |
| Dubbing v1 / v2 | $0.33–0.50 / min; $2.20 / min | Not relevant to us |

Older prices for comparison: several third-party pages written in mid-2026 still list **$0.10/1K for v3 and Multilingual v2, and $0.05/1K for Flash and Turbo** [secondary: https://www.goodvibecode.com/text-to-speech/elevenlabs-api-pricing-explained; https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/; https://www.cartesia.ai/learn/elevenlabs-pricing]. This suggests a price cut around the v4 launch [unverified]. Budget with the **official list prices above**, and add a 25% buffer in case prices move back.

### 2.4 Credit multipliers (UI and credit view)

- In the credit view, Multilingual v2 costs 1 credit per character, and Flash/Turbo "API usage costs 0.5–1 credit per character" [verified: https://elevenlabs.io/pricing].
- The models page says Flash v2.5 has a "50% lower price per character for API generations" [verified: https://elevenlabs.io/docs/overview/models.md]. This matches the USD table: $0.04 vs $0.08.
- Credit equivalents for other products, from the same pricing page:

  | Product | Credits |
  |---|---|
  | STT | 330 per minute |
  | Music | 900 per minute |
  | SFX | 200 per generation |
  | Voice Changer / Isolator | 1,000 per minute |

  [verified: https://elevenlabs.io/pricing]
- Some **Voice Library voices carry a "credit multiplier"** and cost more per character than standard voices (example given: a 2x multiplier costs twice as many credits). It comes from a **legacy "custom rate"** set by the PVC owner, which is "no longer available for newly shared voices", and the effective multiplier depends on both that rate and **the user's subscription plan** [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers.md; https://elevenlabs.io/docs/help-center/product/voices/voice-library/why-cant-i-use-some-voices-from-the-voice-library.md]. The catalog importer should read and store any multiplier or rate field from the shared-voice API, and should block or flag those voices. The exact API field name was not verified [unverified].

### 2.5 What this means for us

- Price per character is the same on every self-serve tier. **Choose the tier on four things:**
  1. concurrency (§3);
  2. multi-seat, which unlocks service accounts (§4);
  3. the OEM tier rule (§6.9);
  4. voice slots, if the admin console will design or clone voices for the catalog.
- Our app credits must be converted from **characters**, not requests (§10.5). Today a narration job reserves quota per request, and only for segment 0 [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:923] [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433]. On a per-character provider bill, that design leaks money.

---

## 3. Concurrency, queueing and rate limits

### 3.1 Limits per plan

From the "Concurrency and priority" section [verified: https://elevenlabs.io/docs/overview/models.md]:

| Plan | Multilingual v2 (and other non-Flash TTS) | Flash | STT (batch) | Realtime STT | Music | Priority | Text to Dialogue WS sessions |
|---|---|---|---|---|---|---|---|
| Free | 2 | 4 | 8 | 6 | 0 | 3 | 14 |
| Starter | 3 | 6 | 12 | 9 | 2 | 4 | 21 |
| Creator | 5 | 10 | 20 | 15 | 2 | 5 | 35 |
| Pro | 10 | 20 | 40 | 30 | 2 | 5 | 70 |
| Scale | 15 | 30 | 60 | 45 | 5 | 5 | 105 |
| Business | 15 | 30 | 60 | 45 | 5 | 5 | 105 |
| Enterprise | Elevated | Elevated | Elevated | Elevated | Highest | 6 | Elevated |

- A help-center article gives the same split in two groups, "Flash and Turbo models" vs "all other models": 4/2, 6/3, 10/5, 20/10, 30/15, 30/15 [verified: https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it.md].
- No page states a **separate limit for v3, v4 or v4 Turbo over HTTP**. Treat them as "all other models", meaning the Multilingual v2 column, until ElevenLabs confirms [unverified].
- Free accounts with PAYG get Starter-level limits: 3 concurrent and priority 4 [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md].

### 3.2 How concurrency is counted

[verified: https://elevenlabs.io/docs/overview/models.md]

| Transport | What counts |
|---|---|
| HTTP (`/v1/text-to-speech/*`, `/v1/text-to-dialogue` convert and stream) | Each request counts while it is processed. |
| **Text to Speech WebSocket** (`/v1/text-to-speech/{voice_id}/stream-input`, multi-stream-input) | "only the time where our model is generating audio counts… for most of the time, an open websocket doesn't count towards your concurrency limit at all." |
| **Text to Dialogue WebSocket** (the realtime path for `eleven_v4_turbo`) | "each open connection reserves one dialogue session from a separate pool for as long as it stays open". Generated audio does **not** count toward the standard limit. Idle connections close after **20 s** unless `keep_alive` messages are sent. |
| STT batch and realtime | Separate STT pools (columns above). |

- Concurrency is a property of the **workspace or subscription**, shared by all keys. The docs speak of "your workspace's dialogue sessions" [verified: https://elevenlabs.io/docs/overview/models.md].
- **Per-key concurrency limits exist but are Enterprise-only.** `platform_limits` on a key is documented as "Per-API-key concurrency limits (TTS/dubbing/music). Enterprise-only.", and the key edit API has `tts_concurrency_limit`, `music_concurrency_limit` and `dubbing_concurrency_limit` fields [verified: elevenlabs-python 2.71.0 `types/workspace_api_key_response_model.py`, `service_accounts/api_keys/types/*`].
- **Rule of thumb from ElevenLabs:** "a concurrency limit of 5 can typically support up to approximately 100 simultaneous audio broadcasts" for balanced agent dialogue or character voiceovers [verified: https://elevenlabs.io/docs/overview/models.md]. Plan from this, then scale-test (§3.7).
- **Requests per minute are not the metric.** The docs explain that RPM and concurrency differ, and that "our system cares about concurrency" [verified: https://elevenlabs.io/docs/overview/models.md]. The errors page still lists a `rate_limit_exceeded` code [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md], so a rate limiter may exist behind it. Neither page gives a number.

### 3.3 Queueing and priority

- "Once the concurrency limit is met, subsequent requests are processed in a queue alongside lower-priority requests. In practice this typically only adds ~50ms of latency." [verified: https://elevenlabs.io/docs/overview/models.md]
- The plan's "Priority level" column sets the queue order: Free 3, Starter 4, Creator to Business 5, Enterprise 6.
- Enterprise accounts over their limit may still succeed "albeit slower, on a best efforts basis" [verified: https://elevenlabs.io/docs/overview/models.md].
- The docs also document a `429 concurrent_limit_exceeded` (§3.4). **Inference:** queueing is bounded, so we will see 429s when we push far past the limit. Exact queue depth and timeout are undocumented [unverified].

### 3.4 Error envelope and 429 variants

Every error returns JSON with a `detail` object containing `type`, `code`, `message`, `status` (legacy: "use `code` instead"), `request_id`, and sometimes `param` [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md].

| HTTP | `type` | Codes relevant to us | Retry? |
|---|---|---|---|
| 400 | `validation_error` | `text_too_long`, `text_too_short`, `invalid_text`, `empty_text`, `invalid_parameters` (see `param`), `missing_required_field`, `invalid_voice_settings`, `invalid_voice_id`, `unsupported_model`, `invalid_output_format`, `invalid_audio`, `audio_too_long` / `audio_too_short` | No. Fix the request. |
| 400 | `invalid_request` | `bad_request`, `malformed_json`, `invalid_content_type`, `request_too_large` | No |
| 401 | `authentication_error` | `invalid_api_key`, `missing_api_key`, `invalid_authorization_header`, `unauthorized` (an expired user key also returns 401) | No. Alert. |
| 402 | `payment_required` | `insufficient_credits` | No. Open the billing breaker and alert. |
| 403 | `authorization_error` | `forbidden`, `insufficient_permissions` (key scope), `workspace_access_denied`, `feature_not_available`, `subscription_required`, `voice_access_denied`, `model_access_denied`; IP not on the allowlist also gives 403 | No. Alert on config drift. |
| 404 | `not_found` | `voice_not_found`, `model_not_found`, `history_item_not_found` | No. A catalog voice was removed: see §8. |
| 409 | `conflict` | `voice_already_exists`, `already_processing`, `concurrent_modification` | Only `concurrent_modification` ("retry with the latest version") |
| 422 | (FastAPI validation) | `detail[]` with `loc`, `msg`, `type` on TTS convert [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md] | No |
| **429** | `rate_limit_error` | **`rate_limit_exceeded`** ("implement exponential backoff"), **`concurrent_limit_exceeded`** ("wait for the current requests to complete"), **`system_busy`** ("Try again later") | Yes, but differently per code (§9.5) |
| 500 | `internal_error` | `internal_error` | Yes, with limits |
| 503 | `service_unavailable` | `service_unavailable`, `maintenance` | Yes, with backoff |

Parsing notes:
- **Naming drift.** The help-center 429 article and the Text to Dialogue section still use **`too_many_concurrent_requests`** [verified: https://elevenlabs.io/docs/help-center/technical/api-error-code-429.md; https://elevenlabs.io/docs/overview/models.md]. The errors reference uses `concurrent_limit_exceeded`. The adapter must accept **both**, read `detail.code` first and fall back to `detail.status`.
- **Response headers to monitor:**
  - `current-concurrent-requests` and `maximum-concurrent-requests` [verified: https://elevenlabs.io/docs/overview/models.md];
  - `character-cost` and `request-id` (with `x-trace-id` shown in examples) [verified: https://elevenlabs.io/docs/api-reference/introduction.md];
  - `x-region` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md].
- An older English copy of the docs read the cost from `x-character-count` [secondary: search snippet of https://elevenlabs.io/docs/api-reference/introduction.md]. Read **both** `character-cost` and `x-character-count`, and log which one is present.
- **`Retry-After`:** not documented by ElevenLabs. The official SDK honours `retry-after-ms`, `retry-after` and `x-ratelimit-reset` when present [verified: elevenlabs-python 2.71.0 `core/http_client.py:26-118`]. Treat these as optional hints.

### 3.5 Concurrency vs our current architecture

| Path | Current mechanism | Count against ElevenLabs |
|---|---|---|
| Chat narration jobs | One HTTP request per segment, gated by a **per-process** `asyncio.Semaphore(TTS_GLOBAL_CONCURRENCY)`, default 3, max 20 [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:34-35] [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:94] | One per in-flight request, in the chosen model's column |
| Voice preview / admin synth lab | Not gated; preview is unmetered [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118] | One per request, unbounded today. **Must be gated.** |
| Realtime calls | `VOICE_GLOBAL_CONCURRENCY` (default 8, max 64) counts **calls** in MySQL `voice_quota_reservation` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:31,38] [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/quota.py:241-248]. Each call opens a prewarmed socket per turn, plus a **private socket** for a sentence that overlaps the one streaming [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:241-264,491-494]. The TTS queue holds up to 4 sentences [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:63] | **TTS WS (Flash):** only generation time counts, so cheap. **Text to Dialogue WS (v4 Turbo):** every open socket is a session for its lifetime, so the private-socket pattern **doubles** session use per call. |
| Call STT | Groq today. With Scribe: one batch request per VAD segment, or one realtime session per call | STT pools (Pro 40 batch / 30 realtime; Scale 60 / 45) |

### 3.6 Conflicts in the official docs

| Topic | Conflict | How to treat it |
|---|---|---|
| Business concurrency | Pricing page: **25**. Models page and help center: **15** (Flash 30) | Plan for **15/30** and confirm with sales. |
| 429 code name | `concurrent_limit_exceeded` vs `too_many_concurrent_requests` | Accept both. |
| SFX unit | Per minute in the price table, per generation in the FAQ | Not used yet. Confirm before migrating SFX. |
| v4 promo | Banner: "3x credits included on Creator+ until October 12"; API table: "72% off until Oct 12"; subscription page: "2x credits for two weeks… web and mobile apps only" [verified: https://elevenlabs.io/pricing; https://elevenlabs.io/pricing/api] | Ignore. It runs until the research date and the app-credit variant does not apply to the API. |

### 3.7 Recommended client-side concurrency control

1. **One workspace-wide budget, partitioned locally.** Concurrency is shared across keys, and per-key limits are Enterprise-only. Run a single provider limiter with **named pools**, so a narration backlog cannot starve live calls. Suggested pools:
   - `narration`
   - `preview`
   - `admin`
   - `call_tts`
   - `stt`
2. **Make it cross-process before scaling out.** `TTS_GLOBAL_CONCURRENCY` is per-process today [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:94]. Two Uvicorn workers would double the effective limit. Calls already use a MySQL counter (`quota.py`). Use the same pattern, or Redis, for TTS.
3. **Treat a concurrency 429 as back-pressure, not failure.** On `concurrent_limit_exceeded` or `too_many_concurrent_requests`, re-queue the job behind the limiter. This follows ElevenLabs' "wait for the current requests to complete". Do not burn a retry attempt or charge the user again.
4. **Adapt from the headers.** Read `maximum-concurrent-requests` and shrink the local pool if ElevenLabs reports a lower limit than configured. This catches plan downgrades and doc drift.
5. **Keep calls on the Flash TTS WebSocket**, or on one Text to Dialogue socket per call with `keep_alive`. Remove the "private socket per overlapping sentence" pattern when moving to Text to Dialogue. The Flash TTS WebSocket's `inactivity_timeout` defaults to 20 s and can go up to 180 s [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input.md].
6. **Scale-test as ElevenLabs recommends.** Simulate users rather than raw requests, ramp up slowly and randomise text sizes. The example is about 150 characters every 20 s per simulated caller. The docs ship a Locust script [verified: https://elevenlabs.io/docs/overview/models.md].

---

## 4. API keys and access control

### 4.1 Authentication

- REST requests use the header `xi-api-key: <key>` [verified: https://elevenlabs.io/docs/api-reference/authentication.md].
  - Our MiniMax code uses `Authorization: Bearer` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:8-17], so the header changes.
- On the TTS WebSocket, the key goes in the `xi-api-key` header, or in the first `InitializeConnection` message. `authorization` and `single_use_token` are also accepted as query parameters [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input.md].
- ElevenLabs keys look like `sk_…`. The official docs do not document the prefix; it comes from third-party key scanners [secondary: https://trevorfox.com/api-key-tester/elevenlabs/]. Single-use tokens use `sutkn_` [verified: https://elevenlabs.io/docs/api-reference/tokens/create.md]. Add a redaction pattern for that prefix and for `xi-api-key:` to the shared redactor, next to the MiniMax patterns [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py:24-32].

### 4.2 Key types and restrictions

[verified: https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md]

| Feature | User API key | Service-account API key |
|---|---|---|
| Owner | An individual (needs a Full Seat). Breaks if that user's access changes or they leave. | A service account, independent of people. **"recommended for backend systems, automation, and production."** |
| Availability | All plans | **Multi-seat customers only**, managed by workspace admins [verified: https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts.md] |
| Scope (endpoint permissions) | Yes | Yes. `permissions` is a list of `PermissionType` values, or `"all"` [verified: elevenlabs-python 2.71.0 `service_accounts/api_keys/types/…_permissions.py`] |
| Credit quota | Yes | Yes. `character_limit` is the "Maximum number of credits allowed in the current billing period". `character_count` is current use. It can be cleared with `"clear"` [verified: SDK `types/workspace_api_key_response_model.py`; https://elevenlabs.io/docs/changelog/2026/7/20.md] |
| IP allowlist | Yes. 1–100 IPv4/IPv6/CIDR entries; private ranges rejected; other IPs get **403** | Yes. `allowed_ips` added 2026-05 [verified: https://elevenlabs.io/docs/changelog/2026/5/13.md] |
| Expiry | 15 minutes to 30 days, or Never (the default); after expiry, **401** | **Never expires**, so rotate manually |
| Per-key concurrency | No | `tts_concurrency_limit` and similar, **Enterprise only** |
| Leak protection | Keys found in public GitHub repos are auto-disabled (`disable_reason=exposed_publicly`). `third_party_disable_allowed` is on by default for non-Enterprise plans | Same |
| Self-disable | `api_key_name=self` on the disable endpoint | Same. There is also a workspace revoke endpoint, `DELETE /v1/workspaces/api-keys/revoke` [verified: https://elevenlabs.io/docs/changelog/2026/6/1.md] |

**Rotation procedure** [verified: https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md]:
1. Create a new key, copying the old key's permissions.
2. Deploy it.
3. Delete the old key.

Service-account keys can be created, updated and deleted through `/v1/service-accounts/{id}/api-keys` [verified: SDK `service_accounts/api_keys`]. Service accounts themselves can be created with `POST /v1/service-accounts` [verified: https://elevenlabs.io/docs/changelog/2026/7/13.md].

**Permission scopes relevant to us** (full enum read from the SDK `types/permission_type.py`):

| Group | Scopes |
|---|---|
| Speech | `text_to_speech`, `speech_to_text`, `speech_to_speech` |
| Catalog | `voices_read`, `voices_write`, `add_voice_from_voice_library`, `models_read` |
| Voice creation | `voice_generation` (Voice Design), `create_instant_voice_clone`, `create_professional_voice_clone` |
| Pronunciation | `pronunciation_dictionaries_read`, `pronunciation_dictionaries_write` |
| History | `speech_history_read`, `speech_history_write` (needed to delete history items) |
| Media | `sound_generation`, `music_generation` |
| Ops | `user_read` (subscription), `workspace_analytics_full_read`, `webhooks_write` |
| Never grant | `publish_voice_to_voice_library`, `share_voice_externally`, `create_user_api_key`, `service_account_write`, `workspace_members_*`, `terms_of_service_accept` |

### 4.3 Workspaces, seats and groups

- Seats: Scale has 3 and Business has 10 [verified: https://elevenlabs.io/pricing].
- Seat types are now `seat_type` and `workspace_seat_type`, including `workspace_lite_member` [verified: https://elevenlabs.io/docs/changelog/2026/1/26.md; https://elevenlabs.io/docs/changelog/2026/2/9.md].
- Service accounts start with **no access**. Grant resources through **groups** (recommended) or direct sharing [verified: https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts.md].
  - **Voice catalog consequence:** voices designed or cloned in the dashboard by a human admin must be **shared with the service account's group**. Otherwise the narration key gets `voice_access_denied` or `voice_not_found`.
  - `POST /v1/service-accounts` accepts `default_sharing_groups` [verified: https://elevenlabs.io/docs/changelog/2026/7/13.md].
  - *Added during verification:* the reverse also applies. "If a service account creates a resource, only admins can see it by default but it can be shared" [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security.md]. Voices created through the admin console's service-account key must therefore be shared with the narration and calls service account (or its group) before those keys can use them.
- ElevenLabs recommends **one service account per environment**: production, testing, UAT [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security.md].
- It also recommends **resource-level access control in your own backend**, meaning a user-to-voice permission map, "so cloned voices can't be misused" [verified: same page]. This is directly relevant if Voice Studio ever lets users clone or design voices.

### 4.4 Single-use tokens (client-side access)

- `POST /v1/single-use-token/{token_type}` with `token_type` ∈ {`realtime_scribe`, `batch_scribe`, `tts_websocket`}.
- The response is `{"token": "sutkn_…"}`, valid for **15 minutes** and **consumed on first use** [verified: https://elevenlabs.io/docs/api-reference/tokens/create.md]. Introduced 2025-11 [verified: https://elevenlabs.io/docs/changelog/2025/11/5.md].
- **For magic-worlds: do not use them for now.** Letting the browser call ElevenLabs directly would bypass:
  - BFF metering and app-credit billing;
  - app-side content moderation (§6.10);
  - transcript storage and the call engine's barge-in logic.

  The only candidate is a later optimisation where the browser streams microphone audio straight to `realtime_scribe` for lower latency, with the BFF still minting the token, metering minutes and owning the LLM and TTS legs.

### 4.5 Recommended key topology

See §11.2.

---

## 5. Data handling, privacy and compliance

### 5.1 Global routing and data residency

- **Global routing has been the default since 2026-02.** `api.elevenlabs.io` sends each request to the nearest region: USA, Netherlands or Singapore. `api-global-preview.elevenlabs.io` is deprecated [verified: https://elevenlabs.io/docs/changelog/2026/2/9.md; https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md].
  - `https://api.us.elevenlabs.io` pins the US [verified: same; SDK `ElevenLabsEnvironment.PRODUCTION_US` in `environment.py`].
  - The `x-region` response header shows which region served the request.
- **Storage** is in the US by default. The privacy policy says: "Wherever you are, your personal information will be transferred to the United States for storage." [verified: https://elevenlabs.io/privacy-policy]
- **Isolated residency environments** are EU, India and Singapore [verified: https://elevenlabs.io/docs/overview/administration/data-residency.md]:
  - base URLs `api.eu.residency.elevenlabs.io`, `api.in.residency.elevenlabs.io` and `api.sg.residency.elevenlabs.io` (plus `wss://`);
  - **Enterprise only**;
  - **separate, blank workspaces with their own keys**, where mixing keys and URLs fails;
  - Dubbing is not available there;
  - instant voice clones need help from ElevenLabs to migrate;
  - ZRM must be enabled separately;
  - processing may still happen outside the region (subprocessors, support, **content moderation**). EU-only processing is possible only with ZRM.

### 5.2 Zero Retention Mode (ZRM)

[verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md]

| Aspect | Detail |
|---|---|
| Who | **Enterprise only.** It may be refused or revoked for "high risk" use cases or accounts flagged for moderation. |
| How | Send `enable_logging=false` (a query parameter) on each request. It covers API traffic only. |
| Eligible | `/v1/text-to-speech/*` plus the TTS WebSocket; `/v1/text-to-dialogue/*` (added 2026-06 [verified: https://elevenlabs.io/docs/changelog/2026/6/8.md]); `/v1/speech-to-speech/*`; `/v1/speech-to-text/*`; ElevenAgents |
| Not eligible | Music, Image & Video, **Instant and Professional Voice Cloning**, Dubbing, Studio |
| Not logged | TTS and Text to Dialogue text in and audio out; STT audio in and text out; the requester's email in logs |
| Side effects | "**History features are unavailable for this request, including request stitching**" (`previous_request_ids` / `next_request_ids`) [verified: SDK docstring `text_to_speech/raw_client.py:84`; https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md]. ElevenLabs "will not be able to diagnose issues with TTS/STS generations". Usage analytics still count the request. |
| Still retained | Support tickets, account data, and anything sent outside eligible request payloads |

**Request stitching and ZRM conflict.** Request stitching is the mechanism the narration redesign would use to keep prosody continuous across segments. Under ZRM, only text context (`previous_text` / `next_text`) remains [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md].

*Added during verification:* Text to Dialogue (the only HTTP path for `eleven_v4`) gained continuity fields on 2026-09-28 with **different names and tighter limits**: `previous_text` and `future_text` (max **100 characters** each) and `previous_request_ids` / `next_request_ids` (max **3 IDs**) [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md]. A v4 narration adapter cannot reuse the TTS field names.

### 5.3 History and retention without ZRM

- History preservation is **on by default**.
  - Deleting a generation through the API removes its audio and text from the database. However, "debugging and moderation logs may still retain data related to the generation".
  - **Backups keep deleted items for up to 30 days** [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md].
- Single items are deleted with `DELETE /v1/history/{history_item_id}`, and listed with "Get generated items" (`GET /v1/history`) [verified: https://elevenlabs.io/docs/api-reference/history/delete.md; https://elevenlabs.io/docs/llms.txt]. This needs the `speech_history_write` scope [verified: elevenlabs-python 2.71.0 `types/permission_type.py`]. No bulk-delete or auto-expiry setting was found [unverified].
- The DPA says that for self-serve accounts, ElevenLabs *may* delete content after 180 days of inactivity. Enterprise content is deleted within 30 days of termination [verified: https://elevenlabs.io/dpa].
- The privacy policy says derived **voice data** is kept no more than 3 years after the last interaction [verified: https://elevenlabs.io/privacy-policy].

### 5.4 Training on customer data

- ElevenLabs "uses certain data you provide to us to improve the quality of our audio models for everyone".
  - The opt-out is the account toggle **Terms and privacy → Data use → "Improve the models for everyone."** It applies only to new data.
  - **"By default, we don't train on any data from our Enterprise customers"** [verified: https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models.md].
- The ToS grants ElevenLabs a perpetual licence to use Content "to provide and improve the Services". It confirms the opt-out and says ElevenLabs "will not commercialize your voice on a standalone basis without your permission" [verified: https://elevenlabs.io/terms-of-use].
- No API-level opt-out flag was found. It is an account setting, not a per-request one [verified: https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models.md]. **Action:** turn it off on the production workspace on day one, and record it in the runbook.

### 5.5 GDPR, DPA, transfers and subprocessors

- DPA last updated **8 April 2026** [verified: https://elevenlabs.io/dpa]:
  - EU SCCs (2021/914), the UK Addendum, Brazil SCCs and Swiss FADP terms;
  - subprocessor list at compliance.elevenlabs.io, with **30 days' notice** of new subprocessors and a right to object;
  - breach notice "without undue delay" (no fixed number of hours);
  - audit rights met by a SOC 2 Type II report on request.
- Data subject requests go to dpo@elevenlabs.io or the online form [verified: https://elevenlabs.io/privacy-policy].
- **The OEM terms require us to obtain end-user consents** for ElevenLabs to process data we send, including our users' data [verified: https://elevenlabs.io/oem-terms]. Separately, our own privacy notice must list ElevenLabs as a processor or subprocessor for narration text and call audio [unverified: legal advice needed].

### 5.6 Certifications and HIPAA

| Claim | Source and confidence |
|---|---|
| SOC 2 (Type II) | Enterprise FAQ: "SOC 2 compliance" [verified: https://elevenlabs.io/pricing/api]. The DPA offers a "SOC 2 Type II report" for audits [verified: https://elevenlabs.io/dpa]. |
| ISO 27001, PCI DSS Level 1 | ElevenLabs marketing pages [secondary: https://elevenlabs.io/de/blog/speech-synthesis-20 via search; https://trustlists.org/company/elevenlabs/]. A longer list (ISO 27017, 27018, 27701, 42001) appears on product pages [secondary: search summary]. **The trust center (Vanta, https://compliance.elevenlabs.io) renders client-side and could not be read today.** |
| HIPAA | BAAs are **Enterprise only**. They require **ZRM**. They cover **ElevenAgents** in the agents doc [verified: https://elevenlabs.io/docs/eleven-agents/legal/hipaa.md]. Scribe v2 Medical is "HIPAA-eligible" [verified: https://elevenlabs.io/pricing/api]. Not relevant to magic-worlds. |
| Encryption in transit, GDPR alignment | Listed in the residency doc [verified: https://elevenlabs.io/docs/overview/administration/data-residency.md] |

Self-serve customers may see the badges but not the reports [secondary: https://deepgram.com/learn/elevenlabs-security-review-enterprise-guide].

### 5.7 What this means for us

- Narration text is **user-generated fiction**, which may be mature, personal or confessional. Call audio is **the user's voice**, which some laws treat as biometric data. Without Enterprise ZRM, both sit in ElevenLabs history and logs, in the US.
- Mitigations available below Enterprise:
  1. opt out of training;
  2. periodically delete our own history items with `speech_history_write` (§11.4);
  3. send only the text that must be spoken (we already strip `<think>` [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1174-1221]);
  4. never send user identifiers in text or metadata;
  5. disclose ElevenLabs in our privacy notice and voice-call consent (`VOICE_CONSENT_VERSION` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26]).
- **Move to Enterprise ZRM when the volume justifies it.** Weigh the loss of request stitching.

---

## 6. Content and usage policy for an AI roleplay app

### 6.1 Policy documents and dates

| Document | Last updated | Applies to |
|---|---|---|
| Prohibited Use Policy (PUP) | **09 October 2026** [verified: https://elevenlabs.io/use-policy] | Everyone who uses any ElevenLabs Service "whether directly, through an authorized reseller, or through a product or application built with our technology", so it covers **our end users** too |
| Terms of Service (non-EEA) | **09 October 2026** [verified: https://elevenlabs.io/terms-of-use] | The account holder (us) |
| OEM Terms | 28 February 2025 [verified: https://elevenlabs.io/oem-terms] | Customers who "bundle, make available and sublicense" the Services to End Users |
| Voice Library Addendum | 6 March 2026 [verified: https://elevenlabs.io/vla] | Use of shared library voices |
| Safety page | n/a [verified: https://elevenlabs.io/safety] | Describes safeguards |

### 6.2 Prohibited categories and their impact on roleplay narration

Paraphrased from [verified: https://elevenlabs.io/use-policy]:

| PUP category | What it bans | Roleplay impact |
|---|---|---|
| Sexual content | "Visual depictions of explicit sexual acts"; erotic material involving incest, bestiality or necrophilia; non-consensual intimate content | Narration of such scenes must be **blocked app-side**. The PUP does not separately address consensual adult erotic *text-to-audio*. Do not assume that is allowed: confirm in writing with ElevenLabs (§12). |
| Minors / CSEA | Anything that "exploits, endangers, or sexualizes anyone under 18"; youth-directed apps without written approval; voices or likeness of real minors | **Hard block.** It must hold even for fictional characters described as minors in sexual contexts. Age-gate the app 18+. |
| Violence and gore | "Gratuitous graphic or gory content that revels in serious injury, death, or abuse"; glorifying mass-casualty attacks | **No fiction exemption is mentioned.** Ordinary fantasy combat is presumably fine [unverified]; torture-porn style narration is not. |
| Self-harm | "Encouraging, promoting, instructing, or facilitating suicide, self-harm, or eating disorders" | Companion-style chats need self-harm detection: skip narration and show resources. |
| Hate and harassment | Hateful attacks on protected groups, slurs, targeted harassment, threats | Villain dialogue with slurs is a grey zone. Filter slurs before TTS. |
| Impersonation | Cloning or impersonating a living person's voice or likeness without "explicit and informed consent"; impersonating organisations | Character cards named after real people, and any user voice cloning |
| Elections and politics | Impersonating candidates or officials; "political campaigning without our prior written consent" | Block real-politician characters from narration. |
| Fraud and manipulation | "creating harmful emotional dependency or undue influence"; exploiting vulnerabilities | **A specific risk for companion roleplay.** Avoid dark patterns. |
| AI disclosure | Disclose AI interaction "where required by law or where failing to do so would materially mislead"; do not remove watermarks, metadata or provenance | Label voices as AI. Do not strip provenance when transcoding or storing. |
| Platform integrity | No circumventing guardrails (Voice CAPTCHA etc.) or usage limits; no coordinated or automated activity "intended to evade limits or controls we apply to individual accounts" | Do not shard traffic across several ElevenLabs accounts to dodge concurrency or enforcement. |
| Commercial and technical restrictions (*corrected and expanded during verification*) | No scraping; no using the Services or Output "to develop, train, fine-tune, or improve **any** AI model or service" (not only competing ones); no "client, wrapper, or proxy that gives anyone else access to our Services outside the terms that apply"; no "Making our Services or Output available to your own end users… on terms more permissive than those that apply to you" | Do not batch-generate audio for training datasets. Our own ToS must flow down the PUP to end users. The BFF must never expose a generic "speak any text with any voice" proxy. |
| Privacy | No exposing private information; sensitive data (health records, payment numbers, IDs) needs a prior written agreement | Narration of user-supplied PII is a risk. |
| Attempts | "Attempting to violate this Policy is itself a violation" | **Never red-team ElevenLabs with prohibited prompts**, even in staging. Test the moderation path with mocks. |

### 6.3 Age

- "You must be at least 18 to have an ElevenLabs account."
- Apps "aimed at under-18s" are prohibited without written approval [verified: https://elevenlabs.io/use-policy].
- The ToS and privacy policy repeat the 18+ rule [verified: https://elevenlabs.io/terms-of-use; https://elevenlabs.io/privacy-policy].

**Action:** magic-worlds must be 18+ (or at least have its narration and voice features restricted to verified adults). The terms of service must say so.

### 6.4 Voice cloning consent, public figures and no-go voices

- **Consent.** Cloning someone's voice requires their "explicit and informed consent" [verified: https://elevenlabs.io/use-policy]. Submitting recordings of anyone under 18 is prohibited.
- **Professional Voice Cloning** needs Creator+ and voice CAPTCHA verification by the voice owner, with manual verification as a fallback [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning.md].
- **Instant Voice Cloning** consent is a self-attestation in the dashboard [secondary: https://www.aitoolcurator.com/learn/elevenlabs/voice-cloning/]. The SDK response has a `requires_verification` flag [secondary: Mintlify SDK docs via search].
- **No-go voices.** ElevenLabs blocks clones resembling "prominent public figures"; violators face "warnings, removal of voices, a ban on the account" [verified: https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md]. The safety page confirms it blocks "the cloning of celebrity and other high risk voices" [verified: https://elevenlabs.io/safety].
- **Admin console implications** (today it clones on the shared account [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py]). The clone form must:
  - record the voice owner, a consent artefact (signed release) and the date;
  - be root-only;
  - never accept uploads from end users until a full consent flow exists.

### 6.5 Shared Voice Library voices (catalog risk)

- **Notice periods.** A sharer can withdraw a voice at any time. *Corrected during verification:* a notice period is **optional**. "If no notice period is set, their voice will be removed immediately… and anyone who has saved the voice will immediately lose access." When one is set, it ranges from **30 days to 2 years**, and users who saved or previously used the voice keep access for that period [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period.md; https://elevenlabs.io/vla].
  - The earlier "minimum 3 months" claim from a search result is wrong; the official minimum is 30 days.
  - **Catalog rule:** import only library voices that **have** a notice period (the Voice Library has a notice-period filter), and store its length [verified: https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md].
  - Library voices can be used without saving them to My Voices; using one records the notice period for the account [verified: same page].
  - `GET /v1/voices/{id}` returns `disable_at_unix` while a notice is active; otherwise the key is absent or `null` [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period.md].
  - ElevenLabs may also remove any shared voice "in our sole discretion" [verified: https://elevenlabs.io/vla].
  - **Consequence:** character cards that reference library voices can break. Subscribe to `voice_removal_notice` webhooks (§8) and keep a fallback voice per card.
- **Live Moderation.** Owners of shared PVCs can enable it. ElevenLabs then checks whether requests "contain text that belongs to a number of prohibited categories". Live moderation "may result in extra latency", and changes apply only to users who add the voice afterwards [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md; https://elevenlabs.io/vla].
  - The categories and the error returned on a block are undocumented.
  - **Catalog rule:** for narration of user-driven mature fiction, prefer **default voices and our own designed voices** over library PVCs with live moderation. Or record each voice's moderation flag and exclude moderated voices from mature-rated adventures.
- Some library voices have a **character multiplier**, meaning higher cost (§2.4).

### 6.6 What moderation ElevenLabs applies to TTS text

| Layer | What is documented |
|---|---|
| Standard TTS (default, designed and cloned voices) | **No synchronous text moderation and no blocking error code are documented.** The errors reference lists no moderation code [verified: https://elevenlabs.io/docs/eleven-api/resources/errors.md]. The safety page describes "AI classifiers, human reviewers, and internal investigations" applied to the platform [verified: https://elevenlabs.io/safety]. **Inference:** monitoring is mostly asynchronous, with enforcement at account level. |
| Library PVCs with Live Moderation | Text is screened per request. The blocking behaviour is undocumented [verified: VLA and the help article above]. |
| Voice cloning | No-go voice detection, and CAPTCHA verification for PVC |
| ElevenAgents | Configurable content guardrails (sexual, violence, harassment, self-harm…) and custom guardrails [verified: https://elevenlabs.io/docs/changelog/2026/2/16.md; https://elevenlabs.io/docs/changelog/2026/2/9.md]. **Not available for plain TTS.** |
| Enforcement | "removing content, restricting, suspending, or terminating access"; appeals through support [verified: https://elevenlabs.io/use-policy]. ZRM can be withdrawn from accounts flagged for moderation [verified: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md]. |

One third-party guide claims policy rejections return **HTTP 422** with the reason in `detail` [secondary: https://theneuralbase.com/elevenlabs/learn/intermediate/ethical-guidelines/]. This is unconfirmed.

**Adapter rule:** any 4xx outside the documented validation, auth and not-found codes should be:
- mapped to the existing `content_blocked` or `invalid` category;
- logged with `request_id`;
- **never retried**;
- **refunded** to the user;
- surfaced to admins.

### 6.7 AI disclosure and provenance

- The PUP requires disclosure "where required by law" or where silence "would materially mislead". It forbids removing ElevenLabs "watermarks, metadata, or provenance signals" [verified: https://elevenlabs.io/use-policy].
- ElevenLabs supports C2PA and offers an AI Speech Classifier [verified: https://elevenlabs.io/safety].
- **Actions:**
  - Keep the "AI voice" labelling in the narration UI and the call screen.
  - Store provider bytes unmodified. Today MP3s are stored as-is.
  - If we ever re-encode (for example to Opus for calls), check whether that drops metadata, and document it [unverified whether ElevenLabs embeds C2PA metadata in API output].

### 6.8 Terms that bind us as the account holder

[verified: https://elevenlabs.io/terms-of-use]
- We must hold the rights in our input and output, and we indemnify ElevenLabs.
- We must review output before distribution.
- No PHI without a BAA.
- ElevenLabs may suspend content or access that is "reasonably likely, in our sole determination, to violate".
- Services are "as is" and "as available".
- Liability is capped at the greater of $100 or the fees paid in the last 12 months.
- Unused prepaid credits are forfeited on termination.

### 6.9 OEM Terms: does a consumer roleplay app "Make Available" the Services?

[verified: https://elevenlabs.io/oem-terms]
- The OEM Terms govern a customer that will "bundle, make available and sublicense ('Make Available')" Services to its **End Users**.
- An End User is a "customer that… is licensing or using the Customer Solution only for its own internal business operations". "Business Entities" "expressly exclude individual users acting in their personal capacity".
- "if you are a Customer accessing the Services under a Free, Starter, Creator, or Pro tier plan, you are expressly prohibited from Making Available the Services or any Bundled Service."
- OEM customers must:
  - flow ElevenLabs' restrictions down to end users;
  - name ElevenLabs as a third-party beneficiary;
  - provide first-line support;
  - accept audits.

**Reading.** The OEM framework is written for **B2B resale**. A B2C app where ElevenLabs only renders narration for our own product is *probably* ordinary commercial use under the ToS for paid users [unverified: legal interpretation]. Two things push toward Scale or above anyway:
- the explicit tier prohibition;
- the "resellers or third-party apps" wording in the PUP.

**Get written confirmation from ElevenLabs sales before launch** (§12).

### 6.10 Policy guardrails for narrating user-driven stories

See §11.6 for the actionable list.

---

## 7. SDKs, and SDK vs raw httpx/websockets

### 7.1 Official packages (checked today)

| Package | Latest | Published | Purpose |
|---|---|---|---|
| `elevenlabs` (PyPI) | **2.71.0** (pre-release **3.0.0a1** from 2026-09-08) | 2026-10-05 | Python REST + helpers. Requires `httpx>=0.21.2`, `pydantic>=1.9.2`, `pydantic-core>=2.18.2`, `requests>=2.20`, `websockets>=13.0`, `typing_extensions`; Python ≥3.8 [verified: https://pypi.org/pypi/elevenlabs/json] |
| `@elevenlabs/elevenlabs-js` (npm) | 2.71.0 (alpha tag `3.0.0-alpha.1`) | 2026-10-05 | **Node.js** REST SDK (`ws`, `node-fetch`). Not for browsers [verified: https://registry.npmjs.org/@elevenlabs/elevenlabs-js; README] |
| `@elevenlabs/client` (npm) | 1.27.0 | 2026-10-06 | Browser SDK for ElevenAgents conversations (LiveKit/WebRTC) [verified: https://registry.npmjs.org/@elevenlabs/client] |
| `@elevenlabs/react` (npm) | 1.17.0 | 2026-10-06 | React hooks on top of `@elevenlabs/client` [verified: https://registry.npmjs.org/@elevenlabs/react] |

The docs also list React Native, Swift, Kotlin and Flutter libraries for agents, plus a CLI [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries.md].

### 7.2 Python SDK facts that matter

All read in the 2.71.0 wheel source unless marked otherwise.

| Topic | Fact |
|---|---|
| Generation | Fern-generated from the OpenAPI spec. Regenerated almost weekly: v2.58 (2026-07-13) to v2.71 (2026-10-05) [verified: https://github.com/elevenlabs/elevenlabs-python/releases] |
| Clients | `ElevenLabs` (sync, `httpx.Client`) and `AsyncElevenLabs` (`httpx.AsyncClient`). A custom `httpx_client` can be injected [verified: `base_client.py:68-113,410-455`] |
| Default timeout | **240 s**, unless you pass your own `httpx_client` [verified: `base_client.py:68-69,101-103`] |
| Retries | **`max_retries=2` by default**, on **408, 409, 429 and any 5xx**. Exponential backoff from 1 s up to 60 s with jitter. It honours `retry-after-ms`, `retry-after` and `x-ratelimit-reset` [verified: `core/http_client.py:21-22,99-123,379,642`] |
| Per-call options | `request_options={"max_retries", "timeout_in_seconds", "additional_headers", "additional_body_parameters", "additional_query_parameters", "chunk_size"}` [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries.md; SDK `raw_client.py`] |
| Streaming | `text_to_speech.stream()` and `stream_with_timestamps()` return iterators of audio chunks. `with_raw_response` exposes headers such as `character-cost` [verified: README; https://elevenlabs.io/docs/api-reference/introduction.md] |
| TTS WebSocket | Only `RealtimeTextToSpeechClient.convert_realtime()`, which is **synchronous**, built on `websockets.sync.client` [verified: `realtime_tts.py:1-60`]. **No async TTS stream-input, multi-stream-input or Text to Dialogue WebSocket client in 2.71.0.** The message types exist under `v_1_text_to_speech_voice_id_*_stream_input/types`. Async WebSocket helpers exist only for **Scribe realtime** (`realtime/scribe.py`), agents and Speech Engine. 3.0.0a1 adds "generated websocket clients" [verified: https://github.com/elevenlabs/elevenlabs-python/releases] |
| Environments | `PRODUCTION` (`api.elevenlabs.io`), `PRODUCTION_US`, `PRODUCTION_EU`, `PRODUCTION_INDIA`, `PRODUCTION_SINGAPORE` [verified: `environment.py`] |
| Response models | Pydantic with `extra="allow"`, frozen [verified: e.g. `types/subscription.py`]. Lenient, not strict. |
| Webhooks | `client.webhooks.construct_event(rawBody, sig_header, secret)`. It parses `t=…,v0=…`, rejects timestamps older than **30 min**, and computes `v0=` + HMAC-SHA256(secret, `"{t}.{rawBody}"`). It compares with `!=`, which is **not constant-time** [verified: `webhooks_custom.py:36-70`] |
| Speech Engine | Async-only server helper. It verifies the `X-Elevenlabs-Speech-Engine-Authorization` header [verified: README] |

### 7.3 JS/TS SDK facts

- Retries: default 2, on 408, 409, 429 and 5xx. **Timeout: default 60 s** (`timeoutInSeconds`).
- Runtimes: Node 15+, Deno, Bun, Vercel, Cloudflare Workers.
- The README says browser apps should use `@elevenlabs/client` [verified: https://github.com/elevenlabs/elevenlabs-js README].
- `additionalBodyParameters` needs v2.59.0 or later [verified: https://elevenlabs.io/docs/eleven-api/resources/libraries.md].

**Frontend impact:** none. The SPA only talks to the BFF. `@elevenlabs/client` and `@elevenlabs/react` are relevant only if we adopt ElevenAgents or Speech Engine with browser WebRTC (§10.4).

### 7.4 Recommendation: raw adapters for hot paths, SDK optional for admin

| Criterion | Python SDK | Raw `httpx` + `websockets` (current pattern) |
|---|---|---|
| Fits the existing adapter contract (`TtsProviderCompletion`, error categories, strict validation) [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:125-215,217-412] | Needs wrapping anyway | Native |
| Async WebSocket for calls (TTS WS / Text to Dialogue WS) | **Missing in 2.71.0.** The sync helper would block the event loop. 3.x is alpha. | `websockets>=16,<17` is already a dependency [code: /home/andres/PycharmProjects/magic-worlds-api/requirements.txt:27] |
| Timeouts and retries | 240 s timeout and 2 blind retries on 429/409/5xx by default. That conflicts with budget-aware retries and holds semaphores longer. Can be overridden per call. | Fully under our control. Reuse `TTS_TIMEOUT_SECONDS` and `TTS_PROVIDER_MAX_ATTEMPTS` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:28,36-37] |
| Contract strictness | `extra="allow"`, so it tolerates drift silently | Strict on the fields we need. Per ElevenLabs' breaking-change policy, **ignore unknown fields** rather than failing on them [verified: https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy.md] |
| Dependency weight and churn | Pulls in `requests` and the whole generated surface; weekly releases | Already present: `httpx>=0.27.0`, `pydantic==2.11.7` [code: /home/andres/PycharmProjects/magic-worlds-api/requirements.txt:16,38] |
| Multipart admin ops (IVC upload, voice design, shared-voice add, pronunciation dictionaries) | Convenient and typed | More boilerplate |
| Webhook verification | Helper exists, but its comparison is not constant-time | About 15 lines with `hmac.compare_digest` |

**Decision.**
1. Build **`elevenlabs_adapter.py` (narration HTTP), `streaming_tts_elevenlabs.py` (call WebSocket) and `elevenlabs_stt.py` (Scribe)** on raw `httpx.AsyncClient` and `websockets`.
   - Validate the fields we rely on strictly: content type `audio/mpeg`, a non-empty body, size within `TTS_MAX_OUTPUT_BYTES`, and the `request-id` and `character-cost` headers.
   - Parse `detail.code` and fall back to `detail.status`.
   - Ignore unknown fields.
   - Keep the provider-neutral `TtsProviderCompletion` contract.
2. For the **root admin voice console and catalog sync** (low volume), using the SDK is acceptable **only if** it is:
   - pinned to an exact version (e.g. `elevenlabs==2.71.0`);
   - built as `AsyncElevenLabs(httpx_client=<our client with explicit timeouts>)`;
   - called with `request_options={"max_retries": 0}`;
   - wrapped by our error mapper.

   Otherwise use raw httpx there too, for one style across the codebase. Raw httpx is the default recommendation, with the SDK source used as the **reference implementation and contract-test oracle**.
3. Implement webhook verification ourselves with `hmac.compare_digest` and a 5–30 minute tolerance.
4. Re-evaluate SDK 3.x once it is stable and ships generated async WebSocket clients.

---

## 8. Webhooks

[verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks.md unless marked]

| Aspect | Detail |
|---|---|
| Events that matter to us | `voice_removal_notice`, `voice_removal_notice_withdrawn`, `voice_removed` (shared library voices: **the catalog**); `speech_to_text_transcription` for batch STT with `webhook=true` and optional `webhook_metadata` [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks.md] |
| Other events | `post_call_transcription`, `post_call_audio`, `call_initiation_failure` (ElevenAgents). Usage types include Flows and Agent QA [verified: https://elevenlabs.io/docs/changelog/2026/6/8.md; https://elevenlabs.io/docs/changelog/2026/7/27.md] |
| Configuration | Workspace webhooks are configured in settings or by API (`POST /v1/workspace/webhooks`, `PATCH /v1/workspace/webhooks/{webhook_id}`, delete; added 2025-11 [verified: https://elevenlabs.io/docs/changelog/2025/11/27.md; https://elevenlabs.io/docs/api-reference/webhooks/create.md]). Only workspace admins can do this. The auth method is HMAC (or OAuth for STT webhooks). |
| **Event subscription** (*added during verification*) | A workspace webhook only receives the workspace events it is subscribed to. The update endpoint's `events` list takes `voice_library_removal_notice`, `speech_to_text`, `agent_qa`, `flows` (added 2026-07-20). **Subscribe the catalog webhook to `voice_library_removal_notice`** [verified: https://elevenlabs.io/docs/api-reference/webhooks/update.md; https://elevenlabs.io/docs/changelog/2026/7/20.md] |
| Signature header | `ElevenLabs-Signature` (read in lowercase as `elevenlabs-signature`) |
| Scheme | `t=<unix seconds>,v0=<hex>`, where `v0 = HMAC_SHA256(secret, f"{t}.{raw_body}")`. The SDK tolerance is 30 min [verified: SDK `webhooks_custom.py:39-70`]. **Verify against the raw body bytes before any JSON parsing.** |
| Retries | **Off by default** (`retry_enabled` [verified: https://elevenlabs.io/docs/changelog/2026/2/23.md]). *Corrected during verification:* when enabled, delivery is attempted **up to 5 times in total**: immediately, then after 30 s, 2 min, 8 min and 30 min, with up to 10% added jitter. Retried on 5xx, 429, 408, connection errors and timeouts; other 4xx are not retried. Up to 100 pending retries per webhook. Payloads are identical, so **deduplicate** on `event_timestamp` plus IDs. **The docs state retry support only for ElevenAgents post-call events** (`post_call_transcription`, `post_call_audio`, `call_initiation_failure`), so treat `voice_removal_*` delivery as **best effort** [verified: https://elevenlabs.io/docs/eleven-api/resources/webhooks.md]. |
| Auto-disable | After ≥10 consecutive failures, if there has been no success in the last 7 days. Admins get an email, and the webhook must be re-enabled manually. |
| Source IPs | Static egress IPs for allowlisting. US: `34.67.146.145`, `34.59.11.47`. EU: `35.204.38.71`, `34.147.113.54`. Asia: `35.185.187.110`, `35.247.157.189`. Residency environments have their own [verified: https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting.md] |

**Use for magic-worlds:** add one BFF endpoint, `POST /webhooks/elevenlabs`, with these properties:
- it is public, verifies the HMAC signature, and optionally allowlists the egress IPs;
- it handles `voice_removal_*` events by:
  1. marking the voice `deprecated_at` / `disable_at` in our catalog table;
  2. notifying the root admin;
  3. auto-migrating affected character cards and adventure narrator voices to a fallback voice before `disable_at_unix`.
- *Added during verification:* because voice-removal webhooks may not be retried, and a voice without a notice period disappears immediately (§6.5), add a **daily catalog sync backstop**. It calls `GET /v1/voices/{id}` for every library voice in use, records `disable_at_unix`, and treats `404 voice_not_found` or `403 voice_access_denied` as "removed".

TTS itself has no completion webhook. It is synchronous or streaming, so narration jobs keep the current in-process completion flow.

---

## 9. Reliability: status, SLAs, regions, timeouts and retries

### 9.1 Status page and recent incidents

Status page: https://status.elevenlabs.io. Its components are:
- **ElevenAPI**: Text to Speech, Speech to Text, Other;
- **ElevenAgents**: 7 components;
- **ElevenCreative**.

No uptime percentages are shown [verified: https://status.elevenlabs.io].

Incidents touching our paths, July to October 2026 [verified: https://status.elevenlabs.io/history]:

| Date (2026) | Incident |
|---|---|
| Aug 3 | Elevated error rates on TTS and STT APIs (an upstream provider issue) |
| Aug 26 | Elevated latency on TTS and STT requests; RCA to follow |
| Sep 4 | STT latency in global and EU residency |
| Sep 28 | STT latency |
| Sep 29 | Agents, STT and Creative: latency, conversation failures, STT failures |
| Oct 6 | "increase in latency" (component unspecified) |
| Plus | Several agents, SIP, Dubbing and Music incidents |

**Takeaway:** expect a TTS or STT degradation roughly every 2–4 weeks, usually latency rather than a hard outage. Narration should degrade gracefully (fail, refund, retry button). Calls need a fast first-audio timeout and a spoken or visual "voice unavailable" fallback.

### 9.2 SLAs

- **Self-serve: none.** "as is" and "as available", with no warranty of uninterrupted access [verified: https://elevenlabs.io/terms-of-use].
- **Enterprise:** "Custom service-level agreements are available for mission-critical workloads" [verified: https://elevenlabs.io/enterprise]; "dedicated support, SLAs, custom rate limits" [verified: https://elevenlabs.io/pricing/api].

### 9.3 Regions and failover

- Global routing (US, Netherlands, Singapore) is automatic on `api.elevenlabs.io` [verified: https://elevenlabs.io/docs/changelog/2026/2/9.md].
- **No documented customer-controlled failover.**
  - Pinning `api.us.elevenlabs.io` is the only alternative endpoint in the same workspace.
  - Residency environments are separate workspaces with separate keys and voices [verified: https://elevenlabs.io/docs/overview/administration/data-residency.md], so they cannot serve as hot standby without duplicating the voice catalog.
- **Practical failover option:** configure `ELEVENLABS_BASE_URL` (default `https://api.elevenlabs.io`) with an ops switch to `https://api.us.elevenlabs.io`, to use when a regional degradation hits the auto-routed region [unverified effectiveness].
- Typical Flash WebSocket time to first byte [verified: https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md]:
  - North America, Europe and South-East Asia: 100–150 ms;
  - South Asia and North-East Asia: 150–200 ms.
- PVC voices are slower than default, designed and IVC voices [verified: same page]. That matters for call voices.

### 9.4 Change management and deprecations

- **Breaking changes** are defined as removing fields, adding required parameters, or changing types. Adding fields is not breaking: "Clients should ignore fields they don't recognize and avoid strict typing checks on responses". No notice period is defined, and the changelog is weekly [verified: https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy.md].
- **Recent removals:**
  - `eleven_monolingual_v1`, `eleven_multilingual_v1` and `scribe_v1` were scheduled for removal on **2026-07-09**, about one month after the 2026-06-08 notice [verified: https://elevenlabs.io/docs/changelog/2026/6/8.md]. The current models overview no longer lists the v1 TTS models, and lists `scribe_v1` as deprecated. The character-limit table still shows `eleven_multilingual_v1`, so the docs lag [verified: https://elevenlabs.io/docs/overview/models.md].
  - *Added during verification:* `GET /v1/models` deprecated `max_characters_request_free_user` and `max_characters_request_subscribed_user` on 2026-09-28 ("not enforced"). Use **`maximum_text_length_per_request`** in the startup model check and for per-model segment caps [verified: https://elevenlabs.io/docs/changelog/2026/9/28.md].
  - *Added during verification:* `use_pvc_as_ivc` on the TTS endpoints is **no longer deprecated**, and Text to Dialogue gained it too (2026-09-28) [verified: same changelog].
  - Turbo v2/v2.5 are deprecated in favour of Flash [verified: https://elevenlabs.io/docs/overview/models.md].
  - `optimize_streaming_latency` is deprecated [verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md].
  - `GET /v1/usage/character-stats` was deprecated in favour of `POST /v1/workspace/analytics/query/usage-by-product-over-time` [verified: https://elevenlabs.io/docs/changelog/2026/4/20.md].
  - `POST /v1/text-to-voice/create-previews` was deprecated in favour of "Design a voice" [verified: https://elevenlabs.io/docs/changelog/2026/5/13.md]. This affects the admin Voice Design port.
- **Process:**
  - Keep `model_id` configurable per path (narration, call, preview, admin) and never hard-coded.
  - Add a weekly ops check of the changelog.
  - Add a startup check that `GET /v1/models` still lists the configured models.
  - Allow about 4 weeks of lead time for model removals.

### 9.5 Recommended timeouts, retries and circuit breaker

Current values for reference:
- narration provider timeout 60 s and max 2 attempts, with a **10–50 ms** retry backoff [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:28,36-37] [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:17,24-25];
- calls: 15 s to first audio, 10 s between frames (baseline review §2, Path B);
- STT timeout 30 s [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:37].

| Path | Connect | First byte / first audio | Total / idle | Max attempts | Notes |
|---|---|---|---|---|---|
| Narration HTTP (≤3,000 chars [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155]) | 5 s | 15 s | 45 s (Flash) / 60 s (v2, v3, v4) | 2, and **only** if no bytes were received | The second attempt only for retryable classes below. Never after a read timeout once the body has started (double-charge risk). |
| Voice preview (≤400 chars) | 3 s | 8 s | 15 s | 1 | Retrying a preview costs money and adds little value. |
| Call TTS WebSocket | 3 s | **3 s** for the first audio of a sentence | 5 s between chunks; set `inactivity_timeout` to the call idle window (≤180 s) or send keep-alives | 1 per sentence | On failure, skip the sentence, send a "voice degraded" event, and keep the transcript. Prewarm the socket at call start. |
| STT batch (Scribe v2) per segment | 3 s | n/a | 10 s for segments ≤30 s [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:32] | 2 | Idempotent at our side by segment ID. Fixes baseline issue 18. |
| Admin (IVC upload, voice design, list) | 5 s | n/a | 120 s | 1 | Never auto-retry creates, because they consume voice slots. |
| Catalog sync (`GET /v1/voices`, `/v1/shared-voices`, `/v1/models`) | 5 s | n/a | 20 s | 3 | Read-only, so safe to retry. |

**Retry classes:**

| Class | Codes | Action |
|---|---|---|
| Back-pressure | 429 `concurrent_limit_exceeded` / `too_many_concurrent_requests` | Re-queue behind the local limiter. Not counted as an attempt. Optional 250–500 ms jittered wait. |
| Transient | 429 `system_busy`, 503 `service_unavailable` / `maintenance`, 500, 502, 504, connect errors, errors before any response byte | Exponential backoff of 0.5 s then 1.5 s (±20% jitter), honouring `Retry-After` / `retry-after-ms` capped at 5 s for narration. **Calls: no retry**, fail the sentence. |
| Rate | 429 `rate_limit_exceeded` | Backoff from 1 s, and shrink the pool by one for 60 s. |
| Budget | 402 `insufficient_credits`; a key's `character_limit` reached (the code is undocumented; expect 401/402/403 [unverified]) | **No retry.** Open the billing breaker, page ops, refund the user. |
| Config / auth | 401 `invalid_api_key`, 403 `insufficient_permissions`, `voice_access_denied`, `model_access_denied`, IP denied | **No retry.** Open the config breaker and alert. A leaked key auto-disabled by GitHub scanning shows up here. |
| Request | 400 / 422 validation, `text_too_long`, `invalid_voice_id`, 404 `voice_not_found` | **No retry.** Mark the voice invalid in the catalog if 404. |

**Circuit breaker:**
- Reuse the shape of the AuthAdapter breaker (threshold, window, cooldown read from env [code: /home/andres/PycharmProjects/magic-worlds-api/src/main.py:711-719,820-844]).
- Keep **one breaker per path** (narration, call TTS, STT, admin).
- Open after 5 transient failures in 30 s. Cool down for 30 s, then allow one half-open probe.
- **While open:**
  - narration jobs fail fast as `unavailable` and are refunded;
  - auto-narrate pauses;
  - new calls are refused with "Voice is temporarily unavailable";
  - calls already in progress fall back to text-only.

---

## 10. Cost comparison: MiniMax vs ElevenLabs

### 10.1 Unit prices used

| Provider / model | $ per 1K chars | Source |
|---|---|---|
| MiniMax speech-2.8-turbo (current) | **0.060** | [verified: https://platform.minimax.io/docs/pricing/overview], pay-as-you-go T2A sync and async. Same on OpenRouter [secondary: https://openrouter.ai/minimax/speech-2.8-turbo] |
| MiniMax speech-2.8-hd | 0.100 | same |
| ElevenLabs Flash v2.5 | **0.040** | [verified: https://elevenlabs.io/pricing/api] |
| ElevenLabs v3 Conversational | 0.040 | same |
| ElevenLabs v4 Turbo (Text to Dialogue WS only) | 0.040 list / 0.011 promo (runs until 2026-10-12) | same |
| ElevenLabs Multilingual v2 | 0.080 | same |
| ElevenLabs v3 | 0.080 | same |
| ElevenLabs v4 (Text to Dialogue API) | 0.080 list / 0.022 promo | same |

| STT | $ per hour | $ per minute | Source |
|---|---|---|---|
| Groq whisper-large-v3 (current) | 0.111, with a **10 s minimum per request** | 0.00185 | [secondary: https://groq.com/pricing via search; the page fetch did not return pricing] |
| ElevenLabs Scribe v2 (batch) | 0.22 | 0.00367 | [verified: https://elevenlabs.io/pricing/api] |
| ElevenLabs Scribe v2 Realtime | 0.39 | 0.0065 | same |
| MiniMax ASR (reference) | 0.38 | 0.0063 | [verified: https://platform.minimax.io/docs/pricing/overview] |

MiniMax also sells audio subscriptions (Starter $5 to Business $999, with "audio points" and RPM caps of 10–800). The conversion from points to characters is not published [verified: https://platform.minimax.io/docs/pricing/overview]. **We do not know which MiniMax plan or rate we actually pay** (see §12).

### 10.2 Workload A: chat narration

Assumptions:
- Billed characters are the spoken text sent. ElevenLabs bills characters including spaces and punctuation [unverified]. v3/v4 audio tags such as `[whispers]` probably count as characters [unverified].
- `previous_text` / `next_text` context is **not** billed [unverified: confirm with a `character-cost` header test].
- 600, 1,000 or 1,500 characters per narrated turn, summed over all segments: narrator, characters and thoughts.

| Model | 600 chars | 1,000 chars | 1,500 chars | Per 10,000 turns at 1,000 chars | vs MiniMax turbo |
|---|---|---|---|---|---|
| MiniMax speech-2.8-turbo (today) | $0.036 | $0.060 | $0.090 | **$600** | baseline |
| MiniMax speech-2.8-hd | $0.060 | $0.100 | $0.150 | $1,000 | +67% |
| **ElevenLabs Flash v2.5** | $0.024 | $0.040 | $0.060 | **$400** | **−33%** |
| ElevenLabs v4 Turbo (list) | $0.024 | $0.040 | $0.060 | $400 | −33% (realtime WS only; a poor fit for batch narration) |
| ElevenLabs Multilingual v2 | $0.048 | $0.080 | $0.120 | $800 | +33% |
| ElevenLabs v3 | $0.048 | $0.080 | $0.120 | $800 | +33% (5,000-char limit per request) |
| ElevenLabs v4 (list) | $0.048 | $0.080 | $0.120 | $800 | +33% |
| ElevenLabs v4 (promo, expired) | $0.013 | $0.022 | $0.033 | $220 | −63% (do not plan on it) |

**Reading.** Moving narration to **Flash v2.5 saves about a third**. Moving it to the **expressive models (v3 or v4) costs about a third more** than today. A sensible split:
- Flash for auto-narrate, the default;
- v3 or v4 as a premium "expressive narration" option, charged more app credits.

Worst case today:
- A turn can have up to 32 segments of up to 3,000 characters each (baseline review §2, Path A) [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155].
- That is up to 96,000 characters, or **$3.84 on Flash and $7.68 on v3 or v4 per turn**, and only one app credit is reserved.
- **Character-based metering and a per-turn character cap are required** (§11.5).

### 10.3 Workload B: realtime voice calls

Assumptions:
- Assistant speech at about 150 words/min, which is about **900 chars per minute of assistant audio**.
- A "call minute" is split 50/50: 30 s of assistant speech (450 chars TTS) and 30 s of user speech (0.5 min STT).
- LLM cost is excluded.
- Groq's 10 s minimum per request inflates its cost for short VAD segments. The table uses the nominal rate.

| Pipeline | TTS per minute of assistant speech | Per call-minute (50/50) | Per 10-min call (max call length, 600 s [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:28]) | Daily cap per user (10 min [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:27]) |
|---|---|---|---|---|
| **Today:** MiniMax turbo + Groq whisper-v3 | $0.054 | $0.0279 | $0.28 | $0.28 |
| ElevenLabs Flash v2.5 + Groq (keep Groq) | $0.036 | $0.0189 | $0.19 | $0.19 |
| ElevenLabs Flash v2.5 + Scribe v2 batch | $0.036 | $0.0198 | $0.20 | $0.20 |
| ElevenLabs Flash v2.5 + Scribe v2 Realtime | $0.036 | $0.0213 | $0.21 | $0.21 |
| ElevenLabs v4 Turbo (list, TTD WS) + Scribe Realtime | $0.036 | $0.0213 | $0.21 | $0.21 |
| ElevenLabs Multilingual v2 + Scribe batch | $0.072 | $0.0378 | $0.38 | $0.38 |
| **ElevenLabs Speech Engine** (STT + TTS + turn-taking; we provide the LLM) | n/a | **$0.08** (+$0.16 burst) | $0.80 | $0.80 |

**Reading.**
- Flash v2.5 or v4 Turbo for TTS cuts call TTS cost by about a third.
- Moving STT from Groq to Scribe adds about $0.001–0.003 per call-minute. It buys one vendor and Scribe Realtime's ~150 ms latency [verified: https://elevenlabs.io/docs/overview/models.md], at the price of more vendor concentration.
- **Speech Engine is about 4× the DIY cost.** It is only worth it if its turn-taking and interruption handling replace a lot of our own code (VAD worklet, segment upload, `SentenceBuffer`, barge-in). Covered in the calls-focused research note.

### 10.4 Monthly volume to plan fit (self-serve, list prices)

Because included usage equals the plan fee at list rates (§2.2):

| Plan | Included Flash chars | Included v2/v3/v4 chars | ≈ narrated turns at 1,000 chars (Flash) | ≈ call-minutes (Flash + Scribe RT) | TTS concurrency (non-Flash / Flash) | Text to Dialogue sessions |
|---|---|---|---|---|---|---|
| Pro, $99 | 2.475M | 1.238M | 2,475 | ~4,650 | 10 / 20 | 70 |
| Scale, $299 | 7.475M | 3.738M | 7,475 | ~14,000 | 15 / 30 | 105 |
| Business, $990 | 24.75M | 12.375M | 24,750 | ~46,500 | 15 / 30 (pricing page says 25) | 105 |

Usage above the plan is drawn from the PAYG balance (§2.2). Choose the plan on concurrency, seats and the OEM question, then fund overage through PAYG with auto top-up and alerts.

### 10.5 Mapping to app credits

- **Calls:** the app bills 1 credit per 10 s of STT ms plus TTS ms [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:59].

  | 10 s of audio | Provider cost |
  |---|---|
  | Assistant TTS on Flash (≈150 chars) | **$0.006** |
  | Assistant TTS on v2/v3/v4 | $0.012 |
  | User audio on Scribe Realtime | $0.0011 |

  An app credit for calls must therefore be worth **at least about $0.012 plus margin** if expressive voices are allowed in calls.
- **Narration:** the app bills 1 credit per `tts_generation` request [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:923,931,939]. Move to **credits per 1,000 characters, weighted by the model multiplier** (Flash = 1×, v2/v3/v4 = 2×). Reserve before every segment, and refund on provider failure (fixes baseline issues 5 and 7).

### 10.6 Uncertainty

| Item | Risk |
|---|---|
| ElevenLabs list prices | **Medium.** Prices moved around the v4 launch, and older sources show $0.05/$0.10. Re-check before purchase, and budget with +25%. |
| v4 / v4 Turbo after the promotion | **Medium.** The page shows $0.08/$0.04 struck through. The post-promo price is assumed equal to that list price. |
| Billing of audio tags and context text | **Unknown.** Measure with the `character-cost` header in staging. |
| Library-voice character multipliers | **Unknown per voice.** |
| What MiniMax actually costs us | **Unknown.** The plan or contract may differ from list PAYG. |
| Groq minimum billing on short segments | Could be 2–5× the nominal STT cost for chatty users. Still small in absolute terms. |
| Speech Engine minute definition | Wall-clock vs active minutes is not confirmed [unverified]. |

---

## 11. Recommendations for magic-worlds

### 11.1 Target plan tier

| Phase | Plan | Why |
|---|---|---|
| Spike and staging integration | **Creator ($22)** or **Pro ($99)** on a *separate* staging account | Low cost. Pro unlocks 44.1 kHz PCM. One seat, so user keys only (scoped, with quota, IP-allowlisted, with expiry). No production traffic, because of the OEM tier clause. |
| **Production launch** | **Scale ($299/mo, or $2,990/yr)** | Multi-seat (3), which unlocks **service accounts**; the OEM-eligible tier; 15/30 TTS concurrency; 105 Text to Dialogue sessions; 60/45 STT; 660 voice slots for designed or cloned catalog voices; priority 5. Fund overage with PAYG and auto top-up, and enable 2FA to lift the $600/month PAYG cap. |
| Growth | **Business ($990)** when monthly API spend reaches about $700–990 | Same unit prices; 10 seats; 2,200 voice slots. Concurrency is the same as Scale per the models page, so **upgrading does not fix concurrency**. Confirm the "25" figure with sales. |
| Privacy or scale step | **Enterprise** once spend is roughly $2–3k/month, or when we need ZRM, EU residency, per-key concurrency, an SLA or volume pricing | ZRM is the only way to stop user fiction and voices from being retained. Request it with an explicit discussion of mature-fiction narration. |

Also apply for the **Startup Grant** (12 months, 33M characters, Scale-level benefits).

### 11.2 Key topology (service accounts, least privilege)

One **service account per environment** (`mw-prod`, `mw-staging`), each with these keys:

| Key (env var) | Used by | Permissions | `character_limit` (per billing period) | IP allowlist |
|---|---|---|---|---|
| `ELEVENLABS_KEY_NARRATION` | `tts_generation` narration jobs | `text_to_speech` | About 70% of the monthly budget | BFF egress IPs |
| `ELEVENLABS_KEY_CALLS` | voice orchestration TTS (+ STT if Scribe) | `text_to_speech`, `speech_to_text` (the permission enum has no separate Text to Dialogue scope; we assume `text_to_speech` covers it [unverified]) | About 30% of budget | BFF egress |
| `ELEVENLABS_KEY_PREVIEW` | `/voice-presets/preview` (user-facing) | `text_to_speech` | **Small hard cap**, e.g. 1–2% of budget | BFF egress |
| `ELEVENLABS_KEY_CATALOG` | voice and model catalog sync, voice picker | `voices_read`, `models_read` | 0 or minimal (reads are free [unverified]) | BFF egress |
| `ELEVENLABS_KEY_ADMIN_VOICES` | root admin console | `voices_read`, `voices_write`, `voice_generation`, `create_instant_voice_clone`, `add_voice_from_voice_library`, `text_to_speech`, `pronunciation_dictionaries_read/write` | Small cap | BFF egress |
| `ELEVENLABS_KEY_MEDIA` (only if theme songs or SFX move from fal.ai) | theme songs, SFX | `music_generation`, `sound_generation` | Separate cap | BFF egress |
| `ELEVENLABS_KEY_OPS` | usage reconciliation, history cleanup, webhook management | `user_read`, `workspace_analytics_full_read`, `speech_history_read`, `speech_history_write`, `webhooks_write` | 0 | BFF egress |

Rules:
- **Never use `permissions: "all"`.** Never put a key in the SPA, and never put one in a repository (`.env` stays untracked; leaked keys get auto-disabled).
- Keep `third_party_disable_allowed=true` (the default) so GitHub leak scanning can kill a key.
- **Rotate quarterly** and on any incident, with the create, deploy, delete procedure. Service-account keys never expire.
- **Share every catalog voice with the service account's group.** Add a startup self-check that `GET /v1/voices/{TTS_DEFAULT_VOICE_ID}` succeeds with the narration and calls keys.
- Replace the single `MINIMAX_AUDIO_API_KEY` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:8]. Extend the redaction patterns with `ELEVENLABS_KEY_*=…`, `xi-api-key:` and `sk_[A-Za-z0-9]+` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py:24-32].
- **Concurrency is shared across all keys.** Partitioning is our job (§11.4), except on Enterprise, where each key can get its own `tts_concurrency_limit`.

### 11.3 Logging, retention and data settings

1. **Training opt-out:** disable "Improve the models for everyone" in the production workspace's **Data use** settings, and record it in the runbook.
2. **Below Enterprise (no ZRM):**
   - A nightly job with the `OPS` key lists history (`speech_history_read`) and **deletes items older than N days** (suggested 1–7 days) with `DELETE /v1/history/{id}`.
   - Disclose the residual retention: "debugging and moderation logs" and 30-day backups.
   - Never send user IDs, emails or real names in TTS text. Speaker labels are already handled by our resolver.
3. **Enterprise:**
   - Send `enable_logging=false` on all TTS, Text to Dialogue and STT calls.
   - Drop `previous_request_ids` / `next_request_ids` stitching, and use `previous_text` / `next_text` instead.
   - Keep our own `request-id` log for support.
   - Leave ZRM off for admin cloning, which is not eligible anyway.
4. **Our side:** store `request-id`, `character-cost` (or `x-character-count`), `x-region`, model and voice on each `tts_job` and call turn, **never the text**. This matches the current hash-only design [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:108-159].
5. **Privacy notice and voice-call consent:**
   - name ElevenLabs as a processor with US storage;
   - bump `VOICE_CONSENT_VERSION` when STT or TTS moves [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:26];
   - obtain the end-user consents the OEM terms require.

### 11.4 Concurrency settings

Introduce one **workspace-wide provider limiter** (MySQL or Redis, shared by all workers) sized to the plan, with pools. Starting points:

| Setting | Meaning | Pro + Flash | Scale + Flash | Scale + v3/v4 for narration |
|---|---|---|---|---|
| `ELEVENLABS_TTS_CONCURRENCY` (new; total HTTP TTS in flight) | ≤ plan limit for the model family, minus headroom | 16 of 20 | 24 of 30 | 12 of 15 |
| `TTS_GLOBAL_CONCURRENCY` (existing narration pool; today per process [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:34-35]) | Narration share. **Make it cross-process.** | 8 | 12 | 6 |
| Preview pool (new) | | 2 | 3 | 2 |
| Admin pool (new) | | 1 | 2 | 1 |
| `VOICE_GLOBAL_CONCURRENCY` (existing; concurrent **calls**, DB-enforced [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/quota.py:241-248]) | Flash on the TTS WebSocket counts only while generating, so it is not the binding limit. Size from STT and a load test. | 16 | 24 | n/a |
| … if calls use **v4 Turbo on the Text to Dialogue WebSocket** | Each open socket holds a session for the whole call, and v4 Turbo allows one voice per socket. Use **one socket per call** with `keep_alive` (drop the private-socket-per-sentence pattern [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:491-494]). Over-limit opens are **rejected**, not queued (§1). Formula: `≤ 0.7 × sessions` | ≤ 48 (70 sessions) | ≤ 72 (105 sessions) | n/a |
| STT pool (new, if Scribe) | Batch: one per in-flight segment. Realtime: one per call. | ≤ 32 batch / ≤ 24 realtime | ≤ 48 / ≤ 36 | n/a |

**Then load-test** with the ElevenLabs Locust recipe (simulated users, a slow ramp, randomised 50–300 character sentences) before raising `VOICE_GLOBAL_CONCURRENCY` toward its maximum of 64 [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:38].

Also monitor `current-concurrent-requests` / `maximum-concurrent-requests` and the "TTD Websocket Sessions" analytics series [verified: https://elevenlabs.io/docs/overview/models.md].

### 11.5 Budget guards

1. **Provider-side hard caps:** set `character_limit` on every key (§11.2). These are the last line of defence against a runaway loop or a leaked key.
2. **PAYG:**
   - enable 2FA;
   - auto top-up with a modest amount and threshold (e.g. $50 at $25);
   - set the optional **monthly spend cap** in Top Up settings as a provider-side ceiling (off by default) [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md];
   - keep the payment method healthy, since **usage pauses immediately** at a zero balance.
3. **App-side metering by characters:**
   - reserve credits **per segment** before synthesis, from that segment's character count and model multiplier;
   - meter **previews** (fixes baseline issue 1);
   - refund on provider failure (fixes baseline issue 7);
   - add a per-turn character cap, e.g. 4,000 total;
   - check the reuse cache after quota, or charge 0 only for a confirmed cache hit (fixes baseline issue 5).
4. **Global spend circuit:**
   - sum the `character-cost` headers into a daily counter;
   - **soft alert** at 50% and 80% of the plan's daily run rate;
   - at 95%, **pause auto-narration** (manual play still allowed);
   - at 100% of the configured monthly budget, refuse new calls.
5. **Reconciliation:**
   - **daily:** `GET /v1/user/subscription` (`character_count`, `character_limit`, `next_character_count_reset_unix`, `current_overage`, `status`) [verified: SDK `types/subscription.py`] and `POST /v1/workspace/analytics/query/usage-by-product-over-time` [verified: https://elevenlabs.io/docs/changelog/2026/4/20.md];
   - **weekly:** compare with our ledger;
   - **alert** on drift above 5%.
6. **Rate limiter on user routes:** there is none in the API today (baseline issue 1). Add per-user token buckets on preview, narration and call start.

### 11.6 Policy guardrails (narration of user-driven stories)

1. **18+ product** (or 18+ gating of the voice features), stated in our ToS. No youth-directed marketing.
2. **Pre-TTS moderation of every narration segment and call sentence**, using our own classifier or LLM moderation:
   - **Hard-block** sexual content involving minors or "young-looking" characters, incest, bestiality, necrophilia, non-consent, self-harm encouragement, slurs and hate, real-person sexual or defamatory content, and real-politician impersonation.
   - **Soft policy for consensual adult content:** disable narration for NSFW-rated adventures **until ElevenLabs confirms in writing** that adult erotic text-to-audio is allowed for our account (§12). Alternatively, route such content to a different provider.
   - Gore: block "gratuitous" graphic descriptions; allow ordinary action and combat.
   - A blocked segment yields a `content_blocked` state in the UI (text stays visible), costs the user **0 credits**, and **never reaches ElevenLabs**.
3. **No real people:**
   - flag character cards whose name or description matches a public-figure list, and use a generic voice for them;
   - no user voice cloning until a consent and verification flow exists;
   - the admin clone form records consent artefacts.
4. **Catalog hygiene:**
   - prefer default voices and our own Voice Design voices;
   - *added during verification:* ElevenLabs warns that Voice Design voices "work with Eleven v4, but they may not be as performative or sound as good as with earlier models" [verified: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md]. If v4 is the expressive tier, audition designed voices on v4 before adding them to the catalog, and record per-voice model compatibility;
   - for library voices, store `disable_at_unix`, the notice-period length (import only voices that have one), the live-moderation flag and any cost multiplier;
   - subscribe to `voice_removal_*` webhooks and auto-migrate cards to fallback voices.
5. **AI disclosure:** label narration and calls as AI voices. Don't strip provenance metadata.
6. **Companion safeguards** (PUP: no "harmful emotional dependency"):
   - session-length nudges;
   - self-harm detection that switches off voice and shows resources;
   - no manipulative retention prompts in voice.
7. **Never test the moderation path against ElevenLabs** with prohibited content ("Attempting to violate… is itself a violation"). Use mocks.
8. **Account-level risk:** one abusive user can trigger enforcement against our *whole* workspace. Keep:
   - per-user abuse scoring;
   - the ability to disable voice per user;
   - an incident runbook for an ElevenLabs suspension (fallback to text-only).

### 11.7 Implementation choices (summary)

- Use raw `httpx` and `websockets` adapters for narration, calls, preview and STT, behind the existing provider-neutral contracts (§7.4). The SDK is optional and pinned, for admin only.
- Make `ELEVENLABS_BASE_URL` configurable (default `https://api.elevenlabs.io`, ops switch to `https://api.us.elevenlabs.io`). Allow a residency URL only together with a matching residency key.
- Put the timeouts, retry classes and per-path breakers from §9.5 into config, replacing MiniMax's 10–50 ms retries and its retrying of usage-limit codes (baseline issue 12).
- Add a startup health check: `GET /v1/models` contains the configured `model_id`s; the default voice is accessible with each key; the subscription status is active.
- Run a weekly changelog review, and allow about 4 weeks of lead time for model removals.

---

## 12. Open questions

1. **OEM status:** does a B2C roleplay app that plays ElevenLabs-generated narration and call audio to its own consumer users count as "Making Available" under the OEM Terms? If so, what end-user terms does ElevenLabs require? Ask sales and legal, in writing.
2. **Adult content:** is consensual adult (erotic) fiction narration allowed under the 2026-10-09 PUP for API customers? Does the answer depend on the voice (default, designed or library)? The PUP bans "visual depictions" and specific erotic categories, but does not address adult text-to-audio explicitly.
3. **Moderation signal:** what HTTP status and `detail.code` does a TTS request blocked by moderation (account-level or Live Moderation) return? Is there any asynchronous notification before enforcement?
4. **Business concurrency:** is it 25 (pricing page) or 15/30 (models page and help center)? Are v3, v4 and v4 Turbo counted in the "Multilingual v2" column for HTTP?
5. **Post-promo v4 pricing:** confirm v4 at $0.08/1K and v4 Turbo at $0.04/1K after 2026-10-12, and whether v4 can be reached through `/v1/text-to-speech` or only Text to Dialogue.
6. **Billing details:**
   - Are audio tags and `previous_text` / `next_text` billed?
   - Does a request cancelled mid-stream (barge-in) bill the full text or only the generated part? This matters for calls.
   - Measure with the `character-cost` header in staging.
7. **Key quota semantics:** with API billing in USD, is a key's `character_limit` measured in credits, characters or a USD equivalent? What error code is returned when it is reached?
8. **ZRM eligibility:** would ElevenLabs grant ZRM to a mature-fiction roleplay app, given that "high risk" use cases can be refused?
9. **Startup Grant eligibility** for magic-worlds: 33M characters for 12 months at Scale level.
10. **Our real MiniMax rate:** a pay-as-you-go or audio-subscription invoice is needed to make §10 exact.
11. **Trust-center artefacts:** SOC 2 Type II report date and ISO 27001 scope. compliance.elevenlabs.io could not be read without a browser.
12. **History retention:** does WebSocket TTS create history items? Is there an automatic retention period or bulk delete for API history?
13. **Speech Engine minutes:** wall-clock vs active minutes, and whether it supports ZRM and v4 Turbo. This decides whether its 4× cost could ever pay off for calls.

---

## 13. Sources

### Official ElevenLabs: pricing and billing
- https://elevenlabs.io/pricing
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/docs/overview/administration/billing.md
- https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md
- https://elevenlabs.io/docs/help-center/account/general/what-is-the-price-for-usage-based-billing.md
- https://elevenlabs.io/docs/help-center/account/general/what-are-credits.md
- https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-to-how-many-credits-i-can-use-at-once.md

### Official ElevenLabs: models, concurrency and errors
- https://elevenlabs.io/docs/overview/models.md
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md
- https://elevenlabs.io/docs/eleven-api/resources/errors.md
- https://elevenlabs.io/docs/help-center/technical/api-error-code-429.md
- https://elevenlabs.io/docs/help-center/technical/how-many-text-to-speech-requests-can-i-make-and-can-i-increase-it.md
- https://elevenlabs.io/docs/help-center/technical/can-i-reduce-api-latency.md
- https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md
- https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input.md
- https://elevenlabs.io/docs/api-reference/introduction.md
- https://elevenlabs.io/docs/overview/capabilities/speech-engine.md
- https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing.md
- https://elevenlabs.io/docs/eleven-api/resources/breaking-changes-policy.md

### Official ElevenLabs: keys, access, security, data
- https://elevenlabs.io/docs/api-reference/authentication.md
- https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md
- https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts.md
- https://elevenlabs.io/docs/api-reference/tokens/create.md
- https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security.md
- https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting.md
- https://elevenlabs.io/docs/overview/administration/data-residency.md
- https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md
- https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models.md
- https://elevenlabs.io/docs/help-center/website/can-i-access-the-files-i-generated-in-the-past.md
- https://elevenlabs.io/docs/eleven-agents/legal/hipaa.md
- https://elevenlabs.io/privacy-policy
- https://elevenlabs.io/dpa
- https://elevenlabs.io/enterprise
- https://compliance.elevenlabs.io (trust center; content not readable via fetch)

### Official ElevenLabs: policy and legal
- https://elevenlabs.io/use-policy
- https://elevenlabs.io/terms-of-use
- https://elevenlabs.io/oem-terms
- https://elevenlabs.io/safety
- https://elevenlabs.io/vla
- https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period
- https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning.md

### Official ElevenLabs: webhooks, SDKs, status, changelog
- https://elevenlabs.io/docs/eleven-api/resources/webhooks.md
- https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks.md
- https://elevenlabs.io/docs/eleven-api/resources/libraries.md
- https://pypi.org/pypi/elevenlabs/json (and the `elevenlabs-2.71.0-py3-none-any.whl` source: `base_client.py`, `core/http_client.py`, `environment.py`, `realtime_tts.py`, `realtime/scribe.py`, `webhooks_custom.py`, `text_to_speech/raw_client.py`, `types/permission_type.py`, `types/workspace_api_key_response_model.py`, `types/platform_limits.py`, `types/subscription.py`, `service_accounts/api_keys/types/*`)
- https://github.com/elevenlabs/elevenlabs-python (README and releases)
- https://github.com/elevenlabs/elevenlabs-js (README)
- https://registry.npmjs.org/@elevenlabs/elevenlabs-js
- https://registry.npmjs.org/@elevenlabs/client
- https://registry.npmjs.org/@elevenlabs/react
- https://status.elevenlabs.io
- https://status.elevenlabs.io/history
- https://elevenlabs.io/docs/llms.txt
- https://elevenlabs.io/docs/changelog/llms.txt
- Changelog entries:
  - https://elevenlabs.io/docs/changelog/2025/11/5.md
  - https://elevenlabs.io/docs/changelog/2025/11/21.md
  - https://elevenlabs.io/docs/changelog/2025/11/27.md
  - https://elevenlabs.io/docs/changelog/2026/1/26.md
  - https://elevenlabs.io/docs/changelog/2026/2/9.md
  - https://elevenlabs.io/docs/changelog/2026/2/16.md
  - https://elevenlabs.io/docs/changelog/2026/2/23.md
  - https://elevenlabs.io/docs/changelog/2026/4/20.md
  - https://elevenlabs.io/docs/changelog/2026/5/13.md
  - https://elevenlabs.io/docs/changelog/2026/6/1.md
  - https://elevenlabs.io/docs/changelog/2026/6/8.md
  - https://elevenlabs.io/docs/changelog/2026/6/15.md
  - https://elevenlabs.io/docs/changelog/2026/7/13.md
  - https://elevenlabs.io/docs/changelog/2026/7/20.md
  - https://elevenlabs.io/docs/changelog/2026/7/27.md
  - https://elevenlabs.io/docs/changelog/2026/9/14.md
  - https://elevenlabs.io/docs/changelog/2026/9/21.md
  - https://elevenlabs.io/docs/changelog/2026/9/28.md
  - https://elevenlabs.io/docs/changelog/2026/10/5.md

### MiniMax and Groq
- https://platform.minimax.io/docs/pricing/overview (official)
- https://openrouter.ai/minimax/speech-2.8-turbo (secondary)
- https://groq.com/pricing (secondary via search; the direct fetch returned no pricing table)

### Secondary (non-official)
- https://www.goodvibecode.com/text-to-speech/elevenlabs-api-pricing-explained
- https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/
- https://www.cartesia.ai/learn/elevenlabs-pricing
- https://trustlists.org/company/elevenlabs/
- https://deepgram.com/learn/elevenlabs-security-review-enterprise-guide
- https://elevenlabs.io/de/blog/speech-synthesis-20 (ElevenLabs marketing page, via search snippet)
- https://theneuralbase.com/elevenlabs/learn/intermediate/ethical-guidelines/
- https://www.aitoolcurator.com/learn/elevenlabs/voice-cloning/

### Codebase (read-only)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:20-60,150-175,250
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:94,108-159
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/minimax_adapter.py:8,17,24-25,125-215,217-412
- /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_credentials.py:8-17
- /home/andres/PycharmProjects/magic-worlds-api/src/services/minimax_voice_admin.py
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:23-39,96-99,184-216
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/quota.py:241-248
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:59,63,1570
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/streaming_tts_minimax.py:143,241-264,491-494
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155,1174-1221,1433
- /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:923,931,939
- /home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/errors.py:24-32
- /home/andres/PycharmProjects/magic-worlds-api/src/main.py:711-719,820-844
- /home/andres/PycharmProjects/magic-worlds-api/requirements.txt:2,16-17,27,38

---

## Verification log (2026-10-12)

An adversarial re-check against live official sources on 2026-10-12. Each claim below was re-read on the cited page today; doc pages were fetched as raw markdown (`*.md`) and pricing/legal pages as HTML. "Corrected" means the note was edited in place; "added" rows are facts the note missed.

| # | Claim | Status | Source |
|---|---|---|---|
| 1 | API usage is billed in USD, not credits; TTS per character, STT per audio minute | confirmed | https://elevenlabs.io/pricing/api |
| 2 | List prices per 1K chars: v4 $0.08, v4 Turbo $0.04, v3 $0.08, v3 Conversational $0.04, Multilingual v2 $0.08, Flash/Turbo $0.04 | confirmed | https://elevenlabs.io/pricing/api |
| 3 | v4 promo ($0.022 / $0.011) "72% off until Oct 12"; the note said it had already ended | corrected (still displayed on the research date; treat as expired) | https://elevenlabs.io/pricing/api |
| 4 | Plan-included v4 characters equal plan price / promo price (Starter 273,000; Pro 4,500,000) | added | https://elevenlabs.io/pricing/api |
| 5 | Included v2/v3 chars: Starter 75,000 … Business 12,375,000; Flash: Pro 2,475,000, Scale 7,475,000, Business 24,750,000 | confirmed | https://elevenlabs.io/pricing/api |
| 6 | Scribe v2 $0.22/h (+$0.05 keyterms, +$0.07 editing); Scribe v2 Realtime $0.39/h (+$0.08, +$0.12) | confirmed | https://elevenlabs.io/pricing/api |
| 7 | Speech Engine $0.08/min, burst $0.16/min; included minutes and concurrent calls 15/4 … 12,375/40 | confirmed | https://elevenlabs.io/pricing/api |
| 8 | SFX: "price per minute" in the table vs "billed per generation" in the FAQ | confirmed (conflict persists) | https://elevenlabs.io/pricing/api |
| 9 | Plan prices, annual = 10× monthly, credits 10k/30k/121k/600k/1.8M/6M | confirmed | https://elevenlabs.io/pricing |
| 10 | Starter first-month $1 promo | confirmed; added "Until Oct 18" | https://elevenlabs.io/pricing |
| 11 | Custom voice slots 3/10/30/160/660/2,200; PVC 0/0/1/1/3/10; seats Scale 3, Business 10 | confirmed | https://elevenlabs.io/pricing |
| 12 | Pricing-page concurrency 2/3/5/10/15/25 vs docs Business 15 | confirmed (conflict persists) | https://elevenlabs.io/pricing; https://elevenlabs.io/docs/overview/models.md |
| 13 | Rollover up to 2 months (balance max 3× quota); lost on downgrade or cancel | confirmed | https://elevenlabs.io/pricing; https://elevenlabs.io/docs/overview/administration/billing.md |
| 14 | Voice Library voices do not use custom voice slots; Free gets 3 slots for Voice Design only | confirmed | https://elevenlabs.io/docs/overview/administration/billing.md |
| 15 | Free plan: no attribution requirement on current pages | corrected (help center still requires attribution for audio generated outside a subscription) | https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-content-after-my-subscription-ends.md |
| 16 | PAYG: $5 minimum, 12-month expiry, auto top-up $20 at $10, pauses at $0, 2FA caps $100/$200/$600/$2,000, non-refundable, Free+PAYG gets Starter concurrency | confirmed | https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md |
| 17 | PAYG optional monthly spend cap, 250 top-ups/month, $5 minimum balance with Auto Top Up | added | https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md |
| 18 | Burst cap: twice the monthly quota | confirmed | https://elevenlabs.io/docs/help-center/account/general/is-there-a-limit-to-how-many-credits-i-can-use-at-once.md |
| 19 | Concurrency table (Free … Enterprise; Multilingual v2 / Flash / STT / Realtime STT / Music / Priority) and ~50 ms queueing | confirmed | https://elevenlabs.io/docs/overview/models.md |
| 20 | Text to Dialogue WS sessions 14/21/35/70/105/105; held for the connection; 20 s idle close without `keep_alive` | confirmed | https://elevenlabs.io/docs/overview/models.md |
| 21 | Requests over the limit are queued (stated generally) | corrected (TTD WebSocket opens over the session limit are rejected with `too_many_concurrent_requests`) | https://elevenlabs.io/docs/overview/models.md |
| 22 | v4 Turbo: one registered voice per TTD WebSocket; v4: up to 10 | added | https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd.md |
| 23 | `eleven_v4` via Text to Dialogue API, `eleven_v4_turbo` via Text to Dialogue WebSocket; v4 10,000-char limit; Flash v2.5 40,000; v3 5,000 | confirmed | https://elevenlabs.io/docs/overview/models.md; https://elevenlabs.io/docs/changelog/2026/9/28.md |
| 24 | Turbo v2/v2.5 deprecated in favour of Flash | confirmed | https://elevenlabs.io/docs/overview/models.md |
| 25 | v1 TTS models and `scribe_v1` removed 2026-07-09 | corrected wording (removal was scheduled for that date; the models page no longer lists the v1 TTS models; one table is stale) | https://elevenlabs.io/docs/changelog/2026/6/8.md; https://elevenlabs.io/docs/overview/models.md |
| 26 | Error envelope (`type`, `code`, `message`, legacy `status`, `request_id`, `param`) and the 429 codes `rate_limit_exceeded` / `concurrent_limit_exceeded` / `system_busy` | confirmed | https://elevenlabs.io/docs/eleven-api/resources/errors.md |
| 27 | Error code lists per type | corrected (added `invalid_parameters`, `missing_required_field`, `invalid_content_type`, `invalid_authorization_header`, `forbidden`, `workspace_access_denied`) | https://elevenlabs.io/docs/eleven-api/resources/errors.md |
| 28 | Help-center 429 article uses `too_many_concurrent_requests` | confirmed | https://elevenlabs.io/docs/help-center/technical/api-error-code-429.md |
| 29 | Headers `current-concurrent-requests`, `maximum-concurrent-requests`, `character-cost`, `request-id`, `x-trace-id`, `x-region` | confirmed | https://elevenlabs.io/docs/overview/models.md; https://elevenlabs.io/docs/api-reference/introduction.md; https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md |
| 30 | `xi-api-key` header; key restrictions (scope, credit quota, IP allowlist 1–100 public entries, 403 when the IP is not allowed) | confirmed | https://elevenlabs.io/docs/api-reference/authentication.md; https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md |
| 31 | User-key expiry from 15 min to 30 days (default Never); service-account keys never expire; GitHub leak auto-disable; `third_party_disable_allowed` on by default for non-Enterprise | confirmed | https://elevenlabs.io/docs/overview/administration/workspaces/api-keys.md |
| 32 | Service accounts: multi-seat only, admin-managed, start with no access, share through groups | confirmed | https://elevenlabs.io/docs/overview/administration/workspaces/service-accounts.md |
| 33 | Resources created by a service account are visible only to admins by default | added | https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security.md |
| 34 | Per-key `tts_concurrency_limit` / `music_concurrency_limit` / `dubbing_concurrency_limit` are Enterprise-only | confirmed | https://elevenlabs.io/docs/changelog/2026/9/28.md; elevenlabs-python 2.71.0 `types/workspace_api_key_response_model.py` |
| 35 | Permission scope names (`text_to_speech`, `voices_read`, `speech_history_write`, `webhooks_write`, …) | confirmed (no separate Text to Dialogue scope exists; whether `text_to_speech` covers TTD is unverified) | elevenlabs-python 2.71.0 `types/permission_type.py` |
| 36 | Key prefix `sk_` | unverified officially (third-party only); `sutkn_` for single-use tokens is official | https://trevorfox.com/api-key-tester/elevenlabs/; https://elevenlabs.io/docs/api-reference/tokens/create.md |
| 37 | Single-use tokens: `realtime_scribe` / `batch_scribe` / `tts_websocket`, 15 min, consumed on use | confirmed | https://elevenlabs.io/docs/api-reference/tokens/create.md |
| 38 | TTS stream-input: `authorization` / `single_use_token` query params; `inactivity_timeout` default 20, max 180 | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input.md |
| 39 | ZRM: Enterprise only, `enable_logging=false`, eligible TTS/TTD/STS/STT/Agents, not IVC/PVC/Music/Dubbing/Studio, "history features… including request stitching" unavailable; 30-day backups without ZRM | confirmed | https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode.md; https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md |
| 40 | Output-format gates: 192 kbps MP3 needs Creator+, 44.1 kHz PCM/WAV needs Pro+; `optimize_streaming_latency` deprecated | confirmed | https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md |
| 41 | TTD continuity fields `previous_text` / `future_text` (≤100 chars), request IDs (≤3) | added | https://elevenlabs.io/docs/changelog/2026/9/28.md |
| 42 | `GET /v1/models` `max_characters_request_*` deprecated in favour of `maximum_text_length_per_request` | added | https://elevenlabs.io/docs/changelog/2026/9/28.md |
| 43 | Data residency EU/IN/SG: Enterprise-only, separate blank workspaces and keys, no Dubbing, ZRM separate | confirmed | https://elevenlabs.io/docs/overview/administration/data-residency.md |
| 44 | Global routing default since 2026-02; `api.us.elevenlabs.io` pins the US | confirmed | https://elevenlabs.io/docs/changelog/2026/2/9.md; https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization.md |
| 45 | Training opt-out toggle; Enterprise not trained on by default | confirmed | https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models.md; https://elevenlabs.io/terms-of-use |
| 46 | `DELETE /v1/history/{history_item_id}` | confirmed (upgraded from secondary) | https://elevenlabs.io/docs/api-reference/history/delete.md |
| 47 | DPA 8 Apr 2026: 30-day subprocessor notice, "without undue delay" breach notice, SOC 2 Type II report for audits, 180-day self-serve inactivity deletion | confirmed | https://elevenlabs.io/dpa |
| 48 | PUP and ToS last updated 09 Oct 2026; 18+; CSEA; incest/bestiality/necrophilia; non-consensual intimate content; gratuitous gore; "harmful emotional dependency"; "Attempting to violate… is itself a violation" | confirmed | https://elevenlabs.io/use-policy; https://elevenlabs.io/terms-of-use |
| 49 | PUP scope wording "resellers or third-party apps" | corrected (exact scope: "directly, through an authorized reseller, or through a product or application built with our technology") | https://elevenlabs.io/use-policy |
| 50 | PUP bans using output "to train competing models" | corrected (bans training or improving **any** AI model, plus wrappers/proxies and end-user terms more permissive than ours) | https://elevenlabs.io/use-policy |
| 51 | ToS: Free is non-commercial; "as is"/"as available"; liability greater of $100 or 12 months' fees; review Output before distribution; no PHI without a BAA | confirmed | https://elevenlabs.io/terms-of-use |
| 52 | OEM Terms (28 Feb 2025): Free/Starter/Creator/Pro "expressly prohibited from Making Available"; Business Entity means Scale/Business/Enterprise and excludes individuals; End User Agreement flow-down; audit | confirmed | https://elevenlabs.io/oem-terms |
| 53 | Voice Library notice period always protects existing users, 30 days to 2 years; "minimum 3 months" from another source | corrected (notice period is optional; without one, removal is immediate; minimum is 30 days) | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-a-notice-period.md; https://elevenlabs.io/vla |
| 54 | Live Moderation: owner-enabled on shared PVCs, adds latency, applies only to users who add the voice after a change | confirmed | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation.md; https://elevenlabs.io/vla |
| 55 | Library voice credit multipliers | confirmed (upgraded from secondary; legacy custom rates, plan-dependent) | https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers.md |
| 56 | Voice Design voices may underperform on v4 | added | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4.md |
| 57 | Webhook events `voice_removal_notice` / `_withdrawn` / `voice_removed`; HMAC `ElevenLabs-Signature`; auto-disable after ≥10 failures and no success in 7 days | confirmed | https://elevenlabs.io/docs/eleven-api/resources/webhooks.md |
| 58 | Webhook retry schedule "up to 5 retries" with ±10% jitter, applying to all events | corrected (5 attempts in total: immediate, 30 s, 2 min, 8 min, 30 min; up to +10% jitter; retry support documented only for Agents post-call events) | https://elevenlabs.io/docs/eleven-api/resources/webhooks.md |
| 59 | Workspace webhook `events` subscription incl. `voice_library_removal_notice` | added | https://elevenlabs.io/docs/api-reference/webhooks/update.md; https://elevenlabs.io/docs/changelog/2026/7/20.md |
| 60 | Static egress IPs (US/EU/Asia pairs) | confirmed | https://elevenlabs.io/docs/eleven-api/resources/ip-allowlisting.md |
| 61 | Python SDK 2.71.0 (2026-10-05), 3.0.0a1 pre-release; 240 s default timeout; `max_retries=2` on 408/409/429/5xx; honours `retry-after-ms` / `retry-after` / `x-ratelimit-reset`; sync-only TTS WS helper; TTD WS only as types; webhook compare uses `!=` with 30-min tolerance | confirmed | https://pypi.org/pypi/elevenlabs/json; elevenlabs-python 2.71.0 wheel (`base_client.py:68-113`, `core/http_client.py:21-123,379`, `realtime_tts.py:9`, `webhooks_custom.py:55-68`) |
| 62 | JS SDK 2.71.0, 60 s default timeout, 2 retries on 408/409/429/5xx; `@elevenlabs/client` 1.27.0, `@elevenlabs/react` 1.17.0 | confirmed (added the JS `3.0.0-alpha.1` tag) | https://registry.npmjs.org/@elevenlabs/elevenlabs-js; https://github.com/elevenlabs/elevenlabs-js |
| 63 | Status-page TTS/STT incidents on Aug 3, Aug 26, Sep 4, Sep 28, Sep 29, Oct 6 | confirmed (the "upstream provider" detail for Aug 3 was not re-checked) | https://status.elevenlabs.io/history |
| 64 | Startup Grants: 12 months, 33M characters, Scale-level benefits | confirmed | https://elevenlabs.io/pricing/api; https://elevenlabs.io/docs/overview/models.md |
| 65 | MiniMax speech-2.8-turbo $0.06/1K, HD $0.10/1K, ASR $0.38/h | confirmed | https://platform.minimax.io/docs/pricing/overview |
| 66 | Billing of audio tags and `previous_text` / `next_text`; partial billing on mid-stream cancel; Speech Engine minute definition; `character_limit` exhaustion error code | unverified (not documented; measure with `character-cost` in staging) | — |
| 67 | Groq whisper-large-v3 $0.111/h with a 10 s minimum | unverified here (secondary source only) | https://groq.com/pricing |
| 68 | Codebase citations spot-checked: `tts_generation/config.py:28,34-37`, `route_chat.py:155`, `voice_orchestration/config.py:26-38`, `voice_orchestration/engine.py:59,63`, `minimax_credentials.py:8`, `tts_generation/engine.py:94`, `minimax_adapter.py:17,24-25`, `requirements.txt:16,27,38` | confirmed | /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:34 and the other listed paths |
