# Feature availability and implementation

<a id="feature-status"></a>

**Source/documentation review: 2026-10-15; gates rechecked against source 2026-10-26.** This register describes reviewed source and the seeded plan configuration. It does not attest the bundle, plan grants, database or provider state of a running installation. [The documentation matrix](STATUS_MATRIX.md) separates delivery and document lifecycle; [the roadmap](ROADMAP.md) retains remaining acceptance.

<a id="status-rules"></a>
<a id="product-rollout-register"></a>

## Gate rules

Since 2026-10-18 (SPA `692e56bb`, BFF `70c9c27`) temporary product access comes from each user's membership plan, not from build-time variables. There are no frontend `VITE_FEATURE_*` variables; [`.env.example`](../.env.example) keeps only `VITE_API_BASE_URL` and `VITE_MAINTENANCE_MODE`. The SPA reads `GET /user/me/features` (plus `/user/me/features/events` invalidation hints) into [featureFlagRuntime.ts](../src/shared/featureFlagRuntime.ts), and [featureFlags.ts](../src/shared/featureFlags.ts) maps pages, content types, LLM features and operations onto the nine keys generated in [featureFlagCatalog.ts](../src/shared/featureFlagCatalog.ts) from the BFF catalog. The BFF enforces the same grants at every attached route, socket and queued job (`FEATURE_FLAG_OFF` is `403`; chat sockets close with `4453`). Registration, cache and removal rules are in the [membership feature-flag dossier](feature_flag_on_membership/README.md).

- Only an explicit `true` grant enables a flag. Missing, null and unknown keys are off, and an enabled child also needs its parent: calls need voices, lorebook resources need lorebooks.
- Root accounts bypass every rollout flag. Signed-out visitors evaluate every flag as off.
- A loading, expired, unavailable or catalog-mismatched permission snapshot denies access instead of falling back to on.
- The seeded Free plan grants all nine flags; new custom plans default to none. Each flag has a removal task and a 2026-11-17 review date in the [implementation status](feature_flag_on_membership/13_implementation_status.md).
- Workspaces graduated on 2026-10-18 and has no flag: the Library, switcher, collections and copy are available to every signed-in user.

Disabled page features are hidden from navigation and render Not Found through [AppRouter](../src/app/router/AppRouter.tsx); there is no universal WIP placeholder. Implemented features remain implemented when a plan does not grant them, while their availability and release acceptance remain WIP.

| Feature | Plan flag key | Seeded Free / new plans | Implemented foundation | Remaining boundary |
|---|---|---|---|---|
| Community | `communityCards` | Granted / off | Sharing, community and shared-card routes | Ownership, revocation, shared media and import acceptance |
| Lorebooks | `lorebooks` | Granted / off | Authoring, entries, attachments, activation, assistant | Prompt/trace, scope, lifecycle and rollout acceptance; [reference](lorebook/README.md) |
| Lorebook resources | `lorebookResources` | Granted / off; requires `lorebooks` | Text resources, PDF and URL-to-Markdown import, metadata extraction | Extraction also needs BFF `LOREBOOK_EXTRACTION_ENABLED` (default off) and LLM profile transport; runtime/profile, retry, archive and deletion acceptance |
| Voices / narration / root voice admin | `voices` | Granted / off | Catalog, recipes, narration and administration | Server provider, moderation, quota and runtime gates also apply |
| Calls | `calls` | Granted / off; requires `voices` | Calls page, session controller, transport, and 1:1 chat replay/transcript linkage for completed call turns | Server voice mode, provider/STT readiness, consent, quotas, partial barge-in audio retention, and real-device acceptance |
| Novel / Story Studio | `novels` | Granted / off | Scene editor, organization history, inline generation, Codex, story-aware novel assistant, import/export | Remaining D2–D6 work and release gates; [status](novel_refactor/14_status_and_roadmap.md). The Codex hides lorebook-entry refs while lorebooks are off and adventure-template refs while adventures are off; stored refs are not altered, and enabled hidden refs still reach server-side generation context |
| Group conversations | `groupChats` | Granted / off | Group behavior in the existing chatroom | The chatroom and 1:1 chat remain available independently |
| Adventures | `adventures` | Granted / off | Creator, gallery, sessions and interaction | Stored-history, stream/media and matching-deployment acceptance |
| App assistant | `appAssistant` | Granted / off | Dedicated page and shared assistant client | BFF registry and usable `app_assistant` profile required; the BFF refuses to start with any enabled assistant kind unless `LLM_PROFILES_ENABLED=true` and `MAGIC_LLM_API_URL` are set |

