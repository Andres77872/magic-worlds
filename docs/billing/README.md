# Billing and Pricing Schema for AI Roleplay Games

Research snapshot: 2026-06-11

**Status review 2026-10-14: historical pricing/schema proposal; purchase rollout WIP.** Current setup is [SETUP.md](SETUP.md); the local frontend purchase gate is absent/off despite backend opt-in. Provider/competitor prices and example cost calculations below remain the June snapshot and were not refreshed for this review. They are not current invoices, configured plan limits, or recommended purchase prices.

The runtime already has membership plans/operation limits, reservations, PAYG wallets/ledgers, admin plans/members/usage and api.auth-backed billing routes. Table names and endpoint shapes in the **proposed** sections below are design alternatives, not the existing schema. Root plan limits are configurable; use `/user/me` and the current catalog instead of this document's fixture table. The runtime operation set now includes `voice_preview`; the old eight-operation baseline is historical.

Remaining work: purchase sandbox/reconciliation acceptance (**BILL-01**), Patreon connect scope (**PAT-01**, TBD), durable assignment audit/admin monthly reset semantics (**MEMBER-01**), and current provider pricing/evaluation evidence (**DOC-04**). See [roadmap](../ROADMAP.md) and [membership review](../membership-management-review.md).

This document proposes a billing model for Magic Worlds-style AI roleplay, RPG, character, and world-generation products. It focuses on user-facing quotas, subscription and PAYG pricing, owner-side AI provider cost, and the schema needed to meter usage safely.

## Recommendation

Keep the current product shape: daily included credits, a PAYG wallet, per-operation limits, and per-operation concurrency. That maps well to AI RPG usage because it limits free-plan liability, makes paid plans understandable, and still lets high-intensity users buy more capacity.

Do not make every operation truly cost one internal credit. A chat turn, image, TTS clip, theme song, and premium-model narration have very different owner costs. Keep the UI simple, but make `credit_cost` configurable by operation, model tier, quality, and plan.

The owner should track two separate values for every AI operation:

- User charge: credits spent from the daily allowance or PAYG wallet.
- Owner cost: estimated provider cost from tokens, images, audio duration, characters, or GPU seconds.

The product should target positive margin at p95 usage, not only average usage. Free plans should be protected with daily caps, model restrictions, context-length budgets, and `max_in_flight`.

## App fit at the research baseline (2026-06-11)

The current profile and membership types already support the right core concepts:

- Daily credits: `MembershipCredits.max`, `used`, and `remaining`.
- PAYG balance: `MembershipPayg.balance`.
- Operation limits: `MembershipOperationLimit.daily_limit`, `used_today`, `max_in_flight`, `in_flight`, and `credit_cost`.
- Total available credits: `total_available_credits`.

Existing fixture values suggest this baseline:

| Tier | Daily credits | Chat | AI card | Image | Theme song | TTS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Free | 20 | 20/day, 1 in flight | 20/day, 1 in flight | 20/day, 2 in flight | 5/day, 1 in flight | 20/day, 1 in flight |
| Plus | 100 | 100/day, 2 in flight | 100/day, 2 in flight | 100/day, 4 in flight | 25/day, 2 in flight | 100/day, 2 in flight |
| Pro | 500 | 500/day, 4 in flight | 500/day, 4 in flight | 500/day, 8 in flight | 100/day, 4 in flight | 500/day, 4 in flight |

This is a good entitlement model. The main change needed before launch is making `credit_cost` realistic per operation instead of defaulting every operation to `1`.

## Market Patterns

| Product | Pattern | Useful lesson |
| --- | --- | --- |
| Friends & Fables | Free plan has up to 25 turns/day. Paid plans are $19.95, $29.95, and $39.95 monthly. Paid tiers advertise unlimited standard turns, higher player and context limits, and monthly bonus credits for premium narration or image generation. | Separate cheap "standard" narration from expensive "premium" models. Use context, party size, and mentions/message as tier gates. |
| NovelAI | Paid plans are $10, $15, and $25 monthly. Image generation uses Anlas, with monthly bonus Anlas by tier. Opus includes unlimited images only within quality and size constraints. | A separate generation currency works well for high-variance media costs. Unlimited claims need explicit technical limits. |

Competitor pricing changes frequently. Treat these as product-pattern references, not as a permanent pricing benchmark.

## Provider Cost Inputs

Prices below are public list prices from provider pages on the research date. They exclude payment processor fees, taxes, app-store fees, hosting, storage, moderation, observability, support, and failed-request overhead.

### Text Models

