# Gap audit: call audio assets, transcript vs audio length, and the MP3 chunk/timeline contract

Subsystem: what happens to the assistant's call audio after it is synthesized. This note covers how the per-turn MP3 is collected, metered, stored and served, why the stored audio is much longer than its stored transcript, where the "missing" assets actually are, what can delete them, and whether the server's MP3 frame meter and the browser's `audio.currentTime` / `played_ms` share one timeline.

Repos (read-only, nothing modified):
- BFF: `/home/andres/PycharmProjects/magic-worlds-api` (paths below are relative to it unless absolute)
- SPA: `/home/andres/WebstormProjects/magic-worlds` (prefixed `FE:`)

Legend: **FACT** = read in code at the cited line, or measured directly on data or files (the query or command is in Appendix A). **INFERENCE** = reasoned from code and data. **UNKNOWN** = cannot be settled from what was available.

Evidence used beyond code:
- Read-only SQL against the live dev/test database `magic_worlds` on `192.168.1.90:3306` (session set `READ ONLY`). Data: 7 calls on 2026-10-20 (21:37-22:24 UTC), 17 assistant segments, 17 `tts_asset` rows, `voice_session.metadata.billing`, `adventure_message` content and metadata.
- The local storage root `/home/andres/PycharmProjects/magic-worlds-api/.tts_storage` and the `.90` deployment's storage, which is mounted locally over sshfs at `/home/andres/server/RAID5` (`root@192.168.1.90:/media/RAID5`, `fuse.sshfs`).
- Captures: `.dev/fish-call-contract/2026-10-15/` (`packet-0001..0011.msgpack`, `native-01.mp3`, `native-01-report.json`, `native-01-word-projection.json`) and `.dev/fish-call-application/2026-10-15/` (`complete-engine-01-*.msgpack/json/mp3`, `cancel-engine-01-*`).
- 17 call MP3s on the `.90` storage plus 6 older call MP3s on local storage (4 ElevenLabs, 2 Fish). Each was frame-parsed with the project's own `mp3_frames.py` and decoded to PCM with `ffmpeg`, to measure silence, onset and exact-zero runs.

---

## 0. Short answers to the three questions

1. **Why the audio is 2-3x longer than the stored transcript.**
   - The asset holds every MP3 byte delivered to the socket before the cancel. The transcript holds only the heard prefix (`engine.py:2495`, `:2714`, `:2722-2745`). FACT.
   - 12 of 17 turns were barge-in truncated. Their assets hold 1.08-3.21x the audio that was played (97.0 s of 283.1 s total, 34 %, was never heard). FACT.
   - Both providers synthesize far faster than real time: Fish about 8x (INFERENCE from the capture). The flush-ahead gate lets 3 sentences through regardless of their length (`call_tts_elevenlabs.py:55-57`, `:160-167`). So 0.6-16.5 s of unplayed audio is already delivered when the user cuts in. FACT.
   - In 4 of 17 turns the mismatch runs the other way. The segment or asset transcript holds the **full** reply, but `adventure_message.content` was cut afterwards. A late truncation never reaches the segment or the asset (`call_turn_truncation.py:157-169`). FACT.
   - Fish drama-3 silence adds about 14-26 % (pauses up to 1.3 s, trailing up to 0.8 s). It does not explain a 3x ratio. FACT.
   - Duplicated audio: no evidence. All 17 files parse as contiguous frames with 0 skipped bytes. Each call's billed `tts_audio_ms` equals the sum of its assets' durations (one call has 888 ms more). FACT.
2. **Where the files are.** Not lost.
   - All 17 files exist, byte-identical in size, on the **`.90` test deployment's** storage: `/media/RAID5/magic_worlds_api/.tts_storage/2026/10/...`, mounted here at `/home/andres/server/RAID5/...`. FACT.
   - The calls were served by the BFF deployed on `.90` (`docs/voice_refactor/00_current_status_and_roadmap.md:78`, V-02: "The BFF and SPA are deployed together" on `.90`). That BFF shares the `magic_worlds` MySQL with the local dev BFF on `:8010`. FACT for the shared DB and the file locations. INFERENCE for which process served the calls; this is the only consistent explanation.
   - Nothing in code deleted the files. The local BFF never wrote them: `.tts_storage/2026/10` mtime is 2026-10-17 21:29 local, and no job directory exists.
   - The local BFF answers 404 for all 17 (`routes/tts.py:78-92`, `:125-128`). Any client served by the local BFF sees "audio could not be loaded" in call history and in chat narration. FACT for the code path; not executed (needs a user token).
3. **MP3 contract.**
   - ElevenLabs: `mp3_44100_64`. MPEG-1 Layer III, 44.1 kHz, mono, 64 kbps CBR, 1152 samples per frame (26.122 ms), 208/209 B per frame. Real-call chunks average 2.3-3.1 KB (290-385 ms of audio), 30-51 chunks per turn.
   - Fish: MPEG-1 Layer III, 44.1 kHz, mono, 128 kbps CBR, 417/418 B per frame.
     - Provider packets are 7-24 KB (0.42-1.5 s) and **not frame-aligned** (9 of 10 start mid-frame).
     - The engine re-frames them into whole frames (`stream_mp3.py:13-38`).
     - Real-call chunks average 8.3-15.6 KB (0.52-0.97 s), 15-29 per turn. The first chunk is 16 frames (418 ms).
   - Neither provider emits Xing, Info, VBRI or LAME header frames. Each turn is one contiguous encoder stream: one leading ID3 for ElevenLabs, none for Fish, no mid-stream headers. So there is **no per-sentence codec priming**.
   - ElevenLabs does show exact-digital-zero runs of 30-280 ms at sentence boundaries. These are provider silence, not codec priming. INFERENCE.
   - The server meter and the client clock share one frame-count timeline from the turn's first frame:
     - The server sums whole-frame durations exactly with `Fraction` (`mp3_frames.py:226-263`, `call_ledger.py:250-259`).
     - The client builds a new `MediaSource` per turn with an `audio/mpeg` SourceBuffer (FE `voicePlaybackBuffer.ts:316-355`). The MSE byte-stream format for MPEG audio generates timestamps, so the buffer runs in sequence mode.
     - The residual skew is under 40 ms: encoder and decoder delay are not trimmed on either side.

---

## 1. How it works today (architecture walkthrough)

### 1.1 Per-turn audio path

