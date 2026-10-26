# Interactive AI text streaming

**Source/lifecycle review: 2026-10-15.** implemented transport, deployed acceptance **WIP/TBD**. There is no frontend streaming switch since SPA `692e56bb` (2026-10-18): card and story generation stream when the caller passes `onEvent` and use the synchronous endpoint otherwise. Story/adventure/group/lorebook/app surfaces keep their own plan grants and are WIP where a plan does not grant them. See [feature status](FEATURE_STATUS.md) and **STREAM-01** and REL-01 in [roadmap](ROADMAP.md).

Migration commands and test counts below describe the original streaming rollout. Current BFF source expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (`2026_10_db_refactor` at the 2026-10-26 docs cleanup; a running database is not asserted here); the older `2026_09_text_streaming` revision is a historical step, not the current target. Inspect the actual schema/migration chain before applying it. The planner-tool stream regression was fixed in BFF `2c2973d`, with a later passing smoke on the test deployment recorded in the [current voice ledger](voice_refactor/00_current_status_and_roadmap.md); that bounded evidence does not qualify every graph/provider path.

Implemented across `magic-worlds`, `magic-worlds-api`, and `api.magic_llm`.
Media generation, extraction, and other background jobs retain their existing job lifecycle.

## User-facing behavior

| Surface | Delivery and review |
| --- | --- |
| Character, group, adventure chat | WebSocket deltas, durable turn identity, Stop, partial reply retention, and history recovery after disconnect. Interrupted replies do not trigger automatic narration. |
| Card and lorebook assistants | SSE text from normal content or the schema tool's `response` field, with generating/checking/saving stages. Partial tool arguments never apply changes. |
| Story Studio | Live prose preview at the mapped editor position; critique previews in its feedback drawer. Saved candidates enter the existing Accept/Regenerate/Decline flow. Escape aborts the request. |
| Character, world, item, adventure creation | The creation gallery includes one-shot generation. Read-only field previews appear before validation and persistence; only a saved result enters the editor and refreshes the library. Stop retains an explicitly incomplete preview. |
| Voice text | Late text from a canceled turn or another session is discarded. |

The implemented previews consume incremental output. Novel acceptance/save/undo reliability remains open in the [NE register](novel_refactor/10_issues_gaps_and_risks.md); the transport does not close those editor findings.

All preview text is real incremental output. Story preview widgets are outside the
manuscript document, so autosave cannot store an unfinished preview. Accept/reject,
selection replacement, undo, save flushing, and chapter navigation retain their
existing editor behavior. Rendering batches deltas to animation frames and flushes
them at terminal events. Completion announcements do not announce every token.

## Protocol and ownership

The shared authenticated SSE reader in `src/infrastructure/api/sse.ts` handles
fragmented UTF-8, CR/LF/CRLF, comments, multiline data, malformed JSON, incorrect
content types, missing finals, aborts, and idle connections. It cancels and releases
the response reader on exit. Authentication may refresh before consumption; a
generation is never automatically replayed after streaming begins. Account changes
invalidate in-flight callbacks and recovery.

New BFF endpoints retain the original request bodies and synchronous endpoints:

- `POST /stories/{story_id}/generate/stream`
- `POST /characters/ai/stream`
- `POST /worlds/ai/stream`
- `POST /items/ai/stream`
- `POST /adventure-templates/ai/stream`
- `GET /{characters|worlds|items|adventure-templates}/ai/result` with the original
  `Idempotency-Key`, for owner-scoped, read-only recovery.

Text-generation events carry `request_id` and one of:

- `progress`: `stage` is `generating`, `validating`, or `saving`.
- `delta`: incremental Story Studio prose.
- `preview`: a schema-allowed field `path` and its decoded text so far.
- `final`: the saved card, or the existing story generation response.
- `error`: a terminal failure; incomplete previews remain read-only.

