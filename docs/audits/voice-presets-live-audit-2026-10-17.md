**Voice presets and console: live application audit — 17 October 2026**

Current status and implementation order: [19 October reassessment and remediation plan](/home/andres/WebstormProjects/magic-worlds/docs/audits/voice-presets-remediation-plan-2026-10-19.md). The findings and results below describe the original live run.

Eight findings remain: one P1, six P2, and one P3. The most urgent issue allows a preview to charge a credit without the promised first-paid confirmation. S2.1 Pro generates real audio, but consumers cannot select it because the catalog contains no approved S2.1 Pro voices. The final full frontend build passes.

The audit created `voice_review_20261017_8dbf34` through the app’s registration form, including its required signup checkboxes. It first tested the real Free account, then assigned Plus through the authenticated root membership API. The account remains active. Its generated password is in the local, mode-600 [private credentials file](/tmp/mw-voice-app-audit-20261017/credentials.private.json); no password, login token, provider key, or audio access grant is included in this report or its evidence bundle.

**Findings**

| ID | Priority | Finding | Layers |
|---|---|---|---|
| F1 | P1 | Stale preview allowance bypasses the first-paid confirmation | Editor, advanced preview, billing API, MySQL |
| F2 | P2 | A saved voice can retain a dictionary in an incompatible language | Editor, preset validation, pronunciation resolver |
| F3 | P2 | One malformed row hides valid presets on later pages | SQL parsing, pagination contract, Studio |
| F4 | P2 | Call setup accepts presets whose voices cannot take calls | Preset picker, call setup, call admission |
| F5 | P2 | Chat deletion fails in the voice-content purge | Chat UI, deletion route, SQL/schema |
| F6 | P2 | New Free accounts receive an unexplained preview refusal | Signup, account eligibility, preview UI |
| F7 | P3 | Editing a Spanish recipe can seed English comparison text | Async catalog loading, advanced preview |
| F8 | P2 | S2.1 Pro has no consumer rollout approvals | Catalog acceptance, personal/global editors, API eligibility |

**F1 — Preview credit confirmation can be bypassed.** Open a Fish preset with one free render remaining. Generate an advanced comparison, consuming that last free render, then press the main preview button. The comparison showed **7 previews left**, while the main preview still showed **8** and omitted the credit price. The main request proceeded without a confirmation and returned `free_previews_left: 0`; MySQL recorded the one-credit reservation as ledger entry `628` for that render. This occurred in a fresh browser context with no previous paid confirmation.

The editor and advanced panel each own a separate `useRecipePreview` instance. Each updates only its own allowance after a response; the main editor’s credit guard therefore uses stale state. Share allowance updates across preview surfaces and account for another tab consuming the allowance. A server-side paid-render authorization field would also prevent a stale client from silently authorizing a debit. The regression must verify the displayed price, confirmation, actual debit, and replay behavior across the free-to-paid boundary.

Sources: [editor preview state](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:166), [advanced preview state](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePerformancePanel.tsx:37), [credit guard](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:340), [local allowance update](/home/andres/WebstormProjects/magic-worlds/src/features/voices/useRecipePreview.ts:368). Evidence: [browser requests and conflicting counters](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/preview-edges.json), [actual preview and credit rows](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/first-paid-preview-database.json), [screenshot](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/stale-preview-credit.png).

**F2 — The app saves a recipe that cannot preview in its voice’s supported language.** Create Spanish pronunciation settings for Gabriel, then change the base voice to the English-only Claire. The editor retains the Spanish dictionary reference and saves successfully with HTTP 200. Previewing the saved recipe in English returns HTTP 404, `pronunciation_version_unavailable`. The saved database/DTO still contains the incompatible reference.

Changing the voice resets the preview language but retains pronunciation references. Backend recipe validation checks ownership and that selected dictionaries share one language; it does not check that language against the selected voice/model. The update route also skips pronunciation validation when the performance object is unchanged. Validate the merged recipe when its voice or language changes, and make incompatible references actionable in the editor before saving.

Sources: [voice-change handler](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:264), [performance check](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_performance.py:44), [update validation](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:134). Evidence: [successful incompatible save](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/preview-edges.json), [failed saved-recipe preview](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/api-validation.json). The test recipe was restored to Gabriel after reproduction.

