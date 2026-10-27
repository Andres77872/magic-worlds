**Voice presets and console — reassessment and remediation plan, 19 October 2026**

Five application defects from the original audit remain in the current code. Two other findings have code fixes that need live acceptance testing. S2.1 Pro still has no approved consumer voices. A ninth finding concerns the live test suite: it creates an S2 approval using invented listening scores. Fix that test behavior before running the complete suite again.

This plan supersedes the 17 October live audit. That audit and its browser, API, audio and database evidence were removed on 2026-10-26; they remain in git history at commit `77174215` (`docs/audits/voice-presets-live-audit-2026-10-17.md`, `docs/audits/evidence/voice-presets-2026-10-17/`). Today's checks comprise current source review, an actual read-only transaction against the `.env` database, and a successful `pnpm build`. No new provider rendering or account/catalog mutation was performed for this reassessment. F1 and F5 are therefore **implemented, awaiting live verification**, rather than closed or still wholly unimplemented.

The reviewed heads are frontend `07d67b9a35d9b02c588b97cecbde36c08e78f0e6` and backend `bac565069bee35fc4aa4df297d00b25bad1f9e4b`. See the [current source and validation record](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-reassessment-2026-10-19/reassessment.json) and [database inventory](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-reassessment-2026-10-19/database-readonly.json).

**Priority and impact**

Priority describes execution urgency. Impact describes the consequence and affected users; a high impact finding can already have a fix pending validation. P1 work comes first because it governs credit authorization or the trustworthiness of subsequent live tests. P2 work restores broken user workflows or the requested model rollout. P3 addresses a misleading default without independently preventing saving.

| Order | Finding | Priority | Current status | User or operational impact | Reach | Main responsibility |
|---|---|---|---|---|---|---|
| 1 | F9: live suite invents acceptance scores | P1 | Newly identified in current test code | High: running it can temporarily publish an unreviewed model and produce misleading acceptance evidence | Root-authorized test execution and consumers sharing its catalog | Backend test harness; QA |
| 2 | F1: preview credit confirmation | P1 | Server spending cap and shared client allowance implemented; live acceptance outstanding | High: original failure debited a credit without the promised first-paid confirmation | Metered previews across Studio, editor, picker and advanced comparison | Backend billing admission; frontend preview state |
| 3 | F5: conversation deletion | P2 | Both invalid SQL aliases corrected; live acceptance outstanding | High: original error prevented deleting even an empty chat; the same helper serves other deletion/reset paths | Character chats, adventures, message deletion and clearing | Backend persistence and cleanup |
| 4 | F2: incompatible pronunciation recipe | P2 | Still present by source review | High for affected recipes: a successful save can produce a recipe that fails at playback | Fish personal presets, copied character/session recipes, narration and previews | Backend merged-recipe validation; frontend editor |
| 5 | F4: ineligible call preset selection | P2 | Still present by source review | High for affected calls: setup permits selection, then the server refuses the call | Call preset tab and remembered per-character overrides | Frontend picker and call setup |
| 6 | F8: S2 consumer availability | P2 | Confirmed again against the live database | High feature impact: the requested S2 model cannot be used in consumer presets in this environment | All consumers seeking S2; root global preset creation | Catalog reviewer/operator; model workflow QA |
| 7 | F3: pagination truncation | P2 | Still present by source review | Medium: valid presets disappear from a sufficiently large list after a malformed row | Studio and preset pickers using the shared API client | Backend pagination contract; frontend API client |
| 8 | F6: unexplained Free eligibility refusal | P2 | Still present by source review | Medium: a new account is offered a render it cannot use and receives a generic failure | New Free users and other account-eligibility refusals | Backend public eligibility contract; frontend error handling |
| 9 | F7: wrong comparison sample language | P3 | Still present by source review | Low to medium: audition text can be English while the selected language is Spanish | Advanced comparison after asynchronous catalog resolution | Frontend comparison draft state |