| Provider/model | Input | Cached input | Output | Notes |
| --- | ---: | ---: | ---: | --- |
| OpenAI GPT-5 nano | $0.050 / 1M tokens | $0.005 / 1M tokens | $0.400 / 1M tokens | Strong default for cheap background and low-stakes interactions. |
| OpenAI GPT-5 mini | $0.250 / 1M tokens | $0.025 / 1M tokens | $2.000 / 1M tokens | Good default for quality roleplay. |
| OpenAI GPT-5 | $1.250 / 1M tokens | $0.125 / 1M tokens | $10.000 / 1M tokens | Premium narration or hard reasoning. |
| OpenAI GPT-5 pro | $15.000 / 1M tokens | Not listed | $120.000 / 1M tokens | Too expensive for ordinary turns. |
| Anthropic Claude Haiku 4.5 | $0.80 / 1M tokens | $0.08 / 1M cache hits | $4 / 1M tokens | Useful mid-cost roleplay option. |
| Anthropic Claude Sonnet 4.5 | $3 / 1M tokens | $0.30 / 1M cache hits | $15 / 1M tokens | Premium narration, writing, and long context. |
| Anthropic Claude Opus 4.5 | $15 / 1M tokens | $1.50 / 1M cache hits | $75 / 1M tokens | Reserve for very high-value premium actions. |
| Gemini 2.5 Flash-Lite | $0.10 / 1M input tokens | Provider-specific | $0.40 / 1M output tokens | Very low-cost text option. |
| Gemini 2.5 Pro | $1.25 / 1M input tokens up to 200k context | Provider-specific | $10 / 1M output tokens up to 200k context | Premium long-context option. |
| Gemini 3 Pro | $2 / 1M input tokens up to 200k context | Provider-specific | $12 / 1M output tokens up to 200k context | Premium current-generation option. |

### Image, Audio, and GPU Work

| Provider/model | Public price signal | Billing implication |
| --- | ---: | --- |
| OpenAI GPT Image 1 Mini | Approx. $0.005 low, $0.011 medium, $0.042 high per 1024x1024 image | Charge more than one credit for medium/high images. |
| OpenAI GPT Image 1 | Approx. $0.011 low, $0.042 medium, $0.167 high per 1024x1024 image | High-quality image generation should be premium or multi-credit. |
| Gemini 2.5 Flash Image | $0.039 per generated image | A practical paid-tier image default. |
| Gemini 3 Pro image generation | $0.134 per generated image | Premium image generation. |
| OpenAI GPT-4o mini TTS | $0.60 / 1M input tokens and $12 / 1M output tokens | Meter by generated audio duration or characters, then reconcile to provider usage. |
| ElevenLabs Free | $0/month, 10k credits, about 10 minutes TTS, attribution required | Useful only for evaluation, not a commercial default. |
| ElevenLabs Starter | $5/month, 30k credits, about 30 minutes TTS | Commercial license included. |
| ElevenLabs Creator | $22/month list, 100k credits, about 100 minutes TTS | About $0.22/minute before overage and discounts. |
| ElevenLabs Pro | $99/month, 500k credits, about 500 minutes TTS | About $0.198/minute before overage and discounts. |
| Replicate public models | Public models can be free to run | Availability and terms vary by model. |
| Replicate private models | CPU $0.000100/sec, T4 $0.000225/sec, L40S $0.001400/sec, A100 40GB $0.001150/sec, H100 $0.003200/sec | Meter by successful prediction seconds; private model cold starts have minimum billing behavior. |

## Owner Cost Examples

Use these as planning estimates, not invoice predictions. Actual costs depend on prompt length, memory retrieval, retries, moderation, tool calls, model routing, cached context, and provider changes.

Formula:

```text
llm_cost =
  (input_tokens / 1_000_000 * input_price)
  + (cached_input_tokens / 1_000_000 * cached_input_price)
  + (output_tokens / 1_000_000 * output_price)
```

Example roleplay turn: 2,000 input tokens and 350 output tokens.

| Model | Estimated owner cost |
| --- | ---: |
| GPT-5 nano | $0.00024 |
| GPT-5 mini | $0.00120 |
| GPT-5 | $0.00600 |
| Claude Haiku 4.5 | $0.00300 |
| Claude Sonnet 4.5 | $0.01125 |
| Gemini 2.5 Flash-Lite | $0.00034 |
| Gemini 2.5 Pro | $0.00600 |

Long-context roleplay turn: 12,000 input tokens and 700 output tokens.