**F3 — Skipping a malformed row prematurely ends pagination.** With 101 temporary personal presets plus the account’s existing rows, the Studio correctly rendered **115** cards. Making one test-owned row malformed caused the first API page to contain **99** parsed rows. The frontend interpreted that as the last page and displayed only 99 cards, although **15 additional valid rows** were available at `skip=100`. Restoring that row restored all 115 cards.

SQL applies `LIMIT/OFFSET` before `_parsed_rows` removes invalid rows. The client stops whenever the returned array has fewer than 100 items. Return an explicit continuation cursor/`has_more`, or refill pages while preserving the raw database offset. Add a unique ordering tie-breaker as part of a reliable pagination contract. All 101 temporary presets were deleted, and the malformed field was restored.

Sources: [SQL list and parsing](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:17844), [client stop condition](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:2886). Evidence: [normal, malformed, and restored browser counts](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/pagination.json). This was a controlled negative test on this account’s actual database row.

**F4 — The preset tab ignores call eligibility.** In the production app’s call setup, a preset using Lucía appeared with an enabled **Use** button. Selecting it changed the call voice to Lucía and displayed the **Calls only** badge. That catalog voice has `call_eligible: false`. Sending the same selected voice to the real application call socket correctly failed with fatal `voice_unavailable`: “This character’s voice is not available for calls.”

`worksInCalls` reaches the catalog tab, while preset rows only check plan locks and withdrawn status. Apply voice/model call eligibility to preset rows as well, including loading and unavailable catalog states. The backend admission check is enforcing the restriction correctly. The temporary Lucía preset was removed and the call selection was restored to the character’s voice.

Sources: [preset blocking rule](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:374), [enabled selection handler](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:449), [catalog-only call filter](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:506), [backend refusal](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:691). Evidence: [production UI selection](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/production-narration-and-call-ui.json), [actual socket refusal](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/application-call.json).

**F5 — Deleting a chat fails before voice content can be purged.** Deleting test chat `71` through both the API and production UI returned HTTP 500, “Failed to delete character chat.” The card remained visible. The backend raised MySQL error 1054: `Unknown column 'a.user_id' in 'where clause'`.

`_purge_call_content` aliases `tts_asset` as `a`, then filters `a.user_id`, `a.project_hash`, and `a.user_group_hash`. Those ownership columns belong to the joined `tts_job`, not `tts_asset`. The whole-chat query runs even when the chat has no call assets, so an otherwise empty chat also fails. Correct the ownership predicates and retain workspace scoping in the deletion transaction. The assistant-message purge branch contains the same invalid predicates and needs review too. Test actual chat deletion with and without call audio and verify owned assets and transcript references are removed correctly.

Sources: [whole-chat purge query](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22663), [assistant-message branch](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22689), [asset schema](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:970), [deletion route](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_character_chat.py:1882). Evidence: [production Delete chat result](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/chat-delete-ui.json), [screenshot](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/chat-deletion-fails.png). Chat 71 remains because this cleanup action failed; it was not forcibly deleted from SQL.

**F6 — The new-account eligibility rule is not explained in the preview UI.** Immediately after real registration, the Free account saw **3 previews left today** and an enabled tuned-preview button. Its request returned HTTP 403, `voice_not_eligible`, with approximately 24 hours in `retry_after_seconds`. The app displayed only **Could not generate a preview**.

The backend intentionally requires Free accounts to be at least 24 hours old. The frontend classifies this refusal as a generic failure and loses the available explanation and wait time. Surface the restriction and distinguish catalog samples from metered renders. Verify this on a genuinely new account before assigning a paid plan.

Sources: [account-age gate](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/voice_access.py:399), [error classification](/home/andres/WebstormProjects/magic-worlds/src/features/voices/useRecipePreview.ts:130). Evidence: [fresh-account refusal](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/new-free-account.json), [visible error](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/new-free-account.png).

**F7 — A Spanish comparison can start with English text.** Reopening the saved Gabriel recipe produced English comparison text, `Stay close…`, while the textarea and actual request language were `es`. The text is initialized once, before the async catalog lookup supplies the voice’s language; later language changes do not reseed it. Keying the panel only by model preserves that stale text. Initialize the sample after language resolution, or update an untouched sample when the language changes while preserving user-authored text deliberately.

Sources: [one-time sample initialization](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePerformancePanel.tsx:29), [panel key](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:572). Evidence: [textarea language and comparison request](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/performance-browser.json).

