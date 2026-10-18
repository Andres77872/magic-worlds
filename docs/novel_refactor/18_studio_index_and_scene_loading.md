# ADR 18: Separate the Studio outline from loaded scene content

**Status:** Implemented and locally validated; complete D2 performance,
offline/retention and author/device acceptance remain pending.
**Date:** 2026-10-16, America/Mexico_City.
**Deciders:** Codex implementation within the requested D1–D6 refactor. Product
offline/retention and release decisions remain open in [14](14_status_and_roadmap.md).

## Context

Before this change, Studio opened a complete `Story`, including every canonical scene
document, Markdown/plain projections, Codex snapshots and generation output.
The previous scene GET also read that entire tree before returning one scene.
The bounded continuous reader does not remove either cost. Reusing an empty
document, empty history or truncated chapter body as an unloaded placeholder
would violate the draft/save, copy, history and revision contracts.

## Decision

Use a separate `studio_index` read projection with novel/part/chapter/scene
metadata, stable parents/order, independent revisions/hashes, exact inheritance
and revision-bound numeric statistics. Scene documents, plain/Markdown prose,
chapter body aggregates and generation histories are absent. Complete current
Codex references remain explicit at the root; this first split does not claim
bounded Codex memory or constant-size organization metadata.

Read one canonical scene document in a consistent owned transaction. The guarded
response uses schema 2, `scene_document`, and a nullable latest context trace;
it does not include a generation-history collection. A guarded
`studio_scene` request binds novel metadata/structure/context revisions,
chapter/part metadata revisions and the selected scene revision/metadata/hash.
A changed source returns `STORY_STUDIO_SOURCE_CHANGED` before exposing a mixed
editable source. Existing scene GET keeps its full scene response shape and
uses the same selected-document reader without reading other scene bodies.
All reads retain archive/Trash and workspace ownership rules and make no writes.

The frontend index has its own type and wire validator. It is not a `Story` and
cannot initialize the editor or enter full-story mutation/cache helpers. UI
integration keeps one active canonical scene, at most three / 16 MiB serialized
UTF-8 confirmed-scene cache entries, and durable drafts/requests separately. Evict only confirmed
read-cache payloads; never drop unsaved input or pending requests. Scope changes
retire callbacks. Selection must flush/review the previous writer, preserve its
instance until a verified replacement is ready, and provide explicit retry on a
failed/stale read. A late response cannot select another novel or workspace.

## Options considered

| Option | Complexity | Scaling | Integrity consequence |
|---|---|---|---|
| Keep full `Story` and trim it after downloading | Low | Initial network/server/browser hydration still grows with all prose | Does not resolve the identified limit |
| Make missing prose look empty in the existing type | Low initially | Can reduce transfer | Could save blank content or falsely clear history; rejected |
| Separate index and complete selected scene | Medium | Outline metadata grows with unit count; prose work follows selected scenes | Explicit unknown content and independent source guards; selected |

## Trade-offs and consequences

The smaller initial read needs explicit loading/error states and cache ownership.
Full-tree assumptions in outline totals, unit copy review, generation history,
search/bookmark navigation, structure/snapshot recovery and creation/copy result
opening must be replaced together before switching Studio. Cached numeric
counts may be unavailable; missing counters are not zero. Generation history
and manuscript text must remain readable through on-demand sources rather than
being silently shortened to the currently loaded scene. Current full novel GET
remains available for operations that still explicitly need it during this work.

The backend read split requires no schema change, reset, cleanup or project
database test write. Synthetic reads must prove unchanged original rows and
that an index hydrates zero scene documents while selected reads hydrate one.
Measured fixture bytes/timing are scoped evidence, not supported product limits.

## On-demand dependent sources

Generation history uses owned 20-row keyset summary pages, 240-codepoint previews
and an explicit full-generation detail/copy reader. Current archive/Trash locations
are visible. The ephemeral session output cache is capped at ten / 16 MiB and
never owns pending AI review. Existing complete scene GET defaults remain intact;
`?projection=document` supplies only the canonical document/latest trace.

Copy and organization reviews page at most twenty / 240-codepoint saved excerpts
bound to root and exact scene heads. They never hydrate canonical documents.
Changed native sources after a save invalidate organization review; the writer
never substitutes a newer split/merge revision without rereview. Creation/copy
receipt retirement waits for the selected scene to open. Search, annotation,
bookmark, scene revision and snapshot flows use their separate exact readers.

`PUT .../studio-index` reuses the root metadata writer and returns the exact
original receipt, normalized request echo and fresh index. Replays preserve later
metadata. Local acknowledged heads produce `studio_state` with null sourceVersion;
only a verified exact server index retains its native source hash. Library state
contains metadata summaries and never accumulates canonical bodies.

## Verification and remaining action items

1. Strict index/selected-scene contracts and scoped read storage are installed.
2. Actual HTTP/MySQL verifies ownership, source changes, empty/archived scenes,
   complete applicable references/history, and read-only fingerprints.
3. Studio/provider opening and dependent refreshes use the index plus selected
   scene, bounded confirmed caching and explicit loading/error/retry states.
4. Copy/history/search/bookmark/snapshot and draft/AI-review regression paths
   pass. Controlled browser checks exercise real loader/editor switching, typing
   during a delayed read, failure/retry and bounded history/excerpt navigation.
5. Measure repeated switching, active-scene latency and memory; retain all
   remaining author/device/offline/retention acceptance in [12](12_validation_and_acceptance.md).