| Model | Estimated owner cost |
| --- | ---: |
| GPT-5 nano | $0.00088 |
| GPT-5 mini | $0.00440 |
| GPT-5 | $0.02200 |
| Claude Haiku 4.5 | $0.01240 |
| Claude Sonnet 4.5 | $0.04650 |
| Gemini 2.5 Flash-Lite | $0.00148 |
| Gemini 2.5 Pro | $0.02200 |

This shows why unlimited premium-model roleplay is risky. A user producing 500 long-context Sonnet turns/day could create about $23.25/day in model cost before images, TTS, infrastructure, or failed requests.

## Proposed User Pricing

These prices are a starting point for a web subscription product. They should be revisited after real usage telemetry.

| SKU | User price | Included usage | Target audience |
| --- | ---: | --- | --- |
| Free | $0 | 20 daily included credits, low-cost standard models, limited context, limited image quality, no purchased-credit requirement | Trial users and casual play |
| Plus | $9.99/month | 100 daily included credits, better context, faster queues, moderate image/TTS caps, PAYG enabled | Regular solo players |
| Pro | $24.99/month | 500 daily included credits, larger context, higher concurrency, premium model allowance, creator workflows | Heavy players and world builders |
| PAYG 100 | $5 one time | 100 non-expiring purchased credits | Small top-up |
| PAYG 250 | $10 one time | 250 non-expiring purchased credits | Better top-up value |
| PAYG 750 | $25 one time | 750 non-expiring purchased credits | Heavy generation |

Purchased-credit list price ranges from $0.033 to $0.05 per credit in these packs. Included daily credits are subscription entitlements and should expire at the reset boundary; purchased credits should only expire if the legal and product policy explicitly says so.

## Recommended Credit Costs

| Operation | Standard cost | Premium cost | Notes |
| --- | ---: | ---: | --- |
| Chat interaction | 1 credit | 3 to 8 credits | Premium means long context, premium model, or heavy memory retrieval. |
| AI card generation | 2 credits | 5 to 10 credits | Card generation often includes structured output, retries, and safety checks. |
| Image generation, low | 2 credits | 4 credits | Good free/Plus image mode. |
| Image generation, medium | 3 to 5 credits | 6 to 10 credits | Covers common $0.039 to $0.134 image costs at a reasonable margin. |
| Image generation, high | 8 to 15 credits | 15 to 25 credits | Necessary for GPT Image 1 high-quality costs. |
| TTS generation | 1 credit per short clip or minute | 3 to 8 credits per minute | Reconcile against provider characters/audio duration. |
| Theme song generation | 25 to 50 credits | 75+ credits | Do not price this as a normal 1-credit action unless owner cost is proven very low. |

For the current UI, keep "credits" as the user-visible unit, but make the backend return the operation-specific `credit_cost` in membership limits. If a simple "1 action = 1 credit" message is needed, use it only for standard chat.

## Quota Design

Use multiple quota dimensions because one number cannot protect the owner from all AI costs.

| Dimension | Why it matters |
| --- | --- |
| Daily included credits | Limits free and subscription liability. |
| Purchased PAYG credits | Monetizes bursts beyond the plan. |
| Operation daily limits | Prevents one expensive media type from consuming the entire system. |
| `max_in_flight` | Protects queues, GPUs, provider rate limits, and accidental parallel spending. |
| Context budget | Keeps long-running campaigns from silently becoming premium-cost sessions. |
| Model tier gates | Reserves expensive models for paid tiers or multi-credit premium actions. |
| Project/user spend caps | Stops abuse and unexpected provider bill spikes. |

Suggested free-plan hard caps:

- 20 standard chat/card/TTS credits per day.
- 2 in-flight image jobs maximum.
- No premium image quality.
- Shorter memory retrieval and context windows.
- No premium model routing.

Suggested paid-plan safeguards:

- Soft warnings at 70 percent of daily included usage.
- Hard daily cap for included credits, then spend PAYG only after explicit user consent.
- Per-user provider spend ceiling, for example daily and monthly internal owner-cost caps.
- Refund credits automatically for provider failures or moderation-blocked generations.

## Data Model

The schema should separate plan entitlements, credit ledger, provider usage, and payment processor state.

### Billing Ownership

AI roleplay products often bill either an individual player, a creator, a campaign project, or an app/service account. Model this explicitly so the same billing system can support solo play, shared campaigns, creator tools, and API-like services.

