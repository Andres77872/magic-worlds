# Backend issue register

**Reconciled with source: 2026-10-14.** These June reports describe an earlier API contract. Both original implementation gaps are addressed by the current source; deployed verification is separate. Adventures remain **WIP — disabled by default**, locally opted in. See [feature status](../FEATURE_STATUS.md) and [roadmap](../ROADMAP.md).

| Issue | Original problem | Current disposition | Remaining verification |
| --- | --- | --- | --- |
| [001](001-adventure-last-turn-shape-inconsistency.md) | Inconsistent legacy turn-cache shape | **Resolved in current contract:** `adventure_last_turn` is removed; stored messages provide history | Verify current schema/client rollout together; deployed session/history smoke |
| [002](002-conversation-reset-and-message-mutation.md) | Reset/edit/delete did not affect stored history | **Implemented:** scoped stored PATCH, DELETE, clear and activate routes; client refetches history | Reset/edit/delete/reload and busy-conversation integration smoke in target environment |

## Current endpoint evidence

The earlier “verified 2026-06-06” inventory is superseded. The client now refreshes tokens, reads `/user/me`, and loads stored messages. This is a scoped source review, not an assertion that every endpoint/response has been exercised live.

- Authentication/profile: [API client](../../src/infrastructure/api/index.ts), [AuthProvider](../../src/app/providers/AuthProvider.tsx).
- Session metadata, messages and mutations: [adventure routes](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py), [character-chat routes](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_character_chat.py).
- Shared frontend history/mutation behavior: [chatSessionConfig](../../src/features/interaction/chatSessionConfig.ts) and [tests](../../src/features/interaction/chatSessionConfig.test.ts).

Do not reintroduce the retired cache or add duplicate mutation routes to implement these historical PRDs. File a new issue against the current stored contract when a reproducible gap remains.
