# Character image studio: UI and UX

**Research updated:** 2026-10-15. **Status:** Proposed experience; editing and reusable references remain WIP. This is a source-based design review, without a rendered UI audit or user testing. See [current implementation](01_current_project.md).

The strongest fit is an image workspace opened from the character card: select an image, describe a change, inspect the result, and keep useful assets with that character. GPT Image 2.5 powers generation and editing. The character's name, appearance and existing images provide context throughout.

## Entry point and layout

Keep the existing portrait controls in the creator's preview area. Add a clear **Character images** entry for the expanded image workspace, retaining the card's context. Existing artwork should be as useful a starting point as a newly generated portrait.

The compact dock suits quick generation. Editing needs a larger image surface: changing an expression or checking markings against a small card preview is difficult. Use an expanded view attached to the creator, with a return action that preserves the character form. A new top-level navigation destination is unnecessary for this recommendation.

| Area | What the user sees | Purpose |
|---|---|---|
| Context header | Character name, workspace/destination, return action | Identifies whose images are being edited and where results belong |
| Main image | Selected source or result, zoom, optional original/result toggle | Gives the artwork priority and room for inspection |
| Direction area | One instruction field, task suggestions, input thumbnails, Generate/Edit action | Makes the operation understandable before submission |
| Character assets | Thumbnail strip/grid, short labels, portrait/reference indicators | Makes earlier useful images easy to find and reuse |
| Secondary controls | GPT profile, supported options, history and download | Keeps configuration accessible without dominating the task |

Show the entire image in the editing surface, with zoom for detail; a portrait crop can hide the feet, tail or equipment the user needs to inspect. Thumbnails can stay compact. Transparent assets benefit from a checkerboard preview distinct from their actual pixels.

