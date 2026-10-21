# Gap audit: turn overlap, echo, post-interruption history and billing in real calls

Audit date: 2026-10-20. Gap id prefix: `GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-`.
Repos are read-only and no source file was modified. Paths are in
`/home/andres/PycharmProjects/magic-worlds-api` (BFF) unless marked **FE**
(`/home/andres/WebstormProjects/magic-worlds`).

Labels: **FACT** means seen in code at the cited line. **REPORTED** means a number or timestamp handed to
this step by the forensics step that this audit could not re-verify. **INFERENCE** means reasoning from FACT
and REPORTED. **UNKNOWN** means it needs data this audit could not read.

---

## 0. TL;DR

1. **The real rows could not be read.** The permission classifier denied the read-only DB connection as a
   "Production Read". It also denied reading the forensics step's dumps of the same rows. Per the session's
   safety rules this audit did not work around that. So no transcript was compared, no similarity score was
   computed, no frozen history was dumped, and no overlap was classified from data. Section 9 has a
   ready-to-run read-only script that does all of this and prints scores and structure only, never text:
   `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/9c4c3da7-06b7-4cee-a58b-d2b1e4f9477c/scratchpad/gap-overlap/overlap_forensics.py`.
   Its scoring was self-tested offline on synthetic strings. It needs the user's approval to run.
2. **The code decides how far the real data can go.** The REPORTED pattern "assistant segments are
   `status=completed` with full-length audio" carries no information. The assistant segment's status is
   hard-coded to `completed` (`engine.py:3526`). Its `duration_ms` is the **delivered** MP3, not the
   played one (`engine.py:3515-3519`, `:4047`). The row is written only **after** `voice_turn_end` and the
   asset write (`engine.py:2700-2745`, `:3520-3537`). The user segment of a superseded turn also ends
   `completed` whenever the LLM had already finished (`engine.py:2654`, `:2747-2749`). Cancel reason,
   barge-in, `played_ms` at cancel, "truncation skipped", the `voice_turn_end` time, the client speech
   onset and the AEC state are **not persisted**. They exist only as log lines or not at all. (-01)
3. **What the reported ordering does show (INFERENCE).** In the reported pairs, user segment N+1 was
   received before the assistant row of turn N was written (by 1 to 6 s). By the timestamp semantics in
   section 2, this means turn N had **not finished** (its TTS was still draining, or its bookkeeping was still
   running after `voice_turn_end`) when segment N+1 arrived. A barge-in frame sent at speech onset would
   normally have ended turn N before the user finished speaking and uploaded. So for these pairs a
   **barge-in frame most likely did not fire**, and the overlap was handled by the **superseding-segment**
   path. Whether turn N was then cut depended on a **race between N+1's STT completion and N's
   `voice_turn_end`** (-03):
   - N+1 finishes STT first: cancel plus a cut at the last playback report (signature S1b).
   - N publishes `voice_turn_end` first: no cancel and no cut. This is mechanism (b),
     BE-ENGINE-TURNTAKING-01 (signature S3b).
   Self-echo (c) can sit under either branch. Only the text-similarity score can tell (section 8).
4. **Billing exceeds what could have been heard (FACT mechanism, REPORTED magnitude).**
   - TTS is billed on **delivered** audio (`engine.py:2494-2508`, `:2345-2362`), and the client drops the
     unplayed tail of a turn when the next turn starts (FE `voicePlaybackBuffer.ts:155-163`, `:573-600`).
   - STT is billed on the full uploaded file. That includes 300 ms of pre-roll and 550 ms of trailing
     silence (`stt_groq_client.py:355-404`; FE `voiceVadWorklet.ts:20`, `CallScreen.tsx:114`). It also
     includes segments later rejected as no-speech (`engine.py:2243-2252`) and any echo segments.
   - For the REPORTED 9ff8d8 (wall time about 70 s, `consumed_seconds=89`, about 80 s of it assistant audio),
     at least **10 s** of billed TTS could never have been played. Realistically 13 s or more, once the
     first-audio offset is counted (section 6). (-02)
5. **History after an interruption (FACT).** The model never sees an interruption marker. Nothing-heard
   replies keep their full text (BE-LLM-12). A mid-stream cancel with nothing heard leaves an
   `interrupted`, empty row, which the history drops, so the model sees **consecutive user messages**.
   An echo transcript enters as a real user turn. (-05)

---

## 1. Evidence status and data access

| Item | Status |
|---|---|
| Direct read-only MySQL connection, using BFF `.env` credentials, `SET SESSION TRANSACTION READ ONLY` | **Denied** by the auto-mode classifier ("Production Reads"). Not retried by other means. |
| Reading the forensics step's dumps in the session scratchpad (`forensics/*.jsonl`) | **Denied** by the classifier with the same reason. Before the block, only the field names of those files and one unrelated session row in the first ~1.5 KB of `sessions.jsonl` were seen. Nothing from them is used here. |
| Calls bcf13a, 9ff8d8 and 890eb3: timestamps, `consumed_seconds`, wall time | **REPORTED** by the task text. Not verified. |
| Similarity scores per overlapping turn | **UNKNOWN**. The script computes them (section 9). |
| `adventure_message` status, length and truncation compared with segment `transcript_text` | **UNKNOWN**. Script and SQL in section 9 and Appendix A. |
| Frozen `tb_llm_execution_plan.frozen_payload.messages` structure | **UNKNOWN**. Script and SQL in section 9 and Appendix A. |
| Code semantics of every field used | **FACT** (sections 2 to 7) |

---

## 2. What each stored field and timestamp means (FACT)

