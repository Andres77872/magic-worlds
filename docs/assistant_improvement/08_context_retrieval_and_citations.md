# Context, retrieval, and citations

**Status:** proposed, 2026-10-15. Relevance and provenance improve answers; fresh authorized snapshots protect writes. They are related but different contracts.

## Current limitations

[appKnowledge.ts](../../src/features/appAssistant/appKnowledge.ts) builds focus first, then guide and selected digests. Per-record summaries and lists are clipped. At the total ceiling, a complete section can be skipped rather than partially fitted. The partial indicator does not tell the model how to retrieve the missing material.

The guide is built from localized frontend product content. Repository Markdown is a separate documentation corpus. Resources use one page of at most 100. Even fully loaded library lists can exceed the outgoing digest budget. An answer about absent details must not infer absence from the library itself.

## Proposed retrieval flow

1. Start with a compact product map, locale, source/capability manifest, selected target summary, and relevant conversation context.
2. If factual detail is missing, search eligible sources with a targeted query.
3. Read only the selected record fields or passages needed for the task.
4. Cite their canonical references and identify uncertainty, conflicting versions, or incomplete coverage.
5. For an edit, prepare the entire editable server snapshot separately; never reconstruct it from retrieval excerpts.

The model may answer immediately when enough evidence is present. “Always search first” would waste latency and increase exposure. Evaluate both unnecessary retrieval and missed retrieval.

## Reuse queries before adding an index

Use existing owned/workspace-scoped list/get query services through shared adapters. Initial discovery supports the metadata semantics those queries actually provide, including available name/alias/trigger matching. Use a deterministic per-source result order and opaque cursor carrying server-validated continuation state.

Card detail should reuse `mw_read_card` and the existing card-context sanitizer/projection, with a new BFF authorization/freshness adapter. Roleplay continues to read its session snapshots; main-page reads identify the saved/draft snapshot they fetched. Non-card detail uses `mw_get_content`. Keep these domains disjoint and share projection code instead of adding a competing generic card reader.

The adapter must construct an allowlisted authored-content view before sanitization; existing snapshot exclusions are not permission to send raw database metadata. Read projections and full writable domain snapshots remain separate typed representations.

Federated results must include source/type, display name, matching fields, canonical link, and a short useful excerpt where available. Return per-source errors/coverage so one failed source does not masquerade as a complete empty search.

Do not issue an unbounded scan or load all resource/novel bodies to answer a narrow question. Passage reads operate on a selected authorized resource/chapter and have explicit boundaries/cursors.

Body search, full-text indexing, or embeddings are optional later work. Adopt them only after representative tasks demonstrate metadata search plus bounded reads is inadequate, with an index ownership/deletion/workspace strategy and query-performance evidence.

## One source for the product guide

Build a versioned guide artifact from the existing [getDocsContent](../../src/features/docs/components/docsContent.ts) and localized copy. Generate EN and ES sections with stable IDs, locale, content revision, and feature dependencies. Deploy/publish that artifact to the BFF or an owned read service. The BFF's authoritative capability resolver filters unavailable route actions.

Do not maintain a second handwritten backend guide or treat these improvement Markdown files as the product guide. A generation/build step and matching artifact deployment are required implementation work.

The current frontend-composed guide remains a legacy fallback marked as client-supplied content. If the server artifact is missing or mismatched, explicitly report guide search unavailable or use the bounded legacy guide with its stated provenance. Do not fabricate a current guide revision.

## Provenance and citations

Each read result should carry:

| Field | Purpose |
| --- | --- |
| Source family and record type | Apply availability and history policy |
| Opaque reference and canonical internal href | Resolve/cite without model-invented paths |
| Display name and exact domain ID in host state | Disambiguate and render actions |
| Revision/hash or timestamp with clear semantics | Explain stale or conflicting evidence |
| Section/chapter/entry identifier and excerpt boundaries | Attribute claims precisely |
| Truncated/continuation/coverage state | Avoid claiming full review |
| Linked-source lineage | Prevent disabled sources being hydrated indirectly |

The model cites host-provided internal links. Existing [link availability policy](../../src/app/router/linkAvailability.ts), [reply link rendering](../../src/features/appAssistant/components/AssistantReplyLink.tsx), and [hover cards](../../src/features/appAssistant/hoverCards/index.ts) should remain shared across surfaces.

Keep a result-reference allowlist for the current run. Reject invented/disabled record links and any generated external query URL that could carry private text. Record links are navigation, not permission to edit.

Distinguish source-supported facts, plausible inference, and creative proposals. A suggested backstory is not an existing canon fact until the user authorizes its write.

## Budgets and coverage

Retain the current 60,000-character transport ceiling during migration; fit content to the selected profile's actual input allowance as well. Character ceilings are safety bounds, not exact token counts.

Suggested retrieval experiments:

- Search: default 8 records, hard maximum 20, brief metadata/excerpts.
- Detail: default up to 6,000 characters for a text passage, with continuation; smaller profile limits win.
- Guide: at most 8 relevant sections.
- Selected write target: complete validated editable content within existing domain/tool limits, with sufficient remaining model input capacity.
- Run: enforce the aggregate read/model limits from [07](07_execution_persistence_and_recovery.md).

If the full editable document cannot fit, refuse that operation with a useful limit explanation or design a shared narrower editing operation. Never truncate a required replacement document and save the fragment.

Return counts that match actual coverage. A source being enabled does not mean every record was read. A failed resource fetch is “unavailable,” not “no resources exist.”

## History and source changes

Saved conversation text is not a durable plan or permission grant. Build operational state from typed run/step/action records and immutable receipts.

Tag derived messages, tool results, and summaries with source lineage. When sources are disabled for a later run, exclude affected derived context. Do not merely drop new reads while replaying the same private detail from an old summary. A coarse safe implementation can omit the whole derived message when its lineage intersects disabled sources.

Legacy generated messages have no trustworthy source lineage. After narrowing sources, omit their derived history from new model context unless a safe provenance reconstruction exists; keeping it visible in the UI does not require resending it to the model.

Direct user messages remain user input; a user may paste text themselves. Do not promise that source switches erase content already submitted, retained, or directly quoted by the user.

Conversation compaction should preserve exact action/result references, target grant boundaries, unresolved questions, and verified source IDs. It should not replace receipts, invent authority, or include private model reasoning.

## Cache boundaries

Cache keys must include API origin/environment, authenticated viewer/project/group, workspace, source policy, record identity, and revision as applicable. Revalidate access on use; a cache hit does not establish authorization. Do not introduce a cross-user shared cache for private excerpts.

Invalidate or detach stale references on workspace/account changes, source policy changes, edits, deletions, and permission changes. Keep already committed receipt readback consistent with the documented retention/access policy.

## Freshness across editors

The main page edits saved server state. It cannot see unsaved forms in another tab. On successful commit, refresh/invalidate shared library projections and notify an open dirty editor of a conflict instead of overwriting its text.

An optional future handoff of an unsaved draft must have an explicit draft identity/base revision and reuse the shared domain planner. The current card adapter's `current: null` behavior for unsaved cards must not be described as solved by retrieval.