There is no new evidence of cross-account data disclosure or an ongoing unapproved credit debit in the current implementation. F1's historical debit is established; today's server code explicitly checks the authorized credit cap before reserving a paid render. F9 is a verified executable test behavior, not a claim that a fabricated S2 approval exists today: the current database contains zero S2 approvals.

**F9 — Remove fabricated acceptance from the live test harness**

The complete live integration test selects an active Fish voice. If its language lacks an S2 pass, the test renders real audio, measures loudness, then writes `verdict: "pass"` with **every subjective score set to 4**. An actual MP3 and a loudness measurement establish neither naturalness nor accent, timbre, emotion or artifact quality. The acceptance service persists these values under the acting root user and adds the model to the accepted-language row. A separate cleanup program attempts to remove this temporary approval later; it is not a transaction surrounding the test and cannot eliminate the interval of altered catalog eligibility.

Sources: [invented review and subsequent consumer use](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/test_voice_presets_end_to_end_live.py:149), [acceptance persistence](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/catalog/acceptance.py:171), [separate cleanup](/home/andres/PycharmProjects/magic-worlds-api/tests/integration/voice_presets_live_cleanup.py:24).

The fix is to remove automatic verdict/score writes from the technical E2E flow. Select real, already reviewed `(voice, model, language)` pairs. Let root lab/native transport checks exercise unapproved models without changing publication. If the mandatory S2 consumer prerequisite is missing, report it as **blocked by missing approval**, with an unsuccessful consumer release gate. A successful lab request must not turn that gate green. Keep the genuine listening-review workflow separate from the automated runner.

Make test cleanup depend on recorded IDs of the run's accounts, presets, chats, dictionaries and globals. Remove the runner's need to restore acceptance rows by direct SQL. Acceptance/publication records must remain untouched by the technical suite. Avoid overwriting another review if it occurs during a run.

Acceptance: run the suite against today's zero-S2-approval catalog; it must leave acceptance and accepted-language data unchanged, report the missing prerequisite, and still report independent transport results accurately. After F8's genuine review, the same consumer tests must complete without writing a verdict or subjective score. Preserve before/after evidence of the relevant catalog records.

Effort: medium. Dependency: complete before the full live regression suite or F8 sign-off.

**F1 — Verify the existing spending fix and finish any state defects**

The original separate-allowance diagnosis is outdated. The app now wraps consumers in `PreviewAllowanceProvider`, shares the meter, invalidates other tabs using BroadcastChannel/storage, refreshes on focus, and scopes remembered confirmation by account. Both fixed and authored preview requests carry `max_credit_cost`. It defaults to zero. Under the membership row lock, the backend compares the actual price with that cap and returns `409 preview_credit_confirmation_required` before reservation when confirmation is needed. The hook opens the dialog and retries with cap 1 after confirmation. Cache hits precede reservation and remain free.

Sources: [provider mounting](/home/andres/WebstormProjects/magic-worlds/src/app/providers/AppProvider.tsx:46), [shared allowance](/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewAllowance.ts:19), [request and confirmation handling](/home/andres/WebstormProjects/magic-worlds/src/features/voices/useRecipePreview.ts:288), [strict request cap](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_preview.py:110), [atomic spending check](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/preview_meter.py:628), [cache-first path](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/preview_meter.py:528).

Keep this protocol. Do not replace it with another client-only counter check. The remaining work is live proof across every surface, plus any reconciliation defects uncovered by concurrent requests. Client request numbering is not a server usage revision: [allowance updates discard older request IDs](/home/andres/WebstormProjects/magic-worlds/src/features/voices/usePreviewAllowance.ts:80). Verify both server admission orders, cancellation after admission, UTC-day rollover and allowance reads completing around a render. Reconcile from authoritative usage after concurrent/aborted requests settle if ordering leaves stale counters; use a server usage revision/day if necessary. The spending cap must remain effective while the display is stale or unknown.

