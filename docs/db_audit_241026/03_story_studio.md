# 03 — Story Studio data model (25 `story_*` tables)

Story Studio is **73% of the database bytes** (89 MB of 122 MB) and 96% of its rows. The cost comes from the write path, not from usage: all 21 novels are smoke/check novels.

**Verified live (2026-10-24):**
- All **1,635/1,635** scenes have `story_scene.document_json` byte-identical to `story_scene_revision` at the scene's current revision.
- **96 of 349** `story_operation_receipt` rows embed a full `document` and `plainText`.
- The SPA autosaves **1.2 s** after typing stops: `src/features/novel/hooks/useSceneDraft.ts:433`.
- No code path deletes `story_scene_revision`, `story_structure_revision` or `story_operation_receipt`, except novel erase.

BFF paths below are relative to `magic-worlds-api/src/`.

> **Revised 2026-10-25 (review at `c056d82`).** The current refactor takes the cut in [06 R2](06_migration_plan.md#r2--story-studio-25--24-tables--1114-d). Corrections to this document:
> - **Receipts never get a TTL.** Some of them are domain records that later operations read:
>   - changeset undo reads the accept receipt;
>   - replace undo/redo reads the replace receipt;
>   - assistant stop fences and conversation-creation keys live in receipts;
>   - the creation, import, package and copy "result" endpoints serve lost responses from them.
>
>   STO-06's "then give replay receipts a TTL" is withdrawn.
> - **Pointer receipts cover only the three prose kinds:** scene write, changeset accept and changeset undo. The pointer keeps the header fields and `statistics`, because ICU-dependent word counts cannot be recomputed safely. Other kinds stay inline.
> - **Replays are canonical-equal, not byte-equal.** MySQL JSON re-sorts object keys, so parity compares canonical JSON.
> - **This document (25 → about 24) is right for this refactor; 05 §2 (25 → 21) is not.** `story_operation_receipt` and `story_export_job` stay, and the terminal receipt gets its own story table instead of moving into `llm_execution`.
> - **The term table can be dropped without migrating any rows.** Ranking is a pure function of the candidates' prose, so a cold cache gives the same ranking.
> - **Deferred:** compression, structure deltas, snapshot tables, `story_media_ref`, pins, batched erase, blobs to the media store, and the O(1) statistics delta.

## 1. Table → feature map

| Table | User feature it backs | Main writers | Main readers |
|---|---|---|---|
| `story_novel` | Library, metadata, cover, POV, archive/trash. Its row lock serializes every mutation. | creation/import/copy/package stores; `story_scene_store.write_novel`/`operate_structure` | `models.list_all`, every `_root` |
| `story_part` / `story_chapter` / `story_scene` | Organization, editor, reading, search | `story_scene_store._write_unit` | studio, search, reading, library |
| `story_scene_revision` | Scene history/restore, structure undo, snapshots, annotation remap, export "AI changes", package history | `_checkpoint` (every document write), package import | revision/snapshot/restore/annotation/export/package stores |
| `story_structure_revision` | Organization history, undo/redo, named snapshots, import record | `operate_structure`, `story_snapshot_store` | history, snapshots, restore, `story_media_links` |
| `story_scene_statistics` / `story_novel_statistics` | Per-scene counts; library counts and word sort; statistics panel; writing progress | `story_statistics_store.cache_document` / `refresh_statistics` | studio, library list, writing log |
| `story_scene_retrieval` + `story_scene_term` | Novel-assistant source ranking (BM25) | `story_retrieval_store.index_batch` (background) | `story_assistant_context_store` |
| `story_annotation` (+ `_head`, `_event`) | Notes, bookmarks, frozen notes in snapshots | `story_annotation_store` (remaps on every save) | annotation, snapshot, export, package, erase |
| `story_card_ref` | Codex frozen context, mentions, POV validation | `story_codex_store`, copies | studio, generation, media cleanup |
| `story_generation` (+ `_variant`) | AI suggestions, edited versions, changesets | `models.persist_generation`, `story_variant_store` | studio, generation history, export |
| `story_plan_item` | Tasks, facts, stash | `story_plan_store` | plan, assistant context |
| `story_writing_log` | Writing progress, daily goal | `story_writing_log_store.record` (every save) | writing progress |
| `story_operation_receipt` | Idempotent replay of every mutation, assistant terminal accounting, cover retention | ~15 stores | same |
| `story_erase_record` | Erase replay barrier (tombstone) | `story_erasure_store` | erase, creation, import |
| `story_import_source` | Import record, original-file download | `story_import_store` | same |
| `story_export_job` + `_file_chunk` | Export jobs and downloads | `story_export_job_store` | same |
| `story_assistant_preference` / `_preset` | Assistant defaults, named presets (0 rows) | own stores | assistant context |

## 2. Findings

### STO-01 — Critical: one autosave writes about four full copies of the prose, and history is never pruned

**One text save** (`story_scene_store.py`):
- rewrites `story_scene.document_json` and `plain_text` (196–198, `ON DUPLICATE KEY` 207);
- inserts a full document into `story_scene_revision` (`_checkpoint` 180–185, called at 281);
- stores a receipt `unit()` with `document`, `body` (Markdown) and `plainText` (111–114, 327–330, 167–168).

For T bytes of text, each save permanently appends about 1.35 T (the revision) plus about 3.3 T (the receipt), and rewrites about 2.35 T. ROW binlog roughly doubles all of it. At about 700 saves per writing hour, that is **tens of MB per writer-hour, kept forever**. Today's small sizes only reflect that most scenes are imports with one revision each: 1,635 `initial` against 76 `manual`.

**Fix:**
1. Make scene receipts pointers: `{sceneId, revision, metadata}`. Rebuild the response from the immutable revision on replay. The response stays byte-identical.
2. Store revision bodies compressed (zstd, about 3–4×), or as a reverse-delta chain with a keyframe every K revisions. Add `story_id`, `schema_version` and `byte_size` columns.
3. Coalescing consecutive `manual` autosaves into fewer history entries is a **product decision**: it changes history granularity.

All three depend on STO-09: pins must exist before anything can be pruned.

### STO-02 — High: `story_scene` duplicates the current document and mixes header with body

Every document write pairs `_write_unit` with `_checkpoint`, in 9 call sites (creation, import, copy, package, revision, replacement, changeset, snapshot restore, scene store). Snapshot capture refuses to run without that checkpoint (`story_snapshot_store.py:41-46`). So `story_scene.document_json` is always a second copy; the live DB confirms it, 1,635/1,635.

Large JSON and MEDIUMTEXT values go off-page and do not share LOB pages. That is why 11.4 MB of payload takes 29.6 MB on disk. Header-only reads still drag those pages in:
- the studio index (`story_studio_store.py:54-58`);
- search and reading (`story_search_store.py:18-24`);
- the per-save statistics refresh;
- the erase preview.

**Fix:** split the table:
- `story_scene`: the header plus counters;
- `story_scene_text`: `(scene_id, revision, plain_text)`, for SQL search.

Read the current document from `story_scene_revision` by primary key.

### STO-03 — High: whole-novel statistics are recomputed on every autosave, and both statistics tables are caches

`write_scene` calls `refresh_statistics` (`story_scene_store.py:326`). So do write_group (660), structure (609) and restore (`story_revision_store.py:118`). `STATISTICS_QUERY` (`story_statistics_store.py:46-66`) aggregates every scene, chapter and part of the novel. `idx_story_scene_order(story_id, order_index)` does not cover revision/hash/status/trashed_at, so every scene row is read. That is O(novel) work inside the novel lock on every typing pause.

**Fix:**
- Text writes only touch active scenes (`story_scene_store.py:229-232`), so apply an O(1) delta. Recompute in full only on structure operations.
- Fold scene counters into `story_scene` columns.
- Fold novel aggregates into typed `story_novel` columns. This also makes the library word sort (`story_library.py:30-33`) indexable.

### STO-04 — High: each structure operation stores two whole-novel outlines, and snapshots are found by scanning JSON

Each operation stores:
- `snapshot`: the outline after;
- `operation._before`: the outline before, including every unit's details (`story_scene_store.py:138, 603-605`; `story_history.py:72`).

Named snapshots embed the full manifest in `operation._snapshot` (`story_snapshot_store.py:58-59`). They are listed by filtering `operation->>'$.op'='create_snapshot'` over all of a novel's rows (82, 93). Today that is about 21 KB per row on small novels, and it grows with novel size, twice over.

**Fix:**
- Store only the changed units per operation, with periodic keyframes.
- Move snapshots to their own tables:
  - `story_snapshot`: `(id, name, note, manifest_hash, counts, manifest)`;
  - `story_snapshot_scene`: `(snapshot_id, scene_id, revision)`.
- Stopgap: a generated `op` column plus an index on `(story_id, op, revision)`.

### STO-05 — Medium: `story_scene_term` is a correct cache in a wasteful shape, and FULLTEXT is not a substitute

**The shape:**
- PK is `(story_id, term, scene_id)` plus `(scene_id, story_id)`, all `varchar(64) utf8mb4_bin`.
- That is about 240 B per posting, and 94% of it is two repeated UUIDs: 32 MB on disk for 0.6 MB of terms.
- It is rebuilt in the background (`story_retrieval_store.py:50-67`), not on save.
- The read uses the PK prefix, so the index does fit the query.

**Why InnoDB FULLTEXT does not fit:**
- The ranking policy (`story_retrieval.py:10-13`) needs term rarity over the request's candidate scenes only. FULLTEXT relevance is table-wide, which would leak other tenants' text into the ranking.
- The policy folds accents and plurals and splits CJK into bigrams. One index takes one parser, and ngram on es/en indexes every bigram.
- The index would churn on every 1.2 s rewrite.

**Fix:**
- Drop `story_scene_term`.
- Keep a compact term→frequency vector per scene (sorted, zstd) in `story_scene_retrieval`, and compute the same BM25 in Python. That is about 1–3 MB instead of 32 MB.
- Drop `uq_story_scene_retrieval_story` and `idx_story_scene_retrieval_story`. Their only job is to be the term table's FK parent.

### STO-06 — Medium: `story_operation_receipt` has three jobs, so it can never expire

1. **Idempotent replay** for about 15 writers.
2. **Durable assistant terminal accounting**, updated in place:
   - written in `llm_novel_terminal_receipt.py:68-76`;
   - read by erase and admission (`story_erasure_store.py:90-101`, `llm_execution_admission.py:301-303`);
   - `read_terminal_receipt` filters by `request_id` without `story_id`, and no index serves that.
3. **Media retention:** `cover_referenced` runs `JSON_SEARCH '$**.coverAssetId'` over all of a user's receipts and structure revisions on every image delete (`story_media_links.py:25-28`, from `models.py:8710`). Its cost grows with total history bytes.

**Fix:**
- Move terminal receipts to their own table keyed by `operation_id`.
- Replace the JSON scan with `story_media_ref(story_id, asset_id, source)`, including history entries that can restore a cover.
- Then give replay receipts a TTL.

### STO-07 — Medium: binary files are stored in MySQL

- `story_import_source.content MEDIUMBLOB` holds up to 10 MB (`story_import.py:26`). Today: 8 rows, 5.4 MB.
- `story_export_file_chunk.data MEDIUMBLOB` is stored in 4 MB chunks, 5 files kept per novel (`story_export_job_store.py:23-24`).

These write-once bytes bloat the buffer pool, backups and binlog. Images, TTS and theme songs already use `storage_backend` + `storage_path`.

**Fix:**
- Move both to the media store.
- Keep the record, manifest, sha256, bytes and `file_removed_at` in MySQL, and keep the sha check (`story_import_store.py:112-113`).
- Drop `story_export_file_chunk`.

### STO-08 — Medium: novel erase is one cascading DELETE

`DELETE FROM story_novel`, under an exclusive workspace lock (`story_erasure_store.py:137-164`), cascades five levels deep: novel → part → chapter → scene → retrieval → term. Several tables are reached by more than one path. Undo-log size and lock time grow with total history, which STO-01 makes unbounded.

**Fix:** keep the tombstone and the atomic barrier. Purge heavy children (terms, revisions, receipts, events) in PK batches after the tombstone.

### STO-09 — Medium: integrity relies on code and JSON, not on the schema

**References with no FK:**
- `story_plan_item.scene_id`;
- `story_scene_revision.generation_id` / `variant_id`;
- `story_export_job.retry_of`;
- `merged_into` / `copied_from`.

**Validated only at write time:** `pov_card_id` / `location_card_id` are checked against active codex refs (`story_scene_store.py:237-241`), but not when a ref is later removed.

**References that live only in JSON:**
- snapshot manifests → revisions;
- structure undo → revisions;
- codex mentions → `ref_id`;
- annotation anchors → revision.

**Live data:** 7 of 14 `story_card_ref` rows point at cards that no longer exist, including smoke-test card ids. That is by design (refs carry a frozen `snapshot`), but nothing tells the UI the source is gone.

**Fix:** any pruning or delta scheme needs relational pins first: `story_revision_pin`, or one derived from `story_snapshot_scene` plus the undo window. Add an FK from `story_plan_item(scene_id, story_id)` to `story_scene`.

### STO-10 — Low: index fit

- **History page:** `story_revision_store.py:54` projects `JSON_EXTRACT(document_json,'$.schemaVersion')`, which reads up to 51 full LOBs per page. Add a `schema_version` column.
- **Title index:** `idx_story_novel_title(title)` matches no query, because every list is scoped. Replace it with `(user_id, project_hash, user_group_hash, workspace_id, title)`.
- **Annotation indexes:** `idx_story_annotation_page` is redundant with `idx_story_annotation_kind`. `idx_state` should be `(story_id, kind, state, created_revision)`.
- **Generation ordering:** `story_generation` lacks `(scene_id, created_at)`, so `story_studio_store.py:107,115` filesorts.
- **Unused:** `story_scene_statistics idx(story_id)`.
- **Manuscript search:** `LIKE '%q%'` (`services/story_library.py:41-62`) and `REGEXP_LIKE` (`story_search_store.py:30`) are full scans of the user's text. That is acceptable for literal/regex matching.
- **These fit:** scene load, the reader window, candidate stats, the writing log, the export list, and history by PK range.

## 3. Consolidation (every feature kept)

| Change | Features that depend on it | How they stay intact |
|---|---|---|
| `story_annotation_head` → `story_novel.annotation_revision` | Note/bookmark concurrency, copy/snapshot annotation revision | Annotation writes already lock the novel row (`story_annotation_store.py:124`). |
| `story_novel_statistics` → typed `story_novel` columns | Library counts/sort, statistics panel, writing progress | Same transaction. The freshness check becomes a column. |
| `story_scene_statistics` → `story_scene` columns | Per-scene counts, writing-log "before" words | Written with the document, as today. |
| `story_scene_term` → term vector in `story_scene_retrieval` | Assistant source ranking | Same BM25, computed in Python over candidates. |
| `story_export_file_chunk`, `story_import_source.content` → media store | Export download, original-file download | Same sha/manifest checks. Bytes read from storage. |
| `story_assistant_preference` + `_preset` → `story_assistant_setting` (optional) | Assistant defaults, presets | Defaults become a singleton row. Both tables are empty today. |
| **Split** `story_scene` → header + `story_scene_text`; document read from revision | Editor, search, reading | Header scans shrink, and search still has `plain_text`. |
| **Split** `story_operation_receipt` → replay receipts (TTL) + terminal receipts + `story_media_ref` | Replay, assistant accounting, cover retention | Each gets its own key and index. The JSON scans go away. |
| **Split** `story_structure_revision` → outline log + `story_snapshot`/`story_snapshot_scene` | History, undo/redo, snapshots | Snapshots get relational pins, so the revision bodies they need are never pruned. |

**Keep as is:**
- `story_writing_log`: a time series, not derivable once revisions are pruned;
- `story_annotation_event`: snapshots rebuild frozen notes from it;
- `story_erase_record`: the tombstone must outlive the novel;
- `story_plan_item`, `story_card_ref`, `story_generation`/`_variant`, `story_part`, `story_chapter`.

A merged "section" table for part/chapter/scene is possible (they share about 14 metadata columns), but it is not worth the risk.

### Target shape: 25 → about 24 tables, two payload kinds out of MySQL, about 70–80% fewer bytes per autosave

The table count barely moves. The win is in the bytes and in having explicit relations.

- **Removed (6):**
  - `story_scene_term`;
  - `story_scene_statistics`;
  - `story_novel_statistics`;
  - `story_annotation_head`;
  - `story_export_file_chunk`;
  - one of `story_assistant_preference`/`_preset`.
- **Added (5):**
  - `story_scene_text`;
  - `story_snapshot`, `story_snapshot_scene`;
  - `story_media_ref`;
  - the novel-assistant terminal receipt.

The estimated 70–80% reduction per autosave combines two changes:
- pointer receipts remove about 3.3 T per save;
- compressed revisions cut about 1.35 T to about 0.4 T.

**Order:**
1. STO-06 split and STO-09 pins.
2. STO-01 pointer receipts and revision compression.
3. STO-02/03 split and counters.
4. STO-04/05.
5. STO-07/08.
