# ADR 19: deliberate novel erasure and minimal replay barriers

**Status:** implemented, installed and locally verified; broader D2/release gates remain open. **Date:** 2026-10-16.
**Scope:** N07 and the root-novel erase boundary in 04/09. D2 and D3–D6 remain open.

## Context

Trash and archive retain manuscript contents, history and source relationships.
Permanent erase is a separate author action. Existing source cards, shared media,
independent novel copies and records without files must remain valid. A schema
upgrade does not authorize erasure of any project content.

Creation derives a stable novel ID from its scoped request ID. Deleting the root
and its ordinary receipts alone would allow an old creation retry to recreate
the same novel. Novel AI execution plans also retain frozen prompt payloads
outside the cascading manuscript tables.

## Decision

Trash is retained until an explicit author erase; no scheduled purge is added.
Offer erase for one already-trashed novel, with a current server preview, complete
descendant/history counts and exact title confirmation. The server rechecks the
source version and workspace ownership under the existing workspace/root locks.
A changed review requires a new preview and confirmation. Active AI executions
block erasure until they finish or are cancelled.

Erasure takes the workspace's exclusive row lock before its first receipt read,
matching deterministic creation. Ordinary editing keeps its shared workspace
guard and per-novel locks. The rare erase serializes that workspace through
commit, so a waiting duplicate sees the committed receipt before looking for the
deleted root. This also prevents a creation replay from missing the barrier.
The guard follows [MySQL's current locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

The transaction removes that root and its cascading manuscript, checkpoint,
snapshot/organization history, personal-note/bookmark, reference and generation
records. It redacts frozen prompt payloads for the novel's terminal executions;
cost, reservation and execution identity records remain. Redacted executions
cannot replay, recover a provider request or expose their former prompt.

One additive `story_erase_record` table retains only owner/workspace/novel/request
identities, intent/source digests and erasure time. It contains no title, prose,
original write, prompt or source snapshot. It survives root deletion, recovers a
lost response and blocks the original creation request. Account/workspace removal
can remove this minimal metadata under their existing ownership rules.

The client uses the existing scoped mutation-journal conventions. An uncertain
result remains reachable outside the confirmation dialog. Recovery reads the
receipt first; a retry uses the identical, already-confirmed immutable request.
Retired account/workspace callbacks cannot commit or retire another owner's work.

The confirmation explains that source cards, shared media, independent copies,
previous downloads, operational backups and provider-side copies are outside
this operation. Device drafts remain available for explicit recovery/copy; this
flow does not silently discard unrelated browser journals. Broader device,
backup/provider and non-erased revision/storage policies remain separate gates.

## Alternatives considered

Retaining an emptied novel root overloads normal manuscript lifecycle/readers and
still requires removing prose from old receipts. Removing every receipt loses
idempotence and permits deterministic creation replay. A separate content-free
record gives each case an explicit contract while keeping physical manuscript
deletion inside one transaction.

## Validation and installation gates

- Strict write and ownership checks; active-root, stale-review, wrong-title,
  active-execution and request-reuse refusals change no content.
- Actual HTTP/MySQL erasure affects one selected novel, preserves other novels,
  source/non-novel data and billing headers, rejects late writes/old creation,
  and recovers concurrent/lost-response requests exactly.
- A private predecessor backup and isolated upgrade verify all original rows
  unchanged before installing the single empty table and marker.
- Shared dialog/recovery UI, English/Spanish copy, keyboard/focus and archived/
  retired-owner behavior pass before product installation. Full device/author/
  assistive-technology acceptance remains explicit.

Current prepared backend sources are `models/story_erasure.py`,
`services/story_erasure.py`, `database/mysql/story_erasure_store.py` and
`database/mysql/story_erasure_migration.py` in the sibling BFF. No erasure action
has been run against the project database.

## Verification and installation checkpoint

Prepared backend verification passed 891 tests. Installed backend checks pass
**895 tests across two non-overlapping commands** (833 domain/schema/workspace
checks and 62 additional model/workflow checks). The installed full frontend
passes **5,062 tests / one conditional fixture skipped
(543 files)**, production build and Storybook typecheck. Twenty changed TypeScript
files are lint-clean; the API client retains its 41 existing diagnostics and
DataProvider its four, with none added across the 22 changed files.

The shared confirmation and outside-dialog recovery panel provide exact-title
review, refreshed confirmation after source changes, manual recovery copy,
immutable receipt-first retry and archived result reads. Provider/gallery guards
retire only the confirmed novel and reject late cache/page responses. Controller,
dialog, gallery and provider regressions cover lost responses, storage failure,
Unicode titles, retired-owner callbacks and newer input. Controlled Storybook
keyboard inspection verified safe initial focus, exact-title gating, activation,
Escape, details and archived receipt recovery without any project database write.

Actual HTTP/MySQL proof is retained in
`magic_worlds_novel_erasure_test_3cf4cd79ef58`. It verifies a real transaction
rollback after forced failure between prompt redaction and root deletion,
concurrent identical erasure/receipt replay, stale-title/source and active-job
refusals, refusal of the original creation request, and both retained-read and
admission replay refusal after prompt redaction. The other novel has the same
title and remains unchanged. **70 rows in unrelated non-novel tables** remain
fingerprint-identical, including billing/profile records and an image record
whose file does not exist. No provider was called.

The separate upgrade rehearsal in
`magic_worlds_novel_eraseupgrade_test_15218024fdcb` installed one empty table and
the new marker while verifying **53 pre-existing rows unchanged** against its
private backup. All attempted synthetic databases remain retained. The private
native wire is `/tmp/novel-erase-persistence.json`; logs and preparation hashes
are recorded in `/tmp/novel-erase-preparation.json`.

The installed project API is healthy on **`2026_10_novel_erase`, 112 tables /
157 foreign keys**. A fresh private predecessor backup and the one-empty-table
upgrade verified all **4,449 original content rows unchanged**; only the marker
advanced. All 55 prepared source/documentation files were installed, and their
final hashes and existing staged patches were verified. The new table remains
empty in read-only runtime evidence: no project novel was erased. Exact backup,
schema/source and runtime evidence belongs to [15](15_database_migration_and_legacy_cleanup.md#novel-erasure-installation--2026-10-16).
[01](01_current_state_and_evidence.md#d2-deliberate-novel-erasure-evidence--2026-10-16)
records commands and browser evidence. This checkpoint closes no phase.


The later [persistent device-entry boundary](20_offline_and_reconciliation.md#persistent-confirmed-copies-and-device-entry)
keeps explicitly local confirmed scene copies separate from account state.
Root erasure does not purge these copies or authored journals. An account
handoff rereads the exact current target and refuses an absent/erased scene;
local copies cannot recreate the erased novel automatically.