Acceptance requires actual browser actions and ledger evidence:

1. Consume the last free render in advanced comparison and immediately use the main editor, Studio card and picker in separate cases. A paid miss must open the first-paid dialog before any debit. Cancel creates no paid reservation; confirm creates exactly one.
2. Repeat across two same-origin tabs, with unknown allowance, after account switching, and with concurrent requests. One account's confirmation or stale pending action must not authorize another account.
3. Direct real HTTP requests with omitted/zero cap return the required-price response for a paid miss, without a render row or credit reservation. Reject boolean/string/float/out-of-range caps. Exercise both `/voice-presets/preview` and `/voice-performance/preview`.
4. An unconfirmed cached replay returns actual playable audio, `charged_credits: 0`, unchanged allowance and no new ledger debit. The spending cap must not change the audio cache identity.
5. Stop an admitted render, let the real server finish, then replay it. Counters and the ledger must reflect one render; no second charge may result from retrying playback.

Existing spending tests substitute providers/repositories and browser API responses. They are useful code coverage, but do not close the user's requested real-stack acceptance: [backend spending tests](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_preview_spending_authorization.py:1), [frontend spending tests](/home/andres/WebstormProjects/magic-worlds/src/features/voices/previewSpending.test.tsx:1).

Effort: medium for live validation and targeted corrections. Keep the zero-cap server default during rollout; deploy the matching frontend so older clients receive an actionable confirmation flow. Closure requires the new browser/API/ledger evidence, not just a passing build.

**F5 — Verify conversation deletion across the shared cleanup paths**

Both whole-chat and assistant-message queries now filter `j.user_id`, `j.project_hash` and `j.user_group_hash` on the joined `tts_job`. Today's live schema confirms that those columns belong to `tts_job` and do not exist on `tts_asset`. The original unknown-column error has therefore been addressed in source.

Sources: [corrected whole-chat query](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22742), [corrected assistant-message query](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22765), [session deletion caller](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:11411), [message deletion caller](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22309), [clear-history caller](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:22602).

The impact is broader than the console: character-chat deletion and adventure deletion share session persistence, while message deletion and clearing also invoke this helper. Verify those paths before further SQL changes. Preserve the route's owner/workspace lookup, the scoped final delete, transaction rollback, active-call refusal, and the join to the owning job for asset updates. The helper's asset queries use the scoped parent session ID; test that the complete operation cannot purge content through a wrong-workspace or foreign-owner request.

Acceptance: delete a newly created empty character chat through the production UI; repeat with a real narrated reply and a completed real call. Then exercise assistant-message deletion, history clearing and adventure deletion. Confirm the expected transcript rows are removed, owned audio is tombstoned, workspace media links disappear, subsequent protected asset reads refuse access, and unrelated chats/assets remain readable. Verify active-call refusal returns a controlled conflict and leaves data intact. Test repeated deletion against the API's documented not-found behavior. Use only dedicated test conversations; remove the retained historical test chat only after its evidence is preserved and the fix is verified.

Effort: medium. No schema migration is indicated by the original alias error. A bulk SQL delete is not a remedy or an acceptance test.

**F2 — Validate the complete pronunciation recipe before saving**

The editor still changes the voice/model/language without checking retained dictionary references. The backend performance check resolves ownership and prevents mixed dictionary languages, but never compares them with the selected voice/model's accepted languages. Its update route validates performance only when that object changes, so an identity change can bypass the check. `PronunciationEditor` already offers removal of a pin that does not match its current language; the missing pieces are save eligibility and server validation.

Sources: [voice change](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:263), [save eligibility](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:238), [existing remove action](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PronunciationEditor.tsx:66), [partial performance validation](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:136), [language check](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_performance.py:47), [playback-time dictionary resolution](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/performance.py:18).

