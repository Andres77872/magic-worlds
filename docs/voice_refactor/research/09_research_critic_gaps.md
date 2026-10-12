# Research critic: gaps, contradictions and owner decisions

Date: 2026-10-12. This is the output of a completeness critic that read research notes 00–08 after they had been fact-checked. Notes 10–14 were written to close the gaps listed here, and the decision record [../03_target_architecture_and_decisions.md](../03_target_architecture_and_decisions.md) resolves the contradictions.

## Overall assessment

High on depth and evidence, medium on consistency. The nine notes are long and carefully cited. 06, 07 and 08 inventory the codebase almost line-accurately across both repos, including subtle traps:
- strict extra=forbid validators that make a bad migration fatal;
- frontend whitelists that silently strip new fields;
- the tts_job CHECK constraint;
- the /tasks serializer pinned to speech_2_8_turbo;
- frozen snapshots inside tb_llm_execution_plan that break retry after a rewrite;
- the card assistant erasing voice.
The external research (01–05) is broad and mostly verified against live official pages, with honest [unverified] tags and verification logs.

The main weakness is that the notes were written in parallel and propose incompatible target designs. They disagree on:
- default voices (several notes still recommend them although they expire 2026-12-31);
- the voice identity model (voice_key catalog vs raw voice_id plus a mapping table);
- the recipe schema and emotion storage;
- snapshot migration (read-time translation vs one-shot rewrite);
- the catalog source (synced DB vs live /v2/voices with hotlinked previews);
- narration architecture (per-segment v4 vs TTD per turn vs Flash default);
- the plan tier and the callbot pause markup.
Some recommendations predate verification findings, such as default-voice expiry and v4 promo pricing.

The voice catalog is the best-covered area (03, 08). Its remaining blockers are legal and empirical: B2C use of library voices, behaviour of use-without-add and add-returned ids, preview caching rights, and the webhook schema and retries.

The Studio parameter mapping is well researched but not settled. It depends on per-model setting behaviour that is still [unverified], and on choosing one schema.

Before the backend and frontend plans are written, the plan needs a reconciliation section that picks one design for each of these conflicts, plus one paid staging spike that closes the roughly 30 [unverified] items.

## Gaps

### G1. Voice catalog: library voice licensing

No note confirms that Voice Library voices may be offered to consumers inside a B2C roleplay app. Still open: whether attribution is required, whether owner or live-moderation restrictions block mature narration, and how a moderated voice fails (error code or silent refusal). These sit as [unverified] in 03 §14 Q9, 05 §6.9 OEM Q1 and 01 §16 Q12. 05 §6.5 also leans on library and premade voices for mature fiction without settling the terms.

**Why it matters:** The whole catalog strategy depends on this answer (curated library voices vs only voices we own). A wrong assumption could force a catalog rebuild or a terms violation after launch.

**How to close it:** Read the Voice Library Agreement and the ToS shared-voice clauses. Get written confirmation from ElevenLabs legal/sales covering B2C end-user selection, attribution and mature text. In staging, send mature roleplay text to one live-moderated library voice and record the response.

### G2. Voice catalog: library API semantics

Four library behaviours are untested:
- whether TTS works on a library voice that was never added to the account (05 says yes; 03 says it is undocumented);
- whether POST /v1/voices/add/{public_user_id}/{voice_id} returns a new id (03 Q2, 08 Q2);
- whether adding a shared voice uses a monthly voice add/edit operation (03 Q3);
- whether a deleted library copy can ever be re-added (03 §12.6 says no).

**Why it matters:** These decide what voice_provider_mapping.target_voice_id or voice_catalog stores, how many ops curating a catalog of about 100 voices costs, and whether admin delete is reversible.

**How to close it:** One paid staging key. Read /v1/user/subscription counters, add one library voice, compare original_voice_id with the returned id, call TTS with an un-added library id, then delete and re-add.

### G3. Voice catalog: previews