| Step | Code | What happens |
| --- | --- | --- |
| Turn setup | `engine.py:2323`, `:2326-2329` | `assistant_audio = bytearray()`. Ledger: `WordCallTurnLedger` (Fish) or `CallTurnLedger` (ElevenLabs). `tts_meter = Mp3FrameMeter()` |
| Provider to chunk (Fish) | `providers/fish_audio/timestamp_ws.py:206-213`; `streaming.py:195-210`; `stream_mp3.py:6-38` | Fish start request: `format:'mp3', sample_rate:44100, mp3_bitrate:128, chunk_length:100, latency:'balanced'`. Each msgpack `audio` packet passes through `FishMp3Frames.feed`, which forwards **whole frames only** (carries the partial tail) and fails the call on any frame that is not 44.1 kHz, mono, bitrate index 9 (128 kbps) |
| Provider to chunk (ElevenLabs) | `speech/capabilities.py:65`, `:159`; `providers/elevenlabs/tts_multicontext_ws.py:236-248`, `:638-641` | Call surface `("call","standard") → ("el_v4_turbo","ttd_ws", "mp3_44100_64")`. Each sentence is sent as `{"context_id", "inputs":[{"text": sentence+" "}], "flush": True}` |
| Deliver | `engine.py:2441-2508`; `delivery.py:233-268`, `:445-466` | One provider chunk becomes one `voice_audio_chunk` JSON frame (`data_b64`). No re-chunking. Outcomes: `CANCELLED` (not stored), `STALE` (fatal), `SENT` or `DROPPED` (socket away). The last two are **stored and billed**: `assistant_audio.extend(data)` (`:2495`), `tts_meter.feed` (`:2496`), `ledger.on_audio` (`:2497`) |
| Bill | `engine.py:2345-2362`, `:2507-2508`, `:3378-3440` | At each sentence start or every 2,000 ms delivered (`VOICE_EL_BILLING_INTERVAL_MS`, `:117`). `Mp3FrameMeter.take` gives the whole-frame ms since the last reading. 10 s of audio = 1 credit (`:81`) |
| Turn end | `engine.py:2636-2712` | `speaker.finish()`, final bill, `voice_audio_final`, `voice_turn_end` (with `truncated/played_ms/kept_chars`), `runtime.last_turn = turn` (`:2713`) |
| Choose transcript | `engine.py:2714-2726` | `complete_audio = bytes(assistant_audio)`. `transcript = truncation[1] if truncation is not None else turn.collected_text`. The truncation is `_settled_truncation`, which waits up to 3 s for the truncation write (`:1644-1667`) |
| Persist | `engine.py:2730-2746` → `_persist_assistant_call_turn` `:3469-3591` → `_persist_call_audio_asset` `:4002-4146` | `scan_mp3_frames(audio_bytes, final=True)` gives `duration_ms` (`:4046-4049`). `storage.save_provider_audio` gives SHA-256 + atomic fsync'd write (`:4075-4084`; `tts_generation/storage.py:97-146`, `:239-283`). Then one DB transaction: `tts_job` (source `call_character_tts`) + `UPDATE ... completed` + `tts_asset` (`:4085-4135`). Then `voice_transcript_segment` (assistant row, `transcript_text`, `duration_ms`, `tts_summary.asset_id`, `:3520-3538`), then a best-effort patch of `adventure_message.metadata.tts_segments["0"]` with `audio_url /tts/assets/<id>.mp3` (`:3540-3591`) |
| Serve | `routes/tts.py:78-92`, `:95-134` | `GET /tts/assets/{id}.mp3`: owner check, then `_resolve_owned_audio_path` → `target.is_file()`. Missing, foreign or invalid all give the same 404 "TTS asset not found." |
| History UI | `routes/user/route_voice_call.py:1284-1314`; FE `features/call/components/CallTranscriptLines.tsx:44-103`; FE `infrastructure/api/useAuthenticatedMediaUrl.ts:34-54` | Each transcript line carries `text = segment.transcript_text`, `duration_ms = segment.duration_ms` and `audio_url`. The SPA lazily fetches the blob near the viewport. On error it shows `call.transcript.audioLoadFailed` with a "Try again" button |
| Chat UI | FE `features/interaction/chatSessionConfig.ts:92-99`; FE `ChatTurn.tsx:110`, `:187` | The call message's `tts_segments` clip (`audio_url`) is offered as narration next to the (possibly truncated) message text |

### 1.2 Truncation paths and what each one updates

| Path | Trigger | Updates `adventure_message` | Updates segment and asset transcript | Asset audio |
| --- | --- | --- | --- | --- |
| Mid-stream keep (LLM still streaming) | barge-in or supersede before `llm_completed` (`engine.py:1367-1394`, `:1452-1475`) | `complete_interrupted_call_turn` at turn end, bounded at 3 s (`:1477-1538`) | yes, `heard[1]` (`:2722-2726`) | everything delivered before the cancel |
| Post-completion, pre-persist | barge-in after `llm_completed`, settled before `_settled_truncation` returns | `truncate_call_turn` task (`:1541-1642`) | yes | everything delivered |
| **Late (post-persist)** | barge-in inside the window after the asset was written (`_truncation_window_open`, `:1337-1352`: until playback reaches `delivered_ms` or `audio_final_at + delivered + 2 s`) | yes (`call_turn_truncation.py:157-172`) | **no**: the segment, `tts_job.input_summary` and `tts_segments` keep the full text | everything delivered |

`truncate_call_turn` rewrites only `adventure_message.content`, `response_display_text`, `response_segments[0].content` and `metadata.voice.{truncated, played_ms}` (`call_turn_truncation.py:157-169`). It never touches `voice_transcript_segment`, `tts_asset`, `tts_job` or `metadata.tts_segments`. FACT.

### 1.3 Storage, retention and deletion code reviewed

| Code | Deletes call audio files? | Notes |
| --- | --- | --- |
| `tts_generation/storage.py:148-159` `delete` | only when called | callers: `owned_blob_cleanup.cleanup_owned_storage_paths` (`owned_blob_cleanup.py:37-53`) and the orphan sweep |
| `tts_generation/storage.py:239-259` `_write_owned_file` | unlinks its own file only if the write itself is cancelled | no DB row exists then |
| `database/mysql/voice_orphan_sweep.py` (docstring `:1-79`; `:240-249`, `:313-327`, `:492-522`, `:627-700`) | yes, but only through a **manual, reviewed** `inspect → preflight → apply` with `delete_orphans: true`, `GET_LOCK`, and a 7-day cutoff (`GRACE_DAYS = 7`, `:86`; `SNAPSHOT_SQL` `:284-287`) | unlinks files and never removes directories. Could not have touched assets created on the same day |
| `services/speech/ops/history_sweep.py:1-40`, `:60-62` | no | deletes **ElevenLabs provider-side history items** older than 24 h (`RETENTION_SECONDS = 86_400`). Off by default (`VOICE_HISTORY_SWEEP_ENABLED`) |
| `engine.py:819-822` `"raw_audio_retention": "none"` | n/a | a metadata label: user microphone audio is never stored. It is not a retention job |
| `database/mysql/models.py:22660-22800` `_purge_call_content` | soft-deletes (`deleted_at`) the assets of a deleted call message or chat; files are removed later by the sweep | see finding 08 for the `j.operation` filter |
| `database/mysql/models.py:5925-5975` | preview MP3s only (`voice_preview/`) | user-wipe path |

---

## 2. Data: the 17 assistant turns of 2026-10-20 (FACT, read-only SQL)

`content` is `CHAR_LENGTH(adventure_message.content)`. `tlen` is `CHAR_LENGTH(voice_transcript_segment.transcript_text)`. `asset ms` is `tts_asset.duration_ms`, which equals the meter's whole-frame duration of the file (re-measured on `.90`). `played` is `metadata.voice.played_ms`. `trunc` is `metadata.voice.truncated`.

| msg | lane | content | tlen | trunc | played ms | asset ms | asset/played | unheard ms | mismatch type |
| ---: | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 513 | Fish | 92 | **211** | true | 7,433 | 15,386 | 2.07 | 7,953 | late truncation (segment full) |
| 515 | Fish | 95 | 95 | true | 7,650 | 24,163 | 3.16 | 16,513 | audio > heard text |
| 517 | Fish | 242 | 242 | false | - | 21,420 | - | 0 | none |
| 519 | Fish | 289 | 289 | false | - | 22,727 | - | 0 | none |
| 523 | Fish | 79 | **84** | true | 7,193 | 7,784 | 1.08 | 591 | late truncation |
| 525 | Fish | 56 | 56 | true | 4,953 | 15,882 | 3.21 | 10,929 | audio > heard text |
| 527 | Fish | 127 | 127 | true | 11,510 | 20,402 | 1.77 | 8,892 | audio > heard text |
| 529 | Fish | 109 | 109 | true | 9,659 | 18,939 | 1.96 | 9,280 | audio > heard text |
| 531 | Fish | 317 | 317 | false | - | 17,554 | - | 0 | none |
| 536 | Fish | 79 | 79 | true | 6,239 | 16,039 | 2.57 | 9,800 | audio > heard text |
| 541 | Fish | 91 | **111** | true | 6,696 | 8,411 | 1.26 | 1,715 | late truncation |
| 543 | Fish | 160 | 160 | true | 12,301 | 23,118 | 1.88 | 10,817 | audio > heard text |
| 545 | Fish | 299 | 299 | false | - | 12,487 | - | 0 | none |
| 548 | EL | 74 | **122** | true | 4,822 | 8,777 | 1.82 | 3,955 | late truncation |
| 550 | EL | 190 | 190 | true | 9,070 | 17,789 | 1.96 | 8,719 | audio > heard text |
| 552 | EL | 110 | 110 | true | 6,737 | 14,576 | 2.16 | 7,839 | audio > heard text |
| 554 | EL | 227 | 227 | false | - | 17,633 | - | 0 | none |
| **total** | | | | 12/17 | 94,263 | 283,087 | | **97,003 (34.3 %)** | |