| Column | Written by | Meaning | Evidence |
|---|---|---|---|
| user `voice_transcript_segment.created_at` | `create_segment(status="received")` at the start of intake, after the HTTP body is read | When upload N+1 reached the engine. That is roughly the user's speech end + 550 ms hangover + upload time. | `engine.py:2124-2138`; `models.py:7573-7580` |
| user segment `completed_at` | first terminal update: `status="completed", transcript_text=…` right after STT | **STT done.** `COALESCE` keeps the first value, so later updates do not move it. | `engine.py:2274-2281`; `models.py:7817-7821` |
| user segment final `status` | `update_segment` at the turn end | `completed` whenever the **turn's** `status` is completed. That includes a turn superseded or barged-in **after** the LLM finished, because `status = completion.status` (`completed`). Becomes `cancelled` only for an interrupted or empty mid-stream turn, or a turn cancelled before publish. | `engine.py:2654`, `:2747-2755`, `:2286-2290` |
| user segment `stt_summary` | STT result summary | `duration_ms` (Groq `duration`, the billed STT time), `latency_ms`, `no_speech_prob`, `avg_logprob`, `compression_ratio`, `no_speech_reason` | `stt_groq_client.py:200-213`, `:355-404` |
| user segment `vad_summary` | client VAD keys (allow-list), replaced by the server summary on accept | No playback-overlap, AEC or onset field. `started_at_ms` from the client is validated but **never stored**. | `engine.py:3860-3862`, `:2205`, `:136`, `:151`; `server_vad.py:98-111` |
| assistant `voice_transcript_segment` (whole row) | `_persist_assistant_call_turn` → `create_segment(role="assistant", status="completed")` | Written **once**, after `speaker.finish()` (TTS drained), `voice_audio_final`, `voice_turn_end` (with a settle wait of up to 3 s) and the asset write. **Status is always `completed`.** | `engine.py:2635-2637`, `:2682-2745`, `:3520-3537` |
| assistant segment `duration_ms` | asset MP3 frame duration | Audio **delivered** to the client for the turn, not played | `engine.py:3515-3519`, `:4047`, `:2494-2497` |
| assistant segment `transcript_text` | `truncation[1]` if a cut was settled before the persist, else `collected_text` | Kept prefix when the cut was decided before the asset write. Full text otherwise, including **post-end barge-in cuts that land after the persist**, which never update the segment. | `engine.py:2721-2726`; `call_turn_truncation.py:166-169`; `engine.py:480-486` |
| `adventure_message` assistant `created_at` | admission insert (`'streaming'`, `''`), inside a transaction that ran `SET time_zone='+00:00'` | turn start (admission) | `conversation_turn_store.py:370-373`; `llm_execution_admission.py:488` |
| `adventure_message` assistant `completed_at` | `finish` (`UTC_TIMESTAMP()`) | LLM finished (or interrupted) | `conversation_turn_store.py:671-673` |
| `adventure_message.metadata.voice.truncated/played_ms`, `content` | `truncate_call_turn` (PD-1) or `complete_interrupted_call_turn` (mid-stream) | Present only when a cut was **applied**. A skipped cut (nothing or everything heard) leaves **no DB trace**. | `call_turn_truncation.py:157-169`; `engine.py:1549-1564` |
| `voice_session.metadata.billing` | `_persist_billing_metadata` on every billed delta | `stt_audio_ms`, `tts_audio_ms`, `billable_audio_ms` (= stt + tts), `billable_audio_seconds` = ceil(total/1000), `billed_credits` = ceil(total/10 000) | `engine.py:204-229`, `:3393-3421`, `:3441-3455` |
| `voice_session.consumed_seconds` | `end_call` → quota release | `min(billable_audio_seconds, reserved_seconds)` on the live path. **Wall-clock elapsed** on the sweeper and no-billing-state paths. | `engine.py:1135-1148`, `:1158-1165`, `:3830-3837`; `quota.py:401-404`, `:568-574`, `:619-622` |
| `tb_llm_execution_plan.frozen_payload` | admission | `{"agt": graph, "messages": history + new user}`. `execution_id` equals the voice `turn_id` and `adventure_message.turn_id`. | `llm_execution_admission.py:565-571`; `conversation_execution.py:166-171`; `conversation_turn_store.py:376-377` |
| DATETIME precision | schema | `datetime` (no fractional seconds), so 1 s resolution | `db.sql` (`create table voice_transcript_segment`, `adventure_message`) |

---

## 3. Turn lifecycle: where each row is written (FACT)

```
user speaks ── 550 ms hangover ── upload ──► [seg N+1 created_at] ─ STT (latency_ms) ─► [seg N+1 completed_at]
                                                                          │ claim current_turn (engine.py:2066-2067)
                                                                          ▼
   prev turn N:  not finished?  ──yes──► end_published?
                                   │          ├─ no  → _supersede_heard_prefix (cut decided at latest voice_playback,
                                   │          │        else delivered_ms) + _cancel_turn("superseded")    [S1b / S4]
                                   │          └─ yes → both no-ops (engine.py:1426-1434, 1958-1960)       [S3 = (b)]
                                   │       then await previous.finished (engine.py:2074)  ◄── N+1 waits here
                                   └─no──► nothing to do
   N+1: _await_pending_truncation (≤3 s, engine.py:2322) → admission (user msg + assistant placeholder) → LLM …

   turn N, after its LLM:  speaker.finish() (TTS drained; flush-ahead lets ≤3 sentences / <8 s run ahead of playback)
        → bill final → voice_audio_final → end_published=True → _settled_truncation (≤3 s)
        → voice_turn_end → last_turn=N → persist asset → [assistant seg N created_at] → update user seg N
        → accept_segment finally: finished.set()  (engine.py:2105-2110)
```

The client keeps playing turn N until the next `voice_turn_start` arrives. `startTurn` then calls
`cancelActiveTurn`, which drops N's queued audio (FE `useVoiceCallController.ts:785-800`,
`voicePlaybackBuffer.ts:155-163`, `:573-600`). A `voice_cancelled` stops N earlier, but it is sent only by
the pre-end paths (`engine.py:1965-1972`).

---

## 4. The three mechanisms: code paths and DB signatures

| Mechanism | Trigger (FACT) | Turn N in DB | Ordering of seg N+1 vs assistant seg N | Script signature |
|---|---|---|---|---|
| (a) barge-in with truncation, pre-end | client `voice_barge_in{turn_id, played_ms}` at VAD speech_start, only when AEC is on, not raw fallback, playback audible, and more than 3 s after the call's first playback (FE `useVoiceCallController.ts:676-687`, `:907-918`); server `_truncating_barge_in` (`engine.py:1367-1412`) | `voice.truncated=true`, `played_ms` set, `content` = kept text; segment transcript = kept text | Usually assistant seg N **before** seg N+1, because N ends at speech onset and the upload arrives after the user stops | `S1a_cut_by_barge_in_frame` |
| (a') barge-in after `voice_turn_end` (window open) | same frame, target `last_turn` (`engine.py:1354-1365`, `:1337-1352`) | message cut; **segment and asset transcript stay full** (persisted earlier) | assistant seg N before seg N+1 | `S2_post_end_barge_in_cut` |
| (a'') barge-in while the LLM still streams | `_decide_mid_stream_keep` (`engine.py:1447-1473`) | heard prefix stored `completed` + truncated, or **`interrupted`, ''** when nothing was heard | as (a) | `S1a` or `S4_mid_stream_cancel_nothing_kept` |
| supersede before end (no frame) | N+1 STT done while N is not `end_published` (`engine.py:2069-2074`, `:1414-1445`) | cut at the latest report or delivered audio, unless the cut keeps all or nothing (`call_turn_truncation.py:62-68`) | **seg N+1 before assistant seg N** (N wraps up after the cancel, plus ≤3 s settle) | `S1b_cut_by_superseding_segment` (cut applied) or `S3b_…` (cut skipped) |
| (b) supersede after `voice_turn_end` | N+1 STT done after N's `voice_turn_end`: no cancel and no cut (`engine.py:1426-1434`, `:1958-1960`); client cuts N at N+1's `voice_turn_start` | full text, `truncated` absent; audio fully billed | seg N+1 **after** assistant seg N, **or before** it when N+1 arrived before N's end but its STT finished after (race window ≈ STT latency + N's post-end bookkeeping) | `S3a_overlap_no_cut_after_turn_end` / `S3b_overlap_no_cut_prev_still_running` |
| (c) self-echo | character audio captured as a segment (FE-CAPTURE-01). The upload is unconditional (FE `useVoiceCallController.ts:920-935`) and the BFF has no echo filter. | handled as a supersede (pre- or post-end) | either | any S1b/S3 with `echo ∈ {likely_echo, possible_echo}` |
| N+1 rejected (validation or no_speech) | never supersedes (`engine.py:2062-2064`) | N completes normally | seg N+1 may be before N | `pair` with `next_status=rejected` |

