# Feature status

**Source/configuration review: 2026-10-14.** This register describes this checkout. It does not attest which bundle, environment, database revision, or provider configuration is running in a deployed installation.

**Frontend gate follow-up: 2026-10-15.** The current working tree also gates narration with `VOICES_ENABLED`; calls require both `CALLS_ENABLED` and `VOICES_ENABLED`. The local/example booleans below were rechecked without changing configuration.

## Status rules

| Label | Meaning |
| --- | --- |
| Implemented | A source path and matching integration exist. This alone does not establish rollout or successful provider execution. |
| WIP — gated | The feature can be disabled by a rollout gate. When that gate is off, document the feature as WIP even if the implementation exists. |
| WIP — partial / planned | Only part of the target is implemented, or no implementing route/data model/surface was found. |
| Historical | A dated review, test result, design baseline, or vendor research snapshot. It is not a current acceptance result. |
| TBD | A decision, owner, operational fact, or acceptance result remains unresolved. No delivery date is implied. |

The ten product flags in [featureFlags.ts](../src/shared/featureFlags.ts) accept **only the exact string `true`**. Unset, `false`, `TRUE`, and `1` disable them. All ten are `false` in [.env.example](../.env.example); the local `.env` opts into all ten. Vite reads these values when serving/building the app: changing a file does not establish the state of an already-built deployment.

Disabled page features are removed from navigation and render `NotFoundPage` for a direct route in [AppRouter](../src/app/router/AppRouter.tsx). **There is no universal WIP placeholder screen.** “WIP” here is the documentation/roadmap classification; replacing the runtime 404 with an explanatory WIP screen is a separate product decision.

## Product rollout register

| Feature | Gate suffix (`VITE_FEATURE_…`) | Unset / example | Local file | Actual implementation and remaining scope |
| --- | --- | --- | --- | --- |
| Community / shared cards | `COMMUNITY_CARDS_ENABLED` | Off — **WIP** | On | Community gallery, sharing API methods, shared-card routes exist. Deployed sharing/ownership/media behavior is unverified in this review. |
| Lorebooks | `LOREBOOKS_ENABLED` | Off — **WIP** | On | Studio, gallery, entries, attachments, activation preview, assistant, and BFF activation/loader exist. Advanced research scope is not all shipped; see [ledger](lorebook/README.md). |
| Lorebook resources | `LOREBOOK_RESOURCES_ENABLED` | Off — **WIP** | On | Requires the lorebooks flag too. Shared/embedded resource editing, PDF import and metadata extraction exist; backend configuration/profile gates still apply. |
| Voice Studio / root voice admin / narration | `VOICES_ENABLED` | Off — **WIP** | On | Native catalog, presets, design/cloning/library, administration and narration source exist. The frontend flag gates their controls and requests; provider/moderation/release gates remain separate. |
| Calls | `CALLS_ENABLED` | Off — **WIP** | On | Requires the voices flag too. Calls page and session calls exist. Backend `VOICE_MODE_ENABLED` plus runtime settings and provider/STT readiness govern actual calls. |
| Novel / Story Studio | `NOVELS_ENABLED` | Off — **WIP** | On | Story gallery, chapter Markdown editor, staged AI generation, codex, saving and generation-history output copying exist. Scene entities, durable revisions, manuscript import/export, a novel assistant kind, and richer recovery remain WIP. |
| Group conversations | `GROUP_CHATS_ENABLED` | Off — **WIP** | On | Chatroom itself remains available; the flag controls group conversation behavior. Do not describe the entire chatroom as disabled. |
| Adventures | `ADVENTURES_ENABLED` | Off — **WIP** | On | Creator, gallery, active sessions and interaction routes are gated together. Stored history mutation and WebSocket transport exist. |
| App assistant | `APP_ASSISTANT_ENABLED` | Off — **WIP** | On | Dedicated page and shared assistant client exist. BFF must also offer kind `app` and resolve an `app_assistant` profile. |
| Workspace R1 product UI | `WORKSPACES_ENABLED` | Off — **WIP** | On | Library, switcher, collections and workspace management/copy exist. Default-workspace handshake and private request scoping stay active with this flag off. |