Cross-checks (FACT):
- Per-call billing matches the sum of the asset durations. `voice_session.metadata.billing.tts_audio_ms` per call: bcf13aa3 = 83,696 = 15,386 + 24,163 + 21,420 + 22,727; 9ff8d8a6 = 80,561; 1c5befbd = 44,016; 890eb3b6 = 58,775 (each equals its assets' sum). fe6100ca = 16,927 against a single 16,039 ms asset: 888 ms billed with no stored asset.
- Example of a word-level cut (Fish): message 525 is stored as "Claro, me encanta contar historias. Déjame pensar por un" (56 chars). The file is 15.9 s. At the lane's untruncated rate (about 78-88 ms per char, messages 517/519/554), the kept text accounts for about 4.9 s, which matches `played_ms` 4,953.
- Fish played-ms per kept char is 74-91 for every truncated Fish turn, so the word ledger is precise. ElevenLabs: 548 = 65, 552 = 61, **550 = 48**. The sentence-granular ElevenLabs cut over-keeps about 70 chars (about 5.5 s of unheard speech) in 550 (finding 14, cross-ref BE-TTS-08).
- The caller's turns are deliberate interruptions ("Cuéntame una historia", "Habla un poco más rápido", "Un tono más alegre"), not echo.

Silence and onset per asset (FACT; ffmpeg decode; quiet = runs of at least 150 ms at or below -50 dBFS; onset and trailing at a -40 dBFS threshold):

| lane | assets | speech onset after first sample | trailing silence | quiet share | longest internal gap |
| --- | --- | --- | --- | --- | --- |
| Fish drama-3 (Oct 20 calls) | 13 | 92-153 ms | 188-793 ms | 14-26 % | 475-1,299 ms |
| Fish drama-3 (older calls, local) | 3 | 106-168 ms | 491-1,023 ms | 22-25 % | up to 1,123 ms |
| Fish captures (native-01, complete-engine-01) | 2 | 118-119 ms | 770-870 ms | 20 % | 536 ms |
| ElevenLabs v4 Turbo (Oct 20 calls) | 4 | 71-86 ms | 146-343 ms | 9-18 % | 270-505 ms |
| ElevenLabs v4 Turbo (older calls, local) | 3 | 26-70 ms | 193-262 ms | 12-15 % | 323-521 ms |

---

## 3. Question 2 in detail: where the "missing" files are

FACT:
- The DB rows say `storage_backend='local_fs'`, `storage_path='2026/10/<job>/<asset>.mp3'` and `deleted_at IS NULL` for all 17.
- **Local storage.** In `/home/andres/PycharmProjects/magic-worlds-api/.tts_storage`:
  - None of the 17 job directories exist.
  - `2026/10` has mtime `2026-10-17 21:29:43 -0600`.
  - The newest file is from `2026-10-17 21:36 -0600`.
  - The root mtime `2026-10-20 15:48:43` is the startup write probe (`tts_generation/storage.py:169-177`, run by `main.py:867-873`) when the local uvicorn worker (PID 1603372) reloaded at 15:48:40.
  - Creating or removing a job directory would have bumped `2026/10`'s mtime, so the local BFF never wrote them. Nothing local deleted them either: every delete path in §1.3 is manual or unrelated.
- **Local BFF environment.** The local BFF (PID 45106 / worker 1603372, `uvicorn main:app --port 8010`, `PYTHONPATH` includes `src/`) has `TTS_STORAGE_ROOT=/home/andres/PycharmProjects/magic-worlds-api/.tts_storage` and `MYSQL_HOST=192.168.1.90` (`/proc/<pid>/environ`).
- **The `.90` storage.** All 17 files exist at `/home/andres/server/RAID5/magic_worlds_api/.tts_storage/2026/10/<job>/<asset>.mp3`, which is `root@192.168.1.90:/media/RAID5/magic_worlds_api/.tts_storage/...` over sshfs. Their sizes equal `tts_asset.file_size_bytes`, and the meter duration of each file equals `tts_asset.duration_ms`.
- **DB clients.** `information_schema.PROCESSLIST` shows 10 connections to `magic_worlds` from `192.168.1.90` and 3 from this host (one of them was the audit query).
- **Roadmap.** `docs/voice_refactor/00_current_status_and_roadmap.md:78` (V-02) records the BFF and SPA deployed together on `.90`. `:86` (V-09) already notes that "one captured MiniMax asset is on the storage of the API instance that generated it, outside the local `TTS_STORAGE_ROOT`".

INFERENCE: the 7 calls went through the `.90` deployment. It writes to its own disk and shares the MySQL schema with the local dev BFF. Any request served by the local BFF (for example the SPA on `localhost:5173` with `VITE_API_BASE_URL=http://{hostname}:8010`) resolves the same `asset_id`, finds no file under its own root and answers 404. Call history (`CallTranscriptView`) and chat narration of those calls then show "audio could not be loaded" with a "Try again" button that can never succeed. FACT for the code path (`routes/tts.py:78-92`, `:120-128`; FE `CallTranscriptLines.tsx:55-71`). The request was not executed, because doing so needs a user bearer token.

Persist timing on `.90` (FACT, 1-s resolution): the file mtime precedes `tts_asset.created_at` by 0-5 s (median 2 s; 4 s, 3 s and 5 s on three turns). The gap covers fsync on `/media/RAID5`, the job, update and asset statements, and anything that kept the event loop or the default thread pool busy. Finding 01 shows why this matters.

---

## 4. Question 3 in detail: chunk size, cadence, priming and timeline

### 4.1 Frame maths in `mp3_frames.py` (FACT, verified)

| Item | Code | Value / check |
| --- | --- | --- |
| Header parse | `mp3_frames.py:88-119` | Rejects a reserved version, a non-Layer III frame, free-format or bad bitrate, a reserved sample rate and reserved emphasis |
| Frame length | `:111-118` | MPEG-1: `144*bitrate//sr + padding`, 1152 samples. MPEG-2/2.5: `72*bitrate//sr + padding`, 576 samples (correct for Layer III) |
| Duration | `:46-48` | `Fraction(samples*1000, sample_rate)`: exactly 26.1224… ms at 44.1 kHz MPEG-1 |
| Bytes per frame | derived | 64 kbps: 208.98 → 208/209 B. 128 kbps: 417.96 → 417/418 B |
| `MAX_FRAME_BYTES` | `:21-23` | 1441 = 144·320000/32000 + 1 (and MPEG-2.5 160 kbps at 8 kHz). Correct |
| ID3 handling | `:122-137`, `:158-167` | ID3v2 (with footer flag) and ID3v1 `TAG` are skipped at a frame boundary, including when split across slices (`skip_bytes`) |
| Resync | `:178-204` | After lost sync a candidate frame counts only if the next header matches its signature, or it ends exactly at EOF when `final` |
| Signature lock | `:43-44`, `:169` | Version + sample-rate index are locked per stream. Bitrate and channel mode are not (fine for CBR) |
| Meter | `:226-263` | `Mp3FrameMeter.take` sums exactly and rounds the cumulative total (`round_ms` half-up, `:215-217`), so the readings always add up to the stream's rounded duration. A partial tail is carried and dropped on `final` |
| Xing/Info/VBRI/LAME | none | Not recognised. A header frame would count as 26 ms of audio (finding 10) |
| Encoder delay/padding | none | Not parsed or trimmed (there is no LAME tag to read anyway, §4.3) |

### 4.2 Chunk size and cadence

**Fish** (FACT; capture `.dev/fish-call-contract/2026-10-15/packet-*.msgpack`; one native request, two sentences, 6,949 ms):

| pkt | chunk_seq | cumulative provider `audio_duration` (ms) | bytes | starts on a frame header? | whole frames metered | `time` field |
| ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1 | 0 | 464.4 | 7,028 | yes (`fffb90c4`) | 16 (418 ms) | 104.7 |
| 2 | 0 | 928.8 | 7,681 | no | 19 | 154.5 |
| 3 | 0 | 1,486.1 | 8,631 | no | 20 | 211.6 |
| 4 | 0 | 2,786.4 | 20,896 | no | 50 | 371.4 |
| 5 | 0 | 2,786.4 (unchanged) | 7,483 | no | 18 | 476.9 |
| 6 | 1 (offset 2,786.4) | 928.8 | 7,521 | no (`00011800`) | 18 | 521.1 |
| 7 | 1 | 1,486.1 | 9,066 | no | 22 | 578.0 |
| 8 | 1 | 2,972.2 | 23,565 | no | 56 | 743.1 |
| 9 | 1 | 4,086.7 | 17,560 | no | 42 | 880.0 |
| 10 | 1 | 4,086.7 (unchanged) | 1,745 | no | 5 | 880.4 |
| 11 | `finish` | | | | | 880.4 |

Observations:
- The concatenated packets are byte-identical to `native-01.mp3`. The format is MPEG-1 Layer III, 44.1 kHz, mono (channel mode 3), bitrate index 9 (128 kbps) on every frame, 266 frames = 6,949 ms, no ID3, no Xing/Info.
- The provider's `chunk_seq` labels do not match the byte timeline. Packet 5 is labelled chunk 0 with an unchanged duration, but its bytes (about 468 ms) are the start of sentence 1: cumulative bytes reach 3,232 ms of frames while sentence 1 starts at a provider offset of 2,786 ms. Packet 6's cumulative bytes (3,702 ms) match 2,786 + 929. Timing therefore has to use `chunk_audio_offset + word.start`, which the word ledger does (`word_timing.py:190-191`), and never per-packet labels. FACT.
- Generation speed: in `native-01-report.json`, `first_audio_ms` is 1,686 and `elapsed_ms` is 2,516, so about 830 ms elapse between first audio and finish for 6.95 s of audio, about **8.4x real time**. INFERENCE: this assumes the `time` field is in ms and that this capture is representative; its 104.7 → 880.4 span (776 ms) agrees.
- Packet interval is 44-165 ms while generating.
- `complete-engine-01` (the engine path, `accepted_audio_chunks: 10`, `first_accepted_audio_ms: 927`, 260 frames = 6,792 ms) shows the same pattern.
- **Real calls on Oct 20** (`voice_transcript_segment.tts_summary.audio_chunks` of the user row, against the asset size): 15-29 chunks per turn, averaging 8.3-15.6 KB = 0.52-0.97 s of audio per chunk (base64 JSON is about +33 %: 11-21 KB per WS frame).

**ElevenLabs** (FACT for the format; chunk sizes from real-call aggregates; no per-packet ElevenLabs capture exists in the repo):
- `mp3_44100_64` (`capabilities.py:65`, `:159`; `types.py:89-90`).
- Stored call assets: MPEG-1 Layer III, 44.1 kHz, mono, bitrate index 5 (64 kbps CBR), one leading ID3v2 tag, no Xing/Info, 0 skipped bytes.
- Oct 20 calls: 30-51 chunks per turn, averaging **2.3-3.1 KB = 290-385 ms** per chunk (about 3.1-4.1 KB base64 per WS frame).
- Whether ElevenLabs chunks are frame-aligned is UNKNOWN. The ledger handles either case (`call_ledger.py:254-259` carries the partial frame).

### 4.3 Encoder priming, Xing/LAME, per-sentence restarts

- No Xing, Info, VBRI or LAME-tag frame appears in any of the 9 call streams inspected: 4 ElevenLabs on `.90`, 3 ElevenLabs local, Fish captures, 13 Fish on `.90`, 3 Fish local. Checked by parsing the side-info offset of every frame. "LAME" strings appear only inside ancillary data of quiet frames: both providers' encoders are LAME-based (INFERENCE), and LAME writes its version string into unused reservoir bits. FACT.
- There is **no mid-stream ID3 tag and no garbage byte** in any per-turn file (`scan_mp3_frames(...).skipped_bytes == 0` for all 23). So within a turn each provider produces **one continuous MP3 stream**. ElevenLabs `flush: true` per sentence does not start a new MP3 file: there is no new ID3 and no header frame. FACT. Whether the ElevenLabs encoder state is reset internally is UNKNOWN. If it were, it would show as a short exact-zero run at each boundary.
- Exact-digital-zero runs (|sample| ≤ 1) in the decoded PCM:
  - Fish has one leading run of 51-53 ms at t=0 (encoder delay of about 1,105 samples plus decoder delay of 529 samples ≈ 37 ms, plus a model lead-in). Mid-stream there is nothing longer than about 10 ms, so **no per-sentence priming**. The 0.5-1.3 s inter-sentence pauses are low-level model silence, not digital zeros.
  - ElevenLabs has a leading run of 8-26 ms and **mid-stream runs of 33-277 ms** at roughly sentence intervals (asset `709e494b`: 169 ms at 2.02 s and 160 ms at 3.99 s; `7eede6a3`: 277 ms at 7.86 s). INFERENCE: provider-side silence padding around each flushed generation, not MP3 codec priming. Without a packet capture with per-chunk alignment, the boundary attribution stays UNKNOWN.
- Consequence for MSE: nothing in the byte stream makes the browser insert or trim samples between sentences. The pauses the user hears are in the audio itself, and both timelines count them identically.

### 4.4 Do the server meter and the client clock share a timeline?

**Server.**
- `CallTurnLedger.delivered_ms` is the exact sum of whole-frame durations of the bytes delivered so far for the turn, ID3 skipped (`call_ledger.py:242-259`).
- ElevenLabs offsets use `chunk_start = self._delivered` (whole frames before the chunk) plus the provider's chunk-relative `char_start_times_ms` (`:254`, `:277-295`). The error is at most 1 frame (26 ms) per chunk and does not accumulate, because `_delivered` is recomputed from bytes.
- Fish uses provider `chunk_audio_offset + word.start/end` (`word_timing.py:186-205`). Against the decoded file, "encendida" ends at 2.40 s (provider) and quiet starts at 2.393 s (PCM). The second sentence starts at provider 2.866 s and PCM about 2.93 s. Agreement is within about 60 ms (FACT, capture). `keep_end` uses `min(played_ms, delivered_ms)` (`word_timing.py:207-220`; `call_ledger.py:380-392`).
- The flush gate's `played_ms()` clamps the client report to `delivered` (`call_tts_elevenlabs.py:150-158`).

**Client.**
- `startTurn` → `setupMediaSource()` builds a **new MediaSource per turn**, `addSourceBuffer('audio/mpeg')` (FE `voicePlaybackBuffer.ts:155-162`, `:316-355`, `:348`). The mode is not set explicitly.
- Per the MSE byte-stream registry, MPEG audio sets the "generate timestamps" flag. The SourceBuffer runs in **sequence mode**: frames get contiguous timestamps from 0, computed from frame sample counts.
- `playedMs()` = `playedBeforeGroupMs + audio.currentTime*1000` (FE `:147-153`, `:311-314`).
- It is reported every 500 ms (FE `useVoiceCallController.ts:150`, `:492-499`) and in the barge-in frame (FE `:644-660`).
- Blob fallback: each group is cut at a whole-frame boundary (FE `:422-436`, `:786-800`). `currentTime` restarts per group and is accumulated on `ended` (FE `:516-524`).

**Verdict.** Yes, both sides count the same frames from the same first frame of the turn. FACT for the code. INFERENCE for the browser-internal behaviour. Residual skew:
- (a) MP3 encoder and decoder delay (about 37 ms at 44.1 kHz) is not trimmed by either side. Provider word times are in pre-encode PCM time, so a word counts as heard at most about 40 ms early. Negligible.
- (b) The ElevenLabs chunk-start quantization is at most 26 ms.
- (c) The Blob fallback adds per-group decoder restarts and `src` swap gaps. These are audible gaps, but `currentTime` does not advance during them, so the timeline stays frame-based.
- (d) The output-device latency (Bluetooth 100-300 ms) is not subtracted, so `currentTime` can lead what was physically heard. UNKNOWN per browser.
- (e) **The dominant error is not the timeline.** It is the barge-in detection lag: `played_ms` is read when the client VAD fires (FE `useVoiceCallController.ts:644-660`), several hundred ms after the user started talking (cross-ref fe-capture). It is also the ElevenLabs sentence-granular keep (finding 14).

---

## 5. Configuration and defaults

| Setting | Value | Where |
| --- | --- | --- |
| ElevenLabs call output | `mp3_44100_64` (44.1 kHz, 64 kbps, mono) | `speech/capabilities.py:65`, `:159`; `speech/types.py:89-90` |
| ElevenLabs call model / transport | `el_v4_turbo` over `ttd_ws` (text-to-dialogue multi-stream), `sync_alignment=true` | `capabilities.py:159`; `tts_multicontext_ws.py:236-248` |
| ElevenLabs per-sentence send | `{"inputs":[{"text": sentence+" "}], "flush": True}` | `tts_multicontext_ws.py:638-641` |
| Fish call output | `format mp3, sample_rate 44100, mp3_bitrate 128, chunk_length 100, latency 'balanced'` | `fish_audio/timestamp_ws.py:210-212` |
| Fish envelope check | whole frames only; 44.1 kHz, mono, bitrate index 9, else contract error | `fish_audio/stream_mp3.py:13-38` |
| Flush-ahead gate | 3 free sentences; then `< 3` unheard and `< 8,000 ms` ahead; playback-estimate lag 500 ms; recheck 0.25 s | `call_tts_elevenlabs.py:55-59`, `:150-167` |
| Billing cadence | each sentence start or every 2,000 ms of delivered audio | `engine.py:117`, `:2507-2508` |
| Credit unit | 10 s of (STT + TTS) audio per credit | `engine.py:81`, `:3389-3402` |
| Truncation window grace | `delivered + 2,000 ms` after `voice_audio_final` | `engine.py:105-108`, `:1337-1352` |
| Truncation write wait | 3.0 s | `engine.py:108`, `:1644-1667`, `:1669-1683` |
| Playback reports | client every 500 ms; server accepts at most 4 per second | FE `useVoiceCallController.ts:150`; `engine.py:119` |
| Asset path | `{UTC %Y}/{%m}/{job_id}/{asset_id}.mp3` under `TTS_STORAGE_ROOT` | `tts_generation/storage.py:129-131` |
| Asset write | SHA-256 in a thread, `mkstemp` + write + `fsync` + `os.replace` in a thread, uninterruptible | `tts_generation/storage.py:132-133`, `:239-283` |
| Asset metadata | `duration_ms` (whole frames), `sample_rate`, `channels=1`, `bitrate=None` | `engine.py:4075-4084`, `:4118-4130` |
| Orphan sweep | manual inspect/preflight/apply; 7-day cutoff; batches of 500 | `voice_orphan_sweep.py:84-90`, `:284-287` |
| ElevenLabs history sweep | off by default; deletes provider history at 24 h | `speech/ops/history_sweep.py:52-62` |
| Local dev env | `TTS_STORAGE_ROOT=/home/andres/PycharmProjects/magic-worlds-api/.tts_storage`, `MYSQL_HOST=192.168.1.90` | `magic-worlds-api/.env:12`, `:32` |

---

## 6. Latency contributions owned by this subsystem

Critical path is "user stops speaking → first audio heard", plus the next-turn path where noted.

| # | Stage | Estimate (ms) | Evidence | Notes |
| --- | --- | --- | --- | --- |
| A1 | Fish whole-frame re-framing hold | 0 on the first chunk (it carries 16 whole frames); ≤ 26 per later packet | `stream_mp3.py:13-38`; capture pkt 1 | negligible |
| A2 | base64 + JSON framing | < 1 CPU; +33 % bytes (Fish first chunk 7.0 → 9.4 KB) | `delivery.py:445-466` | negligible on LAN |
| A3 | **Leading silence before speech onset in provider audio** | Fish 92-153 (13 Oct-20 assets), ElevenLabs 71-86 | §2 silence table | Audible delay that is **not** in `voice_first_assistant_audio`, which marks the first chunk (`engine.py:2457-2470`, `:2885-2910`) |
| A4 | MP3 codec priming (subset of A3) | about 37 at 44.1 kHz | exact-zero leading runs: Fish 51-53, ElevenLabs 8-26 | not trimmed by server or client |
| A5 | First billing write | 0 on the first chunk (sent before billing); 5-30 per later bill | `engine.py:2457-2508` | cross-ref BE-ENGINE-TURNTAKING-16 |
| B1 | **Previous turn's post-end work before the next turn's LLM starts** | 0 to about 5,000+ observed (1-s resolution); file→row 0-5 s on the `.90` RAID5 | `engine.py:2068-2074`, `:2701-2760`; `storage.py:239-283`; §3 timing | finding 01 |
| B2 | `_settled_truncation` before persist | 0-3,000 | `engine.py:1644-1667`, `:2724-2725` | serial inside B1 |
| B3 | Mid-stream turn finish write | 0-3,000 (bounded) | `engine.py:1489-1503` | serial inside B1 on the barge-in path |
| C1 | Trailing silence at reply end (perceived turn yield) | Fish 188-793 (Oct 20), up to 1,023 older; ElevenLabs 146-343 | §2 | the user waits through dead air before the character "finishes" |
| C2 | Inter-sentence pauses | Fish gaps up to 1.3 s (quiet 14-26 %); ElevenLabs gaps up to 0.5 s | §2 | pacing |

---

## 7. Findings

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-01: The previous turn's audio persistence (fsync'd file write plus DB) blocks the next turn's reply (high, latency; confidence medium)