Two decision rules follow from the code. The script applies both.

- `order_gap = assistant_seg_N.created_at − seg_N+1.created_at > 0` means N was still running when N+1
  arrived. If this holds for most pairs, **barge-in frames were not ending replies at speech onset**. That
  happens when AEC is off, on the raw fallback, in the 3 s warm-up, when playback was not "audible" at
  onset, or with echo.
- A missing `truncated` flag does **not** prove (b), because a skipped cut leaves no trace (-01). Only the
  `voice_turn_truncation_skipped` / `voice_barge_in` / `voice_segment_cancelled` log lines
  (`engine.py:1557-1563`, `:1399-1411`, `:2289`; `observability.py:164-175`) can settle it, if logs from that
  window are retained (UNKNOWN).

---

## 5. Reading the REPORTED examples through the code (INFERENCE)

| Call | REPORTED | Code-based reading |
|---|---|---|
| bcf13a | user seq2 at 21:40:00, assistant seq1 at 21:40:06 | seq1 was still running 6 s after seq2 arrived. A pre-end supersede would have ended seq1 within about STT + ≤3 s settle + persist (~1-4.5 s). A gap of 6 s fits better with: (i) seq2 **rejected**, so no supersede and seq1 drained normally (a 4+ sentence reply paced by flush-ahead); or (ii) a supersede with slow STT or a slow truncation write. seq1 is the call's **first** reply, inside the 3 s AEC warm-up where auto barge-in is disabled (FE `useVoiceCallController.ts:684-685`, `:705`), so any talk-over or echo there takes the supersede path. |
| 9ff8d8 | user seq4 21:53:51, assistant seq3 21:53:52; ~70 s wall, `consumed_seconds=89` | A 1 s inverted gap is the signature of the **(b) race**: seq4 arrived just before seq3's `voice_turn_end`, and its STT finished after it, so there was no cancel and no cut. It is equally consistent with a pre-end supersede whose cut applied quickly, at the 1 s timestamp resolution. Billing: section 6. |
| 890eb3 (EL) | user seq3 22:23:20, assistant seq2 22:23:21 | Same as 9ff8d8. On the EL lane, generation is faster than playback, so `voice_turn_end` normally comes early: within about 1-3 s for replies of 3 sentences or fewer, all flushed at once (`call_tts_elevenlabs.py:15-20`, `:55-57`, `:160-167`). So (b) is the expected outcome for any talk-over that arrives as a segment after that point. |

A pure (b) after a clean `voice_turn_end` would show the **normal** order (assistant N before user N+1). The
fact that the inverted order is REPORTED as typical means the overlap often starts **while N is still
generating or draining**. This is consistent with talk-over or echo early in the reply, not with a user who
waits for the reply to finish.

---

## 6. Billing reconstruction

### 6.1 Formulas (FACT)

- `stt_audio_ms += transcript.duration_ms` for every segment that reached STT, **including** segments then
  rejected as `no_speech` (`engine.py:2243-2252`). `duration_ms` is Groq's `duration` of the uploaded WAV
  (`stt_groq_client.py:355-357`, `:404`). That WAV holds 300 ms pre-roll (FE `voiceVadWorklet.ts:20`;
  `voiceVadProcessor.worklet.js:44`) plus the 550 ms end silence (FE `CallScreen.tsx:114`).
- `tts_audio_ms += whole-MP3-frame duration` of every chunk the engine **delivered**, or accepted while the
  socket was away (`engine.py:2486-2497`). It is billed at each sentence start or every 2 s of audio
  (`VOICE_EL_BILLING_INTERVAL_MS`, `engine.py:117`, `:2507-2508`) and again at the turn end and in the
  `finally` (`engine.py:2648-2650`, `:2793-2796`). After a cancel, chunks are refused (`engine.py:2445-2446`,
  `:2488-2489`). Audio already delivered and buffered at the client stays billed.
- `billable_audio_seconds = ceil((stt+tts)/1000)`, `billed_credits = ceil((stt+tts)/10 000)`
  (`VOICE_CALL_SECONDS_PER_CREDIT = 10`, `engine.py:81`, `:3398-3401`).
- The call ends with `quota` when `billable_audio_seconds >= reserved_seconds` (`engine.py:1855-1860`).
  `reserved_seconds = min(max_call_seconds, remaining_daily)` (`quota.py:268`). So **audio seconds are
  measured against a budget the UI presents as call time**.

### 6.2 Sources of "billed > heard or said" (FACT mechanism)

| Source | Where | Typical size |
|---|---|---|
| TTS delivered but cut at the client (barge-in or supersede: buffered flush-ahead audio, up to 3 sentences or about 8 s ahead) | `engine.py:2494-2508`; `call_tts_elevenlabs.py:55-57` | 0-8 s per interrupted turn |
| (b): tail of N dropped at N+1's `voice_turn_start` | FE `voicePlaybackBuffer.ts:155-163`, `:573-600` | rest of N after (user stop + STT + admission) |
| hang-up mid-reply | `end_call` cancels, and delivered audio stays billed (`engine.py:1129-1135`) | rest of the last reply |
| STT padding: pre-roll + hangover per segment | see above | ~0.85 s per segment |
| `no_speech` segments | `engine.py:2243-2252` | full segment |
| echo segments: the character's own audio billed again as STT | FE-CAPTURE-01 path | full echo duration |
| talk-over itself (user speaking while N plays) | both legs billed for the same wall time | overlap duration |

### 6.3 The REPORTED 9ff8d8 numbers (INFERENCE)

- wall ≈ 70 s, `consumed_seconds = 89`. So stt + tts exceeds wall time by about 19 s. That 19 s is the sum
  of overlap time, unplayed TTS, STT padding, no-speech STT and echo STT. None of these is "audio the user
  heard or said".
