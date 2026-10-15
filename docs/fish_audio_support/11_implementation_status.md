# Fish Audio implementation status

Updated October 15, 2026. Native Drama 3 HTTP integration is implemented across
the frontend and `magic-worlds-api` working trees. It remains disabled by default.
The confirmed development database is upgraded, English/Spanish root voice
creation is configured, and Gabriel was the first approved Spanish development
starter with preview/narration enabled. Twelve original EN/ES example voices were
later published after automatic checks, pending owner listening; see the
[example voice set](19_example_voice_set.md). Production rollout remains gated. This records code and
development evidence, not complete release acceptance.

The owner-prioritized catalogue/voice-creation development release is usable in
the running app: **Voices → My presets → Gabriel · Español** now contains the
approved Fish voice with working sample playback. **New preset** exposes both
languages initially; **Root → Voice console → Catalog → Voice provider → Fish
Audio** isolates the eight distinct references and correctly shows Gabriel's
Drama 3 approval. Seven unselected auditions remain drafts. Root Fish design
exposes English/Spanish creation. Live calls still use ElevenLabs; Fish calls
and multi-speaker narration remain disabled follow-up capabilities. Catalogue
fixes passed 98 focused frontend tests plus 83 editor/studio tests, 133 backend
catalogue tests, production build and scoped lint. Browser save/read-back and
sample playback used the real authorized development root account.

## Delivery status

| Milestone | Current state |
| --- | --- |
| M0 — contract/readiness | Shared fixtures and four real native HTTP renders passed. Free-plan/prepaid API access, account pricing in USD per UTF-8 byte and licensed EN/ES references verified. Request-level debit reconciliation, production retention, EN/ES listening and browser acceptance remain pending. See [development evidence](12_development_validation.md). |
| M1 — foundation | Implemented: strict v2/v3 reads, provider/profile capabilities, negotiation, versioned caches and an additive migration. Applied to the owner-confirmed stopped development database after verified backup/restore; existing rows preserved. |
| M2 — native HTTP/catalogue | Implemented: bounded native adapter, owned inventory/reference import, EN/ES licensed discovery with search/pagination, account-wide admission, spend estimates, independent breakers, admin lab, acceptance and samples. Live reference acceptance pending. |
| M3 — presets/previews/narration | Implemented: catalogue filters and picker labels, provider-aware recipe editor, metered stock-text previews, assignments, mixed-provider per-segment narration and EN/ES disclosures. Real MySQL/native HTTP application-flow test passed; listening and full staged R1 acceptance pending. |
| M4 — advanced performance | Implemented behind its own disabled flag: trusted direction/phrase/event schema, grapheme-safe source maps, pinned pronunciation versions, authenticated metered authored previews, narration integration and optional editor. Native Gabriel application test passed; R2 listening remains open. See [advanced handoff](14_advanced_performance_development.md). |
| M5 — whole-scene narration | Planner, owned job/API and session controls implemented behind a disabled flag. Explicit native PCM and owned MP3 encoding passed four speakers at 1,200 compiled characters plus fresh owned-asset reuse, after incomplete native MP3 tails. R3 identity/order, word and device review remain open. See [scene handoff](16_scene_narration_development.md). |
| M6 — native calls | Engine/factory, native bridge, word ledger, shared streaming admission and provider-aware call/consent UI implemented. Configured development schema upgraded after verified backup/restore; every transitional reader shape passed real MySQL checks. Native engine completion/cancellation passed with explicit application fixtures. Real root login/profile resolution and the callbot graph/reply collector also passed; required moderation timed out at its preview deadline. Calls remain off pending required moderation and full application/device/latency/debit R4 acceptance. See [call engine handoff](18_call_engine_development.md). |
| M7 — voice creation | Development workflow implemented and tested in EN/ES: description → candidates → signed private persistence → local draft/owned preview → new Drama speech. Prioritized by the owner over expanding the starter catalogue. Live root EN/ES creation capability and the sole Gabriel catalogue entry also passed; current-SPA version-4 catalogue negotiation is fixed. Production quality/rollout acceptance remains separate. |