**FACT (code).**
- `accept_segment` claims `current_turn` and, when the previous turn has not finished, runs `_supersede_heard_prefix` and `_cancel_turn` and then `await previous.finished.wait()` (`engine.py:2065-2074`). This happens after the new segment's STT (`:2228`, `:2275-2284`).
- `_cancel_turn` is a no-op once `end_published` (`engine.py:1957-1959`). `previous.finished` is set only in the `finally` of the previous `accept_segment` (`:2106-2110`).
- That comes after the previous turn's whole post-end sequence:
  - `_finish_mid_stream_turn` (≤ 3 s, `:1489-1503`)
  - final billing (`:2648-2650`)
  - `voice_audio_final` and `voice_turn_end`
  - `_settled_truncation` (≤ 3 s, `:2724-2725`)
  - `_persist_assistant_call_turn`: MP3 scan, SHA-256, `mkstemp`/write/`fsync`/`replace`, a 3-statement DB transaction, segment insert and message link (`:2730-2746`, `:3469-3591`, `:4046-4135`; `tts_generation/storage.py:239-283`)
  - `update_segment` (`:2747-2755`).

**FACT (data, `.90` deployment, 1-s timestamps).**
- The file mtime precedes `tts_asset.created_at` by 0-5 s (median 2 s).
- In 6 of 13 turn transitions, the next user segment's STT had completed (`completed_at`) **before** the previous turn's asset row existed. Measured as previous `tts_asset.created_at` minus next user STT completion: +5 s (bcf13aa3 seq 1→2), +1, +1, +1, +4 (1c5befbd 3→4), +2 (890eb3b6 3→4).