This combines the contextual prompt bar documented by [Leonardo's Inline Editor](https://intercom.help/leonardo-ai/en/articles/11483692-using-omni-models-and-the-inline-editor) with the lightweight-to-expanded editing pattern in [Midjourney Editor](https://docs.midjourney.com/hc/en-us/articles/32764383466893-Editor). The layout above is a recommendation for this app, not a tested usability result.

## One interaction with useful task shortcuts

Use suggestions such as **Portrait**, **Full body**, **Outfit**, **Expression**, **Pose/view**, and **Background** around the same instruction field. Selecting one can insert an editable starting instruction or adjust the placeholder. It should not submit a paid generation automatically.

For example, Outfit could start: “Change the clothing to … Keep the same face, markings and body proportions.” The user finishes the request and presses **Edit image**. Expression can ask for an emotion without requiring a complete expression pack.

With no source, **Generate image** uses the card's visual information and direction. With a source, **Edit image** identifies the selected input. A full-body view or scene made from references may be a new composition rather than a small retouch; helper text should communicate that distinction.

NovelAI documents task-oriented tools for expressions, color and cleanup, with a result reusable as the next input. That is a useful discoverability pattern; its specialized controls do not imply equivalent GPT parameters. [Director Tools](https://docs.novelai.net/en/image/directortools/).

## Make selection, keeping and cover changes unambiguous

| Action | Suggested effect |
|---|---|
| Select thumbnail | Opens the image for inspection; leaves the card portrait unchanged |
| Edit this image | Sets the source for the next edit |
| Add reference | Adds a visible input to this request, with a removable thumbnail |
| Keep with character | Associates the image with this character for later reuse |
| Use as portrait | Explicitly changes the card's displayed portrait |
| Use for chat images | Identifies a useful reference; exact default-selection behavior remains an integration decision |
| Remove from character | Removes an association; does not delete the file everywhere |

Avoid one ambiguous **Use** button. A selected border identifies the inspected image; a **Portrait** badge identifies the cover; **Reference** identifies reuse intent. These meanings can coexist on one image. Labels must make them understandable without relying on color.

Retain results in existing media history, and make **Keep with character** the deliberate association. A variant should not replace the portrait on completion. This differs from today's portrait flow and requires the integration change in [01](01_current_project.md).

The distinction between organizing media and deleting its files is also explicit in [InvokeAI's gallery documentation](https://invoke.ai/features/gallery/). It matters here because assets may already be used by cards and snapshots.

## References should be visible and easy to change

Show the source beside additional references, using names such as “Source,” “Face,” or “Travel outfit.” These can be optional explanatory labels. Start with one good image; add another when it supplies missing information.

A picker can offer **This character**, **Media history**, and **Upload** within the existing media selection pattern. Character assets should be the first view. Workspace history helps find older work, but its contents are not automatically this character's references.

Keep selected inputs beside the instruction field. A filename alone is insufficient when several similar outfits exist. Preserve the selection after a request for easy iteration, while making removal explicit. Visible inputs and separate purposes are useful patterns in [Midjourney's web composer](https://docs.midjourney.com/hc/en-us/articles/33390732264589-Creating-on-Web).

## Results, comparison and recovery

Keep the source available when a result arrives. An **Original / Result** toggle or side-by-side view is enough; a draggable comparison slider is optional. Compare at useful zoom and consistent framing when possible. Different camera angles should still be inspectable as separate images.

Offer **Keep with character**, **Edit result**, **Use as portrait**, and download as appropriate. Let users return to an older source from assets/history. This supports branching exploration without requiring a version graph or approval stage.

If the user selected another image while a job ran, show the finished result without silently replacing that newer selection. Keep it associated with the character targeted when submission began. Repeating generation is a new explicit action, not a side effect of browsing results.

| State | Useful behavior |
|---|---|
| No images | Generate from the card or upload; no mandatory asset checklist |
| Source selected | Show the input and requested change before submission |
| Generating | Keep the source visible; show real stages and prevent duplicate submission |
| Local wait ends | Explain that processing may continue; retain the job/history connection |
| Result ready | Offer comparison and next actions without changing the cover |
| Generation fails | Preserve the source, direction and references for recovery |
| Association/portrait save fails | Keep the image available and say which save failed |
| Read-only card/workspace | Allow permitted inspection; explain unavailable modification actions |

Status, recognizable controls and recovery follow established [usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Avoid invented completion percentages or **Cancel generation** when an action only stops waiting locally.

## Mobile, keyboard and visual fit

On small screens, stack the selected image, instruction, action and thumbnails. Keep the active image and editing controls together. The existing mobile preview dock collapses its footer as well as the preview; an expanded studio should not hide the only editing entry behind that collapse.

Provide visible actions on touch and keyboard focus, not only hover. Thumbnail selection, reference actions and comparison need button alternatives to dragging. W3C documents alternatives for [dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Announce job completion/errors without moving focus away from the user's work; see [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

If region editing is useful later, reveal a small toolset after **Edit area**: select/clear, brush/restore and zoom, with the active region clearly visible. Plain instruction editing remains available. A mask guides GPT and should not be presented as a guaranteed pixel boundary; see [GPT behavior](03_gpt_generation_and_editing.md).

Use Reverie's existing typography, spacing, surfaces and focus treatment from [theme.css](../../src/ui/styles/theme.css). Reuse the app's arcane treatment for AI actions and existing selection semantics. The UI theme must not dictate the art style of every character image.

Use the app's existing translations for new labels and messages. Image actions and instruction-field shortcuts must not accidentally submit the surrounding character form or discard its unsaved text.

## Reuse in this codebase

| Existing surface | Relevant extension |
|---|---|
| [CreatorStudio](../../src/features/creation/common/components/CreatorStudio.tsx), [StudioPreviewDock](../../src/features/creation/common/components/StudioPreviewDock.tsx) | Preserve the card editing context and responsive shell; provide an expanded image area |
| [MediaStudioSection](../../src/features/creation/common/components/MediaStudioSection.tsx) | Retain generation, uploads, profile/key handling and job feedback; add explicit source/edit interaction |
| [MediaHistoryDrawer](../../src/features/creation/common/components/MediaHistoryDrawer.tsx) | Reuse browsing; distinguish selecting an input from today's direct cover-selection callback |
| [Media gallery](../../src/features/gallery/media/components/MediaGalleryPage.tsx) | Retain workspace discovery; expose character associations when available |
| [UI primitives](../../src/ui/primitives/index.ts) and [components](../../src/ui/components/index.ts) | Reuse Button/IconButton, Field, Chip, Badge, Modal/Drawer, authenticated images, lightbox and generation status |

These are interaction recommendations. The existing [gap notes](08_roadmap_and_gaps.md) retain unresolved persistence, session and provider decisions.
