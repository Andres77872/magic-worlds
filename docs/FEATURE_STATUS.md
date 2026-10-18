# Feature availability and implementation

<a id="feature-status"></a>

**Source/documentation review: 2026-10-15.** This register describes reviewed source and example configuration. It does not attest the bundle, flags, database or provider state of a running installation. [The documentation matrix](STATUS_MATRIX.md) separates delivery and document lifecycle; [the roadmap](ROADMAP.md) retains remaining acceptance.

<a id="status-rules"></a>
<a id="product-rollout-register"></a>

## Gate rules

The ten product flags in [featureFlags.ts](../src/shared/featureFlags.ts) require the exact string `true`; unset values, `false`, `TRUE` and `1` disable them. All ten are false in [the example](../.env.example). The October 15 audit observed a local opt-in for all ten; that dated file observation is not deployment evidence.

Calls additionally require voices. Lorebook resources additionally require lorebooks. Disabled page features are hidden from navigation and render Not Found through [AppRouter](../src/app/router/AppRouter.tsx); there is no universal WIP placeholder. Implemented features remain implemented when rollout is off, while their availability and release acceptance remain WIP.

| Feature | `VITE_FEATURE_` suffix | Default / example | Implemented foundation | Remaining boundary |
|---|---|---|---|---|
| Community | `COMMUNITY_CARDS_ENABLED` | Off | Sharing, community and shared-card routes | Ownership, revocation, shared media and import acceptance |
| Lorebooks | `LOREBOOKS_ENABLED` | Off | Authoring, entries, attachments, activation, assistant | Prompt/trace, scope, lifecycle and rollout acceptance; [reference](lorebook/README.md) |
| Lorebook resources | `LOREBOOK_RESOURCES_ENABLED` | Off; parent lorebooks required | Text resources, PDF and URL-to-Markdown import, metadata extraction | Extraction also needs BFF `LOREBOOK_EXTRACTION_ENABLED` (default off) and LLM profile transport; runtime/profile, retry, archive and deletion acceptance |
| Voices / narration / root voice admin | `VOICES_ENABLED` | Off | Catalog, recipes, narration and administration | Frontend controls/requests gated; server provider, moderation, quota and runtime gates also apply |
| Calls | `CALLS_ENABLED` | Off; parent voices required | Calls page, session controller, transport, and 1:1 chat replay/transcript linkage for completed call turns | Server voice mode, provider/STT readiness, consent, quotas, partial barge-in audio retention, and real-device acceptance |
| Novel / Story Studio | `NOVELS_ENABLED` | Off | Chapter editor, inline generation, Codex and generated-output history | Reliability, scenes, durable revisions/drafts, novel assistant and manuscript interchange; [status](novel_refactor/14_status_and_roadmap.md). Working tree (uncommitted, 2026-10-15): the Codex hides lorebook-entry refs while lorebooks are off and adventure-template refs while adventures are off; stored refs are not altered, and enabled hidden refs still reach server-side generation context |
| Group conversations | `GROUP_CHATS_ENABLED` | Off | Group behavior in the existing chatroom | The chatroom and 1:1 chat remain available independently |
| Adventures | `ADVENTURES_ENABLED` | Off | Creator, gallery, sessions and interaction | Stored-history, stream/media and matching-deployment acceptance |
| App assistant | `APP_ASSISTANT_ENABLED` | Off | Dedicated page and shared assistant client | BFF registry and usable `app_assistant` profile required; the BFF refuses to start with any enabled assistant kind unless `LLM_PROFILES_ENABLED=true` and `MAGIC_LLM_API_URL` are set |
| Workspace product UI | `WORKSPACES_ENABLED` | Off | Library, switcher, collections and copy | Private workspace transport and handshake remain mandatory with UI off |

Evidence: [flag tests](../src/shared/featureFlags.test.ts), [workspace provider](../src/app/providers/WorkspaceProvider.tsx), [API client](../src/infrastructure/api/index.ts), [voice availability](../src/features/interaction/hooks/useVoiceAvailability.ts), and [narration UI](../src/features/interaction/components/TurnNarration.tsx).

<a id="other-gates-and-ungated-foundations"></a>

## Independent foundations and server gates

| Area | Availability contract | Current disposition |
|---|---|---|
| Stripe purchases | Exact `VITE_BILLING_ENABLED=true`, authenticated enabled server catalog | Code default off; example explicitly true. The October 15 local audit found the variable absent. Purchase acceptance open; [setup](billing/SETUP.md) |
| Patreon | Exact `VITE_PATREON_ENABLED=true`; independent backend reconciliation | Code default off; example explicitly true. Gated client methods and the BFF `/patreon/link/*` proxy (to api.auth link proof) exist; no connect UI. Local variable absent in the dated audit |
| Card/story text streaming | `VITE_FEATURE_TEXT_STREAMING_ENABLED !== 'false'` | Defaults on. Explicit false chooses synchronous endpoints before dispatch; chat and assistant streams are separate |
| LLM profiles | BFF `LLM_PROFILES_ENABLED`, configured catalog/targets and selected profiles | Functional foundation present; **custody/security acceptance open**, not merely a deployment task; [actual transport](llm_profiles/16_current_status_and_roadmap.md). The Models and profiles page (`#/models`) and the Image profiles page (`#/image-models`) have no frontend flag and appear to every signed-in user; per-feature model controls follow their owning feature's flag. The shipped BYOK copy says keys are not saved on our servers, which overstates custody while F04 is open (F11) |
| Card assistant | No frontend product flag; BFF `ASSISTANTS_ENABLED` | Registry can disable it. Lorebook/app assistants also require their frontend owner flags. No novel kind exists |
| Character/world/item creation and 1:1 chat | No corresponding product flag | Authentication, scoped workspace, API and generation configuration remain prerequisites |
| Membership, grants and root consoles | Independent of checkout UI | Credit accounting, redemption, quotas and membership administration remain applicable. Plans also carry daily narration-character and call-second caps (`daily_quantity_limit` for `tts_generation` / `voice_call`), enforced at runtime |
| Image generation | Existing profile/media routes; no dedicated Chara Studio flag | Generation implemented; editing/reference workflows planned. A flag cannot supply the missing DTO/route |
| PNG export | No dedicated product flag; browser runtime required | Implemented; private image fidelity and deployed rendering acceptance open. Working tree (uncommitted, 2026-10-15): the client blocks export for card types whose content flag is off (adventure-template export needs the adventures flag); the BFF route has no content-type gate |
| Moderation | Existing server speech gate; optional/required mode is separate from health | Native multimodal checks and `moderation_enabled` profile fields remain planned; [accepted scope](moderation/README.md) |
| Fish Audio | Managed by the active Fish execution | [Its owner-maintained status](fish_audio_support/11_implementation_status.md) is authoritative; excluded from this cleanup |

Current BFF source expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (owned by the active Fish/voice execution; not asserted here); the stable workspace capability marker remains `2026_10_workspace_r1`. Consult [bootstrap](../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py) and the revision-matched backend operations guide before any schema handoff. This register does not claim a running migration or provider state.

No private credential values are documentation evidence. Local boolean observations retain their audit date; environment acceptance must record the actual built client, deployed service revisions and schema.
