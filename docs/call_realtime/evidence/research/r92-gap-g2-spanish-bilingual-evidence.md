# r92: Gap G2. Spanish and EN/ES code-switching evidence for STT, turn detection and TTS

> **Date:** 2026-10-20.
> **Scope:** Spanish-specific numbers that the earlier notes said existed but could not retrieve:
> - **r02:** eot-bench per-language results "only in the interactive leaderboard".
> - **r03:** "no independent streaming Spanish benchmark".
> - **r04:** the AA Spanish TTS arena was "unverified" and "not fetched".
> - **r07 / r09:** English-only figures.
>
> Also covered: es-MX vs es-ES handling, mid-utterance EN/ES code-switching, audio tags in Spanish, and cross-lingual clone accent retention.
>
> **Method:**
> - The shared WebSearch budget for this workflow was exhausted before this note started. My first search returned "budget used up".
> - Everything below therefore comes from **direct fetches of primary pages and files**:
>   - the result files committed in the GitHub repos;
>   - Hugging Face model and dataset cards, plus the HF API;
>   - the Artificial Analysis leaderboard page, including the server-rendered data it embeds;
>   - vendor docs, which are mostly `llms.txt` and `.md` and `.mdx` doc sources;
>   - one arXiv paper.
> - No number here comes from memory. Where I infer something, it says so.
>
> **Labels:**
> - **[IND]** = independent third party.
> - **[VEND]** = vendor-reported about its own product.
> - **[VEND-RUN]** = a vendor measuring competitors. It is independent of the competitor but not neutral.
> - **[OPEN-VEND]** = a vendor's open, reproducible benchmark that includes the vendor's own model.
> - **(stale?)** = source older than 12 months.

---

## 0. TL;DR (what changed versus the English-only picture)