ASR, hosted Agents, self-hosting and hosted editing remain outside this integration.

## Settled contracts

- Application provider `fish_audio`, profile `fish_drama_3`, native header
  `model: drama-3`. Native JSON HTTP for previews/narration and separately gated
  MessagePack timestamp WebSocket calls; no compatibility endpoint or model override.
- Fish stored voices/presets use version 3 and the existing opaque `voice_key`.
  ElevenLabs records retain version 2. Fish settings are null/empty; numeric
  ElevenLabs controls are rejected. Provider changes require explicit settings.
- The SPA sends `X-MW-Voice-Contract: 4`; the provider capability envelope stays version 3. Legacy catalogue reads omit Fish;
  owned Fish content requires an upgraded reader (`409 voice_client_upgrade_required`).
  Missing or unknown Fish capability data disables its controls.
- R1 uses the seven semantic emotions and a server-owned soft thought cue.
  Ordinary content is sanitized and moderated before provider dispatch. Native
  provider markup, arbitrary direction and seed controls are not exposed for Fish.
- A catalogue entry is one distinct provider reference, not a mood variant.
  Root can browse licensed English/Spanish identities and import them as drafts.
  Neutral auditions compare identities; emotion/quality clips remain samples
  attached to their original voice. The owner's requested catalogue covers both
  languages, with the approved Spanish identity retained.
- Fish supports Standard previews/narration with validated mono 44.1 kHz,
  128 kbps MP3. Optional scene synthesis explicitly requests native 16-bit PCM,
  then encodes the complete response to owned MP3 with a versioned renderer. A mixed cast uses the application's existing Standard turn tier;
  each segment retains its own provider, model and reuse identity.
- Failed Fish requests do not silently substitute another voice/provider or
  automatically retry uncertain generation. Fish call starts require the separate
  release flag, explicit voice call approval and expanded `voice-v3` processing consent.
- Existing application credits, confirmations, owned assets and refund behavior
  are reused. Supplier attempts separately retain configured counting units,
  dated price estimates and outcomes, including uncertain cancelled requests.
  These estimates are not actual debit reconciliation.

The shared fixture is
[fishAudioContract.fixture.json](/home/andres/WebstormProjects/magic-worlds/src/shared/voice/fishAudioContract.fixture.json),
mirrored byte-for-byte in the backend's `tests/fixtures/fish_audio_contract_v3.json`.

## Implementation entry points

| Area | Source |
| --- | --- |
| Native transport, admission and gates | [Fish provider package](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/providers/fish_audio/) |
| Resolution and projection | [Resolver](/home/andres/PycharmProjects/magic-worlds-api/src/services/speech/resolver.py) |
| Additive migration | [Migration CLI](/home/andres/PycharmProjects/magic-worlds-api/scripts/migrations/20261015_fish_audio.py) |
| API contract and rollout details | [Backend integration guide](/home/andres/PycharmProjects/magic-worlds-api/docs/fish_audio.md) |
| Provider-aware controls | [Preset editor](/home/andres/WebstormProjects/magic-worlds/src/features/voices/components/PresetEditorV2.tsx) |
| Root inventory/import | [Fish reference panel](/home/andres/WebstormProjects/magic-worlds/src/features/admin/voices/components/catalog/FishInventoryPanel.tsx) |
| Fail-closed UI capabilities | [Capability reader](/home/andres/WebstormProjects/magic-worlds/src/shared/voice/voiceCapabilities.ts) |

## Verification

Automated validation uses synthetic content, fake transports and in-memory
database/storage seams. It covers strict requests/model headers, malformed and
stereo audio, incomplete/repeated inventories, provider/key mismatches, language
acceptance, cancellation/admission, missing moderation, mixed-provider narration,
one turn charge, assets, editor provider changes and legacy compatibility.

