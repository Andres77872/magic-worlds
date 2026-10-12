# Consolidated voice cost model: MiniMax today vs ElevenLabs options

Date: 2026-10-12.

**Scope.** One monthly cost model for every speech workload in magic-worlds:
- chat narration jobs;
- realtime voice calls (TTS plus STT);
- voice previews in the user Voice Studio and the voice picker;
- root-console voice design, cloning and catalog operations.

It compares MiniMax as it runs today with the ElevenLabs options proposed in notes 01–08. Each is costed at three usage levels: 1k, 10k and 50k monthly active users (MAU). It also covers:
- which ElevenLabs subscription fits each level;
- concurrency headroom per plan against estimated peak load;
- the cost of each preview policy;
- a proposal for re-pricing the app's own membership credits.

Theme songs (fal.ai `minimax/music-3`, ACE-Step, Eleven Music) are priced in a side table only. They are not TTS and are a separate owner decision (09, decision 1).

This note closes the cost-model half of critic gap G15 ("Build one spreadsheet from list prices… at three usage levels"; the task brief refers to it as G14). It also resolves contradictions C15 (v4 promo vs list price) and C18 (Speech Engine 3.5× vs 4×). LLM cost is excluded everywhere, including for Speech Engine and Agents, where we supply the LLM.

**Tags.**

| Tag | Meaning |
|---|---|
| `[verified: url]` | Read today (2026-10-12) on an official page, either by this note or by a note whose verification log says so (the source note is named) |
| `[secondary: url]` | Non-official source |
| `[unverified]` | Not confirmed |
| `[assumption]` | A modelling input chosen here. No telemetry exists yet. |
| `[derived]` | Arithmetic from tagged inputs |

Codebase facts cite absolute paths with line numbers.

---

## Contents

