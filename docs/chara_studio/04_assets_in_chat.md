# Character assets in chat illustrations

**Research updated:** 2026-10-15. **Status:** Proposed integration and UX, WIP. Current scene generation receives text without character image inputs. Examples describe desired behavior; see [source inventory](01_current_project.md).

When an included character appears in an illustration, use that card's relevant images as visual references. The card supplies character context, the images supply appearance, and the scene describes the current action. Being included does not mean the character belongs in every illustration.

This can cover the main character, user persona and enabled character cards relevant to a scene. Keep the existing chat/adventure image flow, with GPT Image 2.5 for this reference-based feature.

## Make image readiness understandable in the existing card context

The chat already has included-card controls and card previews. Show a compact reference summary there, such as **2 character images**, **Travel outfit**, or **Description only**, with thumbnails available on inspection. A user should be able to understand the inputs without configuring an image pipeline.

[fal's character picker](https://fal.ai/docs/documentation/agent/assets-and-characters) is a useful interaction precedent: selecting a character can bring reusable references into generation. Here the already included card is the selection, so users should not need to upload the same artwork again.

| Situation | Suggested behavior |
|---|---|
| Card has useful references | Use relevant images when that character is depicted; show what was used in image details |
| Card has one portrait | Use it; a complete asset pack is unnecessary |
| Card has no images | Keep description-based generation available |
| Several outfits exist | Prefer an explicit outfit selection/request; make the choice inspectable |
| Included card is disabled | Exclude its visual references just as its context is excluded |
| Several characters are included | Use the depicted subjects, rather than automatically placing the whole cast in frame |
| A reference cannot be accessed | Explain the unavailable input or description-only fallback; do not silently substitute another character |
| User wants to refine a reference | Open the associated card/image workspace when modification is permitted |

Keep this information near the included card and image result. It need not interrupt every text turn or add a mandatory pre-generation dialog. Manual image controls, if added, should reuse those same references and make overrides local to the requested image.

## Choose references for the requested image

| Requested illustration | Useful assets |
|---|---|
| Close-up | Portrait/face detail |
| Full-body action | Full-body image, plus face detail when useful |
| Specific outfit | Corresponding outfit and identity reference |
| Different angle | Relevant alternate view where available |
| Two characters | Inputs grouped and named by subject |
| Empty environment | Scene context; no character images needed |

Limit inputs by relevance. Searching the user's entire character library or sending every stored image increases ambiguity. A character's stable identity, current outfit and scene lighting have different purposes; a rainy scene should not redefine the character's permanent palette.

For a banquet, selecting a formal-outfit image for that request can be enough. This does not require a new appearance-state engine. Reference labels should become meaningful subject/input instructions, rather than just badges in the UI.

## Examples

For a fox-person card with a face reference and full-body travel outfit:

> Character Mara is shown in images 1 and 2. Depict Mara sitting at a tavern table, unfolding a map. Retain the face, upright ears, fur markings, tail and green travel coat. Medium-wide composition with warm interior light.

For a formal outfit:

> Use image 1 for Mara's identity and image 2 for the navy formal outfit. Show Mara greeting a guest in a candlelit hall. Retain the facial features and markings. Use the formal outfit rather than the travel coat.

For two included characters:

> Mara from image 1 stands on the left in the green coat. Iven from image 2 stands on the right in silver armor. They exchange a letter beside a stone gate. Keep their appearances, outfits and props separate.

These are original, untested instructions. They make the mapping explicit; they do not guarantee subject separation. [Multi-subject research](06_sota_and_examples.md#research-what-consistency-includes) explains why attribute swaps deserve inspection.

## Fit with the current app

| Existing integration | Relevant addition |
|---|---|
| [CharacterChatCodexPanel](../../src/features/characterChat/components/CharacterChatCodexPanel.tsx) | Add reference availability/details to the enabled card context |
| [Card preview](../../src/features/cards/components/CardPreviewBody.tsx) | Inspect permitted assets and reach character image editing from the card |
| [Shared chat route](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py) | Resolve relevant included-card references when an illustration is requested |
| [Image engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py) | Supply authorized pixels and subject mapping through the existing GPT provider path |
| [GeneratedImage](../../src/features/interaction/components/GeneratedImage.tsx) | Retain stage/loading/error feedback and lightbox; optionally expose reference details |

Today the chat image enqueue uses a default **platform-backed** profile and skips a BYOK default because the background turn carries no personal provider key. It does not filter specifically for this studio's GPT scope or select character references. A reference-enabled illustration must resolve a compatible GPT Image 2.5 profile and explain unavailable configuration; success in manual BYOK studio generation does not establish background chat support.

The current model-produced image brief is text. It does not already provide an implemented character-to-reference mapping. Adding reference inputs requires that connection as well as provider transport; simply including asset URLs in the brief is insufficient.

## Results should remain useful and predictable

Let the text conversation continue while an illustration runs. Preserve the existing space-reserving image lifecycle, including the final protected-image download. Keep a generation error local to the illustration so it does not erase a completed text reply.

A scene image remains a chat result unless the user deliberately keeps it with a character. Temporary grime, dramatic lighting and unusual clothing can be useful scene details but poor general references. SillyTavern's separate [expression assets](https://docs.sillytavern.app/extensions/expression-images/) and [scene generation](https://docs.sillytavern.app/extensions/stable-diffusion/) are useful precedents for distinguishing asset purpose.

Respect the app's existing session-card snapshot behavior. Whether reference associations freeze with snapshots or refresh later remains unresolved; do not silently replace an ongoing session's design with the newest library edit. Reuse existing snapshot/ownership rules when deciding this behavior, as recorded in [gap notes](08_roadmap_and_gaps.md).

Only expose references the current user/session can access. Seeing a shared card's portrait must not reveal its owner's unrelated private source artwork. Sharing/importing a reusable asset association needs explicit access behavior. This is an integration boundary, not an additional user approval stage for each illustration.