Evidence: [flag tests](../src/shared/featureFlags.test.ts), [Sidebar](../src/ui/components/Sidebar.tsx), [ChatroomPage](../src/features/characterChat/components/ChatroomPage.tsx), [workspace provider](../src/app/providers/WorkspaceProvider.tsx), [API client](../src/infrastructure/api/index.ts), [current voice ledger](voice_refactor/00_current_status_and_roadmap.md), and the suite reviews linked from the [index](README.md).

## Other gates and ungated foundations

| Area | Configuration / availability | Actual status |
| --- | --- | --- |
| Stripe purchase UI | `VITE_BILLING_ENABLED === 'true'`, then signed-in `GET /billing/plans` with `enabled:true` | **WIP — disabled in this local configuration** because the variable is absent from local `.env`. Code defaults off, although `.env.example` explicitly sets it to `true`. Local backend billing sync is opted in; this does not override the frontend gate or prove checkout readiness. |
| Patreon | `VITE_PATREON_ENABLED === 'true'`; backend reconciliation has independent gates | **WIP — frontend scaffolding**, absent/off locally; example sets it to `true`. No Patreon link/connect UI ships. Entitlement reconciliation is distinct from a connect surface. |
| New card/story SSE generation | `VITE_FEATURE_TEXT_STREAMING_ENABLED !== 'false'` | Implemented; **defaults on**. Local variable is absent, example is `true`. Explicit `false` chooses synchronous card/story endpoints before dispatch; it does not disable chat or assistant streams. Owning feature flags still apply. |
| LLM profiles / BYOK | BFF `LLM_PROFILES_ENABLED` and upstream catalog/execution/custody configuration | Implemented source, **WIP operational acceptance**. Local BFF flag is true; example is false. No model-routing fallback is implied. BYOK requires HTTPS and transient credential entry; see [current status](llm_profiles/16_current_status_and_roadmap.md). |
| Card assistant | No frontend feature flag | Client integration exists; BFF `ASSISTANTS_ENABLED` still controls availability. “Always on” only means no frontend rollout flag. |
| Lorebook/app assistants | Frontend owning flag and BFF assistant registry | WIP when either gate is off. Local BFF registry opts into `card,lorebook,app`; missing profile/transport readiness is a separate failure. No `novel` kind exists. |
| Character/world/item creators and private galleries, 1:1 chat | No product flag | Implemented source paths. Authentication, workspace handshake, API availability and generation profiles remain prerequisites. |
| Membership credits, PAYG wallets, promo grants / root consoles | Independent of purchase flags | Implemented; turning off checkout does not turn off quota accounting, redemption, or root membership management. |
| Portrait generation / image profiles | No dedicated Chara Studio flag | Implemented generation pipeline. **Chara Studio editing/reference/mask/asset workflow remains WIP planned**; enabling other flags cannot provide it. |
| Card PNG export | No dedicated product flag | Implemented frontend download and backend Playwright rendering. Private-portrait fidelity has a source-inferred authentication gap; Chromium/runtime/storage checks remain operational requirements. See [export ledger](html2img/README.md). |

Evidence: [billing helper](../src/shared/billingFeatureFlag.ts), [billing catalog hook](../src/features/billing/hooks/useBillingCatalog.ts), [Patreon helper](../src/shared/patreonFeatureFlag.ts), [LLM session provider](../src/features/llmProfiles/LlmSessionProvider.tsx), [BFF billing config](../../../PycharmProjects/magic-worlds-api/src/services/billing_config.py), [BFF assistant registry](../../../PycharmProjects/magic-worlds-api/src/services/assistants/registry.py).

Do not publish private `.env` contents or credential values as evidence. This review records only allow-listed feature booleans and assistant kind names. No flag, environment file, database, or deployed service was changed.