**F8 — S2.1 Pro support is implemented but unavailable to consumers in this environment.** All 50 catalog records were read, including 20 Fish voices. Thirteen Fish voices have a Drama 3 pass; **zero** have an S2.1 Pro pass. Personal and global preset editors therefore offer only Drama 3 for the tested voice. Direct S2.1 Pro personal and global creation requests return HTTP 422, `voice_not_eligible`.

The root synth lab produced real S2.1 Pro audio, and its native timestamp WebSocket returned audio and word alignment. This is an acceptance/publication gap, rather than proof that the transport is broken. Review the intended S2 voice/language pairs, record actual acceptance, and then rerun consumer creation, reload, preview, narration, and call workflows. No catalog approvals or listening scores were invented for this audit.

Sources: [personal model eligibility](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/voice_write.py:235), [personal model options](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:210), [global model options](/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/globalPresets/GlobalPresetEditorDrawer.tsx:49). Evidence: [complete acceptance inventory](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/catalog-acceptance.json), [root lab audio results](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/root-browser.json), [consumer/global refusals](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/api-validation.json).

**Provider and model coverage**

The capability response exposes exactly the four requested playback IDs. Extra/retired model IDs were rejected through real HTTP requests. Root-only voice creation uses separate provider design APIs (`eleven_ttv_v3` and Fish `voice-design-1`); these are not consumer playback choices.

| Playback model | Application surfaces | Exposed preset features | Live result |
|---|---|---|---|
| ElevenLabs `eleven_v4` | Preview, narration, root lab | Stability, similarity, seven moods; fixed preview texts | Browser render/play/save/reload; root lab MP3; mood + thought preview with volume 0.708 |
| ElevenLabs `eleven_v4_turbo` | Calls | Shared ElevenLabs recipe settings and mood | Native stream passed; actual BFF call completed ASR → LLM → 23 MP3 chunks |
| Fish `drama-3` | Preview, narration, eligible calls, root lab | Moods, direction, pinned pronunciation dictionaries; comparison-only phrase delivery and positioned reactions | Browser directed render, version pinning/archive, phrase/reaction render, English CMU audio, character assignment and browser chat narration passed |
| Fish `s2.1-pro` | Advertised preview/narration/call surfaces; root lab | Moods, direction, pronunciation; no scoped phrase/reaction controls | Root lab and native timestamp stream passed; consumer workflows blocked by F8 |

