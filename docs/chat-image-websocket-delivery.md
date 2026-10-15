# Chat Image WebSocket Delivery

**Source/lifecycle review: 2026-10-15.** implemented frame/recovery handling; adventure availability **WIP — default off**, locally opted in. Character chats use their own stored session/message endpoints in the shared engine. Backend/provider/deployed recovery acceptance remains separate; [roadmap](ROADMAP.md) tracks play/media inconsistencies and live smoke gates.

The frontend treats chat-generated images as a turn-local lifecycle layered on top
of normal text chat. The backend still sends text first (`delta*`, optional
`metadata`, then `done`) and may later send additive `image_job`, `image_complete`,
or `image_failed` frames for the same assistant turn.

The implementation boundary is [the shared chat route](../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py), [image enqueue/finalization](../../../PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py), [socket protocol](../src/infrastructure/api/chatSocket.ts) and [frontend chat lifecycle](../src/features/interaction/hooks/useAdventureChatSocket.ts). This cleanup rechecked source ownership and retained the test command below; no live delivery, browser or provider test was run. Scene inputs remain textual; Chara reference editing is [planned](chara_studio/08_roadmap_and_gaps.md).

## Frame Handling

- `done.assistant_message_id` and `done.turn_id` are stored on the just-finished
  assistant turn.
- Image frames are merged by `job_id` first, then `assistant_message_id`, then
  `turn_id`.
- Duplicate and out-of-order frames are tolerated. Terminal image states do not
  regress back to non-terminal states.
- Unknown/reserved frames remain ignored so older and newer clients stay
  compatible.

## Hydration and Polling Recovery

WebSocket image delivery is best-effort. The client hydrates image-aware turns
from the session API after `done`, reconnect/open, page visibility recovery, and
online recovery. Non-terminal local jobs are polled through backend-owned image
routes until they become terminal.

The browser never talks to fal.ai/provider URLs. It uses only:

- `GET /adventure-sessions/{id}`
- `GET /adventure-sessions/{id}/messages`
- `GET /images/jobs/{job_id}`
- `GET /images/jobs/{job_id}/result`

## Rendering

Generated image UI is rendered below assistant narrative text and above forward
options. Markdown/message rendering stays narrative-only: generated image assets
are not injected into assistant markdown.

Allowed client-visible image data is limited to local job IDs, backend route URLs,
mirrored backend-owned public asset URLs, normalized statuses, and sanitized
public errors. The UI must not render provider signed URLs, raw prompts, provider
request IDs, raw provider payloads, secrets, local paths, data URIs, or image
bytes.

## Focused Test Command

```bash
pnpm test --run src/features/interaction/utils/chatImageTurnState.test.ts src/features/interaction/hooks/useAdventureChatSocket.test.tsx src/features/interaction/components/ChatTurn.test.tsx
```