| Entity | Purpose |
| --- | --- |
| `billing_accounts` | Owns subscriptions, wallets, and invoices. Account type can be `user`, `project`, `organization`, or `service`. |
| `billing_account_members` | Maps users to billing accounts with roles such as `owner`, `admin`, `creator`, `player`, or `viewer`. |
| `billable_projects` | Campaigns, worlds, apps, bots, or services that consume credits under a billing account. |
| `project_budgets` | Optional daily/monthly credit and owner-cost ceilings per campaign, app, or service. |

Recommended ownership rules:

- Solo player action: charge the user's billing account.
- Shared campaign action: charge the campaign owner's billing account unless the request is explicitly player-funded.
- Creator/world-building action: charge the creator or project account.
- Public app/service action: charge the service account and enforce a per-user abuse budget inside that service.
- PAYG credits should belong to one billing account, not ambiguously to both a user and a project.

### `billing_plans`

| Column | Purpose |
| --- | --- |
| `plan_code` | Stable id such as `free`, `plus`, `pro`. |
| `display_name` | User-facing plan name. |
| `status` | `draft`, `active`, `retired`. |
| `monthly_price_cents` | Monthly subscription price. |
| `annual_price_cents` | Optional annual price. |
| `currency` | ISO currency, usually `USD`. |
| `daily_credit_allowance` | Included credits granted per daily reset. |
| `included_credit_period` | Usually `daily`, but can support `monthly`. |
| `trial_days` | Optional trial length. |
| `sort_order` | Plan display order. |
| `is_public` | Whether the plan appears in self-serve checkout. |

### `billing_plan_operation_limits`

| Column | Purpose |
| --- | --- |
| `plan_code` | Plan foreign key. |
| `operation_code` | `chat_interaction`, `ai_card_generation`, `image_generation`, `theme_song_generation`, `tts_generation`. |
| `daily_limit` | Operation-specific daily cap. |
| `monthly_limit` | Optional longer-term cap. |
| `max_in_flight` | Concurrent operation cap. |
| `credit_cost` | Standard credit cost for the operation. |
| `included_model_tier` | `economy`, `standard`, `premium`. |
| `premium_allowed` | Whether this plan can spend extra credits on premium mode. |
| `reset_timezone` | Reset boundary policy. |

### `credit_wallets`

| Column | Purpose |
| --- | --- |
| `user_id` | Wallet owner. |
| `balance` | Purchased or non-expiring balance available to spend. |
| `updated_at` | Last wallet mutation. |

### `credit_ledger_entries`

| Column | Purpose |
| --- | --- |
| `id` | Ledger entry id. |
| `user_id` | Entry owner. |
| `operation_code` | Operation tied to spend, if any. |
| `amount` | Positive for grant/refund/purchase, negative for spend/expiry. |
| `entry_type` | `grant`, `spend`, `refund`, `expire`, `adjust`, `purchase`. |
| `source` | `daily_allowance`, `subscription`, `payg`, `admin`, `refund`. |
| `expires_at` | Expiry for included or promotional credits. |
| `idempotency_key` | Prevents double charging. |
| `metadata_json` | Request, plan, SKU, or provider metadata. |
| `created_at` | Entry creation time. |

### `usage_meter_events`

| Column | Purpose |
| --- | --- |
| `id` | Usage event id. |
| `user_id` | User who initiated usage. |
| `project_hash` | Campaign/world/project id when available. |
| `operation_code` | Metered operation. |
| `provider` | OpenAI, Anthropic, Gemini, ElevenLabs, Replicate, etc. |
| `model` | Provider model id. |
| `input_tokens` | Prompt/input token count. |
| `cached_input_tokens` | Cached token count where supported. |
| `output_tokens` | Completion/output token count. |
| `image_count` | Generated images. |
| `audio_seconds` | Generated or processed audio duration. |
| `character_count` | TTS input characters where relevant. |
| `provider_cost_usd` | Estimated owner cost using the active price card. |
| `charged_credits` | Credits charged to the user. |
| `request_id` | Internal request/job id. |
| `idempotency_key` | Prevents duplicate usage events. |
| `created_at` | Event time. |

### `provider_price_cards`

| Column | Purpose |
| --- | --- |
| `provider` | Provider name. |
| `model` | Model or service id. |
| `unit` | `token`, `image`, `minute`, `second`, `character`. |
| `input_price_per_million` | Text/audio input price where relevant. |
| `cached_input_price_per_million` | Cached input price where relevant. |
| `output_price_per_million` | Output price where relevant. |
| `image_price` | Fixed image price where provider bills per image. |
| `audio_price` | Fixed audio/minute price where provider bills by duration. |
| `effective_from` | Versioning start date. |
| `source_url` | Provider pricing URL. |