**INFERENCE.** In those transitions the reply to the user's interruption started 1-5 s late. The interruption reply is the one most sensitive to latency.

- Impact: seconds of dead air right after a barge-in on a deployment whose storage is slow (HDD RAID5 over `/media/RAID5`). E2E-LATENCY-TRACE-07 rated this low on the assumption that storage is fast; the deployed data says otherwise.
- Recommendation:
  - Move asset archival off the turn's critical path. Publish `finished` (or let the next turn proceed) right after `voice_turn_end` and the truncation decision.
  - Write the MP3 and the asset rows in a background task with idempotent retry. The next turn needs only the stored **text** (already committed by the executor or the truncation write).
  - Drop `fsync` for call archives, or write to object storage asynchronously.
  - Add a per-turn `persist_ms` timing to `voice_turn_finalized`.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-02: Stored call audio contains the unheard tail; the transcript holds only the heard prefix (medium, correctness/UX; upgrades BE-ENGINE-TURNTAKING-15)

- FACT:
  - The asset audio is every delivered byte: `assistant_audio.extend(data)` for `SENT`/`DROPPED` (`engine.py:2489-2496`), then `complete_audio = bytes(assistant_audio)` (`:2714`).
  - The transcript is `truncation[1]` when a cut was decided (`:2722-2726`).
  - Data: 12 of 17 turns truncated. Assets are 1.08-3.21x longer than what played. 97.0 s of 283.1 s (34 %) was never heard (§2).
  - `voice_transcript_segment.duration_ms` and `tts_segments.duration_ms` carry the full length (`:3520-3538`, `:3555`).
  - The history payload exposes the text and the full `duration_ms` with no `played_ms` (`route_voice_call.py:1284-1314`).
- Impact:
  - Call history and chat narration replay 0.6-16.5 s of speech that is in neither the transcript, the LLM's history nor the user's experience.
  - The displayed clip duration is wrong.
  - Text and audio disagree for most interrupted turns. Interruptions are the normal case in this sample.
- Recommendation:
  - Trim the stored MP3 to the frame boundary at or after the kept text's end (Fish word end or ElevenLabs entry `audio_end_ms`), or at `played_ms`. The frame meter already gives exact frame offsets. Cutting the *tail* of a CBR Layer III stream is safe: the bit reservoir only points backwards.
  - Alternatively, store `played_ms`/`heard_ms` on the segment and the asset and have the players stop there.
  - SOTA: OpenAI Realtime `conversation.item.truncate(audio_end_ms)` drops both the unheard audio and its transcript. LiveKit and Pipecat keep only the synchronized spoken text.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-03: A late truncation updates the message but not the segment, asset or narration sidecar (medium, correctness)