Existing assistant streams retain their `user_message`, `assistant_delta`, and
`final` events, with additional progress stages. Their recovery matches
`metadata.request_id` and checks active-request metadata. Durable message IDs prevent
duplicate final messages, including when a final omits the full history.

The adapter forwards incremental arguments only for schema tools. Completed tool
events do not repeat argument bytes already delivered. The BFF selects one reply
source per turn and validates the complete response independently. Its shared JSON
prefix decoder handles escaped quotes, split Unicode escapes, and nested fields.

Chat adds `turn_started` with `request_id`, `turn_id`, and durable user/assistant
message IDs. Narrative and terminal frames carry that identity. Stop clears queued
sends; disconnects do not resend a sent generation. History recovery starts
immediately and polls briefly for the identified committed turn. A partially stored
projection does not overwrite visible text or restart a stopped spinner.

Cancellation interrupts an idle upstream read. Once persistence begins, cleanup
waits for the database operation; interrupted chat text is stored with explicit
partial/interrupted metadata. A card that commits during Stop can be recovered
without another paid POST. Closing the creator invalidates its result callback.

## Deployment order

For the current release, inventory the exact client/BFF/upstream revisions, verify the complete schema with the revision-matched backend operations guide, and deploy compatible streaming contracts together. The old September migration is not a current upgrade recipe. Read the [backend database guide](../../../PycharmProjects/magic-worlds-api/docs/database.md); Fish handoff remains owned by its executing work. Choose the client streaming flag before dispatch and qualify the proxy/recovery checks below on the actual release pair.

<details>
<summary>Historical September streaming rollout sequence</summary>

1. Deploy the `api.magic_llm` adapter changes.
2. Apply BFF migration `scripts/migrations/20260906_text_streaming.sql`. It adds the
   nullable `story_generation.request_id` column and advances the content schema
   revision to `2026_09_text_streaming`. Existing generation records remain readable.
3. Deploy the BFF streaming routes and services.
4. Historical: the client was built with `VITE_FEATURE_TEXT_STREAMING_ENABLED=true`
   (the default), or `false` against an older BFF. That switch was removed on
   2026-10-18, and the migration in step 2 was removed from the BFF in `c056d82`;
   current clients choose the transport per call and there is no automatic
   second-request fallback. Existing chat/assistant streaming
   remains enabled independently.

</details>

SSE responses send `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`,
and heartbeat comments every 15 seconds. The client detects connection silence
separately from its generation deadline. Ensure the deployed proxy honors the
buffering header and allows the configured request duration. The client supports
its existing card timeout override; assistant/story requests default to 180 seconds.

The follow-up development startup fix applied the migration to the configured
development database. Full schema verification passed, and the API on port 8010
returned HTTP 200 from both `/health` and `/ready`. Production rollout remains
separate.

## Validation and remaining deployment check

The following counts and browser fixture results are historical evidence from the implementation pass, not fresh runs in this documentation review.

- Full client suite: **196 files, 1,324 tests passed**.
- Affected BFF services, routes, graph contracts, and models: **605 tests passed**.
- Upstream adapter, public completions, and inline authentication: **48 tests passed**.
- Production build and Storybook typechecking passed.
- Targeted lint for the new transport, preview, and assistant lifecycle code passed.
- Local browser QA with delayed stream fixtures verified card previews before
  completion, retained previews after Stop during saving, Story Studio live preview,
  transition to review controls, and Decline restoring the original manuscript.

The original pass did not qualify all card/story streams through a public proxy. The later voice deployment smoke does not establish those SSE paths. Current release acceptance must check all four card types and Story Studio through the intended public origin: output must
appear before `final`, Stop must interrupt idle generation, a committed result must
match the library/history after reload, and disconnect recovery must use GET without
an additional generation POST. Also verify one tool-only assistant reply and chat
reconnection through that same proxy.

Server logs record request IDs for first visible output, completion, interruption,
and stream closure. Client recovery failures log the request ID and surface without
prompt or generated text. These are diagnostic events; connecting them to a hosted
metrics dashboard is separate deployment work.