1. **A Spanish TTS leaderboard exists, and the data is in the page.**
   - Artificial Analysis (AA) runs Spanish only in its **Controlled Voice** arena. That arena clones one male and one female voice from native Spanish speakers, and native-speaker raters judge the output. That makes it a direct proxy for "cloned character voice speaking Spanish".
   - The language selector is client-side. The full Spanish table is embedded in the server-rendered page, and I extracted it ([AA Controlled Voice](https://artificialanalysis.ai/text-to-speech/leaderboard/controlled-voice), retrieved 2026-10-20) **[IND]**.
   - Overall Spanish ranking: **Eleven v4 1284 > Eleven v4 Turbo 1215 ≈ Sonic 3.6 1203 > Eleven v3 1176 > … Realtime TTS-2 (Inworld) 1123 … Gemini 3.8 Flash-Lite TTS 1112 … Speech 2.8 HD (MiniMax) 1100 ≈ Gemini 3.8 Flash TTS 1099 … Fish Audio S2 Pro 1005**.
   - **Fish S2.1 Pro and Fish Drama 3 are not on the Spanish board yet**, presumably for lack of votes (AA hides models below a vote threshold).
2. **Eleven v4 Turbo loses more in Spanish than in English.**
   - In English (Controlled Voice) v4 and v4 Turbo tie at 1157.
   - In Spanish, v4 beats v4 Turbo by 69 Elo, about a 60% head-to-head win rate (CIs do not overlap: 1262–1306 vs 1194–1236).
   - In the **Entertainment** category, the closest proxy for roleplay, **Sonic 3.6 (1189) edges v4 Turbo (1155)**. The CIs overlap, so this is not significant.
3. **Turn-detection rankings change in Spanish.** Source: eot-bench Spanish split, 400 real turns and 1,236 decision spans, results committed in the repo **[OPEN-VEND, LiveKit]**.

   | Model | ES false cut-off @600 ms (EN) | ES latency @5% (EN) |
   |---|---|---|
   | LiveKit v1 | **6.0%** (4.5%) | **642 ms** (543) |
   | Deepgram Flux-multi | 8.7% (9.9%) | 820 ms (1,151) |
   | Soniox | 11.4% (5.5%) | 800 ms (647) |
   | LiveKit v1-mini | 12.2% (12.1%) | 926 ms (1,070) |
   | Smart Turn v3.2 | 17.3% (14.8%) | 980 ms (1,051) |
   | AssemblyAI multilingual | 18.3% (14.6%) | 1,031 ms (1,049) |
   | VAD-only | 24.5% (21.7%) | 1,200 ms (1,600) |

   - **Flux improves in Spanish while Soniox's cut-off rate doubles.** The English-based "Soniox ≈ best STT-integrated EoT" conclusion does not hold for Spanish callers.
   - **Newer (fact-check 2026-10-20): LiveKit has published v1.1 / v1.1-mini results in an open, unmerged PR** ([eot-bench PR #20](https://github.com/livekit/eot-bench/pull/20), opened 2026-10-18) **[OPEN-VEND]**. Spanish: v1.1 = 6.0% @600 ms (unchanged) and 608 ms @5% (was 642); **v1.1-mini = 7.3% @600 ms (was 12.2%) and 746 ms @5% (was 926)**. v1.1-mini would beat Flux-multi (8.7%) on Spanish false cut-offs, but the PR says it "needs a `livekit-local-inference` release that bundles it; none is out yet". The LiveKit turn-detector docs still list only v1 / v1-mini.
4. **Smart Turn v3.2 is the model that degrades most in Spanish.**
   - eot-bench AUC (diagnostic only) falls from 0.845 (EN) to 0.776 (ES). Every other model loses at most 0.054 (Soniox), and Flux loses only 0.012.
   - Smart Turn's own benchmark puts Spanish 18th of 23 languages: 91.53% accuracy and 4.54% FPR on the GPU/fp32 build, vs 94.71% / 2.98% in English **[VEND]**.
   - On the **CPU int8 build, Spanish drops to 89.57% and FPR to 6.95%**, a 2-point quantization cost. English loses only 0.45 points.
   - This matters because the earlier plan (r01/r02) proposed the 8 MB int8 CPU build.
5. **There is no collapse in Spanish for any model.** v1-mini scores AUC 0.885 in Spanish vs 0.890 in English (I computed this, and a third party reproduced it in [eot-bench issue #14](https://github.com/livekit/eot-bench/issues/14)). The Romanian 0.565 result is a language outside the training set; Spanish is inside it.
6. **Spanish streaming WER exists only as a vendor-run table** (AssemblyAI, runs 2026-08-25 to 2026-09-23) **[VEND-RUN]**. Realtime FLEURS-es:

   | System | WER |
   |---|---|
   | Gemini 3.5 Live | 3.8% |
   | AssemblyAI U-3.6 Pro | 4.1% |
   | GPT-4o-transcribe | 4.3% |
   | Scribe v2 | 4.6% |
   | Speechmatics Enhanced | 4.7% |
   | Soniox | 5.0% |
   | Deepgram Flux | **7.8%** |
   | Deepgram Nova-3 | **8.9%** |
   | Cartesia Ink-Whisper | 9.0% |

   - **Flux leads Spanish turn detection but sits near the bottom on Spanish accuracy.**
   - AA's STT benchmark and the Pipecat STT benchmark are **English-only**. I confirmed this from AA's methodology and from Pipecat's ground-truth file.
7. **Real conversational Spanglish is hard for everyone.** On AssemblyAI's 10-hour **Miami** Spanish–English conversational set (realtime), WER is 21.9–61.3%:

   | System | WER |
   |---|---|
   | Soniox | **21.93%** (best) |
   | Meta Muse | 23.10% |
   | AssemblyAI U-3.6 Pro | 24.28% |
   | Reson8 | 24.48% |
   | Scribe v2 RT | 27.09% |
   | AWS | 27.96% |
   | Nova-3 Multi | 29.91% |
   | GPT-4o-transcribe | 61.27% |

   On synthetic read EN↔ES switches, U-3.6 Pro scores 9.59%, Soniox 12.12% and Nova-3 Multi 16.66% **[VEND-RUN]**.
8. **Regional Spanish defaults to Spain on several TTS providers.**
   - Cartesia (`es` → `es-ES*`, also `es-MX` and `es-US`) and Inworld (`es` → `es-ES`, with 21 Spanish regional codes) resolve the bare code `es` to **European Spanish**.
   - Magic Worlds strips every language tag to its primary subtag (`normalize_language_code`: "es-ES" → "es"; `magic-worlds-api/src/services/speech/types.py:129-139`). **A Latin American caller on those providers would get Castilian normalization and accent by default.**
9. **Cross-lingual clone accent behaviour differs by vendor.**
   - Eleven v4 **deliberately drops** the reference accent. Its docs call this "a deliberate change … not a bug", and a toggle is "being explored".
   - Inworld TTS-2 also drops it unless you steer it.
   - Cartesia Sonic 3.6 IVCs **keep** the original accent: a "clone hangs on to much more of the original speaker's accent". Native accents can be added per voice.
   - Eleven Multilingual v2 keeps the speaker's accent across languages.
10. **Audio tags in Spanish.**
    - Gemini TTS says to keep inline tags in **English** for non-English transcripts.
    - Inworld says steering "must be written in English".
    - Fish Drama 3 says direction can be written "in whatever language you think in".
    - Fish S2 cues work in Spanish, and "usually work best at the sentence start" in those languages.
    - **ElevenLabs does not document tag behaviour for non-English text.** Every v4 example is English. This needs an in-house test.

---

## 1. Source map and independence

| Area | Source | What it measures | Label | Date |
|---|---|---|---|---|
| TTS, Spanish | AA Controlled Voice arena, `es` board (embedded page data) | Blind pairwise preference by native raters; cloned voices from 1 male and 1 female native speaker; separate Elo fit anchored at OpenAudio S1 = 1000 | **[IND]** | Retrieved 2026-10-20; newest Spanish entries released 2026-09-28 (unverified: the payload only says "Sept 2026") |
| TTS, Spanish | Fish Audio S2 tech report (arXiv 2603.08823) | WER / SIM on the MiniMax multilingual test set and CV3-Eval | **[VEND]** | v2 2026-03-11 |
| Turn detection, Spanish | livekit/eot-bench `output/.../es/` | False cut-off @ latency budget, latency @ cut-off budget, AUC | **[OPEN-VEND]** (LiveKit data and harness; independent for other vendors' models) | Initial commit 2026-06-09; es dir last commit 2026-09-14 |
| Turn detection, Spanish | Smart Turn v3.2 benchmark files on HF | Clip accuracy / FPR / FNR per language on Smart Turn's own test set | **[VEND]** | 2026-01-07 |
| Turn detection, Spanish | eot-bench issue #14 | Third-party re-run of v1-mini AUC per language | **[IND]** (user) | 2026-09-05 |
| Turn detection, Spanish | eot-bench open PRs #17–#21 (added by fact-check) | Unmerged results: LiveKit v1.1 / v1.1-mini, DuplexJev, haan, p99lab, GPT-Live | **[OPEN-VEND]** (#20, #21); third party (#17–#19) | 2026-10-06 → 2026-10-18 |
| STT, Spanish (batch) | Open ASR Leaderboard multilingual `es` CSV | WER on FLEURS / MCV / MLS (read speech) | **[IND]** | Dataset modified 2026-10-19 |
| STT, Spanish (streaming) | AssemblyAI /benchmarks Tables 10–14 | Realtime WER on FLEURS and Common Voice; code-switching sets; Miami 10 h | **[VEND-RUN]** | Runs 2026-08-18 → 2026-09-23 |
| STT | AA STT methodology; Pipecat stt-benchmark ground truth | English-only (confirmed) | [IND] | AA-WER v2.2 since May 2026; Pipecat GT 2026-01-03 |
| Locales / code-switching | Vendor docs (Deepgram, Soniox, Speechmatics, ElevenLabs, Cartesia, Inworld, Fish, Gemini, MiniMax) | Capabilities, not quality | **[VEND]** | Mostly undated; retrieved 2026-10-20 |
| Whisper hallucinations | openai/whisper discussion #928 | Community-reported Spanish phrases | Community **(stale?)** | 2023-02-06 |

---

## 2. Turn detection in Spanish (eot-bench `es` split)

### 2.1 Dataset and harness facts

- **Data.** `livekit/eot-bench-data`, `es` config: **400 real human-to-agent user turns**, 16 kHz mono WAV, word timings, and prior messages.
  - Sampled deterministically (seed `20260603`) from LiveKit's full dataset.
  - Turns are excluded if the final pause is < 0.2 s or **any pause is > 5.0 s**. That removes the longest "thinking" pauses, which roleplay users do produce.
  - Domain is "task-oriented". The previewed rows are restaurant ordering.
  - Sources: [HF card](https://huggingface.co/datasets/livekit/eot-bench-data) (created 2026-06-09, modified 2026-07-22) and [README](https://github.com/livekit/eot-bench).
  - **The HF card says `license: cc-by-4.0`; the GitHub README says "Apache-2.0".** Treat it as CC-BY-4.0 until LiveKit clarifies.
- **Spans.** The Spanish split has **1,236 silence spans ≥ 100 ms**: 400 `eot` and 836 `hold` (`es/span_set_manifest.json`). The total scored audio is about 5,326 s (≈ 89 min) (unverified).
- **Policy sweep.** The harness sweeps `threshold`, `action_delay` and `timeout`.
  - "Latency" is dead air after the true end of turn, not compute time.
  - AUC/AP are diagnostics that "do not rank models".
- **Model configurations used for Spanish** (from each run's `manifest.json`):

  | Entry | Configuration |
  |---|---|
  | Deepgram Flux | `flux-general-multi`, `eot_threshold` 0.7, **no `language_hint`** (auto-detect) |
  | AssemblyAI | **`universal-streaming-multilingual`**, not U-3.6 Pro. `end_of_turn_confidence_threshold` 0.1, `min_turn_silence` 100 ms, `max_turn_silence` 3,000 ms. Per AssemblyAI's multilingual docs this model covers 6 languages (en, es, de, fr, pt, it) and switches language **per turn, not mid-sentence**; U-3.6 Pro (`universal-3-6-pro`) is the mid-sentence code-switching model |
  | Soniox | **`stt-rt-preview`** alias, `max_endpoint_delay_ms` 2000. Soniox's current model is `stt-rt-v5` (2026-06-16), which promises "faster and more reliable semantic endpointing", so the benchmarked behaviour may be older. Fact-check: the Spanish Soniox run was committed in eot-bench's **initial commit (2026-06-09), one week before `stt-rt-v5` went GA**, and Soniox's models page no longer lists a plain `stt-rt-preview` alias. Whether that alias then pointed at a v5 preview is (unverified) |
  | Smart Turn | `smart-turn-v3.2-gpu` (**fp32**), scored 0.2 s into each pause |
  | LiveKit v1-mini | `livekit-local-inference 0.2.5`, last 1.2 s of audio |
  | LiveKit v1 | Cloud `turn-detector-v1` |

### 2.2 Spanish results, with English for comparison

Sources: [`es/comparison/report.md`](https://github.com/livekit/eot-bench/blob/main/output/livekit__eot-bench-data__validation__min_silence_100ms/es/comparison/report.md), [`language_comparison/report.md`](https://github.com/livekit/eot-bench/blob/main/output/livekit__eot-bench-data__validation__min_silence_100ms/language_comparison/report.md), and AUC from each run's `metrics/summary.json`. All are **[OPEN-VEND]**.

| Model | FC @300 ms ES (EN) | FC @600 ms ES (EN) | Latency @5% FC ES (EN) | Latency @10% FC ES (EN) | Detect @5% ES | AUC ES (EN) |
|---|---|---|---|---|---|---|
| **LiveKit Turn Detector v1** | **15.5%** (9.9%) | **6.0%** (4.5%) | **642 ms** (543) | **438 ms** (295) | 90.5% | 0.943 (0.969) |
| **Deepgram Flux (multi)** | 16.4% (12.9%) | **8.7%** (9.9%) | **820 ms** (1,151) | 536 ms (548) | **98.5%** | 0.930 (0.941) |
| Soniox (stt-rt-preview) | n/a (n/a) | 11.4% (5.5%) | 800 ms (647) | 611 ms (512) | 75.8% | 0.852 (0.906) |
| LiveKit v1-mini | 26.0% (27.8%) | 12.2% (12.1%) | 926 ms (1,070) | 667 ms (698) | 89.5% | 0.885 (0.890) |
| Gradium | 58.9% (55.6%) | 15.2% (12.6%) | 934 ms (913) | 709 ms (656) | 75.8% | n/a |
| **Smart Turn v3.2 (GPU fp32)** | 38.7% (35.2%) | 17.3% (14.8%) | 980 ms (1,051) | 769 ms (739) | 85.0% | **0.776 (0.845)** |
| ultraVAD | 41.6% (27.7%) | 17.6% (11.9%) | 986 ms (899) | 764 ms (663) | 84.5% | 0.810 (0.884) |
| AssemblyAI (universal-streaming-multilingual) | 52.5% (49.4%) | 18.3% (14.6%) | 1,031 ms (1,049) | 792 ms (713) | 89.2% | 0.856 (0.896) |
| OpenAI GPT Realtime 2 (semantic_vad auto) | n/a | n/a | 1,044 ms (1,143) | 755 ms (824) | 91.2% | n/a |
| VAP (silent agent) | 52.6% (47.0%) | 18.8% (14.6%) | 1,067 ms (1,131) | 841 ms (749) | 90.2% | n/a |
| **VAD baseline (silence only)** | 58.9% (55.6%) | 24.5% (21.7%) | 1,200 ms (1,600) | 1,000 ms (1,000) | n/a | n/a |

Notes:
- "n/a" at 300/600 ms means the model never reaches that latency budget. Soniox and OpenAI hold internally before emitting.
- **Detect** = the share of true turn ends the model fires on before the timeout. Soniox's 75.8% means about a quarter of Spanish turns end on the 2 s timeout fallback at that operating point.
- The JoinIn AI Baton and Cartesia Ink 2 English entries have no Spanish run.

### 2.3 What changes in Spanish

- **Flux and Soniox swap places.**
  - In English, Soniox beats Flux at 600 ms (5.5% vs 9.9% false cut-off) and at the 5% budget (647 vs 1,151 ms).
  - In Spanish, Flux beats Soniox on false cut-offs at 600 ms (8.7% vs 11.4%) and on latency at the 10% budget (536 vs 611 ms). At the 5% budget Soniox is marginally ahead (800 vs 820 ms), which is effectively a tie. Flux also has far higher recall (98.5% vs 75.8% detected).
  - Flux is the only model whose 600 ms false cut-off rate *improves* in Spanish.
  - Caveat: Flux ran without `language_hint`. With `language_hint: ["es"]` it may do better still. That is untested.
- **Smart Turn v3.2 falls below LiveKit v1-mini** in Spanish on every budget (17.3% vs 12.2% @600 ms; 980 vs 926 ms @5%). In English the two are nearly level at 600 ms.
- **Everything still beats the VAD baseline in Spanish.**
  - Smart Turn v3.2 saves about 220 ms of dead air at a 5% cut-off budget (980 vs 1,200 ms) and cuts false cut-offs at 600 ms from 24.5% to 17.3%.
  - Flux saves about 380 ms. LiveKit v1 saves about 560 ms.
- **There is no collapse.** v1-mini's Spanish AUC (0.885) matches the third-party re-run in issue #14 (es / fr / de = 0.885 / 0.887 / 0.874; Romanian telephony 0.565) **[IND]**. Spanish is a trained language. The Romanian collapse warns about *untrained* languages, not Spanish.
- **Spanish is a little harder for silence alone.** The VAD baseline at 600 ms is 24.5% in Spanish vs 21.7% in English. Spanish has more pauses inside turns in this data.

### 2.3b Pending results not yet merged into eot-bench (added by fact-check, 2026-10-20)

Open PRs on `livekit/eot-bench`; none is merged, so the published report above does not include them.

| PR | Model | Spanish FC@300 / FC@600 / lat@5% / lat@10% | Notes |
|---|---|---|---|
| [#20](https://github.com/livekit/eot-bench/pull/20) (LiveKit, 2026-10-18) | LiveKit Turn Detector **v1.1** | 16.4% / **6.0%** / **608 ms** / 389 ms | "v1.1 and v1.1-mini replace v1 and v1-mini in all 14 languages" **[OPEN-VEND]** |
| #20 | LiveKit Turn Detector **v1.1-mini** | 19.2% / **7.3%** / **746 ms** / 507 ms | Was 26.0 / 12.2 / 926 / 667 for v1-mini. Not installable yet: needs a `livekit-local-inference` release |
| [#19](https://github.com/livekit/eot-bench/pull/19) (third party, 2026-10-15) | DuplexJev-32B-Para v1.2 (open weights) | 33.4% / 13.6% / n/a / n/a | Trained on EN + ZH only; Spanish is zero-shot |
| [#18](https://github.com/livekit/eot-bench/pull/18) (third party, 2026-10-07) | haan (Smart Turn v3.2 fine-tuned on telephone audio) | not extracted | Same ONNX interface as Smart Turn v3.2 |
| [#17](https://github.com/livekit/eot-bench/pull/17) (third party, 2026-10-06) | p99lab turn-1 / turn-1-mini (Apache-2.0) | **English-only models** | Not usable for Spanish |

If v1.1-mini ships with these numbers, it becomes the best self-hosted Spanish option by a wide margin over Smart Turn v3.2 (17.3% @600 ms).

### 2.4 Smart Turn's own per-language benchmark [VEND]

This uses Smart Turn's own test set. It is not comparable with eot-bench. Of the 31,527 clips, 16,254 come from `chirp3_1`, a synthetic Google Chirp 3 TTS source.

| Build | Spanish accuracy / FPR / FNR (n = 1,783) | English accuracy / FPR / FNR (n = 7,820) | Spanish rank (of 23) |
|---|---|---|---|
| v3.0 (2025-09) | 84.46 / 7.29 / 8.24 | 85.49 / 8.41 / 6.10 | – |
| v3.2 **GPU fp32** (2026-01-07) | **91.53 / 4.54 / 3.93** | 94.71 / 2.98 / 2.31 | 18th |
| v3.2 **CPU int8** (2026-01-07) | **89.57 / 6.95 / 3.48** | 94.26 / 3.75 / 1.99 | – |

Sources: [smart-turn-v3 HF benchmarks folder](https://huggingface.co/pipecat-ai/smart-turn-v3/tree/main/benchmarks) (v3.0 and v3.2 files regenerated 2026-01-07); [Smart Turn v3 blog](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/) (2025-09-11, **stale?**). The blog's v3.0 table gives Spanish 91.97 / 4.48 / 3.55 on an older test set of 1,295 clips, which is why r02 quoted 91.97%.

- **Quantization costs Spanish more than English.**
  - Spanish loses 1.96 points of accuracy and gains 2.41 points of false positives (premature turn ends).
  - English loses only 0.45 points.
  - Spanish false positives on the CPU build (6.95%) are about 1.85× English's on the same CPU build (3.75%), and more than double English's GPU-build figure (2.98%). (Fact-check: the original line compared across builds.)
  - Fact-check 2026-10-20: v3.2 (2026-01-07) is still the newest Smart Turn release. The HF repo and the `pipecat-ai/smart-turn` README show no v3.3 or v4.
- **Inference (not tested):** the eot-bench Spanish numbers above used the fp32 GPU build. A CPU int8 deployment would likely do somewhat worse on Spanish than §2.2 shows.

### 2.5 LiveKit language plumbing caveat

The LiveKit audio turn detector picks its per-language `unlikely_threshold` from **the language the STT reports**. With no STT, as with a realtime model, it "defaults to English thresholds". You can force a language via the STT config, e.g. `language="es"` ([turn-detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector.md), retrieved 2026-10-20). Code-switching is not documented.

So a bilingual caller whose STT mislabels a turn gets the wrong threshold.

---

## 3. Spanish STT accuracy

### 3.1 What is independent

- **Artificial Analysis STT (AA-WER v2.x) is English-only.**
  - The methodology lists AA-AgentTalk (proprietary), VoxPopuli "Subset: English", and Earnings22.
  - There are no language filters, and "accepted spelling variants … US / UK English".
  - Source: [AA STT methodology](https://artificialanalysis.ai/methodology/speech-to-text), v2.2 since May 2026.
  - The cached AA streaming and batch pages have no `es` data either.
- **The Pipecat STT benchmark is English.** It uses 1,000 samples from `smart-turn-data-v3.1-train`. I checked the ground-truth JSONL: 5,002 lines and essentially no Spanish text ([repo](https://github.com/pipecat-ai/stt-benchmark), GT 2026-01-03). Soniox's benchmark page reuses this set ([soniox.com/benchmarks](https://soniox.com/benchmarks), Aug 2026).
- **The only broad independent Spanish table is batch:** the Open ASR Leaderboard `es` track, on read speech (FLEURS, Common Voice, MLS audiobooks). It was re-fetched on 2026-10-20, dataset last modified 2026-10-19 ([CSV](https://huggingface.co/datasets/hf-audio/multilingual_evals/resolve/main/multilingual_es.csv)) **[IND]**. Average of FLEURS / MCV / MLS:

| Rank | Model (batch) | ES avg WER | FLEURS | MCV | MLS | Note |
|---|---|---|---|---|---|---|
| 1 | microsoft/azure-speech-06-2026 | 2.25 | 1.75 | 2.24 | 2.77 | Azure realtime exists but slow (~1 s TTFS, EN Pipecat) |
| 2 | microsoft/azure-speech-07-2026 | 2.30 | 1.75 | 2.36 | 2.79 | Newer Azure snapshot (added by fact-check) |
| 3 | elevenlabs/scribe_v2 | 2.32 | 1.85 | 2.55 | 2.55 | Scribe v2 Realtime sibling |
| 4 | assemblyai/universal-3-pro | 2.49 | 2.20 | 2.76 | 2.52 | U-3.x Pro Realtime sibling |
| 5 | assemblyai/universal-3-5-pro | 2.52 | 2.04 | 2.71 | 2.80 | |
| 6 | reson8/resonant-1 (and resonant-1-flash, same scores) | 2.66 | 2.24 | 2.93 | 2.81 | Added by fact-check; Reson8 is also near the top of AssemblyAI's realtime Spanish tables (§3.2) |
| 8 | speechmatics/enhanced | 2.74 | 2.61 | 2.05 | 3.55 | |
| 8 | openai/gpt-transcribe | 2.74 | 1.98 | 3.11 | 3.14 | |
| 17 | **openai/whisper-large-v3 (≈ Groq, current)** | **3.35** | 2.30 | 4.29 | 3.47 | Batch only, no partials |
| 18 | soniox/stt-async-v5 | 3.37 | 2.40 | 4.27 | 3.44 | stt-rt-v5 sibling |
| 22 | meta/muse-voice-transcribe | 3.64 | 2.74 | 4.52 | 3.67 | |
| 26 | openai/whisper-large-v3-turbo | 3.85 | 2.73 | 4.98 | 3.85 | |
| 29 | mistralai/Voxtral-Mini-4B-Realtime-2602 | 4.18 | 2.80 | 5.02 | 4.73 | Open, native streaming |
| 33 | nvidia/nemotron-3.5-asr-streaming-0.6b | 5.43 | 4.23 | 6.91 | 5.16 | Open, native streaming |

(40 models in total; the CSV has 41 lines including the header. Ranks are by the unweighted mean of the three columns, which the CSV does not itself provide. Fact-check corrected Voxtral RT from rank 30 to 29 and Nemotron from 34 to 33. Deepgram, Cartesia and Gladia are not in the Spanish track.)

**Reading:** on read Spanish, the gap between Whisper-large-v3 and the leaders is only about 1 point of WER. Accuracy alone does not justify leaving Whisper for Spanish. Latency, partials, turn signals and hallucinations do (as r03 concluded).

### 3.2 Spanish streaming WER, vendor-run [VEND-RUN, AssemblyAI]

Source: [assemblyai.com/benchmarks](https://www.assemblyai.com/benchmarks), Tables 10–13, runs 2026-08-25 → 2026-09-23.
- Protocol: "streamed in real time to each system's public API, default settings, language fixed"; final transcripts only; one shared normalizer.
- AssemblyAI is not #1 on Spanish FLEURS in its own table.

| System (realtime) | FLEURS-es | Common Voice-es | Table |
|---|---|---|---|
| Google Gemini 3.5 Live | **3.8** | 4.0 | 10/12 |
| Reson8 | 4.0 | **3.5** | 11/13 |
| AssemblyAI Universal-3.6 Pro | 4.1 | 3.2 | 10/12 |
| OpenAI GPT-4o Transcribe | 4.3 | 8.9 | 10/12 |
| AssemblyAI Universal-3.5 Pro | 4.4 | 4.3 | 11/13 |
| ElevenLabs Scribe v2 (RT) | 4.6 | 5.8 | 10/12 |
| Speechmatics Enhanced | 4.7 | **2.5** | 10/12 |
| Mistral Voxtral Mini | 4.8 | 5.7 | 11/13 |
| Soniox Realtime | 5.0 | 6.0 | 10/12 |
| Zoom Scribe (Live) | 5.2 | 5.7 | 11/13 |
| AWS Transcribe | 5.3 | 4.1 | 10/12 |
| OpenAI GPT Realtime | 5.7 | 6.9 | 10/12 |
| xAI Grok Streaming | 6.1 | 8.9 | 11/13 |
| Meta Muse Voice Transcribe | 6.5 | 4.9 | 10/12 |
| Gladia Solaria | 6.7 | 7.8 | 10/12 |
| Azure (realtime) | 7.7 | 6.8 | 10/12 |
| **Deepgram Flux** | **7.8** | **7.8** | 11/13 |
| Smallest Pulse | 8.9 | 8.6 | 11/13 |
| **Deepgram Nova-3** | **8.9** | **8.4** | 11/13 |
| Cartesia Ink-Whisper | 9.0 | 10.4 | 10/12 |

- **Deepgram's Spanish WER is about twice the leaders'** on both sets, according to a competitor.
- Deepgram's own launch post gives **no** WER figures, only "monolingual-grade accuracy" ([press release](https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release), 2026-04-29, updated 2026-10-12) **[VEND]**.
- A May 2026 community thread (r03) reports Spanish and bilingual misrecognitions on Flux-multi. Treat Flux-es accuracy as **unproven and possibly weak** until measured in-house.

### 3.3 Vendor model cards that name Spanish test sets [VEND]

| Model | Spanish result | Test set | Source |
|---|---|---|---|
| NVIDIA Nemotron 3.5 ASR Streaming 0.6B | 4.87% @80 ms, 4.39% @320 ms, 4.11% @1.12 s chunk | FLEURS-es | [HF card](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b) (2026-06-04; via r03) |
| Mistral Voxtral Mini 4B Realtime | 5.34% @160 ms, 3.31% @480 ms, 2.98% @960 ms | FLEURS-es | [HF card](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602) (Feb 2026; via r03) |
| ElevenLabs Scribe v2 | "Excellent (≤5% WER)" tier; no number | not named | [STT capability page](https://elevenlabs.io/docs/overview/capabilities/speech-to-text) |
| Deepgram Flux Multilingual | "on par with dedicated monolingual models" with hints; no number | none | [Flux language prompting](https://developers.deepgram.com/docs/flux/language-prompting) |

### 3.4 Code-switching STT (EN↔ES) [VEND-RUN, AssemblyAI]

Table 14, realtime, runs 2026-08-18 → 2026-09-23. "EN↔ES" is synthetic: real read-speech clips concatenated so that the switch falls at different points. "Miami 10 h" is a licensed 10-hour selection of the Miami Spanish–English conversations, with references from an independent third-party transcription service. **Miami is the closest public proxy for a real bilingual caller.**

| System (realtime) | EN↔ES (read, spliced) | **Miami 10 h (real Spanglish)** |
|---|---|---|
| **Soniox Realtime** | 12.12% | **21.93%** |
| Meta Muse Voice Transcribe | 13.34% | 23.10% |
| AssemblyAI Universal-3.6 Pro RT | **9.59%** | 24.28% |
| Reson8 | 12.58% | 24.48% |
| ElevenLabs Scribe v2 Realtime | 14.27% | 27.09% |
| AssemblyAI Universal-3.5 Pro RT | 10.95% | 27.31% |
| AWS Transcribe Streaming | 11.32% | 27.96% |
| Deepgram Nova-3 Multi | 16.66% | 29.91% |
| Azure Realtime | 17.25% | 34.17% |
| Gladia Solaria | 18.39% | 34.49% |
| Speechmatics Enhanced RT | 33.75% | 36.04% |
| Gemini 3.5 Transcribe Live | 14.40% | 40.69% |
| OpenAI GPT-4o Transcribe | 39.66% | 61.27% |
| Deepgram Flux **EN** (wrong model for this) | 52.36% | 45.55% |

- **Flux Multilingual was not run** on the code-switching sets. Only Flux EN appears.
- **Speechmatics was probably run without its bilingual pack.** Speechmatics documents `{"language":"es","domain":"bilingual-en"}` for "Spanish and English in the same media file or stream" ([Speechmatics languages](https://docs.speechmatics.com/speech-to-text/languages)), and the protocol says "default settings". Its 33–36% is therefore probably not representative.
- **Whisper-family models do badly on code-switching:** GPT-4o-transcribe scores 39.7% / 61.3%. Inference: Groq whisper-large-v3 with `language="es"` forced is unlikely to do better on mixed turns. I did not measure this.
- Batch, from the same page: U-3.5 Pro 5.93% and Scribe v2 **5.47%** on "en-es long"; Soniox 8.51%; Nova-3 10.12%.

**Code-switching mechanisms by vendor** (all [VEND] docs):

| STT | Mechanism | Spanish codes | Notes |
|---|---|---|---|
| Groq whisper-large-v3 (current) | One `language` per request (ISO-639-1) | `es` | Per-request lock, no mixing. The Magic Worlds call language is fixed per call |
| Deepgram Flux `flux-general-multi` | `language_hint` (repeatable); mid-stream `Configure` replaces hints; an empty array means auto | `es` only (locale subtags fall back to base) | "Handles mid-sentence language switches natively"; keep `["en","es"]` for bilingual calls ([docs](https://developers.deepgram.com/docs/flux/language-prompting)) |
| Deepgram Nova-3 | `multi` (10 languages incl. Spanish) | `es`, `es-419` | ([models & languages](https://developers.deepgram.com/docs/models-languages-overview)) |
| Soniox stt-rt-v5 | Per-token `language` labels; `language_hints`; `language_hints_strict` | `es` | Strict mode is "best-effort", and "single language strongly recommended"; multiple languages "reduce robustness" ([restrictions](https://soniox.com/docs/stt/concepts/language-restrictions.mdx)) |
| AssemblyAI U-3.6 Pro RT | Native mid-sentence code-switching, 32 languages, "multilingual by default"; optional `language_codes` steering | `es` | ([multilingual streaming docs](https://www.assemblyai.com/docs/streaming/multilingual-transcription); [benchmarks](https://www.assemblyai.com/benchmarks)). The older `universal-streaming-multilingual` covers 6 languages and switches only per turn |
| Speechmatics | `language: "es"` + `domain: "bilingual-en"` | "Global Spanish" covering Spain, US, MX, CO, AR, VE, CL, PE | Realtime availability of the bilingual pack is not stated on the page |
| ElevenLabs Scribe v2 RT | Not documented. Fact-check: the STT capability page lists "Smart language detection" only for **batch Scribe v2**, not for Scribe v2 Realtime | `spa` | Code-switching not documented for either |

### 3.5 Whisper's Spanish hallucination phrases

**Sourced phrases.** From [openai/whisper discussion #928](https://github.com/openai/whisper/discussions/928) (2023-02-06, **stale?** but the training-data bias carries into large-v3):
- "Subtítulos realizados por la comunidad de Amara.org"
- "Subtitulado por la comunidad de Amara.org"
- "Subtítulos creados por la comunidad de Amara.org"
- "Subtítulos en español de Amara.org"
- "Más información www.alimmenta.com"
- "www.mooji.org"

The thread's mitigations:
- per-language blocklists, while noting that "filters can't catch every case";
- a `no_speech_prob` cut (0.7–0.9);
- VAD;
- rejecting near-silent audio;
- re-running suspicious segments in another language, because the hallucinated text differs by language.

**Coverage in the current Magic Worlds filter** (`magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py:226-299`). The filter normalizes case, accents and punctuation. It drops a transcript only when the *whole* single-segment transcript matches.

| Phrase | Covered? | How |
|---|---|---|
| All "Amara.org" variants | **Yes** | The `"amara org"` substring rule |
| "Subtítulos realizados por / Subtítulos por / Subtitulado por …" | Yes | Prefix rule |
| "gracias por ver (el video)", "gracias por su atención", "suscríbete" | Yes | Credit phrase set |
| "gracias", "muchas gracias" | Yes, only at low confidence | Conversational set |
| "Más información www.alimmenta.com", "www.mooji.org" | **No** | none |
| Hallucinated **suffixes** on real speech (e.g. "…\| Subtítulos realizados por …") | **No** | Whole-transcript match only. r03 §7 flagged this too |

**Not verified here** (common YouTube-style outros, worth adding as low-confidence-only candidates and checking against production logs): "¡Suscríbete al canal!", "No olvides suscribirte", "Hasta la próxima". I found no Spanish-specific hallucination-rate study. The ICASSP 2025 (Barański) and "Careless Whisper" studies are English (see r03).

---

## 4. es-MX vs es-ES handling

### 4.1 STT

Most streaming STT models treat Spanish as **one global model** with no region parameter:
- Whisper `es`, Flux `es`, Soniox `es`, AssemblyAI, and Speechmatics "Global Spanish".
- Deepgram Nova-2 and Nova-3 add `es-419`.
- Exception added by fact-check: NVIDIA Nemotron 3.5 ASR Streaming lists two Spanish locales, `es-US` and `es-ES`, on its HF card.

Region matters little for recognition. It matters for **output normalization** of numbers, currency and dates (e.g. es-ES "1.000,5" vs es-MX "1,000.5"), and the STT text feeds the LLM. Inference: STT region is low priority. Region in **TTS** is high priority.

### 4.2 TTS locale handling and defaults (all [VEND] docs)

| Provider / model | Spanish codes | What bare `es` resolves to | How region is applied |
|---|---|---|---|
| **Cartesia Sonic 3.6** | `es-ES*`, `es-MX`, `es-US` (via `locale`, Sonic ≥ 3.6) | **`es-ES`** (marked `*`) | Picks the matching accent *if the voice supports it*; otherwise the voice's default accent. Separate `normalization` field. "44 languages / 61 locales" ([advanced capabilities](https://docs.cartesia.ai/build-with-cartesia/capability-guides/advanced-capabilities); [changelog](https://docs.cartesia.ai/changelog/2026)) |
| **Inworld Realtime TTS-2 / Flash** | 21 Spanish codes: es-ES (default), es-MX, es-419, es-AR, es-CO, es-CL, es-PE, es-VE, es-PR, es-US→es-ES fallback, … | **`es-ES`**; "`es-US` as `es-ES`" | Spanish is **Tier 1**. The cloned voice's accent is kept when the locale matches; otherwise "steered" ([multilingual](https://docs.inworld.ai/tts/capabilities/multilingual.md)) |
| **ElevenLabs v4 / v4 Turbo** | Models page: "Spanish (es)". The v4 capability page labels it **"Spanish (LatAm)"** | n/a (accent comes from the voice) | Fact-check correction: the TTD multi-context WebSocket schema **does** declare a `language_code` query parameter (type string), but gives it no description, so its effect is undocumented and needs a test. That schema's default `model_id` is `eleven_v3_conversational` ([TTD multi WS](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket); [v4 page](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4); [models](https://elevenlabs.io/docs/overview/models)) |
| ElevenLabs Multilingual v2 / Flash v2.5 | "Spanish (Spain, Mexico)" | n/a | Keeps the speaker's accent across languages |
| Gemini 3.8 Flash / Flash-Lite TTS | "Spanish" (one entry) | Auto-detected | Accent comes from the regional voice choice. The docs say not to put "permanent accent changes" in the style prompt ([speech generation](https://ai.google.dev/gemini-api/docs/speech-generation), updated 2026-10-12) |
| MiniMax Speech 2.8 HD/Turbo | `language_boost: "Spanish"` | `auto` detection | No regional variants ([T2A API](https://platform.minimax.io/docs/api-reference/speech-t2a-http.md)) |
| Fish S2.1-Pro / S2-Pro / Drama 3 | Auto-detect; S2-Pro lists Spanish as **Tier 2** (Tier 1 = ja, en, zh) | Auto | No locale field ([S2-Pro card](https://huggingface.co/fishaudio/s2-pro); [models](https://docs.fish.audio/developer-guide/models-pricing/models-overview)) |
| Deepgram Aura-2 | Voices tagged es-MX, es-CO, es-ES, es-419, es-AR | Per voice | (r04) |
| Soniox TTS rt-v2 | `language` (required) | n/a | Sets "overall delivery and a light accent bias" ([language mixing](https://soniox.com/docs/tts/concepts/language-mixing.mdx)) |

**Magic Worlds today:**
- Call language is resolved once per call from turn language and user preference (`route_voice_call.py:576-592`) and then passed through `normalize_language_code`, which keeps only the primary subtag.
- STT receives `es`, which is fine.
- If Cartesia or Inworld are ever added, `es` silently means Spain.
- On ElevenLabs the accent follows the cloned voice. On Fish, language is auto-detected.

### 4.3 Mid-utterance EN/ES code-switching in TTS

| Provider | Mid-sentence mixing | Mechanism |
|---|---|---|
| **Inworld TTS-2** | Supported explicitly | Inline `<lang lang="es-MX">…</lang>` tags (SSML `xml:lang` also accepted), on every endpoint including WebSocket. The docs name `inworld-tts-2`; support on TTS-2 Flash is not stated (unverified). With `SENTENCE_BOUNDARY` auto mode, LLM tokens can be streamed and a tag may be split across messages. The docs' example word ("llama") is in both English and Spanish; tags are billed as characters ([language tags](https://docs.inworld.ai/tts/capabilities/language-tags.md)) |
| **Soniox TTS** | Supported | One primary `language` per request. "Embedded words and phrases from other languages are pronounced in a natural way". "Don't pick `language` based on a few embedded words" |
| **Cartesia Sonic 3.6** | **Discouraged except Hinglish/Taglish** | "Send one language per request… Mixing languages inside a single generation works where it's common, such as … Hinglish and … Taglish. Outside those cases the speech may sound accented" ([multilingual voices](https://docs.cartesia.ai/build-with-cartesia/capability-guides/multilingual-voices.md)) |
| ElevenLabs v4 / v4 Turbo | **Undocumented** | n/a |
| Fish S2.x / Drama 3 | Undocumented; auto-detect | n/a |
| Gemini 3.8 TTS | Undocumented; "detect the input language automatically" | n/a |
| Rime Arcana v3, some Deepgram Aura-2 Spanish voices | Advertised EN–ES code-switching | (r04) |

---

## 5. Spanish TTS quality: the AA Spanish Controlled-Voice board [IND]

### 5.1 Method

Source: [AA TTS methodology](https://artificialanalysis.ai/methodology/text-to-speech).
- The Controlled Voice Arena covers nine non-English languages, Spanish among them.
- Each language uses "one professionally recorded male voice and one professionally recorded female voice", captured from native speakers and **cloned** by every model. "Each model is evaluated only in the languages it supports."
- Raters are "screened to ensure the evaluated language is their first language", living in the country of origin where possible.
- Language boards are "separate fits on their own subsets". A board is published "once models have accumulated enough comparisons". Models with too few votes are hidden.
- The Spanish variety of the reference voices is not stated. The selector shows the 🇪🇸 flag.
- **Provider-voice (stock voice) boards are English-only.** I confirmed there is no `es` data in that page's payload.

How I got the data: the leaderboard UI's language filter is client-side. The server-rendered RSC payload of `/text-to-speech/leaderboard/controlled-voice` contains a list keyed by language: `null` (EN US+UK), `en-us`, `en-gb`, `ja`, `pt`, `vi`, `ar`, `hi`, `zh`, `fr`, `es`, `de`. Separate lists exist for the "All", Knowledge Sharing, Assistants, Entertainment and Customer Service categories. Retrieved 2026-10-20.

### 5.2 Spanish Elo (Controlled Voice), with English for comparison

| ES rank | Model | ES Elo (95% CI) | ES votes | ES Entertainment | ES Assistants | ES Customer service | EN Controlled Elo |
|---|---|---|---|---|---|---|---|
| 1 | **Eleven v4** | **1284** (1262–1306) | 1,304 | **1253** | **1263** | **1328** | 1157 |
| 2 | **Eleven v4 Turbo** | **1215** (1194–1236) | 1,101 | 1155 | 1237 | 1276 | 1157 |
| 3 | **Cartesia Sonic 3.6** | **1203** (1184–1222) | 1,522 | **1189** | 1216 | 1212 | 1151 |
| 4 | Eleven v3 | 1176 (1157–1195) | 1,334 | 1149 | 1141 | 1229 | 1072 |
| 5 | Cartesia Sonic 3.5 | 1134 | 1,330 | 1070 | 1157 | 1199 | 1117 |
| 6 | Eleven v3 Conversational | 1125 | 1,546 | 1095 | 1075 | 1160 | 1063 |
| 7 | **Inworld Realtime TTS-2** | **1123** (1105–1141) | 1,494 | 1070 | 1106 | 1142 | 1146 |
| 8 | Gradium TTS (Sep 2026) | 1117 | 1,010 | n/s | 1101 | 1165 | 1055 |
| 9 | **Gemini 3.8 Flash-Lite TTS** | 1112 | 2,041 | 1049 | 1055 | 1177 | 1055 |
| 10 | Eleven Multilingual v2 (2023) | 1102 | 1,329 | 1037 | 1106 | 1119 | 996 |
| 11 | **MiniMax Speech 2.8 HD** | **1100** (1081–1119) | 1,328 | 984 | 1148 | 1153 | 1021 |
| 12 | **Gemini 3.8 Flash TTS** | **1099** (1082–1116) | 2,057 | 1033 | 1090 | 1167 | 1048 |
| 13 | SpaceXAI TTS | 1087 | 1,308 | 1046 | 1080 | 1135 | 1057 |
| 14 | Inworld Realtime TTS-2 Flash | 1083 | 1,496 | 1034 | 1026 | 1143 | 1066 |
| 15 | Speechify Simba 3.0 | 1080 | 1,439 | 1081 | 1097 | 1092 | 1036 |
| 16 | MiniMax Speech 2.8 Turbo | 1074 | 1,331 | 1004 | 1096 | 1140 | 1021 |
| 17 | Qwen-Audio-3.0-TTS-Plus | 1072 | 1,255 | 1047 | 1050 | 1108 | 1125 |
| 19 | Soniox TTS Real-Time v2 | 1061 | 943 | 966 | n/s | 1178 | 941 |
| 20 | OpenAudio S1 Mini (Fish) | 1052 | 1,349 | 1015 | 1022 | 1040 | 1005 |
| 22 | Eleven Flash v2.5 | 1035 | 1,394 | 986 | 1077 | 1011 | 986 |
| 27 | **Fish Audio S2 Pro** | **1005** (986–1024) | 1,319 | 977 | 1000 | 1024 | 1002 |
| 28 | OpenAudio S1 (anchor) | 1000 | 1,356 | 1000 | 1000 | 1000 | 1000 |
| 32 | OpenVoice v2 | 814 | 1,340 | 779 | 806 | 799 | 807 |

(n/s = not shown in that category list, or not extracted. Category boards have about 150–700 votes per model, so their CIs are roughly ±35–60.)

**Not on the Spanish board** (present in English Controlled Voice): Fish **Drama 3** Preview, Fish **S2.1 Pro (Oct 2026)**, Qwen 3.1 TTS Plus, HeyGen Voice, Simba 3.2, StepAudio 2.5, Voxtral 3, Ming-3.0, Breeze TTS 2, Kugel 3, Chatterbox, Raon, Noiz.

**Implied head-to-head win rates** (Elo expectation, Spanish "All" board):

| Pair | Win rate |
|---|---|
| v4 vs v4 Turbo | 0.60 |
| v4 Turbo vs Sonic 3.6 | 0.52 |
| v4 Turbo vs Inworld TTS-2 | 0.63 |
| v4 Turbo vs Gemini 3.8 Flash TTS | 0.66 |
| v4 Turbo vs MiniMax 2.8 HD | 0.66 |
| v4 Turbo vs Flash v2.5 | 0.74 |
| **v4 Turbo vs Fish S2 Pro** | **0.77** |
| Entertainment: Sonic 3.6 vs v4 Turbo | 0.55 |
| Entertainment: v4 vs v4 Turbo | 0.64 |

Reading it for Magic Worlds:
- **ElevenLabs is the safest Spanish pick for cloned voices.** Four of the top six Spanish models are ElevenLabs. Even the 2023 Multilingual v2 (1102) beats Gemini 3.8 Flash TTS (1099), MiniMax 2.8 HD (1100) and Inworld TTS-2 Flash (1083) in Spanish. These are point estimates only: the 1099–1102 gaps are well inside the CIs, so treat those three as tied.
- **v4 Turbo pays a Spanish-specific quality penalty vs v4.** It is −69 Elo in Spanish but 0 in English. In Entertainment, v4 Turbo is not clearly ahead of Sonic 3.6 or Eleven v3.
- **Fish has no Spanish evidence for the models Magic Worlds uses.** The only rated Fish model, S2 Pro, sits at the anchor level. It loses to v4 Turbo about 77% of the time and to Sonic 3.6 about 76%. Drama 3 (the current Magic Worlds call model) and S2.1 Pro are unrated in Spanish. Fish's own vendor numbers are strong but older-baseline. Fish S2 tech report, Minimax Multilingual Testset, Spanish **[VEND]** ([arXiv 2603.08823](https://arxiv.org/html/2603.08823), v2 2026-03-11):

  | System | WER | SIM |
  |---|---|---|
  | Fish S2 | 0.910% | 0.776 |
  | MiniMax | 1.029% | 0.762 |
  | ElevenLabs (model unnamed, likely an older multilingual model) | 1.084% | 0.615 |

  CV3-Eval Spanish WER: S2 2.00 vs CosyVoice3 2.99–3.26. Intelligibility and similarity scores are not preference, and the AA board says listeners prefer ElevenLabs and Cartesia.
- **Inworld TTS-2 ranks lower in Spanish than in English.** It is 6th on the full English Controlled Voice board (1146, behind HeyGen Voice 1196, Qwen-Audio-3.1-TTS-Plus 1185, Eleven v4 Turbo / v4 1157 and Sonic 3.6 1151), or 4th among models that also have a Spanish rating. In Spanish it is 7th (1123). That is notable given that Inworld documents Spanish as Tier 1. (Fact-check corrected "4th".)
- **Context for the unrated Fish models (fact-check):** on the English Controlled Voice board, Fish Audio Drama 3 Preview is 1059 and Fish Audio S2.1 Pro (Oct 2026) is 1010, against 1157 for Eleven v4 Turbo. Inference: an English gap of about 100 Elo gives no reason to expect Drama 3 to close the Spanish gap.
- **Gemini 3.8 Flash-Lite TTS beats Flash TTS** in Spanish (1112 vs 1099), as in English.

---

## 6. Audio tags in Spanish and cross-lingual clone accent retention

| Model | Tag / direction syntax | Tags in Spanish text? | Cross-lingual clone (e.g. English reference speaking Spanish) |
|---|---|---|---|
| **Eleven v4 / v4 Turbo** | `[whispering]`, `[laughing]`, and the experimental `[strong X accent]` (the v3/v4 prompting guide says accent tags may be "less consistent across different voices"). Only v4 Turbo is listed with "Audio tags for fine-grained control" on the models page | **Undocumented.** All examples are English tags on English text. Tags are "not perfect yet" | **Drops the reference accent by design:** "Eleven v4 generates fluent, natural-sounding speech in the target language… a deliberate change… not a bug". A toggle is being explored, with no timeline. Docs suggest trying audio tags to guide accent, "results may vary" ([v4 page](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4); [v3 prompting](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)) |
| Eleven Multilingual v2 | None | n/a | **Keeps** "the speaker's unique characteristics and accent" across languages ([models](https://elevenlabs.io/docs/overview/models)) |
| **Fish S2.1-Pro / S2-Pro** | `[free-form natural-language cue]` ("15,000+ unique tags supported" per the [S2-Pro HF card](https://huggingface.co/fishaudio/s2-pro); the emotions doc itself only says "64+ emotional expressions and voice styles") | "Cues usually work best at the sentence start in these languages", with Spanish in the list. Tag language not stated; examples in English ([emotions](https://docs.fish.audio/developer-guide/core-features/emotions)) | Not documented. `[with strong accent]` exists as a cue |
| **Fish Drama 3** | Natural-language direction | **Explicitly any language:** "Write the direction in whatever language you think in; it doesn't have to match the language of the line", with Spanish examples ([Drama 3 post](https://fish.audio/blog/fish-audio-drama-3), 2026-10-13; the post says it speaks 83 languages but does not list them). Fact-check addition: Drama 3 also has **open weights** on HF (`fishaudio/drama-3`, created 2026-10-01; `drama-3-int4` 2026-10-14; Fish Audio Community License). The card's latency numbers use English Seed-TTS prompts only | Not documented |
| **Cartesia Sonic 3.6** | No tags needed (emotion inferred from context); SSML available | n/a | **Keeps the original accent.** A single-accent voice speaking another language "sounds like a non-native speaker". 3.6 IVCs "hang on to much more of the original speaker's accent". Up to 10 native accents can be added per IVC (Add Voice Accents), or a new voice ID can be made (Localize Voice). `accent` deliberately overrides. "`sonic-3.6` makes voices sound more native… a deliberate accent may sound lighter. For a deliberately non-native accent, use `sonic-3.5`" |
| **Inworld TTS-2** | `[steering in natural language]` | **"Steering instructions must be written in English, even when the input text is in another language"** ([steering](https://docs.inworld.ai/tts/capabilities/steering.md)) | **Drops the accent:** "best-effort attempt to speak the target language natively, without carrying over the accent… If you want the voice to keep its original accent, prompt for it explicitly". Fact-check: this wording is on the [multilingual page](https://docs.inworld.ai/tts/capabilities/multilingual.md), not the steering page. **Steering exists only on `inworld-tts-2`**; TTS-2 Flash ignores instruction tags, though non-verbal tags like `[laugh]` still work. Voice localization is available |
| **Gemini 3.8 Flash TTS** | `speech_metadata.style` plus inline `<laugh>`, `<short pause>` | **"If your transcript is in a non-English language, continue to use English inline tags for best results"** | Voice replication exists; cross-lingual behaviour undocumented |
| **MiniMax Speech 2.8** | Fixed `(laughs)`, `(sighs)`, `(breath)` … (2.8 only); emotion enum | Language-neutral tokens (inference) | Not documented |

**Product consequence.** Magic Worlds characters are identity-bearing cloned voices, e.g. a Mexican-accented character who sometimes speaks English, or an English-cloned voice used for a Spanish call.

| Vendor | Accent behaviour across languages |
|---|---|
| Eleven v4 / v4 Turbo | Normalizes the voice to a native-sounding target language (identity loss) |
| Inworld TTS-2 | The same, unless steered in English |
| Cartesia Sonic 3.6 | Keeps the accent; nativeness can be added per accent |
| Multilingual v2 | Keeps the accent, at lower overall quality (ES 1102) |

**Pick per character, not per product.**

---

## 7. Spanish-only comparison table (all components)

| Component | Option | Spanish metric | Value | Source (label, date) |
|---|---|---|---|---|
| **Turn detection** | LiveKit Turn Detector v1 | eot-bench-es FC@600 / lat@5% / AUC | 6.0% / 642 ms / 0.943 | eot-bench (**OPEN-VEND**, LiveKit's own model on LiveKit data; 2026-06→09) |
| | Deepgram Flux-multi (no hint) | same | 8.7% / 820 ms / 0.930 | eot-bench (**IND of Deepgram**, run by LiveKit) |
| | Soniox stt-rt-preview | same | 11.4% / 800 ms / 0.852 | eot-bench (IND of Soniox) |
| | LiveKit v1-mini | same | 12.2% / 926 ms / 0.885 | eot-bench (OPEN-VEND); AUC reproduced in issue #14 (**IND**, 2026-09-05) |
| | LiveKit v1.1 / v1.1-mini (unreleased mini) | FC@600 / lat@5% | 6.0% / 608 ms; 7.3% / 746 ms | eot-bench PR #20, unmerged (**OPEN-VEND**, 2026-10-18) |
| | Smart Turn v3.2 (fp32) | same | 17.3% / 980 ms / 0.776 | eot-bench (IND of Daily) |
| | Smart Turn v3.2 GPU / CPU | Own test set accuracy / FPR | 91.53% / 4.54% (GPU); 89.57% / 6.95% (CPU int8) | Smart Turn HF benchmarks (**VEND**, 2026-01-07) |
| | AssemblyAI universal-streaming-multilingual | eot-bench FC@600 / lat@5% / AUC | 18.3% / 1,031 ms / 0.856 | eot-bench (IND of AssemblyAI); U-3.6 Pro **not tested** |
| | VAD only (current-style) | FC@600 / lat@5% | 24.5% / 1,200 ms | eot-bench |
| **STT (batch, read speech)** | Azure 06-2026 / Scribe v2 / U-3-Pro / gpt-transcribe | OASR es avg WER | 2.25 / 2.32 / 2.49 / 2.74 | OASR (**IND**, 2026-10-19) |
| | whisper-large-v3 (current) | same | 3.35 | OASR (**IND**) |
| | Soniox async v5 | same | 3.37 | OASR (**IND**) |
| **STT (streaming)** | Gemini 3.5 Live / U-3.6 Pro / Scribe v2 / Soniox | FLEURS-es WER (CV-es) | 3.8 (4.0) / 4.1 (3.2) / 4.6 (5.8) / 5.0 (6.0) | AssemblyAI benchmarks (**VEND-RUN**, 2026-08/09) |
| | Deepgram Flux / Nova-3 | same | 7.8 (7.8) / 8.9 (8.4) | AssemblyAI (**VEND-RUN**) |
| | Nemotron 3.5 streaming | FLEURS-es | 4.11–4.87% by chunk | NVIDIA card (**VEND**, 2026-06-04) |
| | Voxtral Mini 4B RT | FLEURS-es | 3.31% @480 ms | Mistral card (**VEND**, 2026-02) |
| **STT code-switching** | Soniox / U-3.6 Pro / Scribe v2 RT / Nova-3 Multi | Miami 10 h real Spanglish WER | 21.93 / 24.28 / 27.09 / 29.91% | AssemblyAI (**VEND-RUN**) |
| | U-3.6 Pro / Soniox / Nova-3 Multi | Spliced read EN↔ES WER | 9.59 / 12.12 / 16.66% | AssemblyAI (**VEND-RUN**) |
| **TTS (cloned voice, ES)** | Eleven v4 | AA Spanish Controlled Elo | 1284 | AA (**IND**, retrieved 2026-10-20) |
| | Eleven v4 Turbo | same | 1215 | AA (**IND**) |
| | Cartesia Sonic 3.6 | same | 1203 (Entertainment 1189 > v4 Turbo 1155) | AA (**IND**) |
| | Inworld Realtime TTS-2 / TTS-2 Flash | same | 1123 / 1083 | AA (**IND**) |
| | Gemini 3.8 Flash TTS / Flash-Lite | same | 1099 / 1112 | AA (**IND**) |
| | MiniMax Speech 2.8 HD / Turbo | same | 1100 / 1074 | AA (**IND**) |
| | Fish S2 Pro | same | 1005 | AA (**IND**) |
| | Fish S2.1 Pro / Drama 3 | same | **Not rated in Spanish** | AA (**IND**) |
| | Fish S2 | MiniMax multilingual test es WER / SIM | 0.910% / 0.776 | Fish report (**VEND**, 2026-03) |
| **Locales** | Cartesia / Inworld | Bare `es` → | es-ES | Docs (**VEND**) |
| **Accent (cross-lingual)** | Eleven v4 / Inworld TTS-2 / Cartesia 3.6 / Multilingual v2 | Keeps reference accent? | No / No (unless steered) / Yes / Yes | Docs (**VEND**) |

---

## 8. Best practice, SOTA, emerging, pitfalls (Spanish-specific)

### (a) Established best practice
- **Evaluate per language. Never extrapolate English rankings.** §2.3 shows a real ranking flip (Soniox vs Flux) and a Spanish-specific degradation (Smart Turn).
- **Calibrate per-language thresholds.** LiveKit ships per-language `unlikely_threshold` maps. Smart Turn has no per-language threshold, so tune one per language on in-domain data.
- **Make sure the turn detector knows the language.** LiveKit falls back to English thresholds without STT language, and Flux takes `language_hint`.
- **Pin the STT language when the caller is monolingual.** Soniox: "single language strongly recommended" for restriction. Whisper's language ID is unreliable on short clips (r03).
- **Keep tags and steering in English** for providers that say so (Gemini, Inworld). Treat the others as unknown until tested.
- **Carry the full BCP-47 locale** (es-MX / es-419 / es-ES / es-US) to TTS and text normalization, and the primary subtag to STT.
- **Hallucination blocklist per language, with substring/suffix matching** (Whisper #928; r03 §7).

### (b) Current SOTA / leading options for Spanish
- **Turn detection:**
  - LiveKit v1 (hosted) leads.
  - Among STT-integrated detectors, Deepgram **Flux-multi** leads for Spanish EoT (but see its WER).
  - Self-hosted open: LiveKit **v1-mini** (LiveKit Model License) beats Smart Turn v3.2 (BSD-2) in Spanish.
  - Pending: LiveKit **v1.1-mini** reports 7.3% @600 ms in Spanish (eot-bench PR #20, unmerged, not yet installable). If released as reported, it would lead all STT-integrated and self-hosted options on Spanish false cut-offs.
- **Streaming STT accuracy (es):** Gemini 3.5 Live, Reson8, **AssemblyAI U-3.6 Pro**, GPT-4o-transcribe, Scribe v2, Speechmatics (all vendor-run).
- **Real Spanglish:** **Soniox** (21.9%), AssemblyAI U-3.6 Pro (24.3%), Reson8, and Meta Muse are close; no system is good.
- **Cloned-voice Spanish TTS:** **Eleven v4 > v4 Turbo ≈ Sonic 3.6 > Eleven v3**.

### (c) Emerging and experimental
- Inline language tags inside streamed TTS (Inworld `<lang>`, SSML-compatible).
- Per-voice accent sets on clones (Cartesia Add Voice Accents, up to 10). Accent toggles for cross-lingual clones are on ElevenLabs' roadmap with no date.
- Mid-stream language-hint reconfiguration (Flux `Configure`), and per-token language labels (Soniox) usable for language-aware routing to TTS and LLM.
- Direction written in the user's own language (Fish Drama 3).

### (d) Pitfalls and anti-patterns
- **Choosing Smart Turn int8 for a Spanish launch without measuring it.** It is the weakest Spanish build: 6.95% FPR on its own test set.
- **Reading AA's main TTS leaderboard as multilingual.** Provider-voice boards are English-only. Spanish exists only on Controlled Voice.
- **Assuming the vendor's flagship realtime model is equally good in Spanish.** v4 Turbo trails v4 by 69 Elo in Spanish only.
- **Sending bare `es` to Cartesia or Inworld for Latin American users.** You get Castilian.
- **Forcing a single STT language on genuinely bilingual callers.** Whisper-family models score 40–61% WER on code-switching sets.
- **Testing on read speech only.** The 2–5% FLEURS numbers vs 22–30% on Miami conversational Spanglish show how far read-speech results can be from real calls.
- **Assuming tags work in Spanish because they work in English** (ElevenLabs undocumented).
- **Trusting eot-bench for roleplay pauses.** It removes any turn with a pause > 5 s and is task-oriented.

---

## 9. Implications for Magic Worlds (prioritized)

Current pipeline facts used here:
- Client VAD with a fixed `silenceMsToEnd: 800` ms (`voiceVadProcessor.worklet.js:225`, audit `be-engine-turntaking.md`).
- Groq whisper-large-v3 batch per utterance with `language` = the call language's primary subtag.
- Per-call fixed language from `route_voice_call.py:576-592` via `normalize_language_code`.
- ElevenLabs `eleven_v4_turbo` (TTD multi-context) or Fish `drama-3` for TTS.

**P0: before or at Spanish launch**

1. **Assume a high Spanish false-cut-off rate with today's 800 ms silence rule, and fix turn-taking with Spanish data.**
   - In eot-bench-es, silence alone costs 24.5% false cut-offs at 600 ms and needs 1,000 ms for 10%.
   - **Inference (interpolation, not measured):** 800 ms in Spanish likely cuts off somewhere around 10–24% of turns with mid-turn pauses.
   - If you add a self-hosted acoustic turn model:
     - Prefer **LiveKit v1-mini** for Spanish (12.2% @600 ms, 926 ms @5%), provided its LiveKit Model License and the livekit-agents dependency are acceptable. Watch for **v1.1-mini**: LiveKit's unmerged eot-bench PR #20 reports 7.3% @600 ms and 746 ms @5% in Spanish, but it needs a `livekit-local-inference` release that was not out on 2026-10-20.
     - Otherwise use **Smart Turn v3.2 with the fp32 ("gpu") weights**, even on CPU, not the int8 build. Measure its CPU latency.
     - Calibrate a **Spanish-specific threshold**.
   - Even Smart Turn in Spanish beats the VAD baseline by about 220 ms at a 5% cut-off budget.
2. **If you move to streaming STT with built-in EoT, choose for Spanish explicitly. The English pick may flip.**
   - **Deepgram Flux-multi** has the best Spanish EoT of the STT-integrated options. But its Spanish WER is about 2× the leaders' (7.8% vs 4.1% FLEURS-es, competitor-run), so run an in-house Spanish WER check before committing.
   - **AssemblyAI U-3.6 Pro** is the Spanish accuracy pick (4.1 / 3.2). Its EoT was not tested in Spanish (only the older multilingual model was, at 18.3% @600 ms).
   - **Soniox** loses its English EoT edge in Spanish (11.4% @600 ms; only 75.8% of turn ends detected) but is the best on real Spanglish.
   - The two-vendor option "Flux for EoT plus a separate accurate Spanish STT" doubles cost and complexity. Prefer an in-house bake-off on es-MX, es-ES and Spanglish roleplay audio.
3. **Stop discarding the region.**
   - Keep the full locale (e.g. es-MX, es-419, es-ES, es-US) in the call runtime.
   - Pass `normalize_language_code` (primary subtag) only to STT.
   - Pass the full locale to TTS text normalization and to any provider that uses it (Cartesia `locale`, Inworld `language`, ElevenLabs `language_code`). On the ElevenLabs TTD multi-context WebSocket, `language_code` is declared in the schema but its effect is undocumented, so test what it does with v4 Turbo before relying on it.
   - Default Latin American users to `es-419` or `es-MX`, not bare `es`, because Cartesia and Inworld map `es` to Spain.
4. **Close the Whisper Spanish hallucination gaps** in `stt_groq_client.py`:
   - add `www.mooji.org` and `Más información www.alimmenta.com` (from #928);
   - strip known credit **suffixes and prefixes** from otherwise real transcripts;
   - log hallucination drops **per language**;
   - treat unverified outros ("Suscríbete al canal", "No olvides suscribirte") as low-confidence-only candidates.

**P1: quality of Spanish voices**

5. **Re-check the TTS model choice for Spanish calls.**
   - Spanish is the one place where `eleven_v4` beats `eleven_v4_turbo` by a measurable margin (about 60% preference).
   - Measure v4 latency on the TTD path. If it fits the budget for Spanish calls, A/B it against v4 Turbo.
   - **Fish Drama 3 and S2.1-Pro have no independent Spanish evidence.** The one Fish model on the Spanish board loses about 77% of the time to v4 Turbo.
   - Before routing Spanish calls to `drama-3`, run a blind Spanish A/B on Magic Worlds character clones (es-MX and es-ES raters), or default Spanish to ElevenLabs until data exists.
   - Cartesia Sonic 3.6 is a credible Spanish alternative: level with v4 Turbo overall and ahead in Entertainment, with CIs overlapping.
6. **Make cross-lingual accent a per-character setting.**
   - For characters whose accent is part of their identity, don't rely on Eleven v4 / v4 Turbo when the call language differs from the clone language: v4 deliberately neutralizes accent.
   - Options:
     - clone in the target language;
     - use Cartesia, which keeps the accent;
     - use Eleven Multilingual v2, which keeps the accent at lower quality;
     - use Inworld with English steering ("speak with a Mexican accent").
   - Surface "accent may change when speaking another language" in the voice UI.
7. **Spanish audio tags:**
   - Have the LLM emit **English** tag words inside Spanish replies for Eleven v4 Turbo. That is untested but consistent with Gemini and Inworld guidance.
   - For Fish Drama 3, either language is allowed.
   - Add a small Spanish tag-fidelity test (e.g. `[whispering]`, `[laughing]` in Spanish lines) to the voice eval.

**P2: bilingual callers and evaluation**

8. **Code-switching policy.**
   - Keep LLM replies in one language per turn (r05 language pinning).
   - For English names or terms inside Spanish speech, prefer TTS with documented mixing (Inworld `<lang>`, Soniox TTS). Otherwise accept accented loanwords. Cartesia says send one language per request.
   - For callers who switch languages mid-call, use an STT with `["es","en"]` hints rather than a forced `es`: Soniox, U-3.6 Pro, Flux-multi with `language_hint`, or Speechmatics `es` + `bilingual-en`.
9. **Build the Spanish eval set now.**
   - `livekit/eot-bench-data` `es` (400 turns, CC-BY-4.0 per HF card; clarify the license conflict with the README's Apache-2.0).
   - Plus consented in-house roleplay audio covering es-MX, es-ES, es-US and Spanglish, with long "thinking" pauses (> 5 s, which eot-bench excludes).
   - Report per language: FC@600, latency@5%, WER, entity/name accuracy, hallucination drops, and TTS preference.

---

## 10. Open questions

- Fish **Drama 3** and **S2.1-Pro** Spanish preference: not yet on AA's Spanish board. Re-check in a few weeks, or measure in-house. The Drama 3 open weights (HF, Oct 2026) make a self-hosted Spanish A/B possible.
- When LiveKit merges eot-bench PR #20 and ships **v1.1-mini** in `livekit-local-inference`, re-run the Spanish comparison. The pending numbers would reorder the self-hosted recommendation.
- **Eleven v4 (non-Turbo) latency** on the TTD WebSocket. Does its Spanish quality lead survive the latency budget?
- Flux-multi **with** `language_hint: ["es"]` or `["es","en"]` on eot-bench-es. The benchmark ran it on auto-detect.
- AssemblyAI **U-3.6 Pro** turn detection in Spanish (eot-bench only tested universal-streaming-multilingual), and Soniox **stt-rt-v5** endpointing (eot-bench used a preview alias).
- Whether ElevenLabs v4 Turbo honours English audio tags inside Spanish text, and whether `[strong Mexican accent]` keeps the accent on cross-lingual clones.
- Which Spanish variety AA's reference voices and raters represent (the selector shows 🇪🇸). LatAm preference may differ.
- The rate of Whisper-large-v3 hallucination and wrong-language output on Spanish (and forced-`es` English) non-speech in Magic Worlds' own traffic. I found no published Spanish-specific rate.

---

## Sources (all retrieved 2026-10-20 unless noted)

1. Artificial Analysis: Controlled Voice Arena leaderboard (Spanish data embedded in the page; Spanish entries released through 2026-09-28): https://artificialanalysis.ai/text-to-speech/leaderboard/controlled-voice
2. AA: Provider Voice leaderboard (English accents only; no `es` data): https://artificialanalysis.ai/text-to-speech/leaderboard/provider-voice
3. AA: TTS methodology (nine non-English languages in Controlled Voice; native raters): https://artificialanalysis.ai/methodology/text-to-speech (undated)
4. AA: STT methodology (AA-WER v2.2 since May 2026; English): https://artificialanalysis.ai/methodology/speech-to-text
5. livekit/eot-bench README and harness (initial commit 2026-06-09): https://github.com/livekit/eot-bench
6. eot-bench Spanish comparison report (es dir last commit 2026-09-14): https://github.com/livekit/eot-bench/blob/main/output/livekit__eot-bench-data__validation__min_silence_100ms/es/comparison/report.md
7. eot-bench cross-language report and summary: https://github.com/livekit/eot-bench/tree/main/output/livekit__eot-bench-data__validation__min_silence_100ms/language_comparison
8. eot-bench Spanish run manifests and `metrics/summary.json` (AUC): https://github.com/livekit/eot-bench/tree/main/output/livekit__eot-bench-data__validation__min_silence_100ms/es
9. livekit/eot-bench-data dataset card (created 2026-06-09, modified 2026-07-22; CC-BY-4.0): https://huggingface.co/datasets/livekit/eot-bench-data
10. eot-bench issue #14: v1-mini AUC per language, Romanian 0.565 (2026-09-05): https://github.com/livekit/eot-bench/issues/14
11. Smart Turn v3.x benchmark files (v3.0, v3.2 CPU/GPU; generated 2026-01-07): https://huggingface.co/pipecat-ai/smart-turn-v3/tree/main/benchmarks
12. Daily: Smart Turn v3 announcement (2025-09-11, **stale?**): https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/
13. Daily: Smart Turn v3.2 (2026-01-07): https://www.daily.co/blog/smart-turn-v3-2-handling-noisy-environments-and-short-responses/
14. pipecat-ai/smart-turn README (23 languages; GPU fp32 vs CPU int8): https://github.com/pipecat-ai/smart-turn
15. LiveKit turn detector docs (language thresholds from STT language): https://docs.livekit.io/agents/logic/turns/turn-detector.md
16. Deepgram Flux language prompting (`language_hint`, `Configure`): https://developers.deepgram.com/docs/flux/language-prompting
17. Deepgram Flux Multilingual press release (2026-04-29, updated 2026-10-12): https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release
18. Deepgram models and languages overview (`es`, `es-419`, `multi`): https://developers.deepgram.com/docs/models-languages-overview
19. AssemblyAI benchmarks (Tables 10–14; runs 2026-08-18 → 2026-09-23): https://www.assemblyai.com/benchmarks
20. Open ASR Leaderboard multilingual Spanish CSV (dataset modified 2026-10-19): https://huggingface.co/datasets/hf-audio/multilingual_evals/resolve/main/multilingual_es.csv ; space: https://huggingface.co/spaces/hf-audio/open_asr_leaderboard
21. Pipecat STT benchmark (English ground truth, 2026-01-03): https://github.com/pipecat-ai/stt-benchmark
22. Soniox benchmarks page (Aug 2026): https://soniox.com/benchmarks
23. Soniox docs: language restrictions, language identification, models (stt-rt-v5 2026-06-16), TTS language mixing: https://soniox.com/docs/stt/concepts/language-restrictions.mdx ; https://soniox.com/docs/stt/concepts/language-identification.mdx ; https://soniox.com/docs/stt/models.mdx ; https://soniox.com/docs/tts/concepts/language-mixing.mdx
24. Speechmatics languages (`bilingual-en` domain; Global Spanish): https://docs.speechmatics.com/speech-to-text/languages
25. ElevenLabs Eleven v4 capability page (cross-lingual accent; "Spanish (LatAm)"): https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
26. ElevenLabs models page: https://elevenlabs.io/docs/overview/models
27. ElevenLabs v3/v4 prompting guide (audio tags, accent tags): https://elevenlabs.io/docs/best-practices/prompting/eleven-v3
28. ElevenLabs STT capability page (Scribe v2 tiers): https://elevenlabs.io/docs/overview/capabilities/speech-to-text
29. ElevenLabs TTD multi-context WebSocket reference: https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket
30. Fish Audio models overview: https://docs.fish.audio/developer-guide/models-pricing/models-overview
31. Fish Audio emotions / cues: https://docs.fish.audio/developer-guide/core-features/emotions
32. Fish Audio S2-Pro model card (language tiers): https://huggingface.co/fishaudio/s2-pro
33. Fish Audio S2 technical report, arXiv 2603.08823 (v2 2026-03-11): https://arxiv.org/html/2603.08823
34. Fish Audio Drama 3 launch post (2026-10-13): https://fish.audio/blog/fish-audio-drama-3
35. Cartesia Sonic 3.6 model page (GA 2026-08-27): https://docs.cartesia.ai/build-with-cartesia/tts-models/latest
36. Cartesia 2026 changelog (IVC accent retention; 61 locales): https://docs.cartesia.ai/changelog/2026
37. Cartesia advanced capabilities (locale codes `es-ES*`, `es-MX`, `es-US`; Hinglish): https://docs.cartesia.ai/build-with-cartesia/capability-guides/advanced-capabilities
38. Cartesia multilingual voices (accent fallback; one language per request): https://docs.cartesia.ai/build-with-cartesia/capability-guides/multilingual-voices.md
39. Inworld TTS language support (tiers; es → es-ES; cross-lingual): https://docs.inworld.ai/tts/capabilities/multilingual.md
40. Inworld language tags: https://docs.inworld.ai/tts/capabilities/language-tags.md
41. Inworld steering (English-only instructions): https://docs.inworld.ai/tts/capabilities/steering.md
42. Inworld TTS models: https://docs.inworld.ai/tts/tts-models
43. Gemini API speech generation (updated 2026-10-12): https://ai.google.dev/gemini-api/docs/speech-generation
44. MiniMax T2A HTTP API reference (`language_boost`, interjection tags): https://platform.minimax.io/docs/api-reference/speech-t2a-http.md
45. openai/whisper discussion #928, "Dataset bias (Amara.org)" (2023-02-06, **stale?**): https://github.com/openai/whisper/discussions/928
46. NVIDIA Nemotron 3.5 ASR Streaming card (2026-06-04) and Mistral Voxtral Mini 4B Realtime card (2026-02), via r03: https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b ; https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602
47. Magic Worlds code (read 2026-10-20):
    - `magic-worlds-api/src/services/speech/types.py:129-139` (`normalize_language_code`)
    - `magic-worlds-api/src/services/voice_orchestration/stt_groq_client.py:220-299` (hallucination filter)
    - `magic-worlds-api/src/routes/user/route_voice_call.py:576-592` (call language)
    - Audit `docs/call_realtime/evidence/audit/be-engine-turntaking.md` (800 ms client silence)

---

## Fact-check log (2026-10-20)

**Method.** Every check below used direct fetches of primary pages: GitHub raw files and API, the HF API and cards, the AA page's embedded RSC payload re-parsed by script, vendor docs, and arXiv. The shared WebSearch budget was exhausted, so I did not run any web searches. Newer developments were found by reading the primary repos' open PRs, commit logs and model listings instead.

| # | Claim checked | Verdict | Source |
|---|---|---|---|
| 1 | AA Spanish Controlled Voice "All" board: Eleven v4 1284 (1262–1306), v4 Turbo 1215 (1194–1236), Sonic 3.6 1203, Eleven v3 1176, Inworld TTS-2 1123, Gemini 3.8 Flash-Lite 1112, MiniMax 2.8 HD 1100, Gemini 3.8 Flash 1099, Fish S2 Pro 1005, OpenAudio S1 = 1000 anchor; 32 models | **Confirmed**: every value and rank in §5.2 matches the re-parsed payload | https://artificialanalysis.ai/text-to-speech/leaderboard/controlled-voice |
| 2 | AA Spanish category Elo (Entertainment: v4 1253, Sonic 3.6 1189, v4 Turbo 1155; Assistants; Customer Service) | **Confirmed** | same |
| 3 | AA English Controlled Voice: v4 = v4 Turbo = 1157; "Inworld TTS-2 is 4th in English (1146)" | **Corrected**: the tie is right, but Inworld TTS-2 is **6th** on the full English board (HeyGen Voice 1196 and Qwen-Audio-3.1-TTS-Plus 1185 lead). It is 4th only among models that also have a Spanish rating | same |
| 4 | Fish S2.1 Pro and Drama 3 are not on the Spanish board | **Confirmed**. Added their English Elo: Drama 3 Preview 1059, S2.1 Pro 1010 | same |
| 5 | eot-bench Spanish table (FC@300/600, latency @5%/10%, detection) for all 11 entries | **Confirmed**: exact match with `es/comparison/report.md` and `language_comparison/report.md` | https://github.com/livekit/eot-bench/tree/main/output/livekit__eot-bench-data__validation__min_silence_100ms |
| 6 | eot-bench AUC ES (EN): Flux 0.930 (0.941), Smart Turn 0.776 (0.845), v1-mini 0.885 (0.890), Soniox 0.852 (0.906); 400 turns / 1,236 spans; Flux `eot_threshold` 0.7 with no language hint | **Confirmed** from `metrics/summary.json` and the manifests | same |
| 7 | "Flux beats Soniox on both [metrics] in Spanish" | **Corrected**: Flux wins FC@600 and lat@10%, but Soniox is marginally faster at lat@5% (800 vs 820 ms) | same |
| 8 | The Soniox eot-bench run used `stt-rt-preview`; `stt-rt-v5` was released 2026-06-16 | **Confirmed, with a clarification**: the run was committed 2026-06-09, before v5 GA, and the alias is no longer on Soniox's models page. What the alias then pointed to is unverified | https://soniox.com/docs/stt/models.mdx ; eot-bench commit history |
| 9 | eot-bench-data is CC-BY-4.0 on HF but the GitHub repo is Apache-2.0 | **Confirmed**: the HF tag is `license:cc-by-4.0`, and the GitHub API reports Apache-2.0 | https://huggingface.co/datasets/livekit/eot-bench-data ; https://github.com/livekit/eot-bench |
| 10 | eot-bench issue #14: v1-mini AUC es/fr/de 0.885/0.887/0.874, Romanian 0.565 (2026-09-05) | **Confirmed** | https://github.com/livekit/eot-bench/issues/14 |
| 11 | Smart Turn v3.2: Spanish 91.53 / 4.54 / 3.93 (GPU fp32), 89.57 / 6.95 / 3.48 (CPU int8); English 94.71 / 2.98 and 94.26 / 3.75; Spanish 18th of 23; v3.0 84.46 / 7.29 / 8.24; files generated 2026-01-07 | **Confirmed**. No Smart Turn newer than v3.2 exists. Also fixed a cross-build comparison in §2.4 | https://huggingface.co/pipecat-ai/smart-turn-v3/tree/main/benchmarks ; https://github.com/pipecat-ai/smart-turn |
| 12 | AssemblyAI realtime FLEURS-es (Gemini 3.5 Live 3.8, U-3.6 Pro 4.1, GPT-4o-transcribe 4.3, Scribe v2 4.6, Soniox 5.0, Flux 7.8, Nova-3 8.9, Ink-Whisper 9.0) and CV-es (Speechmatics 2.5, U-3.6 Pro 3.2, Flux 7.8, Nova-3 8.4); runs 2026-08-25 → 09-23; "default settings, language fixed" | **Confirmed** (Tables 10–13) | https://www.assemblyai.com/benchmarks |
| 13 | AssemblyAI Table 14 code-switching: Miami 10 h Soniox 21.93%, Muse 23.10%, U-3.6 Pro 24.28%, Nova-3 Multi 29.91%, GPT-4o-transcribe 61.27%; EN↔ES U-3.6 Pro 9.59%; Flux Multi not run; batch en-es long U-3.5 Pro 5.93 / Scribe v2 5.47 / Soniox 8.5 / Nova-3 10.1 | **Confirmed** | same |
| 14 | Open ASR Leaderboard `es`: Azure 06-2026 2.25, Scribe v2 2.32, U-3-Pro 2.49, whisper-large-v3 3.35 (rank 17), Soniox async v5 3.37, Voxtral RT rank 30, Nemotron rank 34, "41 rows" | **Corrected**: the WER values are right, but there are 40 models (41 lines including the header). Voxtral RT is rank 29 and Nemotron rank 33. The notes also missed azure-speech-07-2026 (2.30, rank 2) and reson8/resonant-1 (2.66, rank 6) | https://huggingface.co/datasets/hf-audio/multilingual_evals/resolve/main/multilingual_es.csv |
| 15 | AA STT (AA-WER v2.2, since May 2026) is English-only | **Confirmed** | https://artificialanalysis.ai/methodology/speech-to-text |
| 16 | Cartesia: bare `es` → `es-ES*`; `es-MX` and `es-US`; `locale` for Sonic ≥ 3.6; 44 languages / 61 locales; GA 2026-08-27; up to 10 accents per IVC; mixing only for Hinglish/Taglish | **Confirmed**. No Sonic newer than 3.6 is listed | https://docs.cartesia.ai/build-with-cartesia/capability-guides/advanced-capabilities ; https://docs.cartesia.ai/changelog/2026 ; https://docs.cartesia.ai/build-with-cartesia/capability-guides/multilingual-voices.md |
| 17 | Inworld: `es` → `es-ES`, 21 Spanish codes, `es-US` → `es-ES`, Tier 1; steering "must be written in English"; cross-lingual accent dropped unless prompted | **Confirmed, with a citation fix**: the accent quote is on the multilingual page, not the steering page. Added that steering exists only on `inworld-tts-2`, not Flash | https://docs.inworld.ai/tts/capabilities/multilingual.md ; https://docs.inworld.ai/tts/capabilities/steering.md ; https://docs.inworld.ai/tts/tts-models |
| 18 | Eleven v4 drops the cross-lingual accent as "a deliberate change … not a bug", with a toggle being explored; v4 page labels Spanish "Spanish (LatAm)"; models page lists audio tags only for v4 Turbo; Multilingual v2 keeps the accent and lists "Spanish (Spain, Mexico)" | **Confirmed**. The models page gives v4 Turbo about 100 ms median inference latency and no latency figure for v4, and points low-latency use to v4 Turbo | https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4 ; https://elevenlabs.io/docs/overview/models |
| 19 | "`language_code` on the ElevenLabs TTD WebSocket is undocumented" | **Corrected**: the TTD multi-context WebSocket schema declares `language_code` (string query parameter) but does not describe it. Its effect is undocumented; the parameter itself is not | https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-multi-websocket |
| 20 | Gemini 3.8 Flash / Flash-Lite TTS: use English inline tags for non-English transcripts; input language auto-detected; no permanent accent changes in `speech_metadata.style`; page updated 2026-10-12 | **Confirmed** | https://ai.google.dev/gemini-api/docs/speech-generation |
| 21 | Deepgram Flux `flux-general-multi`: repeatable `language_hint`, mid-stream `Configure`, an empty array reverts to auto-detect, locale subtags fall back to the base code, "mid-sentence language switches natively"; the press release (2026-04-29, updated 2026-10-12) gives no WER | **Confirmed**. Flux-multi and Nova-3 `multi` both cover 10 languages, Spanish included; Nova-3 Spanish codes are `es` and `es-419` | https://developers.deepgram.com/docs/flux/language-prompting ; https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release ; https://developers.deepgram.com/docs/models-languages-overview |
| 22 | AssemblyAI U-3.6 Pro RT: native code-switching across 32 languages | **Confirmed**. Added that `universal-streaming-multilingual`, the model eot-bench tested, covers 6 languages and switches only per turn | https://www.assemblyai.com/docs/streaming/multilingual-transcription |
| 23 | Soniox restriction quotes: "best-effort", "single language strongly recommended", "multiple languages reduce robustness"; Soniox TTS "Don't pick `language` based on a few embedded words" | **Confirmed** verbatim | https://soniox.com/docs/stt/concepts/language-restrictions.mdx ; https://soniox.com/docs/tts/concepts/language-mixing.mdx |
| 24 | Scribe v2 RT has "Smart language detection" | **Corrected**: the capability page lists this only for batch Scribe v2. Scribe v2 is in the "Excellent (≤ 5% WER)" tier for Spanish | https://elevenlabs.io/docs/overview/capabilities/speech-to-text |
| 25 | Speechmatics `{"language":"es","domain":"bilingual-en"}`; Global Spanish covers ES/US/MX/CO/AR/VE/CL/PE; realtime availability not stated | **Confirmed** | https://docs.speechmatics.com/speech-to-text/languages |
| 26 | LiveKit turn detector takes per-language `unlikely_threshold` from the STT-reported language and "defaults to English thresholds" without STT; 14 languages; code-switching not documented | **Confirmed** | https://docs.livekit.io/agents/logic/turns/turn-detector.md |
| 27 | Fish S2 tech report (arXiv 2603.08823, v2 2026-03-11): MiniMax multilingual test Spanish WER/SIM S2 0.910/0.776, MiniMax 1.029/0.762, ElevenLabs 1.084/0.615 (model unnamed); CV3-Eval es S2 2.00 vs CosyVoice3 2.99–3.26 | **Confirmed** | https://arxiv.org/abs/2603.08823 |
| 28 | Fish: S2-Pro language tiers (Spanish Tier 2), 15,000+ tags; Drama 3 post 2026-10-13 with any-language direction; cues best at sentence start (Spanish listed) | **Confirmed, with a citation fix**: "15,000+" comes from the S2-Pro HF card, not the emotions doc. **Added**: Drama 3 has open weights on HF (`fishaudio/drama-3` 2026-10-01; int4 2026-10-14; Fish Audio Community License) and speaks 83 languages per the launch post | https://huggingface.co/fishaudio/s2-pro ; https://fish.audio/blog/fish-audio-drama-3 ; https://huggingface.co/fishaudio/drama-3 ; https://docs.fish.audio/developer-guide/core-features/emotions |
| 29 | Nemotron 3.5 streaming FLEURS-es 4.87 @80 ms / 4.39 @320 ms / 4.11 @1.12 s (2026-06-04); Voxtral Mini 4B RT 5.34 @160 / 3.31 @480 / 2.98 @960 ms | **Confirmed**. Added that Nemotron lists `es-US` and `es-ES` locales | https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b ; https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602 |
| 30 | Whisper discussion #928 (2023-02-06): the Spanish Amara.org variants, "Más información www.alimmenta.com", "www.mooji.org"; mitigations | **Confirmed**. The thread also lists "Subtítulos hechos por / Subtitulos por la comunidad de Amara.org", which the existing `amara org` substring rule already covers | https://github.com/openai/whisper/discussions/928 |
| 31 | NEW: development the notes missed | **Added**: eot-bench PR #20 (LiveKit, 2026-10-18, unmerged) reports Turn Detector **v1.1** (ES 6.0% @600, 608 ms @5%) and **v1.1-mini** (ES 7.3% @600, 746 ms @5%, versus 12.2% / 926 ms for v1-mini). v1.1-mini is not yet installable. Also added PRs #17 (p99lab, English-only), #18 (haan), #19 (DuplexJev, ES 13.6% @600) and #21 (GPT-Live, English only) | https://github.com/livekit/eot-bench/pulls |

**Not re-checked (left as stated):**
- The exact AA Spanish release date "2026-09-28". The payload only says "Sept 2026".
- The ≈5,326 s scored-audio total.
- The Magic Worlds code line references (`types.py`, `stt_groq_client.py`, `route_voice_call.py`). Those are local code, outside this fact-check's web scope.
