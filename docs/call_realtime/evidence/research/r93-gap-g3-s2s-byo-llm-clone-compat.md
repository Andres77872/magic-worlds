# r93 — Gap G3: can the most compatible realtime/S2S options keep Magic Worlds' own LLM and per-character cloned voices?

- **Date:** 2026-10-20 (the day Eleven Realtime launched)
- **Scope:** Five products: Eleven Realtime v1 Mini/Max, OpenAI GPT-Live-1, xAI Grok Voice 3.0 (realtime), Ultravox Realtime, and Qwen Omni Realtime (`qwen3.8-omni-flash-realtime`). Each is checked against five questions: (1) custom LLM, (2) user IVC/PVC clones inside realtime sessions, (3) whether it is cascaded internally and what that implies, (4) whether it can speak exact text, and (5) the full price including LLM tokens. ElevenLabs **Speech Engine** is added as a sixth item because it is the ElevenLabs product that does keep a custom LLM. The notes had confused it with Eleven Realtime.
- **Method:** Primary documentation only, fetched on 2026-10-20 through direct page fetches, mostly the `.md` versions of the docs. The shared WebSearch budget was already exhausted when this task started, so no search-engine results were used. Every fact below comes from a vendor's own docs, pricing page, changelog, model card, or (for one item) the vendor-community thread named in the task. Numbers from the vendors are **vendor-reported** unless labelled otherwise. Latency figures marked "(r07)" or "(r01)" come from sibling notes, mostly the Artificial Analysis (AA) leaderboard. The 2026-10-20 fact-check re-verified the AA figures for GPT-Live-1, Grok Voice 3.0, Eleven Realtime and Qwen3.5 Omni Flash Realtime; the r01 figures (Ultravox 0.864 s, Qwen3-Omni 702 ms) remain **not re-verified**. See the fact-check log at the end.
- **Product context:** Magic Worlds runs a cascaded pipeline: browser VAD, then Groq whisper-large-v3 per utterance, then its own agent-graph LLM (persona + lorebook), then the ElevenLabs multi-context WebSocket or Fish streaming TTS with per-character cloned voices, then MP3 to the browser. It already has barge-in with heard-text truncation and its own safety/crisis features.

---

## TL;DR

**No S2S/realtime product keeps both the Magic Worlds agent graph as the brain and per-character user clones while staying speech-to-speech.** Each product keeps at most one of the two:

