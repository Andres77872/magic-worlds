# Current project — implemented base, WIP studio

**Status:** Source-backed inventory. **Reviewed:** 2026-10-15, including local working-tree changes. **Scope:** Frontend and sibling `magic-worlds-api`; no deployment, paid generation or live provider tests. The editing/reference extension remains **WIP**. UI recommendations are in [02](02_ai_image_section.md).

## What already exists

| Existing piece | Actual behavior | Evidence |
|---|---|---|
| Character creator media section | Generates from card facts and art direction; uploads/replaces/removes the cover; selects previous media | [CharacterCreator](../../src/features/creation/character/components/CharacterCreator.tsx), [MediaStudioSection](../../src/features/creation/common/components/MediaStudioSection.tsx) |
| Image profiles | Selects a configured profile and prompts for a personal BYOK key when required | [useImageGenerationProfile](../../src/features/imageProfiles/useImageGenerationProfile.ts), [image profile types](../../src/shared/types/imageProfile.types.ts) |
| Protected assets and uploads | Upload returns an owned asset URL; workspace membership and ownership govern discovery/access | [images router](/home/andres/PycharmProjects/magic-worlds-api/src/routes/images.py), [media asset routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/media_assets.py) |
| Media history | Creator image history lists completed jobs in the card's workspace and lets one become the cover; the main gallery can filter card-tagged portrait jobs | [MediaHistoryDrawer](../../src/features/creation/common/components/MediaHistoryDrawer.tsx), [useMediaGallery](../../src/features/gallery/media/hooks/useMediaGallery.ts) |
| Image jobs | Async submit, poll/result and owned-asset deletion; stopping the frontend wait does not cancel the server job | [frontend tests](../../src/features/creation/common/components/MediaStudioSection.test.tsx), [engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py) |
| Chat illustration delivery | Best-effort image enqueue after a finalized text turn with valid metadata `imagePrompt`; unavailable image engine silently skips the optional image | [shared chat route](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py), [scene prompt builder](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/scene_prompt.py) |

The character's `image_url` is one displayed cover, not a collection of identity, outfit or expression references. A job's `card_type`/`card_id` is a loose creation-time tag for portrait history. It does not establish a curated reference role or associate every upload and chat image with that character. Retaining job history already keeps old generated results; “keep asset” as a named, reusable character reference is still WIP.

## Registered GPT Image models

The local [backend catalog](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/catalog.py) registers these **text-to-image** choices:

| Provider | Flare | Sunburst |
|---|---|---|
| fal | `openai/gpt-image-2.5/flare/text-to-image` | `openai/gpt-image-2.5/sunburst/text-to-image` |
| OpenRouter | `openai/gpt-image-2.5-flare` | `openai/gpt-image-2.5-sunburst` |

Registration does not guarantee a selectable profile, credentials or account-specific availability. Existing GPT settings include quality, background and compression; fal also exposes output format. No GPT seed or negative-prompt control is registered. Other image families in the catalog are outside this research pack's model scope.

## WIP boundaries

1. **No editing endpoint or request inputs.** Current `TextToImageRequest` and `CardPortraitRequest` contain no source/reference-image or mask fields. `ImageOperation.IMAGE_EDIT` remains only for historical rows. The [current images router](/home/andres/PycharmProjects/magic-worlds-api/src/routes/images.py) has text-to-image, portrait, upload, jobs/result and asset deletion routes; it has no image-edit route. Older [backend image documentation](/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/image_generation.md) describing edits is stale.
2. **No profile escape hatch.** The catalog's `RESERVED_PROVIDER_FIELDS` blocks `image_url`, `image_urls`, `input_references`, `reference_image_urls` and `mask_url`. Its `build_arguments` is text-only. A provider accepting references does not make this app capable of editing.
3. **Cover side effects must change for variants.** Completion of a saved-card portrait job attempts to link its result to that card. A new outfit/expression job needs a distinct “save reference” outcome so it can finish without replacing the cover. The behavior for unsaved and snapshot cards also needs an explicit contract.
4. **Chat has no pixel reference selection.** `_metadata_with_chat_image_enqueue` supplies textual `imagePrompt`, scope, workspace and turn identifiers. It does not collect portrait pixels or a reference pack. The image engine adds house style to that text, rather than reading character images.
5. **Reference access remains TBD.** Application asset URLs require authorization. A provider cannot automatically read them with the browser's session. The backend must resolve authorized assets and transport them in a supported form, including ownership, workspace, sharing and frozen-session decisions.
6. **Manual profile choice differs from background chat.** The current chat enqueue resolves a platform-backed profile and skips a BYOK default because the turn has no provider key. It is not scoped specifically to GPT Image 2.5. A successful manual studio generation therefore does not prove reference-enabled chat is configured.

## UI review: useful base and concrete friction

These findings come from component behavior, not a rendered visual or accessibility audit.

| Current behavior | Consequence for a studio | Focused recommendation |
|---|---|---|
| Character media controls sit under the live card preview | Convenient context, but a small image for detail work | Retain quick actions and offer an expanded image area |
| Mobile `StudioPreviewDock` hides its footer when collapsed | Media controls can be hidden with the preview | Keep the studio entry discoverable and active editing visible |
| Generate/upload/history selection call the cover callback | Browsing variants can change the portrait | Separate input selection, keeping an asset and choosing the portrait |
| Saved-card portrait completion links the result automatically | A new outfit can replace the visible cover | Variants should finish as results; portrait selection is explicit |
| Image history lists completed workspace jobs | Useful discovery, but not this character's curated assets | Show character-associated images first, with broader history available |
| Existing profile picker shows model and credits/BYOK details | Configuration and cost context already exist | Reuse it for compatible GPT profiles; preserve clear empty/error states |
| `GeneratedImage` keeps stages/loading feedback until pixels load | Good continuity while chat illustration finishes | Preserve that behavior when adding references/details |

Evidence: [StudioPreviewDock](../../src/features/creation/common/components/StudioPreviewDock.tsx), [MediaStudioSection](../../src/features/creation/common/components/MediaStudioSection.tsx), [MediaHistoryDrawer](../../src/features/creation/common/components/MediaHistoryDrawer.tsx), [ImageProfilePicker](../../src/features/imageProfiles/ImageProfilePicker.tsx), [GeneratedImage](../../src/features/interaction/components/GeneratedImage.tsx). The [character handler](../../src/features/creation/character/components/CharacterCreator.tsx) persists media selections immediately for saved cards, separately from the narrative draft.

## Gate and verification status

The base character/media/image-profile pages have no dedicated studio gate. Adventure and group-chat gates default off in [`.env.example`](../../.env.example), rechecked on 2026-10-15. The earlier 2026-10-14 audit reported the local `.env` enabled them; local settings were not re-read for this research update and do not establish production rollout. The [router](../../src/app/router/AppRouter.tsx) uses `isPageFeatureEnabled` to prevent disabled pages from rendering. Setting a flag true cannot create the missing edit/reference contract.

Source tests cover upload/remove/view, profile/BYOK selection, in-progress image lifecycle, fake-provider submit/result and engine persistence. These are useful regression evidence; they do not validate character consistency, editing, masks or references. No test run or live generation was performed for this documentation audit. See [roadmap and gaps](08_roadmap_and_gaps.md) for completion criteria.
