# Chat Image WebSocket Delivery

**Source/lifecycle review: 2026-10-16.** Covers per-turn image galleries, the composer image control, the image details dialog and regeneration. Adventure availability is still **WIP** and follows the `adventures` plan grant (granted on the seeded Free plan). Character chats use their own stored session and message endpoints inside the shared engine. Backend, provider and deployed recovery acceptance are tracked separately; the [roadmap](ROADMAP.md) tracks play and media inconsistencies and the live smoke gates.

The frontend treats chat images as a lifecycle of their own, layered on top of normal text chat.

- The backend sends text first: `delta*`, an optional `metadata`, then `done`.
- It then sends additive `image_job`, `image_complete` or `image_failed` frames for each image job of an assistant turn.
- A turn can have several jobs: the automatic one, plus every regenerate. Every job is kept, and the turn pages through them.

The implementation boundary:

- **Backend:**
  - [the shared chat route](../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py);
  - [chat image generation](../../../PycharmProjects/magic-worlds-api/src/services/chat_image_generation.py);
  - [the per-message image routes](../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat_images.py);
  - [image enqueue and finalization](../../../PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py).
- **Frontend:**
  - [the socket protocol](../src/infrastructure/api/chatSocket.ts) and [the chat lifecycle](../src/features/interaction/hooks/useAdventureChatSocket.ts);
  - [the image store](../src/features/interaction/utils/chatImageStore.ts) and [the image hook](../src/features/interaction/hooks/useChatImages.ts);
  - [the turn gallery](../src/features/interaction/components/ChatTurnImages.tsx).

Scene inputs stay textual. Chara reference editing is [planned](chara_studio/08_roadmap_and_gaps.md).

## Wire contract

All of these fields are additive, so older clients and servers keep working.

- **`ready.capabilities`** is `{chat_image_request, chat_images}`.
  - The client sends the `image` field only when `chat_image_request` is true.
  - A chat frame that carries an image choice is held until `ready` arrives, so the choice is never dropped.
  - The composer hides its image control when `chat_images` is false.
- **The chat frame's `image`** is `{generate, image_profile_id?, credentials?}` and is strict.
  - Leaving it out means images on, with the account default profile. The client leaves it out for exactly that choice.
  - `credentials` carries a personal (BYOK) key, read from the tab's key session at the moment the frame leaves. It is never stored in turn state, the resend queue or recovery data.
- **`done.image_scheduled`** shows the "starting" placeholder as soon as the reply finishes.
- **An early `image_job` frame with status `pending`** follows within a few hundred ms, once the job row exists and before the provider submit.
- **`GET …/messages`** returns `image_generations[]` on each assistant row: newest 20, with assets, status, the scene prompt, the model prompt, the profile, the model and the cost. User rows get an empty list.
- **Per-message image routes**, for both `adventure-sessions` and `character-chats`:
  - `POST /{basePath}/{id}/messages/{messageId}/images` takes `{prompt?, image_profile_id?, credentials?}` and answers 202 with the new generation.
  - `GET` on the same path lists that message's generations.
  - A 404 from an older backend hides regenerate.

## Frame handling

- `done.assistant_message_id` and `done.turn_id` are stored on the assistant turn that just finished.
- The store is keyed by `assistant_message_id`, then by `job_id`.
  - A terminal state wins **per job**, so a second job after a finished one keeps its own placeholder and polling.
  - Duplicate and out-of-order frames are tolerated.
- A frame for a message that is not on screen yet waits in the store until the message appears. It is never attached to the newest AI reply as a fallback.
- Unknown or reserved frames are still ignored, so older and newer clients stay compatible.

## Hydration and polling recovery

WebSocket delivery is best-effort.

- **Hydration:** every server projection (load, edit, delete, clear, version select) merges `image_generations` into the store by `job_id`. Editing an AI message keeps its images.
- **Polling:** every unfinished job is polled while the page is **visible**, focused or not, with a 2 s → 4 s → 10 s backoff.
- **Watchdog for a turn marked scheduled with no frame:**
  - at 10 s, it lists the message's images;
  - at 30 s, it shows "didn't start" with Retry.
- **Server side:** a stale-job sweeper finishes or refunds jobs that nobody watches. This also frees the free plan's in-flight slots.

The browser never talks to fal.ai or provider URLs. It uses only backend routes:

- `GET /{basePath}/{id}/messages`
- `GET` / `POST /{basePath}/{id}/messages/{messageId}/images`
- `GET /images/jobs/{job_id}`
- `GET /images/jobs/{job_id}/result`
- `GET /images/profiles` (the composer and details model pickers)

## Rendering

Images render below the assistant's narrative text and above the forward options. Markdown rendering stays narrative-only: image assets are never injected into assistant markdown.

- **One aspect-reserved box per turn.** It moves through `starting`, then `pending` / `in_progress` / `mirroring`, then `loading` until the image paints, with no layout jump.
- **Pager:** "Image n of m". It selects the newest image by default and jumps to a newly started one. You can page back while a new image generates.
- **Overlay actions** (shown on hover and focus, always shown on touch): Image details, Regenerate (with its cost), Full size.
- **Composer image control** (next to the narrate button):
  - turns images on or off, and picks the model: platform and personal-key fal profiles, with OpenRouter hidden until MEDIA-01;
  - the choice is kept per chat in this browser (`mw:chat-image:<kind>:<sessionId>`). New chats start from the kind's last-used choice;
  - picking a personal profile without a key in this tab asks for the key first.
- **Image details dialog:**
  - shows the image, its **scene prompt** (editable, with Copy and Reset to original), the model picker, and the metadata (model, profile, provider, size, seed, created, status, cost, trigger);
  - shows the prompt sent to the model behind a disclosure;
  - Regenerate sends the edited prompt (only if it changed) and the chosen model, and adds a new page;
  - the dialog is read-only when the chat cannot make new images.

### What the client may show

The client may show:

- job ids, backend route URLs and mirrored backend-owned asset URLs;
- normalized statuses and sanitized public errors;
- **the turn's scene prompt and the built model prompt**, in the details dialog only. The player asked to see and edit them. They come from the REST listing, never from socket frames, and are rendered as plain text, never as markdown or HTML.

The UI must still never render:

- provider signed URLs, provider request ids or raw provider payloads;
- secrets or keys, local paths, data URIs or image bytes.

An edited prompt that contains links or `data:` is refused before it is sent. The server validates and moderates it as well, capped at 2000 characters.

## Focused test command

```bash
pnpm exec vitest run --exclude '.claude/**' src/features/interaction/utils/chatImageStore.test.ts src/features/interaction/hooks/useChatImages.test.tsx src/features/interaction/hooks/useChatImageSettings.test.ts src/features/interaction/components/ChatTurnImages.test.tsx src/features/interaction/components/ChatImageControl.test.tsx src/features/interaction/components/ChatImageDetailsDialog.test.tsx src/infrastructure/api/chatSocket.test.ts
```
