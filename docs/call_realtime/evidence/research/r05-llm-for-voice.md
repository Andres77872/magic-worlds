# R05: The LLM in a realtime voice loop

TTFT, model choice, prompting and context for spoken roleplay

- **Research date:** 2026-10-20
- **Scope:** The LLM stage of a cascaded voice agent (STT -> LLM -> TTS). Covers time to first token (TTFT), fast inference providers, model size, prompt caching, streaming into TTS, prompt design for speech and roleplay, speculative generation, fillers, tools, interruptions in history, long-call context, reasoning models, latency-aware routing, and guardrails kept off the critical path.
- **Method:** About 22 web searches (the shared search budget ran out partway through), then direct reads of primary sources: vendor docs, Artificial Analysis pages, arXiv abstracts, and framework docs (LiveKit, Pipecat). I also read the Magic Worlds backend code that drives the call LLM (`magic-worlds-api/src/services/voice_orchestration/*`, `src/routes/user/route_chat.py`, `src/agent_graphs/runtime/callbot_chat.v2.json`).
- **Labels:** Numbers from a vendor about its own product are marked **(vendor-reported)**. Sources older than 12 months are marked **(possibly stale)**. Claims that could not be confirmed against a primary source in the 2026-10-20 fact-check are marked **(unverified)**. Many model names below (GPT-6 Luna, Claude Haiku 5.5, Gemini 3.6/3.8 Flash, Qwen 3.8, and so on) are current as of October 2026, and the lineup changes every quarter.
- **Fact-check:** This note was fact-checked against primary sources on 2026-10-20. Corrections are inline and marked "*Fact-check:*"; the full log is at the end of the file.

---

## 0. TL;DR

