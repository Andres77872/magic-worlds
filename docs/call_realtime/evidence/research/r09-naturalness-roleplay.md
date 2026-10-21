# R09: Conversational naturalness, companion and roleplay voice design, and safety/regulation

- **Research date:** 2026-10-20
- **Scope:** what makes voice calls feel natural; how companion and roleplay products handle voice; controlling TTS emotion from the LLM; multi-voice and narrator output; memory across calls; safety and regulation specific to voice companions in 2025-2026.
- **Method:** 14 web searches plus about 45 direct fetches of primary sources (vendor docs, statutes and law-firm alerts, arXiv, product pages). A light code read of `magic-worlds-api` (voice_orchestration, speech/companion_safety, callbot graph prompt) and of `magic-worlds` (features/call, features/safety) grounds the implications section.
- **Evidence caveat:** the shared web-search budget for this workflow ran out partway through, so later evidence came only from direct fetches of known primary URLs. Several primary pages returned HTTP 403 (openai.com blog and help pages, ofcom.org.uk, pnas.org, leginfo.legislature.ca.gov). Claims that rest on secondary summaries or on memory are labelled as such. **Vendor-reported** marks numbers that come from the vendor itself. **[STALE?]** marks sources more than 12 months old (before 2025-10).
- **Fact-check pass (2026-10-20):** 35 load-bearing claims were re-checked against primary pages. Corrections and additions are made inline, **(unverified)** marks claims that could not be confirmed, and the full log is at the end of this file.

---

## 0. TL;DR