### `subscriptions`

| Column | Purpose |
| --- | --- |
| `user_id` | Subscriber. |
| `plan_code` | Current plan. |
| `processor` | Stripe, Paddle, app store, etc. |
| `processor_customer_id` | Payment processor customer id. |
| `processor_subscription_id` | Payment processor subscription id. |
| `status` | `trialing`, `active`, `past_due`, `canceled`, `paused`. |
| `current_period_start` | Current billing period start. |
| `current_period_end` | Current billing period end. |
| `cancel_at_period_end` | Cancellation flag. |

### `purchases`

| Column | Purpose |
| --- | --- |
| `user_id` | Buyer. |
| `processor` | Payment processor. |
| `processor_payment_id` | Payment id. |
| `sku` | Credit pack SKU. |
| `credits_granted` | Purchased credits. |
| `gross_amount_cents` | Customer price. |
| `net_amount_cents` | Amount after processor/app-store fees when known. |
| `currency` | ISO currency. |
| `status` | `pending`, `paid`, `refunded`, `failed`. |

### `quota_counters`

| Column | Purpose |
| --- | --- |
| `user_id` | Counter owner. |
| `operation_code` | Operation. |
| `period_start` | Counter window start. |
| `period_end` | Counter window end. |
| `used` | Completed or charged operations. |
| `in_flight` | Reserved but unfinished operations. |

## Charging Flow

1. Receive operation request with an idempotency key.
2. Load membership, plan operation limit, daily credits, PAYG balance, and quota counters.
3. Check daily limit, available credits, model-tier permission, and `max_in_flight`.
4. Reserve the required credits and increment `in_flight`.
5. Execute the AI operation.
6. Record `usage_meter_events` with provider units and estimated owner cost.
7. Finalize the credit spend and decrement `in_flight`.
8. Refund reserved credits if the provider fails, the job is canceled, or the generation is blocked before value is delivered.

Daily included credits should be consumed before PAYG credits. PAYG spend after included credits should be explicit in the UI for paid media or premium-model actions.

## API Surface

The existing profile response can continue returning `membership`. Add billing-specific endpoints around it:

| Endpoint | Purpose |
| --- | --- |
| `GET /billing/plans` | Public plan catalog with operation limits and prices. |
| `GET /billing/usage` | Current-period usage, credit ledger summary, and owner-cost diagnostics for admins. |
| `POST /billing/checkout/subscription` | Start subscription checkout. |
| `POST /billing/checkout/credits` | Buy PAYG credit packs. |
| `POST /billing/webhooks/processor` | Payment processor webhook receiver. |
| `POST /billing/admin/price-cards` | Admin-only provider price card update. |

## Margin Model

Useful planning formulas:

```text
net_user_revenue =
  gross_user_revenue
  - payment_processor_fees
  - taxes_or_app_store_fees
  - refunds

gross_margin =
  net_user_revenue
  - provider_ai_cost
  - hosting_cost
  - storage_cost
  - observability_and_moderation_cost

credit_floor_usd =
  p95_operation_owner_cost / target_owner_cost_share
```

If the target owner cost share is 25 percent of net revenue, a credit should be priced at least 4x the p95 owner cost of the operation it buys. This is why high-quality image generation and theme-song generation need multi-credit pricing.

## Operational Controls

- Store provider price cards with effective dates so historical margin reports remain correct.
- Refresh provider price cards monthly and when changing model routing.
- Track p50, p90, and p95 owner cost per operation, tier, and model.
- Alert on negative-margin operations, unusual prompt length, repeated retries, and users whose owner cost exceeds plan revenue.
- Summarize or compact campaign memory before long-context prompts become the default.
- Route free traffic to low-cost models and reserve premium models for paid or multi-credit actions.
- Limit image size, quality, and count by tier.
- Require explicit user confirmation before spending PAYG credits on expensive premium operations.

## Open Questions

- Which payment processor and countries are in scope? Taxes, VAT, app-store fees, and refund rules can materially change margins.
- Should purchased credits legally expire, never expire, or expire only where allowed by terms?
- Should creators receive project-level quotas separate from player-level quotas?
- Should premium model routing be user-selected, automatic, or hidden behind "quality" controls?
- Should image and TTS usage be allowed on the free plan before abuse controls are in place?

## Sources

- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- Anthropic Claude pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- ElevenLabs pricing: https://elevenlabs.io/pricing
- Replicate pricing: https://replicate.com/pricing
- Friends & Fables pricing: https://www.fables.gg/pricing
- NovelAI pricing information on homepage: https://novelai.net