Build one reusable validator for the effective merged recipe. Resolve immutable pin versions under the caller's ownership, infer their single language, and require the selected voice **and selected model** to have acceptance for that language. Run it on creation and on relevant voice/provider/model/performance changes. Check copied character/session recipes at the assignment boundary as well; do not allow a preset-only fix to leave another write path creating the same unusable combination. Maintain private-version not-found responses and the prohibition on private dictionary references in global presets.

For personal presets, the current preview-language chip is not a persisted recipe language. Keep that distinction explicit: treat a pinned dictionary's language as a pronunciation constraint. Show incompatible pins, explain the constraint, and block saving/previewing an incompatible combination until the user removes or replaces them. Changing a voice must not silently delete a dictionary or rewrite its language. Before applying a constrained recipe to a session in another language, return an actionable incompatibility instead of applying the wrong dictionary. No new personal language column is necessary for this approach.

The merge must distinguish omitted fields from explicit nulls. An adjacent source-level contract problem exists in [_update_v2](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_presets.py:132): omitted `provider` is currently treated as leaving Fish and can reject a metadata-only Fish patch. Use the stored provider to interpret a partial update, and judge the final recipe rather than an incomplete patch. Preserve settings-only/metadata-only editing rules for historical voices where the existing contract permits them. Test this behavior directly against the real API.

Acceptance: reproduce Spanish Gabriel plus a pinned Spanish dictionary, switch to English-only Claire, and verify an actionable editor conflict and a server refusal with no invalid persisted update. Repeat model-only changes, language changes, omitted performance, unchanged performance, explicit clearing, provider transitions and concurrent updates. Keep compatible archived-version pins usable; do not automatically move pins to the newest version. Save/reload a corrected recipe, assign it to a character, and produce real preview and narration audio. Inspect stored preset and session snapshots. Identify existing incompatible personal recipes with a read-only inventory and surface repair actions; do not bulk-remove user pins.

Effort: large relative to the other UI fixes because it crosses write contracts, ownership, language semantics and copied recipes. Implement with F7 to avoid two conflicting language-state changes.

**F4 — Enforce call eligibility in every selection path**

`worksInCalls` still filters only the catalog tab. Preset rows block plan locks and withdrawn voices, and treat an absent catalog lookup as usable. Call setup checks provider health but does not establish per-voice eligibility for a restored override. The backend call resolver correctly refuses an unresolved call voice.