- FACT:
  - `truncate_call_turn` updates only `adventure_message` (`call_turn_truncation.py:157-172`).
  - The truncation window stays open after `voice_turn_end` (`engine.py:1337-1352`, `:2713`), while `_persist_assistant_call_turn` has already run with the untruncated text (`:2724-2746`). Nothing re-patches `voice_transcript_segment.transcript_text`, `tts_job.input_summary.text_length_chars` (`:4093-4099`) or `metadata.tts_segments`.
  - Data: 4 of 17 turns (513, 523, 541, 548) have a segment transcript longer than the message: 211 vs 92, 84 vs 79, 111 vs 91, 122 vs 74.
- Impact: call history (segment text) shows text the chat (message text) and the LLM (message content) do not have. Same call, two different "truths". This is the V-07 "known limitation" (`00_current_status_and_roadmap.md:83`), but it is not rare: 4 of 12 truncations hit it, because fast synthesis ends the turn on the server while the client is still playing.
- Recommendation: apply truncations to all four stores in one transaction (message, segment, tts_segments, asset or job summary). Better, persist the asset only after the truncation window closes (playback reached `delivered_ms`, or end plus grace), which also enables trimming (finding 02).

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-04: Users are billed, and provider spend is incurred, for audio that was never played; over-synthesis comes from the "3 free sentences" rule (medium, cost)

- FACT:
  - Billing uses delivered whole frames (`engine.py:2345-2362`, `:2496`, `:2507-2508`, `:3378-3440`).
  - `voice_session.metadata.billing.tts_audio_ms` equals the sum of asset durations (§2). So **about 34 % of billed TTS seconds** in this sample (97 of 284 s; about 31 % of all billable audio including STT) were unplayed audio.
  - The gate lets sentences 0-2 through unconditionally (`call_tts_elevenlabs.py:55-57`, `:160-162`). Only the 4th sentence onwards is held by `< 3 unheard` and `< 8,000 ms ahead` (`:163-167`).
  - Fish synthesizes about 8x real time (§4.2), and Fish sentences with their pauses run 3-8 s. Delivered-minus-played at barge-in reached 16.5 s (515), 10.9 s (525) and 10.8 s (543).
- Impact:
  - Users pay credits for unheard speech. That is defensible as provider cost pass-through but invisible to them.
  - The provider spend (ElevenLabs characters, Fish units) for the tail is wasted.
  - It also feeds findings 02 and 03.
- Recommendation:
  - Make the gate duration-based from sentence 0: for example, at most 3-4 s of audio ahead of `played_ms` once the first sentence is playing, keeping 1 free sentence for TTFA.
  - Decide product-wise whether to bill delivered or heard audio (for example `min(delivered, played + 1 s)` on truncated turns), and document it.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-05: Per-instance `local_fs` storage plus a shared DB makes rows point at files only the writing instance can serve (medium, scalability/robustness)

- FACT:
  - The asset row stores only `storage_backend='local_fs'` and a root-relative path, with no host, volume or bucket identity (`tts_generation/storage.py:23-33`, `:129-146`; `engine.py:4118-4130`).
  - Serving resolves it under the **serving** instance's root and answers the same 404 for "file missing" as for "not yours" (`routes/tts.py:78-92`, `:110-128`).
  - Data: the 17 Oct-20 assets exist only on `.90` and are absent from the local root of a BFF that uses the same DB (§3).
- Impact:
  - Every BFF except the writer (a second replica, a dev BFF on the shared DB, a host migration, a restored DB on new hardware) silently serves 404 for call audio.
  - The orphan sweep run on the wrong host would also see "row without file" and "file without row" inconsistencies.
  - Single-instance production (V-12) masks it today.
- Recommendation:
  - Use object storage (S3/GCS/MinIO) or one shared mounted volume for `TTS_STORAGE_ROOT` across instances. Record a `storage_location` or bucket id on the row.
  - Add a startup or periodic consistency probe (sample N recent rows and `stat` them) and a distinct log or metric for "row present, file missing".
  - For dev, do not point a local BFF at a DB that a deployed BFF writes to, or mount the deployed storage read-only as the local root.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-06: Fish (and to a lesser degree ElevenLabs) call audio carries long silences that are neither measured nor trimmed (medium, audio-quality/latency)

- FACT (§2):
  - Fish drama-3 call audio: 92-168 ms of silence before speech onset, inter-sentence gaps up to 1.3 s, 188-1,023 ms of trailing silence, 14-26 % quiet overall.
  - ElevenLabs: 26-86 ms onset, 146-343 ms trailing, 9-18 % quiet.
  - The server's first-audio metric marks the first chunk, not first speech (`engine.py:2457-2470`, `:2885-2910`).
  - Nothing trims leading or trailing silence. Silence is billed (finding 04).
  - In both Oct-20 test sessions (Fish and ElevenLabs) the caller asked the character to "speak faster". This is weak, anecdotal corroboration.
- Impact: about 0.1-0.15 s of audible latency hidden from metrics; slow, "padded" pacing; up to about 1 s of dead air at the end of each reply before the turn feels yielded.
- Recommendation:
  - Measure first-speech onset: an energy threshold on decoded frames server-side, or a client `AnalyserNode`.
  - Drop leading and trailing silent frames per generation before delivery. Frame-level energy can be estimated cheaply from decoded PCM, or with an inline decoder; with PCM or Opus delivery it is trivial.
  - Test Fish `latency: 'normal'` and prosody or speed settings, and multi-sentence flushes (fewer per-flush lead-ins and tails).

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-07: The orphan sweep does not recognise call audio referenced from chat messages (medium, robustness; confidence high)

- FACT:
  - The sweep keeps an asset if `JSON_SEARCH(m.metadata, ..., '$.tts_segments.*.assets[*].asset_id')` matches (`voice_orphan_sweep.py:313-327`) or a `voice_transcript_segment.tts_summary.asset_id` names it (`:289-292`, `:444-458`).
  - The call engine writes the flat shape `tts_segments["0"].asset_id`, with no `assets` array (`engine.py:3540-3556`).
  - Data: for all 17 Oct-20 call assets, the sweep path matches 0 and the flat path matches 17.
- Impact: protection rests solely on the transcript segment. If a segment row is removed while the message stays (any future retention or segment cleanup, a partial purge, a failed `create_segment` after the asset write at `:3500-3538`), a reviewed apply after 7 days deletes audio that the chat still links to. Deletion is irreversible. Reviewer diligence is the only safeguard.
- Recommendation: add `'$.tts_segments.*.asset_id'` to the reference search (and a test with the call shape), or normalise the call sidecar to the chat shape.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-08: The call-content purge's fallback lookup filters a value that never occurs (low, correctness/privacy)

- FACT:
  - `_purge_call_content` adds "extra" call assets by job with `AND j.operation = 'call_character_tts'` (`models.py:22719-22765`).
  - Call jobs are created with `source="call_character_tts"`; `operation` is `text_to_speech` (`engine.py:4086-4100`).
  - Data: `tts_job` operation/source pairs are only `text_to_speech/call_character_tts` (53) and `text_to_speech/chat_tts_request` (29).
  - The primary references still work: segment `tts_summary` (`:22693-22716`) and message `tts_segments` (`:22673-22681`).
- Impact: a call asset referenced by neither (for example a swallowed link failure at `engine.py:3573-3591` plus a missing segment) survives deletion of its chat or call as a live, servable asset.
- Recommendation: filter `j.source = 'call_character_tts'`, and add a test.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-09: A missing file is indistinguishable from a foreign asset, and the UI offers a retry that cannot succeed (low, observability/UX)

- FACT:
  - `download_tts_asset` returns the same 404 for "no row", "not owner", "bad contract" and "file not on disk" (`routes/tts.py:110-128`). It logs only successes (`:129`).
  - The SPA shows "audio load failed" plus "Try again" for any error (FE `CallTranscriptLines.tsx:55-71`; FE `useAuthenticatedMediaUrl.ts:34-54`).
- Impact: the silent loss mode in finding 05 had no signal at all. It took a disk walk to find.
- Recommendation: keep the uniform public 404, but log and count `asset_file_missing` server-side with the asset id and age. In the UI, hide the retry for a definite 404 ("audio unavailable").

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-10: `mp3_frames.py` does not recognise Xing/Info/VBRI header frames or LAME delay/padding (low, robustness; latent)

