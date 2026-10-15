# Clef Omni research and model fit

**Lifecycle: dated research/proposed contract, 2026-10-15.** Provider facts and external-source observations retain the research date; this cleanup did not browse, make provider calls or refresh measurements. Revalidate the alpha protocol/account behavior before implementation. This file is not release evidence; [00](00_current_status_and_findings.md) owns current status.

Research date: **2026-10-15**. Primary sources only, cited inline; evidence limits are in the [README](README.md#evidence-and-limits) and [00](00_current_status_and_findings.md). Facts below are provider documentation, not local inference measurements.

## 1. Why this is a different integration

The selected [Clef Omni model](https://openrouter.ai/cloudflare/clef-omni) is a decision model. It evaluates supplied state against typed questions and produces answer probabilities. The OpenRouter route is the [Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request), not a normal chat-completions request. Consequently, the old graph expecting generated JSON verdicts is the wrong transport abstraction.

A direct BFF adapter can construct trusted category questions, validate scores, and apply local policy to actual text, images, and audio. It does not need a generated rationale, moderator LLM profile, or api.magic_llm execution. Generation profiles now have a default-on application switch controlling invocation; that is separate from how the moderator runs.

## 2. Verified model facts

| Property | Evidence and implication |
|---|---|
| Exact requested identity | `cloudflare/clef-omni` on OpenRouter; retain this identity for now |
| Model family | Cloudflare's published model card describes a Qwen3-Omni-derived 30B-total/3B-active MoE decision backbone |
| Output behavior | Typed decisions, including binary probability, categorical choice, and ordered score; not ordinary generated prose |
| License | Cloudflare's [model card](https://huggingface.co/Cloudflare/clef-omni) labels the release Apache-2.0; hosted-service conditions are separate |
| Hosted interfaces | OpenRouter Decisions; Cloudflare Workers AI native execution; self-hosting has its own serving requirements |
| Modality research | Current official OpenRouter multimodal documentation lists text, images, audio, and video for Omni; older indexed descriptions said audio/video were coming soon |

Model architecture and output semantics are described by [Cloudflare's model card](https://huggingface.co/Cloudflare/clef-omni). For exact provider payloads and supported media shapes, use [04](04_openrouter_decisions_integration.md), not a generic Hugging Face chat-generation example.

## 3. Context and truncation need a contract test

[Workers AI's Omni reference](https://developers.cloudflare.com/workers-ai/models/clef-omni/) gives a roughly 64K-token context and describes text-state truncation when the remaining budget is exceeded. OpenRouter displays 65,536 tokens. Neither figure should become permission to send an entire novel or conversation to every request.

The OpenRouter guide's roughly 2K-text-token truncation warning names **Clef and Clef Flash**. Do not automatically attribute that exact limit to Omni. Test the selected endpoint with head/middle/tail sentinels and actual production-shaped category questions. Reject or explicitly partition inputs locally; never treat a silently omitted tail as inspected.

This review did not execute such a test. Maximum safe application input size therefore remains a release dependency, not a verified capability.

## 4. Latency evidence is inconsistent in scope

| Published source, accessed October 15 | Reported observation | How to use it |
|---|---|---|
| [Cloudflare October 9 changelog](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) | About 20 ms for text decisions; under 100 ms for image/audio; about 300 ms for one video example | Provider claim with insufficient deployment/workload detail for our SLO |
| [Cloudflare launch article](https://blog.cloudflare.com/clef-faster-cheaper-multimodal/) | About 130 ms text median, 150 ms images, hundreds of milliseconds audio, about 1.5 seconds for a video example | Different published timing; not interchangeable with the changelog |
| [OpenRouter live model page](https://openrouter.ai/cloudflare/clef-omni), opened during research | Displayed a 1.16-second aggregate P50; an indexed result showed 0.13 seconds | Dynamic/mixed-workload statistic; neither is a measured BFF text-only percentile |

These numbers do not establish an achievable 300 ms call-sentence deadline. Network location, request size, question count, cold connections, queueing, and measurement boundaries differ or are unstated. The correct conclusion is **benchmark before activation**, not either “20 ms guaranteed” or “the model cannot meet the budget.”

## 5. Pricing and workload cost

The reviewed [OpenRouter listing](https://openrouter.ai/cloudflare/clef-omni) advertised **$0.15 per million input tokens and $0 per million output tokens**. Recheck pricing when provisioning. Typed questions and context consume input, so “no generated prose” does not make a request free.

Illustrative arithmetic, excluding platform fees, taxes, retries, media, and other services:

~~~text
1,000 input tokens per check -> $0.00015 per check
1,000,000 such checks       -> $150
two such checks per turn   -> $300 per 1,000,000 turns
~~~

These are hypothetical input sizes, not measured tokenizer counts. Record provider-reported tokens and cost rather than charging users from a fixed estimate. More category questions, expanded lore, and per-sentence repeated context can dominate cost.

## 6. Route options for the same selected model

| Route | Fit | Trade-offs | Recommendation |
|---|---|---|---|
| BFF -> OpenRouter Decisions -> Cloudflare | Closest to the supplied model link; avoids api.magic_llm entirely | Alpha contract, router overhead, upstream endpoint availability | First integration candidate; validate exact contract and end-to-end latency |
| BFF -> Workers AI REST, or a dedicated Worker binding -> Omni | Same model family through its native hosting interface | Separate platform account/token, different request/envelope/media handling, independent cost/privacy review | Benchmark alternative if the first route misses SLOs; no automatic switch |
| BFF -> api.magic_llm -> old moderation graph | Current implementation | Generation plan/catalog/identity dependencies; generated-output JSON shape; violates new ownership direction | Retire from production moderation after direct integration is proven |
| Self-hosted Omni decision head | Can remove a remote provider hop and control serving | GPU capacity, warm replicas, batching, scaling, custom model code, upgrades and operations | Research contingency; no claim it is the lowest total-cost route |

The native Cloudflare endpoint is documented in its [Omni reference](https://developers.cloudflare.com/workers-ai/models/clef-omni/). Native field names are not OpenRouter field names. If that alternative is selected later, its adapter should return the same small internal result. The initial native backend integration needs only the OpenRouter client; no provider abstraction or second adapter is required.

## 7. What the model does not supply

Clef does not define this product's content policy, calibrate our chosen thresholds automatically, resolve account identity, approve publication, or implement bans. General decision benchmarks do not establish moderation recall for Spanish roleplay, adversarial prompts, real-person scenarios, or image categories.

The [calibration literature](https://arxiv.org/abs/1706.04599) supports checking whether confidence estimates match empirical outcomes; it is not evidence that Clef itself is miscalibrated. [XSTest](https://aclanthology.org/2024.naacl-long.301/) motivates a safe-but-sensitive false-positive test slice, not an off-the-shelf threshold for this application.

Model selection is settled by the owner. Domain accuracy, probability thresholds, hosted modality compatibility, and production latency remain **unverified** until [09](09_validation_and_benchmarks.md) is completed.
