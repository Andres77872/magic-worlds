# Feature flag map and removal inventory

**Snapshot:** 2026-10-18. **Status:** maintained migration inventory. Nine keys remain in the active catalog. FF-10 workspaces is globally released by user instruction and must have no runtime flag attachment. Membership enforcement is implemented locally; see status 13 and acceptance evidence 14 for tested scope and release gates. No row declares production stability or release completion.

This map is mandatory for every flag addition, scope change and removal. It connects a flag to every behavior that must first be protected and later have its temporary protection deleted.

## Map protocol

Each active key needs an inventory ID, purpose, domain owner, named accountable owner, removal work item, target review date, backend/frontend surfaces, dependencies, storage/cache impact and executable retirement proof.

The existing candidates have domain owner roles identified below. Removal tasks MFF-REMOVE-01 through MFF-REMOVE-09 are tracked in status 13 with a 2026-11-17 review; the repository maintainer owns cleanup. These metadata do not restrict root access. An incomplete card is a registration failure, not permission to keep a flag permanently.

The map describes two outcomes: register a still-experimental feature under this protocol, or directly graduate an already stable feature after validating its removal card. Do not automatically migrate every env switch into a long-lived permission.

## Current product keys

| ID | Key | Domain owner role | Parent while active | Current consumer pages | Graduation card |
|---|---|---|---|---|---|
| FF-01 | `communityCards` | Card sharing maintainer | — | community, shared-card; public/group discovery modes | [FF-01](#ff-01) |
| FF-02 | `lorebooks` | Lorebook maintainer | — | lorebook, gallery-lorebooks | [FF-02](#ff-02) |
| FF-03 | `lorebookResources` | Resource/extraction maintainer | lorebooks | gallery-resources, embedded resource actions | [FF-03](#ff-03) |
| FF-04 | `voices` | Speech maintainer | — | voice-studio, narration, previews and voice picks | [FF-04](#ff-04) |
| FF-05 | `calls` | Voice-call maintainer | voices | calls and live-call entry points | [FF-05](#ff-05) |
| FF-06 | `novels` | Story Studio maintainer | — | story, gallery-stories | [FF-06](#ff-06) |
| FF-07 | `groupChats` | Character-chat maintainer | — | group mode within character-chat surfaces | [FF-07](#ff-07) |
| FF-08 | `adventures` | Adventure maintainer | — | adventure, gallery-adventures, active-adventures, interaction | [FF-08](#ff-08) |
| FF-09 | `appAssistant` | App assistant maintainer | — | assistant | [FF-09](#ff-09) |
| FF-10 | workspaces — removed/global | Repository maintainer | None | Library, switching, collections and workspace management run directly | [FF-10](#ff-10) |

Root administration is independent of consumer plan grants. Root accounts bypass every temporary product restriction, in both consumer routes and the control plane; no plan/Redis lookup is needed for this bypass.

## Frontend environment removal map

The 13 variables below have been removed from executable frontend source, env declarations, local .env, .env.example and migrated fixtures. They remain here only as the retirement inventory. Check external hosting configuration separately at deployment.

| Existing variable | Current reader | Target disposition |
|---|---|---|
| `VITE_FEATURE_COMMUNITY_CARDS_ENABLED` | featureFlags.ts | FF-01 runtime grant while active, then delete the flag |
| `VITE_FEATURE_LOREBOOKS_ENABLED` | featureFlags.ts | FF-02 |
| `VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED` | featureFlags.ts | FF-03 |
| `VITE_FEATURE_VOICES_ENABLED` | featureFlags.ts | FF-04 |
| `VITE_FEATURE_CALLS_ENABLED` | featureFlags.ts | FF-05 |
| `VITE_FEATURE_NOVELS_ENABLED` | featureFlags.ts | FF-06 |
| `VITE_FEATURE_GROUP_CHATS_ENABLED` | featureFlags.ts | FF-07 |
| `VITE_FEATURE_ADVENTURES_ENABLED` | featureFlags.ts | FF-08 |
| `VITE_FEATURE_APP_ASSISTANT_ENABLED` | featureFlags.ts | FF-09 |
| `VITE_FEATURE_WORKSPACES_ENABLED` | Removed reader and typing | FF-10 direct global path; never migrate to plan permissions |
| `VITE_BILLING_ENABLED` | billingFeatureFlag.ts | Remove the client switch; use the existing server purchase/catalog availability contract. Do not require a plan grant to upgrade |
| `VITE_PATREON_ENABLED` | patreonFeatureFlag.ts | Remove the client switch; honor server integration support/configuration. No new permanent plan right is inferred |
| `VITE_FEATURE_TEXT_STREAMING_ENABLED` | featureFlags.ts | Remove the rollout switch; choose the supported transport before POST from the versioned server contract, then use a direct stable transport once compatibility permits |

Patreon scaffolding is not proof of a released integration. If its product rollout still needs membership selection, register a new temporary flag with a complete card first. Provider configuration itself remains operational configuration.

Streaming must never retry a partly executed streaming POST through a synchronous endpoint automatically. Transport negotiation is not a plan entitlement.

## Content, LLM and operation ownership

| Vocabulary | Current values | Active owner |
|---|---|---|
| Content | adventure, adventure_template, adventure_session | adventures |
| Content | lorebook, lorebook_entry | lorebooks |
| Content | resource | lorebookResources |
| Content | story, novel | novels |
| Content | character_group | groupChats |
| LLM contract | novel, novel_assistant | novels |
| LLM contract | chat_adventure | adventures |
| LLM contract | chat_group | groupChats |
| LLM contract | lorebook_assistant | lorebooks |
| LLM contract | lorebook_extraction | lorebookResources |
| LLM contract | app_assistant | appAssistant |
| LLM contract | callbot | calls, with active parent voices |
| Mandatory safety | moderation | Baseline safety; never consumes an optional feature grant |
| Task/operation | tts, tts_job, text_to_speech, tts_generation, voice_preview | voices |
| Task/operation | voice_call | calls |
| Resource task/operation | pdf_import, lorebook_extraction, lorebook_resource_extraction | lorebookResources |

Operation strings alone are insufficient. A generic card assistant/generator or image/theme-song action targeting an adventure also needs the active adventure grant. A PDF imported into a novel belongs to the novel scope, not automatically to the resource flag because its file extension is PDF.

Baseline content kinds include character, world and item. Ordinary one-to-one chat is baseline. Valid domain kinds and routes remain closed/validated by their ordinary contracts. An unknown flag key never inherits baseline access.

When a flag graduates, remove its row from active ownership mappings and remove the branch that would have evaluated it. Do not replace its owner with a synthetic global key.

## Shared code that every removal must audit

Frontend: [central mappings](../../src/shared/featureFlags.ts), [API service](../../src/infrastructure/api/index.ts), [data loading](../../src/app/providers/DataProvider.tsx), [navigation](../../src/app/providers/NavigationProvider.tsx), [router](../../src/app/router/AppRouter.tsx), [sidebar](../../src/ui/components/Sidebar.tsx), [LLM preparation](../../src/infrastructure/api/llmPreparation.ts), [mixed Library paging](../../src/infrastructure/api/availableLibraryPage.ts), notifications, task actions, card pickers, imports, cached references and counters.

Backend: [route assembly](../../../../PycharmProjects/magic-worlds-api/src/routes/__init__.py), ordinary feature route families, generic sharing/copy/library/media routes, [LLM contracts](../../../../PycharmProjects/magic-worlds-api/src/services/llm_features.py), [execution admission](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py), socket actions and background worker dispatch.

Additional aliases: `isFrontendVoiceModeEnabled` follows calls; it is not a new permission. The raw library count combines adventure templates with baseline card types. Session usage counts combine adventure and group/ordinary chats. Graduation must remove obsolete flag-specific counter suppression.

<a id="ff-01"></a>
## FF-01 — communityCards

- Scope: discovery, public/group card views, publish/share/import, share-link management, profile publication lists, shared-card previews and generic typed card actions.
- Backend: card_sharing.py and the import/clone/copy services; compose the target content flag while it is active.
- Visitor policy: current public endpoints need an explicit scope decision, not an accidental bypass. Default active consumer discovery/full-card access requires authentication and grants. If a limited published preview is deliberately retained as baseline public behavior, document its exact projection/visibility policy and test it separately before registration; being reachable anonymously today is not approval to exempt the whole route. Publication/import require active grants. Link withdrawal remains an owner cleanup action.
- Release evidence: preview privacy, import ownership, typed target enforcement and complete publication pagination.
- Remove: discovery-mode restrictions, share/publish/import rollout guards, profile flag filters, navigation gates, env reader and grant rows. Keep ordinary share visibility/token/ownership rules.
- Proof: a user with no grants can use released sharing flows without a community flag lookup; any still-active adventure target gate remains independent.

<a id="ff-02"></a>
## FF-02 — lorebooks

- Scope: documents, entries, attachments, validation/activation, lorebook assistant and lorebook context used by other products.
- Backend: lorebooks.py, assistant.py, activation/context compilation and attachment services.
- Release evidence: document persistence, workspace isolation, attachment activation and assistant/execution acceptance.
- Dependency work: if resources remains active, remove its dependency edge to the now-baseline lorebook flag. Resources still requires its own explicit grant.
- Remove: lorebook rollout guards, list/picker/context filters, assistant visibility guards, env reader and grants. Keep document ownership and activation semantics.
- Proof: baseline lorebook CRUD/assistant paths work with the flag service unavailable; resource-only operations still deny missing resource grants.

<a id="ff-03"></a>
## FF-03 — lorebookResources

- Scope: resource creation/read/update, linked resources, PDF import and resource metadata extraction/jobs.
- Backend: lorebooks.py, lorebook_extraction.py, resource task storage/workers and source retrieval.
- Release evidence: upload/import boundaries, extraction admission, task recovery and resource/lorebook ownership.
- Removal precondition: graduate lorebooks in the same or an earlier release, or first ship a genuinely independent resource product. A globally released resource feature cannot remain behind a temporary lorebook prerequisite.
- Remove: resource rollout guards, aliases and filters, resource flag rows and env references. Keep file validation, extraction billing and safe parsing.
- Proof: missing/null resource grants and Redis failure do not affect released resource operations.

<a id="ff-04"></a>
## FF-04 — voices

- Scope: narration, previews, voice picking/studio, related settings and speech entry points.
- Backend: voices/catalog/effective routes, preview/performance/scene/preset routes, narration socket handlers, TTS dispatch and voice-write services.
- Release evidence: provider readiness, narration/preview ownership, quota/consent/safety acceptance and usable unavailable-provider behavior.
- Dependency work: if calls remains active, remove its flag edge to voices; calls then checks only its own temporary grant.
- Remove: narration/preview/studio rollout guards, task-operation filters, LLM visibility aliases and voice env references. Keep moderation, consent, voice eligibility, provider circuit breakers and metering.
- Proof: baseline narration does not call the flag layer; calls without a grant remains blocked while its own flag is active.

<a id="ff-05"></a>
## FF-05 — calls

- Scope: calls page, call start/resume, HTTP audio segments, call WebSocket actions and each fresh voice turn.
- Backend: route_voice_call.py, callbot execution, voice engine intake and dispatch.
- Release evidence: start/resume lifecycle, stable audio delivery, revocation during rollout and settlement/refund acceptance.
- Removal precondition: voices has graduated or graduates in the same release.
- Remove: call rollout guards, callbot product permission mapping, call UI gating, the legacy voice-mode alias if unused, grants and env references. Keep call quota, account eligibility, consent and safety.
- Proof: released call actions use no temporary permission context and still enforce normal call restrictions.

<a id="ff-06"></a>
## FF-06 — novels

- Scope: Story Studio, library/details, planning, annotations, imports/exports, generation, novel assistant and novel-specific sources.
- Backend: stories.py and included story routers, execution/assistant services and novel job dispatch.
- Release evidence: save/recovery/ownership, generation history, source selection, import/export and current novel acceptance dossier.
- Remove: novel access wrappers, galleries/pickers/assistant gates, env reader and plan grants. Preserve local drafts and stored source snapshots.
- Proof: a released novel can open/edit without a flag provider. Still-experimental referenced products follow their own explicit scope policy.

<a id="ff-07"></a>
## FF-07 — groupChats

- Scope: group creation, existing character_group sessions, participant actions, history, HTTP and WebSocket generation.
- Backend: route_character_chat.py, route_chat.py and shared conversation execution, using the stored conversation kind.
- Release evidence: creation/participant ownership, existing-session access, turn concurrency and socket recovery.
- Remove: group-mode gates, persisted-kind rollout checks, recent-chat filters, group LLM visibility and combined-usage suppression where no active owner remains.
- Proof: group and ordinary character chat use the same baseline access path; no check for the retired group key runs.

<a id="ff-08"></a>
## FF-08 — adventures

- Scope: creator/templates, owned/shared/imported cards, sessions/play loop, chat, saved Codex references and adventure targets of generic media/copy/assistant actions.
- Backend: route_adventure_template.py, route_adventure_session.py, route_chat.py, generic card services and execution.
- Release evidence: template/session persistence, direct and generic admission, snapshots/Codex, rendering and mixed pagination.
- Remove: content/type/query filters, routes, template/session loaders, shared-card and Codex restrictions, LLM mapping, counters and grant/env entries.
- Proof: both typed and mixed listings include released adventures without an adventure permission filter; unrelated active kinds stay gated.

<a id="ff-09"></a>
## FF-09 — appAssistant

- Scope: app-wide assistant entry, conversation creation/history/turns, streaming, retry and recovery for kind app.
- Backend: assistant.py, app handler, assistant execution and LLM preparation.
- Release evidence: conversation workspace scope, turn lifecycle, tools/safety and error/recovery acceptance.
- Remove: kind-app rollout gating, sidebar/page checks, app_assistant product mapping and grants/env references.
- Proof: ordinary app assistant operations proceed without flag evaluation. Card/lorebook/novel assistants do not acquire an accidental appAssistant dependency.

<a id="ff-10"></a>
## FF-10 — workspaces (removed/global)

**Decision:** already deployed; explicit user instruction on 2026-10-18. This key is excluded from the runtime catalog and cannot be granted through plans. Delete all checks and hidden/off branches, including API assertions and context fields; do not replace them with a true-valued helper. Backend workspace ownership, selectors and CAS remain ordinary domain authorization. Validation is tracked in status 13.

- Scope: Library product UI, non-default workspace access/switching/management, collections and cross-workspace copy.
- Backend: workspaces.py, shared workspace resolution, collection/copy operations and selector use on private routes.
- Release evidence: switching and recovery, copy integrity, default workspace preservation, collection membership and selector isolation.
- Always baseline: capabilities handshake, protected default workspace and mandatory private request scoping.
- Removal work: workspace rollout checks, hidden-workspace notices and alternative navigation branches. No backend default-only membership restriction is introduced. Keep selector validation, owner scope, archived-work rules and version/CAS checks.
- Proof: multiple workspaces work without flag-service access; an invalid or foreign selector is still rejected.

## Updating the map

For every implementation PR, record exact changed paths and the corresponding validation IDs from document 09. Add real owner/work-item/date fields before registration. For retirement, attach source-reference scans and zero-evaluation evidence, then move the key to a documentation-only removal ledger using template 12.

Code manifests may generate inventory tables, but Markdown must not become a per-request permission database. The current source paths above are starting points; rerun reference searches before each change because feature scopes are expanding.

## Current implementation trace

The canonical catalog is `magic-worlds-api/src/services/feature_flags/catalog.json`; `scripts/sync-feature-flags.mjs` generates `src/shared/featureFlagCatalog.ts`. The catalog has exactly FF-01 through FF-09. Every active card above has a removal task in status 13.

Backend: `feature_flags/enforcement.py` supplies family/profile dependencies; `scope.py` owns content/operation/LLM mappings, stored-target checks, media SQL predicates and admission boundaries. Route modules attach them explicitly. `FeatureFlagStore.assert_context` prevents a stale Redis grant authorizing a current SQL operation. Root bypasses Redis before these active restrictions.

Frontend: `FeatureFlagProvider`, `featureFlagRuntime`, the snapshot parser, `FeatureAccessGate`, API dispatch assertions and subscribed feature consumers use the server snapshot. `PlanEditorDialog` and `PlanList` render the root catalog without consumer restrictions. Refreshes do not add permission-generation dependencies to unrelated React effects.

FF-06 acceptance covers more than 90 actual mounted story routes, both users on a new plan, null revocation, stale Redis revision rejection, root without runtime, and live source composition. See the [focused acceptance commands](13_implementation_status.md#focused-acceptance-commands).

Public media exception: the public download endpoints expose only referenced, nondeleted image/song files, verified against existing public/share visibility. They expose no private job prompts, arbitrary owned files, full cards or generation actions. Private asset/job/list routes retain their server-derived content permissions.

Already copied novel snapshots are part of the owned novel. Creating a copy from, checking, or refreshing a live adventure/lorebook source requires that source product's active permission. Retirement deletes the relevant map entry, check, filter and control; it never adds a permanent global grant.

Community cleanup boundary: revoking a share link and unpublishing an owned card require ordinary ownership, independently of community/adventure rollout grants. Unpublish returns only card type, ID and visibility acknowledgement. Reading, publishing, sharing and importing remain gated; mixed public/share lists exclude disabled adventure templates before SQL pagination. Own-card duplication is baseline and composes only the actual content and attached-book permissions.
