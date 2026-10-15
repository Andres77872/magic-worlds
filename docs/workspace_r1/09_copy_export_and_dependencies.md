# Copy, export, and dependency behavior

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Selected R1 copy contract implemented in workspace_copy.py and the frontend copy flow; release acceptance remains WIP.\
**Refreshed:** 2026-10-12.

## Actions and existing foundation

| Action | Identity / content effect | R1 |
|---|---|---|
| Add/remove collection | Same card; membership only | Implement |
| Duplicate within workspace | New independent local card | Preserve and scope |
| Copy to workspace | New private destination roots with lineage | Implement bounded all-or-nothing command |
| Move | Changes live reference ownership | Deferred |
| Export card | Existing portable supported content | Preserve |
| Workspace/collection bundle | Manifest and cross-install transfer | Deferred |

In the approved library browser, collection folders represent membership in this table. Adding to a folder keeps the same card at the library root and in its other collections. Removing from a folder or deleting the collection does not delete the card. Folder navigation/appearance is not an implicit move or copy command. Cross-workspace independence still requires explicit Copy to workspace with a visible destination and optional destination collection.

[CardResourceCloner](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_resource_clone.py) prepares media/lorebooks for existing per-card clones. Owner duplicates reuse media; cross-owner public/share imports copy owned blobs. Published bodies, lineage, transactions, and cleanup are reusable. Destination scope, batch dependency maps inside a single transaction, and the success-only request receipt must be added.

The current cloner creates a new lorebook per attachment and carries embedded resource metadata. Independent linked rows live separately in lorebook_resource/link. Batch copying must handle both representations rather than merely loop over the old copier.

## Selected field policy

| Field / content | Destination behavior |
|---|---|
| Published body | Copied as read inside the copy transaction |
| Unsaved form/unpublished draft | Excluded; UI explicitly says Published content |
| Version history | Not transferred; destination starts its own version history |
| original_card_id / original_creator_user_id | Existing original-lineage semantics retained |
| clone_source_card_id | Immediate source retained as provenance |
| Source version pointer | Retain only genuinely captured source-version provenance; normal mutable edits are not invented versions |
| Collection IDs | Only validated requested destination memberships |
| Public flag/share links | Private card; no copied tokens/links |
| Published is_default_persona | Always false on copy |
| Character default_persona_id | Remap when that persona is in the selected batch; otherwise null, with a dependency-summary notice |
| Image/theme-song IDs/URLs | Same-owner/application immutable asset references reused; add destination visibility associations |
| Attached lorebooks | New destination lorebooks and attachments; preserve linked/snapshot behavior |
| Linked independent resources | New destination resource rows plus links; no live source-workspace reference |
| Embedded metadata.resources | Deep-copy snapshots with destination-local embedded resource IDs; remap same-document resource references |
| Source/extraction hashes, immutable excerpts | Retain valid content/extraction state; remap identity fields only; revalidate existing source-hash contracts |
| Historical story/session/card source IDs | Preserve as provenance/snapshot identity; do not resolve as destination editable targets |
| Credentials/profile defaults/voice presets | Credentials are never copied; profiles/defaults/presets retain existing account/application ownership |

The live-reference field inventory includes character default_persona_id, card/lorebook attachment targets, independent resource links, and destination collection IDs. Adventure-template persona/characters/world are embedded card snapshots; retain their historical source/version IDs and recursively reuse validated media, without rewriting every field named id. Document any newly found live-reference field before implementation changes it.

## Dependency maps and source consistency

Read card bodies, attached book payloads and attachment state, independent resources, embedded resources, and media references inside the copy transaction with share locks in deterministic order, and build the destination ID maps in memory for that transaction only. Nothing is stored for later; the copy reflects the source exactly as read, and later source edits or deletion do not affect it.

Map selected cards by source identity. Map a linked lorebook once by source identity plus captured live state hash. Snapshot attachments with different snapshot hashes are separate destination states; identical snapshot states can share a cloned destination book. When both live and snapshot forms exist, classify their state keys explicitly.

For snapshot attachments, the attachment snapshot governs effective copied content. Copy the live book payload and its resources separately from the snapshot to preserve the existing underlying-book behavior; do not substitute newer live entries for that snapshot. Clone independent resources once per source ID/state and remap links. Map embedded resource IDs per destination book state, retaining evaluation/source hashes and existing validation rules.

Do not clone unrelated account-global lorebooks, unused source materials, activities, or history. A card collection never expands the dependency set automatically.

## All-or-nothing copy

Use the exact request/result/limits in [document 15](15_execution_contracts.md): at most 20 cards, 100 attached book states, 100 independent resources, 8 MiB copied payload. Every copy creates new cards; import conflict detection remains a separate destination-local behavior.

A copy runs as one database transaction:

1. Validate identities, source/destination ownership, destination active state, feature gates, destination collections, and bounds.
2. Read and share-lock the source content and referenced media inside the transaction; same-owner workspace copy reuses immutable media bytes.
3. Insert cards, books/resources, attachments, links, destination memberships, media associations, and the copy receipt, then commit.

If anything fails — a validation error, an archived destination, a deleted collection or source card, a lock timeout, a database error — the transaction rolls back, nothing is created, and the user sees the error and can run Copy again. A copy is never left half-done, so there is no recovery, resume, status polling, or cleanup step.

The receipt only stops a double submit or a lost response from creating a second copy: repeating the same request ID after success returns the stored mapping, even if those copies were since deleted, and never recreates them. A new Copy again command uses a new request ID. The existing tb_operation_receipt remains card-generation-specific. Cross-owner public/share imports keep their existing separate blob preparation and cleanup.

## Media lifecycle and file portability

Media references are shared bytes, not shared editable card content. Changing the Sandbox portrait changes that copy's reference only. Keep account/application-wide deletion checks across bodies, drafts, versions, activities, and receipts. A deletion that races a copy either finishes first (the copy fails) or waits for the copy to commit (the new references then block it). Archived workspaces retain associations and references.

Portable exports contain supported content/provenance and media in the existing supported format, without organization fields, local collection IDs, secrets, or share authority. Existing snapshot source identities remain historical provenance where the format supports them. Import selects its private destination explicitly and preserves existing media portability checks.

Workspace bundles remain deferred; they would require their own format/version/remapping specification.