- With the REPORTED split (assistant ≈ 80 s): the client plays one turn at a time (`startTurn` cancels the
  active turn). So played TTS ≤ wall − (time before the first audio). The first audio needs at least one
  user segment, STT, LLM and the first TTS chunk, about 3 s or more. That gives **unplayed billed TTS
  ≥ 80 − (70 − 3) ≈ 13 s (≥ 16 % of TTS)**. User speech time not overlapped by playback only raises the
  bound.
- Credits: 89 s gives `ceil(8.9) = 9` credits. Billing on wall time would give 7. Billing on heard plus said
  audio would give fewer still.
- The script prints `unplayed_tts_lower_bound_s` per call, and `unplayed_ms_if_truncated` (`asset_ms −
  played_ms`) per cut turn.

---

## 7. What history the LLM receives after an interruption (FACT)

`build_conversation_messages` (`conversation_execution.py:56-86`) keeps only `status='completed'` rows with
non-empty content, renders `content` only (spoken projection for a call), and appends the new user text. The
payload is frozen into `tb_llm_execution_plan.frozen_payload.messages` at admission
(`conversation_execution.py:166-171`; `llm_execution_admission.py:565-571`). The read happens under
`SELECT … ORDER BY sequence_no DESC LIMIT 100 FOR UPDATE` (`conversation_turn_store.py:94-116`).

| Case | Turn N row | History frozen for N+1 (`roles`) | Problem |
|---|---|---|---|
| cut applied (S1a, S1b, S2 when it lands before N+1's admission) | `completed`, content = kept prefix, `voice.truncated` | `… U A(kept) U` | no marker that the reply was cut (BE-ENGINE-TURNTAKING-09). The kept prefix is sentence-granular on EL (`call_ledger.py:380-392`) and measured late (-04). |
| cut skipped, nothing heard before sentence 1 | `completed`, **full** content | `… U A(full) U` | the model thinks an unheard reply was heard (BE-LLM-12; `engine.py:1549-1556`) |
| cut skipped, all sentences had started | `completed`, full | `… U A(full) U` | the cut never fires for the last sentence |
| (b) supersede after end | `completed`, full | `… U A(full) U` | the user talked over the tail, and the model is told it was heard |
| mid-stream cancel, nothing heard | `interrupted`, `''` (`llm_turn_runner.py:219-227`; `conversation_execution.py:180-186`) | `… U U` (**consecutive user messages**) | the row is dropped silently. The model gets no cue that it started answering. |
| superseded before the user message was stored | (no row for N) | `… U(merged "N N+1")` | fine. The text is merged (`engine.py:2075-2088`). The window is tiny: STT done to admission. |
| (c) echo | as above | `… U A U(echo of A)` | the character answers its own words |
| post-end cut refused `not_latest` (N+1 already admitted) | full | `… U A(full) U` | `call_turn_truncation.py:140-145` |

The script prints, per turn, `roles` (e.g. `UAUAUU`), message lengths, `consecutive_user`, and whether the
hash of the last assistant entry equals the stored hash of turn N. A match shows the cut landed before N+1
read the history (`engine.py:2321-2322`). It also prints `interruption_marker_seen`, which the code never
produces (UNKNOWN in data, expected `false`).

---

## 8. Echo detection method (scores only)

The script compares user transcript N+1 with the longer of turn N's stored content and its segment
transcript, which approximates the full text before any cut. It normalizes both strings (NFKD, strip
accents, lowercase, drop punctuation) and computes:

- `gram4_containment` = |4-grams(user) ∩ 4-grams(asst)| / |4-grams(user)|
- `lcs_frac` = longest common block / len(user) (`difflib`, autojunk off)
- `token_containment` and `ratio` (reported, not used for the verdict)

Verdict:
- fewer than 3 user tokens: `too_short_to_judge`
- `gram4_containment ≥ 0.6` or `lcs_frac ≥ 0.5`: `likely_echo`
- `≥ 0.3`: `possible_echo`
- otherwise: `unlikely_echo`

Offline self-test on synthetic Spanish strings, no call data
(`python3 -I overlap_forensics.py --selftest`):

| case | ratio | lcs_frac | gram4 | verdict |
|---|---|---|---|---|
| verbatim echo of the reply tail | 0.693 | 1.0 | 1.0 | likely_echo |
| partial echo (4 tokens) | 0.347 | 1.0 | 1.0 | likely_echo |
| genuine reply | 0.312 | 0.111 | 0.023 | unlikely_echo |
| "sí, claro" | 0.13 | 0.375 | 0.0 | too_short_to_judge |

The real per-turn scores are **UNKNOWN** until the script runs.

---

## 9. Reproducible read-only procedure

Script: `/tmp/claude-1000/-home-andres-WebstormProjects-magic-worlds/9c4c3da7-06b7-4cee-a58b-d2b1e4f9477c/scratchpad/gap-overlap/overlap_forensics.py`

- It forces `SET SESSION TRANSACTION READ ONLY` and `START TRANSACTION READ ONLY`, and rolls back at the end.
- It prints ids, seqs, timestamps, lengths, 12-character sha256 prefixes and scores. It never prints text.
- Run: `/home/andres/PycharmProjects/magic-worlds-api/.venv/bin/python -I overlap_forensics.py bcf13a 9ff8d8 890eb3`,
  or `--since 2026-10-19` for every ended call.
- Output records:
  - `tz`: global, session and system time zone. Check this first (-10).
  - `session`: wall time, consumed, `billing`, Σ STT `duration_ms`, Σ asset `duration_ms`, counts of
    rejected and cancelled segments, the playable bound and the unplayed-TTS lower bound.
  - `pair` (N→N+1): `order_gap_s`, STT latency, `prev_msg_status`, content and segment lengths,
    `seg_equals_content`, `truncated`, `played_ms`, `asset_ms`, `unplayed_ms_if_truncated`,
    `est_overlap_s`, `signature`, `similarity`, `echo`.
  - `history`: roles, lengths, `consecutive_user`, hash match against the stored reply, marker flag.
- `est_overlap_s` = (msg N `created_at` + 1.5 s first-audio estimate + asset seconds) − (seg N+1
  `created_at` − its `duration_ms`). INFERENCE-grade, with 1 s resolution.

Appendix A has the same checks as plain SQL.

---

## 10. Latency on the overlap path

| Stage | Estimate | Evidence | Notes |
|---|---|---|---|
| N+1 waits for `previous.finished`: N's asset write (storage + tts_job + asset rows), segment insert, message link, user-segment update | 50-300 ms typical; more if storage is slow | `engine.py:2069-2074`, `:2711-2755`, `:4002-4140`, `:3540-3588` | only for overlapping turns. On the critical path before N+1's LLM. |
| … plus N's `_settled_truncation` when a cut is pending | 0-3000 ms (cap `VOICE_TRUNCATION_WAIT_SECONDS=3.0`) | `engine.py:109`, `:1644-1667`, `:2691`, `:2725` | |
| N+1 `_await_pending_truncation` before admission | 10-50 ms typical, cap 3000 | `engine.py:2321-2322`, `:1669-1683` | |
| `_cancel_turn` on a pre-end supersede (frame send + EL context cancel + drained-chars count) | 10-150 ms | `engine.py:1958-1994` | |
| The character keeps talking over the user after they stop, until N+1's `voice_turn_start` (case b) | 1200-3000 ms (550 ms hangover + upload + STT + wait + admission) | FE `useVoiceCallController.ts:785-800`; `voicePlaybackBuffer.ts:155-163` | UX overlap, not first-audio latency |
| Cut-point lag on supersede: `played_ms` read at N+1 STT done, not at speech onset | 1000-3000 ms over-estimate of what was heard | `engine.py:1435-1437`; FE `useVoiceCallController.ts:150`, `:493-498` | kept text includes what the user talked over |

---

## 11. Findings

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-01 (high, observability): stored records cannot tell an interrupted reply from a fully heard one
- FACT: the assistant segment status is hard-coded `completed` (`engine.py:3526`). Its `duration_ms` is the
  delivered MP3 (`:3515-3519`, `:4047`). It is written after `voice_turn_end` (`:2700-2745`).
- FACT: the user segment ends `completed` for any turn whose LLM completed, even when the turn was cancelled
  by supersede or barge-in (`:2654`, `:2747-2749`).
- FACT: cancel reason, barge-in, `played_ms` at cancel, `voice_turn_truncation_skipped`, the
  `voice_turn_end` and first-audio times, client `started_at_ms` (validated at `:151`, never stored) and AEC
  or raw-fallback state (absent from `voice_start`, FE `useVoiceCallController.ts:1255-1272`) are log-only
  or missing (`observability.py:164-175`).
- Impact: the REPORTED "status=completed, full-length audio" says nothing about interruption. Mechanisms
  (a), (b) and (c) cannot be fully told apart from DB rows, so product decisions (AEC guard, billing on
  heard audio) must rely on inference.
- Recommendation: add a per-turn durable record with these fields:
  - `first_audio_at`, `turn_end_at`
  - `cancel_reason`, `cancel_at`
  - `played_ms` and its source (report or delivered), `delivered_ms`
  - truncation outcome (applied, skipped-nothing, skipped-all, not_latest, failed)
  - client speech onset mapped to the playback clock
  - `aec`/`raw_fallback` and `captured_during_playback_ms` per segment
  
  Also give the assistant segment `interrupted`/`truncated` status values.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-02 (high, cost): billing counts delivered (not heard) TTS and padded/no-speech/echo STT, so audio seconds exceed wall time
- FACT:
  - TTS is billed on delivered frames (`engine.py:2494-2508`, `:2345-2362`, `:2793-2796`).
  - The client drops a turn's unplayed tail at the next `voice_turn_start` or on a cancel (FE
    `voicePlaybackBuffer.ts:155-163`, `:573-600`).
  - STT bills the full file, including pre-roll and hangover, plus no-speech segments
    (`stt_groq_client.py:355-404`; `engine.py:2243-2252`).
  - The `quota` end compares audio seconds with reserved call seconds (`engine.py:1855-1860`;
    `quota.py:268`).
