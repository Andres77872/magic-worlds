# Decision 21 — saved-source assistant preparation and execution boundary

**Status:** source preparation implemented locally, 2026-10-17. Full D3 remains WIP. This decision extends [08](08_ai_assistant_context_and_tools.md), the [loading boundary](18_studio_index_and_scene_loading.md) and [D3 delivery](11_refactor_and_migration_plan.md#d3-grounded-writing-assistant). It does not complete conversations, profiles, proposals or manuscript application.

## Context and decision

The shared card/lorebook assistant currently treats tool replies as applied document actions. Novel Ask answers and unapplied edit proposals require different valid result/storage shapes. Adding `novel` to a kind union would bypass that distinction. Implement the source contract first, then extend the shared conversation/profile/execution services with an explicit proposal/commit boundary.

`POST /stories/{story_id}/assistant-context` is an owned, read-only preparation endpoint. It uses ordinary authenticated workspace reads and needs no LLM configuration. Its strict request admits only a saved `sourceVersion`, anchor scene, scope, exact optional selection, Ask/Suggest intent, authored question, reading policy, archive/Codex choices and bounded preview limits. Model credentials, arbitrary tool authority and apply requests are rejected.

The frontend obtains a fresh metadata index in the captured API/author/workspace/novel scope before preparation. A newly captured passage becomes the default source scope; otherwise preparation starts with the active scene. A selected passage retains its captured revision/hash/UTF-16 offsets and exact quote. A changed selection or saved source fails explicitly; it is never relocated by searching for similar text. Preparation never flushes unsaved prose. Device-only copies do not become account sources.

## Owned source and citation contract

One backend transaction reads the owned index, selects eligible scene heads, ranks literal question terms inside those scene IDs, and loads at most the requested maximum of 20 scene documents. It uses no whole-manuscript reader, history collection, cross-novel lookup or external research fetch. All IDs and canonical document hashes are checked against the saved heads.

Scopes are selection, scene, chapter, novel and an explicit unique scene set containing the anchor. Trash/merged units and `includeInAI` exclusions remain excluded. Archive inclusion is deliberate. The default through-anchor boundary means reading order only. Author analysis explicitly permits later reading-order scenes; D4 still owns temporal knowledge, reveal rules and uncertain/inferred facts.

Every included scene carries root/ancestor/scene revision identity, canonical content hash, inherited writing defaults and exact saved passages. Passage IDs bind the source, revision/hash, UTF-16 range, quote and available block anchor. Whole-scene spans crossing unsupported non-text boundaries or the annotation anchor's size limit may have a null block anchor; the revision-bound quote/range remains exact. Selected passages require an exact stable anchor.

Enabled pinned Codex context uses existing scene → chapter → novel precedence, including disabled local overrides. Snapshots remain frozen sources; preparation resolves no live library update. Different effective scoped snapshots for one card stay separate and are labeled as conflicting evidence in both the actual packet and inspector. Lore without a verified reveal boundary is excluded under through-anchor and reported; explicit author analysis can include it. No approved canon fact is created by retrieval.

## Actual messages and allocation

The result exposes the actual system and canonical JSON source messages, their SHA-256 hash, saved source version and trace. The frontend checks request echoes, source membership/heads, exact selection/quotes, message/packet identity, exclusions/conflicts and the byte estimate. It trusts the authenticated server for document/snapshot hashes whose complete source documents are intentionally unloaded; it does not invent a browser-only crypto requirement on LAN HTTP.

Input estimation is the UTF-8 byte count of the actual serialized messages plus conservative framing. Reserve output before adding sources. Instructions, the complete selected target (or full anchor scene) and enabled target pins are protected: fail on insufficient space rather than silently shortening them. Optional remote paragraphs are selected whole, with visible source/passage/budget omissions. This is a conservative preview estimate, not a provider tokenizer or price guarantee. Execution must also enforce the resolved published profile's limits and preserve the actual execution packet/lineage.

The drawer labels earlier choices or changed known heads as stale. Closing aborts its pending read; late replies cannot replace another scope's state. Its question survives closure while the same book/owner component remains mounted. Durable conversation drafts across navigation/reload are still required D3 work.

## Remaining execution and application work

Extend existing assistant kinds, target ownership/FKs, conversation/message/result constraints, published feature/role seeds and profile filters together. Ask answers and staged proposals need valid independent terminal shapes. Keep no-tool answers useful. Credential custody findings in the existing security/profile dossiers are not resolved by this provider-free endpoint and must be addressed before expanding execution.

Bound turns must use this source compiler for both inspectable preview and actual execution; existing inline generation retains its current compiler until that unification is implemented. Preserve request/admission/result recovery and expose allowlisted safe instruction/source/application lineage. Do not copy raw credential-bearing frozen payloads into history APIs.

Novel proposals require persisted original/approved final-document or semantic-operation boundaries, base revisions, dependency-aware partial selection, comparison/refine/stash and explicit commit. Accepted application must atomically preserve checkpoints/receipt/provenance and support undo/recovery without paying for another model execution. Planning, summaries, canon proposals and the complete author/profile/account/workspace acceptance remain in scope.

No collaboration, reset, record/file/orphan cleanup, automatic manuscript edit, paid request or public publication is authorized by source preparation. All recovered non-novel content and current novels remain preserved.

## Evidence

[Delivery checkpoint](14_status_and_roadmap.md#d3-saved-source-context-preparation--2026-10-17), [execution evidence](01_current_state_and_evidence.md#d3-saved-source-context-preparation-evidence--2026-10-17), [frontend wire guard](../../src/infrastructure/api/storyAssistantContextContract.ts), [owned source hook](../../src/features/novel/hooks/useAssistantContextSource.ts), [drawer](../../src/features/novel/components/NovelAssistantContextDrawer.tsx) and its colocated tests/stories. BFF evidence is `tests/services/test_story_assistant_context.py`, `tests/models/test_story_assistant_context_store.py`, `tests/routes/test_story_assistant_context_routes.py` and `scripts/smoke_novel_assistant_context.py` in a newly allocated retained synthetic database. Controlled native desktop evidence and focused checks do not close full D3 or release gates.