1. **In a cascaded loop, the LLM sets time to first audio through its time to the first speakable clause**, which is TTFT (queue + prefill + any reasoning) plus the time to decode that first clause. Most 2026 budgets give the LLM 250 to 650 ms of a 0.8 to 1.5 s voice-to-voice target (ElevenLabs: LLM TTFT 250 ms P50 / 600 ms P95 within a ~680 / ~1,560 ms end-to-end budget; Daily: 650 ms TTFT inside a 1,500 ms P95 target).
2. **Reasoning tokens count as TTFT.** Artificial Analysis (AA) shows "max" reasoning variants of small models taking 90 s or more to the first answer token. Any thinking budget in the live loop is the biggest avoidable latency term. Turn it off or set it to the minimum, per provider (section 6).
3. **Fast silicon matters most for prefill-heavy, long-prompt turns and for throughput on the first sentence.** On AA's gpt-oss-120B page (10k-token prompts, P50 over 72 h), Cerebras reaches the first answer token in 1.49 s at about 1,737 tok/s, versus Groq at 4.91 s and about 473 tok/s. For first chunk alone, Baseten (0.19 s), Cerebras (0.34 s) and Together (0.46 s) lead. TTFT depends on the provider, model and prompt length, so measure from your own region.
4. **Prompt caching is the cheapest TTFT win for long roleplay prompts, but only with a byte-stable prefix.** Order the prompt as static persona, then rules, then lorebook core, then history, and put per-turn retrieved lore last. Magic Worlds currently appends per-turn lorebook activations into the **system prompt**, so any change in activated entries invalidates the cached prefix for the whole history (section 4.4).
5. **Stream into TTS at clause granularity for the first unit**, then at sentence granularity. Keep emotion tags atomic (Magic Worlds already does). Strip or convert tags for any TTS model that does not perform them, because ElevenLabs Flash v2.5, Turbo v2.5 (now deprecated in favor of Flash v2.5) and Multilingual v2 read bracketed tags aloud (practitioner report; ElevenLabs' own docs only say which models *do* perform tags).
6. **Preemptive (speculative) generation is now standard practice.** LiveKit enables it by default: LLM-only, discarded if the transcript changes, skipped for utterances over 10 s, capped at 3 retries. Research reports 0.48 to 0.5 s average savings for about 28% extra compute.
7. **Fillers are a double-edged tool.** They improve perceived wait in high-delay conditions, but generic ones lower perceived competence. In roleplay, use only character-consistent, non-lexical, pre-synthesized cues, and only when predicted latency is high.
8. **Interrupted turns must be stored as what the user heard**, and the model should know it was cut off. Pipecat commits only words played (word timestamps). OpenAI Realtime deletes the unplayed transcript. LiveKit's estimate can be off by a word or two, especially outside English.
9. **For long calls, cap history and summarize asynchronously with a cheaper model, in large steps** so the cached prefix survives (Pipecat defaults: summarize at 8k estimated tokens or 20 messages, off by default).
10. **Keep moderation off the critical path:** run input checks in parallel, and check output sentence N+1 while sentence N plays, gating audio *release* rather than synthesis. Magic Worlds currently awaits a 300 ms fail-closed classifier gate before each sentence goes to TTS, including the first, and its "check-ahead" path is not built.

---

## 1. Why TTFT dominates, and how to reason about it

### 1.1 Budgets published in 2026

| Source | Target | LLM share | Notes |
|---|---|---|---|
| ElevenLabs, "Voice agent latency optimization" (Jun 23 2026, updated Oct 9 2026) **(vendor-reported)** | ~680 ms P50 / ~1,560 ms P95 end-to-end time to first audio | LLM TTFT 250 ms P50 / 600 ms P95 | Capture + endpointing 120/280, STT finalization 60/150, network 60/160, TTS first audio 110/220, player 80/150. FAQ target: P50 < 800 ms, P95 < 1.5 s. [link](https://elevenlabs.io/blog/voice-agent-latency-optimization) |
| Daily, PhoneLLM Alpha 1 (Aug 27 2026) **(vendor-reported)** | ~1,500 ms P95 voice-to-voice | LLM TTFT 650 ms | Says GPT-5.6 Terra's P95 TTFT (~1,900 ms in fast mode) already exceeds the whole budget. [link](https://www.daily.co/blog/announcing-pipecat-phonellm-alpha-1/) |
| *Voice AI & Voice Agents primer* (Daily/Pipecat authors, updated June 2026) | ~1,500 ms voice-to-voice; 500 ms demonstrated with co-located models | "TTFT <= 600 ms is fast enough"; for reasoning models, time to first **non-thinking** token < ~700 ms | [link](https://voiceaiandvoiceagents.com/) |
| Inworld, "Fastest LLM inference APIs" (May 28 2026) **(vendor-reported)** | ~1 s turn | LLM TTFT < ~600 ms | Endpointing ~150 ms, TTS TTFT ~150 ms, playback ~50 ms. [link](https://inworld.ai/resources/fastest-llm-inference-api) |

Across vendors, the LLM gets roughly 30 to 45% of the budget. It is also the stage with the widest variance: P95/P50 ratios of 2 to 3x are common for hosted frontier APIs (table in 1.3).

### 1.2 The quantity that matters: time to first speakable unit

For a cascaded pipeline:

```
T_first_unit = network + queue + prefill(uncached prompt tokens)
             + reasoning_tokens / OTPS
             + tokens_in_first_clause / OTPS
```

- **Prefill** grows with uncached input. AA notes that longer prompts raise TTFT, and its default workload is 10k input tokens ([AA methodology v2.2.0, 2 Mar 2026](https://artificialanalysis.ai/methodology/performance-benchmarking)). Roleplay prompts with persona, lorebook and history often sit between 3k and 20k tokens, so prefill is not negligible. Caching removes most of it (section 4).
- **Reasoning tokens** dominate whenever they are present. At 125 tok/s, 300 hidden reasoning tokens cost 2.4 s, more than the whole budget.
- **Output speed (OTPS)** matters only for the first clause. A 12-token opening clause takes about 96 ms at 125 tok/s (GPT-6 Luna on AA) and about 7 ms at 1,737 tok/s (Cerebras gpt-oss-120B). OTPS matters a lot for prosody continuity (TTS must not starve), but little for first audio once the first-flush unit is short.
- OpenAI's latency guide makes the same point from the other side: generating fewer tokens is the biggest lever, while halving the *input* typically improves latency only 1 to 5%. That guide is undated and **possibly stale**; it predates 10k+ roleplay prompts and prefill-bound providers ([OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization)).

### 1.3 Measured TTFT for voice-relevant models

*Voice AI & Voice Agents* primer (updated June 2026; measured by Pipecat authors, not a neutral lab):

| Model | Median TTFT | P95 TTFT |
|---|---|---|
| GPT-4.1 | 536 ms | 1,771 ms |
| Gemini 2.5 Flash | 597 ms | 1,137 ms |
| Claude 4.5 Haiku | 637 ms | 1,615 ms |
| GPT-5.1 | 739 ms | 1,492 ms |
| Nemotron 3 Ultra (self-hosted) | 541 ms | 712 ms |

The primer's conclusions:

- Gemini 3 models are too slow for voice despite strong benchmark scores.
- Open models "outperform the closed models for latency-sensitive use cases" if you self-host or commit volume.
- Approximate LLM cost per 3-minute conversation with a 2,000-token system prompt: Gemini 2.5 Flash about $0.002, Claude 4.5 Haiku about $0.006, GPT-5.1 about $0.008, GPT-4.1 about $0.019.

*Fact-check:* the primer's table (confirmed verbatim) measures models that are now a generation or more behind the October 2026 lineup: GPT-4.1 and GPT-5.1 predate GPT-6 Luna, Claude 4.5 Haiku predates Haiku 5.5, and Gemini 2.5 Flash is now "access limited to past users" on the Gemini API (not deprecated, but not open to new projects). Treat it as evidence for the *shape* of the tail (P95 ≈ 2 to 3x P50 on hosted APIs), not as current numbers.

The pattern to note: **P95 is what users feel.** Hosted frontier APIs show P95 of 1.1 to 1.8 s even with a good P50. Self-hosted or dedicated capacity compresses the tail (Nemotron 712 ms P95).

AA leaderboard, lowest-latency models (accessed 2026-10-20; 10k-token prompt, P50, first chunk):

| Model | Latency | OTPS | AA Intelligence Index |
|---|---|---|---|
| Celeris-1 | 0.57 s | 1,533 | 6 |
| Nemotron 3.5 Lightning | 0.58 s | 312 | 13 |
| Nemotron 3 Nano (non-reasoning) | 0.59 s | 262 | 7 |
| gpt-oss-20b (high) | 0.74 s | 254 | 9 |
| GPT-6 Luna (non-reasoning) | 0.83 s | 128 | 18 |
| Llama 4 Scout | 0.83 s | 125 | 6 |
| Mistral Small 4 | 0.90 s | 196 | 11 |

Slow models in the same snapshot:

- Gemini 3.5 Flash-Lite: 7.53 s to first answer token at 454 tok/s.
- Claude Haiku 5.5 (low effort): 8.39 s.

([AA leaderboard](https://artificialanalysis.ai/leaderboards/models))

**How to read AA numbers for voice:**

- AA measures from a single GCP `us-central1-a` VM.
- It uses 10k-token prompts with fresh content, so there are no cache hits on the prefix.
- For reasoning models it reports time to first **answer** token.
- Its default per-model pages often show the **max** reasoning variant. For example, GPT-6 Luna (max) shows 89.84 s to first answer token on OpenAI, and Claude Haiku 5.5 (max) shows ~245 s.

These figures say nothing about the same model with thinking off ([AA GPT-6 Luna providers](https://artificialanalysis.ai/models/gpt-6-luna/providers), [AA Haiku 5.5 providers](https://artificialanalysis.ai/models/claude-haiku-5-5/providers), accessed 2026-10-20). **Use AA to shortlist, then benchmark your own prompt, region, cache state and thinking settings at P95.**

---

## 2. Fast inference providers (state as of October 2026)

### 2.1 Same model, different providers (AA, gpt-oss-120B high, 10k-token prompt)

| Provider | Output speed | First chunk | Time to first answer token | 500-token end-to-end | Notes |
|---|---|---|---|---|---|
| Cerebras | 1,737 t/s | 0.34 s | 1.49 s | 1.78 s | Highest blended price in set (~$0.39/M) |
| SambaNova | 705 t/s | 1.18 s | 4.00 s | 4.70 s | |
| Groq | 473 t/s | 0.68 s | 4.91 s | 5.95 s | |
| DeepInfra (Turbo) | 433 t/s | 0.58 s | 5.23 s | 6.34 s | |
| Azure | 381 t/s | 0.73 s | 5.98 s | 7.12 s | |
| Baseten | 235 t/s | **0.19 s** | n/a | 10.84 s | Best first chunk |
| Together AI | 195 t/s | 0.46 s | n/a | 13.27 s | |
| Google Vertex | 154 t/s | 0.81 s | n/a | 17.02 s | |

Source: [AA gpt-oss-120B providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers). Medians over 72 h; cache-hit rate data updated Sep 26 2026.

The gap between "first chunk" and "first answer token" here is gpt-oss's reasoning phase. With `reasoning: low` the gap shrinks, but it is not zero. **Raw-silicon providers (Cerebras, SambaNova, Groq) turn reasoning time into a smaller penalty, but disabling reasoning beats any hardware.**

### 2.2 Provider notes

- **Groq (GroqCloud)**, [models page](https://console.groq.com/docs/models), accessed 2026-10-20.
  - Production LLMs:
    - `llama-3.1-8b-instant` (560 t/s; pricing now "contact sales / Enterprise")
    - `llama-3.3-70b-versatile` (280 t/s; pricing now "contact sales / Enterprise")
    - `openai/gpt-oss-120b` (500 t/s, $0.15/$0.60 per M)
    - `openai/gpt-oss-20b` (1,000 t/s, $0.075/$0.30)
  - Preview LLMs: `qwen/qwen3.8-27b` (450 t/s, $0.80/$4.00), `minimaxai/minimax-m2.7`, `meta-models/muse-spark-open`.
  - Safety models: `meta-llama/llama-prompt-guard-2-22m/86m` and `openai/gpt-oss-safeguard-20b`, all useful for off-path moderation.
  - STT on Groq: `whisper-large-v3` costs $0.111/h; `whisper-large-v3-turbo` costs $0.04/h.
  - Prompt caching is automatic for gpt-oss models only: 50% discount, 2 h TTL ([Groq prompt caching](https://console.groq.com/docs/prompt-caching)).
  - **Business context:** Nvidia took a ~$20B non-exclusive license to Groq's technology in December 2025, and founder Jonathan Ross moved to Nvidia. GroqCloud continues ("GroqCloud will continue to operate without interruption", per Ross, quoted by w.media on 2026-01-05) and was reportedly raising $650M in mid-2026 to expand capacity (secondary sources only, **unverified**) ([w.media](https://w.media/nvidia-licenses-groqs-tech-for-ai-inference-in-us-20-billion-deal/), [Noqta, ~May 2026](https://noqta.tn/en/news/groq-650-million-neocloud-nvidia-inference-2026), [Voiceflow, 2026](https://www.voiceflow.com/blog/groq)). Model churn on Groq is high: preview models "may be discontinued at short notice."
- **Cerebras**, [models](https://inference-docs.cerebras.ai/models/overview), accessed 2026-10-20.
  - Shared inference: `gpt-oss-120b` (~3,000 t/s, vendor-reported) and `qwen-3.8-27b` (~1,850 t/s).
  - Prompt caching is on by default for all models, with **no discount**. It reduces TTFT and works in 128-token blocks, with a guaranteed 5 min TTL (up to 1 h). `prompt_cache_key` is an optional routing hint per conversation ([Cerebras prompt caching](https://inference-docs.cerebras.ai/capabilities/prompt-caching)).
  - The catalog is small (two shared-inference models on 2026-10-20). The claim that free and developer tiers are "not intended for production" is **(unverified)**: the current models page instead says shared inference runs on Free Trial and Pay as You Go tiers under rate limits, and points to **Dedicated Inference** for reserved capacity and production SLAs.
- **SambaNova:** curated open models; gpt-oss-120B at $0.22/$0.59 per M, with no cached-input rate ([SambaNova pricing](https://cloud.sambanova.ai/pricing), accessed 2026-10-20; the pricepertoken page originally cited no longer lists SambaNova prices). SN50 chip announced Feb 2026 (vendor claim).
- **Together / Fireworks / Baseten / DeepInfra:** GPU clouds with speculative decoding (Together ATLAS, Fireworks) and dedicated deployments. Inworld's survey positions them for "predictable persona output ... or long stable system prompts" and cites customer-reported TTFT drops (for example, Notion on Fireworks went from 2 s to 350 ms). This is a third-party vendor's survey of vendor claims ([Inworld, May 2026](https://inworld.ai/resources/fastest-llm-inference-api)).
- **Self-hosting:**
  - Daily's PhoneLLM, a fine-tune of NVIDIA Nemotron 3 Nano 30B-A3B (3.5B active parameters, BSD license), reports sub-100 ms single-request P95 TTFT on a B200 and about $0.0025 per agent-minute at 70% utilization (**vendor-reported**; [Daily, Aug 2026](https://www.daily.co/blog/announcing-pipecat-phonellm-alpha-1/)).
  - Cerebrium reports about 300 ms consistent TTFT for a self-hosted 8B model versus 0.7 to 1.5 s for hosted APIs (vendor blog; [Cerebrium](https://cerebrium.ai/resources/pipecat-voice-agent-gpu-deployment)).

### 2.3 Frontier first-party APIs (October 2026 lineup)

- **OpenAI** ([models](https://developers.openai.com/api/docs/models), accessed 2026-10-20):
  - GPT-6 Luna (`gpt-6-luna`, $0.10/$0.50 per M, reasoning `none` to `max`) is the "efficient" tier. AA shows the non-reasoning variant at 0.83 s and 128 t/s (10k prompt).
  - GPT-6.1 Sol ($2/$10) and GPT-6 Astra ($10/$50) are too slow and costly for the live loop. Sol and Astra have no `none` reasoning level (lowest is `low`); only Luna offers `none`. All three have a 1.05M context.
  - Realtime/voice models: GPT-Live 1, GPT-Realtime-2.1 (+ Mini), GPT-Realtime-2 (reasoning, tools), GPT-Realtime-1.5 (described as the best voice model for audio in/out), GPT-Realtime-Translate (speech-to-speech translation), and GPT-Realtime Mini (marked **deprecated**).
  - *Fact-check:* "GPT-5.6 Terra", which Daily benchmarks against, is no longer listed on OpenAI's current models page (only the specialized GPT-5.6 Cyber is). Treat Daily's Terra comparisons as a mid-2026 snapshot.
- **Anthropic** ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview), accessed 2026-10-20):
  - Claude Haiku 5.5 ("fastest", from $0.10/$0.50 per M, default effort `medium`, thinking on by default but **can be disabled at effort <= high**). *Fact-check addition:* the "from" price is a prompt-length tier. Prompts up to 100k tokens are billed at $0.10 input (cache read $0.01); prompts over 100k tokens jump to $0.50 input (cache read $0.05), so very long roleplay contexts cost 5x more per input token ([prompt caching pricing](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
  - Sonnet 5.5 ($2/$10, default effort `high`) cannot disable thinking. Its lowest setting is `between_tools`, accepted only at effort `high` or below.
  - Opus 5.5 ($4/$20, default effort `medium`) and Fable 5.1 ($10/$50) cannot disable thinking ("Adaptive (always on)"). Legacy Opus 5 does accept `thinking: disabled` at effort <= high.
  - **Fast mode** (`speed: "fast"`) raises output tokens per second up to 2.5x but explicitly **does not target TTFT** ("Speed benefits are focused on output tokens per second (OTPS), not time to first token"). It is GA on Opus 5.5 at $8/$40 per M, and research preview on Opus 5 and Opus 4.8. Switching between fast and standard speed also misses the prompt cache ([fast mode docs](https://platform.claude.com/docs/en/build-with-claude/fast-mode)).
  - *Fact-check addition:* on all 5.x models thinking `display` defaults to `"omitted"`, which Anthropic says gives faster time-to-first-text-token when streaming because thinking tokens are not streamed. Thinking time itself is still spent.
  - Current Claude models return 400 on non-default `temperature`/`top_p`, so sampling cannot be tuned for creative variety. Variety must come from prompting ([thinking docs](https://platform.claude.com/docs/en/build-with-claude/thinking)).
- **Google** ([thinking docs, updated 2026-10-14](https://ai.google.dev/gemini-api/docs/thinking)):
  - *Corrected:* `gemini-3.5-flash-lite` defaults to `thinking_level: minimal`, but `gemini-3.6-flash` defaults to **`medium`** (lowest level `minimal`). The newest Flash, **`gemini-3.8-flash`** (stable, the current "most capable Flash"), defaults to `medium` and its **lowest level is `low`**: it has no `minimal` level at all. `gemini-4-argon` (flagship) is the same (`low` lowest). **No fully-off level is documented** for any 3.x/4.x model. Only `gemini-2.5-flash-lite` is "off" by default. Google also lists `gemini-3.1-flash-lite` (stable) ([thinking docs](https://ai.google.dev/gemini-api/docs/thinking), [models](https://ai.google.dev/gemini-api/docs/models), updated 2026-10-14/19).
  - Daily calls Gemini 3.6 Flash an outlier that "produces many thinking tokens even at minimal thinking."
  - AA shows Gemini 3.5 Flash-Lite at 7.53 s to first answer token, and Gemini 3.8 Flash (high) at 26.19 s; AA does not list a latency for 3.8 Flash at `low`.
  - Treat current Gemini 3.x Flash models as unsuitable for the live loop until measured otherwise. Gemini 2.5 Flash with `thinkingBudget: 0` was the fast, cheap option, but *Fact-check:* the 2.5 models are now "access limited to past users" (not deprecated, no shutdown date, but closed to new projects), and the current thinking docs only document `thinking_level` (low/medium/high) for 2.5 Flash, not `thinkingBudget: 0` ([deprecations, updated 2026-10-20](https://ai.google.dev/gemini-api/docs/deprecations); [Google 2.5 Flash launch post, 2025](https://developers.googleblog.com/en/start-building-with-gemini-25-flash), **possibly stale**). Google recommends 3.5 Flash-Lite or 3.8 Flash for new projects.
  - *New since the original note (voice-to-voice, out of scope for the cascade but relevant to the omni comparison):* Google now ships **Gemini 3.8 Live** (`gemini-3.8-live`, stable, described as the default "for low-latency voice agents without reasoning delays") and Gemini 3.8 Live Extended Thinking; Gemini 3.1 Flash Live is now a legacy preview. Google also lists Gemini 3.8 Flash TTS / Flash-Lite TTS and Gemini 3.5 Transcribe (`gemini-3.5-transcribe-live`), which are cascade components from the same vendor.

### 2.4 Content policy is a selection criterion for 18+ roleplay

- OpenAI announced verified-adult erotica for ChatGPT in October 2025. Secondary trackers report it was paused indefinitely on March 26, 2026, with no update as of September 2026 (**unverified**; justainews itself says "reportedly") ([justainews, Sep 2026](https://justainews.com/companies/openai/adult-mode-in-chatgpt-explained-nsfw-erotica-porn-policy/); [aihaven tracker 2026](https://aihaven.com/ai-adult-content-policy-tracker/)). The December 2025 Model Spec treats erotica as "sensitive" rather than banned outright ([Model Spec 2025-12-18](https://model-spec.openai.com/2025-12-18.html)). **I could not verify current API terms for adult content from a primary 2026 source.** This is an open question.
- Open-weight models on fast-inference hosts, or self-hosted, give the most control over refusals. The host's own acceptable-use policy still applies, and safety-tuned open models (for example, gpt-oss) carry their own refusal behavior.
- **Recommendation:** add a refusal-rate and persona-break metric to any model evaluation for the call path, measured on in-domain 18+ fictional prompts.

---

## 3. Small vs large models for spoken roleplay

**Established practice:**

- Use the smallest model that holds persona and instructions over a long multi-turn call, with thinking off.
- Compensate with a better prompt, few-shot style examples, or fine-tuning (OpenAI latency guide, principle 1).
- ElevenLabs' current recommendations (vendor; [prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide)):
  - "General-purpose starting point": GLM 5.2 or GPT-6 Luna.
  - "Ultra-low latency" for triage and simple FAQs: DeepSeek Flash 4.1 or Gemini 3.5 Flash-Lite, weaker on complex tools.
  - Complex reasoning: Claude Sonnet 5.5, with higher latency.

**Evidence that small models are viable:**

- **MTVA-Bench** ([arXiv 2609.20152, Sep 17 2026](https://arxiv.org/abs/2609.20152)) isolates the LLM inside cascaded agents across 49 agents, 490 scenarios and 7 languages. In its seven-model study, six models pick the correct tool within 6.4 points of each other, but overall scores span 24.4 points. The gap comes from argument values, action ordering, rule compliance and **wording**. Conversation quality, not raw capability, separates models.
- **PhoneBench** (Daily): a 3.5B-active MoE fine-tune "performs on par with GPT 5.6 Terra" on phone-agent tasks at 94% lower cost and 1,300 ms faster P95 TTFT (**vendor-reported**).

**Trade-offs specific to roleplay:**

| Dimension | Small/fast (e.g., Luna none, Haiku 5.5 no-thinking, gpt-oss-20b, Qwen 3.8 27B, Nemotron-class) | Large (Sonnet/Opus-class, GPT-6.1 Sol) |
|---|---|---|
| TTFT / tail | 0.2 to 0.9 s typical, tighter P95 on dedicated silicon | 1 to 2+ s P95 even with thinking minimized; some cannot disable thinking |
| Persona depth, subtext, long-call consistency | Weaker; drift after many turns; more repetition | Stronger |
| Spoken style compliance (no markdown, short turns) | Good with explicit rules plus examples | Good, but tends to be wordier unless constrained |
| Spanish quality | Varies a lot by model, so evaluate | Generally strong |
| Content-policy fit for 18+ fiction | Open-weight gives most control | Provider-dependent; often restrictive |
| Cost per call-minute | Fractions of a cent | Several cents |

**Emerging pattern: talker + thinker.** A fast "talker" answers in the loop while a slower model works asynchronously on memory, plot, lore selection or safety, and injects results into the next turn. See section 9.

---

## 4. Prompt caching to cut TTFT on long roleplay prompts

### 4.1 Provider comparison (October 2026)

| Provider | Mechanism | Min cacheable | TTL | Read price | Write price | TTFT claim |
|---|---|---|---|---|---|---|
| **Anthropic** ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) | Explicit `cache_control` breakpoints (<= 4) or **automatic** top-level `cache_control`; 20-block lookback | 512 tokens (Haiku 5.5, Sonnet 5.5, Opus 5.5); 4,096 tokens (Haiku 4.5) | 5 min (refreshed on read) or 1 h | 0.1x base (0.05x Opus/Sonnet 5.5; 0.025x Fable/Mythos 5.1; Haiku 5.5 tiered by prompt length, $0.01/M up to 100k tokens) | 1.25x (5 min) / 2x (1 h) | "Improved time-to-first-token for long documents"; pre-warm with `max_tokens: 0` |
| **OpenAI** ([docs](https://developers.openai.com/api/docs/guides/prompt-caching)) | Automatic prefix; GPT-5.6+ implicit breakpoint at end of latest message plus up to 4 explicit; `prompt_cache_key` routing | 1,024 tokens (GPT-5.6+) | GPT-5.6+: 30 min default, 12 h option (Responses API); older: in-memory 5 to 10 min (<= 1 h) or 24 h | 0.1x on most GPT-5.6+ models, 0.05x on GPT-6.1 Sol ("up to 95%" off) | 1.25x (30 min) / 2.5x (12 h) | Reduces input processing time; no figure |
| **Google Gemini** ([docs, updated 2026-10-13](https://ai.google.dev/gemini-api/docs/caching)) | Implicit caching on all 2.5+ models; explicit caching via generateContent (not on Gemini 4 Argon+) | 4,096 (3.x Flash, 4 Argon); 2,048 (2.5) | n/a (implicit) | Discount passed on, percentage not stated | n/a | None stated |
| **Groq** ([docs](https://console.groq.com/docs/prompt-caching)) | Automatic, gpt-oss models only | 128 to 1,024 depending on model | ~2 h idle | 50% off | none | "Dramatically" lower latency (unquantified) |
| **Cerebras** ([docs](https://inference-docs.cerebras.ai/capabilities/prompt-caching)) | Automatic, all models; 128-token blocks | 128 | 5 min guaranteed, up to 1 h | No discount | none | Reduces TTFT (unquantified) |

### 4.2 Rules that matter for voice

- **Order: tools, then system, then messages.** On Anthropic, a change at one level invalidates that level and everything after it. Changing tool definitions invalidates everything. Changing thinking parameters or `effort` invalidates messages. Switching `speed` between fast and standard is a cache miss ([Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
- **Static first, dynamic last.** Put timestamps, per-turn retrieval and user-specific volatile data after the stable prefix. Append new turns rather than rewriting earlier ones. Keep tool definitions stable and restrict them with `tool_choice`/`allowed_tools` instead of changing the list ([OpenAI docs](https://developers.openai.com/api/docs/guides/prompt-caching)).
- **Anthropic's 20-block lookback.** If more than 20 content blocks are appended since the last cache write (for example, many short voice turns between breakpoint moves), the hit is missed. Automatic caching moves the breakpoint forward each request, which fits voice well.
- **Parallel requests do not share a cache entry until the first response begins** (Anthropic). A speculative request and a confirm request fired together will both pay full prefill unless the prefix was pre-warmed.
- **Pre-warm at call start.** Anthropic supports `max_tokens: 0` to load system and tools into cache before the first user turn; it is not allowed with streaming or thinking. OpenAI and Cerebras have no explicit pre-warm, but a short throwaway request with the same prefix and a stable `prompt_cache_key` achieves the same thing. Do it during the ring or greeting.
- **Routing affinity.** OpenAI caches live per machine. On pre-5.6 models a stable `prompt_cache_key` raises hit rates; OpenAI's guidance is to "aim for about 15 requests per minute in total across all prefixes using each key." *Fact-check:* on GPT-5.6+ models (which includes the GPT-6 family) the key is optional and mainly separates cache accounting by customer or user, so its hit-rate benefit there is smaller than this note originally implied. Daily recommends pinning a session to one cluster. One voice session per key is a natural fit.
- **TTL vs call rhythm.** Voice turns are seconds apart, so 5-minute TTLs are refreshed continuously during a call. Pauses longer than 5 minutes (a user on hold) or a call resumed later benefit from 1 h (Anthropic) or 30 min (OpenAI GPT-5.6+) TTLs.
- **Monitor hit rate** per turn: `cache_read_input_tokens` (Anthropic), `usage.input_tokens_details.cached_tokens` and `cache_write_tokens` (OpenAI), `usage.prompt_tokens_details.cached_tokens` (Groq, Cerebras), `usage.total_cached_tokens` (Gemini). Alert when the hit rate drops. Inworld cites 60 to 90% hit rates for stable-prompt consumer workloads (vendor).

### 4.3 Keeping the system prompt and lorebook stable

Recommended layout for a roleplay call:

1. `[tools, if any]`: frozen per call.
2. `system`: voice-output rules, persona card, user persona, and **call-scoped** stable lore ("always-on" entries). Frozen per call. Cache breakpoint here.
3. `messages`: the rolling summary block (changes rarely, in big steps), then verbatim history (append-only), then a late dynamic block: per-turn activated lore, time or scene state, and "you were interrupted" notes, placed right before or inside the newest user message.
4. Newest user message.

With this layout, a per-turn lorebook activation costs only the late dynamic block, and the system prompt plus history stay cached.

### 4.4 Magic Worlds observation

In `_resolve_callbot_chat_context` (`magic-worlds-api/src/routes/user/route_chat.py`, around lines 741 to 830), the callbot system prompt is rendered from the persona and card. Then `_append_chat_codex_context(...)` and **`append_lorebook_context(..., user_input=user_input)`** append both into `private_prompt`, which becomes the graph's single system message.

Because lorebook activation depends on the current `user_input` (trigger matching), **the system prompt can change from turn to turn**. That invalidates the cached prefix for the system prompt and the entire history on every provider above. The history passed in (`build_conversation_messages` in `conversation_execution.py`) is the whole chat, including earlier text-chat turns, with no window. A cache miss is therefore expensive in both prefill time and cost, and grows over the life of the chat.

Prompt caching and reasoning settings are not visible in the BFF voice path; they may live in the LLM profiles or the agent service (`api.magic_llm`). That needs verification.

---

## 5. Streaming tokens straight into TTS

**Established practice:**

- Stream LLM deltas. Buffer to a sentence boundary, synthesize each sentence while the next one generates, and use a persistent TTS WebSocket ([ElevenLabs latency blog](https://elevenlabs.io/blog/voice-agent-latency-optimization), [Pipecat TTS docs](https://docs.pipecat.ai/pipecat/learn/text-to-speech)).
- Pipecat's default is `TextAggregationMode.SENTENCE`, with a `TOKEN` mode for lower latency at the cost of transforms and prosody.
- **Make the first chunk small.** ElevenLabs advises smaller chunks early in an utterance because the first chunk is the one users wait on. A common approach is to flush the first unit at a clause boundary (comma, dash, or around 6 to 10 words), then switch to full sentences.
- Never split markup across TTS calls: pause tags, emotion tags, SSML. Magic Worlds' `SentenceBuffer` already holds `(…)` and `<#…#>` markers atomically, which fixed a split-marker bug. Its soft cap is 160 characters, and it has no clause-level first flush.
- Use TTS word timestamps where available (Cartesia, ElevenLabs, Rime) so interrupted context is exact (section 10).

**Pitfalls:**

- Sentence boundaries on abbreviations and decimals ("Dr.", "3.5"). Magic Worlds handles these.
- Text transforms that see a single token in token mode. Multi-token patterns will not match.
- Emitting the first sentence only at the end of a long run-on sentence. Soft caps exist to prevent this.
- Not cancelling the LLM stream on barge-in, which wastes tokens and keeps the provider connection busy.

---

## 6. Reasoning models in the voice loop

**Consensus:**

- Thinking before the first spoken token is incompatible with sub-second turn latency.
- The Pipecat primer: reasoning models are "too slow for the real-time conversation loop" but useful as asynchronous helpers (guardrails, memory, planning).
- Daily: thinking adds long delays, *but* tool accuracy can drop with thinking disabled. Temperature 0 with thinking off for PhoneLLM.

Per-provider knobs (October 2026):

| Provider / model | Lowest setting | Notes |
|---|---|---|
| Claude Haiku 5.5 | `thinking: {type: "disabled"}` at effort <= `high` | 400 at `xhigh`/`max`. With thinking off, the model can skip a needed tool call when JSON output is also requested ([thinking docs](https://platform.claude.com/docs/en/build-with-claude/thinking)). |
| Claude Sonnet 5.5 | `thinking: {type: "between_tools"}` (no up-front thinking) | `disabled` returns 400 |
| Claude Opus 5.5 / Fable 5.1 | Cannot disable | Not suitable for the live loop |
| OpenAI GPT-6 Luna | `reasoning: none` | AA non-reasoning variant: 0.83 s first chunk on a 10k prompt |
| OpenAI gpt-realtime-2 | `reasoning.effort: low` (start there); `minimal` for simple commands | Preambles generated by default ([voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting.md)) |
| Gemini 3.6 Flash / 3.5 Flash-Lite | `thinking_level: minimal` (cannot fully disable) | Defaults differ: 3.6 Flash defaults to `medium`, 3.5 Flash-Lite to `minimal`, so set it explicitly. 3.6 Flash still emits many thinking tokens per Daily; measure |
| Gemini 3.8 Flash / 4 Argon | `thinking_level: low` (no `minimal`, cannot disable) | Newest Gemini text models; worse fit for the live loop than 3.5 Flash-Lite |
| Gemini 2.5 Flash | `thinkingBudget: 0` | Google recommended 0 for lowest latency (2025, **possibly stale**). Now limited to past users; current docs show only `low`/`medium`/`high` levels |
| gpt-oss-20b/120b (Groq, Cerebras, …) | `reasoning_effort: low` | Reasoning is always present; fast silicon hides most of it |

Also note:

- Some voice platforms do not pass `thinkingBudget` through to the provider. A Vapi support thread shows users switching to Flash-Lite because of this ([Vapi support](https://support.vapi.ai/t/34036851/does-native-vapi-gemini-support-thinkingbudget-for-gemini-2-)).
- **Verify that the agent-graph service actually forwards the disable flag**, and check usage for reasoning tokens on every turn.
- Changing thinking or effort mid-conversation **invalidates the message cache** on Anthropic, so fix these per call. *Fact-check addition:* on models that support per-message effort (beta), an effort change carried in a `role: "system"` message inside `messages` leaves the cached prefix intact. With thinking disabled on Haiku 5.5, though, a per-message effort that differs from the level in effect returns a 400.

---

## 7. Prompt design for speech and spoken roleplay

### 7.1 Established rules (cross-vendor consensus)

From the [OpenAI voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting.md), the [ElevenLabs prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide) and the [Pipecat primer](https://voiceaiandvoiceagents.com/):

- **Structure:** short, labeled sections such as Role, Personality and Tone, Language, Verbosity, Unclear Audio, Guardrails. Start minimal and add rules only for behaviors that fail evals. Remove overlapping "always/never/must" rules and state priorities. Repeat the one or two most critical rules. *Fact-check:* ElevenLabs' wording is that "Repeating the most important 1-2 instructions twice in the prompt can help reinforce them"; placing the repeat at the end for recency is common practice, not an ElevenLabs statement.
- **Length per situation**, not "be concise": 1 to 2 sentences for direct answers, one clarifying question at a time, longer only when asked. (*Fact-check:* "2–3 sentences per turn" comes from OpenAI's `gpt-realtime-1.5` example prompt; for `gpt-realtime-2` OpenAI suggests length by task type instead.)
- **Plain spoken text only:** no markdown, lists, emoji, links or code. Tell the model its output is read aloud word for word.
- **Normalization:** the LLM writes numbers, money, dates, units and symbols as spoken words in the conversation's language. Alternatively, a post-LLM normalizer is more reliable but adds minor latency; ElevenLabs offers both as `text_normalisation_type: system_prompt | elevenlabs`. Phone numbers and IDs are read digit by digit. Without format examples in tool parameters, the spoken form leaks into tool arguments ("john at gmail dot com").
- **Transcription awareness:** say that the input comes from speech recognition and may contain errors. Answer the likely meaning and ask only if truly unclear. OpenAI found "unintelligible" works better than "inaudible."
- **Language pinning:** reply in the user's language. Do not switch on accents, fillers, names or isolated foreign words. Switch only on an explicit request or a substantive utterance. Keep fillers and preambles in the same language. This matters for English/Spanish code-switching users.
- **Variety:** an explicit anti-repetition rule, with sample phrases labeled "inspiration, not script."
- **Pacing:** TTS `speed` changes playback only. Ask for pacing in the prompt if a slower or faster delivery style is wanted.
- **Prompt size:** ElevenLabs says prompts over about 2,000 tokens increase latency and cost (vendor heuristic). Caching weakens that argument, but long prompts also dilute instruction following.

### 7.2 Roleplay-specific rules

- **No stage directions read aloud.** Text roleplay conventions such as `*smiles*` and `(laughs softly)` become literal speech. Forbid them and tell the model to carry the intent through word choice and rhythm. Also sanitize server-side as a fail-safe; Magic Worlds does both (`validate_spoken_text` and the D27 sanitize pipeline).
- **Emotion via TTS-native tags, only if the TTS performs them**, using its exact syntax and a whitelist:
  - **ElevenLabs:** audio tags in `[brackets]` (`[whispers]`, `[laughs]`, `[sighs]`, `[curious]`) are performed by Eleven v3/v4 and v4 Turbo (`eleven_v4_turbo` is the real-time option, ~100 ms median inference per ElevenLabs; ElevenLabs recommends v4 over v3). **Flash v2.5, Turbo v2.5 and Multilingual v2 read bracketed words aloud** (stated by micdrop.dev; the ElevenLabs help page does not mention these models either way). *Fact-check:* `eleven_turbo_v2_5` is now **deprecated**; ElevenLabs says it is functionally equivalent to `eleven_flash_v2_5` with higher latency and recommends Flash. ElevenLabs' models page lists `eleven_v4_turbo` and `eleven_v3_conversational` (~280 ms) under the **Text-to-Dialogue WebSocket**, and Pipecat routes v3/v4 to `ElevenLabsDialogueTTSService` (needs Text-to-Dialogue WebSocket workspace access); I found no statement that the standard stream-input WebSocket accepts v3/v4. Pipecat also notes tags come back as spoken characters in the alignment, so they reach LLM context unless filtered ([ElevenLabs help](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4), [Pipecat ElevenLabs](https://docs.pipecat.ai/server/services/tts/elevenlabs)).
  - Practical report ([micdrop.dev, Sep 30 2026](https://micdrop.dev/blog/elevenlabs-audio-tags-voice-agent)):
    - List the allowed tags in the prompt, limit them to 1 to 3 per answer, and forbid spoken words inside brackets.
    - Voice-describing tags are more reliable than sound effects.
    - An ellipsis gives a pause.
    - Strip tags before storing or searching transcripts, and hide half-streamed tags in the UI.
    - Use a streaming transform that strips tags for a fallback TTS.
    - Tags lengthen answers. A tagged greeting took about 11 s to synthesize on v4 Turbo versus 6.3 s untagged on Flash v2.5 (single anecdotal test).
  - **Fish Audio:** S2 uses free-form `[bracket]` cues, with emotion tags at the start of a sentence. **S1 `(parenthesis)` syntax is deprecated. S1 retires December 31, 2026, after which `s1` requests are served by `s2.1-pro`, and the API does not convert parentheses to brackets** ([Fish emotion control](https://docs.fish.audio/developer-guide/best-practices/emotion-control), [Fish models overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview)).
  - Pipecat: tags reach the LLM context as text unless filtered, so the model keeps imitating them after a fallback.
- **Interjection density cap** ("at most one or two per reply"). Without a cap, voices overact.
- **First-person only; never speak for the user.** Persona drift is a known failure on small models. Repeat the rule at the end of the prompt.
- **Backchannels:** treat "mm-hm / yeah / okay" as continuers, not new turns. This helps only when the turn-taking layer does not already filter them.
- **Interrupted lines:** tell the model its earlier lines may end where it was cut off, and not to repeat them (see section 10).

### 7.3 Magic Worlds observation

The callbot prompt variants (`callbot_chat.v2.json`: default, anthropic, openai and google families) already implement most of 7.1 and 7.2: spoken-only output, 1 to 3 sentences, normalization, STT-error awareness, backchannels, the interruption rule, language mirroring, variety, and a final "Remember" line.

Two gaps to check:

1. **The interjection syntax is parenthesized `(laughs)` plus `<#0.5#>`** (MiniMax-style or Fish S1-style). This must match the active TTS profile. Fish S1 parentheses stop being interpreted when S1 retires on December 31, 2026. ElevenLabs Flash would read any brackets aloud. The code gates interjections per call profile (D27, "forced off while the call profile has no audio tags"), so verify the mapping per TTS model.
2. **Language pinning is "reply in the language they are speaking."** OpenAI's guidance is stricter: do not switch on isolated words or backchannels, and ask if unsure. Spanish/English users with names or loanwords may trigger flips.

---

## 8. Speculative / preemptive generation on interim transcripts

**Established in frameworks:**

- **LiveKit Agents** ([speech docs](https://docs.livekit.io/agents/build/speech/), [turn tuning](https://docs.livekit.io/agents/logic/turns/tuning.md), rendered 2026-10-20):
  - `preemptive_generation` is enabled by default. It starts the LLM when a final transcript arrives, before end of turn is confirmed.
  - Only the LLM runs; `preemptive_tts` defaults to off.
  - The response is discarded and regenerated if chat context or tools change in `on_user_turn_completed`.
  - Skipped when the user spoke longer than `max_speech_duration` (10 s), because long utterances change more.
  - `max_retries` = 3 per turn.
  - LiveKit says it "doesn't always reduce latency," costs extra tokens, and should be disabled for dictation or storytelling.
  - Community reports: it never triggers if the STT plugin does not emit preflight or stable-partial events, and a bug produced two LLM requests per turn when context changed ([community](https://community.livekit.io/t/livekit-preemptive-generation-not-triggering-with-current-stt-model-missing-preflight-transcript-events/1582), [GitHub #4219](https://github.com/livekit/agents/issues/4219)).
- **ElevenLabs:** feed stable STT partials into the LLM and revise if the final transcript differs, hiding the endpointing delay behind LLM work ([blog](https://elevenlabs.io/blog/voice-agent-latency-optimization)).

**Research (2025-2026):**

| Work | Idea | Reported result |
|---|---|---|
| Endpoint Anticipation ([arXiv 2606.13450](https://arxiv.org/abs/2606.13450), Jun 2026, Interspeech 2026) | Speech model forecasts end of turn up to 2.56 s ahead; LLM and TTS run speculatively on partial context; release when the endpoint is confirmed | **-505 ms** average latency with Unmute, **+28.4%** speculative compute |
| Voice-Light ([arXiv 2609.20995](https://arxiv.org/abs/2609.20995), Sep 2026) | Private speculative candidates (the "after short pauses" trigger is not stated in the abstract, **unverified**); any lexical change invalidates; reversible playback; browser acks make played audio the authoritative history | Median 758 ms final-VAD to first server audio over 36 turns (case study) |
| RelayS2S ([arXiv 2603.23346](https://arxiv.org/abs/2603.23346), v2 Sep 2026, EMNLP Findings) | Duplex S2S model drafts a short prefix, verifier commits, cascade continues | P90 first chunk 1,006 ms to **81 ms** (synthetic); **-479 ms** average on real dialogues; 99% of cascade text quality |
| Predictive ASR ([arXiv 2305.13794](https://arxiv.org/abs/2305.13794), Interspeech 2023, **possibly stale**) | Predict the full utterance from a partial one and prefetch the response | Foundational |
| Speculative tool execution ([arXiv 2610.07641](https://arxiv.org/abs/2610.07641), Oct 2026) | Predict tool calls from partial ASR and run them early | Median time to first audio 5.79 s to 4.60 s (on-device) |

**Design rules:**

1. Speculate only on transcript text that is likely to be final.
2. Key each speculation to a normalized transcript hash. On any lexical change, cancel and restart.
3. Never persist or bill a speculative turn as a user turn until the end of turn is confirmed.
4. Do not start TTS until confirmed, unless you accept wasted TTS characters (expensive on per-character TTS).
5. Cap retries.
6. Skip speculation for long utterances.
7. Rely on prefix caching so repeated attempts pay little prefill.

**Applicability to batch STT:** Magic Worlds' Groq whisper-large-v3 path produces no partials. The applicable form is "speculate on the segment transcript as soon as it returns, while the server-side end-of-turn hangover is still counting." Alternatively, cut the browser VAD at a short silence (~200 to 300 ms) to fire STT and the LLM speculatively, and confirm at the full silence threshold. If the user resumes, discard and merge the segments. True partial-based speculation needs a streaming STT.

---

## 9. Latency masking, routing and the talker/thinker split

### 9.1 Fillers and acknowledgements

Evidence is mixed:

- In a VR study of LLM agents (CUI '25), latency **above 4 s degraded quality of experience**, and natural conversational fillers improved perceived response time, especially at high delay ([arXiv 2507.22352](https://arxiv.org/abs/2507.22352), Jul 2025).
- Related work reports that voice agents using conversational fillers were perceived as **less intelligent**. *Contextualized* fillers beat generic ones on perceived competence. Gestural fillers beat verbal ones in embodied settings ([arXiv 2508.11781](https://arxiv.org/pdf/2508.11781), Aug 2025). *Fact-check:* these three findings are prior studies **cited in that paper's related-work section** (Jeong et al. on "less intelligent", Boukaram et al. on contextualized vs generic, Kum and Lee on gestural vs verbal), not the paper's own results. Its own VR study (24 participants) found that a multimodal behavioral filler improved perceived response time, presence, humanlikeness and naturalness, and found **no significant filler-type differences** on perceived intelligence or competence.
- OpenAI: avoid "Let me think" style filler. Use one short preamble only before substantive reasoning or tool use, and skip it for direct answers. For a non-reasoning model, a consistent short line before a tool call can mask latency.

**When fillers backfire:**

- The real answer would have arrived within about 700 ms anyway.
- They repeat ("Hmm..." every turn).
- They clash with the following content ("Oh, interesting!" then bad news).
- They are in the wrong language.
- The LLM then repeats its own acknowledgement ("Mm... Mm, well...").
- They make barge-in ambiguous.

**Roleplay-safe pattern:**

- Use pre-synthesized, per-voice, non-lexical cues (breath, "mm", a soft hum).
- Trigger only when predicted time to first audio exceeds a threshold, such as 1.2 s, or when a slow lookup or summarization is pending.
- Rotate the cues.
- Record them in history as non-lexical (or not at all), so the LLM does not duplicate them.
- Never use them on a first-turn greeting.

### 9.2 Tool calls in voice (future-proofing; the Magic Worlds call has no tools today)

From the [Pipecat function-calling docs](https://docs.pipecat.ai/pipecat/learn/function-calling) and the [primer](https://voiceaiandvoiceagents.com/):

- Each tool call adds a second inference round trip and cannot be streamed. Tool *definitions* add latency even when no tool is called.
- Use async tools (`cancel_on_interruption=False`). Late results are injected as a developer message that triggers a new inference.
- Use per-tool timeouts (`timeout_secs` in `@tool_options`, overriding the global `function_call_timeout_secs`) and speak a filler from the handler (`TTSSpeakFrame`).
- Disable parallel tool execution unless needed (Pipecat: `run_in_parallel=False` on the LLM service; default `True`. This controls whether calls *execute* concurrently, not whether the model emits several).
- Every call needs a matching result in context. (Pipecat describes calls as "in progress" or "settled as cancelled"; the exact `IN_PROGRESS`/`CANCELLED` placeholder names are **unverified** on the current docs page.)
- **Say/do consistency:** models "claim actions they never performed" (Daily). Only confirm after success (OpenAI).
- Run long work as background tasks and inject results later.

### 9.3 Latency-aware routing

**Fast model first, escalate:**

- *Talker-Reasoner* ([arXiv 2410.08328](https://arxiv.org/abs/2410.08328), 2024, **possibly stale** but foundational): the fast talker converses while the slow reasoner plans and updates state.
- *KAME* (Sakana, [arXiv 2510.02327](https://arxiv.org/abs/2510.02327), ICASSP 2026): a fast front end speaks while a back-end LLM's text is injected in real time, approaching cascade correctness at front-end latency.
- *RelayS2S* (above): a fast prefix from one model, the continuation from a stronger one.

**For text cascades:**

- Route by turn type. Small talk and backchannel-heavy turns go to the fast model. A request for a long story, a plot pivot or memory recall goes to a larger model, preceded by a short in-character holding line.
- Run the "thinker" asynchronously after each turn to update a structured scene and memory block. This changes only the late dynamic block, keeping the cache intact.

**Hedged requests and TTFT timeouts:**

- If no first token arrives within a deadline (for example, P90 for that provider), fire a backup to a second provider and use whichever streams first. Cancel the loser.
- This costs duplicate prefill on hedged turns and loses cache affinity on the backup. Use it only for the tail.
- Anthropic's fast-to-standard fallback misses the cache by design.

### 9.4 Other TTFT levers

- **Co-locate** the LLM endpoint region with the backend. Public-internet round trips are 20 to 200 ms (ElevenLabs).
- Keep HTTP/2 connections warm.
- Avoid per-turn catalog or profile lookups on the critical path. Magic Worlds caches the catalog for 60 s and warms moderation and TTS sockets during STT.
- **Generate fewer tokens:** cap `max_tokens` for calls (for example, 150 to 250) as a backstop for the 1 to 3 sentence rule.
- **Don't default to an LLM** for constrained outputs such as the greeting, goodbye, error lines and "are you still there?". Pre-generate them per character and voice (OpenAI principle 7).

---

## 10. Interruptions in conversation history

**Practice across frameworks:**

- **OpenAI Realtime:** `conversation.item.truncate` with `audio_end_ms` cuts the audio and **removes the transcript of the unplayed portion**. WebRTC and SIP do this automatically; WebSocket clients must send it ([realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations)).
- **Pipecat:** the context commits only text whose audio actually played: the output transport pushes `TTSTextFrame`s in sync with playback, and "Text that never played never reaches the assistant context aggregator." The placement requirement (aggregator after `transport.output()`) is standard in Pipecat examples but is **unverified** on the current interruptions page. `on_assistant_turn_stopped` exposes `interrupted`. No explicit marker is added to the text ([interruptions](https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md)).
- **LiveKit:** a `TranscriptSynchronizer` estimates the played text and can be off by a word or two, especially for non-English speech. Unspoken text has been reported to leak into context when an interruption lands before TTS starts. Hang-ups mid-speech can drop the partial message ([community thread](https://community.livekit.io/t/chat-context-contains-text-that-wasnt-spoken-due-to-interruption/165)).
- **Voice-Light:** browser playback acknowledgements make *rendered audio* the authoritative durable history, and cancelled audio never enters history.
- **False interruptions:**
  - LiveKit resumes interrupted speech if no transcript arrives within 2.0 s (`resume_false_interruption=True`). Its adaptive mode filters backchannels with an audio model.
  - Pipecat offers `MinWordsUserTurnStartStrategy(min_words=3)` and Krisp-based backchannel filtering.

**Recommended representation:**

1. Store the assistant turn truncated to the heard prefix, at word granularity (not just sentence granularity) when timestamps exist.
2. Tell the model it was interrupted. The prompt rule alone ("your earlier lines may stop where you were interrupted") is good. An explicit per-turn signal is better: a short note in the late dynamic block ("You were cut off after: '…'. The caller then said: …"). Do not put a marker inside the assistant text, because models imitate markers in later outputs.
3. Drop turns the user never heard (interrupted before any audio). Optionally keep a note that the character was about to speak, so it does not repeat the same opener.
4. Never let tags or markers from the history leak into what is spoken.

**Magic Worlds status:**

- PD-1/R1-BE-02 truncation stores the heard prefix of a completed reply. It also stores a mid-stream heard prefix as completed (`call_turn_truncation.py`, `engine.py` barge-in paths), and the callbot prompt has rule 8 about interrupted lines.
- `build_conversation_messages` keeps only `completed` rows, so `interrupted` rows not converted to a heard prefix are invisible to the model. Confirm that every barge-in with played audio results in a stored heard prefix.

---

## 11. Context management for long calls

- **Limits:** OpenAI Realtime (gpt-realtime-2) has a 128k context, which OpenAI estimates at about 1 to 2 hours of dense two-way audio, and a 60-minute maximum session. In text cascades the context is cheaper (text only), but long contexts still raise prefill time on cache misses, cost, and instruction drift. The Pipecat primer notes that instruction following declines as context grows.
- **Summarization (Pipecat, [docs](https://docs.pipecat.ai/pipecat/fundamentals/context-summarization.md)):**
  - Off by default.
  - Triggers at about 8,000 estimated tokens or 20 new messages.
  - Keeps `messages[0]` (the system message) and the last N messages verbatim (`min_messages_after_summary`, default 4). Thresholds are `max_context_tokens` and `max_unsummarized_messages`; enable with `enable_auto_context_summarization=True`.
  - Never splits function call/result pairs.
  - Runs in the background without blocking.
  - Can use a **dedicated cheaper LLM**.
- **Structure over dumps:** OpenAI recommends a structured long-context block: current state, authoritative sources with status and time, background marked as stale, and rules. For roleplay, that maps to scene state, relationship state, established facts and promises, open threads, and recent emotional tone.
- **Cache-compatible summarization:** summarize in large steps, for example every 20 to 30 turns, not every turn. Place the summary immediately after the static system prompt as its own block, and keep verbatim history append-only between summaries. Each re-summarization costs one cache miss on the history, which is acceptable if it is rare.
- **Rolling memory beyond the call:** persist a post-call summary and extracted facts into the chat's memory or lorebook for the next call or text chat. Do this off the critical path, with a cheaper or larger model.
- **Pitfall:** importing the whole text-chat history into a voice call. Long, prose-heavy text turns teach the model to answer in long prose. Convert them to spoken form; Magic Worlds already uses `spoken_history_text`. Window them as well, for example the last 30 to 60 turns plus a summary.

---

## 12. Guardrails and moderation without blocking the critical path

**Patterns:**

- **Input side, in parallel:** run the user-text classifier in parallel with the LLM call. On a trip, cancel the LLM and TTS before any audio is released. OpenAI's latency guide describes this as speculative execution for moderation. The OpenAI Agents SDK runs input guardrails in parallel by default (`run_in_parallel=True`); this is faster, but tokens and tools may already have run when the tripwire fires ([Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/)).
- **Output side, on sentence boundaries:** check each sentence before its audio is *released*, and check sentence N+1 while N plays ("check-ahead"). For the first sentence, start TTS synthesis concurrently with the classifier and hold the audio until the verdict arrives. This hides the classifier latency behind TTS time to first byte (~100 to 250 ms) at the cost of wasted TTS characters on the rare blocked sentence.
- **Chunk size trade-off:** NVIDIA NeMo Guardrails streaming output rails validate chunks (`chunk_size` 128 to 256 tokens, `context_size` 50). Smaller chunks lower latency but miss violations that span chunks. On a block, the stream returns an error object and the caller must stop forwarding ([NVIDIA blog](https://developer.nvidia.com/blog/stream-smarter-and-safer-learn-how-nvidia-nemo-guardrails-enhance-llm-output-streaming/)). For voice, sentence-level chunks with a small trailing context window are the natural unit.
- **Small, fast classifiers:** Groq hosts `llama-prompt-guard-2-22m/86m` ($0.03 to $0.04/M) and `gpt-oss-safeguard-20b` (1,000 t/s, $0.075/$0.30), and local classifiers are another option. Use async LLM judges, possibly reasoning models, for non-blocking signals such as crisis-risk trend or age cues, and act on the *next* turn or pause the call. This matches the "reasoning models as async guardrails" advice in the primer.
- **Fail-closed vs fail-open:** a fail-closed gate on every sentence turns classifier tail latency directly into audio gaps. Set per-sentence deadlines, use check-ahead, and pre-warm the classifier connection.

**Magic Worlds status:**

- `_call_sentence_verdict` in `engine.py` awaits `gate.check(...)` for each sentence before TTS, with a 300 ms budget, fail-closed.
- Warm-up runs during STT (`_warm_call_moderation`).
- The docstring states that **"The look-ahead (`ModerationGate.check_ahead`: sentence N while N-1 plays, S-29) is not built."**
- Result: up to about 300 ms is added serially to the first sentence of every turn, on top of LLM TTFT and TTS time to first byte, and inter-sentence gaps can open when classifier latency exceeds playback of the previous sentence.
- Companion-safety screens already run as background tasks (`_safety_tasks`), which is the right pattern.

---

## 13. Pitfalls and anti-patterns

1. Reasoning or thinking left at a provider default in the call profile (Haiku 5.5 defaults to adaptive thinking at `medium`; Gemini 3.6 and 3.8 Flash default to `medium`, and even 3.5 Flash-Lite's `minimal` default is still thinking).
2. Choosing models from AA headline numbers without matching the variant (max reasoning vs off), prompt length, cache state and region.
3. Optimizing P50 and ignoring P95. Hosted frontier P95 TTFT of 1.1 to 1.8 s is common.
4. Per-turn dynamic content (retrieved lore, timestamps, safety notes) inside the system prompt. This kills prefix caching for the whole history.
5. Changing tools, thinking or effort, or speed mode mid-call (cache invalidation on Anthropic).
6. Prompting for emotion tags that the active TTS model reads aloud (ElevenLabs Flash, Fish S2 reading S1 parentheses after December 31, 2026).
7. Letting tags or markers persist in history, which makes the model keep emitting them after a TTS fallback.
8. Waiting for a full long sentence before the first TTS call. Make the first unit a short clause.
9. Speculative generation that persists or bills the speculative user turn, or that starts TTS before confirmation on per-character billing.
10. Generic, repetitive fillers, or fillers when latency is already low.
11. Storing unheard assistant text in history, or dropping heard partial text.
12. Unbounded history imported from long text chats into a voice call.
13. Synchronous, fail-closed moderation on every sentence with no look-ahead.
14. Hedging to a second provider on every turn (double cost, no cache) instead of only on TTFT timeouts.
15. Non-default sampling on providers that reject it (current Claude models return 400 on custom temperature/top_p).

---

## 14. Implications for Magic Worlds (prioritized)

Context: cascaded pipeline with Groq whisper-large-v3 batch STT, the callbot agent graph (`callbot_chat.v2.json`, per-family prompts) streaming text, `SentenceBuffer` (160-char soft cap), a per-sentence moderation gate, and ElevenLabs or Fish streaming TTS.

### P0: measure and remove avoidable LLM latency

1. **Instrument LLM milestones per turn.** Track request sent, first token (TTFT), first sentence ready, tokens per second, cached input tokens, and reasoning tokens, at P50 and P95 per callbot profile. Observability already has `ttfb_ms`, `moderation_ms` and `user_stop_ttfb_ms`; add an explicit LLM TTFT and first-unit milestone if none exists. Without it, model and provider choices are guesses.
2. **Make thinking off (or minimum) explicit in every callbot profile and verify that it is forwarded.**
   - Claude Haiku 5.5: `thinking: disabled`, effort <= high.
   - GPT-6 Luna: `reasoning: none`.
   - gpt-oss: `reasoning_effort: low`.
   - Gemini 3.x Flash cannot fully disable thinking (3.5 Flash-Lite and 3.6 Flash go down to `minimal`; 3.8 Flash only to `low`); set the level explicitly and benchmark before allowing it in the call lane.
   - Add an alert if `reasoning_tokens > 0` on callbot turns.
3. **Make the prompt prefix cache-stable.**
   - Keep the system prompt (callbot rules, character, persona, codex snapshot) frozen per call.
   - Move per-turn `append_lorebook_context` output out of the system message into a late dynamic block before the newest user message (`route_chat.py` `_resolve_callbot_chat_context`). This touches the shared prompt-contract machinery, so coordinate with the text-chat paths.
   - Ensure the agent service passes caching controls through: Anthropic top-level `cache_control` (automatic) plus a breakpoint after the system prompt; Cerebras and pre-5.6 OpenAI `prompt_cache_key = voice_session_id` (on GPT-5.6+/GPT-6 the key is optional and mostly for accounting; the implicit breakpoint does the work); Gemini implicit caching (>= 4,096 tokens on 3.x).
   - Pre-warm the cache in `preflight()` at call start (Anthropic `max_tokens: 0`, or a 1-token request elsewhere).
4. **Take moderation off the first-audio path.**
   - Build the planned `check_ahead` (sentence N+1 while N plays).
   - For the first sentence, start TTS synthesis concurrently with the 300 ms classifier and release audio only on `allow`. Fail-closed semantics are unchanged, and the latency is hidden behind TTS time to first byte.
   - Keep companion-safety checks async, as they are now.

### P1: structural wins

5. **First-unit clause flush.** Let `SentenceBuffer` emit the first unit of a turn at a clause boundary (comma, semicolon or dash after about 25 to 40 characters, or 6 to 10 words), then revert to sentence mode. Keep marker atomicity.
6. **Speculative LLM start.** With batch STT, start the LLM when the segment transcript arrives, before the end-of-turn hangover ends. Alternatively, trigger STT at a short silence and confirm at the full threshold. Discard on resume or transcript change, never persist or bill the speculative attempt, keep TTS waiting for confirmation, and cap at about 2 retries. Expected gain from the literature: roughly 0.3 to 0.5 s per turn for about 20 to 30% extra LLM compute. Prefix caching keeps the extra cost low.
7. **Model and provider lane for calls.** Shortlist two or three non-reasoning models: GPT-6 Luna (none), Claude Haiku 5.5 (thinking disabled), and an open model on Cerebras or Groq (gpt-oss-120b low, Qwen 3.8 27B) or a dedicated Nemotron-class deployment. Evaluate on an in-domain call eval (section 7) covering English and Spanish:
   - TTFT P95
   - persona adherence over 30+ turns
   - spoken-style violations
   - refusal and persona-break rate on 18+ fictional prompts
   - cost per call-minute

   Add a **TTFT-timeout hedge** (for example, at the provider's P90) to a backup profile instead of always-on hedging.
8. **Emotion and interjection syntax per TTS model.**
   - Map the allowed cue syntax to the active TTS: ElevenLabs v3/v4/v4 Turbo `[tag]`; Flash: none; Fish S2 `[tag]` at sentence start.
   - Migrate off Fish S1 parentheses before December 31, 2026.
   - Whitelist one or two tags per reply.
   - Strip tags from stored history and transcripts, so the model does not keep producing them after a fallback.
9. **Bounded call context.**
   - Window imported text-chat history (for example, the last 30 to 60 turns).
   - Add an async rolling summary with a cheaper model, refreshed every ~20 turns and placed right after the system prompt.
   - Write a post-call memory summary back to the chat or lorebook off the critical path.
10. **Interruption signal.** Keep heard-prefix truncation, at word level where TTS timestamps exist (ElevenLabs provides them). Add a one-line "you were cut off" note in the late dynamic block for the turn right after a barge-in. Confirm that interrupted-during-generation turns with played audio are always converted to a stored heard prefix, since `build_conversation_messages` drops non-`completed` rows.

### P2: experience polish and research bets

11. **Character-consistent latency cues:** pre-synthesized non-lexical cues per voice, played only when predicted time to first audio exceeds about 1.2 s, rotated, and never on a fast path.
12. **Pre-generated constrained lines** (greeting variants, goodbye, "are you there?", error lines) per character and voice, to skip the LLM entirely.
13. **Talker/thinker split:** a fast call model in the loop, plus an async larger model that maintains scene and relationship state and selects lore for the next turn.
14. **Stricter language pinning** for English/Spanish callers: do not switch on isolated words or backchannels, and ask if unsure.

### Open questions

- Does `api.magic_llm` forward `cache_control`, `prompt_cache_key` and thinking-disable flags for callbot profiles? What are the observed cache hit rate and reasoning-token counts today?
- What is the measured LLM TTFT P95 per current callbot profile from the production region?
- Which providers' current 2026 terms permit verified-adult fictional sexual content over the API? No primary source was verified here.
- Does the mid-stream barge-in path ever leave a heard but `interrupted` row that the history builder drops?
- With batch Whisper, how often would a short-silence speculative trigger be wrong (user continues) in real Magic Worlds calls? This needs log replay.

---

## Sources

All sources were accessed on 2026-10-20. Dates are publication or update dates where the page states one.

**Benchmarks and latency budgets**

- Artificial Analysis, gpt-oss-120B provider benchmarks (72 h medians; cache data updated 2026-09-26): https://artificialanalysis.ai/models/gpt-oss-120b/providers
- Artificial Analysis, performance benchmarking methodology v2.2.0 (2026-03-02): https://artificialanalysis.ai/methodology/performance-benchmarking
- Artificial Analysis, model leaderboard (accessed 2026-10-20): https://artificialanalysis.ai/leaderboards/models
- Artificial Analysis, GPT-6 Luna providers (accessed 2026-10-20): https://artificialanalysis.ai/models/gpt-6-luna/providers
- Artificial Analysis, Claude Haiku 5.5 providers (accessed 2026-10-20): https://artificialanalysis.ai/models/claude-haiku-5-5/providers
- Artificial Analysis, Gemini 3.5 Flash-Lite providers (accessed 2026-10-20): https://artificialanalysis.ai/models/gemini-3-5-flash-lite/providers
- Daily, "Announcing Pipecat PhoneLLM Alpha 1" (2026-08-27): https://www.daily.co/blog/announcing-pipecat-phonellm-alpha-1/
- *Voice AI & Voice Agents: An Illustrated Primer* (updated 2026-06): https://voiceaiandvoiceagents.com/
- MTVA-Bench, arXiv 2609.20152 (2026-09-17): https://arxiv.org/abs/2609.20152
- Inworld, "Fastest LLM Inference APIs in 2026" (2026-05-28, vendor): https://inworld.ai/resources/fastest-llm-inference-api
- ElevenLabs, "Voice agent latency optimization" (2026-06-23, updated 2026-10-09): https://elevenlabs.io/blog/voice-agent-latency-optimization
- Cerebrium, Pipecat GPU deployment (2026, vendor): https://cerebrium.ai/resources/pipecat-voice-agent-gpu-deployment

**Inference providers and model docs**

- Groq models (accessed 2026-10-20): https://console.groq.com/docs/models
- Groq prompt caching (accessed 2026-10-20): https://console.groq.com/docs/prompt-caching
- Cerebras models overview (accessed 2026-10-20): https://inference-docs.cerebras.ai/models/overview
- Cerebras prompt caching (accessed 2026-10-20): https://inference-docs.cerebras.ai/capabilities/prompt-caching
- SambaNova pricing (primary, accessed 2026-10-20): https://cloud.sambanova.ai/pricing
- SambaNova endpoint pricing, pricepertoken (originally cited; no SambaNova prices listed on 2026-10-20): https://pricepertoken.com/endpoints/sambanova
- w.media, Nvidia licenses Groq tech (~2025-12): https://w.media/nvidia-licenses-groqs-tech-for-ai-inference-in-us-20-billion-deal/
- Noqta, Groq $650M raise (~2026-05): https://noqta.tn/en/news/groq-650-million-neocloud-nvidia-inference-2026
- Voiceflow, Groq in 2026: https://www.voiceflow.com/blog/groq
- OpenAI models (accessed 2026-10-20): https://developers.openai.com/api/docs/models
- OpenAI prompt caching (undated, current): https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI latency optimization (undated, possibly stale): https://developers.openai.com/api/docs/guides/latency-optimization
- OpenAI voice and realtime prompting guide (undated, covers gpt-realtime-2): https://developers.openai.com/api/docs/guides/voice-prompting.md
- OpenAI realtime conversations, truncate (undated): https://developers.openai.com/api/docs/guides/realtime-conversations
- Anthropic models overview (accessed 2026-10-20): https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic prompt caching (accessed 2026-10-20): https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic thinking (accessed 2026-10-20): https://platform.claude.com/docs/en/build-with-claude/thinking
- Anthropic fast mode (accessed 2026-10-20): https://platform.claude.com/docs/en/build-with-claude/fast-mode
- Gemini context caching (updated 2026-10-13): https://ai.google.dev/gemini-api/docs/caching
- Gemini thinking (updated 2026-10-14): https://ai.google.dev/gemini-api/docs/thinking
- Gemini models (updated 2026-10-19): https://ai.google.dev/gemini-api/docs/models
- Gemini deprecations (updated 2026-10-20): https://ai.google.dev/gemini-api/docs/deprecations
- ElevenLabs models (accessed 2026-10-20): https://elevenlabs.io/docs/overview/models
- OpenAI usage policies (returned HTTP 403 to the fact-checker; not verified): https://openai.com/policies/usage-policies/
- Google, "Start building with Gemini 2.5 Flash" (2025, possibly stale): https://developers.googleblog.com/en/start-building-with-gemini-25-flash
- Vapi support, Gemini thinkingBudget passthrough: https://support.vapi.ai/t/34036851/does-native-vapi-gemini-support-thinkingbudget-for-gemini-2-

**Prompting, TTS tags and frameworks**

- ElevenLabs agents prompting guide (undated, current model list): https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide
- ElevenLabs audio tags v3/v4 help (undated): https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4
- Pipecat ElevenLabs TTS docs: https://docs.pipecat.ai/server/services/tts/elevenlabs
- micdrop.dev, ElevenLabs audio tags in a real-time voice agent (2026-09-30): https://micdrop.dev/blog/elevenlabs-audio-tags-voice-agent
- Fish Audio emotion control (undated; S1 retirement 2026-12-31): https://docs.fish.audio/developer-guide/best-practices/emotion-control
- Fish Audio models overview: https://docs.fish.audio/developer-guide/models-pricing/models-overview
- LiveKit Agents speech docs (rendered 2026-10-20): https://docs.livekit.io/agents/build/speech/
- LiveKit turn-taking tuning (rendered 2026-10-20): https://docs.livekit.io/agents/logic/turns/tuning.md
- LiveKit community, preemptive generation not triggering: https://community.livekit.io/t/livekit-preemptive-generation-not-triggering-with-current-stt-model-missing-preflight-transcript-events/1582
- LiveKit GitHub issue #4219 (duplicate requests): https://github.com/livekit/agents/issues/4219
- LiveKit community, unspoken text in chat context: https://community.livekit.io/t/chat-context-contains-text-that-wasnt-spoken-due-to-interruption/165
- Pipecat interruptions: https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md
- Pipecat context summarization: https://docs.pipecat.ai/pipecat/fundamentals/context-summarization.md
- Pipecat function calling: https://docs.pipecat.ai/pipecat/learn/function-calling
- Pipecat text-to-speech: https://docs.pipecat.ai/pipecat/learn/text-to-speech

**Research papers**

- Endpoint Anticipation, arXiv 2606.13450 (2026-06-11): https://arxiv.org/abs/2606.13450
- Voice-Light, arXiv 2609.20995 (2026-09-17): https://arxiv.org/abs/2609.20995
- RelayS2S, arXiv 2603.23346 (2026-03-24, v2 2026-09-09): https://arxiv.org/abs/2603.23346
- Hiding Tool Latency via Speculative Execution, arXiv 2610.07641 (2026-10-06): https://arxiv.org/abs/2610.07641
- Personalized Predictive ASR, arXiv 2305.13794 (2023, possibly stale): https://arxiv.org/abs/2305.13794
- Mitigating Response Delays (fillers), arXiv 2507.22352 (2025-07-30): https://arxiv.org/abs/2507.22352
- Behavioral and Symbolic Fillers in VR, arXiv 2508.11781 (2025-08): https://arxiv.org/pdf/2508.11781
- KAME tandem S2S + LLM, arXiv 2510.02327 (2025-09-26, v2 2026-05-25): https://arxiv.org/abs/2510.02327
- Talker-Reasoner, arXiv 2410.08328 (2024-10-10, possibly stale): https://arxiv.org/abs/2410.08328

**Guardrails and content policy**

- NVIDIA NeMo Guardrails streaming output rails (blog): https://developer.nvidia.com/blog/stream-smarter-and-safer-learn-how-nvidia-nemo-guardrails-enhance-llm-output-streaming/
- OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-python/guardrails/
- justainews, ChatGPT adult mode status (2026-09): https://justainews.com/companies/openai/adult-mode-in-chatgpt-explained-nsfw-erotica-porn-policy/
- AI adult content policy tracker (2026): https://aihaven.com/ai-adult-content-policy-tracker/
- OpenAI Model Spec (2025-12-18): https://model-spec.openai.com/2025-12-18.html

**Magic Worlds code read for this note** (local, 2026-10-20)

- `magic-worlds-api/src/services/voice_orchestration/callbot_execution.py`
- `magic-worlds-api/src/services/voice_orchestration/engine.py`: `_call_sentence_verdict`, `_warm_call_moderation`, barge-in paths
- `magic-worlds-api/src/services/voice_orchestration/sentence_buffer.py`
- `magic-worlds-api/src/database/mysql/call_turn_truncation.py`
- `magic-worlds-api/src/services/conversation_execution.py`: `build_conversation_messages`
- `magic-worlds-api/src/routes/user/route_chat.py`: `_resolve_callbot_chat_context`, lorebook append into the system prompt
- `magic-worlds-api/src/agent_graphs/runtime/callbot_chat.v2.json`: callbot prompt variants

---

## Fact-check log (2026-10-20)

Each claim was checked against a primary source by direct fetch on 2026-10-20. The shared web-search budget ran out early, so checks used direct WebFetch of vendor docs, arXiv abstracts and framework docs. Newer developments may exist that a search would have surfaced.

| # | Claim (as originally written) | Verdict | Correction / note | Source |
|---|---|---|---|---|
| 1 | Claude Haiku 5.5 "fastest", from $0.10/$0.50 per M, default effort `medium`, thinking disable-able at effort <= high | Confirmed (plus addition) | "From" is a prompt-length tier: >100k-token prompts are billed at $0.50 input. Inline addition in 2.3. | https://platform.claude.com/docs/en/about-claude/models/overview ; https://platform.claude.com/docs/en/build-with-claude/thinking |
| 2 | Sonnet 5.5 cannot disable thinking, lowest is `between_tools`; Opus 5.5 / Fable 5.1 cannot disable | Confirmed | `between_tools` only at effort <= high. Opus 5.5 is $4/$20. | https://platform.claude.com/docs/en/build-with-claude/thinking |
| 3 | Current Claude models return 400 on non-default `temperature`/`top_p` | Confirmed | Also `top_k`; `top_p` default is 0.99, so `top_p: 1` is a 400. | https://platform.claude.com/docs/en/build-with-claude/thinking |
| 4 | Fast mode: up to 2.5x OTPS, not TTFT, Opus-class only, speed switch = cache miss | Confirmed | GA on Opus 5.5 at $8/$40; research preview on Opus 5 / 4.8. | https://platform.claude.com/docs/en/build-with-claude/fast-mode |
| 5 | Anthropic caching: 512-token min on 5.5 models, 4,096 on Haiku 4.5, read 0.1x (0.05x Opus/Sonnet 5.5), 20-block lookback, `max_tokens: 0` pre-warm (not with streaming/thinking), parallel requests wait for first response | Confirmed | Added Fable/Mythos 5.1 0.025x and Haiku 5.5 tiers; per-message effort (beta) keeps cache. | https://platform.claude.com/docs/en/build-with-claude/prompt-caching |
| 6 | OpenAI lineup: GPT-6 Luna `gpt-6-luna` $0.10/$0.50 with `none`..`max`; GPT-6.1 Sol $2/$10; GPT-6 Astra $10/$50; realtime models GPT-Live 1, Realtime-2.1 (+Mini), Realtime-2, Realtime-1.5 | Confirmed (plus addition) | Added GPT-Realtime-Translate and deprecated GPT-Realtime Mini. "GPT-5.6 Terra" (Daily's comparison model) is no longer on the models page. | https://developers.openai.com/api/docs/models |
| 7 | OpenAI caching: GPT-5.6+ 1,024-token min, 30 min default / 12 h, 0.1x reads, 1.25x / 2.5x writes; `prompt_cache_key` for <~15 rpm/key on pre-5.6 | Corrected (minor) | 0.05x reads on GPT-6.1 Sol. Key guidance is "about 15 requests per minute in total across all prefixes using each key". On GPT-5.6+ the key is optional, mainly for accounting. | https://developers.openai.com/api/docs/guides/prompt-caching |
| 8 | `gemini-3.6-flash` and `gemini-3.5-flash-lite` default to `thinking_level: minimal` | **Corrected** | 3.6 Flash defaults to `medium`; only 3.5 Flash-Lite defaults to `minimal`. Note missed **Gemini 3.8 Flash** (stable, newest Flash, lowest level `low`, no `minimal`) and Gemini 4 Argon. | https://ai.google.dev/gemini-api/docs/thinking ; https://ai.google.dev/gemini-api/docs/models |
| 9 | Gemini 2.5 Flash with `thinkingBudget: 0` "remains a fast, cheap option while it is still served" | **Corrected** | 2.5 models are not deprecated but "access limited to past users" (closed to new projects); current docs show only `thinking_level` low/medium/high for 2.5 Flash. | https://ai.google.dev/gemini-api/docs/deprecations ; https://ai.google.dev/gemini-api/docs/thinking |
| 10 | Gemini caching: implicit on 2.5+, 4,096 min on 3.x Flash / 4 Argon, 2,048 on 2.5, no explicit caching on Gemini 4 Argon+, `usage.total_cached_tokens` | Confirmed | No discount percentage stated. | https://ai.google.dev/gemini-api/docs/caching |
| 11 | Groq models, speeds, prices (gpt-oss-120b $0.15/$0.60 at 500 t/s; gpt-oss-20b $0.075/$0.30 at 1,000 t/s; qwen3.8-27b preview $0.80/$4.00; whisper $0.111/h and $0.04/h; prompt guards; preview "discontinued at short notice") | Confirmed | Llama 3.1 8B / 3.3 70B now "contact sales / Enterprise" pricing. | https://console.groq.com/docs/models |
| 12 | Groq caching: gpt-oss only, 50% off, ~2 h TTL, 128 to 1,024 min | Confirmed | Also covers `gpt-oss-safeguard-20b`; page also says "a few hours" elsewhere. | https://console.groq.com/docs/prompt-caching |
| 13 | Nvidia ~$20B non-exclusive license of Groq tech (Dec 2025), Jonathan Ross to Nvidia, GroqCloud continues | Confirmed | $650M mid-2026 raise is secondary-only: unverified. | https://w.media/nvidia-licenses-groqs-tech-for-ai-inference-in-us-20-billion-deal/ |
| 14 | Cerebras: `gpt-oss-120b` ~3,000 t/s, `qwen-3.8-27b` ~1,850 t/s; caching on for all models, no discount, 128-token blocks, 5 min guaranteed up to 1 h, optional `prompt_cache_key` | Confirmed | "Free/developer tiers not intended for production" not found on the models page: marked unverified. | https://inference-docs.cerebras.ai/models/overview ; https://inference-docs.cerebras.ai/capabilities/prompt-caching |
| 15 | SambaNova gpt-oss-120B ~$0.22/$0.59 per M (via pricepertoken) | Confirmed (source replaced) | Primary SambaNova pricing page confirms; pricepertoken no longer lists it. | https://cloud.sambanova.ai/pricing |
| 16 | AA gpt-oss-120B providers: Cerebras 1,737 t/s, 0.34 s first chunk, 1.49 s first answer; Groq 473 t/s / 4.91 s; Baseten 0.19 s first chunk; etc. | Confirmed | Numbers match within rounding; 72 h medians, 10k prompt. | https://artificialanalysis.ai/models/gpt-oss-120b/providers |
| 17 | AA leaderboard: Celeris-1 0.57 s, GPT-6 Luna (non-reasoning) 0.83 s / 128 t/s / index 18, Gemini 3.5 Flash-Lite 7.53 s, Haiku 5.5 (low) 8.39 s, Luna (max) 89.84 s, Haiku 5.5 (max) ~245 s | Confirmed | AA has no Haiku 5.5 thinking-disabled variant; only Anthropic is benchmarked as a provider. | https://artificialanalysis.ai/leaderboards/models ; https://artificialanalysis.ai/models/claude-haiku-5-5/providers |
| 18 | AA methodology v2.2.0 (2 Mar 2026), GCP `us-central1-a`, 10k default prompt, 72 h P50 | Confirmed | AA uses a unique prompt per run; it does not say it "avoids" caching explicitly. | https://artificialanalysis.ai/methodology/performance-benchmarking |
| 19 | ElevenLabs budget: 680 ms P50 / 1,560 ms P95 with LLM TTFT 250/600 ms; FAQ P50 < 800 ms, P95 < 1.5 s; published Jun 23, updated Oct 9 2026 | Confirmed | ElevenLabs calls the figures "illustrative ranges, not guarantees". | https://elevenlabs.io/blog/voice-agent-latency-optimization |
| 20 | Daily PhoneLLM Alpha 1 (Aug 27 2026): Nemotron 3 Nano 30B-A3B fine-tune, 3.5B active, BSD, <100 ms P95 TTFT on B200, $0.0025/agent-min, 650 ms LLM TTFT target, Terra fast-mode P95 ~1,900 ms, "on par... 94% cheaper... 1,300 ms faster" | Confirmed | Vendor-reported. | https://www.daily.co/blog/announcing-pipecat-phonellm-alpha-1/ |
| 21 | Voice AI primer (June 2026) TTFT table and cost per 3-minute call | Confirmed | Models in it are now a generation behind (note added in 1.3). | https://voiceaiandvoiceagents.com/ |
| 22 | LiveKit `preemptive_generation` on by default, LLM only (`preemptive_tts` off), `max_speech_duration` 10 s, `max_retries` 3, discard on context/tool change in `on_user_turn_completed`; false-interruption resume at 2.0 s | Confirmed | | https://docs.livekit.io/agents/logic/turns/tuning.md ; https://docs.livekit.io/agents/build/speech/ |
| 23 | Pipecat summarization off by default, ~8k tokens / 20 messages, background, dedicated LLM | Confirmed | Added `min_messages_after_summary` default 4. | https://docs.pipecat.ai/pipecat/fundamentals/context-summarization.md |
| 24 | Pipecat interruptions: aggregator must sit after `transport.output()`; word timestamps | Partly unverified | Current page describes playback-synced `TTSTextFrame`s; the placement rule is not stated there. | https://docs.pipecat.ai/pipecat/fundamentals/interruptions.md |
| 25 | Fish S1 retires Dec 31 2026, `s1` then served by `s2.1-pro`, no parenthesis-to-bracket conversion | Confirmed | | https://docs.fish.audio/developer-guide/models-pricing/models-overview |
| 26 | ElevenLabs: tags performed by v3/v4/v4 Turbo (`eleven_v4_turbo`); Flash v2.5, Turbo v2.5, Multilingual v2 read brackets aloud; standard WebSocket does not accept v3/v4 | Corrected / partly unverified | `eleven_turbo_v2_5` is **deprecated** (use Flash v2.5). "Read aloud" comes from micdrop.dev, not ElevenLabs docs. v4 Turbo is listed under the Text-to-Dialogue WebSocket; "standard WebSocket rejects v3/v4" is not stated explicitly. | https://elevenlabs.io/docs/overview/models ; https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-do-audio-tags-work-with-eleven-v3-and-v4 ; https://micdrop.dev/blog/elevenlabs-audio-tags-voice-agent |
| 27 | OpenAI voice prompting: `reasoning.effort` low (minimal for simple), preambles by default on gpt-realtime-2, "unintelligible" > "inaudible", language pinning, "2–3 sentences per turn" | Confirmed (one attribution fixed) | "2–3 sentences per turn" is from the gpt-realtime-1.5 example, not general guidance. | https://developers.openai.com/api/docs/guides/voice-prompting.md |
| 28 | OpenAI Realtime: truncate removes unplayed transcript, automatic on WebRTC/SIP; 128k context; 60-minute max session | Confirmed | 128k is from the voice prompting guide; 60 min from realtime conversations. | https://developers.openai.com/api/docs/guides/realtime-conversations |
| 29 | ElevenLabs agents guide: GLM 5.2 / GPT-6 Luna start; DeepSeek Flash 4.1 / Gemini 3.5 Flash-Lite ultra-low latency; Sonnet 5.5 complex; prompts > 2,000 tokens add latency; `text_normalisation_type` | Confirmed | "Repeat critical rules at the end because of recency" is not ElevenLabs wording (it says repeat 1-2 instructions twice). | https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide |
| 30 | Papers: MTVA-Bench (2609.20152; 49 agents, 490 scenarios, 7 languages, 6.4 / 24.4 points), Endpoint Anticipation (2606.13450; 2.56 s, −505 ms, +28.4%, Interspeech 2026), RelayS2S (2603.23346; 1,006→81 ms P90, −479 ms, 99%, EMNLP 2026 Findings), Voice-Light (2609.20995; 758 ms median, 36 turns), speculative tools (2610.07641; 5.79→4.60 s, on-device), KAME (2510.02327; ICASSP 2026), fillers (2507.22352; >4 s degrades QoE, CUI '25) | Confirmed | Voice-Light's "after short pauses" trigger is not in the abstract. | arXiv abstract pages listed in Sources |
| 31 | Fillers: "less intelligent", contextualized > generic, gestural > verbal (arXiv 2508.11781) | Corrected (attribution) | These are prior works cited in the paper's related work (Jeong et al.; Boukaram et al.; Kum and Lee). The paper's own study found no significant filler-type differences on perceived intelligence or competence. | https://arxiv.org/pdf/2508.11781 |
| 32 | OpenAI Agents SDK input guardrails `run_in_parallel=True` by default | Confirmed | Output guardrails always run after the agent completes. | https://openai.github.io/openai-agents-python/guardrails/ |
| 33 | ChatGPT adult mode paused March 26 2026, no update as of Sep 2026 | Unverified (secondary only) | justainews (updated 2026-09-26) says "reportedly paused". OpenAI's usage-policy page returned 403, so API terms remain an open question. | https://justainews.com/companies/openai/adult-mode-in-chatgpt-explained-nsfw-erotica-porn-policy/ |

**Newer developments added by the fact-check:** Gemini 3.8 Flash (stable; lowest thinking `low`), Gemini 4 Argon, Gemini 3.1 Flash-Lite, Gemini 3.8 Live / Live Extended Thinking, Gemini 3.5 Transcribe and 3.8 Flash TTS; Gemini 2.5 access restricted to past users; GPT-Realtime-Translate; GPT-Realtime Mini deprecated; ElevenLabs Turbo v2.5 deprecated and `eleven_v3_conversational` (~280 ms); Claude Haiku 5.5 long-prompt price tier; Anthropic `display: "omitted"` default; per-message effort (beta) that preserves the cache; OpenAI 0.05x cache reads on GPT-6.1 Sol.