- REPORTED and INFERENCE: 9ff8d8 consumed 89 s in about 70 s. At least about 13 s of TTS (about 16 % or
  more) could not have been played (section 6.3). That is 9 credits instead of 7.
- Recommendation:
  - Bill TTS on `min(played_ms, delivered_ms)` per turn, settled at the turn end or cancel, using the
    `voice_playback` reports that already exist. Keep delivered audio for the provider-cost ledger only.
  - Bill STT on VAD speech time or on wall time, and never on `no_speech` or echo segments.
  - Alternatively bill connected wall-clock time, which is what users perceive.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-03 (high, correctness): whether a talk-over is cut depends on a race with `voice_turn_end`, not on what was heard
- FACT: a superseding segment cancels and cuts N only if N has not published `voice_turn_end`
  (`engine.py:2069-2074`, `:1426-1434`, `:1958-1960`). `voice_turn_end` is published when TTS **delivery**
  drains (`:2635-2713`). With flush-ahead (3 sentences free, <8 s ahead,
  `call_tts_elevenlabs.py:15-20`, `:55-57`, `:160-167`), that is long before playback ends.
- FACT: the API doc promises a cut for a superseding segment "while the reply is still being written or
  spoken" (`docs/api_usage/voice.md:287-291`). The code does not do this after `voice_turn_end`.
- INFERENCE: the REPORTED inverted ordering (user N+1 received before assistant N stored, in almost every
  multi-turn call) shows the overlap began while N was still running. For those pairs no barge-in frame
  ended N at speech onset. The outcome (S1b cut, or S3b/b no cut) then depends on N+1's STT latency
  relative to N's drain. The same user behaviour gives different stored history and billing.
- Recommendation (extends BE-ENGINE-TURNTAKING-01):
  - On a non-empty superseding transcript, decide the cut whenever `_truncation_window_open(last_turn)` is
    true.
  - Send `voice_cancelled{superseded}` so the client stops the tail at once.
  - Use the segment onset, not STT completion, as the cut time.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-04 (medium, correctness): the supersede cut overstates what was heard
- FACT:
  - `played_ms` comes from the latest `voice_playback` report when N+1's STT completes. Reports are sent
    every 500 ms and kept per turn (`engine.py:1435-1437`, `:1333-1335`; FE
    `useVoiceCallController.ts:150`, `:493-498`). Without a report, `delivered_ms` is used as an upper bound.
  - On EL the cut keeps whole sentences that had started (`call_ledger.py:380-392`). If every sentence
    started, `kept == content` and no cut happens (`call_turn_truncation.py:62-68`).
- Impact: the stored reply includes 1-3 s that the user talked over, often the whole reply.
- Recommendation: send the segment's `started_at_ms` mapped to the playback clock (or a
  `voice_user_speech_start` frame), and cut at word level using the alignment or `acked_chars` that are
  already parsed.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-05 (medium, correctness): post-interruption LLM history has no marker, drops started-but-unheard replies and admits echo as user speech
- FACT:
  - Only `completed` rows with non-empty content reach the model, as plain content
    (`conversation_execution.py:56-86`).
  - A mid-stream cancel with nothing heard is stored `interrupted`/`''` (`llm_turn_runner.py:219-227`;
    `conversation_execution.py:180-186`), so the history has consecutive user messages.
  - A nothing-heard completed reply keeps its full text (`engine.py:1549-1556`; BE-LLM-12).
  - There is no interruption annotation anywhere (BE-ENGINE-TURNTAKING-09).
  - An echo transcript becomes a user turn.
- UNKNOWN: how often each shape occurs in real frozen histories. The script prints `roles` and
  `consecutive_user`.