0. [Key findings](#0-key-findings)
1. [Method and formulas](#1-method-and-formulas)
2. [Price table](#2-price-table)
3. [Usage assumptions](#3-usage-assumptions)
4. [Unit costs](#4-unit-costs)
5. [Monthly cost per scenario](#5-monthly-cost-per-scenario)
6. [Subscription plan fit and concurrency fit](#6-subscription-plan-fit-and-concurrency-fit)
7. [Preview policy cost](#7-preview-policy-cost)
8. [Side table: theme songs and other media](#8-side-table-theme-songs-and-other-media)
9. [Sensitivity](#9-sensitivity)
10. [Proposal: re-pricing the app's membership credits](#10-proposal-re-pricing-the-apps-membership-credits)
11. [Recommendation](#11-recommendation)
12. [Contradictions and gaps resolved here](#12-contradictions-and-gaps-resolved-here)
13. [Still open (needs the staging spike or telemetry)](#13-still-open-needs-the-staging-spike-or-telemetry)
14. [Sources](#14-sources)

---

## 0. Key findings

1. **Narration is about 90% of the speech bill under every option. The narration model is the biggest cost lever; the plan tier is not.** At 10k MAU, on the base assumptions:

   | Option | Total speech cost per month | vs MiniMax today | Share of illustrative revenue |
   |---|---|---|---|
   | MiniMax today | **$10.4k** | baseline | 72% |
   | ElevenLabs, all narration on `eleven_v4` | $13.6k | +30% | 94% |
   | ElevenLabs, all narration on Flash v2.5 | $6.8k | −34% | 47% |
   | **Recommended mix** | **$9.1k** | **−13%** | 63% |

   The recommended mix is Flash v2.5 by default, `eleven_v4` "Expressive" narration for paid users, and Flash plus Groq for calls (§5.5).
2. **List prices only.** `eleven_v4` costs $0.08 per 1K characters and `eleven_v4_turbo` $0.04. The API pricing page still shows the launch promo ($0.022 / $0.011, "72% off until Oct 12"), which ends today [verified: https://elevenlabs.io/pricing/api]. At the promo price, v4 narration would be 62% *cheaper* than MiniMax. Do not plan on it. This resolves C15 (§12).
3. **Calls are cheap on every DIY pipeline. Speech Engine costs 3.2–4.3× as much.**
   - DIY pipelines cost $0.019–0.025 per call-minute, against $0.028 today.
   - Speech Engine is $0.08 per minute [verified: https://elevenlabs.io/pricing/api].
   - The "3.5×" in note 02 and the "4×" in note 05 are both right for their own baselines. The multiple is 3.2–3.3× against a like-for-like pipeline using Scribe Realtime, and 4.3× against keeping Groq. This resolves C18.
4. **Plan fees do not change the bill at any modelled level.**
   - Below Enterprise, the plan fee is a prepaid USD allowance spent at the same list rates. Overage comes from PAYG at those rates [derived from https://elevenlabs.io/pricing/api; https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md].
   - Speech usage exceeds even the $990 Business fee at 10k MAU, and nearly does at 1k MAU (about $910 a month).
   - So choose the tier on non-price grounds: the OEM "Making Available" clause, service accounts, concurrency and voice slots. That points to **Scale ($299) at launch**.
   - Open **Enterprise** talks before roughly $3k a month of spend: volume pricing [unverified], ZRM and per-key concurrency.
5. **Concurrency is not the constraint at 1k or 10k MAU. At 50k MAU the binding limits are our own.**
   - `TTS_GLOBAL_CONCURRENCY` defaults to 3 per process [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:34-35].
   - `VOICE_GLOBAL_CONCURRENCY` defaults to 8 [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:31].
   - On ElevenLabs, all-v4 narration (about 9–11 concurrent at p99) nearly fills Pro's 10 non-Flash slots and fits Scale's 15. The recommended Flash-default mix needs about 5.
   - Speech Engine at the heavy-call sensitivity (54 concurrent calls) would exceed Scale's 30 and fall into burst pricing at 2×. (§6.2)
6. **The per-request credit is the real leak.**
   - Today one narrated turn costs 1 app credit, and only segment 0 reserves quota [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433].
   - A Pro user can trigger 500 narrations a day [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:939]. At 1,000 characters per turn that is $945 a month on MiniMax and $1,298 on v4, against a proposed $24.99 plan price.
   - One worst-case turn (32 segments × 3,000 chars) costs $7.68 on v4.
   - §10 proposes character-based credits:

     | Narration tier | Credit rate |
     |---|---|
     | Standard (Flash) | 1 credit per 400 characters |
     | Expressive (v4) | 1 credit per 200 characters |

     It adds a 2,500-character per-turn cap and daily character caps sized so that a user who maxes out every day costs about 1× their plan price.
7. **The preview policy is worth about 1.5% of the bill, but the unmetered endpoint is an abuse hole.**
   - Today every audition is synthesized: about $170 a month at 10k MAU.
   - Serving the free `preview_url` plus pre-rendered samples, and metering only recipe previews, cuts this to about $16.
   - The unmetered `/voice-presets/preview` route [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118] could be scripted at 1 request/s × 400 characters. That costs **about $2.1k a day on MiniMax today, or $2.8k a day on v4**.
8. **Admin voice operations are nearly free on ElevenLabs.**
   - Voice Design bills only the preview-text characters [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost.md]. MiniMax charges $3 per designed voice and $1.5 per clone, on first use [verified: https://platform.minimax.io/docs/pricing/overview].
   - The ElevenLabs constraints are voice slots and monthly voice operations, not money.

---

## 1. Method and formulas

- **Unit of account:** US dollars per month, at public list prices on 2026-10-12. No taxes, payment fees, storage, egress or LLM cost.
- **ElevenLabs billing model:**
  - "API usage is billed in US dollars, not credits" [verified: https://elevenlabs.io/pricing/api].
  - The per-plan "included" figures equal the plan fee divided by the unit price for every product. Examples: Pro $99 = 1,238,000 v2 characters at $0.08/1K = 1,238 Speech Engine minutes at $0.08 [verified: https://elevenlabs.io/pricing/api].
  - We therefore treat the plan fee as **one prepaid USD allowance shared by all products**. Overage is drawn from the PAYG balance [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md] [derived].
  - Monthly bill = `max(plan fee, usage)`, ignoring rollover. Rollover keeps up to 2 months of unused allowance [verified: https://elevenlabs.io/pricing].
- **MiniMax billing model:** pay-as-you-go list rates. **We do not know which MiniMax plan or contract the app actually pays** (05 §10.1, §12) [unverified]. The S0 baseline is therefore list-price, not invoice.
- **Formulas:**

  | Quantity | Formula |
  |---|---|
  | Narration $/month | MAU × narrated turns per MAU × chars/turn × tag factor × waste factor × $/1K ÷ 1,000 |
  | Call $/month | MAU × call-min per MAU × (TTS chars/min × barge-in waste × $/1K ÷ 1,000 + billed STT min/min × $/min) |
  | Speech Engine $/month | MAU × call-min per MAU × $0.08. One "minute" is taken as one wall-clock call-minute [unverified]. |
  | Peak narration concurrency | (monthly turns ÷ 30 ÷ 24) × peak-hour factor 3 ÷ 3,600 × generation seconds per turn × p99 burst factor 2.5 |
  | Peak concurrent calls | monthly call-minutes ÷ 43,200 × peak factor 3 (burst ×1.5 on top) |

- The arithmetic was run in a scratch script. All tables round to the nearest dollar or cent.

---

## 2. Price table

All rows were read on **2026-10-12**.

### 2.1 ElevenLabs API unit prices

| Item | Price used | Notes | Confidence |
|---|---|---|---|
| `eleven_v4` TTS | **$0.08 / 1K chars** (list) | Page shows ~~$0.08~~ $0.022, "72% off until Oct 12". Plan-included v4 characters are computed at the promo rate (Pro 4,500,000), so they should fall to the v2 figure (Pro 1,238,000) after the promo [derived]. Served "via the Text to Dialogue API" [verified: https://elevenlabs.io/docs/overview/models.md]. | [verified: https://elevenlabs.io/pricing/api] |
| `eleven_v4_turbo` TTS | **$0.04 / 1K** (list) | Promo $0.011. Text to Dialogue WebSocket only; one voice per connection (05 §1). | [verified: https://elevenlabs.io/pricing/api] |
| `eleven_v3` | $0.08 / 1K | 5,000 chars per request (05 §2.3). | [verified: https://elevenlabs.io/pricing/api] |
| `eleven_v3_conversational` | $0.04 / 1K | Realtime TTD WebSocket. | [verified: https://elevenlabs.io/pricing/api] |
| `eleven_multilingual_v2` | $0.08 / 1K | | [verified: https://elevenlabs.io/pricing/api] |
| Flash / Turbo (`eleven_flash_v2_5`) | **$0.04 / 1K** | "50% lower price per character" [verified: https://elevenlabs.io/docs/overview/models.md] | [verified: https://elevenlabs.io/pricing/api] |
| Scribe v2 (batch STT) | $0.22 / h ($0.00367/min) | +$0.05/h keyterms, +$0.07/h transcript editing | [verified: https://elevenlabs.io/pricing/api] |
| Scribe v2 Realtime | **$0.39 / h ($0.0065/min)** | +$0.08/h keyterms, +$0.12/h editing. Whether it bills per streamed-session minute or per speech minute is [unverified]. | [verified: https://elevenlabs.io/pricing/api] |
| Speech Engine / Agents | **$0.08 / min**; burst $0.16/min | Included minutes and concurrent calls: Pro 1,238 / 20, Scale 3,738 / 30, Business 12,375 / 40. Burst allows up to 3× concurrency at 2× price [verified: https://elevenlabs.io/pricing/agents]. LLM billed separately. The minute definition (wall clock vs active) is [unverified]. | [verified: https://elevenlabs.io/pricing/api] |
| Eleven Music | $0.15 / min; finetune $1.50 | 5-minute limit per generation | [verified: https://elevenlabs.io/pricing/api] |
| Sound effects | $0.12 / min | The FAQ says "billed per generation" (conflict persists, 05 §3.6) | [verified: https://elevenlabs.io/pricing/api] |
| Voice Design | Preview-text characters only, once per generate call, which returns 3 previews | The per-character model rate is not stated. Modelled at $0.08/1K [unverified]. Saving a voice uses one custom voice slot (03 §7.1). | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost.md] |
| Instant Voice Clone creation | **$0 modelled** | No per-clone fee found in official pages. Uses a slot and a voice operation. | [unverified] |
| Voice Library "credit multiplier" | Some legacy shared voices cost 2× or more | Per-voice. The catalog importer must flag these. | [verified: https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers.md] (via 05 log #55) |
| Older third-party price levels | $0.10/1K v2/v3, $0.05/1K Flash | Suggests a price cut around v4 launch. Used for the +25% sensitivity. | [secondary: https://www.goodvibecode.com/text-to-speech/elevenlabs-api-pricing-explained] (via 05 §2.3) |
| Startup Grant | 12 months free, 33,000,000 characters | About $1.3k (Flash) to $2.6k (v4) of list value over a year | [verified: https://elevenlabs.io/pricing/api] |

### 2.2 ElevenLabs plans (fee, limits)

| Plan | $/month (annual = 10×) | Seats | Custom voice slots | Voice ops/month | TTS concurrency non-Flash / Flash | STT batch / realtime | TTD WS sessions | Agents / Speech Engine concurrent calls | PAYG purchase cap without 2FA |
|---|---|---|---|---|---|---|---|---|---|
| Pro | 99 | 1 | 160 | 290 | 10 / 20 | 40 / 30 | 70 | 20 | $200 |
| Scale | 299 | 3 | 660 | 1,040 | 15 / 30 | 60 / 45 | 105 | 30 | $600 |
| Business | 990 | 10 | 2,200 (pricing page) vs 660 (help center) | 1,040 | 15 / 30 (pricing page says 25) | 60 / 45 | 105 | 40 | $2,000 |
| Enterprise | custom | custom | custom | unlimited | elevated | elevated | elevated | custom | n/a |

Sources:
- fees, seats, slots and pricing-page concurrency [verified: https://elevenlabs.io/pricing];
- model-family concurrency, STT and TTD sessions [verified: https://elevenlabs.io/docs/overview/models.md];
- agents concurrency [verified: https://elevenlabs.io/pricing/agents];
- PAYG caps, "usage is then drawn from your PAYG balance", and "service will pause immediately" at $0 [verified: https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md];
- voice ops [verified: https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it] (via 01 §18.1 and 03 §8.2).

The OEM Terms bar Free–Pro from "Making Available" the services [verified: https://elevenlabs.io/oem-terms] (via 05 §6.9). Service accounts need a multi-seat plan, Scale or above (05 §1).

### 2.3 MiniMax (the baseline)

| Item | Price | Notes | Confidence |
|---|---|---|---|
| `speech-2.8-turbo` T2A (sync and async) | **$60 / 1M chars = $0.06 / 1K** | Used for narration, calls and previews today [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:25-27] | [verified: https://platform.minimax.io/docs/pricing/overview] |
| `speech-2.8-hd` | $100 / 1M = $0.10 / 1K | Admin lab only | [verified: same] |
| WebSocket streaming (calls) | Not listed separately. Modelled at the T2A rate. | | [unverified] |
| Voice Design | **$3 per voice**, "charged when the designed voice is first used for synthesis"; previews $60/M chars | | [verified: same] |
| Rapid Voice Cloning | **$1.5 per voice**, charged on first synthesis | | [verified: same] |
| ASR | $0.38 / h | Not used (we use Groq) | [verified: same] |
| Music-3.0 (direct API) | $0.15 per track up to 5 min | Not used: we call it through fal.ai. The page notes that paid music APIs stop being available to new users from 2026-08-20. | [verified: same] |
| Audio subscriptions | Starter $5 (100k points) … Pro $99 (1.1M) … Business $999 (20M points), RPM 10–800 | The points-to-characters conversion is not published | [verified: same]; conversion [unverified] |

### 2.4 Groq (current call STT)

| Item | Price | Confidence |
|---|---|---|
| `whisper-large-v3` (used today [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:24]) | **$0.111 / h**, **each request billed at least 10 s** | [verified: https://console.groq.com/docs/speech-to-text] (upgrades 05's [secondary]) |
| `whisper-large-v3-turbo` (cheaper alternative) | $0.04 / h, same 10 s minimum | [verified: same] |

### 2.5 fal.ai (theme songs, side table only)

| Endpoint | Price | Confidence |
|---|---|---|
| `minimax/music-3` [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:30] | **$0.002 / s** ($0.12 per 60 s song) | [verified: https://fal.ai/models/minimax/music-3] (closes 04's open question on this price) |
| `fal-ai/ace-step` | $0.0002 / s ($0.012 per 60 s) | [verified: https://fal.ai/models/fal-ai/ace-step] |

### 2.6 App-side prices and limits (codebase)

| Fact | Value | Source |
|---|---|---|
| Daily included credits per plan | free 50, plus 100, pro 500 | [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:909-914] |
| `tts_generation` limit | 20 / 100 / 500 requests a day, 1 credit each; max in flight 1 / 2 / 4 | [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:923,931,939] |
| `voice_call` limit | 50 / 100 / 500 a day, 1 credit each | [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:925,933,941] |
| Voice call billing unit | 1 credit per 10 s of **billed audio**, which is STT ms plus TTS ms (silence is not billed) | [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:58-59,1957] |
| Call caps | 10 min per user per day, 600 s maximum per call, for every plan | [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:27-28] |
| Included room per operation | `min(daily credit room, daily op room)`, plus PAYG wallet | [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:2621-2630] |
| Narration quota | Reserved only for segment 0 of a turn | [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:1433] |
| Narration segment caps | Up to 32 segments × `TTS_MAX_TEXT_CHARS` 3,000 chars, i.e. 96,000 chars per turn worst case | [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:15]; [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155] |
| Preview text limit | 400 chars, unmetered, no rate limit | [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:20,99-118] |
| Theme song limit | 5 / 25 / 100 a day, 1 credit each | [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:922,930,938] |
| User-facing prices (**proposed**, not confirmed live; the api.auth Stripe catalog is the source of truth) | Plus $9.99/month, Pro $24.99/month; PAYG packs 100 / 250 / 750 credits for $5 / $10 / $25 ($0.033–0.05 per credit) | [code: /home/andres/WebstormProjects/magic-worlds/docs/billing/README.md:126-135]; [code: /home/andres/WebstormProjects/magic-worlds/docs/membership-management-review.md:34-35] |

---

## 3. Usage assumptions

No usage telemetry exists. 08 §18 lists the queries, and none have been run (09 G6). **Every number in this section is an [assumption].** Change them here and re-run §1's formulas.

### 3.1 Population

| Parameter | Value | Rationale |
|---|---|---|
| Levels | small 1,000 MAU · medium 10,000 · large 50,000 | Task brief |
| Tier mix | Free 90% · Plus 7% · Pro 3% | Typical freemium conversion. Used only for blending and the revenue context. |
| Illustrative revenue | $1.449 per MAU, from the proposed $9.99 / $24.99 prices. That is $1,449 / $14,490 / $72,450 a month. | Context only, not a forecast |
| Online at peak | ≈1.5% of MAU: DAU/MAU 25% × 30 min/day ÷ 24 h × peak factor 3 | 15 / 150 / 750 users |

### 3.2 Narration

| Parameter | Free | Plus | Pro | Blended per MAU | Note |
|---|---|---|---|---|---|
| Narrated turns per user per month | 5 | 60 | 200 | **14.7** | Includes users who never narrate |
| Billed chars per narrated turn | 1,000 base (range 600–1,500) | | | | Sum of narrator, character and thought segments |
| Multi-voice share | 60% of turns have ≥ 2 voices; about 2.5 segments per turn on average | | | | Affects request count and concurrency. Cost is per character. |
| v3/v4 audio-tag overhead | +3% chars | | | | Emotion and `[whispers]` prefixes; whether tags are billed is [unverified] |
| Retry and regeneration waste | +5% (per segment); +8% for Text to Dialogue, where a retry re-renders the whole turn | | | | Replays of stored MP3s are free |
| `previous_text` / `next_text` context | Not billed (base); +30% sensitivity | | | | [unverified] (05 §10.2) |
| Expressive share in the recommended mix (E) | 0% | 50% of turns | 50% of turns | 35% of all characters | Free is Standard (Flash) only |
| Generation time per 1K chars (for concurrency) | Flash 1.5 s · v4 / v2 4 s | | | | [unverified]: to measure in the spike |

### 3.3 Calls

| Parameter | Free | Plus | Pro | Blended per MAU | Note |
|---|---|---|---|---|---|
| Call-minutes (wall clock) per user per month | 1 | 15 | 50 | **3.45** | Cap is 10 min/day = 300/month |
| Assistant speech per call-minute | 0.45 min × **900 chars/min** = 405 chars | | | | 150 wpm (05 §10.3) |
| Barge-in / unplayed TTS waste | +10% TTS chars | | | | `close_context` keeps flushing (C8) |
| User speech per call-minute | 0.35 min in 3 utterances of ~7 s | | | | 20% is silence or latency |
| Groq billed STT | 3 × max(7 s, 10 s) = 30 s, so **0.5 min per call-minute** | | | | 10 s minimum per request |
| Scribe v2 Realtime billed | **1.0 min per call-minute** (mic streamed for the whole call); 0.4 if VAD-gated (sensitivity) | | | | Billing basis [unverified] |
| App-billed audio | (0.35 + 0.45) × 60 = 48 s, so **4.8 credits per call-minute** | | | | 1 credit per 10 s |

### 3.4 Previews

| Parameter | Value |
|---|---|
| Auditions per user per month (picker and Studio) | Free 1 · Plus 4 · Pro 8, blended **1.42** per MAU |
| Today (MiniMax) | Every audition is synthesized; average 200 chars (limit 400) |
| ElevenLabs preview policy P1 | Catalog auditions use the free `preview_url` [verified: https://elevenlabs.io/docs/api-reference/voices/search] (via 03 §3 and §9), or our pre-rendered samples. Only "hear my recipe" previews are synthesized: Plus 1.5, Pro 3 per user per month; 150-char fixed text; 30% cache-hit rate; rendered on v4. |
| Pre-render one-off | 150 catalog voices × 2 languages × 2 models × 150 chars ≈ 90k chars ≈ $5 per full re-render |

### 3.5 Admin voice console and catalog

| Parameter | Small | Medium | Large |
|---|---|---|---|
| Voice Design generate calls / month (250-char preview text) | 20 | 50 | 100 |
| Designed voices saved and used / month | 5 | 10 | 20 |
| Instant clones / month | 1 | 2 | 4 |
| Synth-lab test renders / month (300 chars) | 50 | 100 | 200 |
| Library voice adds / edits (ops) / month | 10 | 20 | 40 |
| One-off at launch | ~100 library adds + ~40 designed house voices + ≤10 IVC ≈ 150 ops, ~50 slots | | |

---

## 4. Unit costs

### 4.1 Narration: cost per narrated turn (1,000 chars)

| Option | Model and transport | $ / turn | vs MiniMax |
|---|---|---|---|
| **M0 (today)** | MiniMax `speech-2.8-turbo`, one HTTP job per segment | **$0.0630** | baseline |
| M0-hd (reference) | MiniMax `speech-2.8-hd` | $0.1050 | +67% |
| **A** | `eleven_v4` per segment. Through Text to Dialogue with one input per segment if `/v1/text-to-speech` rejects v4 (C7); same price either way. | $0.0865 | +37% |
| **B** | `eleven_multilingual_v2` per segment (no tags) | $0.0840 | +33% |
| **C** | `eleven_flash_v2_5` per segment | **$0.0420** | **−33%** |
| **D** | Text to Dialogue `eleven_v4`, one request per turn | $0.0890 | +41% |
| **E (recommended mix)** | C for Free and 50% of paid turns; A for 50% of paid turns ("Expressive") | **$0.0574** blended | **−9%** |
| A at promo $0.022 (not plannable) | `eleven_v4` promo | $0.0238 | −62% |

Worst-case turn today (96,000 chars):

| Model | Cost |
|---|---|
| MiniMax | $5.76 |
| Flash | $3.84 |
| v4 | **$7.68** |

### 4.2 Calls: cost per wall-clock call-minute

| Option | TTS part | STT part | **$ / call-min** | vs today |
|---|---|---|---|---|
| **K0 (today):** MiniMax turbo WS + Groq | 445.5 chars × $0.06 = $0.02673 | Groq 0.5 min = $0.00093 | **$0.0277** | baseline |
| **K1:** Flash v2.5 multi-context WS + Groq | $0.01782 | $0.00093 | **$0.0188** | −32% |
| **K2:** Flash v2.5 WS + Scribe v2 Realtime (whole call) | $0.01782 | $0.00650 | $0.0243 | −12% |
| K2v: same, VAD-gated Scribe (0.4 min) | $0.01782 | $0.00260 | $0.0204 | −26% |
| **K3:** `eleven_v4_turbo` TTD WS + Scribe Realtime | $0.01835 (+3% tags) | $0.00650 | $0.0249 | −10% |
| K3g: `eleven_v4_turbo` TTD WS + Groq | $0.01835 | $0.00093 | $0.0193 | −30% |
| **K4:** Speech Engine (STT + turns + TTS; our LLM) | included | included | **$0.0800** | +189% |

**Speech Engine multiple (resolves C18).** The price is $0.08/min in every note. Only the DIY denominator differs:

| Baseline | DIY $/min | SE multiple |
|---|---|---|
| Note 02: 40% assistant talk, Flash + Scribe RT for the whole call | $0.0225 | **3.6×** |
| Note 05: 50/50, Flash + Groq | $0.0189 | **4.2×** |
| Note 05: 50/50, Flash + Scribe RT | $0.0213 | 3.8× |
| This note: K1 Flash + Groq | $0.0188 | 4.3× |
| This note: K2 Flash + Scribe RT | $0.0243 | **3.3×** |
| This note: K3 v4 Turbo + Scribe RT | $0.0249 | 3.2× |

**Use "about 3.3× like-for-like, up to 4.3× against keeping Groq".** Two caveats:
- If Speech Engine bills wall-clock minutes while our credits bill audio seconds, its effective cost per *billed* second rises further as calls get quieter.
- Burst minutes cost $0.16.

### 4.3 Previews and admin, per unit

| Unit | MiniMax today | ElevenLabs |
|---|---|---|
| One synthesized audition (200 chars) | $0.012 | $0.016 (v4) / $0.008 (Flash) |
| One catalog audition from `preview_url` | n/a (MiniMax system voices have no preview, so it is synthesized) | **$0** |
| One recipe preview (150 chars, v4) | $0.009 | $0.012 |
| One designed voice, end to end | $3 fee + preview chars | 250 chars ≈ $0.02 per generate call (3 previews) [unverified rate] + 1 slot |
| One clone | $1.5 fee | $0 [unverified] + 1 slot + 1 op |

---

## 5. Monthly cost per scenario

### 5.1 Narration (USD per month)

Monthly turns: small 14,700 · medium 147,000 · large 735,000.

| Option | Small (1k MAU) | Medium (10k) | Large (50k) |
|---|---|---|---|
| **M0 MiniMax turbo (today)** | **926** | **9,261** | **46,305** |
| M0-hd | 1,544 | 15,435 | 77,175 |
| A v4 per segment | 1,272 | 12,718 | 63,592 |
| B multilingual_v2 | 1,235 | 12,348 | 61,740 |
| C Flash v2.5 | 617 | 6,174 | 30,870 |
| D TTD v4 per turn | 1,308 | 13,082 | 65,409 |
| **E Flash default + v4 Expressive (paid)** | **844** | **8,445** | **42,223** |
| (A at expired promo) | (350) | (3,498) | (17,488) |

Request volume per month:
- **per-segment options (A, B, C, E):** about 2.5 requests per turn, which is 1.84M requests at the large level;
- **Text to Dialogue (D):** 0.74M requests at the large level.

### 5.2 Calls (USD per month)

Monthly call-minutes: small 3,450 · medium 34,500 · large 172,500.

| Option | Small | Medium | Large |
|---|---|---|---|
| **K0 MiniMax turbo WS + Groq (today)** | **95** | **954** | **4,770** |
| **K1 Flash + Groq** | **65** | **647** | **3,234** |
| K2 Flash + Scribe RT (whole call) | 84 | 839 | 4,195 |
| K2v Flash + Scribe RT (VAD-gated) | 70 | 704 | 3,522 |
| K3 v4 Turbo TTD WS + Scribe RT | 86 | 857 | 4,287 |
| K3g v4 Turbo TTD WS + Groq | 67 | 665 | 3,326 |
| K4 Speech Engine | 276 | 2,760 | 13,800 |

### 5.3 Previews (USD per month): the cost of the preview policy

| Policy | Small | Medium | Large |
|---|---|---|---|
| **P0 today:** MiniMax synthesizes every audition (200 chars avg) | 17 | 170 | 852 |
| P2: ElevenLabs synthesizes every audition, v4 | 23 | 227 | 1,136 |
| P2f: same on Flash | 11 | 114 | 568 |
| **P1: `preview_url` + pre-rendered catalog samples free; recipe previews metered and cached** | **2** | **16** | **82** |
| P1 one-off pre-render (per full catalog re-render) | ≈5 | ≈5 | ≈5 |

### 5.4 Admin and catalog (USD per month)

| | Small | Medium | Large |
|---|---|---|---|
| MiniMax today: design fees, clone fees, design previews, lab tests | 18 | 36 | 71 |
| ElevenLabs: design previews and lab tests (no per-voice fees) | 2 | 3 | 7 |

The ElevenLabs constraint is capacity, not cost. See §6.3 for slots and ops.

### 5.5 Full stacks (narration + calls + previews + admin)

| Stack | Narration + calls | Small | Medium | Large | Share of illustrative revenue |
|---|---|---|---|---|---|
| **S0 MiniMax today** | M0 + K0 + P0 | **1,056** | **10,421** | **51,999** | 72% |
| **S1 recommended** | E + K1 + P1 | **912** | **9,111** | **45,545** | **63%** (−13% vs S0) |
| S2 all-expressive | A + K3 + P1 | 1,361 | 13,596 | 67,968 | 94% (+30%) |
| S3 cheapest | C + K1 + P1 | 685 | 6,840 | 34,192 | 47% (−34%) |
| S4 Text to Dialogue | D + K3 + P1 | 1,397 | 13,959 | 69,785 | 96% (+34%) |
| S5 Multilingual v2 | B + K2 + P1 | 1,322 | 13,207 | 66,024 | 91% (+27%) |
| S6 recommended narration + Speech Engine calls | E + K4 + P1 | 1,124 | 11,224 | 56,111 | 77% (+8%) |

The share of revenue is the same at every level because usage scales linearly with MAU. Speech alone takes 47–96% of the illustrative subscription revenue before any LLM, image or hosting cost. The usage assumptions or the prices must therefore change; that is the subject of §10.

### 5.6 Per-user voice cost by tier (base usage, USD per user per month)

| Tier (price) | S0 MiniMax | S1 recommended | S2 all-expressive | S3 cheapest | S6 + Speech Engine |
|---|---|---|---|---|---|
| Free ($0) | 0.34 | **0.23** | 0.46 | 0.23 | 0.29 |
| Plus ($9.99) | 4.19 (42%) | **4.14 (41%)** | 5.56 (56%) | 2.80 (28%) | 5.06 (51%) |
| Pro ($24.99) | 13.98 (56%) | **13.79 (55%)** | 18.55 (74%) | 9.34 (37%) | 16.85 (67%) |

### 5.7 Exposure at today's caps (one user who maxes out every day for 30 days)

| Tier | Narration (today's request cap × 1,000 chars) | Calls (10 min/day) |
|---|---|---|
| Free (20 turns/day) | MiniMax $37.8 · v4 $51.9 · Flash $25.2 · E $25.2 | MiniMax $8.30 · Flash+Groq $5.62 · Speech Engine $24.00 |
| Plus (100/day) | MiniMax $189 · v4 $260 · Flash $126 · E $193 | same |
| Pro (500/day) | MiniMax **$945** · v4 **$1,298** · Flash $630 · E $964 | same |

Both tables are [derived].

The shared daily credit pool (50 / 100 / 500 credits) is what actually limits these users today, because narration costs 1 credit a turn. It does not limit them enough. A Pro user who spends the full pool on narration is still at the 500/day row.

---

## 6. Subscription plan fit and concurrency fit

### 6.1 Plan fee vs usage (recommended stack S1)

Bill = `max(plan fee, usage)`, at list rates (§1).

| Level | S1 usage | Pro ($99) | Scale ($299) | Business ($990) | Enterprise |
|---|---|---|---|---|---|
| Small | $912 | $912, but Pro is barred by the OEM clause, has no service accounts, and its PAYG purchase cap without 2FA is $200 | **$912** (PAYG overage $613 exceeds the $600 cap without 2FA, so **enable 2FA**) | $990 (+$78 for nothing we need) | Not yet |
| Medium | $9,111 | $9,111 | **$9,111** | $9,111 | **Open talks.** Spend is above the ~$2–3k/month threshold in 05 §11.1. Any discount is [unverified]. |
| Large | $45,545 | $45,545 | $45,545 | $45,545 | **Required in practice.** Volume pricing, ZRM, SLA and per-key concurrency. |

Reading:
- At every level the tier choice adds $0. The one exception is Business at the small level, which adds $78.
- The tier therefore follows from non-price needs:
  - **Scale** for the OEM "Making Available" tier, 3 seats (service accounts), 15/30 TTS concurrency, 105 TTD sessions and 660 slots.
  - **Business** only if we need more than 660 slots or more than 3 seats.
  - **Enterprise** once monthly spend makes a discount worth negotiating.
- Even at half the base usage, small-level usage (about $460) exceeds the Scale fee. The fee is never stranded allowance.
- The Startup Grant (33M characters over 12 months) would cover about 2 months of small-level narration (about 15M billed characters a month) or about 1 week at the medium level. It is worth applying for, but it is not structural.

### 6.2 Concurrency demand at peak vs plan limits

Demand is estimated with the formulas in §1; the generation speeds are [unverified]. Multi-voice turns fire up to 3 segment requests at once, so per-segment options never use fewer than 3 slots in practice.

| Pool | Small | Medium | Large (base) | Large (heavy: 2× narration, 3× calls) | Pro | Scale | Business |
|---|---|---|---|---|---|---|---|
| Non-Flash TTS HTTP, options A / B / D (narration + v4 previews + admin) | 3 | 3–4 | **9–11** | **18–22** | 10 | 15 | 15 (25 per pricing page) |
| Non-Flash TTS HTTP, option E (35% v4) | 3 | 3 | 4–5 | 8–10 | 10 | 15 | 15 |
| Flash TTS (C/E narration + call TTS generation time only) | 3 | 3 | 4–6 | 8–12 | 20 | 30 | 30 |
| Realtime STT sessions (K2 / K3, one per call) | 1–2 | 3–4 | 12–18 | 36–54 | 30 | 45 | 45 |
| TTD WebSocket sessions (K3; ×2 if a hot-spare socket is kept) | 1–4 | 3–8 | 12–36 | 36–108 | 70 | 105 | 105 |
| Speech Engine concurrent calls (K4) | 1–2 | 3–4 | 12–18 | 36–54 | 20 (burst to 60 at 2×) | 30 (burst to 90) | 40 (burst to 120) |
| **App limiter** `TTS_GLOBAL_CONCURRENCY`, per process (default 3, max 20) | OK | OK | **Binding for A/B/D** | Binding | | | |
| **App limiter** `VOICE_GLOBAL_CONCURRENCY` (default 8, max 64) | OK | OK | **Binding (peak 12–18)** | Binding | | | |

Reading:
- 1k and 10k MAU fit Pro on every pool.
- At 50k MAU:
  - all-v4 narration (A/B/D) needs Scale, and overflows it under heavy use, where requests queue and then 429;
  - the recommended Flash-default mix stays within Pro limits for narration;
  - calls on Flash multi-context WS or on TTD fit Scale comfortably;
  - Speech Engine fits Scale at base, but heavy use pushes it into burst pricing. At 54 concurrent calls, 24 of them are billed at $0.16/min.
- The first limits we hit are **our own** (sources: [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:34-35]; [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:94]; [code: /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:31,38]). Raise them to the 05 §11.4 targets, for example narration 12 of 15 and calls 24 on Scale, and make the TTS limiter cross-process.

**Rule of thumb check.** ElevenLabs says "a concurrency limit of 5 can typically support up to approximately 100 simultaneous audio broadcasts" [verified: https://elevenlabs.io/docs/overview/models.md]. Our large level has about 750 users online at peak, with roughly 30% narrating and 2% in calls. That is consistent with about 10 non-Flash slots.

### 6.3 Voice slots and operations

| Need | Launch | Per month | Pro (160 slots / 290 ops) | Scale (660 / 1,040) |
|---|---|---|---|---|
| Slots (designed + IVC house voices) | ~50 | +6 / +12 / +24 | fits for about 2 years at the large level | fits |
| Ops (library adds + edits + saves) | ~150 | 10–40 | fits (launch uses about half a month) | fits |

Library voices do not use slots [verified: https://elevenlabs.io/docs/overview/administration/billing.md] (via 05 §2.1). Whether adding a shared voice counts as an op is [unverified] (03 Q3).

---

## 7. Preview policy cost

| Policy | What the user hears | Monthly cost (S/M/L) | Abuse ceiling | Notes |
|---|---|---|---|---|
| **P0 today (MiniMax)** | Synthesized text, ≤400 chars, any `voice_id`, unmetered, no rate limit | $17 / $170 / $852 | **Unbounded.** 1 req/s × 400 chars = 34.6M chars/day, about **$2,074/day** | Baseline issue #1 [code: /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:99-118] |
| P2 ElevenLabs "same as today" | Synthesized on the narration model | $23 / $227 / $1,136 (v4) | about **$2,765/day** (v4) | Do not ship |
| **P1 recommended** | Catalog: `preview_url`, or our pre-rendered sample for owned voices. Recipe tweaks: fixed per-language text ≤150 chars, rendered on the narration model and cached by (voice, settings, model, text) hash. | $2 / $16 / $82, plus about $5 per catalog re-render | About $1.08 per free user per month at a cap of 3/day | Legal check needed on caching or hotlinking `preview_url` (09 G3) |

The money saved by P1 is small: about 1.5% of the bill at any level. The reason to adopt P1 is that **it closes the abuse hole and makes previews deterministic**. It also settles the "which model renders the preview" question (09 G10): recipe previews render on the model the user will actually hear, so v4 for Expressive narration and Flash for calls.

---

## 8. Side table: theme songs and other media

Theme songs are not part of the totals above. The assumption is 0.2 songs per MAU per month at 60 s, i.e. 200 / 2,000 / 10,000 songs at the three levels [assumption].

| Engine | $ per 60 s song | Small | Medium | Large | Notes |
|---|---|---|---|---|---|
| fal `minimax/music-3` (today, a default option) | **$0.12** | $24 | $240 | $1,200 | [verified: https://fal.ai/models/minimax/music-3] |
| fal ACE-Step (today, alternative) | $0.012 | $2 | $24 | $120 | [verified: https://fal.ai/models/fal-ai/ace-step] |
| Eleven Music | $0.15 | $30 | $300 | $1,500 | Commercial company use is gated by the Music Terms and Scale or Business (04 §5.4) |

Notes:
- Today a theme song costs 1 app credit [code: /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:922,930,938]. That is $0.12 of provider cost per credit on `minimax/music-3`, the most expensive credit in the app. The billing README already suggests 25–50 credits [code: /home/andres/WebstormProjects/magic-worlds/docs/billing/README.md:147].
- Eleven SFX ($0.12/min) is not used today. It is out of scope.

---

## 9. Sensitivity

All rows are medium level (10k MAU), USD per month, base values from §5.

| Driver | Range tested | Effect | Comment |
|---|---|---|---|
| Chars per turn | 600 / 1,500 (base 1,000) | S0 narration 5,557 / 13,892; S1 narration 5,067 / 12,668 | Linear. The single biggest unknown with turns/MAU. **Measure first.** |
| Usage intensity (turns and call-min ×0.5 / ×2) | | S0 total 5,313 / 20,636; S1 4,565 / 18,202; S2 6,808 / 27,172 | Linear |
| Expressive share | paid users 50% (base) → 100% Expressive | S1 narration 8,445 → 10,713 (+27%) | Why Expressive must carry a price weight |
| ElevenLabs list prices revert to older levels | +25% | S1 total ≈ 11,384, above S0's 10,421 | 05 §10.6 recommends a +25% budget buffer |
| v4 promo extended or re-run ($0.022) | A narration 12,718 → 3,498 | v4 becomes cheaper than Flash list | Not plannable. Re-check the price monthly. |
| `previous_text` / `next_text` context billed | +30% chars on per-segment v4 | A narration → 16,534 | Measure with the `character-cost` header ([verified: https://elevenlabs.io/docs/api-reference/introduction.md] via 05) |
| Library voices with 2× multiplier | 20% of chars | +20% narration | Block multiplier voices in the importer |
| Call-heavy usage | ×3 call-minutes | K1 647 → 1,940; K4 2,760 → 8,280 | Calls stay small except on Speech Engine |
| Scribe RT billing basis | whole call → VAD-gated | K2 839 → 704 (−16%) | [unverified] which one applies |
| Groq short utterances | 3 s average (5 per min, 50 s billed) | +$0.0006/min, +$21 | Negligible |
| v4 generation speed | 4 s → 10 s per 1K chars | Non-Flash p99 at large: 9 → 22 (over Scale 15) | Concurrency only, not cost |
| MiniMax actual contract | Subscription points instead of PAYG | S0 could be lower | Unknown. S0 is list-based (§1). |
| Enterprise discount | e.g. −20% to −30% | S1 large 45.5k → 32–36k | Pure [unverified]; ask sales |

**Break-evens.**
- **Recommended mix vs MiniMax:** S1 narration stays below MiniMax while the Expressive share of all narration characters stays under about 47%. That is where the blended rate reaches $0.06/1K: 0.04 + s × (0.0824 − 0.04) = 0.06 gives s ≈ 0.47, including the 3% tag overhead. The base mix is 35%.
- **All-v4 vs MiniMax:** all-v4 narration costs about 37% more than MiniMax at every level.

---

## 10. Proposal: re-pricing the app's membership credits

### 10.1 What a credit costs us today

| Operation | Today's charge | Provider cost per credit, MiniMax | Provider cost per credit on ElevenLabs |
|---|---|---|---|
| Narration (`tts_generation`) | 1 credit per turn request | **$0.063** | $0.042 (Flash) to $0.087 (v4) |
| Calls (`voice_call`) | 1 credit per 10 s billed audio | **$0.0058** | $0.0039 (K1) · $0.0051 (K2/K3) · $0.0167 (Speech Engine, at 4.8 credits per wall-clock minute) |
| Preview | 0 (unmetered) | $0.012 per call | $0.008–0.016 |

What a credit earns (proposed prices):

| Source | Revenue per credit |
|---|---|
| Plus included | $9.99 ÷ 3,000 = $0.0033 |
| Pro included | $24.99 ÷ 15,000 = $0.0017 |
| PAYG packs | $0.033–0.05 |

Narration and calls are therefore priced about 11× apart per dollar of cost. Narration is under-priced by roughly 20–40× against included credits.

### 10.2 Proposed changes (numbers)

| # | Change | Today | Proposed | Effect |
|---|---|---|---|---|
| 1 | **Billing unit for narration** | 1 credit per turn, segment 0 only | **Per billed character**, reserved per segment and settled from `character-cost` | Fixes free re-synthesis (baseline issue 5) |
| 2 | **Standard narration** (Flash v2.5) | n/a | **1 credit per 400 chars**, rounded up per turn, minimum 1. A 1,000-char turn costs 3 credits. | Provider cost ≈ $0.0168 per credit. PAYG margin 49–66%. |
| 3 | **Expressive narration** (`eleven_v4`; also v3 / multilingual_v2) | n/a | **1 credit per 200 chars** (2× weight). A 1,000-char turn costs 5 credits. Plus and Pro only. | ≈ $0.0173 per credit. Same margin as Standard. |
| 4 | **Per-turn cap** | 32 segments × 3,000 chars = 96,000 | **2,500 chars per turn** (sum of segments, thoughts included), **≤ 12 segments, ≤ 1,200 chars per segment**. Overflow: narrate up to the cap and mark the rest as not narrated. | Worst-case turn: $5.76–7.68 → **$0.105 (Flash) / $0.216 (v4)** |
| 5 | **Daily narration cap** (Standard-equivalent chars; Expressive counts 2×) | 20 / 100 / 500 requests | **Free 1,000 (Standard only) · Plus 8,000 · Pro 20,000** | Cap exposure: **$1.26 / $10.08 / $25.20** a month (≈ 1× plan price), vs $25–52 / $126–260 / $630–1,298 today |
| 6 | **Calls** | 1 credit per 10 s audio; 10 min/day for all plans | Keep **1 credit per 10 s** on Flash / v4 Turbo pipelines. Daily minutes **Free 5 · Plus 10 · Pro 20**. If Speech Engine is adopted: **5 credits per wall-clock minute**. | Cap exposure on K1: $2.81 / $5.62 / $11.25. Speech Engine needs wall-clock billing because it charges for silence. |
| 7 | **Previews** (new `voice_preview` operation) | Unmetered | Catalog and pre-rendered previews: free, rate-limited (e.g. 60/min per user). Recipe previews: ≤150 chars of fixed text, **3/day free, then 1 credit each, ≤ 30/day**; cache hits are free. | Free-tier cap ≈ $1.08 per user per month |
| 8 | **Refunds and cache** | No refund; reuse checked before quota | Refund credits on provider failure. Charge 0 only on a confirmed cache hit. | Fixes baseline issues 5 and 7 |
| 9 | **Theme songs** (side note) | 1 credit | 10 credits on `minimax/music-3` or Eleven Music; 1–2 on ACE-Step | $0.012–0.015 per credit |

**Expected spend at base usage under the proposal.**

| Tier | Narration volume | Credits per month | Share of the daily pool |
|---|---|---|---|
| Free | 5 Standard turns | about 15 | negligible |
| Plus | 60 turns (half Expressive) | about 240 (8 a day) | 8% |
| Pro | 200 turns (half Expressive) | about 800 (27 a day) | 5% |

Credits therefore barely constrain typical users. **The character caps (row 5) bound the tail, and the 2× Expressive weight steers the mix.**

### 10.3 What the proposal does not fix

At base usage, voice cost per paid user is still about 41% of Plus and about 55% of Pro (§5.6, S1). That is before LLM, image and hosting cost.

The owner has three levers:
1. **Accept it.** Voice becomes a retention feature, provided overall margin holds.
2. **Tighten the paid caps** to Plus 4,000 and Pro 10,000 Standard-equivalent chars a day. Cap exposure falls to about 50% of the plan price, and heavy narrators buy PAYG credits. At $0.033–0.05 per credit, that is $0.083–0.125 per 1K Standard chars, a 2–3× markup.
3. **Raise the price of the voice-heavy tiers**, or sell Expressive narration as a separate add-on.

This note recommends **(1) with the balanced caps at launch**, followed by a re-tune after 30 days of `character-cost` telemetry per user per tier.

---

## 11. Recommendation

1. **Narration: option E.**
   - Flash v2.5 is the default for everyone. `eleven_v4` "Expressive" narration is opt-in for Plus and Pro at the 2× credit weight.
   - E costs **9% less than MiniMax** at base usage. All-v4 (A, B or D) costs 33–41% more.
   - Text to Dialogue (D) is not cheaper than per-segment v4. It costs about 3% more because retries are per turn. Choose between them on quality and per-voice settings (C6), not price.
2. **Calls: K1 (Flash v2.5 multi-context WebSocket + Groq whisper-large-v3) at launch, about 32% cheaper than today.**
   - Moving STT to Scribe v2 Realtime (K2) adds about $0.0056 per call-minute (+30% on calls, +2% on the total bill). Take it only for its latency.
   - v4 Turbo on the TTD socket (K3 or K3g) costs about the same as Flash. Decide on voice consistency and protocol risk (G14), not cost.
   - **Do not choose Speech Engine on cost.** It is 3.3–4.3× more expensive and bills wall-clock minutes.
3. **Previews: policy P1.** Free `preview_url` and pre-rendered samples, plus metered and cached recipe previews. Ship it with the per-user rate limit, which closes the $2k-a-day abuse hole.
4. **Plan:**
   - **Scale ($299)** at launch, with 2FA on and auto top-up;
   - a provider monthly spend cap at about 1.3× the forecast;
   - per-key `character_limit`s (05 §11.2, §11.5);
   - Startup Grant application filed;
   - **Enterprise talks by the 10k MAU level** (spend about $9k a month).
   Business adds nothing we need unless slots or seats run out.
5. **Concurrency:**
   - raise `TTS_GLOBAL_CONCURRENCY` toward 12 and make it cross-process;
   - raise `VOICE_GLOBAL_CONCURRENCY` toward 24 before the 50k level;
   - re-measure v4 generation speed in the spike.
6. **Membership:** adopt §10.2 rows 1–8 together with the backend migration. Narration character metering is a precondition of the switch, not a follow-up.
7. **Budget:**
   - plan on list prices plus 25%;
   - track `character-cost` per job;
   - reconcile against `/v1/user/subscription` daily (05 §11.5);
   - re-run this model after 30 days of telemetry.

---

## 12. Contradictions and gaps resolved here

| Id | Resolution |
|---|---|
| **C15** | Use the **list price** for v4 ($0.08/1K) and v4 Turbo ($0.04/1K). The promo ($0.022 / $0.011) is still displayed on 2026-10-12 as "72% off until Oct 12" [verified: https://elevenlabs.io/pricing/api], so it ends today. The membership re-tune in 08 §18 row 28 must not use $0.022. The plan "included v4 characters" (Pro 4.5M) are promo-based and will fall [derived]. |
| **C18** | Speech Engine is **$0.08/min** in both notes. "3.5×" (02) and "4×" (05) differ only in the DIY baseline: 40% vs 50% talk time, and Scribe vs Groq. The like-for-like multiple is **3.2–3.6×**; against keeping Groq it is **3.8–4.3×** (§4.2). |
| **G15 (cost-model half)** | One model with assumptions, prices, three levels, plan fit, concurrency, preview policy and membership re-pricing (this note). |
| 05 log #67 | Groq whisper-large-v3 at $0.111/h with a 10 s minimum is now **verified** on Groq's official docs [verified: https://console.groq.com/docs/speech-to-text]. |
| 04 open question | fal `minimax/music-3` costs **$0.002/s** [verified: https://fal.ai/models/minimax/music-3]. That is $0.12 per 60 s, 10× ACE-Step and 0.8× Eleven Music. |
| C6 (cost dimension only) | A ≈ B ≈ D within ±5%; C is half of A; E is 9% below MiniMax. Quality and architecture remain owner decisions. |
| C7 (cost dimension only) | Whether v4 runs on `/v1/text-to-speech` or only on TTD, the price is the same $0.08/1K. Concurrency counts in the non-Flash pool either way. |
| C11 (price dimension only) | The tier choice does not change spend at any modelled level (§6.1). Choose Scale for OEM, service accounts and concurrency. The Business slot conflict (660 vs 2,200) does not matter at our slot needs. |

---

## 13. Still open (needs the staging spike or telemetry)

| # | Item | Why it matters | How to close |
|---|---|---|---|
| 1 | Real usage: turns/MAU, chars/turn, segments/turn, call-minutes, previews per tier | Every total here scales linearly with them | Run the 08 §18 queries on a read replica; log billed chars per job |
| 2 | What MiniMax actually invoices us (PAYG vs subscription points) | The S0 baseline may be lower or higher | Owner checks the MiniMax console or invoices |
| 3 | Whether audio tags and `previous_text` / `next_text` are billed; `character-cost` vs `x-character-count` | ±3–30% on v4 narration | Spike: compare the header with `len(text)` |
| 4 | Speech Engine minute definition; Scribe Realtime billing basis | K4 and K2 costs | Spike: 10-minute call with 50% silence; read the usage analytics |
| 5 | v4 and Flash HTTP generation time per 1K chars | Concurrency fit at 50k MAU | Spike latency run (05 §3.7 Locust recipe) |
| 6 | Voice Design per-character rate; IVC creation fee | Admin cost (small) | Spike: one design call and one IVC; read `/v1/user/subscription` before and after |
| 7 | Whether PAYG overage on the API is exactly the list USD rate on each plan. The PAYG page says each plan has "its own credit-to-dollar rate" for UI credits. | Plan-fit arithmetic | First invoice, or ask support |
| 8 | Enterprise volume pricing | Large-level spend | Sales call by the 10k MAU level |
| 9 | Live Stripe prices for Plus and Pro (the README values are proposals) | Revenue ratios in §5.5–5.6 and §10 | api.auth Stripe catalog |
| 10 | Library voice multipliers in the chosen catalog | Up to +100% on affected voices | Importer reads `rate` / `fiat_rate` (03 §3) |
| 11 | Whether v4 pricing changes again after the promo | ±70% on Expressive narration | Monthly price check; this note's §2.1 |

---

## 14. Sources

### Official, read 2026-10-12 by this note
- https://elevenlabs.io/pricing/api: TTS, STT, Speech Engine, Music, SFX, dubbing prices; v4 promo; included amounts; Startup Grant.
- https://elevenlabs.io/pricing: plan fees, credits, concurrency, slots, PVC, seats, rollover, promos.
- https://elevenlabs.io/pricing/agents: agent minutes, burst pricing and burst concurrency, LLM billed separately.
- https://elevenlabs.io/docs/overview/models.md: concurrency per plan and model family, TTD session pool, "v4 available via the Text to Dialogue API", rule of thumb.
- https://elevenlabs.io/docs/overview/administration/pay-as-you-go.md: PAYG order of use, caps without 2FA, pause at $0, spend cap.
- https://elevenlabs.io/docs/help-center/product/voices/voice-design/how-much-does-voice-design-cost.md: Voice Design billing.
- https://elevenlabs.io/docs/help-center/technical/how-much-does-it-cost-to-use-the-api.md: API cost article (no figures).
- https://elevenlabs.io/docs/overview/capabilities/speech-engine.md: Speech Engine overview (no pricing details).
- https://elevenlabs.io/docs/changelog: entries to 2026-10-05, with no pricing change after the v4 launch (2026-09-28).
- https://platform.minimax.io/docs/pricing/overview: speech-2.8 turbo/hd, voice design and clone fees, ASR, music, audio subscriptions.
- https://console.groq.com/docs/speech-to-text: whisper-large-v3 $0.111/h, turbo $0.04/h, 10 s minimum.
- https://fal.ai/models/minimax/music-3: $0.002/s.
- https://fal.ai/models/fal-ai/ace-step: $0.0002/s.

### Official, verified 2026-10-12 by sibling notes (cited through them)
- https://elevenlabs.io/oem-terms (05 §6.9)
- https://elevenlabs.io/docs/overview/administration/billing.md (05 §2.1; library voices and slots)
- https://elevenlabs.io/docs/help-center/account/general/how-many-voice-slots-do-i-get-per-tier-and-how-can-i-increase-it (01 §18.1, 03 §8.2)
- https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-are-custom-rates-and-credit-multipliers.md (05 log #55)
- https://elevenlabs.io/docs/api-reference/introduction.md (`character-cost` header, 05 log #29)
- https://elevenlabs.io/docs/api-reference/voices/search (`preview_url` and voice fields, 03 §3 and §9)

### Secondary
- https://www.goodvibecode.com/text-to-speech/elevenlabs-api-pricing-explained (older $0.10 / $0.05 price levels, via 05 §2.3)

### Research notes (this folder)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/00_current_tts_review.md (§2 paths A–C; §3 issues 1, 5, 7)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/01_elevenlabs_tts_models_and_api.md (§1.1, §15.1, §18.1)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/02_elevenlabs_streaming_dialogue_realtime_agents.md (§10.2 Speech Engine, call options table and cost notes, §12)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/03_elevenlabs_voices_catalog_cloning_design.md (§7.1 design cost, §8.2 slots and ops)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/04_elevenlabs_other_products.md (§5 Eleven Music, Music Terms)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/05_elevenlabs_platform_pricing_limits_policy.md (§2, §3, §10, §11)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/08_voice_data_model_migration_surface.md (§18 row 28)
- /home/andres/WebstormProjects/magic-worlds/docs/voice_refactor/research/09_research_critic_gaps.md (G6, G10, G15, C6, C7, C11, C15, C18)

### Codebase (read-only)
- /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:909-914, 916-942
- /home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:2597-2637
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:155, 1425-1440
- /home/andres/PycharmProjects/magic-worlds-api/src/services/chat_segments.py:15-16
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/config.py:25-27, 34-35
- /home/andres/PycharmProjects/magic-worlds-api/src/services/tts_generation/engine.py:94
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/config.py:23-38
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/engine.py:58-63, 1945-1980
- /home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/quota.py:565-569
- /home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:20, 99-118
- /home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/registry.py:28-36, 58-95
- /home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/config.py:25
- /home/andres/WebstormProjects/magic-worlds/docs/billing/README.md:126-148
- /home/andres/WebstormProjects/magic-worlds/docs/membership-management-review.md:23-40
