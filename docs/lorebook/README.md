# Lorebooks: current implementation and backlog

**Lifecycle: active reference and acceptance backlog. Reviewed 2026-10-15.** Authoring, attachments, resources, deterministic activation and assistant integration are implemented in source. Lorebooks and resources remain default-off product surfaces. Resource availability requires both `VITE_FEATURE_LOREBOOKS_ENABLED` and `VITE_FEATURE_LOREBOOK_RESOURCES_ENABLED`; local opt-in is not deployment acceptance. See [feature status](../FEATURE_STATUS.md) and [LORE-01 roadmap](../ROADMAP.md).

**2026-10-19 audit supplement:** the [lorebook update dossier](../lorebook_update/README.md) records open activation, resource preview/snapshot, permission and editing defects, with reproductions, research and a proposed plan. No application fixes were made in that audit. Its findings qualify the older acceptance claims below; current feature access follows the [membership permission implementation](../feature_flag_on_membership/README.md), so the Vite-flag wording above is stale.

<a id="current-implementation-and-gaps-2026-10-14"></a>

## Current implementation and gaps

| Capability | Actual source status | Gap / acceptance |
| --- | --- | --- |
| Domain and authoring | Shared lorebook types, gallery, studio, entry editor, attachments and API CRUD exist | Default-off rollout; qualify save/CAS/read-only behavior in matching deployment |
| Keyword activation | Backend supports primary/secondary keys, logical modes, constant entries, regex/case/whole-word settings, recursion and reveal matching | Secret reveal is deterministic text matching, not a narrative authorization/AI adjudication guarantee |
| Activation preview/trace | Studio panel and `/lorebooks/activation-preview`, validation, match reasons and estimated budget exist | `estimate_tokens` uses whitespace count ×1.35; it is not model-specific tokenizer accounting. Preview is not proof of the final provider prompt, and it does not reproduce live multi-target activation (see [current runtime behavior](#current-runtime-behavior)) |
| Runtime insertion | `lorebook_loader.py` loads scoped attached/global books and constructs prompt fragments/metadata in the backend | Verify ordering, budgets and snapshot/linked behavior for each real conversation graph; see [current runtime behavior](#current-runtime-behavior) |
| Resources | Shared/embedded text resources, resource gallery/picker, `.md`/`.txt` file import, URL-to-Markdown import (BFF `/imports/markdown`), PDF import and metadata extraction/reconciliation exist | PDF/extraction runtime config and profiles still gate execution: server extraction also requires BFF `LOREBOOK_EXTRACTION_ENABLED=true` (default false) plus LLM profile transport. Verify retry/credentials/workspace lifecycle |
| Assistant | Shared assistant core supports `lorebook` with BFF handler and CAS target writes | Requested turns may commit the target and apply it at final without a separate accept step; reopened/reloaded targets have a distinct apply-to-form state. Registry can disable the kind independently |
| Session isolation | Workspace-bound API hooks, scoped loader and archived-workspace read-only guards exist | Populated migration and cross-workspace/target retention need environment acceptance |
| Portability | No Character Card V2 adapter or general lorebook JSON import/export UI/route found in current sources | **WIP planned**; PDF/text-resource import is not portable lorebook interchange |
| Advanced retrieval/policy | Deterministic activation exists | Semantic/vector retrieval, timed/group/probability policies and narrative secret adjudication remain **WIP/TBD** |

Source evidence:

- [Shared types](../../src/shared/types/lorebook.types.ts), [LorebookStudio](../../src/features/lorebook/components/LorebookStudio.tsx), [entry editor](../../src/features/lorebook/components/LoreEntryEditor.tsx), [preview](../../src/features/lorebook/components/ActivationPreviewPanel.tsx), [resource extraction](../../src/features/lorebook/hooks/useLorebookExtraction.ts).
- [BFF routes/DTOs](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebooks.py), [extraction routes](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebook_extraction.py), [activation service](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py), [loader](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_loader.py).
- Existing frontend and backend activation/loader/routes/extraction tests provide controlled contract evidence. This October 15 cleanup rechecked activation, request scoping, loader and assistant contracts. No application tests, provider calls or database flow were run during the cleanup.

The frontend does not assemble the provider prompt by injecting arbitrary lore into WebSocket messages. Backend-owned activation is already implemented. Character and adventure sessions use stored scoped conversation/snapshot contracts, not an assumed live-card-only history cache.

<a id="current-runtime-behavior"></a>

**Current runtime behavior (source, 2026-10-15).** These facts describe what the backend does today. They are not a designed policy; LORE-R2 decides that.

- Live activation scans only the newest user message of the turn, not earlier history.
- Constant entries apply without a key match; they still count against the token budget.
- When a book enables recursion, activated entries can trigger other entries. "Scan depth" caps the number of recursion passes (the highest value among enabled books); it is not a message-history window.
- One token budget, taken from the first eligible book, caps all books together.
- Book order follows attachment ordering (target kind alphabetical, then most recently updated attachment first). This order is implicit; it is not a designed source precedence.
- Insertion position only orders entries inside one `lorebook_context` system-prompt fragment.
- Secret entries without a reveal condition activate on their keys like normal entries. Only chat lore-trigger highlighting excludes secret entries.
- The activation preview resolves only the requested target and scans all supplied messages, so it does not reproduce live activation across session, template, world, character and global targets.

## Lorebook roadmap — WIP

| ID / priority | Remaining work | Closure / TBD |
| --- | --- | --- |
| LORE-R1 / P1 | Release/attachment/activation matrix with flags off/on, linked/snapshot, global/session scope, kind-wide attachments (a blank target id applies the book to every target of that kind), linked-only in-session attach (decide whether sessions should snapshot), archive and cross-workspace targets | Dated matching frontend/BFF/schema smoke; no cross-owner scope or silent snapshot changes |
| LORE-R2 / P1 | Accurate budget/trace contract | Decide model-aware token accounting vs labeled estimates, the multi-book budget owner, the scan window and book order (see [current runtime behavior](#current-runtime-behavior)); compare trace with actual constructed prompt. Policy **TBD** |
| LORE-R3 / P1 | PDF/extraction/assistant lifecycle | Profile unavailable, credentials reentry, retry, canceled/late result, CAS rejection and resource deletion do not duplicate or overwrite content |
| LORE-R4 / P2 | Portable import/export | Supported formats, extension preservation and loss report **TBD**; explicit source/round-trip fixtures |
| LORE-R5 / P2 | Expanded retrieval/reveal semantics | Product scope **TBD**; do not promise semantic retrieval or secret access control from keyword matching |

**Not carried forward:** the June proposal's staged AI drafts and visible diffs before apply are superseded by the shared assistant contract. The New Lorebook Wizard, extraction from cards/sessions/chat, dedicated key-suggest/rewrite/audit tools, the per-session latest-activation trace endpoint with an "active lore this turn" drawer (the trace is stored in turn metadata but cannot be viewed), and seeding entry keys from card triggers are not implemented; disposition **TBD**.

**LORE-R4 design input (June proposal, not accepted):** keep the native lorebook model as the internal superset rather than adopting an external format as the schema (order, budget and placement semantics differ), and map Character Card V2 `character_book`, SillyTavern World Info and NovelAI lorebooks through adapters. Native export preserves every field; compatibility import/export returns a loss report (warnings, unsupported fields, preserved extensions). On import, never discard unknown `extensions` (keep them namespaced in metadata), store any unrepresentable field in metadata and report it, normalize invalid fields with a warning, preserve external IDs, record order/position conversions, and mark imported regex or other advanced fields as advanced UI fields.

Responsible areas are lore frontend/backend and LLM/operations for execution gates. Named owners and dates are **TBD**.

## Maintained design decisions

- Prompt construction and activation belong to the backend. The frontend preview explains the deterministic rules and estimates; it does not attest the final provider prompt.
- Linked attachments follow a library source; snapshot attachments preserve the selected content, and the data model and loader honor them. Snapshot mode is offered from the studio attach panel; the in-session panel currently creates linked attachments, and live turns resolve template/world/character attachments at each turn. Whether sessions should snapshot by default is part of LORE-R1. Acceptance must distinguish both modes and reject cross-workspace targets.
- Keyword activation is the working retrieval foundation. Semantic retrieval, portable interchange and broader reveal policies are separate planned capabilities.
- Card triggers are shallow card context keys. Lorebook entries carry their own content, activation keys, settings, placement and priority.
- Assistant changes follow the implemented shared assistant contract: a requested turn may save/apply immediately. The June proposal's additional approval step is not the current interface. Extraction review and activation preview remain useful separate interactions. See [assistant contract](../app_assistant/README.md).