- Recommendation:
  - Annotate cut replies (e.g. a trailing "— [interrupted by the user]" in the model view only).
  - Keep a short stub for a nothing-heard reply, or merge consecutive user messages with a note.
  - Drop or flag echo-similar segments before admission.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-06 (medium, latency): an overlapping turn waits for the previous turn's bookkeeping before its LLM call
- FACT:
  - N+1 awaits `previous.finished` (`engine.py:2074`).
  - `finished` is set only after N's asset write, segment insert, message link and user-segment update
    (`:2711-2755`, `:2105-2110`), and after N's `_settled_truncation` (≤3 s, `:1644-1667`).
  - N+1 then awaits `_await_pending_truncation` (≤3 s, `:2322`).
- INFERENCE: the 1 s inverted gaps in 9ff8d8 and 890eb3 are time N+1 spent in this wait (case b).
- Recommendation: set a "turn over" event at `voice_turn_end`, move asset persistence, linking and segment
  rows to a background task, and wait only on the truncation write.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-07 (medium, robustness): a post-end barge-in cut leaves the segment and asset transcript at the full text
- FACT: the assistant segment and asset are written right after `voice_turn_end` with `collected_text`,
  unless a cut was already settled (`engine.py:2721-2745`). A barge-in in the open window after that
  (`:1354-1365`, `:1566-1642`) updates only `adventure_message` (`call_turn_truncation.py:166-169`;
  `engine.py:480-486`).
- Impact: transcript view, audio asset caption and LLM history disagree. The script's `S2` signature
  detects this.
- Recommendation: also update the segment transcript and asset transcript, or store `played_ms` on the
  segment.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-08 (medium, robustness): no evidence and no guard for self-echo, and echo is billed twice
- FACT:
  - Segments upload whatever the playback state (FE `useVoiceCallController.ts:920-935`).
  - Auto barge-in is suppressed without AEC and in the 3 s warm-up (`:676-687`).
  - No AEC, raw-fallback or playback-overlap field is sent or stored (`:1255-1272`; `engine.py:3860-3862`;
    `server_vad.py:98-111`).
  - The BFF has no echo filter (FE-CAPTURE-01).
  - Echo STT is billed (`engine.py:2243-2251`) on top of the TTS it repeats.
- UNKNOWN: whether any of the REPORTED overlaps are echo. That needs the similarity scores.
- Recommendation:
  - Tag segments with `aec_state` and `captured_during_playback_ms`.
  - Server guard: drop a segment whose transcript has `gram4_containment ≥ 0.6` against the reply being
    played and that overlaps playback. Do not bill it.
  - Client: half-duplex when AEC is off or unverified (FE-CAPTURE-01).

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-09 (low, cost): daily quota mixes audio seconds and wall seconds
- FACT: the live end path consumes billable **audio** seconds (`engine.py:1135-1148`). The sweeper and the
  no-billing-state fallback consume **elapsed wall** seconds (`quota.py:401-404`, `:568-574`;
  `engine.py:3830-3837`).
- Impact: `voice_usage_day.consumed_seconds` and the remaining daily minutes mix two units.
- Recommendation: pick one unit, and on the sweeper path read `metadata.billing.billable_audio_seconds`.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-10 (low, observability): timestamp precision and time-zone hazards weaken any overlap reconstruction
- FACT:
  - All relevant columns are `datetime` with second precision (`db.sql`).
  - Message `completed_at` uses `UTC_TIMESTAMP()` (`conversation_turn_store.py:358`, `:672`). Segment
    timestamps and message `created_at` use `CURRENT_TIMESTAMP` (`models.py:7579-7580`, `:7817-7819`).
  - Admission runs `SET time_zone='+00:00'` on a pooled connection (`llm_execution_admission.py:488`). The
    pool sets no `init_command` (`runtime_config.py:526-533`), so the session setting persists on that
    connection.
- INFERENCE: if the MySQL global time zone is not UTC, `CURRENT_TIMESTAMP` values depend on which pooled
  connection ran the insert. The 1 s resolution makes 1 s inversions undecidable either way.
- Recommendation: `datetime(3)`, UTC everywhere, and time zone set at pool init. The script prints the
  server time zone first.

### GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-11 (info, observability): the data part of this gap was not executed
- FACT: DB reads and the sibling dump reads were denied by the permission classifier as production reads.
- Impact: the per-turn (a)/(b)/(c) classification, similarity scores, truncation-versus-transcript checks
  and frozen-history dumps are UNKNOWN. Recommendations stay inference-grade until the script runs.
- Recommendation: the user approves a read-only run of `overlap_forensics.py` (or runs it themselves), then
  re-check -03, -05 and -08 against its output.

---

## 12. Strengths (FACT)

- `turn_id == adventure_message.turn_id == tb_llm_execution_plan.execution_id`, and the plan freezes the
  exact `messages` sent (`llm_execution_admission.py:565-571`; `conversation_execution.py:166-171`). That is
  excellent for reconstructing what the LLM saw.
- Billing is idempotent per segment and per TTS slice. It reverts on a failed debit and persists its running
  state on the session (`engine.py:2245-2251`, `:2356-2362`, `:3402-3421`, `:3441-3455`). This makes the
  billing audit possible at all.
- When a cut is decided, it lands before the next turn reads history (`engine.py:2321-2322`). It is
  idempotent and touches only the latest message (`call_turn_truncation.py:138-145`).
- Asset transcripts follow a cut decided before the persist (PD-3, `engine.py:2721-2726`).
- A split utterance is merged when superseded before persistence (`engine.py:2075-2088`).
- A mid-stream barge-in keeps the heard prefix (Q-19, `call_ledger.py:97-114`; `engine.py:1475-1539`).
- Logs never carry text. STT summaries keep latency and no-speech metrics per segment, which is useful for
  the overlap timing (`stt_groq_client.py:200-213`).

---

## 13. Open questions

1. Will the user approve a read-only run of the script (or run it), so that sections 4 to 8 can be filled
   with real classifications and scores?
2. What are MySQL `@@global.time_zone` and `@@system_time_zone`?
3. Were the BFF `voice_event` logs (`voice_barge_in`, `voice_turn_truncated`,
   `voice_turn_truncation_skipped`, `voice_segment_cancelled`) retained for the 2026-10-19/20 calls? The
   local `.dev/logs` only go up to 2026-10-18.
4. Did the test calls run with laptop speakers or headphones, and was the raw-fallback mic active? Neither
   is recorded.
5. What is the product intent for call billing: provider audio generated, audio heard, or connected minutes?
   The doc says "authoritative audio-seconds billing" (`docs/api_usage/voice.md:464-466`), while the limits
   UI speaks of call seconds.
6. Do any frozen histories actually contain consecutive user messages? Do the configured providers accept
   them? magic-llm has no same-role normalization (grep found none).

---