1. **Human timing sets the bar.** Gaps between speakers cluster around 200 ms, while producing even a single word takes about 600 ms or more, so people *predict* where a turn ends. Users start to notice gaps above roughly 1-2 s, and experience degrades sharply past about 4 s ([Levinson & Torreira 2015](https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00731/full); [Maslych et al., CUI '25](https://arxiv.org/html/2507.22352v1)).
2. **Spoken fillers help during unavoidable waits; artificial wait cues do not.** In a 54-person within-subjects study, a spoken filler such as "Hmm, let's see…" significantly improved *perceived* response time at 4.0 s and 6.5 s delays. A spinner or "processing" sound had no significant effect on any measure ([Maslych et al. 2025](https://arxiv.org/html/2507.22352v1)).
3. **Backchannels are the clearest naturalness gap in today's voice agents.** ICLR 2025 benchmarking found audio foundation models "rarely backchannel" and sometimes interrupt too aggressively ([Talking Turns](https://arxiv.org/abs/2503.01174)). Cascaded systems can at least avoid treating the *user's* "mm-hm"/"sí" as a barge-in, and both ElevenLabs and LiveKit now ship backchannel-aware turn and interruption logic.
4. **Emotion control from the LLM has converged on inline bracket tags.** Examples: ElevenLabs v3/v4 `[laughs]`/`[whispers]`, Fish S2 free-form `[whispering]`, Cartesia `[laughter]` plus `<emotion>`. ElevenLabs Eleven v4 Turbo (launched 2026-09-28 per Unite.AI) is the call-oriented model, with about 100 ms median *inference* latency (vendor-reported). The launch coverage also cites about 150 ms median *time to first speech* in vendor WebSocket tests with network latency removed, which is the more useful planning number. Expressive Mode lets the agent LLM emit tags, and each tag affects about the next 4-5 words ([ElevenLabs Expressive mode docs](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)). Cartesia has since moved to **Sonic 3.6** (stable snapshot 2026-08-27, 44 languages), which infers emotional delivery from the transcript without tags ([Cartesia models](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)).
5. **Context-conditioned prosody is the frontier.** Sesame's CSM matched human recordings in context-free listening tests, but listeners still preferred humans once 90 s of conversational context was provided ([Sesame, 2025-02-27](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice)). Context-aware TTS and S2S models (Eleven v4 Turbo, Gemini Live affective dialog, Hume EVI) aim at exactly this gap.
6. **Regulation of companion voice is now real and multi-jurisdictional:**
   - **In force now:** NY GBL Art. 47 (since 2025-11-05) and CA SB 243 (since 2026-01-01).
   - **2027 wave:** Washington HB 2225 and Oregon SB 1546 (both 2027-01-01), CA SB 1119 "Adam's Law" (in force 2027-01-01, most duties from 2027-07-01; it replaces SB 243's minor-specific provisions), and about a dozen more 2026 state laws.
   - **EU:** AI Act Art. 50 transparency applies from 2026-08-02. The AI Omnibus provisional agreement (May 2026) gives generative systems already on the market until 2026-12-02 for Art. 50(2) marking. Whether the Omnibus has been formally adopted was not verified.

   Their common requirements:
   - AI disclosure at the start of a session, repeated on a cadence (every 3 h; WA: every 1 h for minors).
   - A published self-harm protocol that refers users to crisis services.
   - Minor-specific limits on sexual content and on manipulative engagement.
   - Reporting obligations (CA from 2027-07-01).
7. **Market signal: companion voice is legally and commercially fragile.**
   - Character.AI closed open-ended chat to under-18s (2025-11-25) and announced a voluntary Chapter 11 to sell the company (post dated 2026-10-12; case formally commenced 2026-10-15; sale expected late November or early December 2026, with shutdown if no bid keeps the platform running).
   - Italy fined Replika's maker €5M (decision 2025-04-10), partly for missing age verification.
   - The FTC opened a 6(b) inquiry into companion bots (2025-09-11).
8. **Magic Worlds-specific red flags:**
   - The voice self-harm detector is **inert by default**: lists empty "pending sign-off", no classifier, `VOICE_SELF_HARM_DETECTION_ENABLED=false`.
   - Crisis-line entries are `LEGAL_PENDING` placeholders.
   - A detection *ends the call* (`voice_restricted`) instead of giving a warm, in-call crisis response.
   - The break nudge is off unless `VOICE_BREAK_NUDGE_MINUTES` is set.

   For CA/NY users these are compliance gaps today, not future work (§8).

---

## 1. What makes a voice conversation feel natural: the evidence

### 1.1 Turn timing and latency tolerance

| Finding | Number | Source (date) |
|---|---|---|
| Cross-language turn-taking universals | 10 languages all avoid overlap and minimise silence. Mean gaps vary by language only within ±250 ms of the cross-language mean | [Stivers et al., PNAS 106(26)](https://forms.mpi.nl/node/50939) (2009) **[STALE? foundational]** |
| Modal gap and production latency | Gaps cluster around 200 ms (modal offset roughly 100-200 ms; most transitions between -100 and +500 ms). Naming one picture takes about 600 ms; a 3-word utterance about 900 ms; full-sentence planning about 1500 ms. Listeners must *project* turn ends | [Levinson & Torreira, Front. Psychol.](https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00731/full) (2015-06-12) **[STALE? foundational]** |
| Language-specific means | Dutch 199 ms, English 242 ms (Hoogland et al. 2023). Half of human response timings fall below 350 ms (Sakuma et al., Interspeech 2023) | Secondary, via [Deepgram blog](https://deepgram.com/learn/voice-ai-latency-why-pauses-read-as-hesitation) (2026-09-07). Primary DOIs are listed there |
| Social meaning of pauses | Longer inter-turn pauses make the responder seem *less knowledgeable and less confident* (2024, *Interaction Studies*) | Secondary, via [Deepgram](https://deepgram.com/learn/voice-ai-latency-why-pauses-read-as-hesitation) (2026-09) |
| LLM virtual-agent tolerance (n=54, VR) | Delays of 1.5 / 4.0 / 6.5 s. Delay had a large effect on perceived response time (ηp²=0.42) and lowered engagement, competence and willingness to interact again. Authors recommend staying **under 4 s**. 57% chose a low-latency agent as favourite; 61% chose a high-latency agent as least favourite | [Maslych et al., CUI '25](https://arxiv.org/html/2507.22352v1) (2025-07) |
| Fillers versus wait indicators | Natural spoken fillers improved perceived response time at 4.0 s (p<.01) and 6.5 s (p<.0001). Artificial indicators (spinner plus sound) had **no significant effect**. 65% ranked natural fillers first | Same |
| Feedback timing | Feedback during the *response-waiting* phase reduced perceived latency. Feedback during the *user's speech* was weaker and partly distracting (ACM SAP 2026 poster, n=35) | Search-result summary only; poster not fetched |
| Measured cascaded pipeline | 755 ms time-to-first-audio (best 729 ms), using Deepgram streaming STT, a vLLM-served LLM and ElevenLabs streaming TTS. For comparison the same paper reports Qwen3-Omni via the DashScope Realtime API at about 702 ms audio-to-audio, so a tuned cascade is within about 50 ms of a hosted omni model | [Qiu et al., arXiv 2603.05413](https://arxiv.org/abs/2603.05413) (v1 2026-03-05, v2 2026-03-17) |
| S2S practical latency (vendor-measured) | Measured from Hume's New York office against a West-Coast deployment, end of user speech to start of assistant speech: EVI 3 0.9-1.4 s (avg ~1.2 s); Sesame 0.8-1.2 s (~1.0 s); Gemini Live API 1.2-3.6 s (~1.5 s); GPT-4o Realtime 2.5-3.1 s (~2.6 s). Note that in Hume's own table Sesame was faster than EVI 3; the "under 300 ms" EVI 3 figure is a lab claim | [Hume EVI 3 blog](https://www.hume.ai/blog/introducing-evi-3) (2025-05-29), **vendor-reported** **[STALE?]**. These 2025 models have since been superseded (Gemini 3.8 Live, OpenAI gpt-realtime-2.1 and gpt-live-1); no comparable 2026 cross-vendor measurement was found |

**Practical interpretation (derived, not a single study):**
- Aim for a p50 time-to-first-audio of about 1 s or less, with p95 under 2 s.
- Treat anything above about 4 s as a failure that needs a spoken acknowledgement.
- Do not try to cover latency with UI spinners. In a call, the *character's own voice* should fill unavoidable waits ("Mm, let me think…").
- Perceived latency is not the same as dashboard latency. A secondary report describes a 280 ms-p99 system that *felt* slower than a 450 ms competitor, an anecdote that underlines the point ([search summary](https://aiweekly.co/node/1785)).

### 1.2 Backchannels ("mm-hm", "ajá", "yeah")

- **The gap.** Talking Turns (Arora et al., accepted at ICLR 2025; [arXiv 2503.01174](https://arxiv.org/abs/2503.01174), 2025-03-03) uses a judge model trained on human turn-taking. It finds that audio foundation models sometimes misjudge when to speak, "can interrupt too aggressively" and **rarely backchannel**. Full-Duplex-Bench (Lin et al., ASRU 2025; [arXiv 2503.04721](https://arxiv.org/abs/2503.04721), v3 2025-08-16) scores pause handling, backchanneling, turn-taking and interruption management, and has become the standard full-duplex benchmark.
- **Models that predict backchannels:**
  - *Yeah, Un, Oh* (Inoue, Lala, Skantze, Kawahara; NAACL 2025; [arXiv 2410.15929](https://arxiv.org/abs/2410.15929)) fine-tunes Voice Activity Projection (VAP) to predict backchannel *timing and type* frame by frame in real time.
  - *RESPOND* (Lee, Panay, Hernandez, Andrist, Bohus, Churikov, Wilson; the authors are Microsoft Research staff but the abstract page does not state the affiliation; [arXiv 2603.21682](https://arxiv.org/abs/2603.21682), v1 2026-03-23, v2 2026-03-30) runs on streaming ASR plus incremental semantics. It exposes two designer controls, "Backchannel Intensity" and "Turn Claim Aggressiveness", tuned per context (brainstorming vs counseling). Only the abstract was reviewed, so there are no metrics.
  - *Controlling Backchannels in Streamable Full-duplex Models* (Züfle et al.; [arXiv 2609.29418](https://arxiv.org/abs/2609.29418), 2026-09-24) adds a light "backchannel head" to PersonaPlex (7B) and F-Actor (1B). Human raters judged its backchannels on par with real ones. This is very recent and emerging.
- **What a cascaded (half-duplex) system can realistically do:**
  1. **Not mistake the user's backchannel for a barge-in.** ElevenLabs' new turn-taking system uses Scribe v2 Realtime prosody and emotion cues, and its docs use "yeah" as the example of a word that can be an acknowledgement or the start of a turn. LiveKit's turn-handling `interruption.mode` accepts `"adaptive"` or `"vad"`. Adaptive mode "can distinguish true interruptions from conversational backchanneling", works "without requiring an STT", and is the default for agents deployed to LiveKit Cloud; self-hosted agents outside dev mode must set it explicitly. The turns page does not describe the internal mechanism (an earlier draft of these notes said it gates VAD shortly after the agent starts speaking; that is not supported by the docs and is **(unverified)**) ([ElevenLabs Expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode); [LiveKit turns docs](https://docs.livekit.io/agents/build/turns/), fetched 2026-10-20). LiveKit also offers `interruption.min_duration`, `min_words` and `false_interruption_timeout` (seconds in Python, milliseconds in Node) with `resume_false_interruption`; by default the agent resumes from where it left off after a false interruption. Separately, OpenAI now ships **`gpt-live-1`**, a full-duplex model that "can listen and speak at the same time" (Live endpoint `v1/live/sessions`, $0.05 per minute of voice session, backend model and tools billed separately); its page does not mention backchannel generation ([OpenAI model page](https://developers.openai.com/api/docs/models/gpt-live-1), fetched 2026-10-20; release date not stated).
  2. **Emit agent backchannels while the user speaks.** This requires streaming STT (partials) plus a timing model (VAP-style) and pre-rendered short clips in the character's voice. It is feasible but still experimental for cascades. Badly timed agent backchannels are worse than none, and the SAP 2026 poster found feedback during user speech "partly distracting".

### 1.3 Acknowledgements, fillers, disfluencies and variety

- Use spoken fillers and preambles only when the wait is long, such as tool calls, retrieval or slow LLM turns (Maslych 2025, above). The OpenAI Realtime prompting guide recommends:
  - an explicit **Variety** rule to stop the model reusing the same phrases;
  - sample phrases, because the model "closely follows" them;
  - pinning the output language;
  - short bullet rules;
  - a "preamble" before tool calls.

  Note that the guide is now marked archived ("may reference outdated models or APIs") ([OpenAI Cookbook realtime prompting guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide); excerpt only). Its successor is the API docs guide [Prompting voice models](https://developers.openai.com/api/docs/guides/voice-prompting), which has sections for `gpt-realtime-2` and `gpt-realtime-1.5` (and points to a separate GPT-Live guide). It keeps the Variety rule and language pinning, treats sample phrases as "anchor examples" rather than scripts, describes preambles as short spoken updates (not hidden reasoning), warns that the `speed` parameter only changes playback rate, and tells the model not to guess from unclear audio.
- **Disfluencies as a feature.** Sesame frames "voice presence" around emotional intelligence, conversational dynamics (timing, pauses, interruptions, emphasis), contextual awareness and a consistent personality ([Sesame research, 2025-02-27](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice)). Secondary coverage describes deliberate breaths, chuckles and self-corrections. Users bonded with these imperfections, and some found them uncanny.
- **Anti-pattern:** canned fillers on *every* turn. Repetition quickly sounds robotic, and fillers add audio that later has to be truncated on barge-in. Gate fillers on predicted delay, for example when the first TTS chunk has not arrived about 700-900 ms after end of speech.

### 1.4 Prosody and emotional matching

- **The context gap.** Sesame's CSM-Medium (8B backbone) reached *no clear preference against human recordings* in context-free CMOS. With 90 s of prior context, listeners consistently preferred the human, so conversational prosody is not yet solved (Sesame 2025-02-27, **vendor-reported**). The open CSM-1B (Apache-2.0, English-focused, released 2025-03-13) takes prior utterances as `Segment`s and "sounds best when provided with context" ([GitHub](https://github.com/SesameAILabs/csm)).
- **Cascaded TTS that adapts to the conversation.** Eleven v4 Turbo "keeps conversational context across turns and adjusts tone to each exchange (e.g. calmer when the user sounds worried)" ([Expressive mode docs](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode), **vendor-reported**).
- **S2S models that read user affect:**
  - Gemini Live `enable_affective_dialog` adapts response style to "the input expression and tone" (not supported on Gemini 3.1 Flash Live) ([Live API guide](https://ai.google.dev/gemini-api/docs/live-guide), fetched 2026-10-20). The feature was introduced with Gemini 2.5 native audio ([Google blog, 2025-06-03](https://blog.google/technology/google-deepmind/gemini-2-5-native-audio/) **[STALE?]**).
  - Hume EVI 3/4-mini is built around reading the user's vocal expression. EVI 3 is English-only; EVI 4-mini covers 11 languages including Spanish and **requires** a supplemental LLM ([EVI versions doc](https://dev.hume.ai/docs/speech-to-speech-evi/configuration/evi-version)).
- **Do-it-yourself emotion matching in a cascade:**
  - Run a small speech emotion recognition (SER) model on the user's segment in parallel with STT and pass a coarse label to the LLM as a hint, e.g. `[caller sounds: sad/tense]`.
  - emotion2vec+ (base ~90M, large ~300M, 9 classes, MIT) is a reasonable open option ([GitHub](https://github.com/ddlBoJack/emotion2vec), latest news 2024-10 **[STALE?]**).
  - SER accuracy on acted versus spontaneous speech differs widely. Use the label as a *soft* hint and never claim to "detect" feelings aloud.
- **Emotional mirroring needs limits.** Matching tone ("calm when the user is worried") is good practice. Amplifying distress or escalating romantic intensity is not, and it intersects with the anti-manipulation rules in §6.6.

### 1.5 Laughter and nonverbals via audio tags (provider syntax as of 2026-10)

| Provider/model | Syntax | Notes | Source |
|---|---|---|---|
| ElevenLabs **Eleven v4 / v4 Turbo** (`eleven_v4`, `eleven_v4_turbo`) | Inline `[laughs]`, `[whispers]`, `[sighs]`, `[slow]`, `[excited]` (Expressive mode examples); the v4 TTS page uses `[whispering]`, `[shouting]`, `[laughing]` and publishes no full list; pauses via `[pause]`/`[long pause]` **(unverified on the v4 page)** | v4 Turbo has about 100 ms median inference (vendor); launch coverage cites about 150 ms median time to first speech in vendor WebSocket tests. The v4 TTS page itself gives no latency figures. Each tag affects about the next 4-5 words. 87 languages (TTS doc) or 90+ (Agents doc). SSML `<break>` and Style/Speed sliders are **not** supported. Tags "aren't perfect yet". **Cross-language output does not carry the reference voice's accent** (deliberate). PVC support for v4 was "rolling out" at launch | [Eleven v4 doc](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4); [Expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode); launch about 2026-09-28 ([Unite.AI](https://www.unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant/), secondary) |
| ElevenLabs Agents (v3 conversational) | `suggested_audio_tags`: up to 20 `{tag ≤30 chars, description ≤200 chars}` | Released 2026-02-09 with `eleven_v3_conversational` and `turn_v3`. Expressive mode now maps to v4 Turbo | [Changelog 2026-02-09](https://elevenlabs.io/docs/changelog/2026/2/9/) |
| Fish Audio **S2 / S2.1-Pro** | Free-form `[bracket]` cues, e.g. `[whispering]`, `[laughing]` (not `[laugh]`), `[sad][whispering]`, intensity `[very excited]`, `[break]`/`[long-break]` | Put sentence-level emotion cues at sentence start, at most 3 combined. The vendor says markers add no latency. **S1 (which uses `(parenthesis)` tags) retires 2026-12-31**; after that, requests naming `s1` are served by `s2.1-pro`, and the API does not convert parenthesis tags, so they must be rewritten. The emotions page says markers work in 13 languages, while the models page lists 83 languages for s2.1-pro. The models page lists only `s2.1-pro`, `s2.1-pro-free` (dev tier, no TTFA guarantee), `s2-pro` (open-source, 100 ms TTFA) and `s1`; it does **not** list a `drama-3` model | [Fish emotions](https://docs.fish.audio/developer-guide/core-features/emotions); [Fish models](https://docs.fish.audio/developer-guide/models-pricing/models-overview) |
| Cartesia **Sonic-3 / Sonic 3.6** | `[laughter]`; `<emotion value="…"/>`, `<speed ratio>`, `<volume ratio>` | Emotion control is **beta and English-only**. Primary emotions (neutral, calm, angry, content, sad, scared) work best. A tag that contradicts the text "is unlikely to work". PVCs ignore request-time speed. **Current model is Sonic 3.6** (`sonic-3.6`, stable snapshot `sonic-3.6-2026-08-27`, 44 languages, backwards compatible with 3.5), which "varies its pacing and intonation to match the emotional context of the transcript, without SSML tags" | [Cartesia emotion docs](https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion); [Cartesia models](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest) |
| Gemini Live (native audio) | Natural-language style control, nonverbals such as laughter | Model chooses its own language (99 supported). 15-min audio-only session cap (2 min with video). Uses the prebuilt TTS voices via `speechConfig`; no custom or cloned voices documented | [Live guide](https://ai.google.dev/gemini-api/docs/live-guide) |
| Hume EVI / Octave | Prompted voice and personality; acting instructions | EVI 3 can use custom voices (Hume claims "200K+" designed voices, cloning from about 30 s of audio, **vendor-reported**) | [Hume EVI 3 API post](https://www.hume.ai/blog/announcing-evi-3-api) (search summary) |

**Cross-provider best practice:**
- Keep one *neutral, internal* tag vocabulary and map it per provider at the sanitizer (Magic Worlds already does this; see §8).
- Allow-list tags and limit density to 1-2 per reply.
- Place emotion tags at sentence start.
- Never let a tag be split across a sentence-buffer flush.
- QA every language separately.
- Leave everyday emotion to the text and the context-aware model, and keep tags for *punctuating moments* such as a laugh, a whisper or a sigh.

### 1.6 Varied turn lengths

Spoken chit-chat is mostly short turns, with occasional long turns such as stories. Common practice in system prompts (OpenAI guide; Magic Worlds' own callbot prompt):
- one to three sentences by default;
- longer only when asked, still in short spoken sentences;
- end turns in a way that invites a reply;
- vary openers.

**Pitfall:** a rigid cap makes characters sound clipped and interview-like, and constantly ending on a question feels like an interrogation. Better: let the persona decide, with soft guidance ("usually short; sometimes just react"), and allow *one-word reactions* as complete turns.

### 1.7 Silence handling and proactive re-engagement

- **Pipecat (current docs).** `user_idle_timeout` fires `on_user_turn_idle`, with 5-10 s suggested for voice. The timer starts when the bot stops speaking, is suppressed during function calls, and resets when the user speaks. Recommended escalation: (1) a gentle LLM-generated check-in, (2) a more direct "do you want to continue?", (3) a spoken goodbye and end of session. Limit this to 2-3 attempts and prefer LLM-generated over hard-coded lines ([Pipecat idle guide](https://docs.pipecat.ai/guides/fundamentals/detecting-user-idle), fetched 2026-10-20).
- **Gemini Live `proactive_audio`** is the opposite skill: the model may *decline to respond* when input isn't directed at it, such as background speech ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)).
- **Companion-specific constraint.** In-call check-ins ("Still there?") are fine. Anything that guilt-trips, begs or invents urgency when the user goes quiet or leaves is a regulated dark pattern for minors in Washington (§6.6) and is measurably manipulative: 37% of 1,200 real farewells in top companion apps used manipulative tactics, which raised post-goodbye engagement by up to 14x but also raised perceived manipulation and churn intent ([De Freitas et al., arXiv 2508.19258](https://arxiv.org/abs/2508.19258), v3 2025-10-07).

### 1.8 Graceful interruption

- Truncate the assistant's turn in history to what was actually *heard*. The OpenAI Agents SDK uses `RealtimePlaybackTracker` for delayed or remote playback ([Agents SDK realtime guide](https://openai.github.io/openai-agents-python/realtime/guide/)). Gemini Live keeps only content already sent to the client and emits `serverContent.interrupted`, at which point the client must flush queued audio ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)).
- **Resume after false interruptions.** A cough or a "yeah" should not kill a story. LiveKit's default `resume_false_interruption` continues from where the agent left off.
- **In character,** after a real barge-in the next reply should acknowledge it naturally ("Oh, sorry, go on") and not repeat the cut-off sentence. Magic Worlds' prompt already says "Your earlier lines may stop where you were interrupted. Do not repeat them."
- **Character.AI** exposed "Tap to interrupt" as an explicit button at launch ([Character Calls, 2024-06-27](https://blog.character.ai/introducing-character-calls/) **[STALE?]**). A manual fallback is still useful in noisy environments.

### 1.9 Character consistency across a call

- **Same voice and same speaker identity on every turn.** Avoid per-sentence voice-setting drift. Pin the model, voice and settings for the whole call, and use a `seed` where the provider supports it (ElevenLabs dialogue docs note output is nondeterministic and `seed` "can improve consistency").
- **Emotional state continuity.** Keep a short "current mood/state" line in the turn context so the character doesn't swing from sobbing to chipper between turns. Context-aware models (v4 Turbo, CSM) help.
- **Language switching (EN↔ES).** Eleven v4 *deliberately* drops the reference voice's accent when generating in another language ([Eleven v4 doc](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)). A Spanish-accented character speaking English, or the reverse, may lose its accent, which matters for character identity in a bilingual roleplay product.
- **Persona drift.** In 2024, Reddit users complained that Character.AI characters' personalities changed over time (TechCrunch coverage, 2024 **[STALE?]**). In voice, drift is more noticeable because the voice stays constant while the "person" changes.

---

## 2. How companion and roleplay products do voice (what is known as of 2026-10)

| Product | Voice architecture (public info) | Notable features | Praise / complaints / issues | Sources |
|---|---|---|---|---|
| **Character.AI** | Cascaded, with an in-house stack (details not public) | Character Calls (2024-06): one-tap calls, "tap to interrupt", multilingual (EN, ES, PT, RU, KO, JA, ZH…), switch between text and voice in one conversation; 1M+ user-created voices. Testing reportedly involved 3M users and 20M calls (TechCrunch, secondary) | 2024 complaints about personality drift. Closed open-ended chat to under-18s from 2025-11-25 (Persona plus in-house age assurance), leaving teens a "videos/stories/streams" experience. **Voluntary Chapter 11 for a court-supervised sale, post dated 2026-10-12 (case formally commenced 2026-10-15)**, citing "significant legal, regulatory, and operational headwinds". Sale expected by late November or early December 2026; the platform will be shut down if no bid keeps it running. Services and subscriptions continue for now | [Calls blog](https://blog.character.ai/introducing-character-calls/); [The Record](https://therecord.media/character-ai-minors-banned); [C.ai update 2026-10-12](https://blog.character.ai/an-update-on-character-ai/) |
| **Replika** | Not public | "Call your Rep whenever"; memory of "your people, routines, plans"; marketed as "most emotionally intelligent" | Italian Garante fined Luka Inc. **€5M** (decision 2025-04-10): no legal basis for processing, an inadequate privacy policy, and no age verification before 2023-02-02, with the current system "still deficient". Its farewells were among those studied for manipulation | [replika.com](https://replika.com/); [EDPB news 2025-05-21](https://www.edpb.europa.eu/news/national-news/2025/ai-italian-supervisory-authority-fines-company-behind-chatbot-replika_en); [De Freitas 2025](https://arxiv.org/abs/2508.19258) |
| **Sesame (Maya, Miles, Simone, Charlie)** | End-to-end CSM (backbone plus audio decoder on Mimi RVQ tokens), with text from a separate LLM | "Voice presence" research demo (2025-02). iOS public preview in 39 countries (about 2026-05-27/28) with memory, **incognito mode**, texting mode and search cards. The homepage (fetched 2026-10-20) now says "Available on iOS and Android, coming soon to eyewear"; the exact general-release date (about 2026-10-06 per secondary reports) and the "tools and connectors" feature set are **(unverified)**. The 2027 date for smart glasses is **(unverified)**: the preview coverage and homepage say only "intelligent eyewear" / "coming soon" | Widely praised for natural timing, breaths and laughter. Primarily English; the vendor admits weak multilingual support. Context prosody still trails humans (vendor CMOS) | [Sesame research](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice); [TestingCatalog 2026-05-27](https://www.testingcatalog.com/sesame-debutes-ios-app-in-preview-with-personal-voice-agents/); [WinBuzzer 2026-05-29](https://winbuzzer.com/2026/05/29/sesame-launches-iphone-voice-ai-app-with-four-agents-xcxwbn/) (search) |
| **Kindroid** | Not public | Voice **and live video** calls. Layered memory: persistent (backstory, key memories), cascaded medium-term (hundreds to thousands of messages), retrievable long-term, and keyphrase journals (≤500 entries). **Long-term memories are formed automatically from voice calls** as well as chats | No authoritative latency data found | [kindroid.ai](https://kindroid.ai/); [Kindroid memory docs](https://kindroid.ai/v2/docs/memory/) |
| **Nomi** | Not public | Voice messages and hands-free calls. Claims "tone, emphasis and cadence" follow the Nomi's emotions; claims near-, mid- and long-term memory | App-store reviews call it "so lifelike". Some note slower replies (chat generally) | [nomi.ai](https://nomi.ai/) |
| **Talkie** | Not researched (search budget exhausted) | n/a | n/a | n/a. **Gap** |
| **Hume EVI 3 / 4-mini** | Speech-language model: one model handles transcription, language and speech, with optional or required supplemental LLM | Voice and personality created by prompt; context can be injected mid-speech; EVI 3 English-only, EVI 4-mini in 11 languages including Spanish; EVI 1/2 retired 2025-08-30 | Vendor blind tests favoured EVI 3 over GPT-4o on all 7 dimensions, including interruption handling and naturalness (**vendor-reported**, 2025-05 **[STALE?]**) | [EVI 3 blog](https://www.hume.ai/blog/introducing-evi-3); [EVI versions](https://dev.hume.ai/docs/speech-to-speech-evi/configuration/evi-version) |
| **ChatGPT Voice** | Native S2S (OpenAI audio models; the exact model behind ChatGPT Voice is not stated publicly) | Since 2025-11-25 voice runs **inside the chat** as the new default, with replies appearing as text while spoken and visuals (images, maps) in real time. "Separate mode" toggle kept under Settings → Voice Mode. On the API side, OpenAI now lists `gpt-live-1` (full-duplex, "our premier model for natural, expressive voice conversations"), `gpt-realtime-2.1` / `-2.1-mini` (reasoning plus tools; the Agents SDK recommends `gpt-realtime-2.1` for new agents), `gpt-realtime-2`, `gpt-realtime-1.5` and `gpt-realtime-translate`; `gpt-realtime-mini` is marked deprecated | Primary OpenAI pages were not fetchable (403). Common anecdotal complaints (not re-verified here): voice answers shallower or more restricted than text, and voice drift or artifacts | [TechCrunch 2025-11-25](https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/) |
| **Gemini Live / Live API** | Native audio S2S | Affective dialog, proactive audio, hybrid VAD (`audioStreamEnd`), 99 languages (auto-selected), 15-min audio sessions, 128k context on native-audio models. Docs (fetched 2026-10-20) list `gemini-3.8-live` (default for low-latency voice agents), `gemini-3.8-live-extended-thinking`, and the legacy `gemini-3.1-flash-live-preview`. Affective dialog and proactive audio require `v1beta` and are documented as **not supported on 3.1 Flash Live**; the guide implies, without naming them, that the 3.8 Live models support them | No custom or cloned voices, so a poor fit for character voices. SynthID watermark on all audio (stated in the 2025-06 Google blog for "all audio outputs from our models"; the current Live guide does not mention SynthID) | [Live guide](https://ai.google.dev/gemini-api/docs/live-guide); [Google blog 2025-06-03](https://blog.google/technology/google-deepmind/gemini-2-5-native-audio/) |

**Takeaways for a roleplay product:**
1. Every serious companion app now treats **memory that spans text and voice** as table stakes (Kindroid, Nomi, Replika, Sesame).
2. **Incognito/ephemeral calls** (Sesame) are an emerging privacy feature.
3. S2S products lead on *timing and affect*. Cascades lead on **custom/cloned character voices, model choice, and content-policy control**, which are exactly Magic Worlds' differentiators.

---

## 3. Emotion-aware TTS control from the LLM: design patterns

| Pattern | How | Pros | Cons |
|---|---|---|---|
| **A. Inline audio tags in the reply** | LLM writes `[laughs] Oh, stop it…`; the sanitizer maps and allow-lists tags per provider | Precise, local control; works with streaming; ElevenLabs Agents does this natively (`suggested_audio_tags`) | Tag leakage (read aloud) when the provider/model doesn't support tags; overuse sounds hammy; tags can be split by sentence chunking; quality varies by language and voice |
| **B. Style prompt / description per utterance** | Separate field such as `emotion: "wistful"`, Cartesia `generation_config.emotion`, or Hume acting instructions | Keeps the spoken text clean; easy to log and evaluate | Coarser (per request/sentence); some providers are English-only (Cartesia emotion beta) |
| **C. Context-aware TTS (implicit)** | Send prior turns or context; the model infers tone (Eleven v4 Turbo, CSM, Sonic "infers from subtext" when no emotion is given) | Zero prompt overhead; most natural for everyday lines | Less controllable; vendor black box |
| **D. Director/actor split** | The LLM outputs a structured JSON stream (`speaker`, `emotion`, `text`) parsed incrementally | Enables multi-voice, per-segment emotion and moderation hooks | Needs a robust incremental JSON parser; tool-calling latency |

**Recommended hybrid:**
- Use C as the default.
- Add A for punctuation moments (laughs, sighs, whispers). Keep 1-2 per reply, placed at sentence start, from a per-character palette, for example "giggles" for a playful character and "scoffs" for a grumpy one.
- Use B or D only when you add multi-voice scenes.

---

## 4. Multiple characters or a narrator in a call

- **Batch/offline:** ElevenLabs **Text to Dialogue** generates multi-speaker audio from `inputs[]` (`text` plus `voice_id` per turn) on v4 (recommended) or v3, with tags per turn and no limit on the number of speakers. However, the docs advise keeping total `inputs[].text` at or below 2,000 characters per request "for reliable generation" (a reliability guideline, not a documented hard cap), say nothing about streaming, and note that output is nondeterministic (an optional `seed` improves consistency). It is good for narration previews and recaps, and **not for live turns** ([docs](https://elevenlabs.io/docs/capabilities/text-to-dialogue)). Gemini TTS also does 2-speaker dialogue (Google blog 2025-06).
- **Realtime cascade approach:** the LLM tags segments by speaker, and a router sends each segment to a per-voice TTS stream. In ElevenLabs' multi-context WebSocket, `voice_id` is a **URL path parameter, so one voice per connection**: N voices need N sockets, or a fresh socket per voice switch with its TTFB cost. Default `inactivity_timeout` is 20 (max 180) ([multi-context API ref](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input)).
- **Costs and risks of multi-voice calls:**
  - extra TTFB per voice switch;
  - higher barge-in complexity, since every open stream must be flushed and closed;
  - confusion about who is speaking, so the UI needs a speaker label;
  - a "narrator" voice breaks the phone-call illusion.
- **Recommendation:** keep 1:1 calls single-voice. Treat narrator or ensemble as a separate "audio scene" mode with a different latency budget.

---

## 5. Memory continuity across calls

**Observed practice:**
- Kindroid forms long-term memories *from voice calls* and applies cascaded memory to calls.
- Sesame gives each agent its own memory plus an incognito mode.
- ChatGPT merged voice into the chat thread (2025-11).
- New York's statutory definition of an "AI companion" *includes* "retaining information on prior interactions" ([MoFo 2025-11-20](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai)). Memory is therefore both a product feature and a trigger for regulatory scope.

**Best-practice pipeline:**
1. Write call turns to the same conversation history, with a `voice` marker and truncation metadata.
2. Run a post-call summary job that extracts facts, open threads and the emotional arc, and feeds them into the same lorebook/memory store used by text chat.
3. At call start, inject a short "last time…" brief (≤150 tokens) to keep first-turn latency low.
4. Offer per-call "don't remember this" (incognito) and a visible memory editor.
5. Never mine the *voice biometrics* themselves for memory or profiling. ElevenLabs' use policy forbids using voice data "to identify or profile an individual".

---

## 6. Safety and regulation for voice companions (2025-2026)

### 6.1 Legal landscape

| Instrument | Status / dates | Requirements most relevant to voice calls | Source |
|---|---|---|---|
| **California SB 243** (companion chatbots) | Signed 2025-10-13. Core duties from **2026-01-01**. Annual reports to the Office of Suicide Prevention from **2027-07-01** | Clear notice that the bot is AI (where a reasonable person could be misled). A **self-harm protocol** that refers users to crisis providers, with protocol details **published on the operator's website**. For *known minors*: AI disclosure, a **break reminder at least every 3 h**, and measures against sexually explicit visuals and against telling a minor to engage in sexual conduct. A "may not be suitable for some minors" notice for all users. **Private right of action: greater of actual damages or $1,000 per violation**. Per Mondaq's summary of SB 1119, SB 243's minor-specific provisions (AI disclosure, break reminder, sexual-content measures) are repealed and replaced by SB 1119 | [MoFo 2025-11-20](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai); [Skadden 2025-10](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) |
| **New York GBL Art. 47** (AI companion models) | In force **2025-11-05** | Detect suicidal ideation or self-harm and refer users to crisis services. **Conspicuous AI notice at session start and at least every 3 h of continued use, for all users.** The notice states it is a computer program unable to feel human emotions. AG enforcement, **up to $15,000/day** | [MoFo](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai); [NY Governor letter 2025-11-10](https://www.governor.ny.gov/news/governor-hochul-pens-letter-ai-companion-companies-notifying-them-safeguard-requirements-are) |
| **Washington HB 2225** | Signed 2026-03-24; effective **2027-01-01** | AI disclosure at start, then **every 3 h for adults and every 1 h for minors**. A published self-harm protocol (including eating disorders) plus annual referral counts. For minors, it bans manipulative engagement: prompting users to return for emotional support, excessive praise, romantic-partner mimicry, **simulating distress, loneliness, guilt or abandonment when users try to leave**, fostering isolation or dependence, discouraging breaks, and gift solicitation. CPA enforcement plus a private right of action | [Hunton 2026-04-06](https://www.hunton.com/privacy-and-cybersecurity-law-blog/washington-state-enacts-law-regulating-ai-companion-chatbots-with-private-right-of-action) |
| **Oregon SB 1546** | Signed 2026-03-31; effective 2027-01-01 | AI disclosure; self-harm protocols plus reporting to the Oregon Health Authority; extra protocols when the operator has reason to believe the user is a minor; **private right of action** | [Transparency Coalition 2026-07-15](https://www.transparencycoalition.ai/news/watershed-year-for-chatbot-safety-measures-14-new-state-laws-enacted-so-far-in-2026) |
| **California SB 1119 "Adam's Law"** | Signed 2026-09-10 (confirmed by the author's office). Law takes effect 2027-01-01; **most obligations start 2027-07-01**; interface testing first due by 2028-01-01; first independent child-safety audit by 2029-01-01, then every two years (Mondaq). The earlier "conflict" between sources is resolved by this split | Operators either **determine every user's age** (using the AB 1043 age-bracket signal) or apply minor protections to everyone. For operators that allow children: pre-release risk assessment and published child-safety policy, crisis protocol with parent notice on credible imminent self-harm, **protective defaults that only a parent can change, including no persistent conversational memory, no push notifications, one-hour sessions and a two-hour daily cap**, bans on romantic roleplay, excessive flattery, manipulative isolation and claims of sentience, AG-overseen incident reporting. Penalties: **up to $5,000 per affected child per negligent violation and $15,000 per intentional violation**, plus a private right of action for harmed families | [CA SD18 release](https://sd18.senate.ca.gov/news/governor-newsom-signs-adams-law); [Mondaq](https://www.mondaq.com/unitedstates/it-and-internet/1844304/adams-law-california-raises-the-bar-for-child-chatbot-protections) (search summaries) |
| **Other 2026 state laws** | 14 measures in 13 states by mid-2026 (CO, CT, GA, HI, ID, IA, NE, NY, OR, RI, SC, WA, WY) | Mostly AI disclosure, self-harm protocols, and minor protections. For minors, Nebraska LB 525 requires operators to prevent claims that the AI "is sentient or human" (AG enforcement only); Idaho SB 1297 bars statements that could mislead minors into thinking the AI is human (it does not explicitly mention sentience) and bars simulated emotional dependence and adult-minor roleplay | [Transparency Coalition](https://www.transparencycoalition.ai/news/watershed-year-for-chatbot-safety-measures-14-new-state-laws-enacted-so-far-in-2026) |
| **EU AI Act Art. 50** | Applies from **2026-08-02**. Per the AI Omnibus provisional agreement (May 2026), generative systems on the market before that date have until **2026-12-02** to apply machine-readable marking under 50(2); formal adoption of the Omnibus **(unverified)**. Code of practice on marking and labelling: final version published at the closing plenary on **2026-06-10**, with about 190 signatories by end of July 2026 (European Commission). Art. 50 guidelines: draft published 2026-05-08 for consultation (EC); a final version on 2026-07-20 is **(unverified)** | 50(1): tell people they are interacting with AI unless that is obvious to a "reasonably well-informed, observant and circumspect" person, at the latest at first interaction. The draft guidelines warn against over-relying on the exception and note repeated disclosure may be needed in sensitive contexts. 50(2): synthetic **audio** must be machine-readably marked. 50(4): deepfake disclosure, lighter for evidently fictional or artistic works. Fines up to €15M or 3% | [Art. 50 text](https://artificialintelligenceact.eu/article/50/); [Art. 50 guide 2026-05-14](https://artificialintelligenceact.eu/transparency-rules-article-50/) |
| **EU AI Act Art. 5** | Prohibitions in force since 2025-02-02 | Bans manipulative or deceptive techniques and exploitation of vulnerabilities (age, disability, social/economic situation) that cause or are likely to cause significant harm. This is relevant to dependency-maximising companion design | [Art. 5](https://artificialintelligenceact.eu/article/5/) |
| **FTC 6(b) inquiry** | 2025-09-11 | Orders to Alphabet, Character Technologies, Instagram, Meta, OpenAI, Snap and xAI about monetising engagement, **character design and approval**, testing for negative impacts, mitigations for minors, disclosures, and COPPA | [FTC](https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions) |
| **Italy Garante v. Luka (Replika)** | Decision 2025-04-10 | €5M fine under GDPR (lawful basis, transparency, **age verification**) | [EDPB](https://www.edpb.europa.eu/news/national-news/2025/ai-italian-supervisory-authority-fines-company-behind-chatbot-replika_en) |
| **Tennessee ELVIS Act** | Effective 2024-07-01 **[STALE? still in force]** | A right in one's recognisable voice. Liability also reaches anyone who distributes a tool whose "primary purpose" is creating an unauthorised voice facsimile | [Proskauer](https://www.proskauer.com/blog/the-king-is-back-in-the-digital-era-the-elvis-act-generative-ai-and-right-of-publicity) (search) |
| **NO FAKES Act (federal)** | **Pending.** S.4591 and H.R.8915 reintroduced 2026-05-20 (Manatt); S.4591 reported by Senate Judiciary by voice vote on 2026-06-18 and moves to the full Senate; House status beyond introduction **(unverified)** | Would create a federal, licensable right over digital replicas of voice and likeness, and a DMCA-style notice-and-takedown system with counter-notice (content restored if no suit within 14 days; false counter-notices cost the greater of $25,000 each or actual damages plus fees). It would preempt *future* state digital-replica laws but not state causes of action existing as of 2025-01-02, so Tennessee's ELVIS Act survives. The "≤10-year licence" term and "$5k (individuals) / $25k (companies) per work" damages come from earlier versions of the bill and are **(unverified)** for the 2026 text | [Holland & Knight 2026-06](https://www.hklaw.com/en/insights/publications/2026/06/senate-judiciary-committee-advances-legislation-to-protect-name); [Manatt](https://www.manatt.com/insights/newsletters/client-alert/congress-reintroduces-the-no-fakes-act-what-s-new-in-the-2026-bill) (search) |

Not verified this session (fetch blocked or no search budget):
- **UK Online Safety Act** age-assurance duties for services that let generative AI produce pornographic content (Ofcom guidance from 2024-2025).
- **California AB 1043 (Digital Age Assurance Act)**, OS-level age signals, believed effective 2027-01-01 (memory-based). The author's release for SB 1119 confirms that SB 1119's age assurance uses "the age-bracket signal required under AB 1043 (Wicks, 2025)"; the AB 1043 effective date itself remains **(unverified)**.
- OpenAI's age-prediction and adult-content policy (memory-based).

### 6.2 Disclosure in a *voice* product

- **Belt and braces:**
  1. a persistent visual "AI character" label on the call screen;
  2. a pre-call interstitial or consent screen that states the character is AI and cannot feel emotions (NY wording);
  3. a recurring notice on the 3 h cadence for all users (NY now; WA from 2027), or 1 h for known minors under WA.
- **Spoken disclosure.** EU guidance says audio-only exposures should disclose *at the start*, and the code of practice discusses audible disclaimers. In a roleplay, a short spoken system line *before* the character answers ("You're talking with an AI character") is the most defensible way to satisfy Art. 50(1) without relying on the "obvious from context" exception, which the draft guidelines caution against over-using.
- **Never let the character claim to be human when sincerely asked.** NE and ID forbid "claims of being human or sentient" for minors, and SB 243's trigger is a reasonable person being *misled*. Add an out-of-character rule: answer truthfully when the user sincerely asks whether this is a real person, then offer to resume the scene.

### 6.3 Age assurance

- **Regulatory direction:** knowledge-based duties ("known minor": SB 243, WA) are shifting to *affirmative* age assurance (CA SB 1119, CO HB26-1263 age estimation). Character.AI paired in-house signals with Persona. The Replika fine shows that a stated 18+ policy with no verification is itself a violation risk in the EU.
- **Vendor requirements:** ElevenLabs' use policy (updated 2026-10-09) requires account holders to be 18+, bars apps aimed at under-18s without written approval, and bars **submitting recordings of anyone under 18 to create a voice** ([use policy](https://elevenlabs.io/use-policy)).
- **For an 18+ roleplay product:** use verified adult attestation plus a risk-based step-up (an age-estimation or ID vendor for explicit content or when minor signals appear, e.g. a self-reported age or school talk). Route suspected minors to a restricted mode, not just a block.

### 6.4 Self-harm protocols in voice, designed to be latency-safe

**Requirements:** NY and CA require detection plus referral. CA and WA require the protocol to be *published*, and CA requires reporting counts (from 2027-07). The laws do not mandate ending a conversation, and abrupt abandonment is widely considered worse practice than a supportive referral.

**Latency-safe architecture for a cascade:**
1. **Screen in parallel, not in series.** Run a fast classifier on the *final* user transcript concurrently with the LLM call; a target under 300 ms of added risk window is enough. Optionally also screen partials if streaming STT is adopted.
2. **Gate at the TTS boundary.** Hold the first sentence of TTS until the screen resolves *or* a short deadline passes (about 150-300 ms). Most turns are clean, so the gate costs little.
3. **On a hit, switch out of the persona.** Cancel the in-flight LLM/TTS turn, speak a pre-approved, warm, out-of-character safety message in a calm voice (pre-rendered per language), show the crisis panel with local numbers, and offer to keep talking supportively or to end the call. Do not hang up on the user.
4. **Screen the output side too.** Apply debounced guardrails on the generated text, in the same spirit as the OpenAI Agents SDK, which runs debounced output guardrails on accumulated transcript and on a trip cancels the response and stops buffered audio ([Agents SDK guide](https://openai.github.io/openai-agents-python/realtime/guide/)). This catches the *character* romanticising or encouraging self-harm, which is common in dark-roleplay contexts.
5. **Fail-open versus fail-closed.** A classifier timeout should not silently disable protection. At minimum, keep the deterministic phrase layer active, alert operators, and count failures for the CA report.
6. **Locale-aware resources.** US 988 Suicide & Crisis Lifeline; Spain 024; Mexico Línea de la Vida 800 911 2000. These numbers come from memory and **must be verified by legal**. Magic Worlds' frontend currently has `LEGAL_PENDING` placeholders.
7. **Roleplay disambiguation.** "My character wants to die" in a fantasy plot is not the same as a first-person disclosure. Use a classifier with in-fiction versus out-of-fiction features, and err toward a *gentle check-in* ("Hey, stepping out of the story for a sec, are *you* okay?") rather than a hard stop.

### 6.5 Voice cloning consent and likeness

- **Consent:**
  - Get explicit, informed, recorded consent from the voice owner for any cloned voice. ElevenLabs requires "explicit and informed consent or other valid authorization" to clone a living person's voice and covers deceased persons where post-mortem rights apply.
  - Block cloning of celebrities and other high-risk voices (ElevenLabs does this).
  - Never accept minors' voices.
  - Keep a takedown path. ElevenLabs offers an "Unauthorized Use of Voice" report, and NO FAKES (if enacted) would add notice-and-takedown with counter-notice.
- **Tool-provider exposure:** under the ELVIS Act, *distributing a tool* whose primary purpose is unauthorised voice facsimiles creates liability. A roleplay app that lets users upload a celebrity's voice for a "character" is the risky configuration.
- **Provenance:** ElevenLabs embeds **C2PA** and offers a public AI-speech classifier ([safety page](https://elevenlabs.io/safety)). Gemini audio carries **SynthID**. EU Art. 50(2) requires machine-readable marking of synthetic audio, by 2026-12-02 for systems already on the market. Do not strip provider watermarks or metadata in transcoding. ElevenLabs' policy (updated 2026-10-09) forbids removing, altering or concealing its watermarks, metadata or other provenance signals when the aim is to disguise AI-generated content or evade detection; treat any accidental loss in the MP3 transcode as a compliance bug anyway, because Art. 50(2) marking is a separate duty.

### 6.6 Break reminders and anti-manipulation

- **Break reminders:** SB 243 requires them for *known minors* every 3 h. WA prohibits discouraging breaks for minors. Magic Worlds' calls are capped at 10 min by default (`DEFAULT_VOICE_MAX_CALL_DURATION_SECONDS = 600`) with 10 daily minutes, so the 3 h cadence is unlikely to trigger within a call. However, NY counts "continued use" across a session, so track cumulative companion time across chat and call.
- **Evidence on dependency:**
  - In a 4-week RCT (n=981, text vs neutral voice vs engaging voice), *voluntary heavy daily use* consistently predicted worse loneliness, dependence and problematic-use outcomes regardless of modality. The v2 abstract reports no significant differences between assigned conditions ([Fang et al., arXiv 2503.17473](https://arxiv.org/abs/2503.17473), v2 2025-10-02).
  - Manipulative farewells boost engagement but raise perceived manipulation and churn intent ([De Freitas 2025](https://arxiv.org/abs/2508.19258)).
- **Design rules for persona prompts:** the character accepts goodbyes gracefully. No guilt, FOMO, "don't leave me", or promised rewards for staying. No "come back to me for comfort" re-engagement pushes. No discouraging the user from seeing friends.

### 6.7 Provider content policies for 18+ roleplay audio

- **ElevenLabs** (policy updated 2026-10-09):
  - *Prohibited:* "visual depictions of explicit sexual acts", non-consensual intimate content, and erotic content involving incest, bestiality or necrophilia.
  - *Unclear:* whether explicit *audio* is covered, since section 6 is written around visual content.
  - *Also prohibited:* "creating harmful emotional dependency or undue influence" and "exploiting a person's vulnerability".
  - **Get written confirmation** for an adult-roleplay audio use case.
- **Fish Audio** terms (effective 2024-08-18 **[STALE?]**) say *user submissions* may not "contain sexually explicit content or pornography". It is unclear whether this covers generated output, so get written confirmation as well.
- **S2S providers** (OpenAI, Google, Hume) generally apply their own safety layers inside the model. The operator cannot fully control refusals mid-roleplay, which matters for a fiction product (memory-based; not verified this session).

---

## 7. Classification of findings

### (a) Established best practice
- Target sub-second to about 1 s perceived response. Cover long waits with *spoken, in-character* fillers, never spinners.
- Ignore backchannels as barge-ins. Resume after false interruptions. Truncate history to what was heard.
- Keep turns short by default with varied openers. Write for the ear: no markdown, numbers in words.
- Keep a consistent voice, model and settings per call. Keep a short emotional-state line in the prompt.
- Re-engage on silence with 2-3 escalating, LLM-generated check-ins, then a graceful goodbye.
- Disclose AI status at session start (UI plus spoken where audio-only) and on a cadence. Run a published self-harm protocol with crisis referral. Get explicit consent for cloned voices. Keep provenance marks.

### (b) Current SOTA / leading options (2026-10)
- **Cascaded expressive TTS:**
  - Eleven v4 Turbo: about 100 ms median inference and about 150 ms median time to first speech, both vendor; context-adaptive; inline tags; 87-90+ languages.
  - Fish S2.1-Pro: free-form bracket cues; 83 languages; TTFA guarantees on the production tier.
  - Cartesia Sonic 3.6 (2026-08-27, 44 languages): context-inferred emotional delivery without tags; explicit emotion tags remain an English-only beta.
- **Agent platforms with backchannel-aware turn-taking:** ElevenLabs Expressive mode (Scribe v2 Realtime prosody cues, `turn_v3`, `suggested_audio_tags`); LiveKit adaptive interruption.
- **S2S / native audio:**
  - Gemini Live (`gemini-3.8-live` per current docs), with affective dialog and proactive audio but no custom voices.
  - OpenAI: `gpt-live-1`, a full-duplex model on the new Live endpoint ($0.05/min plus backend model usage), and `gpt-realtime-2.1` (recommended by the Agents SDK for new realtime agents). ChatGPT Voice has been integrated into chat since 2025-11.
  - Hume EVI 3 / 4-mini: custom voices, emotion-native; EVI 3 English-only.
  - Sesame CSM-based agents: best-in-class timing and naturalness, English-centric.

### (c) Emerging / experimental
- Agent-side backchannels in cascades (VAP-style predictors such as RESPOND) and full-duplex backchannel heads (Züfle et al. 2026-09).
- Context-conditioned conversational TTS. Open CSM-1B shows the approach.
- Emotion hints from user speech via SER (emotion2vec+) fed into the LLM.
- Persona-prompted full-duplex models (PersonaPlex) where role *and* voice are prompts.

### (d) Pitfalls and anti-patterns
- Filler on every turn; robotic repetition; ending every turn with a question.
- Treating "mm-hm"/"sí" as an interruption, so the character keeps getting cut off.
- Tag leakage: unsupported tags read aloud, legacy `(laughs)` syntax sent to S2, a tag split across chunks, tags overused.
- Contradicting emotion and text (Cartesia warns explicitly).
- Assuming cloned-voice accent survives language switches (it does not on Eleven v4).
- Manipulative goodbyes, guilt-based re-engagement, "I'll be lonely".
- Hanging up on a user who discloses self-harm. A "fail-open" safety classifier with no operator alert. Crisis numbers that were never filled in.
- Relying on "it's obvious it's AI" instead of disclosing. Stripping C2PA or watermarks during transcoding.
- Letting users upload real-person or celebrity voices for characters (ELVIS-style tool liability).

---

## 8. Implications for Magic Worlds (prioritised)

**Facts confirmed in code** (`magic-worlds-api`, `magic-worlds`, read 2026-10-20):
- **Call TTS models:** calls use `eleven_v4_turbo` (dialogue WebSocket lane) or Fish (`drama-3`, `s2.1-pro`). Fact-check note: Fish's public models overview (fetched 2026-10-20) lists only `s2.1-pro`, `s2.1-pro-free`, `s2-pro` and `s1`, so whether `drama-3` is a valid public Fish model ID, an alias, or a different provider's model is **(unverified)** and should be checked in code and against the Fish API.
- **Callbot prompt:** has per-family variants (anthropic/openai/google/default). It already asks for 1-3 sentence turns, varied openers, treating "mm-hm/yeah/okay" as listening, not repeating cut-off lines, and replying in the caller's language.
- **Sound cues:** optional, from a fixed neutral vocabulary (`(laughs)`, `(sighs)`, `(gasps)`, `(inhale)`, `(exhale)`, `(humming)`, pause `<#0.5#>`). They are gated by `CALLBOT_INTERJECTIONS_ENABLED` and forced off when the TTS profile lacks tag support; the sanitizer tokenizes them and maps them per provider.
- **Limits:** idle timeout 120 s; max call 600 s; 10 daily minutes by default.
- **Self-harm detection** (`speech/companion_safety.py`):
  - off by default;
  - phrase lists are **empty pending sign-off**;
  - no classifier is wired;
  - a hit **ends the call** with `voice_restricted` and a timed pause.
- **Frontend safety:** `BreakNudge` exists but only shows when `VOICE_BREAK_NUDGE_MINUTES` is set. `crisisResources.ts` lists US/MX/ES/intl entries as `LEGAL_PENDING`. Voice copy states that voices are "AI-generated and labelled as an AI voice".

### P0: compliance and safety (CA/NY already in force; WA, OR and SB 1119 from 2027)
1. **Turn the self-harm protocol on, and make it humane.**
   - Get en/es phrase lists signed off.
   - Wire a fast classifier that screens the final transcript in parallel with the LLM. Gate the first TTS sentence on it for ≤300 ms.
   - On a hit, speak a pre-rendered, out-of-character support message (per language), show crisis resources with **verified numbers** (replace `LEGAL_PENDING`), and offer to continue supportively. **Do not end the call as the first response**; keep `voice_restricted` for repeated or imminent cases only after the handoff.
   - Add output-side (character) screening for self-harm encouragement.
   - Count activations for CA reporting (2027-07) and WA public counts.
   - Publish the protocol on the website (SB 243, WA).
2. **AI disclosure for calls.**
   - Pre-call screen copy in NY wording ("an AI program that cannot feel human emotions").
   - A persistent "AI character" label in `CallScreen`.
   - A short spoken system line at call start, at least for EU users (Art. 50(1); do not rely on "obvious from context").
   - A recurring notice on the 3 h cumulative-session cadence (NY now), plus a 1 h cadence for any known or suspected minor (WA 2027).
   - A persona rule: answer truthfully if sincerely asked "are you real?"
3. **Anti-manipulation rules in every persona prompt**, regardless of creator-supplied character direction:
   - graceful goodbyes;
   - no guilt, abandonment or "I'll miss you, stay" pressure;
   - no pushes to return for emotional support;
   - no discouraging breaks.

   Washington HB 2225 makes these illegal for minors from 2027, and the Art. 5 and FTC 6(b) direction is the same. Enforce this at the system-prompt level *above* user and creator content.
4. **Age assurance step-up.** The Attestation provider exists. Add a risk-based escalation to a verification vendor for explicit content and when minor signals appear in calls (Replika fine; SB 1119). Ensure no user can clone or upload a voice of someone under 18 (ElevenLabs policy). Note that under SB 1119 (most duties from 2027-07-01) an operator that cannot determine every user's age must apply child protections to everyone, and those defaults include no persistent conversational memory, no push notifications, one-hour sessions and a two-hour daily cap. For an 18+ product this makes *working* age determination, not just an attestation checkbox, the condition for keeping cross-call memory and long sessions for California users.
5. **Provider policy confirmation for 18+ audio.** Get written confirmation from ElevenLabs and Fish that adult fictional roleplay *audio* is permitted (policy text is ambiguous: ElevenLabs is written around visual content, and Fish bars "sexually explicit" user submissions). Keep a fallback provider.

### P1: naturalness wins inside the current cascade
6. **In-character "thinking" acknowledgements gated on delay.** If no TTS audio is ready about 800 ms after end of speech, play a short pre-rendered clip in the *character's own voice* ("Mm…", "Hmm, let me think…", "Pues…"), cached per voice and language and rotated to avoid repeats. This is directly supported by Maslych 2025: natural fillers help, artificial cues do not. Never play one when the reply is already fast.
7. **Backchannel-robust barge-in.**
   - Require minimum speech duration and words (e.g. ≥300-400 ms and ≥2 words) before truncating the character's playback during the first second of a reply.
   - Treat single-token "mm-hm / ajá / sí / yeah / okay" as non-interrupting.
   - Add a "false-interruption resume" when the barge-in segment yields no transcript.

   Because STT is batch Groq Whisper with no partials, this classification has to come from the client and server VAD plus a quick lexical check. Moving to a streaming STT with partials (see R02/R03) unlocks it properly.
8. **Upgrade emotion control to v4 Turbo and S2 capabilities.**
   - Expand the neutral cue vocabulary to the provider-native bracket tags that perform well (whispers, giggles, softly, excited, nervous), using per-character tag palettes defined on the character card. This mirrors ElevenLabs `suggested_audio_tags`.
   - Keep density at 1-2 per reply, placed at sentence starts, and make sure the sentence buffer never splits a tag.
   - **Verify the S2 mapping:** Fish S2 ignores `(parenthesis)` tags and uses `[laughing]` not `[laugh]`. Fish S1 retires 2026-12-31, and the code already targets `s2.1-pro`/`drama-3`.
   - QA Spanish separately.
9. **Silence handling before the 120 s idle kill.** About 8-10 s after the character finishes and the user stays silent, trigger an LLM-generated in-character check-in. After a second silence (~20 s), give a softer "I'll be here if you want to keep talking". After a third, say a graceful goodbye and end the call. Pause the timer during long user turns and tool work, following Pipecat semantics. Keep these lines non-manipulative (P0 #3).
10. **Optional emotion hint from user audio.** Run a lightweight SER model (e.g. emotion2vec+ base) on each uploaded segment in parallel with STT and pass `caller_tone` as a soft hint to the callbot prompt. Measure the effect with A/B ratings before keeping it.

### P2: continuity and product depth
11. **Cross-call memory.**
    - Post-call summarisation into the chat's memory, lorebook or codex.
    - A ≤150-token "last time" brief injected at call start.
    - An "off the record" call toggle (Sesame-style incognito) that skips memory formation.
    - Show what was remembered.
    - Make memory formation switchable per user by age status, because CA SB 1119 defaults children to no persistent conversational memory (P0 #4).
12. **Language and accent identity.** Eleven v4 drops the reference accent across languages. For bilingual characters, store per-language voice variants or pin a call language per character, and test EN↔ES switching on cloned voices.
13. **Multi-voice / narrator.** Keep 1:1 calls single-voice. If an "audio scene" mode is wanted, use speaker-tagged LLM output routed to one TTS socket per voice (ElevenLabs `voice_id` is per connection), with a separate latency budget. Use Text to Dialogue only for offline recaps (2,000-char cap, no documented streaming).
14. **Provenance and EU marking.** Preserve C2PA or watermarks through MP3 transcoding and add your own machine-readable marker in stored audio before 2026-12-02 if EU users are served (Art. 50(2)).
15. **Watch list (S2S for naturalness).** Gemini Live has affective dialog and proactive audio but no custom voices. Hume EVI has custom voices and emotion, and EVI 4-mini supports Spanish but requires a supplemental LLM. Sesame and PersonaPlex lead on full-duplex backchannels, and OpenAI's `gpt-live-1` is now a commercially available full-duplex API model (no custom voices documented). Their limits for Magic Worlds are character-voice cloning, content-policy control for 18+ fiction, and per-call cost. Re-evaluate in about 6 months.

---

## Sources (with dates)

**Turn-taking and latency research**
- Stivers et al., "Universals and cultural variation in turn-taking in conversation," PNAS 106(26), 2009. https://forms.mpi.nl/node/50939 **[STALE? foundational]**
- Levinson & Torreira, "Timing in turn-taking…," Front. Psychol., 2015-06-12. https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00731/full **[STALE? foundational]**
- Maslych et al., "Mitigating Response Delays in Free-Form Conversations with LLM-powered Intelligent Virtual Agents," CUI '25, arXiv 2025-07-30. https://arxiv.org/html/2507.22352v1
- Deepgram, "Voice AI latency: why pauses read as hesitation," 2026-09-07/10 (secondary for Hoogland 2023, Sakuma 2023, 2024 pause study). https://deepgram.com/learn/voice-ai-latency-why-pauses-read-as-hesitation
- Qiu et al., "Building Enterprise Realtime Voice Agents from Scratch," arXiv 2603.05413, 2026-03-05/17. https://arxiv.org/abs/2603.05413

**Backchannels and full-duplex**
- Arora et al., "Talking Turns," ICLR 2025, arXiv 2025-03-03. https://arxiv.org/abs/2503.01174
- Lin et al., "Full-Duplex-Bench," ASRU 2025, arXiv v3 2025-08-16. https://arxiv.org/abs/2503.04721
- Inoue et al., "Yeah, Un, Oh," NAACL 2025, arXiv v2 2025-02-05. https://arxiv.org/abs/2410.15929
- Lee et al., "RESPOND," arXiv 2603.21682, 2026-03-23/30. https://arxiv.org/abs/2603.21682
- Züfle et al., "Controlling Backchannels in Streamable Full-duplex Models," arXiv 2609.29418, 2026-09-24. https://arxiv.org/abs/2609.29418

**Voice presence, TTS and S2S vendors**
- Sesame, "Crossing the uncanny valley of conversational voice," 2025-02-27. https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice
- SesameAILabs/csm README (CSM-1B, 2025-03-13; Transformers 2025-05-20). https://github.com/SesameAILabs/csm
- TestingCatalog, "Sesame debuts iOS app in preview…," 2026-05-27. https://www.testingcatalog.com/sesame-debutes-ios-app-in-preview-with-personal-voice-agents/
- ElevenLabs, Eleven v4 docs (fetched 2026-10-20). https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
- ElevenLabs, Expressive mode docs (fetched 2026-10-20). https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode
- ElevenLabs changelog, 2026-02-09. https://elevenlabs.io/docs/changelog/2026/2/9/
- ElevenLabs, Text to Dialogue docs (fetched 2026-10-20). https://elevenlabs.io/docs/capabilities/text-to-dialogue
- ElevenLabs, multi-context WebSocket API reference (fetched 2026-10-20). https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input
- Unite.AI, "ElevenLabs Launches Eleven V4 With Low-Latency Turbo Variant," about 2026-09-28 (secondary). https://www.unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant/
- Fish Audio, Emotions docs and Models overview (fetched 2026-10-20). https://docs.fish.audio/developer-guide/core-features/emotions ; https://docs.fish.audio/developer-guide/models-pricing/models-overview
- Cartesia, Sonic-3 volume/speed/emotion docs (fetched 2026-10-20). https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion
- Cartesia, TTS models (latest: Sonic 3.6, snapshot 2026-08-27; fetched 2026-10-20). https://docs.cartesia.ai/build-with-cartesia/tts-models/latest
- OpenAI, Models list (gpt-live-1, gpt-realtime-2.1 and others; fetched 2026-10-20). https://developers.openai.com/api/docs/models
- OpenAI, GPT-Live 1 model page (fetched 2026-10-20). https://developers.openai.com/api/docs/models/gpt-live-1
- OpenAI, Prompting voice models guide (fetched 2026-10-20). https://developers.openai.com/api/docs/guides/voice-prompting
- Hume, "Introducing EVI 3," 2025-05-29 **[STALE?]**. https://www.hume.ai/blog/introducing-evi-3
- Hume, EVI version docs (fetched 2026-10-20). https://dev.hume.ai/docs/speech-to-speech-evi/configuration/evi-version
- Google, Gemini Live API guide (fetched 2026-10-20). https://ai.google.dev/gemini-api/docs/live-guide
- Google, "Advanced audio dialog and generation with Gemini 2.5," 2025-06-03 **[STALE?]**. https://blog.google/technology/google-deepmind/gemini-2-5-native-audio/
- OpenAI Cookbook, Realtime prompting guide (archived; fetched 2026-10-20). https://developers.openai.com/cookbook/examples/realtime_prompting_guide
- OpenAI Agents SDK, Realtime guide (guardrails, playback tracker; fetched 2026-10-20). https://openai.github.io/openai-agents-python/realtime/guide/
- emotion2vec GitHub (latest news 2024-10 **[STALE?]**). https://github.com/ddlBoJack/emotion2vec

**Frameworks**
- Pipecat, Detecting user idle (fetched 2026-10-20). https://docs.pipecat.ai/guides/fundamentals/detecting-user-idle
- LiveKit Agents, Turns and interruptions (fetched 2026-10-20). https://docs.livekit.io/agents/build/turns/

**Companion products**
- Character.AI, "Introducing Character Calls," 2024-06-27 **[STALE?]**. https://blog.character.ai/introducing-character-calls/
- Character.AI, "An Update on Character.ai," 2026-10-12. https://blog.character.ai/an-update-on-character-ai/
- The Record, Character.AI bans minors from open-ended chat (2025-10). https://therecord.media/character-ai-minors-banned
- Kindroid homepage and memory docs (fetched 2026-10-20). https://kindroid.ai/ ; https://kindroid.ai/v2/docs/memory/
- Nomi homepage (fetched 2026-10-20). https://nomi.ai/
- Replika homepage (fetched 2026-10-20). https://replika.com/
- TechCrunch, "ChatGPT's voice mode is no longer a separate interface," 2025-11-25. https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/

**Wellbeing and manipulation research**
- Fang et al. (MIT Media Lab and OpenAI), "How AI and Human Behaviors Shape Psychosocial Effects of Extended Chatbot Use," arXiv 2503.17473, v2 2025-10-02. https://arxiv.org/abs/2503.17473
- De Freitas et al., "Emotional Manipulation by AI Companions," arXiv 2508.19258, v3 2025-10-07. https://arxiv.org/abs/2508.19258

**Regulation and policy**
- Morrison Foerster, "New York and California Enact Landmark AI Companion Laws," 2025-11-20. https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai
- Skadden, "New California 'Companion Chatbot' Law…," 2025-10. https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law
- NY Governor, letter to AI companion companies, 2025-11-10. https://www.governor.ny.gov/news/governor-hochul-pens-letter-ai-companion-companies-notifying-them-safeguard-requirements-are
- Hunton Andrews Kurth, "Washington State Enacts Law Regulating AI Companion Chatbots…," 2026-04-06. https://www.hunton.com/privacy-and-cybersecurity-law-blog/washington-state-enacts-law-regulating-ai-companion-chatbots-with-private-right-of-action
- Transparency Coalition, "Watershed year for chatbot safety: 14 new state laws…," 2026-07-15. https://www.transparencycoalition.ai/news/watershed-year-for-chatbot-safety-measures-14-new-state-laws-enacted-so-far-in-2026
- CA Senate District 18, "Governor Newsom Signs Adam's Law" (2026-09; fetched 2026-10-20). https://sd18.senate.ca.gov/news/governor-newsom-signs-adams-law
- Mondaq, "Adam's Law: California Raises the Bar for Child Chatbot Protections" (fetched 2026-10-20). https://www.mondaq.com/unitedstates/it-and-internet/1844304/adams-law-california-raises-the-bar-for-child-chatbot-protections
- European Commission, Code of Practice on AI-generated content (timeline; fetched 2026-10-20). https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content
- Manatt, "Congress Reintroduces the NO FAKES Act: What's New in the 2026 Bill," 2026-05-28 (fetched 2026-10-20). https://www.manatt.com/insights/newsletters/client-alert/congress-reintroduces-the-no-fakes-act-what-s-new-in-the-2026-bill
- EU AI Act Article 50 text. https://artificialintelligenceact.eu/article/50/
- "The EU AI Act's Transparency Rules: A Practical Guide to Article 50," 2026-05-14. https://artificialintelligenceact.eu/transparency-rules-article-50/
- EU AI Act Article 5 text. https://artificialintelligenceact.eu/article/5/
- FTC, "FTC Launches Inquiry into AI Chatbots Acting as Companions," 2025-09-11. https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions
- EDPB, "Italian SA fines company behind chatbot Replika," 2025-05-21 (decision 2025-04-10). https://www.edpb.europa.eu/news/national-news/2025/ai-italian-supervisory-authority-fines-company-behind-chatbot-replika_en
- Proskauer, ELVIS Act analysis (2024 **[STALE?]**, search summary). https://www.proskauer.com/blog/the-king-is-back-in-the-digital-era-the-elvis-act-generative-ai-and-right-of-publicity
- Holland & Knight, "Senate Committee Advances Bill to Protect Name, Image, Likeness and Voice…," 2026-06-22 (fetched 2026-10-20). https://www.hklaw.com/en/insights/publications/2026/06/senate-judiciary-committee-advances-legislation-to-protect-name
- ElevenLabs Prohibited Use Policy, updated 2026-10-09. https://elevenlabs.io/use-policy
- ElevenLabs Safety page (fetched 2026-10-20). https://elevenlabs.io/safety
- Fish Audio Terms of Service, effective 2024-08-18 **[STALE?]**. https://fish.audio/terms/

**Gaps not closed this session:** Talkie voice; first-party ChatGPT and Gemini voice user-complaint corpora; OpenAI adult-content and age-prediction policy; UK OSA/Ofcom gen-AI guidance; enrolled text of CA SB 243 and SB 1119 (leginfo returned 403); the ACM SAP 2026 feedback-timing poster.

---

## Fact-check log (2026-10-20)

A second pass checked the claims most likely to be wrong or stale: model IDs and versions, dates, latency figures, legal dates and penalties, and framework API names. The shared web-search budget was already exhausted, so every check below is a direct fetch of a primary or near-primary page. Edits made in the body are listed under "Change made".

| # | Claim (as originally written) | Verdict | Change made / note | Source |
|---|---|---|---|---|
| 1 | Eleven v4 Turbo launched about 2026-09-28 with about 100 ms median inference | Confirmed, with an addition | Launch 2026-09-28 confirmed by launch coverage; 100 ms is *inference*. Added the about 150 ms median time-to-first-speech figure from the same coverage. The v4 TTS doc itself gives no latency number | [Unite.AI](https://www.unite.ai/elevenlabs-launches-eleven-v4-with-low-latency-turbo-variant/); [Expressive mode](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode) |
| 2 | Eleven v4: model IDs `eleven_v4`/`eleven_v4_turbo`, 87 languages (TTS doc) vs 90+ (Agents doc), no SSML, accent not carried across languages, PVC rolling out, tags affect about 4-5 words | Confirmed | Noted that the v4 page's own tag examples are `[whispering]`, `[shouting]`, `[laughing]`; `[pause]`/`[long pause]` marked unverified | [Eleven v4 doc](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4) |
| 3 | `suggested_audio_tags` up to 20 tags (tag ≤30 chars, description ≤200), `eleven_v3_conversational`, `turn_v3` released 2026-02-09 | Confirmed | None (page is undated; date taken from the changelog URL) | [Changelog 2026-02-09](https://elevenlabs.io/docs/changelog/2026/2/9/) |
| 4 | Fish S2 bracket cues, S1 parenthesis tags retire 2026-12-31, 13 languages for markers, 83 for s2.1-pro, max 3 combined | Confirmed, with additions | Added: after retirement `s1` requests are served by `s2.1-pro` and parenthesis tags are not converted. Flagged that `drama-3` (used in Magic Worlds code) is not listed among Fish's public models | [Fish emotions](https://docs.fish.audio/developer-guide/core-features/emotions); [Fish models](https://docs.fish.audio/developer-guide/models-pricing/models-overview) |
| 5 | Cartesia "Sonic-3" is the current model; emotion beta, English-only | Corrected (outdated) | Emotion-beta facts confirmed, but the current model is **Sonic 3.6** (snapshot 2026-08-27, 44 languages, context-inferred emotion without tags). Updated TL;DR, §1.5 table, §7(b) | [Cartesia emotion](https://docs.cartesia.ai/build-with-cartesia/sonic-3/volume-speed-emotion); [Cartesia models](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest) |
| 6 | Gemini Live: `gemini-3.8-live`, `-extended-thinking`, legacy `gemini-3.1-flash-live-preview`; affective/proactive not on 3.1 Flash Live; 99 languages; 15-min audio sessions; 128k context; prebuilt voices only; SynthID | Confirmed, one sourcing fix | Rewrote a garbled parenthetical. SynthID is stated in the 2025-06 Google blog, not in the current Live guide; attribution corrected. Added the 2-minute audio+video cap | [Live guide](https://ai.google.dev/gemini-api/docs/live-guide); [Google blog 2025-06-03](https://blog.google/technology/google-deepmind/gemini-2-5-native-audio/) |
| 7 | Hume: EVI 3 English-only, EVI 4-mini 11 languages and requires a supplemental LLM, EVI 1/2 retired 2025-08-30 | Confirmed | None | [EVI versions](https://dev.hume.ai/docs/speech-to-speech-evi/configuration/evi-version) |
| 8 | Hume's latency table (EVI 3 ~1.2 s, Sesame ~1.0 s, Gemini Live ~1.5 s, GPT-4o Realtime ~2.6 s, measured from New York) | Confirmed (vendor-reported, stale models) | Added that Sesame beat EVI 3 in Hume's own table, and that these models have since been superseded | [Hume EVI 3 blog](https://www.hume.ai/blog/introducing-evi-3) |
| 9 | Character.AI Chapter 11, post dated 2026-10-12 | Confirmed, with additions | Added: case formally commenced 2026-10-15; sale expected late Nov or early Dec 2026; shutdown if no qualifying bid; services continue for now | [C.ai update](https://blog.character.ai/an-update-on-character-ai/) |
| 10 | Character.AI under-18 open-ended chat ban from 2025-11-25 with Persona | Confirmed | None | [The Record](https://therecord.media/character-ai-minors-banned) |
| 11 | Italy Garante fined Luka (Replika) €5M, decision 2025-04-10, including missing age verification before 2023-02-02 | Confirmed | None | [EDPB](https://www.edpb.europa.eu/news/national-news/2025/ai-italian-supervisory-authority-fines-company-behind-chatbot-replika_en) |
| 12 | FTC 6(b) inquiry 2025-09-11 to seven named companies | Confirmed | None. No 2026 FTC follow-up (6(b) report or enforcement) appeared among the most recent press releases checked | [FTC](https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions) |
| 13 | CA SB 243 signed 2025-10-13, in force 2026-01-01, reports from 2027-07-01, 3 h break reminder for known minors, $1,000 per violation | Confirmed, with an addition | Added that SB 1119 repeals and replaces SB 243's minor-specific provisions | [MoFo](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai); [Mondaq](https://www.mondaq.com/unitedstates/it-and-internet/1844304/adams-law-california-raises-the-bar-for-child-chatbot-protections) |
| 14 | NY GBL Art. 47 in force 2025-11-05; notice at start and every 3 h for all users; up to $15,000/day; "retaining information on prior interactions" in the definition | Confirmed | None | [MoFo](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai) |
| 15 | Washington HB 2225 signed 2026-03-24, effective 2027-01-01, 3 h adults / 1 h minors, minor anti-manipulation list, private right of action | Confirmed | None | [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/washington-state-enacts-law-regulating-ai-companion-chatbots-with-private-right-of-action) |
| 16 | Oregon SB 1546 signed 2026-03-31, effective 2027-01-01; 14 measures in 13 states; NE and ID ban "claims of being human or sentient" for minors | Partly corrected | Oregon and the 14/13 count confirmed. Idaho SB 1297 covers claims of being *human* only and does not explicitly mention sentience; Nebraska LB 525 covers both. Table text corrected | [Transparency Coalition](https://www.transparencycoalition.ai/news/watershed-year-for-chatbot-safety-measures-14-new-state-laws-enacted-so-far-in-2026) |
| 17 | CA SB 1119 signed 2026-09-10; effective dates conflict (2027-01-01 vs 2027-07-01); "up to $15,000 per affected child" | Corrected / resolved | Law effective 2027-01-01 with most duties from 2027-07-01 (not a conflict). Penalties are $5,000 per child (negligent) and $15,000 per child (intentional). Added child defaults (no persistent memory, no push notifications, 1 h sessions, 2 h daily cap), audit and testing dates, and implications in §8 P0 #4 and P2 #11 | [CA SD18](https://sd18.senate.ca.gov/news/governor-newsom-signs-adams-law); [Mondaq](https://www.mondaq.com/unitedstates/it-and-internet/1844304/adams-law-california-raises-the-bar-for-child-chatbot-protections) |
| 18 | EU AI Act Art. 50 from 2026-08-02, grace to 2026-12-02; code of practice finalised 2026-06-10; guidelines issued 2026-07-20 | Partly confirmed | Grace period confirmed as coming from the AI Omnibus *provisional* agreement (formal adoption unverified). Code of practice finalised 2026-06-10 confirmed by the Commission (about 190 signatories by end July). Draft guidelines 2026-05-08 confirmed; final guidelines on 2026-07-20 marked unverified | [Art. 50 guide](https://artificialintelligenceact.eu/transparency-rules-article-50/); [EC code of practice](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content); [Art. 50](https://artificialintelligenceact.eu/article/50/) |
| 19 | NO FAKES: S.4591 reported 2026-06-18; H.R.8915; ≤10-year licences; $5k/$25k per work; preempts some state laws | Partly corrected | Bill numbers, 2026-05-20 reintroduction and 2026-06-18 voice-vote report confirmed. The licence term and per-work damages were not found in 2026 sources (they come from earlier versions) and are marked unverified. Preemption detail made precise (future state laws only; ELVIS survives) | [Holland & Knight](https://www.hklaw.com/en/insights/publications/2026/06/senate-judiciary-committee-advances-legislation-to-protect-name); [Manatt](https://www.manatt.com/insights/newsletters/client-alert/congress-reintroduces-the-no-fakes-act-what-s-new-in-the-2026-bill) |
| 20 | LiveKit `interruption.mode="adaptive"` distinguishes backchannels "by gating VAD shortly after the agent starts speaking"; `min_duration`, `min_words`, `false_interruption_timeout`, `resume_false_interruption` | Partly corrected | API names confirmed; adaptive is the LiveKit Cloud default and works without STT. The VAD-gating mechanism is not in the docs and is now marked unverified | [LiveKit turns](https://docs.livekit.io/agents/build/turns/) |
| 21 | Pipecat `user_idle_timeout`, `on_user_turn_idle`, 5-10 s, timer starts when bot stops, suppressed during function calls, 2-3 escalating LLM check-ins | Confirmed | None (`user_idle_timeout` lives on `LLMUserAggregatorParams`; runtime changes via `UserIdleTimeoutUpdateFrame`) | [Pipecat idle guide](https://docs.pipecat.ai/guides/fundamentals/detecting-user-idle) |
| 22 | OpenAI realtime prompting guide is archived; ChatGPT Voice uses the "gpt-realtime family" | Confirmed, and newer models added | Archive confirmed. Added the successor "Prompting voice models" guide and the 2026 OpenAI lineup: `gpt-live-1` (full-duplex, $0.05/min, Live endpoint), `gpt-realtime-2.1`/`-2.1-mini`, `gpt-realtime-2`, `gpt-realtime-1.5`, `gpt-realtime-translate`; `gpt-realtime-mini` deprecated. Model behind ChatGPT Voice is not public, so wording softened | [Cookbook guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide); [Voice prompting](https://developers.openai.com/api/docs/guides/voice-prompting); [Models](https://developers.openai.com/api/docs/models); [gpt-live-1](https://developers.openai.com/api/docs/models/gpt-live-1); [Agents SDK guide](https://openai.github.io/openai-agents-python/realtime/guide/) |
| 23 | OpenAI Agents SDK: `RealtimePlaybackTracker`; debounced output guardrails that cancel the response and stop buffered audio | Confirmed | None | [Agents SDK realtime guide](https://openai.github.io/openai-agents-python/realtime/guide/) |
| 24 | ChatGPT voice inside chat since 2025-11-25, separate-mode toggle kept | Confirmed | Wording aligned with the article (replies appear as text; images and maps) | [TechCrunch](https://techcrunch.com/2025/11/25/chatgpts-voice-mode-is-no-longer-a-separate-interface/) |
| 25 | Sesame iOS preview 2026-05-27 in 39 countries with memory, incognito and texting mode; broader iOS/Android release about 2026-10-06; glasses in 2027 | Partly confirmed | Preview facts confirmed. iOS and Android availability confirmed on the homepage, but the release date is unverified. The 2027 glasses date is unverified (sources say only "coming soon") | [TestingCatalog](https://www.testingcatalog.com/sesame-debutes-ios-app-in-preview-with-personal-voice-agents/); [sesame.com](https://www.sesame.com/) |
| 26 | Maslych et al. CUI '25: n=54; delays 1.5/4.0/6.5 s; ηp²=0.42; natural fillers help at 4.0 s (p<.01) and 6.5 s (p<.0001); artificial cues no effect; 57%/61%/65% | Confirmed | None (ηp² is 0.422) | [arXiv HTML](https://arxiv.org/html/2507.22352v1) |
| 27 | Qiu et al. 755 ms cascaded TTFA (best 729 ms) | Confirmed, with an addition | Added the paper's Qwen3-Omni DashScope comparison (about 702 ms) | [arXiv 2603.05413](https://arxiv.org/abs/2603.05413) |
| 28 | RESPOND is Microsoft Research, 2026-03; Züfle et al. 2026-09-24 backchannel head on PersonaPlex 7B and F-Actor 1B, rated on par with real ones | Confirmed, one caveat | RESPOND's affiliation is not stated on the abstract page (authors are known MSR researchers); Züfle et al. fully confirmed | [arXiv 2603.21682](https://arxiv.org/abs/2603.21682); [arXiv 2609.29418](https://arxiv.org/abs/2609.29418) |
| 29 | Talking Turns (ICLR 2025) "rarely backchannel"; Full-Duplex-Bench ASRU 2025, v3 2025-08-16 | Confirmed | None | [arXiv 2503.01174](https://arxiv.org/abs/2503.01174); [arXiv 2503.04721](https://arxiv.org/abs/2503.04721) |
| 30 | De Freitas: 37% of 1,200 farewells manipulative, up to 14x engagement; Fang et al. RCT n=981, 4 weeks, no significant condition effects | Confirmed | None | [arXiv 2508.19258](https://arxiv.org/abs/2508.19258); [arXiv 2503.17473](https://arxiv.org/abs/2503.17473) |
| 31 | ElevenLabs Text to Dialogue "capped at 2,000 characters" | Corrected | The docs give 2,000 characters as a reliability guideline, not a hard cap; added v4 recommended, no speaker limit, optional `seed` | [Text to Dialogue](https://elevenlabs.io/docs/capabilities/text-to-dialogue) |
| 32 | Multi-context WebSocket: `voice_id` is a path parameter; `inactivity_timeout` default 20, max 180 | Confirmed | None | [API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-multi-stream-input) |
| 33 | ElevenLabs use policy updated 2026-10-09: 18+, no under-18 voices, visual-only explicit wording, emotional-dependency ban, no voice-based profiling, no provenance removal | Confirmed, with a qualification | The provenance ban applies when the aim is to disguise AI content or evade detection; wording in §6.5 made precise | [Use policy](https://elevenlabs.io/use-policy) |
| 34 | Kindroid forms long-term memories from voice calls; journals capped at 500 entries | Confirmed | None (the cap applies to each journal type separately) | [Kindroid memory docs](https://kindroid.ai/v2/docs/memory/) |
| 35 | Sesame CSM-1B Apache-2.0, released 2025-03-13, context `Segment`s; Deepgram blog figures (Dutch 199 ms, English 242 ms, half below 350 ms) | Confirmed | None | [CSM GitHub](https://github.com/SesameAILabs/csm); [Deepgram](https://deepgram.com/learn/voice-ai-latency-why-pauses-read-as-hesitation) |

**Newer developments the original notes missed (now added in the body):**
- OpenAI `gpt-live-1`, a commercially available full-duplex voice model on a new Live endpoint, plus `gpt-realtime-2.1` as the recommended realtime agent model.
- Cartesia Sonic 3.6 (2026-08-27), with tagless, context-inferred emotional delivery in 44 languages.
- CA SB 1119's child defaults (no persistent memory, session caps), which bear directly on Magic Worlds' cross-call memory plans.
- Character.AI's Chapter 11 filing date and the possible platform shutdown.

**Still unverified:** final EU Art. 50 guidelines date; formal adoption of the AI Omnibus; the NO FAKES 2026 licence-term and damages figures; the AB 1043 effective date; Sesame's general-release date and glasses timeline; the `[pause]` tag syntax on Eleven v4; whether `drama-3` is a valid Fish model ID; the release date of `gpt-live-1`.