- FACT: the parser counts every valid Layer III header as audio (`mp3_frames.py:88-119`, `:168-177`). There is no Xing/Info/VBRI or LAME-tag check. No current provider stream has one (§4.3).
- Impact: if a provider or format change adds an Info frame (common in file-oriented encoders), each turn would bill one silent 26 ms frame. The ledger timeline would then sit one frame off from decoders that skip the header. LAME padding at the end would also be billed.
- Recommendation: detect an Info/Xing/VBRI tag in the first frame (side-info offset 17/32 for MPEG-1, 9/17 for MPEG-2) and exclude it from duration. Optionally read the LAME encoder delay and padding for exact durations. Add a fixture test.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-11: Audio accepted while the socket is away is stored and billed but never replayed (low, cost/UX)

- FACT:
  - With `runtime.socket` set to None, `send_audio_chunk` returns `DROPPED` (`delivery.py:265-267`).
  - `deliver` treats `DROPPED` like `SENT`: "Delivered (or accepted while the socket is away): billable and stored" (`engine.py:2486-2496`).
  - There is no replay of a turn's chunks on resume. A grep for replay or resend in the engine finds only an unrelated Fish comment (`:2948`).
- Impact: during a 20 s resume grace the user is billed for, and the history stores, audio they never received.
- Recommendation: do not bill `DROPPED` chunks, or bill them only up to the last `played_ms`. Mark the turn `audio_partial` in its summary.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-12: Asset metadata and metrics miss what is needed to reason about heard audio (low, observability)

- FACT:
  - `tts_asset.bitrate` is NULL for every call asset, because the bitrate is never passed (`engine.py:4075-4084`, `:4118-4130`). `channels=1` is hard-coded.
  - `duration_ms` is the delivered length. There is no `played_ms`, `heard_ms` or first-speech-onset field on the segment, asset or history payload (`route_voice_call.py:1302-1314`).
  - Per-turn chunk count is stored on the *user* segment (`engine.py:2747-2755`), but chunk bytes and timing are not.
- Recommendation: store `bitrate`, `heard_ms`, `onset_ms`, `trailing_silence_ms` and `chunk_count/bytes` per turn. These make the analysis in §2 a query instead of a forensic exercise.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-13: The server meter and the client clock share one frame-based timeline (info; answers the open questions)

- FACT/INFERENCE as in §4.4:
  - Server whole-frame sum from the turn's first frame: `call_ledger.py:242-259`; `mp3_frames.py:226-263`.
  - Client: a new `MediaSource` per turn with an `audio/mpeg` SourceBuffer (generate-timestamps, so sequence mode); `played_ms = currentTime` (FE `voicePlaybackBuffer.ts:147-153`, `:316-355`).
  - Skew is under 40 ms (codec delay not trimmed, at most 1-frame chunk quantization).
  - There is no per-sentence encoder priming and no Xing/LAME frame in any stream inspected.
- This answers:
  - be-route-transport Q5 (chunk sizes, cadence, bitrate)
  - fe-playback-transport Q1 (first and subsequent chunk sizes) and Q2 (per-flush encoder restart, micro-gaps under sequence mode)
  - be-tts Q9 (MSE side; PCM/Opus remains a product choice)
  - fe-ui Q4 (alignment for captions is on the same timeline, so forwarding it is sound).
- Residual accuracy limits are barge-in detection lag and the ElevenLabs sentence-granular keep, not the timeline.

### GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-14: Real data confirms the ElevenLabs sentence-granular keep over-keeps (info; cross-ref BE-TTS-08)

- FACT:
  - `CallTurnLedger.keep_end` keeps the span end of the last sentence whose audio *started* before `played_ms` (`call_ledger.py:380-392`). The Fish word ledger cuts at the last word whose *end* is at or before `played_ms` (`word_timing.py:207-220`).
  - Data: Fish truncated turns keep text at 74-91 played-ms per char, matching the untruncated rate. ElevenLabs 550 keeps 190 chars for 9,070 ms played (48 ms per char against about 78 for untruncated ElevenLabs), so about 70 unheard chars are stored as "said".
- Recommendation: as in BE-TTS-08, use the per-character alignment that is already parsed (`call_ledger.py:277-295`) to cut ElevenLabs at the word.

---

## 8. Strengths (balanced view)

- **Exact, slice-proof metering.** `mp3_frames.py` uses `Fraction` arithmetic, carries partial frames, skips ID3 across slices and resyncs with next-header confirmation. Billing readings sum exactly to the stream's rounded duration however the chunks are split (`mp3_frames.py:140-263`). Verified: meter = DB `duration_ms` = billed `tts_audio_ms` on all 17 assets.
- **Fail-closed Fish envelope.** Unaligned provider packets are re-framed into whole frames, and any change of rate, mode or bitrate is a contract error rather than garbage audio (`stream_mp3.py:13-38`).
- **Safe file writes.** Path containment, a segment allow-list, SHA-256 and atomic `mkstemp`/`fsync`/`replace` in a worker thread, with cancellation-safe cleanup (`tts_generation/storage.py:97-283`). There is also a startup write probe (`main.py:867-873`).
- **Owner-only serving with a uniform 404** (no enumeration oracle) and lazy, viewport-gated loading in the SPA.
- **Word-level truncation on Fish** matches what was heard, and the data confirms it (§2).
- **One shared timeline.** Server and client count the same frames from the same origin, so truncation accuracy is not limited by clock drift.
- **Auditable billing.** Billing state is persisted per call (`engine.py:3441-3455`), which is what allowed the exact cross-check in §2.
- **Reviewed, fingerprinted, 7-day-grace orphan sweep** that never deletes rows a transcript references and never touches previews or samples.

---

## 9. Open questions / UNKNOWN

1. The exact persist-time distribution on the `.90` deployment (fsync on `/media/RAID5`, DB statement time, event-loop or thread-pool contention). Timestamps here have 1-s resolution, so per-step timing should be added.
2. Do Chrome, Safari (ManagedMediaSource) and Firefox MSE trim the MP3 decoder delay (529 samples)? This only affects the about 40 ms skew budget.
3. Are the ElevenLabs mid-stream exact-zero runs (33-277 ms) per-flush generation padding? A packet capture with per-chunk alignment would settle it. Are ElevenLabs chunks frame-aligned?
4. What causes the Fish inter-sentence gaps (0.5-1.3 s): per-unit flush segmentation, drama-3 prosody, or `[short pause]`/`[long pause]` cues from the performance plan (`performance_compiler.py:22-23`, `:217`)?
5. Product decisions: bill delivered or heard audio; should history replay the full reply, the heard prefix only, or the full reply with a "not heard" marker?
6. Call `890eb3b6` ended `failed/internal` at 22:24:07, the same second its last asset row was written. The `.90` logs are needed to tell whether the failure followed persistence.
7. Production topology (V-12): will more than one BFF instance or a storage migration ever exist? That decides how urgent finding 05 is.
8. Should older call assets whose adventures are gone (36 rows from Oct 14-18, `adventure_gone`) be swept now, and on which host's storage?

---

## 10. Comparison with state-of-the-art practice

| Practice | SOTA reference | Here |
| --- | --- | --- |
| Truncate stored audio and transcript to what was played | OpenAI Realtime `conversation.item.truncate(audio_end_ms)`; LiveKit Agents keeps the synchronized spoken text on interruption; Pipecat keeps only spoken words via TTS word timestamps | Transcript truncated (word-level for Fish, sentence-level for ElevenLabs); **audio never truncated** (02); late truncations do not propagate (03) |
| Media archival off the realtime path | write-behind queues, object storage, async upload | Archival is serial before the next turn (01) |
| Shared or object storage for multi-instance | S3/GCS keys on the row, any instance serves (or signed URLs) | per-instance `local_fs` (05) |
| Pace synthesis to playback | stream TTS just ahead of playback; small lookahead (a few seconds) | 3 free sentences + 8 s; up to 16.5 s ahead observed (04) |
| Low-latency wire codec | PCM16 or Opus frames (20 ms), no priming, trivially trimmable | MP3 44.1 kHz in base64 JSON. Works with MSE and has one shared timeline, but carries priming and silence and needs frame-aware trimming |
| Measure first *audible* speech | client playout marks plus onset detection | the server marks the first chunk only (06, 12) |
| Trim TTS leading and trailing silence | common post-processing for conversational TTS | none (06) |