## Appendix A: read-only SQL (structure only, no text selected)

```sql
-- A1 time zone
SELECT @@global.time_zone, @@session.time_zone, @@system_time_zone;

-- A2 sessions and billing
SELECT voice_session_id, tts_provider, started_at, ended_at,
       TIMESTAMPDIFF(SECOND, started_at, ended_at) AS wall_s, reserved_seconds, consumed_seconds, end_reason,
       metadata->>'$.billing.stt_audio_ms' AS stt_ms, metadata->>'$.billing.tts_audio_ms' AS tts_ms,
       metadata->>'$.billing.billable_audio_ms' AS billable_ms, metadata->>'$.billing.billed_credits' AS credits
FROM voice_session
WHERE voice_session_id LIKE 'bcf13a%' OR voice_session_id LIKE '9ff8d8%' OR voice_session_id LIKE '890eb3%';

-- A3 segment timeline (no text)
SELECT seq, role, status, error_category, turn_id, duration_ms, CHAR_LENGTH(transcript_text) AS tlen,
       created_at, completed_at, stt_summary->>'$.latency_ms' AS stt_latency_ms,
       stt_summary->>'$.duration_ms' AS stt_duration_ms, tts_summary->>'$.status' AS tts_status,
       tts_summary->>'$.audio_chunks' AS chunks
FROM voice_transcript_segment WHERE voice_session_id = ? ORDER BY seq, FIELD(role,'user','assistant');

-- A4 stored reply vs assistant segment (no text)
SELECT s.seq, m.message_id, m.status, CHAR_LENGTH(m.content) AS content_len,
       CHAR_LENGTH(s.transcript_text) AS seg_len, s.transcript_text = m.content AS seg_eq_content,
       LEFT(s.transcript_text, CHAR_LENGTH(m.content)) = m.content AS seg_starts_with_content,
       m.metadata->>'$.voice.truncated' AS truncated, m.metadata->>'$.voice.played_ms' AS played_ms,
       s.duration_ms AS asset_ms, m.created_at AS admitted_at, m.completed_at AS llm_done_at,
       s.created_at AS asset_row_at
FROM voice_transcript_segment s JOIN adventure_message m ON m.message_id = s.assistant_message_id
WHERE s.role = 'assistant' AND s.voice_session_id = ?;

-- A4b replies that never got an assistant segment (interrupted / failed)
SELECT u.seq, m.message_id, m.status, CHAR_LENGTH(m.content) AS content_len, m.metadata->>'$.error_category' AS err
FROM voice_transcript_segment u JOIN adventure_message m ON m.message_id = u.assistant_message_id
WHERE u.role = 'user' AND u.voice_session_id = ? AND m.status <> 'completed';

-- A5 frozen history structure per turn (no text)
SELECT u.seq, p.execution_id, jt.idx, jt.role, CHAR_LENGTH(jt.content) AS len, LEFT(SHA2(jt.content,256),12) AS h
FROM voice_transcript_segment u
JOIN tb_llm_execution_plan p ON p.execution_id = u.turn_id,
     JSON_TABLE(p.frozen_payload, '$.messages[*]'
        COLUMNS (idx FOR ORDINALITY, role VARCHAR(16) PATH '$.role', content LONGTEXT PATH '$.content')) jt
WHERE u.role = 'user' AND u.voice_session_id = ?
ORDER BY u.seq, jt.idx;
-- compare the last assistant h with LEFT(SHA2(adventure_message.content,256),12) of turn N

-- A6 billing cross-check
SELECT SUM(CASE WHEN role='user' THEN CAST(stt_summary->>'$.duration_ms' AS UNSIGNED) END) AS stt_ms_segments,
       SUM(CASE WHEN role='assistant' THEN duration_ms END) AS asset_ms
FROM voice_transcript_segment WHERE voice_session_id = ?;
-- expect metadata.billing.stt_audio_ms ≈ stt_ms_segments (includes no_speech rejects)
-- expect metadata.billing.tts_audio_ms ≥ asset_ms (interrupted turns bill audio without an asset)
```

## Appendix B: constants and defaults used above

| Constant | Value | Where |
|---|---|---|
| `VOICE_CALL_SECONDS_PER_CREDIT` | 10 | `engine.py:81` |
| `MAX_INFLIGHT_SEGMENTS_PER_CALL` | 3 | `engine.py:83` |
| `VOICE_TRUNCATION_WINDOW_GRACE_MS` | 2000 | `engine.py:108` |
| `VOICE_TRUNCATION_WAIT_SECONDS` | 3.0 | `engine.py:109` |
| `VOICE_EL_BILLING_INTERVAL_MS` | 2000 | `engine.py:117` |
| `VOICE_PLAYBACK_MAX_FRAMES_PER_SECOND` / `TURNS_KEPT` | 4 / 4 | `engine.py:119-121` |
| `FLUSH_AHEAD_FREE_SENTENCES` / `MAX_SENTENCES_AHEAD` / `MAX_AUDIO_AHEAD_MS` | 3 / 3 / 8000 | `call_tts_elevenlabs.py:55-57` |
| `PLAYBACK_ESTIMATE_LAG_MS` | 500 | `call_tts_elevenlabs.py:58` |
| `DEFAULT_MS_PER_CHAR` (ledger fallback) | 65 | `call_ledger.py:56` |
| FE `AEC_WARMUP_MS` | 3000 (first playback of the call only, `??=`) | FE `useVoiceCallController.ts:143`, `:705` |
| FE `BARGE_IN_MIN_SPEECH_MS` / `DEFAULT_MIN_SPEECH_MS` | 500 / 250 | FE `useVoiceCallController.ts:137`, `:144` |
| FE `PLAYBACK_PROGRESS_MS` | 500 | FE `useVoiceCallController.ts:150` |
| FE `QUEUED_UPLOAD_SPACING_MS` | 120 | FE `useVoiceCallController.ts:152` |
| FE call VAD `silenceMsToEnd` / `minSpeechMs` | 550 / 250 | FE `CallScreen.tsx:114` |
| FE VAD pre-roll | 300 ms | FE `voiceVadWorklet.ts:20` |
| Server VAD energy gate | off by default | `server_vad.py:31` |

---

## Verification (adversarial)

Verified on 2026-10-20 by re-opening the cited code and looking for guards, tests or docs that contradict each
finding. Only findings -01 to -08 were in scope. No source file was modified. The REPORTED call numbers
(bcf13a, 9ff8d8, 890eb3) could not be checked, so every verdict below rests on the code mechanism only.