Preview handling is unresolved:
- preview_url values are time-bucketed (03 live probe), but their lifetime and our right to cache or re-host them are unknown (03 Q5);
- verified_languages[].preview_url coverage for es is unknown;
- 07 plans direct hotlinking from the SPA, while 03 plans a BFF-cached preview.mp3 served with public immutable caching.
No note checks whether re-serving ElevenLabs preview audio is allowed.

**Why it matters:** The pickers in both the user Voice Studio and the root console depend on this. Expiring URLs break stored previews, and re-hosting may break the terms.

**How to close it:** Fetch the same preview_url repeatedly over 48 h and record expiry and Content-Type. Ask ElevenLabs support or legal about caching. Count Spanish preview coverage on candidate voices.

### G4. Voice catalog: disappearing voices

Removal detection is designed (03 sync jobs and webhook, 08 guards) but not grounded:
- the webhook payload is unverified (03 Q14) and retries are not documented (03 Q17);
- magic-worlds-api has no inbound webhook route, signing-secret config or public HTTPS ingress today (dev BFF on :8010);
- no note sets the polling cadence against the 30-day minimum notice;
- no note specifies who is told when a voice is deprecating: card owners or only root. No user-facing copy, badge or email flow exists.

**Why it matters:** With no notice period, library voices vanish at once. Narration for every card, preset and frozen snapshot that uses the voice then fails, or silently switches voice.

**How to close it:** Enable voice webhooks on a staging workspace and capture real payloads. Check the deployment for public ingress. Design daily polling on disable_at_unix as the primary path. Define the owner-facing UX in the frontend plan.

### G5. Voice catalog: target account facts

No note inspected the ElevenLabs account that will be used: its plan, its creation date (only accounts created before March 2026 get Default voices, which expire 2026-12-31, about 11 weeks away), seats and service accounts, and existing voices, slots and ops counters. 03's live probe used only public preview URLs.

**Why it matters:** This decides whether premade voices exist at all as an interim default. It also decides slot and ops headroom and whether service accounts (multi-seat) are available. 05 makes service accounts the basis of its key topology.

**How to close it:** With the production key, call GET /v1/user/subscription, GET /v2/voices?voice_type=default and GET /v2/voices?voice_type=personal, plus the workspace or service-account listing. Record the results in the plan.

### G6. Data migration: production inventory

None of 08's §18 count queries were run. Unknown:
- the number of distinct MiniMax voice ids;
- how many are MiniMax custom cloned or designed voices rather than system voices;
- whether global voice_preset rows exist;
- how many recipes use pitch, vol or out-of-range speed.
No note checks whether the original clone source audio and the speaker's consent survive anywhere. minimax_voice_admin uploads to the MiniMax files API, so a local copy is unlikely. Re-creating a voice as an ElevenLabs IVC needs that audio and fresh consent.

**Why it matters:** These numbers decide the mapping curation effort, which custom voices can be re-created and which must be dropped, and how many users see a voice change.

**How to close it:** Run 08 §18 queries #1, #7–#11, #13, #18 and #23 on a read replica. Grep minimax_voice_admin.py and the storage paths for any persisted clone files. Ask the operator about hand-inserted global presets.

### G7. Voice catalog: per-model eligibility and timbre

No note defines an acceptance protocol (scripts, languages, rubric) for approving a mapping or marking a voice as call-eligible. This matters because:
- v4 coverage in verified_languages is partial (03);
- designed voices may be less performative on v4 (05);
- PVCs need fine-tuning per model (02);
- the same voice_id can sound different on Flash (calls) and v4/v3 (narration) (02 §16). A character could sound like two different people across chat and call.
08 says only 'audition by a human'.

**Why it matters:** Character voice consistency is the product. Mapping approval without a rubric is not repeatable, and approved voices can still fail on the call model.

**How to close it:** Write fixed en and es scripts (narration, dialogue, thought, numbers). Render each candidate on the narration and call models, score with a rubric, and store results per (voice, model, language) in the catalog.

### G8. Narration: language selection

language_code is mapped only from the legacy per-voice language_boost (01 §9, 08 §13). No note defines the request-time policy:
- voice recipe vs world/adventure language vs user UI locale (en/es) vs auto-detect;
- mixed-language turns;
- whether v4 wants ISO 639-1 or 639-3 [unverified].
02's TTD example hard-codes "es" with no stated source.