| Check | Result |
| --- | --- |
| Backend full pytest suite | 14,062 passed, 754 skipped, eleven live-provider cases deselected after the scene PCM renderer and catalogue contract fix. Focused codec/scene checks passed (64); catalogue/recipe/performance/codec regressions passed (73). |
| Backend final contract/write checks | 105 passed, including integer-version rejection and a preview-only pilot saving presets before narration enablement. |
| Final config/migration/provider guard checks | 62 passed, including refusal of enablement without an explicit billing unit. |
| Frontend full Vitest suite | 4,194 passed across 400 files after provider-aware calls, consent and correlated browser timing; repository grep gate passed. |
| Frontend focused Fish/editor/legal checks | 77 passed. |
| `pnpm build` | Passed. |
| `pnpm typecheck:stories` | Passed. |
| Scoped frontend ESLint | No errors; existing Fast Refresh export warning in `CatalogVoiceRow.tsx`. |
| Both repository diffs | `git diff --check` passed. |
| Opted-in native HTTP | Passed with the temporary key; four successful synthetic requests including the development probe. |
| Isolated MySQL migration/admission | Passed; native data preserved, schema/version checks verified, shared account locking/spend tested, temporary database removed. |
| Isolated application flow | Passed: native EN/ES previews, free cache hits, one paid preview credit, preset/assignment persistence, completed narration/owned asset/one turn charge and reuse. Auth/account/moderation/listening fixtures are explicit. |
| Isolated creation + migration | Both passed: EN/ES candidates, signed private save, actor isolation, owned MP3, no duplicate on repeated save, publication provenance and persistent-model Drama TTS. Private provider fixtures and temporary databases removed. |
| Owner sample listening | Spanish approved for development; English rejected for metallic sound/pitch. Private approved languages restricted to `es`; broader acoustic acceptance remains open. |
| Browser fixture | Fish identity/disclosure, curated controls, preview failure preserving the draft and preset save passed in the built Storybook. Real browser audio/device acceptance remains open. |

The M7 handoff's frontend suite passed, including the repository grep gate and
WebSocket checks. Concurrent documentation, library and feature-flag changes
were preserved; their current state is included in the production build check.

The owner authorized the temporary development key and confirmed the stopped
development database for the schema handoff. Backup/restore and row preservation
were verified before/after both additive migrations. The current revision is
`2026_10_fish_design` at that handoff. The M4 expansion and its current verification are recorded in the [advanced handoff](14_advanced_performance_development.md). The backend `.env` enables EN/ES root creation and Spanish
user preview/narration; the example contains no secret and stays disabled by
default. Gabriel was activated on the owner's qualitative approval; no numeric
scores were invented. The twelve example voices that followed were accepted
automatically, also without scores, and the development `.env` now approves `en`
(effective after the API restarts). See the
[creation handoff](13_voice_creation_development.md) and the
[example voice set](19_example_voice_set.md). Production rollout remains off.

## Enablement handoff

1. Back up the database and stop API workers for the exact-revision schema
   handoff. Run both Fish migrations' read-only checks and apply them explicitly,
   in order: `20261015_fish_audio.py`, then `20261015_fish_design.py`.
   Do not use the historical native purge/cutover for this change.
   The optional M4 expansion follows with `20261015_fish_performance.py`, after
   every worker uses the compatible reader and the performance flag is off.
   Its restored backup, unchanged existing rows and current 101-table development
   schema are recorded in [M4 evidence](evidence/2026-10-15-performance.json).
2. Deploy compatible backend readers on every worker, then the negotiated SPA.
3. Configure the server's Fish key, stable supplier account ID shared by all
   workers/keys, languages, concurrency, daily cap, counting unit and dated price.
   Review account eligibility, billing and retention before account readiness.
   Keep preview/narration gates off during staging acceptance.
4. Import approved owned/licensed references as admin drafts. Use Drama acceptance
   and owned samples for each intended language; complete reference-rights review.
5. Run the opt-in synthetic HTTP contract probe, EN/ES listening corpus, real debit
   checks and browser playback checks. Enable previews/narration independently
   only after the relevant acceptance passes.

Rollback disables new Fish generation while retaining compatible readers, schema
and owned assets. Calls and later authoring features retain their own plan gates.
