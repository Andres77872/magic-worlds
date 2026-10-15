# Issue 002 — historical conversation mutation gap

- **Reported:** 2026-06-06; original severity High.
- **Reviewed:** 2026-10-14.
- **Status:** Mutation routes and frontend wiring implemented; deployed persistence acceptance **TBD**.
- **Feature rollout:** Adventure UI remains **WIP — default off**, locally opted in. 1:1 character chat has no equivalent product gate.

## Original problem

Reset/edit/delete once changed only the legacy session cache, so rebuilding history from stored messages restored the original conversation. The current source no longer uses that cache-only path.

## Implemented contract

Both `adventure-sessions/{id}` and `character-chats/{id}` support:

| Method / suffix | Behavior |
| --- | --- |
| `GET /messages` | Read stored history |
| `PATCH /messages/{message_id}` | Edit a stored message |
| `DELETE /messages/{message_id}` | Delete a stored message |
| `DELETE /messages` | Clear stored conversation history |
| `POST /messages/{message_id}/activate` | Select a stored reply version |

Evidence: [adventure routes](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py), [character-chat routes](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_character_chat.py), [API client](../../src/infrastructure/api/index.ts) and [chatSessionConfig](../../src/features/interaction/chatSessionConfig.ts). Shared frontend actions await mutation and refetch history; they do not persist through `adventure_last_turn`.

Routes/models enforce ownership, project/workspace scope and conversation concurrency. Archived-workspace writes remain rejected. Existing backend [message edit tests](../../../../PycharmProjects/magic-worlds-api/tests/test_conversation_message_edit.py) and [message delete tests](../../../../PycharmProjects/magic-worlds-api/tests/models/test_conversation_message_delete.py) exercise scoped mutation and locking behavior with controlled database doubles.

## Remaining acceptance

**TBD in the target deployment:** edit/delete/clear, then reload and read stored history; attempt writes in a wrong/archived workspace and during an active turn; verify reply versions and derived image/TTS state follow the intended mutation policy. Unit fixtures do not prove a deployed database transaction.

The original “no client workaround is possible until endpoints exist” claim is superseded. Track any new behavior gap against this implemented contract in [ADV-01](../ROADMAP.md).
