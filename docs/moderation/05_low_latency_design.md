# Low latency for native text, image, and audio moderation

Date: **2026-10-15**. Proposed experiments, not measured deployment results. Optimization must preserve default-on profile controls and actual-media evaluation.

## 1. Keep the chain short

~~~text
existing authenticated operation -> governing profile flag (missing means on)
  -> enabled: native input text/media check -> existing generation provider
  -> enabled: hold actual output -> native output check -> existing release
  -> explicitly disabled: skip native checks for this operation and record it
~~~

The moderator directly calls Clef; no moderation graph, generation-profile execution, catalog request, or user-token resolution occurs inside it. Callers can read their normal generation profile's boolean without making the service dependent on that framework.

Check the actual media, not merely a prompt/transcript. Do not start protected generation before enabled input allows, or release text, image URLs, or audio frames while enabled output checks are pending.

## 2. Reuse the HTTP client

Create one dedicated HTTPX AsyncClient in backend lifespan, reuse connections, and close it at shutdown. Per-sentence/per-media clients add avoidable connection work. [HTTPX async guidance](https://www.python-httpx.org/async/).

Use bounded HTTP/1.1 keep-alive first. HTTP/2 is optional and needs negotiation/measurement; it is not automatically faster. [HTTPX HTTP/2](https://www.python-httpx.org/http2/).

Example exploratory pool values are 32 connections and 16 keep-alive connections, not capacity recommendations for unknown traffic. Separate moderation from generation/media downloads so large transfers do not consume its entire pool. Add a small concurrency bound if measurements require one, not a scheduling framework. [HTTPX resource limits](https://www.python-httpx.org/advanced/resource-limits/).

Keep redirects off and proxy behavior explicit.

## 3. One real deadline per check

HTTPX operation timeouts do not bound the whole check. Include local waiting, media preparation/encoding, upload, remote work, parsing, and policy mapping in one monotonic budget. Retries/partitions use its remaining time. [HTTPX timeout semantics](https://www.python-httpx.org/advanced/timeouts/).

Existing speech classifier limits are 300 ms per call sentence and 2 seconds for narration/preview/lab. G16 shows the current whole gate can exceed them through callbacks. These are text-path facts, **not audio or image latency guarantees**.

A trial text-input target could be P95 under 300 ms with a 500 ms cap; media targets require actual payload measurements. Record budgets explicitly rather than raising old caps silently or bypassing required checks.

## 4. Small state, real media

Ask enabled categories together for one bounded target. Use available relevant context and stable local questions; avoid separate category round trips, generated explanations, a summarizing model, or entire histories.

Fetch/decode/normalize media with existing trusted utilities before the decision. Measure preprocessing and base64/request-size overhead as well as remote latency. Keep the exact inspected candidate associated with the released content; unvalidated crops, aggressive image downscaling, or omitted audio tails can lose decisive evidence.

Protocol limits are in [04](04_openrouter_decisions_integration.md). Local operational bounds may be smaller. Reject unsupported input explicitly; never silently substitute text-only inspection for a required image/audio check.

## 5. Audio overlap and output holds

For validated call input, audio classification and existing STT can overlap where the processor contract permits. Generation still waits for both raw-audio and final/merged transcript allows. Keep one selected profile revision and cancel obsolete turn checks.

For output, pre-TTS text moderation avoids generating known blocked speech, but cannot approve the sound. Buffer complete bounded clips for non-live assets; measure added time to first audio.

Live calls need decodable windows that can finish before end_turn: the current look-ahead waits for playback, so withholding a whole long turn can stall production. Evaluate overlap/context, ordered release, final tails, backpressure, and cancellation. Separate provider-receipt timing from first approved release so the playback clock does not advance over held audio. Windows are not equivalent to full-turn review; do not send a remote request per PCM/network frame.

The same rule applies to Fish/ElevenLabs synthesis, previews, lab, narration, call audio, cached downloads, and music. [12](12_audio_image_coverage.md) details coverage.

Enabled generated-text streaming also needs a hold before existing callbacks. Start with whole candidates where interpretation requires them; use evaluated semantic units only when their limits are accepted. Keep current WS/SSE envelopes/heartbeats rather than redesigning the protocol.

## 6. Images and database locks

Perform image staging/checks outside completion write locks, then use the existing short lock/commit to register allowed assets. Treat every output candidate; do not check only the first image in a batch. The same common step must cover queued/webhook/poll and direct/BYOK results.

Do not introduce a review queue or lease framework. The narrow prepare/check/commit split is sufficient; cleanup losing/cancelled attempts and preserve existing terminal/idempotency rules.

## 7. Caching and disabled operations

No new distributed cache or generic single-flight layer is required. Warm pooling and small bounded inputs come first.

If reusing current speech caching or existing media review metadata, bind results to actual target/media content, context, purpose, and local model/question/threshold configuration. A text cache entry cannot authorize audio; a processed image cannot authorize a replaced file. Missing/invalid/unavailable results require recheck or withholding.

Only the saved governing flag can cause a disabled skip. Report it separately from allows and cache hits. Default-on profile migration and editor omissions are correctness requirements, not latency knobs.

## 8. Measured optimization only

Start with safe short text/image/audio fixtures and typical inputs from the actual backend region. Measure cold/warm connection, preparation, queue/remote/parse time, release hold, first visible text/audible audio, memory, P50/P95/P99, and failure share. Do not report only successful requests.

OpenRouter lists cold edge state, credit checks and fallbacks as possible overhead, not measured causes here. [Performance guidance](https://openrouter.ai/docs/guides/best-practices/latency-and-performance). Do not assume chat prompt caching or SSE applies to Decisions.

If the selected route misses measured requirements, compare the same model through Cloudflare only as a separately selected optimization. A second adapter, model fallback, self-hosting, or broad pipeline rewrite is not a prerequisite. An enabled surface that cannot meet its media budget remains unavailable; it does not become text-only or disabled.
