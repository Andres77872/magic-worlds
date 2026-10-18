# Novel assistant, context, tools, and changesets

**Documentation review:** 2026-10-14. **Status (updated 2026-10-18):** D3 runs in the app — bound novel conversations with cited sources, Ask/Suggest → review → accept → undo, Stop and recovery — and D4 outline proposals apply one at a time or together as one changeset with one undo. Grouped multi-scene prose changesets remain. Novels are available when the user's plan grants `novels`. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Installed saved-source preparation — 2026-10-17

[ADR 21](21_assistant_context_boundary.md) specifies the current read-only `/stories/{id}/assistant-context` contract and Studio drawer. It freezes saved passages, revisions, inherited writing defaults and scoped Codex snapshots; reports omissions/conflicting pins; and exposes the exact serialized messages and conservative budget. It does not call a model, create a conversation, persist a proposal or apply writing. The new compiler is the foundation for future turns; existing inline generation still uses its existing compiler until the unified D3 pipeline is implemented.

The protected anchor/instruction/pin envelope is never silently shortened. Optional remote paragraphs are bounded and omissions are visible. Through-anchor means reading order, not D4 temporal knowledge. Credential handling, profile admission, conversation drafts/history and review/commit semantics remain explicit D3 requirements below.

## Assistant behavior

**Current baseline:** inline novel generation exists; a novel conversation assistant does not. [AssistantKind](../../src/shared/types/assistant.types.ts) and BFF `src/models/assistant.py` permit only `card`, `lorebook`, and `app`. Novel `generate` / `generate/stream` return a saved generation candidate, not a reviewed multi-resource changeset; the BFF returns `stagedCardUpdates: []`. Current card/lorebook tool handlers may write their bound documents during assistant execution, so the proposal-only workflow below needs new semantics rather than an assumption that the existing assistant already stages every mutation for acceptance.

Add a persistent assistant bound to a novel and its workspace. Support Ask and Suggest edits modes, selection handoff, multiple named conversations, stop/retry/recovery, and links from answers to passages. Chat style preferences are distinct from the manuscript's voice/style guide.

Implementation must extend `assistant_conversation`, `assistant_message` and `tb_llm_assistant_turn`, including target ownership/FKs, terminal snapshots and tool/applied-action checks. Existing non-app constraints assume a single tool result; a novel Ask reply or unapplied proposal must have a valid distinct shape. Update those constraints, runtime handler/kind parity, `ASSISTANTS_ENABLED`, frontend history/feature filters and profile catalog contracts together through the scoped procedure in [15](15_database_migration_and_legacy_cleanup.md). Preserve existing conversations, profiles and other non-novel content. Adding a new union member alone is insufficient.

In Ask, the assistant can brainstorm, retrieve, explain, compare, and critique. In Suggest edits, it creates reviewable changes. An explicit author action commits the selected results. A deliberately authorized direct-apply convenience may be considered later for bounded edits, but it must share revision checks, checkpoints, provenance, and undo. Broad structural or multi-scene work requires a concrete result review.