**Why it matters:** Spanish users get wrong number normalization or accent. It also changes the reuse-hash inputs (08 §12.4) and the Studio's language control.

**How to close it:** Staging test: es text on v4, Flash and multilingual_v2, with and without language_code, including numbers. Then decide the source of truth in the plan.

### G9. Studio: model capability behaviour

Several request behaviours remain [unverified] (01 §16/#39, 03 Q11, 08 Q9, 07 E4):
- whether speed, style and use_speaker_boost are ignored or rejected (422/400) on v3/v4;
- whether v3 stability only accepts 0/0.5/1;
- whether out-of-range speed is clamped or rejected;
- speed range 0.7–1.2 (product docs) vs 0.25–4.0 (SDK);
- TTD's similarity naming and per-model support.

**Why it matters:** These drive the proposed capabilities endpoint (07 §11.2), the Studio sliders, server-side stripping in the resolver, and error mapping. Getting them wrong produces 4xx errors on every narration.

**How to close it:** Contract-test matrix in staging: each model × each setting at edge values, recording the HTTP code and audible effect.

### G10. Studio: preview semantics

No note says which model renders a user's 'hear my recipe' preview when narration and calls use different models, so a preset could be auditioned on v4 but heard on Flash in calls.
The preview text policy differs: 03 allows fixed per-language texts only for non-root users; 07 keeps free text up to 400 characters.
The proposed voice_preview quota operation has no membership schema or pricing analysis (db.sql:916-942 seeds only tts_generation and voice_call).

**Why it matters:** Users tune presets they then do not hear. Unmetered or loosely metered previews were baseline issue #1.

**How to close it:** Decide one preview model per surface, or show both. Specify the voice_preview operation, its plan limits, and the shared cache key from 03 §12.4.

### G11. Studio: emotion and audio tags

Emotion and audio tags are not settled:
- The mapping of the 7 MiniMax emotions to v4 tags is [unverified], and the notes propose different tags (01 §5.3, 03 §12.8, 08 §13).
- Whether [slowly] and emotion tags replace speed and emotion is untested (03 Q10).
- No note defines escaping for literal square brackets in LLM or user narration text, such as OOC notes, '[Chapter 2]' or markdown links. v3/v4 would read these as audio tags; 01 only checks that the sanitizer does not eat real tags.

**Why it matters:** Wrong or unescaped tags produce audible artifacts or unintended delivery in every narrated turn. This is also an injection vector from user-authored card text.

**How to close it:** Listening tests per emotion tag on 3–5 catalog voices. A staging test with bracketed non-tag text. Then define a sanitizer rule that keeps only allow-listed tags and escapes or strips the rest.

### G12. Studio: volume and loudness replacement

The notes propose four different replacements for MiniMax vol and thought dimming:
- client gain about 0.7 (01);
- −4 dB server gain (02);
- −16 LUFS normalization plus gain_db (03);
- per-kind client gain or [whispers] (08).
No note measures loudness variance across candidate voices, or checks whether server-side loudnorm or re-encode (cost, latency, tooling) fits the narration job pipeline.

**Why it matters:** Mixed library, designed and IVC voices differ in loudness. Without a decision, multi-voice turns jump in volume and the thought styling regresses.

**How to close it:** Measure the integrated LUFS of about 20 candidate voices per model. Prototype loudnorm on the transcode path used for theme songs and time it.

### G13. Root console: IVC and design compliance

Several root-console flows are unresolved:
- how requires_verification is completed outside the dashboard (03 Q7);
- the legal wording and retention of the IVC consent attestation and uploaded samples;
- a no-go voice policy (public figures, child-like voices) as an enforceable check;
- the lifetime of generated_voice_id between design and save (03 Q8), which bounds the preview-grid UX.
03 proposes a voice_consent_record table but no consent text or retention period.

**Why it matters:** Cloning without consent is a policy and legal risk that ElevenLabs traces to our account. An expired generated_voice_id loses paid designs.

**How to close it:** Staging: run IVC with a consenting speaker and record the verification path. Save after 1, 10 and 60 minutes. Legal drafts the consent text and the retention period.

### G14. Realtime calls: unresolved protocol facts

Several call-path facts are open:
- whether eleven_v4_turbo works on the multi-context TTS socket or over HTTP (06 Q2, 03 Q15);
- close_context behaviour on barge-in (02 vs 06);
- the WS error and close-frame shapes (06 §11.3);
- behaviour on an unknown voice_id on stream-input (08 Q9);
- whether WS MP3 chunks are frame-aligned. This affects the per-sentence billing parser at engine.py:1579-1599 and the frontend whole-frame cutter (06 Q5);
- the Scribe realtime session cap;
- per-character voices in Speech Engine (02).

**Why it matters:** The call architecture choice (A1 vs B vs Speech Engine), barge-in correctness and billing accuracy depend on these.

**How to close it:** Run 02 §13.4's spikes with the acceptance criteria already written. Add frame-alignment and unknown-voice cases.

### G15. Platform: consolidated staging spike and cost model

About 30 [unverified] items across 01–08 need a paid staging key, but no note lists them as one spike with an owner, budget and exit criteria; only 02 does this for calls.
Cost figures are spread out with no single monthly model. 05 covers narration and notes that the v4 promo has expired; calls, previews, design and library multipliers are in other notes, and the Speech Engine multiplier conflicts (3.5x vs 4x).
The cost header name (character-cost vs x-character-count) is unverified (06 Q3), and so is Retry-After on 429 (01).

**Why it matters:** Without the spike, backend contracts get written against guesses. Without a cost model, the plan tier and the membership re-pricing cannot be decided.

**How to close it:** Collect every [unverified] tag into a spike backlog with test scripts. Build one spreadsheet from list prices for narration, calls, previews, design and ops at three usage levels.

### G16. Policy: age gate adequacy

05 §6.2 says magic-worlds must be 18+ or limit voice features to verified adults. No note checks the current mechanism, which is a first-run self-attestation stored in localStorage (warning.ageRequirement at en.ts:879, AppWarningModal). Server-side gating of voice features is also unchecked.

**Why it matters:** ElevenLabs ToS and PUP require adult users. A dismissible client-side modal may not satisfy the terms or the OEM flow-down.

**How to close it:** Legal review of the attestation. Check whether the backend records age acceptance per user before allowing narration or calls.

### G17. Rollout mechanics

08 §14.2 defines expand → migrate → switch → contract, but the switch is a global flip. No note designs:
- a canary or per-group provider routing in the BFF;
- a dual-provider period;
- cutover monitoring and alert thresholds;
- the MiniMax key revocation date;
- rollback criteria after the switch, where 08 only says rollback contradicts the goal.

**Why it matters:** Narration and calls are user-facing and costly. A big-bang switch with no canary risks a global outage, for example from a bad TTS_DEFAULT_VOICE_ID (08 §15 A'').

**How to close it:** Decide whether the voice provider discriminator (08 §12.1) plus a per-group backend flag can route canary users. Define SLO alerts on tts_failed rate and first-audio latency.

## Contradictions between notes

### C1

- **Claim A:** Default/premade voices are an acceptable default. 01 §18.2 item 2 says 'Prefer default voices', and 01's examples use George. 05 §6.5 and §11.6 say 'prefer default voices and our own Voice Design voices'. 06 §11.5 uses /v2/voices?category=premade for /voice-presets/system-voices. 07 suggests 'Default ElevenLabs voices' copy and a default/premade user catalog.
- **Claim B:** Never build on or map to Default voices: they expire 2026-12-31 and accounts created after March 2026 never get them (03 §1 item 1, 08 §1.5 and §11.2).
- **Where:** 01_elevenlabs_tts_models_and_api.md §18.2; 05_elevenlabs_platform_pricing_limits_policy.md §6.5/§11.6; 06_backend_minimax_inventory.md §11.5; 07_frontend_minimax_inventory.md §3.1/§7.1; 03_elevenlabs_voices_catalog_cloning_design.md §1; 08_voice_data_model_migration_surface.md §1/§11.2

### C2

- **Claim A:** Frozen snapshots are not rewritten; the resolver translates legacy MiniMax snapshots at read time through voice_legacy_mapping (03 §12.9 step 3).
- **Claim B:** A one-shot rewrite of every session snapshot is mandatory, especially character-chat snapshots, with the lazy resolver only as a safety net (08 §14.1). 08 §14.4 then shows that rewriting snapshots breaks retry and recovery of pre-migration turns with CHAT_RETRY_CONFLICT 409.
- **Where:** 03_elevenlabs_voices_catalog_cloning_design.md §12.9; 08_voice_data_model_migration_surface.md §14.1/§14.4

### C3

- **Claim A:** Voice identity goes through our own catalog key: CharacterVoice v2 stores voice_key, a stable uuid into a synced voice_catalog, with voice_legacy_mapping and replacement_voice_key handling removal (03 §12.3–12.9).
- **Claim B:** CharacterVoice v2 stores the raw ElevenLabs voice_id plus a voice_name display cache, with a separate voice_provider_mapping table and a voice_migration_audit table and no catalog indirection (08 §12.1–12.3). 07 also stores the raw voice_id plus voice_name.
- **Where:** 03 §12; 08 §12; 07 §2.1

### C4

- **Claim A:** The recipe carries model choice and stored delivery tags: delivery, playback_gain and model_id (01 §15.4); tag_prefix, gain_db and model_policy (03 §12.8); an optional model_id and a delivery_tag (07 §2.1, checklist item 9). Emotion is deleted or replaced by a tag (07).
- **Claim B:** Do not store the model id per voice, and keep emotion as the provider-neutral 7-value enum translated to tags at request time. Settings sit in a nested settings{} object (08 §12.1). 07 instead proposes flat stability and similarity_boost fields on CharacterVoice.
- **Where:** 01 §15.4; 03 §12.8; 07 §2.1/§12.1; 08 §12.1

### C5

- **Claim A:** Emotion → tag mapping: happy→[cheerful], and other values per 03 §12.8 (tag_prefix).
- **Claim B:** happy→[happily], calm→[calmly], fearful→[nervously], and others (08 §13). 01 §5.3 gives a third table. All are partly [unverified].
- **Where:** 01 §5.3; 03 §12.8; 08 §13

### C6

- **Claim A:** Narration architecture:
- per segment eleven_v4 over POST /v1/text-to-speech, as today (01 §15.1);
- or eleven_multilingual_v2 or Flash (06 §11.2 and Q1).
- **Claim B:** Other notes recommend differently:
- one Text to Dialogue request per turn on v4, with a single global settings object, a single clip and the TurnNarration player replaced (02 §13.3);
- Flash v2.5 as the default with v3/v4 as a premium option (05 §10.2).
02's TTD design cannot honour per-character Studio recipes (stability or similarity per voice), which 01, 03, 07 and 08 all assume.
- **Where:** 01 §15.1; 02 §13.3; 05 §10.2; 06 §11.2/§12; 07 §6.1

### C7

- **Claim A:** eleven_v4 is confirmed on the TTS HTTP endpoint /v1/text-to-speech (01 §1.1 matrix and §15.1).
- **Claim B:** Whether v4 works on /v1/text-to-speech or only through Text to Dialogue is an open question (08 Q7; 02 unverified). 05 treats TTD as the only HTTP path.
- **Where:** 01 §1.1/§15.1; 02; 05; 08 §19 Q7

### C8

- **Claim A:** close_context gives a clean barge-in cancel (06 §11.3 'close_context:true' on cancel; 01).
- **Claim B:** close_context keeps flushing audio that was already flushed, so the client must drop stale chunks by sequence (02, verification correction).
- **Where:** 01; 02; 06 §11.3

### C9

- **Claim A:** Callbot pauses: replace <#x#> with <break time=…/>, let the sanitizer allow <break …/>, and stop the sentence buffer from splitting inside it (06 §11.4). 02 §13.2 says 'model-aware markup'.
- **Claim B:** The sanitizer fails closed on any XML/HTML-shaped tag, so the LLM prompt must not emit <break/>. Keep a neutral marker in stored text and convert it after validation (08 §6.2).
- **Where:** 06 §11.4; 02 §13.2; 08 §6.2

### C10

- **Claim A:** Library voices can be used through the API without adding them to the account (05).
- **Claim B:** This is undocumented. Always add library voices and store the returned id (03 §1, §14 Q1; 08 §11.1).
- **Where:** 05; 03 §14; 08 §11.1/§19

### C11

- **Claim A:** Pro plan (160 slots, 290 ops) is enough for the catalog (03 §12.6). Business has 660 slots (07 E13, 03 help-center figure).
- **Claim B:** Scale or above is required because the OEM terms bar Free–Pro from 'Making Available', and service accounts need multi-seat (05). 05 states Business at 2,200 slots. Business concurrency also differs between notes (15 vs 25).
- **Where:** 03 §12.6/§14 Q4; 05 §2/§6.9; 07 E13

### C12

- **Claim A:** Catalog browsing calls ElevenLabs live: paginated /v2/voices with next_page_token, ▶ direct preview_url hotlinking from the SPA, and free-text recipe previews up to 400 characters (07 §3.1, §5.1, §11.3).
- **Claim B:** Use a DB-backed synced voice_catalog with server-side filtering ('no live provider calls per user keystroke'), BFF-cached preview.mp3, and fixed per-language preview texts only for non-root users (03 §12.4–12.5).
- **Where:** 07 §3.1/§11.3; 03 §12.4/§12.5

### C13

- **Claim A:** Admin delete maps directly to DELETE /v1/voices/{voice_id}; the only guard is 'premade not deletable' (06 §11.5; 07 §4.1 useVoiceStudio).
- **Claim B:** Never delete a library copy until all references are migrated, because a deleted copy cannot be re-added; reference tracking is required (03 §12.6).
- **Where:** 06 §11.5; 07 §4.1; 03 §12.6

### C14

- **Claim A:** Thought dimming is client gain of about 0.7 plus a [whispers]/[softly] prefix, using the character's voice (01 §8, §15.4). 08 uses client gain per kind or [whispers].
- **Claim B:** 02 uses [whispers] plus an optional −4 dB server gain over voice_segments, and its TTD example voices the thought with the <narrator> voice. 03 uses −16 LUFS normalization plus gain_db.
- **Where:** 01 §8/§15.4; 02 §13.3; 03 §12.8; 08 §13

### C15

- **Claim A:** Membership credits are re-tuned using the v4 promo price of $0.022/1k characters (08 §18 row 28).
- **Claim B:** The promo ended 2026-10-12 ('do not plan on it'). v4 list price is $0.08/1k, about +33% vs MiniMax (05 §10; 03 Q12).
- **Where:** 08 §18 row 28; 05 §10; 03 §14 Q12

### C16

- **Claim A:** Remix works on library voices with an infinite notice period (07 E19, verified).
- **Claim B:** Sources conflict: some say only owned voices can be remixed (03 Q16). 01 says remix applies to 'owned or default voices'.
- **Where:** 07 §1 E19; 03 §14 Q16; 01 §8

### C17

- **Claim A:** Flash v2.5 text normalization is off by default, and 'on' is Enterprise-only (01).
- **Claim B:** Off (models page) vs on (best-practices page) is unresolved (06 Q4). The sanitizer's digit handling depends on it.
- **Where:** 01 §10.1; 06 §12 Q4

### C18

- **Claim A:** Speech Engine costs 3.5x (02).
- **Claim B:** Speech Engine costs 4x (05).
- **Where:** 02; 05

## Decisions needed from the product owner

1. Scope of 'remove MiniMax': does it include the fal-hosted minimax/music-3 theme-song model? Options: keep it, default to ace_step, or adopt Eleven Music, which 04 says needs Scale/Business and carries Model-Resale terms risk. Today 06 and 07 treat it as a separate decision, and 08 says leave it alone.
2. ElevenLabs plan and account: Pro vs Scale vs Business vs Enterprise. This weighs the OEM 'Making Available' rule, service accounts, slots and ops, concurrency, and ZRM/EU residency. It also needs confirmation of which existing account (creation date) is used.
3. Narration architecture and model:
- per-segment TTS on v4 vs Text to Dialogue per turn vs Flash default with a v3/v4 premium tier;
- acceptance of about +33% cost vs MiniMax at post-promo list prices.
4. Call architecture and the latency target: Flash multi-context TTS with Groq STT (A1), Scribe relay (B), Speech Engine, or v4 Turbo over the TTD WebSocket. Also: is it acceptable for a character to sound different in calls (Flash) than in narration (v4/v3)?
5. Keep Groq STT or move to Scribe v2 Realtime, and whether to add Scribe batch dictation.
6. Catalog sourcing policy:
- owned designed/IVC voices only, or also curated library voices (notice ≥365 days, no custom rate, no live moderation for mature content);
- an explicit ban on Default/premade voices;
- target catalog size and en/es coverage.
7. Voice identity model: an internal voice_key catalog indirection (03) or the raw ElevenLabs voice_id plus a mapping table (08). Pick one CharacterVoice v2 schema: flat or nested settings; whether model_id is stored; whether emotion is a neutral enum, a stored tag prefix or deleted.
8. Whether non-root users may ever create voices (design, remix or clone; slot-metered). Whether the root console exposes Voice Library import, Remix and PVC.
9. Treatment of user pitch and volume settings during migration: drop silently, warn in the UI, flag for review, or approximate with gain_db or a different target voice.
10. Thought narration delivery: a [whispers]/[softly] tag, client gain, server gain or LUFS normalization, or a combination. Also whether thoughts use the character's voice or the narrator's.
11. Snapshot migration strategy: a one-shot rewrite (accepting 409 on retries of old failed turns) or read-time translation. Policy for unmapped voices (null, fall back to default, or fail), and whether users see a 'voice needs re-selection' badge.
12. Fate of MiniMax custom (cloned or designed) voices: re-create them on ElevenLabs, which needs source audio and fresh consent, or retire them. Whether global presets are migrated or re-seeded as curated ElevenLabs presets.
13. Preview policy for the user Voice Studio: fixed per-language texts or free text, which model renders the preview, and whether it is a new metered voice_preview membership operation with its own limits.
14. Billing unit: keep 1 credit per tts_generation request, or move to character-based credits with a per-turn character cap and a premium price for expressive narration. Re-price the plan limits.
15. Privacy posture: buy Enterprise ZRM, or accept ElevenLabs history retention with a history-deletion sweep and rewrite the 'not stored' copy. The owner must also confirm the consent text rewrite, the VOICE_CONSENT_VERSION bump and who signs off the legal review.
16. Content policy: disable narration and calls for NSFW-rated adventures until ElevenLabs confirms in writing? Which companion safeguards are adopted for the 'harmful emotional dependency' clause? Is the current localStorage 18+ self-attestation sufficient?
17. Legacy data: keep MiniMax MP3s and history rows readable (widened validators) or purge them, and whether a reviewed orphan sweep runs during the cutover. This depends on MiniMax contract terms on retaining audio.
18. Rollout: big-bang switch or canary with per-group provider routing. Set the MiniMax key revocation date and the rollback window and criteria.
19. Call output format: stay on MP3 (which rate) or move to PCM with an AudioWorklet for lower latency.
20. Integration style: raw httpx/websockets (recommended by 05/06) or the official elevenlabs SDK.
21. API key topology: one key, or scoped keys/service accounts per surface (narration, calls, preview, catalog, admin, media) with per-key credit quotas.
22. Whether to add new ElevenLabs-enabled features now or later, from 04's P0–P3 backlog: pronunciation dictionaries for world and character names, word-highlight timestamps, SFX ambience, adventure audio export.
23. Speed range exposed in the Studio: clamp to the documented 0.7–1.2, and hide speed and style when the narration model is v3/v4.