| Product | Keeps own LLM / agent graph? | Keeps per-character clones in realtime? | Internally | Exact text? | Full price (list) |
|---|---|---|---|---|---|
| **Eleven Realtime v1 Mini/Max** | **No.** Explicitly blocked: "Realtime mode isn't available while the agent's LLM is a custom LLM" | **Probably** (the agent's voice "still applies"), but IVC/PVC are **not explicitly confirmed** and are untested | **Cascaded** (vendor FAQ: "not fused") | First message plus Literal "Say" nodes in ElevenAgents (Realtime interplay not stated); Realtime API: undocumented | $0.08/connected min + tokens (Mini $0.20 in / $6.00 out; Max $1.80 / $9.00 per 1M). ElevenLabs' own estimates imply ≈ **$0.084/min Mini** and ≈ **$0.102/min Max** |
| **ElevenLabs Speech Engine** (not S2S; managed cascade) | **Yes.** Any LLM; your server streams the text | **Yes** via `tts.voice_id` (any of your voices; default TTS `eleven_v4_turbo`) | Cascaded (ElevenLabs STT/turn-taking/TTS + your LLM) | **Yes** (`send_response("…")` with a plain string) | $0.08/min + your own LLM cost; 40-min max conversation |
| **OpenAI GPT-Live-1** | **Yes as a backend** through *client delegation* ("connect any model, agent harness, or service"), but GPT-Live is the speaker and is "trained to paraphrase" | **No** for user clones at scale: recorded voices are sales-gated, need a consent recording, 20 per org; prompt voices max 100 per org and may not imitate fictional characters; the guide says `gpt-live-1` "supports custom voices with English accents" | Native full-duplex voice model + text backend | **No** guarantee; OpenAI says to play your own clip | $0.05/min voice (billed per second, silence included) + your backend |
| **xAI Grok Voice 3.0** | **No** (Grok is the model) | **Docs say yes** (custom `voice_id` on `session.update`). Contradicted by a 2026-05 LiveKit thread. 30 voices/team, API creation Enterprise-only, US-only (not Illinois) | Output side is text then TTS (pronunciation `replace` is applied "before TTS") | **Yes** (`force_message`, verbatim TTS) | $0.08/min + $0.004 per text input; tokens included (unverified: the pricing page does not say) |
| **Ultravox Realtime** (owned by Inworld since 2026-09-30) | **No** (hosted models only: GLM 4.6 default, Llama 3.3 70B, Gemma 27B). Open weights (MIT) for self-hosting | **Yes via BYO ElevenLabs voice** (`externalVoice.elevenLabs.voiceId`). Native clones: 1 per account (docs) / 5 on Pro (pricing) | Half-cascade: audio-in LLM (no ASR) + external streaming TTS | **Yes** (`forced_agent_message`) | $0.05/min (LLM included) + your ElevenLabs TTS bill |
| **Qwen3.8-Omni-Flash-Realtime** | **No** (Qwen is the model; text-only output mode allows your own TTS) | **Yes, documented in realtime**, but only **Qwen's own clones** (not ElevenLabs IVC/PVC): 1,000 voices/account, $0.01/voice | Native end-to-end Thinker–Talker family; page claims "full-duplex" | Not documented | Tokens only: $0.23 text-in / $0.93 audio-in / $0.70 text-out / $1.87 audio-out per 1M (Singapore). My estimate: ≈ $0.01–0.03/min |

**Implication:** the "cascade or half-cascade keeps character clones" conclusion in r07/r10 still holds. It needs one refinement: the half-cascade options that keep clones (Ultravox + ElevenLabs voice, Qwen text-mode + own TTS) **do not keep the agent graph**. The only option that keeps the graph and has the lowest-latency "voice layer" (GPT-Live) **loses the character voice and the verbatim lines**. ElevenLabs Speech Engine keeps both, but it is a managed cascade rather than S2S.

---

## 1. Contradictions between notes, resolved

### C1 — Eleven Realtime and custom LLMs (r01 "cannot be used with a custom LLM" vs r10 "per-connected-minute voice layers let you pick the LLM")

**r01 is correct for Eleven Realtime. r10's statement is true only for GPT-Live (and for ElevenLabs Speech Engine, which is a different product).**

- The ElevenLabs Realtime models doc lists under *Limitations*: "**No custom LLM**: Realtime mode isn't available while the agent's LLM is a custom LLM or Amazon Bedrock. Select a built-in LLM in Custom mode before switching." It also lists **LLM** (`agent.prompt.llm`), reasoning effort, thinking budget, parallel tool calls, cascade timeout, **TTS model** (`tts.model_id`), **expressive mode** and **ASR provider** as *managed settings* that "the agent ignores" in Realtime mode ([Realtime models doc](https://elevenlabs.io/docs/eleven-agents/customization/realtime-models), page undated, fetched 2026-10-20).
- In the Realtime API, the `model` string "selects the agent's behavior directly", and the only allowed values are `eleven_realtime_v1_mini` and `eleven_realtime_v1_max`. There is no LLM field ([client-secret API reference](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/create-client-secret)).
- GPT-Live does let you pick: "With client delegation, connect any model, agent harness, or service your application runs" ([GPT-Live getting started](https://developers.openai.com/api/docs/guides/live)).
- The ElevenLabs product that lets you pick the LLM at a flat $0.08/min is **Speech Engine**: "ElevenLabs handles speech-to-text and text-to-speech while your server provides the LLM logic" ([Speech Engine overview](https://elevenlabs.io/docs/overview/capabilities/speech-engine)). The realtime doc states that Speech Engine agents **cannot** use Realtime models.
- **Corrected sentence for r10:** "Per-connected-minute voice layers price the voice predictably. GPT-Live lets you choose the reasoning backend (client delegation); Eleven Realtime does **not** (the LLM is managed); ElevenLabs' BYO-LLM path is Speech Engine (a cascade, $0.08/min)."

### C2 — Eleven Realtime price (r07 "not published" vs r10 "$0.08/min + Mini $0.20/$6 or Max $1.80/$9 per 1M tokens")

**r10 is correct as of 2026-10-20. r07 was correct only about the launch blog and the landing page, which give no figures.**

- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) (fetched 2026-10-20): Eleven Realtime v1 Mini and Max each list **$0.080 per additional connected-audio minute**, **burst $0.160/min** above the concurrency limit, and tokens of **Mini $0.20 input / $6.00 output** and **Max $1.80 input / $9.00 output per 1M tokens**. Concurrency is 4 / 6 / 10 / 20 / 30 / 40 calls by plan. Included minutes are "estimates based on typical token usage": Mini ≈ 14 / 71 / 262 / 1,179 / 3,562 / 11,794 and Max ≈ 12 / 59 / 216 / 971 / 2,934 / 9,714, mapped to plans by page order (that mapping is my inference).
- The docs confirm the structure: "billed the standard ElevenAgents per-minute rate, plus its input, cached input, and output tokens at the Realtime model's rates." The **cached-input price is not listed** on the pricing page.
- The [launch blog](https://elevenlabs.io/blog/realtime) (2026-10-20) and the [landing page](https://elevenlabs.io/realtime) say only "See the pricing page for current rates."

### C3 — Is Eleven Realtime native S2S or cascaded? (r07: "reportedly cascaded", The New Stack, unverified)

**It is cascaded, per ElevenLabs' own docs.** From the [OpenAI Realtime API compatibility guide](https://elevenlabs.io/docs/eleven-agents/guides/openai-realtime-compatibility) FAQ: "Eleven Realtime v1 mini and max use a cascaded architecture, optimized end-to-end so each component works best as part of a single system." It also says: "Are Realtime models fused models? **No.** Realtime models use a cascaded architecture: each component is a distinct model." The underlying models "aren't public". The blog's phrase "a new class of Speech to Speech models" is marketing for a tuned cascade.

### C4 — Grok custom `voice_id` in realtime (xAI docs say yes; LiveKit thread says no)

**Unresolved by documentation. A live test is required. The documentation side is clear and current; the negative report is five months old and comes from launch week.**

- xAI [Custom Voices](https://docs.x.ai/developers/model-capabilities/audio/custom-voices) (fetched 2026-10-20) says: "Custom voices are interchangeable with built-in voices across all voice APIs. Pass your `voice_id` to any of: … `wss://api.x.ai/v1/realtime`". It gives a `session.update` example with `"voice": voice_id`. The [Speech to Speech doc](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech) says the resulting `voice_id` "works as the `voice` parameter on `session.update` exactly like a built-in voice". The May 2026 [release note](https://docs.x.ai/developers/release-notes) announced clones "across the Text-to-Speech and Speech to Speech APIs".
- [LiveKit community thread](https://community.livekit.io/t/grok-realtimemodel-not-accepting-custom-xai-voice-clone-only-default-voices-work/1117) (2026-05-14/15): a clone worked on xAI TTS but not on `xai.realtime.RealtimeModel`. A community member said the plugin passes any string through, so the backend rejected it. **LiveKit staff** replied that "the official answer is we only support the default voices" in LiveKit's plugin, with support planned but no date. No error text was posted. The thread has no later reply reporting a fix (re-read 2026-10-20). LiveKit's current [xAI realtime plugin page](https://docs.livekit.io/agents/models/realtime/plugins/xai/) still lists only stock-voice defaults (`ara` for the plugin, `eve` for LiveKit Inference, which now offers `xai/grok-voice-3.0`) and does not mention custom voice IDs.
- Plausible explanations, all **unverified**: (a) the backend had not enabled clones on realtime in launch week; (b) **regional gating**: "Custom Voices is currently only available in the United States, with the exception of Illinois"; (c) team scoping: clones are "scoped to your team", so a key from another team fails.
- **Test:** a 10-line WebSocket script that sends `session.update` with the clone ID, then checks `session.updated` and listens to the first `response.output_audio.delta`. Run it once with a clone made in the console and once with a clone made through the API.

### C5 — Qwen 3.8 Omni Realtime and "full-duplex" (r07: unverified)

The [Model Studio realtime page](https://www.alibabacloud.com/help/en/model-studio/realtime) (updated 2026-10-16) now says: "Use Qwen3.8-Omni-Flash-Realtime for real-time audio/video conversations. It supports **full-duplex interaction**." Turn control is still VAD-based (`server_vad`, or `semantic_vad`, which "filters out backchannel speech"). **Status: vendor-claimed and now on the primary page.** Behaviour is unmeasured.

### C6 — GPT-Live custom voices are "English accents only" (r10)

**r10 is essentially correct (corrected in the 2026-10-20 fact-check; an earlier version of this note said the restriction was not on the primary pages).** The [custom voices guide](https://developers.openai.com/api/docs/guides/custom-voices), in the section on selecting a recorded voice at GPT-Live session creation, says: "`gpt-live-1` supports custom voices with English accents." It adds that the accent should also be named in `session.instructions` (examples: British English, Irish English). The guide gives no non-English accent option for custom voices in GPT-Live. Prompt-to-voice voices "work with GPT-Live" only; TTS, Realtime and Chat Completions do not support them. Recorded voices also work with TTS, Realtime and Chat Completions audio. Recorded-voice consent phrases exist in 16 languages, **including Spanish**, but that is the consent script, not GPT-Live's output accent. **So a Spanish-accented custom character voice in GPT-Live is not supported per the docs.** The confirmed limits are 100 prompt voices per org (prompt-to-voice opened to all API customers on 2026-10-16 per the [changelog](https://developers.openai.com/api/docs/changelog)); recorded voices "limited to eligible customers" through sales, 20 per org, with samples of 30 s or less; and no "imitation of a named person, public figure, or fictional character".

### C7 — Ultravox clone counts (r07: "1 (PAYG) or 5 (Pro)")

Both figures are primary but come from different pages. The [Voice Cloning doc](https://docs.ultravox.ai/voices/cloning.md) says "Currently, we support **one cloned voice per account**". The [pricing page](https://www.ultravox.ai/pricing) (2026-10-09) says 1 on Pay-as-you-go, "5 custom voices" on Pro ($100/mo), and custom on Enterprise. Either way, **native Ultravox clones cannot cover a character catalogue.** BYO ElevenLabs voices can (§2.5).

---

## 2. Product-by-product findings

### 2.1 Eleven Realtime v1 Mini / Max (launched 2026-10-20)

**What it is.** Two "Realtime models" that are selectable as an ElevenAgents **Voice mode** (`conversation_config.realtime_model`), or reachable directly through an OpenAI-Realtime-compatible WebSocket at `wss://api.elevenlabs.io/v1/convai/realtime` ([compatibility guide](https://elevenlabs.io/docs/eleven-agents/guides/openai-realtime-compatibility)). WebSocket only: the [landing page](https://elevenlabs.io/realtime) FAQ answers WebRTC with "Not at launch. It connects over WebSocket." Mini is "the default Realtime model. Lowest latency and cost"; Max "reasons before it responds" ([Realtime models](https://elevenlabs.io/docs/eleven-agents/customization/realtime-models)). Availability is **rolling out per workspace**: "the API rejects `realtime_model` with the error `Realtime models are not available for this workspace`" until the workspace is enabled.

1. **Custom LLM: No.** Custom LLM and Bedrock are blocked, and the LLM is a managed setting (C1). Workflow nodes cannot override managed settings. Agents in Realtime mode can transfer only to other Realtime-mode agents. If the Realtime model does not respond in time, the agent "falls back to backup LLMs", which are built-in LLMs, not yours. The only way to involve the Magic Worlds agent graph is as a **tool or webhook** that the managed LLM calls and then relays. That means paraphrase and an extra round trip, and Mini scores only 60.3% on the vendor's (unnamed) tool-use benchmark versus 87.1% for Max ([blog](https://elevenlabs.io/blog/realtime)).
2. **IVC/PVC in realtime: probable, not confirmed.**
   - *For:* "All other agent settings work as they do in Custom mode, including … **the voice, including multi-voice support**". "On an agent using a Realtime model, the voice still applies, but the agent's Text to Speech model and expressive mode settings don't" ([Voice customization](https://elevenlabs.io/docs/eleven-agents/customization/voice)). Multi-voice entries are chosen "from your available ElevenLabs voices" ([Multi-voice support](https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support)), which includes My Voices.
   - *Against or unknown:* the blog and landing page mention only "17,000+ / 17,500+ library voices". The Realtime API's `audio.output.voice` is a string defaulting to `"brian"`, and the docs never say whether a raw `voice_id` (an IVC/PVC ID) is accepted there. The TTS model is managed and its identity "isn't public". PVCs are trained per model family (PVC support on Eleven v4 was "rolling out" per the [Eleven v4 doc](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)), so a PVC might not be available on the Realtime TTS. "Voices with live moderation enabled cannot be used in ElevenAgents" (this applies to some shared library PVCs).
   - **Verdict:** in ElevenAgents Realtime mode, an agent configured with an IVC is *likely* to speak in that IVC. PVC and Realtime-API `voice_id` support are **unknown. Test them.** Multi-voice XML tags (`<narrator>…</narrator>`) would allow multi-character scenes if they work in Realtime mode.
3. **Cascaded internally: yes** (C3). Implications:
   - **Latency:** vendor-reported TTFA is **570 ms (Max) / 620 ms (Mini)**, "the average measured on Big Bench Audio" ([landing](https://elevenlabs.io/realtime); the blog credits the evaluations to AA). The latency gain comes from co-location and joint tuning, not from removing text. It is therefore a benchmark for what a well-tuned cascade can do, roughly 0.6 s.
   - **Expressiveness:** output prosody is TTS-driven from text. The user's paralinguistic cues reach the LLM only as far as the managed ASR/turn model exposes them. The vendor reports Full-Duplex-Bench 95.8% (Mini) / 94.1% (Max).
   - **Safety:** because text exists before audio, ElevenAgents guardrails can act. The landing FAQ notes guardrails are an **ElevenAgents** feature that is **not available in the Realtime API**.
4. **Exact text:** In ElevenAgents, the **first message** "still applies". Workflows offer a **Say node** whose **Literal** mode makes "the agent speak the exact text you enter" ([Workflows](https://elevenlabs.io/docs/eleven-agents/customization/agent-workflows)). Realtime mode bans only workflow overrides of *managed* settings, so Say nodes should work, but this is **not explicitly stated**. The **Realtime API** documents no verbatim-speech event. For crisis lines on this path, use app-played pre-rendered clips.
5. **Full price:** $0.08/connected min + tokens.
   - **From ElevenLabs' own included-minute estimates** (Pro / Scale / Business rows), "typical" token usage adds ≈ 5% for Mini (1,238 / 1,179 = 1.050, i.e. **≈ $0.084/min**) and ≈ 27% for Max (1,238 / 971 = 1.275, i.e. **≈ $0.102/min**). This is my derivation from the vendor table.
   - **Magic Worlds-like roleplay estimate** (my assumptions: 8k-token persona + lorebook + history re-sent on each of 4 replies per minute, 60 output tokens per reply, no cache discount):
     - Mini: 32k × $0.20/1M + 240 × $6/1M ≈ $0.008, so **≈ $0.088/min**.
     - Max: 32k × $1.80/1M + 240 × $9/1M ≈ $0.060, plus reasoning tokens, so **≈ $0.14–0.15/min**.
     - Cached-input pricing (unpublished) would lower both.
   - Burst minutes cost $0.16. Mini is **not available under Zero Retention Mode/HIPAA**. Max is not offered in the India or Singapore residency environments. EU residency is available for both.
   - Realtime API sessions default to `max_duration_seconds: 600` (configurable; the maximum is not stated).

### 2.2 ElevenLabs Speech Engine (adjacent: the ElevenLabs path that keeps both)

Not S2S, but it answers "ElevenLabs-hosted realtime with *our* LLM and *our* clones".

- **Custom LLM: yes.** "Any LLM that produces text". ElevenLabs opens a WebSocket **to your server** (a public `wss` URL is required; a FastAPI/ASGI integration exists via `engine.create_session()`). Your `on_transcript` callback receives the full history and streams text back. Interruptions cancel your LLM call through an `AbortSignal`/task cancellation ([quickstart](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-engine)).
- **Clones: yes in configuration.** `tts.voice_id` (any voice ID), `tts.supported_voices` (multi-voice), and `tts.model_id` (default `eleven_v4_turbo`) ([Create Speech Engine API](https://elevenlabs.io/docs/api-reference/speech-engine/create)). The usual per-model PVC availability caveats apply.
- **Turn-taking:** `turn_model` `turn_v3` (default; `turn_v2` also allowed), `turn_eagerness` (`patient`/`normal`/`eager`, default `normal`), `speculative_turn` (default `false`; "starts generating LLM responses during silence before full turn confidence … May increase LLM costs"), and `cascade_timeout_seconds` 2–15 (default 4) ([Create Speech Engine API](https://elevenlabs.io/docs/api-reference/speech-engine/create); `cascade_timeout_seconds` was added in the 2026-09-21 [changelog](https://elevenlabs.io/docs/changelog) entry. The Sep–Oct changelog entries do not mention `turn_v3` or `speculative_turn`).
- **Exact text: yes.** `send_response("Hello, how can I help?")` accepts a plain string ([Python SDK ref](https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/python-sdk-reference)).
- **Price:** $0.08/min (15 / 75 / 275 / 1,238 / 3,738 / 12,375 included minutes by plan; burst $0.16; concurrency 4–40) ([API pricing](https://elevenlabs.io/pricing/api)) + your own LLM. ElevenAgents voice-only calls get "a 95% discount for periods of silence longer than 10 seconds" ([help center](https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost)). Whether Speech Engine gets the same discount is **not stated**.
- **Limits:** conversations default to 10 min and are capped at **40 min**; longer needs sales. That matters for long roleplay calls (reconnect logic needed). No published latency.

### 2.3 OpenAI GPT-Live-1 (GA 2026-09-10, confirmed in the OpenAI API [changelog](https://developers.openai.com/api/docs/changelog); model page undated)

1. **Custom LLM / non-OpenAI agent graph as backend: yes, through client delegation**, with important caveats ([Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)):
   - Set `delegation: {"type": "client"}` at session creation. The mode is immutable, so switching requires a new session. Client delegation is chosen when "you need another backend, multiple models, or API capabilities beyond the managed configuration".
   - GPT-Live itself **decides when to delegate** by emitting `<|SpawnThinking|>`, steered by the "Delegation policy" section of its prompt ([Prompting GPT-Live](https://developers.openai.com/api/docs/guides/live-prompting)). The `session.delegation.created` event "does **not** contain the user's utterance or task text". You reconstruct it from `session.input_transcript.delta` / `session.output_transcript.delta` (with `start_ms`/`end_ms`) and your own state.
   - Results go back through `session.commentary.append` (spoken; "it is trained to paraphrase the text"), `session.thinking.append` (silent context) or `session.instructions.append` (may interrupt). Each append is limited to **500 tokens**.
   - Interruptions do not cancel backend work. Your app versions tasks and drops stale results.
   - **Meaning for roleplay:** the agent graph can act as the "author", but GPT-Live is the **performer**. It speaks its own words between delegations and paraphrases yours, so lorebook-grounded character lines are not delivered verbatim. Persona and voice style must also live in GPT-Live's own `instructions` (up to 16,384 tokens). Turns where GPT-Live does not delegate are generated by OpenAI's model under OpenAI's moderation ("Some moderation events end the session"; others cut the current audio) ([Managing sessions](https://developers.openai.com/api/docs/guides/live-conversations)).
2. **User clones in realtime: no, not at Magic Worlds scale.**
   - The voice is fixed per session ("Start a new session to change it").
   - There are 21 stock voices, none Spanish (EN/PT/DE/FR/HI/JA/KO; nine of the non-English voices were added on 2026-10-16 per the changelog).
   - **Prompt-to-voice** is available to all API customers (since 2026-10-16), free to create, max **100 per org**, GPT-Live only, and may not imitate "a named person, public figure, or fictional character".
   - **From a recording:** "limited to eligible customers" through sales, **max 20 per org**, a sample of 30 s or less, and a **consent recording in which the voice owner reads a fixed phrase** ([Custom voices](https://developers.openai.com/api/docs/guides/custom-voices)).
   - **Accent limit:** "`gpt-live-1` supports custom voices with English accents" (same guide; see C6). A Spanish character voice is therefore not a documented option.
   - Existing ElevenLabs IVC/PVC voices cannot be imported.
3. **Cascaded? No.** The model page calls it "a full-duplex voice model… It can listen and speak at the same time, and delegate reasoning and tool use to a backend agent" ([model page](https://developers.openai.com/api/docs/models/gpt-live-1)).
   - **Latency:** OpenAI publishes no TTFA. AA measured ≈ 1.24 s (Sol, low) to 1.34 s (Astra, medium) TTFA with Conversational Dynamics 97.3% / 94.9% and S2S Index 80.1 / 83.2 (re-checked on the [AA speech-to-speech page](https://artificialanalysis.ai/speech-to-speech) on 2026-10-20). Delegated answers add backend time, which GPT-Live covers with backchannels or acknowledgements.
   - **Expressiveness:** native audio generation, overlap and backchannels.
4. **Exact text: no.** "GPT-Live may paraphrase the greeting, add words, or remain silent." For disclosures, `session.instructions.append` "Immediately say the following disclosure exactly…" is a request, not a guarantee. "For exact wording… play a verified recording or rendered clip through your application and control GPT-Live output while it plays" ([Managing sessions](https://developers.openai.com/api/docs/guides/live-conversations); [server controls](https://developers.openai.com/api/docs/guides/voice-server-controls)). GPT-Live has no output VAD. To check speech before playback, you buffer audio yourself.
5. **Full price:** **$0.05 per minute of session time, billed per second**, with silence and mute included. A WebRTC session bills 15 s at creation, credited against duration. Backend model and tool usage is billed separately; with client delegation that is your own agent-graph cost. Concurrency: 50 / 300 / 500 sessions (Build / Launch / Grow); no free tier ([model page](https://developers.openai.com/api/docs/models/gpt-live-1); [cost guide](https://developers.openai.com/api/docs/guides/voice-latency-cost)). **≈ $0.05/min + current LLM cost**, compared with the current cascade's STT + TTS cost.

### 2.4 xAI Grok Voice 3.0 (Speech to Speech API)

1. **Custom LLM: no.** The model is `grok-voice-3.0` / `grok-voice-latest`, with reasoning `high|none` ([S2S doc](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech)). No text-only output mode is documented, so a Grok-ears + own-TTS half-cascade is not possible from the docs.
   - **Theoretical workaround (untested, not recommended):** use manual turn mode (`turn_detection: null`), read `conversation.item.input_audio_transcription.completed`, run your own LLM, and push each sentence as a `force_message`. This turns a $4.80/hr session into an STT+TTS shell. xAI's standalone TTS ($15/1M chars) and streaming STT ($0.20/hr) cost far less for the same job ([pricing](https://docs.x.ai/developers/pricing)).
2. **Clones in realtime: documented yes, contested in practice (C4).** Constraints that matter for user-generated characters:
   - **30 custom voices per team** by default (more via sales).
   - `POST /v1/custom-voices` is **Enterprise-only**; console creation is free up to 30.
   - Reference clips of up to 120 s.
   - **US-only, excluding Illinois.**
   - These are xAI clones, so the team would have to re-clone from source audio. ElevenLabs voices cannot be imported.
3. **Internally:** the docs imply a text stage followed by TTS on output. `replace` is "applied to the model's output **before TTS**", and `force_message` is "TTS-synthesized". Input is the model's own audio path; input transcripts come from a separate `grok-transcribe`.
   - **Latency:** AA TTFA 0.81 s; S2S Index 86.9, still the highest S2S Index among the models listed on the [AA page](https://artificialanalysis.ai/speech-to-speech) on 2026-10-20 (Grok Voice 2.0 had a faster 0.70 s TTFA but a lower 81.3 index).
   - **Practical knobs:** speed 0.7–1.5, 100 key terms, and Spanish only as `es-MX`/`es-ES` (bare `es` is rejected).
4. **Exact text: yes.** `conversation.item.create` with `item.type: "force_message"` makes the agent "speak a **hard-coded, TTS-synthesized line** without involving the model", optionally with `interruptible: false`. This is an xAI extension and not part of the OpenAI protocol.
5. **Full price:** **$0.08/min ($4.80/hr) + $0.004 per text input** ([pricing](https://docs.x.ai/developers/pricing); Grok Voice 3.0 is "at the same price as Grok Voice 2.0" per the [release notes](https://docs.x.ai/developers/release-notes)). That model tokens are included and server-side tools are billed separately is **(unverified)**: neither the pricing page nor the S2S doc states it on 2026-10-20. Policy for 18+ fiction is not documented on fetched pages (r07: unverified).

### 2.5 Ultravox Realtime

1. **Custom LLM: no (hosted).** Model strings are `ultravox-v0.7` (GLM 4.6, default since 2025-12-22), `ultravox-v0.6` / `-llama3.3-70b`, and `ultravox-v0.6-gemma3-27b` ([News 2025-12-03](https://docs.ultravox.ai/changelog/news.md); [Create Call](https://docs.ultravox.ai/api-reference/calls/calls-post.md): "Currently defaults to ultravox-v0.7").
   - The open weights are **MIT**: an audio projector plus the whisper-large-v3-turbo encoder on a "pre-trained LLM (GLM, Llama, Gemma, Qwen, etc) backbone" ([HF model card](https://huggingface.co/fixie-ai/ultravox-v0_7-glm-4_6), modified about 2026-10-08 per the fixie-ai org listing; the card itself shows no date). A self-hosted Ultravox lets you choose the backbone, but **not** your multi-step agent graph.
   - The graph can only be reached as tools, which means paraphrase. Note the `SetOutputMedium` data message: text output lets you send your own TTS, but the words are still Ultravox's.
2. **Clones: yes via BYO TTS.** `externalVoice.elevenLabs: {voiceId, model}` uses ElevenLabs' streaming WebSocket with "character-level timing… ensuring … conversation history accurately reflects what was spoken in the event of an interruption" ([BYO TTS](https://docs.ultravox.ai/voices/bring-your-own.md)). Any voice your ElevenLabs key can use works, IVC/PVC included (constrained by ElevenLabs model/PVC compatibility; the doc's example uses `eleven_turbo_v2_5`). Native clones are 1 per account in the docs and 5 on Pro in pricing (C7).
3. **Internally: half-cascade.** It "understands speech directly without relying on traditional ASR pipelines", outputs text, and an external TTS speaks it.
   - **Latency:** 0.864 s median in a Pipecat-run benchmark (vendor-published, r01). Removing ASR helps, but output still waits on TTS first-byte.
   - **Expressiveness:** user prosody reaches the LLM; output expressiveness depends on the TTS.
4. **Exact text: yes.** `forced_agent_message` "forces the agent to say a specific message or invoke tools" ([Data messages](https://docs.ultravox.ai/apps/datamessages.md)).
5. **Full price:** **$0.05/min** pay-as-you-go (30 free minutes, max 5 concurrent), with Pro $100/mo removing concurrency caps; SIP is 0.5¢/min ([pricing](https://www.ultravox.ai/pricing), 2026-10-09). LLM inference is included (the v0.7 news entry says the call rate "stays at our standard $0.05 per minute rate"). The pricing page also lists separate "Threads" token pricing ($2.00/1M input, $15.00/1M output); that appears to be a different product and does not apply to calls (unverified). **BYO TTS characters are billed by ElevenLabs on your key** (an inference from the BYO doc's quota errors). Whether built-in TTS is included is not stated. Calls default to `maxDuration` 1 h ([Create Call](https://docs.ultravox.ai/api-reference/calls/calls-post.md)).
   - **Spanish:** Spanish is one of 26 listed languages ([overview](https://docs.ultravox.ai/overview.md)). The only Spanish metric is CoVoST2 es→en BLEU **42.88** for v0.7 (vendor model card). That measures speech *understanding*, not Spanish conversational output. **No primary-source evidence of Spanish roleplay quality exists.** Output quality in Spanish would be that of the chosen ElevenLabs voice and model.
   - **Ownership (corrected in the fact-check):** Ultravox's cloning doc routes extra-voice requests to an `@inworld.ai` support address because **Inworld acquired Ultravox on 2026-09-30** ([Inworld blog](https://inworld.ai/blog/inworld-acquires-ultravox)). Inworld says existing agents keep running with no migration, built-in Ultravox voices now run on Inworld **Realtime TTS-2** (existing voice IDs still work), agents using other providers' voices (for example BYO ElevenLabs) are unchanged, and Inworld plans to combine its TTS-2/STT-1 models with Ultravox's speech understanding. Expect product and pricing churn; the adapter-layer advice in §5(a) applies.

### 2.6 Qwen Omni Realtime (`qwen3.8-omni-flash-realtime`; Alibaba Cloud Model Studio)

1. **Custom LLM: no.** The Qwen model is the brain. `modalities: ["text"]` gives "text-only output" ([realtime doc](https://www.alibabacloud.com/help/en/model-studio/realtime), updated 2026-10-16), so Qwen can be used as an audio-in LLM with your own TTS. That keeps clones but still not the agent graph.
2. **Clones in realtime: yes, explicitly documented.** The [Omni voice cloning API](https://www.alibabacloud.com/help/en/model-studio/qwen-omni-voice-cloning) (updated 2026-10-11) says to "Clone a voice from 10–20 seconds of audio without training" (60 s max, 24 kHz or higher, mono). Clones are created with `qwen-voice-enrollment` and a `target_model` that **must match** the realtime model (`qwen3.8-omni-flash-realtime`, `qwen3.5-omni-plus/flash-realtime`), then used via `session.audio.output.voice`.
   - **Quota:** 1,000 voices per account. Voices unused for one year are auto-deleted.
   - **Price:** $0.01 per voice, with 1,000 free creations in the first 90 days.
   - **Languages:** Spanish is in the supported cloning languages.
   - These are **Qwen clones, not ElevenLabs IVC/PVC**, so voices must be re-cloned from source audio, and voice parity with today's characters is not guaranteed.
   - **Content gate:** scripts containing "political, pornographic, or violent material… cause cloning to fail".
3. **Internally: native end-to-end.** Qwen3-Omni is "natively end-to-end" with an "MoE-based Thinker–Talker design" ([Qwen3-Omni README](https://github.com/QwenLM/Qwen3-Omni), 2025-09-22, older than 12 months, architecture family only). The 3.8 page claims full-duplex (C5).
   - **Latency:** no number for 3.8 (AA does not list Qwen3.8 Omni Flash Realtime as of 2026-10-20). Related figures: Qwen3-Omni on DashScope ≈ 702 ms audio-to-audio (Salesforce arXiv 2603.05413, via r01; unverified here), and AA Qwen3.5 Omni Flash Realtime 0.79 s TTFA with only 59% on Big Bench Audio (re-checked on AA 2026-10-20).
   - Retained context is capped at 100 audio turns / 600 s of audio. A WebSocket session lasts up to **120 min**.
4. **Exact text:** not documented.
5. **Full price:** tokens only ([pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing), updated 2026-10-19).
   - **Singapore rates:** text-in $0.23, audio-in $0.93, text-out $0.70, **audio-out $1.87 per 1M tokens**. 3.8 bills both output audio and its transcript.
   - **Token rates:** audio is 7 tokens/s in and 12.5 tokens/s out, with sub-second audio billed as 1 s. **History is re-billed every turn**.
   - **Estimate** (8k text context × 4 turns + about 5 min of retained audio + 30 s of output per minute): **≈ $0.01–0.03/min**. That is the cheapest option here by roughly 3–8×.
   - **Residency:** the region sets "access point and data storage location". Singapore uses the **International scope ("global nodes excluding Chinese mainland")** for inference; Beijing is the alternative ([Singapore region info](https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information), 2026-10-13). The Omni Realtime docs list **no US or EU region** (the realtime page: "Supported regions: Singapore, China (Beijing)"). The non-realtime `qwen3.8-omni-flash` is listed for more regions, including Germany and the US, on the [pricing page](https://www.alibabacloud.com/help/en/model-studio/model-pricing), but it is not the realtime WebSocket product.

---

## 3. Compatibility matrix against Magic Worlds requirements

| Requirement | Eleven Realtime | EL Speech Engine | GPT-Live-1 | Grok Voice 3.0 | Ultravox | Qwen 3.8 Omni RT |
|---|---|---|---|---|---|---|
| Agent graph is the LLM | ✗ | ✓ | ◐ backend only (paraphrased) | ✗ | ✗ (tools only) | ✗ |
| Lorebook context per turn | ◐ (KB / prompt) | ✓ (your server) | ◐ (`thinking.append`, 500 tok) | ◐ (prompt/tools) | ◐ (prompt/RAG/tools) | ◐ (prompt/tools) |
| Existing ElevenLabs IVC/PVC voices | ◐ probable, untested | ✓ | ✗ | ✗ (re-clone in xAI) | ✓ (BYO ElevenLabs) | ✗ (re-clone in Qwen) |
| Clone count for a user catalogue | ElevenLabs plan limits | ElevenLabs plan limits | 20 recorded / 100 prompt per org | 30/team (sales for more) | ElevenLabs plan limits | 1,000/account |
| Voice change mid-call (multi-character) | Multi-voice tags (if honoured) | Multi-voice | ✗ (new session) | Unknown | Unknown | Unknown |
| Spanish | 90+ langs | ElevenLabs langs | No ES voice listed; custom voices English accents only | es-MX/es-ES | Listed; no output eval | 36 output langs; ES clones |
| Verbatim safety lines | First message / Say node | ✓ `send_response` | ✗ (play own clip) | ✓ `force_message` | ✓ `forced_agent_message` | ✗ (play own clip) |
| Internal architecture | Cascade | Cascade | Native full-duplex | Model + TTS output | Audio-LLM + TTS | Native Thinker–Talker |
| TTFA (best available) | 0.57–0.62 s (vendor; same on AA) | n/p | ≈1.24–1.34 s (AA) | 0.81 s (AA) | 0.86 s median (vendor, r01; unverified here) | n/p for 3.8 |
| All-in $/min (list) | ≈0.084 Mini / ≈0.10–0.15 Max | 0.08 + own LLM | 0.05 + own LLM | 0.08 (+$0.004/text in) | 0.05 + ElevenLabs TTS | ≈0.01–0.03 |

(✓ yes, ◐ partial, ✗ no, n/p not published)

---

## 4. What "cascaded internally" means here

- **Eleven Realtime is evidence, not an exception.** The vendor with the lowest published S2S TTFA (≈0.57–0.62 s) says its product is a cascade of distinct models, tuned and co-located. That supports the thesis in r01/r07 that a well-engineered cascade can reach S2S-class latency. Magic Worlds' latency gap comes from orchestration choices: batch STT with no partials, sentence buffering and MP3. It does not come from the cascaded architecture itself.
- **For expressiveness, cascades lose input paralinguistics** unless the STT/turn model passes them on. ElevenAgents' expressive mode uses "real-time signals from Scribe v2 Realtime — including emotional cues and speech patterns" ([Expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)). In Realtime mode, expressive mode is a *managed* setting that you cannot toggle.
- **For safety, cascades keep a text checkpoint.** xAI's `replace` and `force_message`, Ultravox's text output and ElevenLabs' guardrails all depend on text existing before audio. GPT-Live (native) has no such checkpoint, so OpenAI's guidance is to buffer audio in your own player.

---

## 5. Practice and pitfalls

**(a) Established best practice**
- Treat "S2S product" claims as architecture-agnostic until the vendor's FAQ says otherwise. Eleven Realtime is cascaded, Grok output passes through TTS, and Ultravox is a half-cascade.
- Deliver safety-critical lines (crisis resources, 18+ disclaimers, break nudges) as **app-controlled pre-rendered clips or verbatim TTS**. OpenAI states plainly that GPT-Live cannot guarantee wording.
- Keep an adapter layer between the call loop and any voice vendor. Ultravox's 2025-12 model switch and Grok Voice 2.0's deprecation within months show how fast vendors churn.

**(b) Current SOTA and leading options for this question**
- *Keeps own LLM:* GPT-Live client delegation (full-duplex voice layer, paraphrased output) and ElevenLabs Speech Engine (managed cascade).
- *Keeps clones:* Ultravox + ElevenLabs externalVoice, Qwen 3.8 Omni Realtime (Qwen clones), and Grok Voice 3.0 (xAI clones, contested in practice).
- *Lowest vendor-reported TTFA:* Eleven Realtime Max at 0.57 s, which is a cascade.

**(c) Emerging or experimental**
- "Fast talker + slow thinker" delegation (GPT-Live) adapted to authored dialogue. This needs a way to force verbatim delivery, which no vendor offers yet.
- Speculative turn generation inside managed cascades (`speculative_turn` in Speech Engine).
- Force-message shells: driving an S2S socket with your own LLM text (xAI `force_message`, Ultravox `forced_agent_message`). This is possible but pays S2S per-minute rates for what is effectively TTS.

**(d) Pitfalls and anti-patterns**
- Assuming "Realtime" works with your existing ElevenAgents custom-LLM agent. Publishing fails, and transfers between modes are rejected.
- Assuming per-minute S2S includes the LLM. Eleven Realtime adds tokens, and GPT-Live adds backend tokens.
- Building character voice on vendor-locked clones (OpenAI 20/org with consent recordings; xAI 30/team, US-only; Ultravox 1–5) in a product where users create characters.
- Relying on LiveKit or other framework plugins to expose vendor clone features. LiveKit staff confirmed their Grok plugin officially supports only default voices.
- Ignoring session caps: Eleven Realtime API defaults to 600 s, Speech Engine defaults to 600 s and is capped at 2,400 s (40 min), Ultravox calls default to 1 h, and Qwen WebSocket sessions are capped at 120 min.

---

## 6. Implications for Magic Worlds (prioritised)

1. **P0: Keep the cascade as the character-call architecture.** None of the five S2S products keeps both the agent graph (persona + lorebook + safety logic) and the per-character ElevenLabs voices. Spend the effort on cascade latency instead: streaming STT with partials, speculative/eager turn detection, first-clause TTS, and PCM/Opus output. Eleven Realtime's 0.57–0.62 s cascade shows the ceiling is achievable without S2S.
2. **P1: Run a half-day Eleven Realtime verification spike**, because it is the only S2S option that could keep the voices. Check, in ElevenAgents Realtime mode and through the Realtime API:
   - whether the workspace has access (rolling out);
   - whether an **IVC** and a **PVC** character voice are honoured, in EN and ES;
   - whether multi-voice XML tags work;
   - whether the first message and a Literal Say node are spoken verbatim;
   - measured TTFA from the Magic Worlds region;
   - the effective $/min, including cached-input pricing from usage.

   Treat it as at most a **"lite / quick chat" mode**, because the LLM, ASR and TTS model are ElevenLabs-managed. Lore must be pushed through the prompt or knowledge base, and ElevenLabs' content policy governs 18+ fiction.
3. **P1: Benchmark ElevenLabs Speech Engine against the self-orchestrated cascade.** It keeps the agent graph and clones, adds `turn_v3`, `speculative_turn` and `eleven_v4_turbo`, and costs $0.08/min + LLM. Compare that with the current Groq STT + ElevenLabs/Fish TTS bill and measured latency. Note the inverted connectivity (ElevenLabs connects to a public `wss` on the backend), the **40-min cap**, and that Fish voices would be dropped. *(Added in the fact-check)* The Inworld Realtime API (§7) is a second managed-cascade candidate. Shortlist it only if Inworld confirms that a custom LLM endpoint and cloned voices work in Realtime sessions.
4. **P2: Use GPT-Live only where paraphrase is acceptable.** A good fit is the in-app assistant voice (`features/appAssistant`), with client delegation to the existing assistant graph, at $0.05/min + backend. Do not use it for characters: there are no user clones at scale, custom voices support English accents only, there are no verbatim lines, and the voice is fixed per session.
5. **P2: Test Grok custom voices (C4) only if xAI becomes a TTS candidate.** Its value to Magic Worlds is the cheap **TTS/STT APIs with clones** inside the cascade, not the S2S session. Clone limits (30/team, API Enterprise-only, US-only except Illinois) must be cleared with sales first.
6. **P3: Park Ultravox and Qwen for now.**
   - **Ultravox + ElevenLabs externalVoice** keeps clones and removes STT at $0.05/min. It replaces the agent graph with GLM 4.6 and has no Spanish output evaluation. Ultravox is now an Inworld product (acquired 2026-09-30), so its roadmap and pricing may change.
   - **Qwen 3.8 Omni Realtime** is the cheapest (≈$0.01–0.03/min) and has realtime clones at scale (1,000/account). It replaces the LLM, uses Qwen re-clones rather than ElevenLabs voices, stores data in Singapore/Beijing, and its cloning rejects "pornographic" content.

   Revisit either one only if the team accepts losing the agent graph.
7. **For every option:** make the `safety` feature's crisis lines and break nudges app-played clips or verbatim TTS, and record per-call COGS by vendor unit (connected seconds, tokens, characters) before any pilot.

### Verification checklist (to close the remaining unknowns)
- [ ] Eleven Realtime: IVC voice_id honoured (ElevenAgents mode, Realtime API `audio.output.voice`).
- [ ] Eleven Realtime: PVC honoured; behaviour if the PVC is not trained for the managed TTS.
- [ ] Eleven Realtime: Literal Say node + first message verbatim; multi-voice tags.
- [ ] Eleven Realtime: Spanish TTFA and quality with a cloned Spanish voice.
- [ ] Grok: clone ID on `session.update` (console clone and API clone; US team).
- [x] GPT-Live: "English accents only" is confirmed for custom voices in `gpt-live-1` (custom voices guide; fact-check 2026-10-20). Still open: whether a prompt-to-voice description asking for a Spanish accent is rejected or just ignored.
- [ ] Inworld Realtime API (new): whether a cloned Inworld voice (including ones migrated from ElevenLabs IVCs) is accepted as `audio.output.voice`, and whether the LLM can be a self-hosted OpenAI-compatible endpoint.
- [ ] Speech Engine: silence discount, measured TTFA, and the PVC-on-v4 rollout state.
- [ ] Qwen: whether previous assistant audio is re-billed as input audio in history (affects the $/min estimate).

---

## 7. Newer developments found in the 2026-10-20 fact-check

These were missing from the original notes. Each was read on a primary page on 2026-10-20.

1. **Inworld acquired Ultravox (2026-09-30)** and runs its own **Realtime API**, which is relevant to this question.
   - The [Inworld Realtime API](https://docs.inworld.ai/realtime/overview.md) follows the OpenAI Realtime protocol over WebSocket **or WebRTC**. It chains STT (default `inworld/inworld-stt-1`), an LLM you pick per session as `provider/model` or an Inworld router (default `google-ai-studio/gemini-2.5-flash`, changeable mid-session), and TTS (`inworld-tts-2` or `inworld-tts-2-flash`) ([using realtime models](https://docs.inworld.ai/realtime/usage/using-realtime-models.md)).
   - Billing is per component (STT seconds, LLM tokens, TTS characters). "There is no per-minute or per-session price" ([billing](https://docs.inworld.ai/portal/billing.md)).
   - Inworld TTS has instant and (beta) professional voice cloning, and an [ElevenLabs migration tool](https://docs.inworld.ai/tts/resources/elevenlabs-migration.md) that **re-clones user-created ElevenLabs voices from their source samples** (stock and professional ElevenLabs voices are excluded).
   - **Not documented (unverified):** whether cloned voice IDs are accepted in Realtime sessions, whether the LLM can be a self-hosted/custom endpoint (that is, the Magic Worlds agent graph), and any verbatim-speech event. If both were possible, Inworld Realtime would be a managed cascade comparable to ElevenLabs Speech Engine but with Inworld clones. It is not S2S; it is a cascade like Eleven Realtime.
   - [Realtime TTS-2](https://inworld.ai/blog/realtime-tts-2) (GA 2026-08-31): vendor-reported sub-200 ms median TTFA for the TTS layer, 100+ languages including Spanish, cloning from 5–15 s of audio.
2. **OpenAI GPT-Live updates** ([changelog](https://developers.openai.com/api/docs/changelog)):
   - 2026-10-15: a native **Decisions** integration lets an app act while the user is speaking, or react to what Live says, either through native delegation or on transcript deltas.
   - 2026-10-16: prompt-to-voice opened to all API customers, and nine new non-English stock voices were added (DE/FR/HI/JA/KO; still no Spanish).
   - 2026-10-20: 12-hour prompt caching on the Responses API (cache writes cost 2.5× the input price). This could lower backend cost for a client-delegation backend that runs on OpenAI models.
   - Streaming STT `gpt-live-transcribe` launched 2026-07-28. `whisper-1` and several gpt-4o transcription models shut down on 2027-02-26 (this does not affect Magic Worlds' Groq whisper-large-v3).
3. **Google Gemini 3.8 Live** appears on the [AA S2S leaderboard](https://artificialanalysis.ai/speech-to-speech) (1.18 s TTFA, Conversational Dynamics 96.1%, S2S Index 76.0). Gemini 3.8 Flash TTS and Flash-Lite TTS now support [voice replication](https://ai.google.dev/gemini-api/docs/voice-replication). It needs a 10–30 s reference plus a consent recording from the same adult speaker (consent scripts in 30 locales), with up to 200 stored voices per project. Whether replicated voices work in the **Live API** is not stated (unverified). Gemini Live was not evaluated against the five questions in this note.
4. **ElevenLabs**: Eleven v4 and v4 Turbo were announced on 2026-09-28 and added as conversational TTS options on 2026-10-05. The 2026-10-12 changelog adds "turn prediction for realtime Speech to Text". Both are relevant to the self-orchestrated cascade (P0/P1 in §6).
5. **xAI**: Grok Voice shipped three major versions in 2026 (1.0 in April, 2.0 in July, 3.0 in October; 2.0 is already deprecated). STT moved to `grok-voice-transcribe-2.0` (September); 1.0 reached end of life on 2026-10-02. That supports the §5(a) churn warning.
6. **Alibaba**: separate `qwen-audio-3.x-realtime` "Real-time Voice Chat" models are priced on the same page. `qwen-audio-3.0-realtime-flash` has the same Singapore rates as `qwen3.8-omni-flash-realtime`, and `-plus` costs $0.8 / $6.4 / $6.4 / $24 per 1M. The pricing page does not describe them as omni models or mention cloning for them; not evaluated here.

---

## Sources (all fetched 2026-10-20; publication or update date given where the page shows one)

ElevenLabs
- Realtime models (ElevenAgents doc; undated): https://elevenlabs.io/docs/eleven-agents/customization/realtime-models
- OpenAI Realtime API compatibility (incl. "cascaded architecture" FAQ; undated): https://elevenlabs.io/docs/eleven-agents/guides/openai-realtime-compatibility
- Create realtime client secret (API reference; undated): https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/create-client-secret
- Eleven Realtime launch blog (2026-10-20, Min Kim): https://elevenlabs.io/blog/realtime
- Eleven Realtime landing page (undated): https://elevenlabs.io/realtime
- API pricing (Realtime + Speech Engine rows; fetched 2026-10-20): https://elevenlabs.io/pricing/api
- ElevenAgents pricing (fetched 2026-10-20): https://elevenlabs.io/pricing/agents
- Speech Engine overview: https://elevenlabs.io/docs/overview/capabilities/speech-engine
- Speech Engine quickstart: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/speech-engine
- Create Speech Engine (API reference): https://elevenlabs.io/docs/api-reference/speech-engine/create
- Speech Engine Python SDK reference: https://elevenlabs.io/docs/eleven-api/resources/libraries/speech-engine/python-sdk-reference
- Voice customization (ElevenAgents): https://elevenlabs.io/docs/eleven-agents/customization/voice
- Multi-voice support: https://elevenlabs.io/docs/eleven-agents/customization/voice/multi-voice-support
- Workflows (Say node, Literal mode): https://elevenlabs.io/docs/eleven-agents/customization/agent-workflows
- Expressive mode: https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode
- Eleven v4 (IVC/PVC status): https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
- How much does ElevenAgents cost (help center): https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost
- What is Live Moderation (help center): https://elevenlabs.io/docs/help-center/product/voices/voice-library/what-is-live-moderation
- Changelog (latest entry 2026-10-12; Realtime config default added in the 2026-08-03 schema changes): https://elevenlabs.io/docs/changelog

OpenAI
- Getting started with GPT-Live (undated): https://developers.openai.com/api/docs/guides/live
- GPT-Live 1 model page (undated): https://developers.openai.com/api/docs/models/gpt-live-1
- Delegation and tools in GPT-Live: https://developers.openai.com/api/docs/guides/live-delegation
- Managing GPT-Live sessions: https://developers.openai.com/api/docs/guides/live-conversations
- Prompting GPT-Live: https://developers.openai.com/api/docs/guides/live-prompting
- Custom voices: https://developers.openai.com/api/docs/guides/custom-voices
- Voice agents (architecture comparison): https://developers.openai.com/api/docs/guides/voice-agents
- Migrate to GPT-Live: https://developers.openai.com/api/docs/guides/live-migration
- Server-side controls (playback control, check speech before playback): https://developers.openai.com/api/docs/guides/voice-server-controls
- Cost optimization (voice latency and cost): https://developers.openai.com/api/docs/guides/voice-latency-cost

xAI
- Custom Voices: https://docs.x.ai/developers/model-capabilities/audio/custom-voices
- Speech to Speech (Grok Voice 3.0, `force_message`, `replace`, languages): https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech
- Pricing (Voice Pricing table): https://docs.x.ai/developers/pricing
- Release notes (May 2026 Custom Voices; Oct 2026 Grok Voice 3.0): https://docs.x.ai/developers/release-notes
- LiveKit Community thread on Grok clones (2026-05-14 to 2026-05-15): https://community.livekit.io/t/grok-realtimemodel-not-accepting-custom-xai-voice-clone-only-default-voices-work/1117

Ultravox
- Overview (26 languages): https://docs.ultravox.ai/overview.md
- How Ultravox works: https://docs.ultravox.ai/gettingstarted/how-ultravox-works.md
- Voice cloning (one clone per account): https://docs.ultravox.ai/voices/cloning.md
- Bring your own TTS (ElevenLabs externalVoice): https://docs.ultravox.ai/voices/bring-your-own.md
- Data messages (`forced_agent_message`, `set_output_medium`): https://docs.ultravox.ai/apps/datamessages.md
- Create Call API (default model `ultravox-v0.7`): https://docs.ultravox.ai/api-reference/calls/calls-post.md
- News (2025-12-03, v0.7 GLM 4.6 default from 2025-12-22): https://docs.ultravox.ai/changelog/news.md
- Pricing (page metadata 2026-10-09): https://www.ultravox.ai/pricing
- Ultravox v0.7 model card (modified about 2026-10-08 per the org listing): https://huggingface.co/fixie-ai/ultravox-v0_7-glm-4_6

Alibaba Cloud / Qwen
- Qwen-Omni-Realtime (updated 2026-10-16): https://www.alibabacloud.com/help/en/model-studio/realtime
- Omni voice cloning API (updated 2026-10-11): https://www.alibabacloud.com/help/en/model-studio/qwen-omni-voice-cloning
- Model inference pricing (updated 2026-10-19): https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Regions (updated 2026-10-13): https://www.alibabacloud.com/help/en/model-studio/regions
- Singapore region access info (updated 2026-10-13): https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information
- Qwen3-Omni README (2025-09-22; more than 12 months old, architecture only): https://github.com/QwenLM/Qwen3-Omni

Sibling notes cited for latency/benchmarks (not re-verified here): `r01-cascaded-architecture.md`, `r07-speech-to-speech-omni.md`, `r10-cost-scaling-ops.md`.

---

## Fact-check log (2026-10-20)

An independent fact-check on 2026-10-20 re-read primary pages with WebFetch. The shared WebSearch budget was exhausted, so no search-engine results were used; newer developments were found by browsing vendor changelogs, blogs and docs indexes. Verdicts: **confirmed** (the primary source matches), **corrected** (the note was wrong or incomplete and has been edited), **unverified** (no primary source found; marked in the text).

| # | Claim (as originally written) | Verdict | Fix / note | Source |
|---|---|---|---|---|
| 1 | Eleven Realtime v1 Mini/Max launched 2026-10-20 (blog by Min Kim) | Confirmed | — | https://elevenlabs.io/blog/realtime |
| 2 | Realtime mode is unavailable with a custom LLM or Amazon Bedrock; the LLM, TTS model, ASR provider and expressive mode are managed settings | Confirmed | — | https://elevenlabs.io/docs/eleven-agents/customization/realtime-models |
| 3 | Eleven Realtime is a cascade ("not fused") | Confirmed | Quoted from the compatibility-guide FAQ. The blog markets it as "Speech to Speech models" | https://elevenlabs.io/docs/eleven-agents/guides/openai-realtime-compatibility |
| 4 | Eleven Realtime price: $0.08/connected min, burst $0.16; tokens Mini $0.20/$6.00, Max $1.80/$9.00 per 1M; cached input not listed; included-minute estimates per plan | Confirmed | The plan-to-row mapping is still an inference | https://elevenlabs.io/pricing/api |
| 5 | TTFA 570 ms (Max) / 620 ms (Mini) averaged on Big Bench Audio; tool use 87.1% / 60.3%; Full-Duplex-Bench 94.1% / 95.8% | Confirmed | AA lists the same TTFA. Big Bench Audio: Max 98.8%, Mini 75.9% | https://elevenlabs.io/realtime ; https://elevenlabs.io/blog/realtime ; https://artificialanalysis.ai/speech-to-speech |
| 6 | Realtime API: WebSocket only, no WebRTC "at launch"; `model` allows only `eleven_realtime_v1_mini`/`_max`; `audio.output.voice` defaults to `"brian"`; `max_duration_seconds` defaults to 600 | Confirmed | The WebRTC statement comes from the landing-page FAQ, not the Realtime models doc; the attribution was corrected | https://elevenlabs.io/realtime ; https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/create-client-secret |
| 7 | Speech Engine: any LLM; `tts.model_id` default `eleven_v4_turbo`; `turn_v3` default; `speculative_turn`; `cascade_timeout_seconds` 2–15 (default 4); conversations 600 s by default, 40 min max | Confirmed / corrected | Values confirmed (max is 2,400 s). Corrected the attribution: these come from the API reference; the changelog (2026-09-21) mentions only `cascade_timeout_seconds` | https://elevenlabs.io/docs/api-reference/speech-engine/create ; https://elevenlabs.io/docs/overview/capabilities/speech-engine ; https://elevenlabs.io/docs/changelog |
| 8 | ElevenAgents silence discount: 95% for silences over 10 s; LLM passed through | Confirmed | Whether it applies to Speech Engine is still unstated | https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost |
| 9 | Eleven v4 PVC support is "rolling out"; on Realtime agents "the voice still applies"; live-moderation voices are blocked in ElevenAgents | Confirmed | Eleven v4 was announced 2026-09-28 | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 ; https://elevenlabs.io/docs/eleven-agents/customization/voice |
| 10 | GPT-Live-1 GA 2026-09-10; $0.05/min billed per second; silence and mute billed; WebRTC bills 15 s at creation, credited later; concurrency 50/300/500; no free tier | Confirmed | GA date now sourced from the OpenAI changelog rather than r07 | https://developers.openai.com/api/docs/changelog ; https://developers.openai.com/api/docs/models/gpt-live-1 ; https://developers.openai.com/api/docs/guides/voice-latency-cost |
| 11 | GPT-Live client delegation: "connect any model, agent harness, or service"; mode immutable; appends capped at 500 tokens; `commentary.append` is paraphrased; `delegation.created` carries no task text; interruption does not cancel backend work | Confirmed | The quote is on the getting-started page; the delegation page words it as "any model, agent, or service your application operates" | https://developers.openai.com/api/docs/guides/live ; https://developers.openai.com/api/docs/guides/live-delegation |
| 12 | GPT-Live: 21 stock voices, none Spanish; voice fixed per session; instructions up to 16,384 tokens; greeting may be paraphrased; exact wording needs your own clip | Confirmed | Nine of the voices were added on 2026-10-16 | https://developers.openai.com/api/docs/guides/live-conversations |
| 13 | C6: "English accents only" for GPT-Live custom voices is not on the primary pages, so treat it as unverified or stale | **Corrected** | The custom voices guide says "`gpt-live-1` supports custom voices with English accents". C6, the TL;DR, §2.3, the §3 matrix, §6 P2 and the checklist were updated | https://developers.openai.com/api/docs/guides/custom-voices |
| 14 | GPT-Live custom voices: 100 prompt voices/org; recorded voices sales-gated, 20/org, ≤30 s, consent phrase in 16 languages including Spanish; no imitation of fictional characters | Confirmed | Prompt-to-voice opened to all API customers on 2026-10-16 | https://developers.openai.com/api/docs/guides/custom-voices ; https://developers.openai.com/api/docs/changelog |
| 15 | xAI custom voices: usable on `wss://api.x.ai/v1/realtime` via `session.update`; 30/team; `POST /v1/custom-voices` Enterprise-only; clips up to 120 s; US only except Illinois; team-scoped | Confirmed | — | https://docs.x.ai/developers/model-capabilities/audio/custom-voices |
| 16 | LiveKit thread (2026-05-14/15): staff said "we only support the default voices" | Confirmed | No later fix in the thread; LiveKit's xAI plugin docs still show only stock-voice defaults | https://community.livekit.io/t/grok-realtimemodel-not-accepting-custom-xai-voice-clone-only-default-voices-work/1117 ; https://docs.livekit.io/agents/models/realtime/plugins/xai/ |
| 17 | Grok Voice 3.0: `grok-voice-latest` alias; reasoning high/none; `force_message` verbatim TTS with `interruptible`; `replace` before TTS; speed 0.7–1.5; 100 keyterms; `es-MX`/`es-ES` only | Confirmed | Grok Voice 2.0 is deprecated (October release notes) | https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech ; https://docs.x.ai/developers/release-notes |
| 18 | Grok price $0.08/min ($4.80/hr) + $0.004 per text input, **tokens included**; TTS $15/1M chars; streaming STT $0.20/hr | Confirmed / unverified | Prices confirmed (REST STT is $0.10/hr). "Tokens included" is not stated on the pricing page or the S2S doc, so it is marked (unverified) | https://docs.x.ai/developers/pricing |
| 19 | AA latency: GPT-Live 1.24–1.34 s (CD 94.9–97.3%); Grok Voice 3.0 0.81 s, S2S Index 86.9; Qwen3.5 Omni Flash Realtime 0.79 s | Confirmed | Re-checked on the AA leaderboard; no longer "not re-verified" | https://artificialanalysis.ai/speech-to-speech |
| 20 | Ultravox: default `ultravox-v0.7` (GLM 4.6) from 2025-12-22; $0.05/min PAYG, 30 free min, 5 concurrent; Pro $100/mo with 5 custom voices; docs say 1 clone per account; MIT weights; 26 languages; CoVoST2 es→en 42.88 | Confirmed | Added: calls default to `maxDuration` 1 h; separate "Threads" token pricing exists | https://docs.ultravox.ai/changelog/news.md ; https://docs.ultravox.ai/api-reference/calls/calls-post.md ; https://www.ultravox.ai/pricing ; https://docs.ultravox.ai/voices/cloning.md ; https://huggingface.co/fixie-ai/ultravox-v0_7-glm-4_6 |
| 21 | Ultravox: the `@inworld.ai` support address "suggests a corporate tie to Inworld; not explained" | **Corrected** | Inworld acquired Ultravox on 2026-09-30; built-in Ultravox voices now run on Inworld Realtime TTS-2 | https://inworld.ai/blog/inworld-acquires-ultravox |
| 22 | Ultravox BYO ElevenLabs `externalVoice` with character-level timing; `forced_agent_message` | Confirmed | `forced_agent_message` also has `uninterruptible` and `urgency` fields | https://docs.ultravox.ai/voices/bring-your-own.md ; https://docs.ultravox.ai/apps/datamessages.md |
| 23 | Qwen3.8-Omni-Flash-Realtime: full-duplex claim; `modalities: ["text"]` text-only output; `semantic_vad`; 120-min sessions; 100 audio turns / 600 s retained; regions Singapore and Beijing only; page updated 2026-10-16 | Confirmed | Added: 196,608 total input tokens; spatial audio doubles input-audio tokens | https://www.alibabacloud.com/help/en/model-studio/realtime |
| 24 | Qwen pricing (Singapore) $0.23 / $0.93 / $0.70 / $1.87 per 1M; 3.8 bills both output audio and transcript; 7 tokens/s in, 12.5 tokens/s out; sub-second audio billed as 1 s | Confirmed | Pricing page updated 2026-10-19 | https://www.alibabacloud.com/help/en/model-studio/model-pricing ; https://www.alibabacloud.com/help/en/model-studio/realtime |
| 25 | Qwen Omni cloning: 10–20 s recommended (60 s max), ≥24 kHz mono; `target_model` must match; 1,000 voices/account; $0.01/voice with 1,000 free in 90 days; Spanish supported; political/pornographic/violent scripts fail | Confirmed | — | https://www.alibabacloud.com/help/en/model-studio/qwen-omni-voice-cloning |
| 26 | Qwen3-Omni released 2025-09-22 ("natively end-to-end", "MoE-based Thinker–Talker") | Confirmed | — | https://github.com/QwenLM/Qwen3-Omni |
| 27 | Ultravox v0.7 model card "modified 2026-10-09" | Corrected (minor) | The card page shows no date; the fixie-ai org listing shows it updated about 12 days before 2026-10-20 | https://huggingface.co/fixie-ai |
| 28 | Ultravox 0.864 s median (Pipecat benchmark, r01); Qwen3-Omni ≈702 ms (arXiv 2603.05413, r01) | Unverified | Not re-fetched in this pass | — |

**Missing developments added (§7):** Inworld's acquisition of Ultravox and the Inworld Realtime API (managed cascade with a selectable LLM, TTS-2 voices and an ElevenLabs clone-migration tool; BYO endpoint and clones in realtime are undocumented); GPT-Live Decisions integration (2026-10-15), prompt-to-voice for all customers and nine new voices (2026-10-16), and 12-hour prompt caching (2026-10-20); Gemini 3.8 Live on AA and Gemini 3.8 Flash TTS voice replication; Eleven v4 (2026-09-28) and realtime STT turn prediction (2026-10-12); the 2026 Grok Voice version churn; Alibaba's `qwen-audio-3.x-realtime` models.

**Net effect on conclusions:** None of the corrections changes the TL;DR verdict that no S2S product keeps both the agent graph and per-character ElevenLabs clones. The GPT-Live English-accent limit makes it weaker for Spanish characters. The Ultravox acquisition adds vendor-churn risk. Inworld Realtime is a new candidate to test alongside ElevenLabs Speech Engine (a managed cascade that might keep a selectable LLM plus clones), pending the two unknowns in the checklist.
