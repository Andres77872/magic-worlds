# Current status and evidence

**Status authority for this initiative. Reviewed:** 2026-10-15; baseline kinds rechecked 2026-10-26. **Overall:** researched and proposed; implementation has not started (no AIMP work in source as of 2026-10-26).

**Baseline update, 2026-10-26:** a fourth assistant kind, `novel`, landed on 2026-10-18 (BFF `70c9c27`/`7f7eac7`, SPA `692e56bb`). It is bound to one story, answers through a reply tool with `applies_tools=False`, and does not change the `app` kind. Its work also changed point 1 below: the turn store now sets `targeted = handler.applies_tools` instead of `bool(handler.tools)`. The rest of this baseline keeps its 2026-10-15 scope.

## Evidence boundary

The review inspected the working trees of magic-worlds and magic-worlds-api. Frontend HEAD was `5a29ad5`; BFF HEAD was `2c2973d`. Both checkouts already contained local changes. These identifiers locate a baseline, not the exact reviewed artifact or deployed release.

Local allowlisted configuration values enable the app/lorebook product surfaces and all three BFF assistant kinds, with LLM profiles enabled. No secrets were required for this review. Configuration opt-in does not prove assigned profiles, executor compatibility, database readiness, or live provider success.

Only Markdown documents under this directory are delivered. No implementation or deployment claims should be inferred from their creation.

## Implemented baseline

| Area | Observed behavior | Source |
| --- | --- | --- |
| Assistant kinds | `card`, `lorebook`, `app` at this review; `novel` was added 2026-10-18. The server registry can disable each kind | [Registry](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/registry.py), [request models](../../../../PycharmProjects/magic-worlds-api/src/models/assistant.py) |
| Main assistant | Plain text/Markdown over a client-built context; no tools or mutation target | [App handler](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/app.py), [app graph](../../../../PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/app_assistant.v2.json) |
| Card tools | Replace, patch, or answer without changing one bound card; type-specific schemas | [Card handler and planning](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/card.py) |
| Lorebook tools | Replace, patch, or answer without changing one bound lorebook | [Lorebook handler and planning](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/lorebook.py) |
| Execution | Profile-owned admission; stable request IDs; one external action tool call per tool completion | [Execution](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/execution.py), [tool transport projection](../../../../PycharmProjects/magic-worlds-api/src/services/llm_execution_tools.py) |
| Persistence | Target mutation, terminal messages, immutable turn result, and reservation release share completion transactions | [Turn store](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/assistant_turn_store.py), [domain model](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py) |
| Main context | Localized in-app guide, library, lorebooks, resources, novels, and up to six focused records | [Knowledge builder](../../src/features/appAssistant/appKnowledge.ts), [knowledge hook](../../src/features/appAssistant/hooks/useAssistantKnowledge.ts) |
| History and handoff | Main page displays enabled kinds; card/lorebook threads continue in their editors | [Main page](../../src/features/appAssistant/components/AppAssistantPage.tsx), [shared hook](../../src/features/creation/common/components/assistant/useAssistant.ts) |
| Profiles | Card/lorebook primary roles require tools and streaming; app primary currently requires streaming only | [Feature contracts](../../../../PycharmProjects/magic-worlds-api/src/services/llm_features.py) |
| Workspace scope | Owned records and assistant history use the conversation's authorized workspace | [Routes](../../../../PycharmProjects/magic-worlds-api/src/routes/assistant.py), [workspace tests](../../../../PycharmProjects/magic-worlds-api/tests/models/test_assistant_workspace_scope.py) |

The frontend also provides source switches, approximate context size, a partial-context indicator, focus selection, Markdown links, nested hover previews, copy, stop/retry/reload, and model controls. They are interface capabilities; hover-driven API requests do not give the model a retrieval tool.

## Existing tools and limits

The six tool names are `mw_replace_card`, `mw_patch_card`, `mw_no_card_change`, `mw_replace_lorebook`, `mw_patch_lorebook`, and `mw_no_lorebook_change`. New cards use the no-patch graph until a saved target exists. A tool reply carries a concise `response` alongside a nested card/lorebook/patch object where applicable.

Card tooling covers characters/personas, worlds, items, and adventure templates. It preserves owner-controlled voice data and validates owned media references; it does not generate media or select voices. Lorebook tooling covers document settings and entries, but not attachments or resource CRUD.

Lorebook patches merge top-level fields and nested settings. An `entries` patch is a replacement list, not an entry-operation language. The normalization/planning path may assign new entry IDs when entries are supplied; an unchanged entry list retains stored IDs. Do not present this tool as stable-ID entry editing.