| id | verdict | corrected severity | evidence/note |
|---|---|---|---|
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-01 | adjusted | medium | **Confirmed:** the assistant segment is created with `status="completed"` hard-coded (`engine.py:3520-3527`). Its `duration_ms` is the MP3 duration of the persisted asset (`:3515-3519`, `:4047`). The user segment's final status is `completed` whenever `completion.status` is (`:2654`, `:2747-2750`). Segment `started_at_ms` is only validated (`:151`) and never stored. `voice_turn_truncation_skipped` and the first-audio and turn-end times exist only in logs and the in-memory deque (`observability.py:164-175`). `voice_start` and the segment `vad` carry no AEC or raw-fallback field (FE `useVoiceCallController.ts:1255-1272`; `engine.py:3860-3862`). **Overstated:** "not persisted at all" is wrong for part of the list. An applied cut stores `voice.truncated` and `played_ms` on `adventure_message` (`call_turn_truncation.py:157-169`). A user segment cancelled before publish stores the cancel reason as `error_category` `superseded` or `end_call` (`engine.py:2286-2289`), although a pre-publish barge-in is mislabelled `end_call`. An interrupted reply stores `error_category: 'cancelled'` (`conversation_execution.py:184`). The core gap is real: no per-turn record of cancel, played or skip, and the assistant segment status never changes. This is an observability gap, so medium rather than high. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-02 | adjusted | medium | **Confirmed:** TTS is billed on delivered MP3 frames (`engine.py:2345-2362`, `:2494-2508`, `:2793-2796`). STT is billed before the `no_speech` rejection (`:2243-2252`). The `quota` end compares billable audio seconds with `reserved_seconds = min(max_call_seconds, remaining)` (`:1855-1860`; `quota.py:268`). The client drops the unplayed tail at the next `startTurn` (FE `voicePlaybackBuffer.ts:155-163`, `:573-600`). **Wrong detail:** the uploaded WAV does not include the 550 ms hangover. The worklet keeps only `TRAILING_SILENCE_KEEP_MS = 200` of trailing quiet (FE `voiceVadProcessor.worklet.js:48`, `:379`), so the padding is about 0.5 s per segment, not 0.85 s. **Context:** billing delivered audio is a documented, deliberate policy ("Preserve that policy unless deliberately changed", `docs/fish_audio_support/06_streaming_calls_and_alignment.md:112`). The real defect is that this audio-time unit is spent against a budget the product presents as call time. The 13 s and 9-versus-7 credit figures depend on REPORTED numbers and are unverified. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-03 | confirmed | high | `_supersede_heard_prefix` returns early on `turn.end_published` (`engine.py:1426-1434`), and `_cancel_turn` returns False on it (`:1958-1960`). After `end_published` a superseding segment therefore neither cuts nor cancels: it only awaits `finished` (`:2069-2074`). `end_published` is set after `speaker.finish()` (`:2635-2637`), which waits for provider audio delivery, not playback (`call_tts_elevenlabs.py:126-129`). Flush-ahead lets up to 3 unheard sentences or 8 s run ahead (`call_tts_elevenlabs.py:15-20`, `:160-167`). The doc promises a cut "while the reply is still being written or spoken" (`docs/api_usage/voice.md:287-291`). The only supersede test holds the TTS so the cut happens before the end (`tests/voice/test_mid_stream_barge_in.py:419-450`). No test covers a supersede after the end. **Precision:** the gate is `end_published`, which is set right after `voice_audio_final` and before the ≤3 s settle and the `voice_turn_end` frame. The race applies only when no `voice_barge_in` frame fired: AEC off, raw fallback, the 3 s warm-up, or playback not `playing` (FE `useVoiceCallController.ts:676-687`). A frame targets `last_turn` while the window is open (`engine.py:1354-1365`). |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-04 | confirmed | medium | `_supersede_heard_prefix` reads `_latest_playback` (the latest 500 ms report) when the superseding segment's STT has completed, and falls back to `delivered_ms` (`engine.py:1435-1437`, `:1333-1335`; FE `useVoiceCallController.ts:493-498`). On the EL ledger, `keep_end` returns the span end of the last sentence that started before `played_ms` (`call_ledger.py:380-392`). `kept_call_content` returns None when the cut keeps everything (`call_turn_truncation.py:62-68`), so no cut is applied. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-05 | adjusted | medium | **Confirmed:** history keeps only `completed` rows with non-empty content (`conversation_execution.py:56-86`). An interrupted, nothing-heard reply is stored `''` (`:180-186`; `llm_turn_runner.py:219-227`) and is dropped, which gives consecutive user messages. A nothing-heard skip keeps the full text (`engine.py:1549-1556`). `not_latest` refuses the cut (`call_turn_truncation.py:140-145`). The BFF has no echo filter. **Overstated:** "no interruption annotation exists anywhere" is too strong. Every variant of the callbot system prompt already tells the model that its earlier lines may stop where the caller interrupted (`src/agent_graphs/runtime/callbot_chat.v2.json:18-20`, `:37`). What is missing is a per-message marker and any cue for the UU and nothing-heard shapes. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-06 | confirmed | medium | The next turn awaits `previous.finished` (`engine.py:2074`). `finished` is set only in the `accept_segment` `finally` (`:2105-2110`), after the previous turn's `_settled_truncation`, asset persist, segment insert, message link and user-segment `update_segment` (`:2700-2755`, `:3500-3588`). The new turn then awaits `_await_pending_truncation` (≤3 s, `:2321-2322`, `:1669-1683`). The admission does not need the asset rows. The 50-300 ms figure and the link to the REPORTED 1 s gaps are estimates. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-07 | confirmed | medium | The asset and segment take `truncation[1]` only when a cut has settled before the persist (`engine.py:2721-2745`). `runtime.last_turn` is set before the persist (`:2711-2713`), so the barge-in window stays open afterwards (`:1337-1365`). A later cut goes through `truncate_call_turn`, which updates only `adventure_message` content and metadata (`call_turn_truncation.py:157-169`; `engine.py:480-486`). Nothing re-writes the segment or the asset transcript. This is partly a known limitation: `docs/voice_refactor/00_current_status_and_roadmap.md:83` (V-07) records it, but only for a barge-in during the persist. With flush-ahead, any post-end barge-in after the persist hits it as well. |
| GAP-REAL-CALL-OVERLAP-HISTORY-BILLING-08 | confirmed | medium | Every captured segment is uploaded, whatever the playback state (FE `useVoiceCallController.ts:918-933`, `:563-590`). Auto barge-in returns early on raw fallback or with AEC off, and during the first 3 s after the call's first playback (`:676-687`, `:705`). Neither `voice_start` nor the segment `vad` (`segmentUploadVad`, FE `speechEndLag.ts:38-44`) carries AEC or playback-overlap state, and the server allow-list drops unknown keys (`engine.py:3860-3862`). The BFF has no echo handling (grep for "echo" in `voice_orchestration` finds none). STT of every segment is billed (`:2243-2252`). **Small overstatement:** "without leaving a trace" is too strong. The echo transcript is stored on the user segment, so it can be detected after the fact by text similarity, but nothing flags it. |
