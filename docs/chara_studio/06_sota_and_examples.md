# SOTA, comparable studios and interaction patterns

**Research refreshed:** 2026-10-15. **Scope:** Primary product documentation, author repositories and research abstracts. Products were not used hands-on and papers were not reproduced. “SOTA” surveys relevant current capabilities and research directions; it does not assert a measured ranking for this app.

The feature uses the project's GPT Image 2.5 models. Other products supply examples for interaction design, asset handling and quality expectations. Their model menus and training workflows are outside this feature's scope.

## Comparable products and projects

| Product/project | Documented interaction | Useful application here | Boundary |
|---|---|---|---|
| [Leonardo Inline Editor](https://intercom.help/leonardo-ai/en/articles/11483692-using-omni-models-and-the-inline-editor) | Opening an image reveals an instruction bar; references can come from uploads or previous generations | Put editing directly on the selected character image | Its model-dependent reference counts do not define this app's limits |
| [Midjourney Editor](https://docs.midjourney.com/hc/en-us/articles/32764383466893-Editor) | Light editor near the creation feed, expanded tools, undo/redo and region selection | Quick edits near the card; more image space when needed | Full layers/compositing exceed the initial scope |
| [Recraft reference sheet tutorial](https://www.recraft.ai/blog/character-reference-sheet) | A hero image becomes the starting point for turnaround, expression and pose references | Offer useful follow-up tasks from a good base design | A complete reference sheet remains optional; generated views need inspection |
| [NovelAI Precise Reference](https://docs.novelai.net/en/image/precisereference/) and [Director Tools](https://docs.novelai.net/en/image/directortools/) | Character/style reference choices and named expression, color and cleanup tasks | Explain input purpose; provide task suggestions | Its strength/fidelity and emotion controls cannot be assumed for GPT |
| [Scenario Canvas & Retouch](https://help.scenario.com/articles/2815682247-canvas-retouching-workflows) | Retouch starts from a library image; canvas combines prompts, references, masks and layers | Reuse an existing asset as the source; add region tools when useful | Its professional canvas/custom-model workflow is much broader |
| [InvokeAI Gallery](https://invoke.ai/features/gallery/) | Boards organize assets; destination is identifiable; board removal differs from media deletion | Clarify character association, job destination and deletion | This app already has cards and workspaces |
| [Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion) | AI fits inside an existing editor, with history, selections and references | Extend the creator's established context | Its local runtime and node/model tooling are implementation-specific |
| [SillyTavern images](https://docs.sillytavern.app/extensions/stable-diffusion/) and [expressions](https://docs.sillytavern.app/extensions/expression-images/) | Character/chat-based images, character galleries and expression collections | Treat assets as reusable roleplay material, accessible from chat | Displaying a sprite differs from generating a new scene |
| [fal assets and characters](https://fal.ai/docs/documentation/agent/assets-and-characters) | Character entity combines description and references; a picker reuses them in generation | An included card can be the understandable handle for its references | Study the interaction; retain this app's owned media library |

## Closest fit: image first, instruction beside it

Leonardo's documented viewer editor is the clearest precedent for the initial interaction: choose an image, optionally add references, describe a change, generate. Its guide recommends explicit preservation instructions and clear subject descriptions. The image remains the object being edited. [Inline Editor guide, dated 2026-08-25](https://intercom.help/leonardo-ai/en/articles/11483692-using-omni-models-and-the-inline-editor).

For this app, place **Edit image** beside the selected artwork, with task chips to reduce blank-prompt friction. Keep freeform direction available for unusual species, anatomy and styles. Suggestions should remain editable text rather than a rigid wizard.

Midjourney supplies a complementary pattern: lightweight editing near existing work, with an expanded surface for involved changes. Its current documentation discusses V8.x and legacy behavior; old Omni Reference tutorials do not describe its entire current interaction. [Editor](https://docs.midjourney.com/hc/en-us/articles/32764383466893-Editor).

The resulting recommendation is a compact entry in the card UI and an expanded image area for editing. It gives artwork room while retaining the character creation context.

## References should explain their purpose

Midjourney's web composer distinguishes input purposes, including editing and style guidance, and shows reference images alongside generation details. The transferable idea is visible inputs with understandable roles. [Creating on Web](https://docs.midjourney.com/hc/en-us/articles/33390732264589-Creating-on-Web).

NovelAI separates character/style references, but warns that multiple character references can blend rather than become separate subjects. Its guidance favors readable neutral full-body artwork with useful facial detail. This demonstrates why an interface should explain whether inputs show one subject or several; it does not establish GPT behavior. [Precise Reference](https://docs.novelai.net/en/image/precisereference/).

Here, start with a source and purposeful additional references. Use the character name and a short description: “Mara — face,” “Mara — formal outfit.” In a two-character scene, show each subject's inputs separately. Map that meaning into generation instructions; a decorative badge alone cannot communicate it to the model.

## Reference sheets help coverage, but are optional

Recraft's tutorial, published 2026-10-09, derives alternate views, expressions and poses from a hero image. It discusses asymmetric details and palette as useful parts of a sheet. These are useful asset ideas for a character studio. [Character reference sheet](https://www.recraft.ai/blog/character-reference-sheet).

A user should be able to keep a portrait and continue immediately. Full-body images help when clothing or proportions matter. A back view helps with rear costume details. Expression images can become reusable assets or editing sources.

Generated unseen details are design proposals: a model cannot recover the intended back of a coat from a front portrait alone. Inspect each view before using it as authority for later images. If useful individual views already exist, an overview sheet can assemble them without another generation.

## Precision tools should follow a clear edit intent

Scenario documents a retouch entry from an existing library image, followed by selection, masking and layers. Krita AI Diffusion emphasizes AI within an established editing environment, with previous generations/prompts available. These support keeping originals and making results revisitable. [Scenario Retouch](https://help.scenario.com/articles/2815682247-canvas-retouching-workflows), [Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion).

Their precision tools depend on their own implementations. For GPT, expose **Edit area** when the selected provider path supports it, and show the selected region clearly. OpenAI describes masks as guidance with imperfect boundary precision. [GPT image guide](https://developers.openai.com/api/docs/guides/image-generation).

A text instruction and original/result comparison cover the initial experience. Masks, layers and pose manipulators should earn their place through an observed need.

## Asset reuse should follow the character into chat

fal documents reusable character entities with descriptions and reference images, selected in a generation/chat context. It also distinguishes media lifetime from library organization. The transferable pattern is that character selection carries visual context without repeatedly attaching files. [Assets and characters](https://fal.ai/docs/documentation/agent/assets-and-characters).

SillyTavern distinguishes character, persona and scene generation modes, and exposes a character image gallery. Separately, expression images are assigned to emotions and displayed near chat. This helps distinguish reference assets, finished scene illustrations and reusable displayed expressions. [Image generation](https://docs.sillytavern.app/extensions/stable-diffusion/), [Character expressions](https://docs.sillytavern.app/extensions/expression-images/).

Included cards here should expose a compact image-reference summary in their existing chat/card context. Scenes should use the relevant depicted characters' authorized references. Automatic emotion classification and sprite presentation remain separate features.

InvokeAI identifies the generation destination at submission and distinguishes removing an organizational board from deleting its assets. [Gallery](https://invoke.ai/features/gallery/). Applied here, work started for Mara must remain Mara's result if another card is opened later. **Remove from character** should not ambiguously delete the file from every card or chat.

## Research: what consistency includes

These papers identify relevant failure modes. Their findings are not GPT Image 2.5 measurements, and the methods are not proposed dependencies.

| Research | Relevant idea | Implication for studio UX |
|---|---|---|
| [IP-Adapter, author project](https://github.com/tencent-ailab/IP-Adapter) | Visual references complement textual conditioning | Show supplied images; a name/description does not supply pixels |
| [StoryMaker, 2024](https://arxiv.org/abs/2409.12576) | Consistency covers clothing and body appearance beyond face identity | Compare silhouette, outfit and distinguishing details |
| [MS-Diffusion, 2024](https://arxiv.org/abs/2406.07209) | Multi-subject personalization considers subject separation/layout | Map each subject to its references and inspect attribute swaps |
| [InstantCharacter, 2025](https://arxiv.org/abs/2504.12395) | Open-domain character personalization across varied appearances | Inspect creatures, stylized characters and non-human anatomy |
| [AnimeAdapter, May 2026; revised June](https://arxiv.org/abs/2605.20237) | Separates appearance information from pose/layout conditioning | Identity references should permit a different pose |
| [Omni-StoryBench, September 2026](https://arxiv.org/abs/2609.37317) | Evaluates story continuity and condition following across media | Check that the illustration depicts the current event |

AnimeAdapter's abstract still describes code, weights and dataset as a future release upon acceptance; availability was not established here. Omni-StoryBench is a recent preprint and broader omnimodal evaluation, not an editor product or evidence for adding an orchestration system.

## What to carry into this app

The practical synthesis is contextual editing, visible references, simple task suggestions, recoverable results and character-associated assets. [02](02_ai_image_section.md) translates these into UI suggestions; [04](04_assets_in_chat.md) covers chat reuse.

When trying the feature later, useful questions are simple: did the face and distinguishing anatomy survive, did the requested outfit/expression change, and did the scene depict the right character and event? Documentation and abstracts cannot answer these for this project's actual characters.