The app exposes no numeric Fish tuning controls. ElevenLabs speed, style, and speaker boost are absent from preset editing and rejected by the preset APIs. v4 Turbo is a call transport, so the root HTTP lab offers v4 for ElevenLabs. These observations agree with the documented [ElevenLabs dialogue transport](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tdd). Fish’s documented [Drama 3 controls](https://docs.fish.audio/features/text-to-speech/drama-3) cover the scoped delivery, sound/pause, and pronunciation features reviewed here.

Both Fish native streams returned word-timing frames. Their actual SQL admission rows counted 42 UTF-8 bytes for the accented test input: Drama 3 reserved 420 cost-micros at this account’s configured launch rate; S2.1 Pro reserved 630 at $15/M bytes. The S2 rate matches the [published pricing unit](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits). The Drama launch rate is environment-specific. [Native results](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/fish-native-streams.json).

**Properties and boundaries reviewed**

| Property group | Contract and validation |
|---|---|
| Name / description | 255 / 2,000 characters; nullable description; invalid blanks, whitespace, types, and excess lengths rejected; browser save trims input |
| Voice identity | Catalog key, provider match, acceptance, status and owner scope; display name comes from the catalog |
| Schema / model | ElevenLabs schema 2; Fish schema 3; only `drama-3` / `s2.1-pro` as Fish recipe models; provider changes clear incompatible stored settings and metadata |
| ElevenLabs settings | Strict numeric stability and similarity in 0…1; boolean/string coercion and unsupported fields rejected; valid 0/1 boundaries round-tripped |
| Emotion | None plus calm, happy, sad, angry, fearful, disgusted, surprised; all seven round-tripped for v4 and Drama 3 |
| Reusable performance | Integer version 1; plain direction up to 300 characters; at most three distinct pinned dictionaries; utterance offsets are rejected in saved recipes |
| Comparison performance | Text up to 600 code points; up to 16 spans and 12 events; seven delivery choices and six event choices; invalid enums, offset units and limits rejected; S2 scoped spans/events rejected |
| Dictionaries | Version pinning, stale-version HTTP 409, owner isolation, archive retention, spoken substitutions, English CMU phonemes; invalid languages, duplicates, rule counts and field types rejected |
| Language | Personal editor language selects a preview; personal write DTOs do not persist a language field. Root global presets support optional `language_code`. F2/F7 cover the observed language failures |
| Globals / permissions | Root-created, read-only for consumers, duplicable into personal settings; private dictionary references rejected in globals |
| Copying onto characters | Voice, schema, model, settings, mood and pronunciation pins copied by value; persisted character/session snapshots retained the selected recipe |

The live HTTP matrix included **81 invalid property/model cases**, fourteen valid emotion recipes with owner-isolation checks, root-only operation refusals, and additional dictionary/audio ownership checks. The 81 cases comprise 48 core preset refusals, five extra model refusals, two Fish numeric-setting refusals, and 26 advanced performance/dictionary refusals. The evidence records requests and outcomes; these are not substitutes for subjective listening evaluation. [Core matrix](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/api-validation.json), [advanced matrix and provider transitions](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/final-backend-validation.json).

**Execution and evidence**

Testing used real app signup/login, api.auth, the BFF, MySQL, moderation, the configured LLM service, owned audio storage, ElevenLabs, Fish Audio, and Groq. There was no request interception, replacement provider response, synthetic audio response, or fabricated acceptance verdict. Chromium was driven through actual forms and controls. The final browser pass used the compiled production app at [localhost:5174](http://localhost:5174) and the restarted current backend at [localhost:18010](http://localhost:18010).

The call input was real speech previously generated by the root lab, converted to 16 kHz mono PCM and uploaded through the actual application call endpoint. It produced a real transcription, LLM reply, streamed audio, saved transcript, and billing record. The saved call reports 4,000 ms STT input, 9,352 ms TTS output, 14 billable audio seconds, and two credits. This covers the server call pipeline; physical microphone capture, device VAD, and mobile hardware calls were not exercised. [Application call and audio facts](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/application-call.json), [persisted call/billing metadata](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/call-database.json).

| Validation | Result |
|---|---|
| App registration, consumer role, Free eligibility, real root Plus provisioning | Completed; F6 found |
| UI save/reload, dirty cancel, global read-only copy and personal delete | Passed |
| API/SQL property and ownership matrix | Passed for expected refusals and valid writes; F2/F3/F5 found |
| Root global Fish identity/direction and supported control inventory | Passed for approved Drama 3; S2 blocked by acceptance |
| Real provider native tests | `2 passed in 3.29s`; covers v4 Turbo plus both Fish models |
| Actual character, chat, narration job and production browser playback | Passed |
| Call voice picker and real call admission | F4 reproduced; backend correctly refused the ineligible voice |
| Production preview autoplay and 390/320 px editor checks | Passed in tested Chromium viewports |
| Production narration/call-picker browser pass | Completed with zero failed API requests; F4 reproduced |
| Full frontend `pnpm build` | Passed: TypeScript check and production build |

The final `pnpm build` completed successfully. [Build output](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/full-build.txt). The production bundle is available for local review.

Both repositories contained substantial uncommitted work, and unrelated workspace/export sources changed during the audit. The final API was restarted and final browser checks used a production bundle to avoid mixing a live frontend update with stale backend routes. Transient authentication and missing-route results caused by test session rotation or this mixed snapshot were excluded from the findings. No application source was changed by this audit. Tested source hashes and repository heads are in [source-snapshot.json](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/source-snapshot.json).

The account retains three working personal presets, Spanish and English pronunciation dictionaries, the guide/persona cards, a successful narrated chat, and the actual call transcript. There are twelve shared defaults. Temporary pagination, emotion, transition, shared-copy and call-picker presets were removed; the malformed row and archived test dictionary were restored; no live call remains. The empty chat remains because of F5. The audit’s isolated app/API are available for local review in the [local review app](http://localhost:5174/#/voices); existing user-owned development services were not stopped.

The [evidence manifest](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/manifest.json) contains checksums for JSON results, screenshots and actual audio. Representative clips: [v4 root lab](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/root-lab-v4.mp3), [Drama 3 browser narration](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/browser-chat-drama-narration.mp3), [S2.1 Pro root lab](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/root-lab-s2.1-pro.mp3), [v4 Turbo application call](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-2026-10-17/application-call-v4-turbo.mp3).

This review does not sign off S2 consumer availability, every acoustic mood/delivery effect, hardware microphone behavior or untested browser engines. The actionable work is F1–F8; the final full build passes.