---

## Appendix A: how the evidence was produced (all read-only)

- SQL (session `SET SESSION TRANSACTION READ ONLY`, PyMySQL from the BFF venv, credentials read from `magic-worlds-api/.env` and never printed):
  - The assistant segments joined to `tts_asset`, `voice_session` and `adventure_message` (`CHAR_LENGTH(content)`, `metadata.voice.{truncated,played_ms}`)
  - `voice_session.metadata.billing`
  - user segments' `tts_summary.audio_chunks` and `completed_at`
  - `tts_job` `operation`/`source` counts
  - sweep reference checks with both JSON paths
  - `information_schema.PROCESSLIST` by host
- Disk:
  - `stat` and `find -newermt` on the local `.tts_storage`; `findmnt` on `/home/andres/server/RAID5`
  - existence and size of the 17 files on the `.90` mount
  - `/proc/<pid>/{cmdline,cwd,environ}` of the local BFF (only `TTS_STORAGE_ROOT` and `MYSQL_HOST` were read)
- Audio:
  - Frame parsing with the project's `src.services.speech.mp3_frames` (`scan_mp3_frames`, `parse_frame_header`, `Mp3FrameMeter`).
  - Xing/Info detection at the side-info offset.
  - `ffmpeg -f s16le -ac 1 -ar 44100` decode to find exact-zero runs (|x| ≤ 1, ≥ 300 samples), quiet runs (|x| ≤ 100 ≈ -50 dBFS, ≥ 150 ms), and onset and trailing silence (|x| > 328 ≈ -40 dBFS).
- Captures: msgpack decode of the Fish packets (fields `event`, `audio`, `chunk_seq`, `chunk_audio_offset_sec`, `alignment.segments`, `alignment.audio_duration`, `time`).
- Analysis scripts live in the session scratchpad. No repository file was modified apart from this note.

---

## Verification (adversarial)

An independent pass tried to refute findings 01-07. It re-read the cited code in `magic-worlds-api` and the SPA. It re-ran read-only SQL on `magic_worlds` at `.90` (`START TRANSACTION READ ONLY`). It stat'ed the asset files on the `.90` sshfs mount and decoded 5 assets with `ffmpeg`. No source file was modified.

| id | verdict | corrected severity | evidence / note |
| --- | --- | --- | --- |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-01 | confirmed | high | **Code.** `engine.py:2065-2074`: after STT and the `completed` segment update (`:2275`), the new turn awaits `previous.finished`. `_cancel_turn` and `_supersede_heard_prefix` are no-ops once `end_published` (`:1959`, `:1430`). `finished` is set only in the `finally` at `:2109`, after `_settled_truncation`, persist, link and `update_segment` (`:2690-2755`).<br>**Data.** Previous `tts_asset.created_at` minus next user `completed_at` (STT done) is +5 (513→seg 2), +1, +1, +4, +2. That is 5 of 13 transitions, plus 2 same-second ties; the note's "6 of 13" over-counts by one. The stronger evidence is that the next turn's user message is created exactly when the previous assistant message gets its last update, the audio link: 514 at 21:40:06 against STT 21:40:01; 544 at 22:21:46 against 22:21:42; 553 at 22:23:35 against 22:23:33. Untouched transitions go from STT to user message in 0 s (518, 524, 526, 542, 549).<br>**Correction.** Part of the wait is the cancel and truncation settle, not only fsync and DB. In 543, STT finished at 22:21:42, the file was written at 22:21:44 and the row at 22:21:46. The file-to-row gap on the 6 sampled files is 0-4 s. The "3-statement" transaction is also an under-count: `create_pending_job` issues several statements. |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-02 | confirmed | medium | `engine.py:2489-2496` extends `assistant_audio` for SENT and DROPPED chunks. `:2714` stores all of it. `:2726` uses `truncation[1]` as the transcript. `:3520-3555` set segment and `tts_segments` `duration_ms` to the full length. `route_voice_call.py:1284-1314` exposes `text` and the full `duration_ms` with no `played_ms`. The SPA never uses a stored `played_ms` to stop replay: a grep finds it only in the live socket and controller. Re-queried data matches §2 exactly: 12 of 17 truncated, ratios 1.08-3.21, 97,003 of 283,087 ms (34.3 %) unheard, and 525 with 56 chars, 4,953 ms played and a 15,882 ms file. |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-03 | adjusted | medium | The core is confirmed. `call_turn_truncation.py:149-172` updates only `adventure_message`. `_truncation_window_open` (`engine.py:1337-1352`) has no `audio_persisted` check, and `_barge_in_target` (`:1355-1366`) still targets `last_turn` after persist. The 4 mismatches are confirmed (513 211/92, 523 84/79, 541 111/91, 548 122/74). The message `updated_at` falls after the asset row in 523 (21:53:25 vs 21:53:19) and 541 (22:21:23 vs 22:21:20).<br>**Detail wrong.** Only `voice_transcript_segment.transcript_text` holds the full text. `tts_job.input_summary` holds `text_length_chars` and `text_sha256`, plus `normalized_text_sha256` on the job. `tts_segments` holds no text, only the full `duration_ms`. |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-04 | confirmed | medium | Billing feeds delivered frames into `tts_meter` (`engine.py:2496`, `:2507-2508`, `:2345-2362`) through `_record_billable_audio` (`:3378-3440`). Nothing refunds or adjusts after a truncation. Gate: `FLUSH_AHEAD_FREE_SENTENCES=3`, `MAX_SENTENCES_AHEAD=3` and `MAX_AUDIO_AHEAD_MS=8_000` (`call_tts_elevenlabs.py:55-57`); `may_flush` returns True for indexes 0-2 (`:160-167`). The same speaker class serves Fish (`engine.py:2513-2531`). Billing `tts_audio_ms` equals the asset sum for bcf13aa3, 9ff8d8a6, 1c5befbd and 890eb3b6; fe6100ca has 888 ms more. 515 shows how the three free sentences beat the 8 s cap: 16.5 s ahead. The "8x real time" figure is an inference from one capture. |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-05 | confirmed | medium | `storage.py:23-33` and `:129-146` store only `local_fs` plus a root-relative path. `routes/tts.py:78-92` resolves under the serving instance's root, and `:120-128` returns the same 404. 6 sampled call files exist on `/home/andres/server/RAID5/...` (sshfs to `.90:/media/RAID5`) with sizes equal to `file_size_bytes`. The local root, `.env` `TTS_STORAGE_ROOT=.../magic-worlds-api/.tts_storage`, has no such job directories, and its `2026/10` mtime is 2026-10-17. Severity holds: V-12 allows sticky routing on `voice_session_id` with several replicas, and `/tts/assets` is not sticky. |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-06 | adjusted | low | **Facts reproduced** on 5 decoded assets. Fish 525, 515 and 531: onset 105-140 ms, trailing 298-726 ms, quiet 15-17 %. ElevenLabs 552 and 554: onset 71-86 ms, trailing 200-343 ms. No silence trimming exists. The first-audio mark is the first chunk (`engine.py:2457-2470`).<br>**Impact overstated.** About 37-53 ms of the onset is codec delay, and trimming works only in 26 ms frames, so the gain is about 50-100 ms. Trailing silence does not delay the user's turn: the SPA allows barge-in during playback (`useVoiceCallController.ts:676-686`), and the next turn starts from user speech and STT, not from playback end. "Up to 1 s of dead air before the turn feels yielded" is therefore not supported. What remains is pacing (inter-sentence gaps), the length of the replayed clip, and billed silence (overlaps 04). |
| GAP-CALL-AUDIO-ASSETS-AND-MP3-TIMELINE-07 | adjusted | low | **Mismatch confirmed.** `voice_orphan_sweep.py:313-327` searches `'$.tts_segments.*.assets[*].asset_id'`. The engine writes the flat `tts_segments."0".asset_id` (`engine.py:3540-3556`). Re-run: sweep path 0/17, flat path 17/17. The only sweep test fixture uses the chat shape (`tests/scripts/test_orphan_sweep.py:95`).<br>**Impact latent.** Assistant segments are deleted only together with their message (`models.py:22771-22785`) or by FK cascade from `voice_session` or `adventure_session`. The only `voice_session` delete is the native purge, which also deletes the call messages. A failed `create_segment` never reaches `link_call_audio_to_message`, so no chat link is left behind. The sweep is also manual, reviewed and 7-day-gated. No current path triggers the deletion. |