Evidence: [flag tests](../src/shared/featureFlags.test.ts), [flag provider](../src/app/providers/FeatureFlagProvider.tsx), [wire contract](../src/infrastructure/api/featureFlagContract.ts), [API client](../src/infrastructure/api/index.ts), [voice availability](../src/features/interaction/hooks/useVoiceAvailability.ts), and the BFF [plan feature permissions contract](../../../PycharmProjects/magic-worlds-api/docs/api_usage/platform.md).

<a id="other-gates-and-ungated-foundations"></a>

## Independent foundations and server gates

| Area | Availability contract | Current disposition |
|---|---|---|
| Stripe purchases | Signed-in user and a `GET /billing/plans` catalog the server returns with `enabled: true` ([useBillingCatalog](../src/features/billing/hooks/useBillingCatalog.ts)) | No frontend switch since SPA `692e56bb`. A disabled server answers `503` and the purchase UI stays hidden; purchase acceptance open; [setup](billing/SETUP.md) |
| Patreon | Backend reconciliation (`PATREON_PROVIDER_SYNC_ENABLED`) | Client methods and the BFF `/patreon/link/*` proxy (to api.auth link proof) exist with no frontend switch; no connect UI calls them |
| Card/story text streaming | Caller-selected transport | No frontend switch. Card and story generation stream when the caller passes `onEvent` and use the synchronous endpoint otherwise; chat and assistant streams are separate |
| LLM profiles | BFF `LLM_PROFILES_ENABLED`, configured catalog/targets and selected profiles | Functional foundation present. Since 2026-10-18/19 a BYOK key travels in a separate `request_credentials` field that api.magic_llm drops before admission and snapshots (BFF `7f7eac7`, api.magic_llm `be1ab64`), and the in-app copy now promises only tab-memory storage (SPA `692e56bb`). End-to-end custody acceptance (F04) is still open; [actual transport](llm_profiles/16_current_status_and_roadmap.md). The Models and profiles page (`#/models`) and the Image profiles page (`#/image-models`) have no flag and appear to every signed-in user; per-feature model controls follow their owning feature's flag |
| Assistants | BFF `ASSISTANTS_ENABLED` lists the served kinds: `card`, `lorebook`, `app`, `novel` | The card assistant has no plan flag. The lorebook, app and novel assistants also need their owners' plan flags (`lorebooks`, `appAssistant`, `novels`) |
| Character/world/item creation and 1:1 chat | No corresponding plan flag | Authentication, scoped workspace, API and generation configuration remain prerequisites |
| Membership, grants and root consoles | Independent of checkout UI | Credit accounting, redemption, quotas, plan feature grants and membership administration remain applicable. Plans also carry daily narration-character and call-second caps (`daily_quantity_limit` for `tts_generation` / `voice_call`), enforced at runtime |
| Image generation | Existing profile/media routes; no dedicated Chara Studio flag | Generation implemented; editing/reference workflows planned. A flag cannot supply the missing DTO/route |
| PNG export | No dedicated product flag; browser runtime required | Implemented; private image fidelity and deployed rendering acceptance open. The client blocks export for card types whose plan flag is off (adventure-template export needs `adventures`); the BFF route has no content-type gate |
| Moderation | Existing server speech gate; optional/required mode is separate from health | Native multimodal checks and `moderation_enabled` profile fields remain planned; [accepted scope](moderation/README.md) |
| Fish Audio | Server Fish key, account readiness and the voices/calls plan grants | M0–M7 implemented; contract in the BFF [Fish Audio guide](../../../PycharmProjects/magic-worlds-api/docs/fish_audio.md). R1–R4 release acceptance is open in [V-14](voice_refactor/00_current_status_and_roadmap.md) |
| Maintenance page | Exact `VITE_MAINTENANCE_MODE=true` at build time | Deployment-wide standalone page; not a runtime switch or backend access control |

Current BFF source expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (`2026_10_db_refactor` at the 2026-10-26 docs cleanup); the stable workspace capability marker remains `2026_10_workspace_r1`. The `.90` test database was upgraded to `2026_10_db_refactor` on 2026-10-26 (120 tables, verifier passing; [DB audit status](db_audit_241026/README.md#execution-status-2026-10-26)); production is not asserted here. Consult [bootstrap](../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py) and the revision-matched backend operations guide before any schema handoff. This register does not claim a running migration or provider state.

No private credential values are documentation evidence. Environment acceptance must record the actual built client, deployed service revisions, schema and the plan grant matrix.