Sources: [preset blocking rule](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:82), [preset row](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:370), [catalog-only filter](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePickerElevenLabs.tsx:501), [lookup's empty-map behavior](/home/andres/WebstormProjects/magic-worlds/src/features/voices/hooks/useCatalogLookup.ts:14), [remembered override and health check](/home/andres/WebstormProjects/magic-worlds/src/features/call/components/CallScreen.tsx:76), [server admission](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py:662).

Introduce a shared selection decision using surface, voice status, plan, `call_eligible`, provider/model readiness and the relevant language rules. Fish specifically requires a pass for the selected model/language pair. Follow the backend's existing call-readiness rules for ElevenLabs; do not require a Turbo HTTP-preview capability to authorize its call transport. Apply the decision to preset rows, the current-voice selection path, and remembered call overrides. Distinguish loading, failed lookup and genuinely missing catalog entries for decisions that authorize selection; the current decoration-only empty-map hook cannot provide that distinction. Disable selection while eligibility is unknown and provide retry or another-voice actions. Re-check before starting a call and retain the server admission check for catalog changes after selection.

The **Calls only** badge describes the scope of a call override; it is not evidence that the selected voice is call eligible. Keep that distinction in the copy and eligibility logic. A consumer must still be able to use a narration-only preset for narration.

Acceptance: the known narration-only Lucía voice cannot be selected through the call preset tab or current/remembered paths; it remains usable where narration is supported. Check lookup loading/failure, withdrawal after selection, a plan lock, missing model acceptance and an account change. Approved ElevenLabs recipes must start a real v4 Turbo call; approved Fish recipes must preserve their selected Drama 3 or S2 model in a real application call. An ineligible direct socket request must still be refused before paid speech work.

Effort: medium. Dependency: use genuine S2 approvals from F8 for the positive S2 call case.

**F8 — Complete genuine S2 approval and consumer rollout**

The read-only database check at **2026-10-19 15:33 UTC** found 50 catalog voices: 30 ElevenLabs and 20 Fish. Nineteen are public and active: six ElevenLabs and thirteen Fish. Fish approvals consist of six English and seven Spanish Drama 3 passes; **there are no Fish S2.1 Pro acceptance rows**. The personal and root global editors correctly filter their model options using acceptance. Making S2 appear by bypassing those filters would conceal the rollout gap.

Sources: [current live inventory](/home/andres/WebstormProjects/magic-worlds/docs/audits/evidence/voice-presets-reassessment-2026-10-19/database-readonly.json), [personal model options](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:208), [global model options](/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/globalPresets/GlobalPresetEditorDrawer.tsx:49), [model admission](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/voice_write.py:231), [root acceptance UI](/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/acceptance/AcceptanceModule.tsx:89).

The previous root lab and native stream results establish working S2 transport. Consumer preview, narration, character/session persistence and complete S2 application calls remain release requirements. Code inspection shows the requested model is carried into the Fish resolver and stream validator; that does not replace those end-to-end results.

Select the intended launch voices/languages, generate actual S2 acceptance scripts through the root console, measure loudness, and have a reviewer listen and record defensible scores/verdicts. Approve only the pairs that pass. Record actual call readiness separately; a model-quality pass does not by itself prove microphone, interruption or conversation behavior. Verify showcase sample generation and accepted-language projections. Then create root shared and consumer personal S2 presets, reload them, copy a personal preset to a character, generate narrated chat audio and complete a real S2 call with transcript/audio/billing evidence. Repeat for the supported launch languages. Start with at least one genuinely reviewed English and one Spanish pair before claiming both languages are launched; broader catalog coverage is a separate rollout decision.

If a pair fails, preserve the failed review and remove that pair's eligibility through the normal console workflow. Keep approved Drama 3 choices usable. Do not change model IDs or copy Drama 3 scores into S2 to obtain a passing test.

Effort: technical verification is medium; listening/review effort depends on the number of launch pairs. Dependencies: F9 before automated consumer tests; F2/F4 before complete consumer release sign-off. Real reviews can be prepared while those fixes are implemented.

**F3 — Give pagination an explicit continuation contract**

SQL still limits raw rows before parsing, while `apiService.listVoicePresets` still stops on `page.length < 100`. A skipped row can therefore hide later valid rows. Ordering also lacks a unique tie-breaker. Both Studio and the picker use this API method, so fixing just the Studio view would leave the defect elsewhere.

Sources: [row skipping](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:17894), [SQL ordering and raw limit](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:17945), [client termination](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts:2953).

Recommended contract: introduce a paged endpoint, such as proposed `GET /voice-presets/page`, returning `{items, next_cursor, has_more}`. Declare it before `/{preset_id}`. Base continuation on consumed raw rows, including invalid ones, and include `preset_id` in the deterministic sort key. Use bounded raw scans; an empty parsed page can still have a continuation. Validate cursors and always apply caller ownership/project scope independently of cursor contents. Keep globals visible with the current account-level semantics.

Deploy the backend endpoint first, then move the shared frontend API method to it while preserving its `Promise<VoicePreset[]>` interface for callers. Retain the legacy array endpoint during migration. Follow the server continuation even when fewer than 100 valid items arrive; reject a non-advancing cursor instead of looping. Refresh the collection after writes that change its ordering. Check the query plan before adding an index; a pagination bug alone does not justify a schema change.

Acceptance: use more than 100 actual test-owned rows and shared presets. Reproduce a malformed first-page row, multiple malformed rows and an entirely malformed raw page using controlled owned-row fault injection with guaranteed restoration. Assert every remaining valid ID reaches both Studio and picker, shared rows appear, order ties terminate correctly, search scopes persist, no duplicate/infinite-loop behavior occurs, and foreign personal rows never appear. The injected malformed row is a real database negative case, not a replacement API response.

Effort: medium. Dependency: paired backend/frontend contract rollout. Repair malformed records separately where their intended values are known; do not drop rows merely to make pagination appear fixed.

**F6 — Explain render eligibility before and after refusal**

The 24-hour Free-account gate is intentional and unchanged. The preview response includes a public code and retry delay, but the hook still maps `voice_not_eligible` to a generic failure. It also cannot tell account age apart from every other cause of that same code. The public route currently discards the internal denial reason, so a frontend-only string replacement cannot reliably explain each case.

Sources: [Free prerequisites](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/voice_access.py:393), [public refusal mapping](/home/andres/PycharmProjects/magic-worlds-api/src/routes/voice_preview.py:195), [generic classification](/home/andres/WebstormProjects/magic-worlds/src/features/voices/useRecipePreview.ts:136), [allowance-only helper](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PreviewAllowanceHint.tsx:23).

Add a safe account-facing render eligibility result, preferably through the existing account-aware voice capabilities response, with an allowlisted reason and server-derived retry/eligible time. Use a read-only eligibility evaluation: viewing capabilities must not record a Free activation. Return the same public distinction on a refused preview so UI state can recover from changes after the read. Explain the new-account wait with its retry time; keep shared-IP or other restrictions as a suitable generic eligibility message without exposing abuse counters. Retain the existing backend rules.

Extend the shared preview state/error types and English/Spanish copy. A numerical allowance must not imply present render eligibility. Explain/disable the metered action while blocked, preserve the draft, and keep catalog sample listening available. Do not add an automatic 24-hour retry or silently change the user's membership.

Acceptance: register a real new Free account in the app, test immediately before any paid upgrade, and verify the wait is visible before generation and after a direct API refusal. Sample audio remains playable, and refused renders create no provider reservation/debit. Use a naturally aged Free account for the allowed path; do not backdate account creation or disable the gate. Check paid-account behavior separately and ensure a temporary restriction is not mislabeled as account age.

Effort: medium. Dependency: integrate with F1's shared state without letting eligibility reads authorize spending.

**F7 — Reseed only untouched comparison samples**

The comparison text is still initialized once from `language`; the parent still keys the panel only by model. Async catalog resolution can change the language after initialization, leaving the original English text under an `es` request. A blanket remount keyed by language would also discard user edits and positioned performance annotations.

Sources: [initial sample state](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/VoicePerformancePanel.tsx:28), [model-only panel key](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx:567).

Track generated sample language and whether the user has edited the comparison. Seed after language resolution, or update the untouched generated text when the resolved language changes. Preserve edited text deliberately. Clear spans/events/selection only when the underlying text actually changes, because offsets are Unicode code points. Resolve these transitions together with F2's dictionary constraint. Keep this as transient comparison state; scoped phrase/reaction offsets must never become reusable preset properties.

Acceptance: reopen Spanish and English presets while real catalog requests are still loading; the untouched default, textarea language and actual preview request must agree. Switch voice/language/model after editing the text and after adding annotations. Verify preserved user text, valid Unicode offsets, controlled annotation resets and actual provider playback. S2 must continue hiding and rejecting scoped delivery.

Effort: small. Dependency: coordinate with F2; no backend schema change.

**Implementation sequence and release gates**

| Stage | Work | Dependency and completion condition |
|---|---|---|
| A | F9 harness correction; record current snapshot | No fabricated acceptance, no false success for missing S2 prerequisites; tests identify their own data |
| B | F1 and F5 live verification; fix only reproduced residuals | Browser/API/ledger proof for credit authorization and real conversation/media cleanup; current code fixes retained |
| C | F2 with F7; F4; F3; F6 | Implement coherent language rules, call eligibility, explicit pagination and eligibility UX; each has real regression evidence |
| D | F8 review and rollout | Genuine S2 review can start alongside C; complete consumer acceptance after the relevant C fixes |
| E | Complete provider/model and permission regression | Current frontend build and backend run against matching sources; all mandatory cases below pass |

The work packages can be developed independently where they do not share state, but F2/F7 should be owned together. F1/F6 share preview state and require an integration pass. Backend pagination must be available before its frontend consumer. These are implementation dependencies, not instructions to create additional tasks or agents.

The final regression uses actual app registration/login, `.env` service credentials, api.auth, MySQL, moderation, configured LLM/STT services, real providers and protected audio storage. Use a compiled production frontend and a backend restarted from the reviewed checkout. Keep SPA/API hostnames aligned for refresh-cookie testing. Do not substitute HTTP responses, offline providers, fabricated audio, invented reviews or manually reset billing/usage to make cases pass. Use separate test accounts when daily limits require it; retain legitimate ledger records. Isolated tests can remain useful during development, but they do not satisfy these release gates.

| Model | Mandatory real application flow | Supported preset controls that must round-trip | Required negative cases |
|---|---|---|---|
| ElevenLabs `eleven_v4` | Consumer preview, character assignment, narration; root HTTP lab | Stability, similarity, supported moods; fixed preview texts | Speed/style/speaker boost and Fish-only fields rejected; extra/retired model IDs rejected |
| ElevenLabs `eleven_v4_turbo` | Actual application call through STT → LLM → streamed speech and saved transcript | The shared ElevenLabs recipe settings/mood carried into the call | No standalone Turbo HTTP-preview choice; ineligible voices refused before paid speech |
| Fish `drama-3` | Consumer save/reload, preview, character/session assignment, narration and eligible call; root lab | Moods, direction and pinned pronunciation; scoped delivery/reactions in comparison only | Numeric tuning rejected; offsets rejected in saved recipes; private pins rejected in globals |
| Fish `s2.1-pro` | Same complete consumer flow after genuine F8 approval; root/native tests tracked separately | Moods, direction and pinned pronunciation | Scoped delivery/reactions absent in UI and rejected by API; unapproved voice/model/language combinations refused |

Repeat relevant flows in English and Spanish, across personal and root global recipes, owner and foreign-owner requests, and consumer/root role boundaries. Consumers remain able to create personal **recipes for existing eligible voices**; design/import/publication remains root-only. Shared recipes stay read-only for consumers and duplicable into personal recipes. Audit exact model IDs, provider/schema transitions, null/omitted patch fields, dictionary version pinning/archive, audio ownership and refresh behavior. The previous 81-case negative matrix is a baseline to rerun and extend, not current proof of these fixes.

A completed call must have real input, transcription, reply, decodable audio, persisted transcript and the corresponding billing facts. The previous uploaded-speech call covered the server pipeline; physical microphone/VAD, interruption and device playback need a separate real-device pass before claiming device coverage. Do not count a connected socket with no generated audio as successful speech validation.

For every closed finding, attach browser actions/screenshots where relevant, sanitized HTTP results, actual audio metadata where a render is required, and scoped database facts. Record the source heads, build result, test account roles/plans, catalog pair approvals and cleanup outcome. Keep tokens, cookies, root credentials and provider keys out of the report. Mark a missing approval, unavailable service or failed mandatory case explicitly; do not turn it into a green skip.

The requested outcome is reached when F1/F5 have fresh live closure, F2/F3/F4/F6/F7 are fixed with their acceptance evidence, F9 no longer alters quality approvals, and reviewed S2 pairs complete the consumer workflows. The production build currently passes; it remains necessary but cannot establish those outcomes by itself.
