# Novel assistant, context, tools, and changesets

**Documentation review:** 2026-10-14. **Status:** WIP / planned D3–D4 — no novel-bound conversation kind or changeset tools currently exists. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Assistant behavior

**Current baseline:** inline novel generation exists; a novel conversation assistant does not. [AssistantKind](../../src/shared/types/assistant.types.ts) and BFF `src/models/assistant.py` permit only `card`, `lorebook`, and `app`. Novel `generate` / `generate/stream` return a saved generation candidate, not a reviewed multi-resource changeset; the BFF returns `stagedCardUpdates: []`. Current card/lorebook tool handlers may write their bound documents during assistant execution, so the proposal-only workflow below needs new semantics rather than an assumption that the existing assistant already stages every mutation for acceptance.

Add a persistent assistant bound to a novel and its workspace. Support Ask and Suggest edits modes, selection handoff, multiple named conversations, stop/retry/recovery, and links from answers to passages. Chat style preferences are distinct from the manuscript's voice/style guide.

In Ask, the assistant can brainstorm, retrieve, explain, compare, and critique. In Suggest edits, it creates reviewable changes. An explicit author action commits the selected results. A deliberately authorized direct-apply convenience may be considered later for bounded edits, but it must share revision checks, checkpoints, provenance, and undo. Broad structural or multi-scene work requires a concrete result review.

Contemporary fiction products demonstrate story-aware conversation and plan-based larger changes; the proposed application contract below is a Reverie recommendation. [Sudowrite Chat](https://feedback.sudowrite.com/en/help/articles/1016913-chat)

## Scope is an input

Default scope is the selected passage when present, otherwise the active scene. Chapter, novel, selected scenes, Codex entries, series canon, and approved research can be chosen explicitly. Show scope chips and allow removing sources. Do not infer permission for another private novel from series membership or a character name.

For a factual story question, retrieve relevant passages and cite them. Separate evidence, inference, and an invented possibility. A question about a character's age must not silently create a canon fact if the manuscript has never stated it.

For drafting, use the cursor and surrounding prose. Rewrite uses the selected fragment and constraints. Critique analyzes without modifying. Scene planning uses outline goals and known state. Whole-book analysis can include future chapters only under an explicit author-analysis policy.

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

Prefer model-specific tokenization where supported. Otherwise use a conservative, explicit estimator and test it across English, Spanish, CJK, mixed scripts and structured content. The current words-times-1.35 estimate cannot establish a multilingual hard budget.

Use distinct allocations for selected context, nearby prose, canon, retrieved history, and summaries. Resolve priorities deterministically and report excluded/truncated sources. Treat scene identity, explicit instructions and essential constraints as protected context. Reject or ask for a narrower scope if they cannot fit; never silently drop the selected passage.

Retrieval can start with scoped lexical/full-text search and known scene relationships. Add embeddings only after relevance evaluation shows their value. Any embedding/helper model must be declared in the existing profile execution plan, including provider/credential/payer behavior. Retrieval filtering and tool authorization remain outside the model. [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

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

The BFF validates resource ownership, lifecycle, schema, references, target preconditions, operation limits, and dependency closure. Commit affected document snapshots/structure and proposal status in one domain transaction where feasible. Emit the acknowledged revision vector and an undo/restore record. A repeated application request returns the original result rather than duplicating text.

Partial acceptance is available only for independent operations or a dependency-complete group. For example, inserting a new scene and adding a reference to it cannot be accepted in an order that leaves a broken reference. Unaccepted operations stay stashed/reviewable. A changed base becomes conflicted; do not silently find another equal sentence and apply there.

Within the editor, previews are decorations or a separate review document. They do not become canonical prose or autosaved text before acceptance. Both inline commands and chat proposals use the same lifecycle. A successful accept is one undoable operation; durable restore remains available after reload.

## Plans and background work

For a cross-scene request, show the plan, affected units, constraints, and execution limits. Generate in bounded steps; checkpoint outputs before moving on. Integrate with the existing background-task UI when work outlives the view. Never accept a partial stream as a finished document. Preserve completed proposals if later steps fail.

Use a single controller with explicit task roles first. A planner/writer/critic/extractor arrangement is an architectural capability, not an instruction to spawn uncontrolled agents. Step/latency/cost evaluation decides where multiple model calls help. Every helper resolves a published role/profile and is accounted for in the frozen execution plan.

## Provenance, feedback, and privacy

Record exact author instructions, selected source revisions, model/profile/graph identifiers, token accounting where available, output, proposal variants, decisions, and resulting revisions. Keep credentials and unrelated private context out of logs and durable metadata. Use allowlisted fields rather than generic raw provider-response storage.

Provide source citations for factual answers and continuity findings. Critiques may offer multiple plausible choices; their judgments are not objective literary scores. Feedback can refine a pending proposal. Product telemetry should default to content-free events; any research collection of manuscript text requires a separate explicit data policy.
