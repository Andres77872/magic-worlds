# Issue 001 — historical adventure turn-cache inconsistency

- **Reported:** 2026-06-06; original severity High.
- **Reviewed:** 2026-10-14.
- **Status:** Resolved in the current source contract; deployed verification **TBD**.
- **Feature rollout:** Adventures are **WIP — default off**, locally opted in; issue resolution does not enable rollout.

## Original problem

An earlier API returned `adventure_last_turn` as top-level `turns`, a nested `legacy.turns` cache, or `{}` depending on endpoint/state. The old client mitigation parsed several shapes. Those descriptions and the old `parseTurnState` path no longer describe the current implementation.

## Actual contract

[AdventureSessionResponse and format_session_response](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py) return validated session metadata, `template_snapshot`, `conversation_version` and workspace organization. They do **not** expose `adventure_last_turn`. List and single GET use that same response model; the single read may annotate newer snapshot-card versions.

History comes from `GET /adventure-sessions/{session_id}/messages`. [chatSessionConfig](../../src/features/interaction/chatSessionConfig.ts) loads stored messages and converts them with `storedMessagesToTurns`; mutation actions refetch authoritative history. [apiService](../../src/infrastructure/api/index.ts) implements those calls. The former PUT/cache round-trip is not the history-writing contract.

## Acceptance and remaining work

- Source inspection verifies removal from the public session response and stored-history client wiring.
- Existing [chatSessionConfig tests](../../src/features/interaction/chatSessionConfig.test.ts) cover stored-message conversion and shared behavior; backend route/model tests cover current response and persistence boundaries.
- **TBD release check:** run the matching frontend/BFF/schema in the target environment; create several turns, reload, and compare `/messages` with visible history. Do not infer a deployed cutover from source removal.

The original options to project/unwrap the cache are superseded. Track new history defects against stored messages and [ADV-01](../ROADMAP.md).