The main context has a 60,000-character total ceiling, 14,000-character digest-section ceilings, and a 24,000-character focus ceiling. Prose and individual lists are clipped. Resources are fetched as one page of at most 100. Other library lists are paginated by [DataProvider](../../src/app/providers/DataProvider.tsx), but the knowledge digest can still omit them.

History construction takes the last 24 stored messages, omits tool rows, and clips each included message to 1,200 characters. This is conversational context, not reliable action state.

There is also an existing `mw_read_card` tool in character/adventure/group roleplay graphs. It selects from authorized snapshots already supplied to the graph; it is not a main-assistant tool or a database search endpoint. [chat_workflows.py](../../../../PycharmProjects/magic-worlds-api/src/services/chat_workflows.py) injects the snapshot table, [card_context.py](../../../../PycharmProjects/magic-worlds-api/src/services/card_context.py) projects card content, and the narrative transport filters the graph-consumed calls. Reuse that contract/projection where appropriate; do not copy its in-graph parser into a new general retrieval route.

## Why enabling app tools alone will fail

1. At this review, `AssistantTurnStore.targeted = bool(handler.tools)` equated tool use with a conversation-bound document. Since 2026-10-18 it is `handler.applies_tools`, so a tool-calling kind that applies no edit is no longer treated as targeted; an app kind that applies edits still needs a bound target.
2. App conversations have no card/lorebook binding or target CAS.
3. Stored app messages reject tool roles and tool fields.
4. Current snapshot and frontend verifiers expect different terminal shapes for document and app kinds.
5. The existing tool projection recognizes the `assistant_reply` and `narrative` output contracts, not a generic app retrieval loop. It accepts one external action, not unrestricted provider tool sequences.
6. The app profile need not support tools; merely inserting schemas cannot establish that capability.

Sources: [turn-store construction and snapshot checks](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/assistant_turn_store.py), [message validation](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py), [frontend verifier](../../src/infrastructure/api/assistantContract.ts).

## Retention and existing integrity dependencies

The context is absent from dedicated conversation/message/turn fields but exists in `tb_llm_execution_plan.frozen_payload`. Conversation deletion does not cascade to that execution plan. The interface still says the context is discarded. This is an existing discrepancy, tracked by [assistant ASST-R3](../app_assistant/README.md) and [security retention guidance](../security/README.md#content-retention-is-a-separate-contract).

Reuse must also account for [W-04b and W-04d](../workspace_r1/04_gaps_and_priorities.md): retained assistant output references are omitted by the media deletion scanner, and the unbound assistant card-creation path needs default-persona uniqueness verification. This review does not mark either issue fixed.

## Verification already completed in this chat

On 2026-10-15, before this documentation request, the following focused suites passed:

~~~sh
pnpm exec vitest run src/features/appAssistant src/features/creation/common/components/assistant src/features/lorebook/lorebookAssistantAdapter.test.ts src/infrastructure/api/assistantContract.test.ts
~~~

Result: **18 frontend files, 379 tests passed**.

~~~sh
.venv/bin/python -m pytest tests/services/test_assistant_app.py tests/services/test_assistant_card.py tests/services/test_assistant_lorebook.py tests/services/test_assistant_core.py tests/services/test_assistant_config.py tests/services/test_assistant_upstream_contract.py tests/routes/test_assistant_routes.py -q
~~~

Result: **939 backend tests passed**. These are source/unit/contract evidence for existing behavior. No live provider, deployment, real database transaction, browser workflow, or performance acceptance was run. The tests do not implement or validate the proposed capabilities.

## Initiative status

| Deliverable | Status |
| --- | --- |
| Current implementation review | Complete within the evidence boundary above |
| Primary-source research | Complete as of the research date; [sources](02_research_and_sources.md) |
| Reuse architecture, capability policy, tool design, risks, plan, evaluations | Proposed in this dossier |
| Shared registry and domain extraction | Not implemented |
| Main-assistant writes and retrieval tools | Not implemented |
| New run/action storage and versioned protocol | Not implemented |
| General-assistant toolset switches | User-required option; master/seven-group design documented in [14](14_toolset_controls.md), not implemented |
| Provider/database/deployment acceptance | Not run |

Initial documentation delivery validation passed: 15 Markdown files, 97 local file/anchor links, balanced code fences, heading spacing, final newlines, and whitespace checks. The research uses 12 distinct opened primary-source URLs. Application suites were not rerun for the documentation-only addition. A subsequent documentation-only update adds the required toolset controls and their acceptance cases.

Toolset-control update validation passed: 16 Markdown files, 110 local file/anchor links, 56 unique acceptance scenarios, and a valid seven-group JSON preference example. No application code or configuration was changed.
