# Persistence, revisions, recovery, and offline writing

**Documentation review:** 2026-10-14. **Status:** WIP / planned D1–D2 — required recovery and revision contracts; current autosave is a partial baseline. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Required invariants

These are target invariants, not guarantees of the present editor. The current [draft hook](../../src/features/novel/hooks/useChapterDraft.ts) stores title/body in memory, debounces saves for 1.2 seconds, retries retryable failures after 5 seconds, flushes on navigation, and warns during unsaved unload. It has no durable local draft journal or expected chapter revision. The BFF `StoryModel.update_chapter()` locks rows and reloads the saved chapter without comparing a caller revision. [Generation history](../../src/features/novel/components/NovelGenerationHistoryDrawer.tsx) preserves AI output/status, not manuscript snapshots. Keep these distinctions visible when assessing D1–D2 completion.

1. A saved indicator refers to the exact displayed document revision.
2. Late requests cannot replace newer work or cross workspace/account boundaries.
3. A locally checkpointed draft survives an ordinary reload/process loss within the supported storage contract.
4. Unaccepted AI output is separate from committed manuscript prose.
5. Accepted AI changes are undoable and recoverable after reopening.
6. Revisions, trash, local recovery, and operational backups are distinct facilities.
7. A failed remote save does not discard the local document.
8. Restore creates a new revision and preserves the history being restored from.

## Save state and queue

Track local revision, locally checkpointed revision, sent revision, acknowledged server revision, content hash, and pending request IDs. Prefer state names that explain the writer's situation: editing, saved on device, syncing, saved to account, offline changes, conflicted, and failed.

Per document, coalesce unsent edits into the latest snapshot and allow one active remote save. On completion, only acknowledge the snapshot carried by that request. If newer local edits exist, keep a pending state and send the newest snapshot next. A manual Save flushes this queue; it does not create a parallel request.

Server writes compare an expected revision and return a new revision/hash. A repeat request ID with the same intent returns its original acknowledgement; different content under the same ID is rejected. A conflicting write preserves the local snapshot and fetches only authorized current content for comparison. Conditional updates are a standard way to avoid lost updates. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)

A chapter title/goal update has its own validated metadata patch. Do not mark an omitted invalid title as saved while leaving a mismatching visible value. Reconcile successful server values and report field errors separately from prose saving.

## Local draft journal

Use IndexedDB or an equivalent bounded durable store for scene draft checkpoints. Namespace by account, workspace, novel, scene/document and schema version. Each checkpoint includes body, local revision, base server revision/hash, local timestamp, and pending-sync state. Keep transient credentials and unrelated conversation context out of it.

Write a checkpoint after document transactions through a short, measured schedule and on reliable lifecycle transitions. Browser hidden state is an important checkpoint opportunity; unload/termination callbacks are not reliable, especially on mobile. [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

The application should distinguish saved-on-device from synced-to-account. IndexedDB availability, quota and browser eviction are real limitations: detect failure, retain in-memory work, show recovery/export options, and document the supported offline guarantee. Do not promise permanent backup from local browser storage.

Authentication expiry keeps the draft accessible and allows reauthentication, copying/exporting recoverable text, or explicitly discarding it. Account/workspace switches must not reveal another account's checkpoint or send it to a newly selected workspace. Logout/shared-device checkpoint retention is an open product/privacy decision with a visible policy.

## Recovery flow

On opening a document:

1. Load server revision and matching local checkpoint metadata.
2. If local content is newer/unsynced, show a preview instead of overwriting it.
3. Offer resume local draft, compare/merge, keep as separate copy, or use server text.
4. Preserve both snapshots until the decision is durable.
5. Revalidate permission/lifecycle before remote sync.
6. Retain recoverable content when the server version is archived/deleted or authorization changed; explain the allowed recovery route.

Do not silently choose the larger or later-timestamp string. Wall clocks and character counts are not revision authority.

## Revision history

Use immutable scene/document checkpoints with actor, parent revision, operation source, schema version and hashes. Store author-named snapshots around milestones, substantial AI commits, restore, and destructive structure operations. Coalesce routine autosave history under a documented retention strategy so each keystroke does not become an expensive full snapshot.

The history UI provides date/actor/source filters, before/after comparison, copy of selected old prose, and restore. A restore creates a new current revision and an event linking back to the selected historical revision. Comments and derived memory are remapped or marked stale/orphaned; they must not be silently attached to a different equal sentence.

Structure history is separate from text history. Undoing a chapter move should restore order without replacing edits made to its scenes since the move. Named whole-novel snapshots can record a manifest of structure and document revision IDs rather than duplicate every body.

## Session undo versus durable recovery

TipTap/ProseMirror session history provides immediate undo. An accepted AI replacement must be one event that restores the exact original slice, including marks and references; redo restores the accepted variant. Rejection and regeneration must not resurrect candidates or duplicate original text.

Durable revisions provide recovery after reload and across devices. Generated-output history provides alternatives and provenance. Operational database/artifact backups provide disaster recovery. None should be represented as a substitute for the others.

## Proposal acceptance durability

Prefer a transaction that commits the author-approved result, creates a document revision, marks accepted operations, and records changeset lineage together. If interim compatibility requires body save then status update, check the body-save result and expose a pending acceptance state until reconciliation finishes.

A lost response is recovered through request/changeset IDs. Do not regenerate or apply again just because the UI missed the acknowledgement. Network errors, permanent validation errors, conflicts, archived workspace state, and authentication expiry need different recovery actions.

## Archive, trash, and erase

Archive removes a unit from the active manuscript but preserves it for restoration. Trash is recoverable removal with an explicit retention policy. Permanent erase is separate and explains descendants, comments, history and export artifacts affected. Existing card/library sources are not deleted by erasing a story copy.

Keep tombstones or equivalent reference metadata so links and jobs resolve safely. Restoring a scene with a deleted parent chooses a valid destination. Pending AI jobs/proposals cannot resurrect an erased scene. Workspace archive restrictions continue to apply to all domain commits.

## Offline editing and the author's own clients

Initial offline support can edit cached documents, checkpoint locally, and sync through revision checks. Online model calls remain unavailable unless a configured backend/provider is reachable; the UI states that clearly. Offline edits should not queue an unlimited set of paid generations automatically.

Persist cached documents and pending local checkpoints with their acknowledged base revision. On reconnect, submit through the same revision-checked save contract. If another tab/device advanced the server revision, retain both versions and offer comparison, a reviewed merge, or keeping the local draft as a copy.

The proposed authority stays in the versioned document/save service. Collaborative synchronization, shared editing sessions, and per-user collaborative undo are out of scope. Test reconnect conflicts and stale AI anchors for the author's own clients. See [07](07_target_architecture.md).

## Retention and performance

Retention periods and storage ceilings remain open. Publish them and allow portable export. Keep source revision manifests for AI/external artifacts while avoiding unnecessary full prompt duplication. Index recent revisions and paginate older history. Test schema-version restore and garbage collection against the oldest supported checkpoint.

Release evidence must include interruption, storage/quota failure, conflicting tabs, stale requests, authentication expiry, workspace switch/archive, revision restore, trash restore, and backup/restore rehearsal. The test matrix is in [12](12_validation_and_acceptance.md).