Contemporary fiction products demonstrate story-aware conversation and plan-based larger changes; the proposed application contract below is a Reverie recommendation. [Sudowrite Chat](https://feedback.sudowrite.com/en/help/articles/1016913-chat)

## Scope is an input

Default scope is the selected passage when present, otherwise the active scene. Chapter, novel, selected scenes, Codex entries, series canon, and approved research can be chosen explicitly. Show scope chips and allow removing sources. Do not infer permission for another private novel from series membership or a character name.

For a factual story question, retrieve relevant passages and cite them. Separate evidence, inference, and an invented possibility. A question about a character's age must not silently create a canon fact if the manuscript has never stated it.

For drafting, use the cursor and surrounding prose. Rewrite uses the selected fragment and constraints. Critique analyzes without modifying. Scene planning uses outline goals and known state. Outline adherence is an author choice: strict for outline-first work, exploratory for discovery writing. Outline and draft may diverge intentionally; surface the disagreement and never silently rewrite either one to force agreement. Whole-book analysis can include future chapters only under an explicit author-analysis policy.

## Proposed context bundle

~~~json
{
  "request_id": "request-id",
  "novel_id": "novel-id",
  "scope": "selection",
  "task": "rewrite",
  "target": {
    "document_id": "doc-id",
    "base_revision": 42,
    "anchor": { "start_block_id": "p-1", "end_block_id": "p-2" },
    "quote_hash": "sha256-of-selected-fragment"
  },
  "temporal_policy": "knowledge_at_scene",
  "sources": [],
  "limits": { "input_tokens": 6000, "output_tokens": 1000, "max_steps": 4 }
}
~~~

This is illustrative. Define exact offsets, quoted-text rules, schema version, approved draft versus server revision semantics, and supported limit names in a future contract. TipTap/JavaScript positions commonly use UTF-16 units; Python string indexes differ for astral characters. State the wire unit and test conversion, emoji, combining marks, and multi-block selection. Never apply normalized-text indexes to original documents.

## Context compilation

Use one compiler for preview, execution, and trace:

1. Resolve actor, workspace, novel ownership, lifecycle, profile and permitted tool capabilities.
2. Bind the request to document/structure revisions and its selected fragment or cursor.
3. Resolve explicit author constraints, preferred voice, language, and scene temporal policy.
4. Include selected text and relevant prefix/suffix at the cursor with high priority.
5. Include author-pinned cards/facts and the appropriate character knowledge state.
6. Retrieve relevant scene excerpts, plot threads, and approved research within authorized scope.
7. Add verified summaries for remote context; exclude stale summaries or recompute within the authorized job.
8. Allocate input budget with space reserved for instructions, tool envelopes, and output.
9. Materialize a source manifest and the exact packet from that same selected set.
10. Persist allowlisted provenance and return a preview/trace with inclusion and exclusion reasons.

For a mutating generation, establish a saved/checkpointed target snapshot before execution. Ask may analyze a clearly labeled working draft; a later edit proposal must establish matching base revisions before commit. A local draft's hash and status must not be presented as a server-acknowledged revision.

## Budget and retrieval rules

### Source precedence and reveal policy

For K01/K03/K10/K11, resolve an approved novel-local fact or pinned story/session snapshot before its mutable library origin. A newer library version is an impact-review candidate, not an automatic replacement. Within authorized, scene-appropriate sources, explicit author inclusion/exclusion and priority take precedence over automatic mention suggestions. Resolve remaining conflicts deterministically, disclose them, and ask for a choice when conflicting canon cannot safely be reconciled. Inclusion cannot bypass ownership or the selected temporal/reveal policy.

Names, aliases, and triggers support matching/disambiguation; they are not substitutes for a source's factual content. Expose weak/empty descriptions and ambiguous matches rather than pretending they supplied usable context. For K05/K14, ordinary scene drafting excludes unrevealed lore and future character knowledge. An explicit author-analysis scope may inspect authorized future revelations, but must label that scope and must not silently carry it into scene drafting. Preview and execution retain the same source versions, ordering, reveal decisions, exclusions, and budget outcomes.

### Allocation and retrieval

Prefer model-specific tokenization where supported. Otherwise use a conservative, explicit estimator and test it across English, Spanish, CJK, mixed scripts and structured content. The current words-times-1.35 estimate cannot establish a multilingual hard budget.

Use distinct allocations for selected context, nearby prose, canon, retrieved history, and summaries. Resolve priorities deterministically and report excluded/truncated sources. Treat scene identity, explicit instructions and essential constraints as protected context. Reject or ask for a narrower scope if they cannot fit; never silently drop the selected passage.

Retrieval can start with scoped lexical/full-text search and known scene relationships. Add embeddings only after relevance evaluation shows their value. **Implemented 2026-10-18:** scoped BM25 over the request's candidate scenes (`lexical-bm25-v1`) with a revision-bound stored term index; the evaluation (`magic-worlds-api/scripts/evaluate_story_retrieval.py`) shows the gain over word presence and the paraphrase limit that embeddings would address, and none were added ([status](14_status_and_roadmap.md#d3-slice--an-evaluated-stored-retrieval-index-rest-of-k09-2026-10-18)). Any embedding/helper model must be declared in the existing profile execution plan, including provider/credential/payer behavior. Retrieval filtering and tool authorization remain outside the model. [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

## Story memory and temporal facts

Maintain four distinct layers:

- Author-approved canon and style constraints.
- Revision-bound summaries and extracted observations.
- Current scene/world/character state and revelation scope.
- Conversation history and speculative alternatives.

A fact includes source scene/document revision, supporting quote/anchor, effective time or narrative location, subject, statement, confidence/review status, and supersession. An AI extraction stays proposed until approved. Unsupported inference remains marked; it is not upgraded through repetition in chat.

Use dependency versions to invalidate derived memory. Editing source prose, moving scenes, changing POV/temporal policy, or revising canon can invalidate a summary/index/fact projection. Surface stale state and schedule bounded recomputation. Preserve approved author summaries rather than replacing them automatically.

Character knowledge is not identical to full-author knowledge. A secret, injury, relationship or item transfer may become available at a particular event, and flashbacks can reorder its presentation. Use the hierarchy and chronology contract in [04](04_novel_chapter_and_scene_management.md).

## Tool capability proposal

These are proposed domain tools, not existing API tools. Names do not grant permission.

| Tool family | Output / restriction |
|---|---|
| read_novel_structure / read_scene | Authorized structure or excerpt with revisions; bounded size |
| search_manuscript | Scoped results with stable anchors and quotes; no cross-workspace leakage |
| retrieve_codex / resolve_story_state | Selected versions and scene-appropriate facts |
| read_outline / read_research | Approved planning/research sources; imported instructions remain data |
| propose_text_edit | Typed target, constraints, base quote/hash, proposed fragment and explanation |
| propose_structure_edit | Semantic insert/move/split/merge operations with dependencies |
| propose_summary / propose_canon | Derived or proposed records linked to source evidence |
| propose_comments / propose_tasks | Draft editorial findings; scope and anchors required |
| validate_changeset | Schema, target, consistency, limit and conflict results |
| inspect_job / cancel_job | Request reconciliation and bounded cancellation under current ownership |

The model's tool registry excludes unrestricted save, delete, credential, arbitrary SQL, and commit operations. Applying a changeset is an authenticated author action handled by the domain service. Imported research cannot widen tool scope or invoke a commit. This follows the principle of controlling agency outside model instructions. [OWASP excessive agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)

## Proposal lifecycle

~~~mermaid
stateDiagram-v2
  [*] --> Requested
  Requested --> Generating
  Generating --> Reviewable
  Generating --> Interrupted
  Generating --> Failed
  Reviewable --> Stashed
  Reviewable --> Rejected
  Reviewable --> Conflict: target changed
  Reviewable --> Applying: author applies selection
  Applying --> Applied
  Applying --> Conflict
  Applying --> Failed
  Conflict --> Reviewable: reviewed new variant
  Interrupted --> Generating: recover or explicit new attempt
~~~

A request, model result, proposal, reviewed variant, and applied revision have different IDs. Retrying a lost transport response recovers the same request. Regenerate is a deliberate new attempt with lineage. Resume follows a retained plan/checkpoint and a renewed authorization/lifecycle check. Stop does not promise a refund or that provider execution never began; display the actual terminal result.

## Changeset application

Each proposal records base revisions, target anchors/quotes, operations, dependency groups, explanations and context provenance. The author can edit a proposed variant before applying; the committed digest must identify that exact variant and selected operations.

The BFF validates resource ownership, lifecycle, schema, references, target preconditions, operation limits, and dependency closure. Commit each accepted dependency-complete group of document snapshots/structure, proposal decisions, invalidation and application receipt in one domain transaction. Emit the acknowledged revision vector and an undo/restore record. A repeated application request returns the original result rather than duplicating text. External/provider jobs cannot share that database transaction; retain their plan/result separately and never report their dispatch as an applied manuscript edit.

Partial acceptance is available only for independent operations or a dependency-complete group. For example, inserting a new scene and adding a reference to it cannot be accepted in an order that leaves a broken reference. Unaccepted operations stay stashed/reviewable. A changed base becomes conflicted; do not silently find another equal sentence and apply there.

Within the editor, previews are decorations or a separate review document. They do not become canonical prose or autosaved text before acceptance. Both inline commands and chat proposals use the same lifecycle. A successful accept is one undoable operation; durable restore remains available after reload.

Keep all seven inline commands while replacing status-only acceptance and implicit-accept callbacks (CL-02/04). Existing test generations/conversations may be discarded and reseeded; no historical turn or raw-offset adapter is required. New requests retain revision/provenance/replay behavior, and application replay must not create another paid generation. The current card-only operation receipt schema is not a generic manuscript commit store.

## Editorial feedback to Codex and library

A18/K04/K12 extend the same changeset lifecycle to author-reviewed discoveries from the manuscript. A patch binds an explicitly selected existing novel-local fact, card, or lorebook entry and its expected version. Creation requires an explicitly selected authorized destination within the existing supported fact/card/lorebook families; it does not introduce a new card type. Record the supporting passage/anchor and source manuscript revision, target identity or creation destination, selected fields, before/after values, and whether the statement is evidence or inference. An invented detail or unreliable narrator's claim stays proposed; it is not canon because it appeared in generated prose.

The author may edit a proposed value, reject the suggestion, or apply an independent selection of fields. Applying those fields validates the exact reviewed variant and dependency closure, rechecks target ownership/lifecycle/version, and returns the original result on retry. A stale or missing target requires comparison or a new explicit choice. For creation, show the intended destination and require deliberate approval; do not create a new library object merely to resolve a mention.

Default discoveries to novel-local scope. A library update is a separate explicit target decision and must not rewrite other novels' pinned snapshots. Preserve the manuscript evidence and resulting target revision in provenance. The current empty `stagedCardUpdates` result and write-during-execution card/lorebook tools do not implement this review contract. This work concerns the writing-to-Codex feedback loop; it adds no game-state updates or new card families.

Reuse card/lorebook field validation and mutation planners through the [shared document-tool extraction](../assistant_improvement/04_architecture_and_reuse.md). That extraction is planned; it is not an available generic registry today. Keep one canonical tool specification per operation and caller-owned transaction boundaries, with the novel's reviewed-variant and approval policy around them. Avoid a second set of card/lorebook writers inside the novel feature. [07](07_target_architecture.md#reuse-and-overlap-decisions) records cross-plan ownership.

## Plans and background work

For a cross-scene request, show the plan, affected units, constraints, and execution limits. Generate in bounded steps; checkpoint outputs before moving on. Integrate with the existing background-task UI when work outlives the view. Never accept a partial stream as a finished document. Preserve completed proposals if later steps fail.

Extend shared task operation/target/result contracts, SQL checks and novel result navigation. Existing request leases and LLM recovery are foundations; they do not implement a resumable multi-scene planner. Persist novel plan/step checkpoints linked to existing task and execution identities, rather than another task provider or billing ledger.

Use a single controller with explicit task roles first. A planner/writer/critic/extractor arrangement is an architectural capability, not an instruction to spawn uncontrolled agents. Step/latency/cost evaluation decides where multiple model calls help. Every helper resolves a published role/profile and is accounted for in the frozen execution plan.

## Provenance, feedback, and privacy

Record exact author instructions, selected source revisions, model/profile/graph identifiers, token accounting where available, output, proposal variants, decisions, and resulting revisions. Keep credentials and unrelated private context out of logs and durable metadata. Use allowlisted fields rather than generic raw provider-response storage.

Current custom instructions already enter the frozen execution payload through BFF `build_story_execution_payload` and admission persistence. Extend `story_generation`/execution readback with an allowlisted history projection and new document/changeset lineage; do not expose the raw payload or rebuild execution provenance. This corrects the earlier durability wording in NE-020 without closing its remaining history/lineage gap.

Provide source citations for factual answers and continuity findings. Critiques may offer multiple plausible choices; their judgments are not objective literary scores. Critique cites concrete passages and plausible revision strategies; it never labels the author's prose objectively inferior, never uses an AI-detection score as an editorial gate, and does not flatten deliberate genre or style choices. Feedback can refine a pending proposal. Product telemetry should default to content-free events; any research collection of manuscript text requires a separate explicit data policy.

Before AI use, explain which manuscript/context material is sent, the selected execution/provider route, and the applicable retention and training policy in plain author-facing language. Describe verified policy and unresolved limits accurately; do not infer a non-training, zero-retention, or copyright guarantee from this proposal. Ordinary local writing must remain available without agreeing to an AI request.
