# Sources and evidence

**Research refresh:** 2026-10-15. **Original pack:** 2026-10-13, with a source/status review on 2026-10-14. The current update focuses on studio UI/UX, this app's integration and GPT Image 2.5.

Sources below are primary documentation, author repositories or papers. Linked product/provider pages were opened again for this update. Research papers were reviewed at abstract level; implementations and reported results were not reproduced.

## GPT Image 2.5 and existing providers

| Source | Evidence used |
|---|---|
| [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation) | GPT Image 2.5 generation/editing, model positioning, mask guidance and consistency limitations |
| [fal Flare edit API](https://fal.ai/models/openai/gpt-image-2.5/flare/edit/api) | Image/mask fields, reference maximum and output settings |
| [fal Sunburst edit API](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api) | Corresponding edit operation, background and format settings |
| [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) | Dedicated Image API, reference inputs, endpoint-dependent capabilities and output options |

OpenAI's guide was searched and fetched through the official documentation tool. Provider support does not establish that app editing is connected or that a particular account/profile can use it. The local catalog and request models remain the source for implemented controls.

## Studio and character-product references

| Source | Why it matters here |
|---|---|
| [Leonardo Inline Editor](https://intercom.help/leonardo-ai/en/articles/11483692-using-omni-models-and-the-inline-editor) | Selected-image instruction bar, adding references and clear edit directions; article dated 2026-08-25 |
| [Midjourney Editor](https://docs.midjourney.com/hc/en-us/articles/32764383466893-Editor) | Contextual light editor, expanded tools, reversible region editing and result history |
| [Midjourney Creating on Web](https://docs.midjourney.com/hc/en-us/articles/33390732264589-Creating-on-Web) | Visible image inputs, distinct reference purposes and reusable prompt context |
| [Recraft character reference sheet](https://www.recraft.ai/blog/character-reference-sheet) | Hero image, turnarounds, expressions, poses and asymmetric details; published 2026-10-09 |
| [NovelAI Precise Reference](https://docs.novelai.net/en/image/precisereference/) | Reference preparation, character/style distinctions and multi-character blending caveat |
| [NovelAI Director Tools](https://docs.novelai.net/en/image/directortools/) | Task-oriented expression/color/cleanup entry points and reusing a result as input |
| [Scenario Canvas & Retouch](https://help.scenario.com/articles/2815682247-canvas-retouching-workflows) | Starting retouch from a library asset, masks and layered editing; page dated 2026-04-13 |
| [InvokeAI Gallery](https://invoke.ai/features/gallery/) | Media organization, submission destination and distinct association/file deletion semantics |
| [Krita AI Diffusion author repository](https://github.com/Acly/krita-ai-diffusion) | AI inside an existing editor, history, selections and reference guidance |
| [SillyTavern image generation](https://docs.sillytavern.app/extensions/stable-diffusion/) | Roleplay character/persona/scene requests and contextual image galleries |
| [SillyTavern character expressions](https://docs.sillytavern.app/extensions/expression-images/) | Character-associated emotion assets and distinction from scene generation |
| [fal assets and characters](https://fal.ai/docs/documentation/agent/assets-and-characters) | Reusable character entities with reference images selected in chat/generation |

These establish documented patterns. They do not establish adoption rates, measured usability superiority, GPT-specific quality, or a reason to add another provider/library. Product claims of precise preservation must not be transferred into GPT guarantees.

## UX foundations

| Source | Application |
|---|---|
| [Nielsen Norman Group: usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Visible status, recognizable controls, user control and error recovery |
| [W3C: dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Button/pointer alternatives for drag interactions |
| [W3C: status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Announcing asynchronous progress/completion without stealing focus |

These are design references, not an accessibility certification for the current app.

## Research background

| Source | Relevant topic and evidence limit |
|---|---|
| [IP-Adapter author repository](https://github.com/tencent-ailab/IP-Adapter) | Visual plus textual conditioning; reference project, not proposed runtime |
| [StoryMaker](https://arxiv.org/abs/2409.12576) | Holistic character consistency, beyond the face |
| [MS-Diffusion](https://arxiv.org/abs/2406.07209) | Multi-subject references and layout/subject separation |
| [InstantCharacter](https://arxiv.org/abs/2504.12395) | Open-domain appearance, pose and style personalization |
| [AnimeAdapter](https://arxiv.org/abs/2605.20237) | Appearance/pose separation; May 2026 preprint, revised June; abstract promises a future release |
| [Omni-StoryBench](https://arxiv.org/abs/2609.37317) | Story continuity and condition following; September 2026 preprint, broader than an image editor |

These are not GPT Image 2.5 benchmark results. Novelty and an author's reported consistency are different from demonstrated suitability for this application's characters.

## Current project evidence

| Area | Source |
|---|---|
| Card cover field and creator callbacks | [character.types.ts](../../src/shared/types/character.types.ts), [CharacterCreator.tsx](../../src/features/creation/character/components/CharacterCreator.tsx) |
| Creator layout and mobile collapse | [CreatorStudio.tsx](../../src/features/creation/common/components/CreatorStudio.tsx), [StudioPreviewDock.tsx](../../src/features/creation/common/components/StudioPreviewDock.tsx) |
| Generation/upload/cover/history controls | [MediaStudioSection.tsx](../../src/features/creation/common/components/MediaStudioSection.tsx), [MediaHistoryDrawer.tsx](../../src/features/creation/common/components/MediaHistoryDrawer.tsx) |
| Model, credit and key presentation | [ImageProfilePicker.tsx](../../src/features/imageProfiles/ImageProfilePicker.tsx), [useImageGenerationProfile.ts](../../src/features/imageProfiles/useImageGenerationProfile.ts) |
| Workspace discovery versus card-tagged jobs | [useMediaGallery.ts](../../src/features/gallery/media/hooks/useMediaGallery.ts) |
| Included chat cards and image result UI | [CharacterChatCodexPanel.tsx](../../src/features/characterChat/components/CharacterChatCodexPanel.tsx), [GeneratedImage.tsx](../../src/features/interaction/components/GeneratedImage.tsx) |
| Existing UI vocabulary | [UI primitives](../../src/ui/primitives/index.ts), [UI components](../../src/ui/components/index.ts), [theme.css](../../src/ui/styles/theme.css) |
| Image request boundary | [frontend media types](../../src/shared/types/media.types.ts), [backend models](../../../../PycharmProjects/magic-worlds-api/src/models/image_generation.py) |
| Registered models/settings and reserved fields | [catalog.py](../../../../PycharmProjects/magic-worlds-api/src/services/image_generation/catalog.py) |
| Job execution and portrait linking | [engine.py](../../../../PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py), [images router](../../../../PycharmProjects/magic-worlds-api/src/routes/images.py) |
| Existing OpenRouter transport | [openrouter_adapter.py](../../../../PycharmProjects/magic-worlds-api/src/services/image_generation/openrouter_adapter.py) |
| Scene generation and text-only enqueue | [route_chat.py](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py), [scene_prompt.py](../../../../PycharmProjects/magic-worlds-api/src/services/image_generation/scene_prompt.py), [engine.py](../../../../PycharmProjects/magic-worlds-api/src/services/image_generation/engine.py) |
| Feature availability | [featureFlags.ts](../../src/shared/featureFlags.ts), [AppRouter.tsx](../../src/app/router/AppRouter.tsx), [.env.example](../../.env.example) |

Both repositories contain unrelated working-tree changes. This is a targeted source review, not a deployment audit. Existing test files were read as contract evidence; tests and paid provider calls were not run for this Markdown-only update.

Older [backend image documentation](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/image_generation.md) describes an edit route absent from current source. The pack records this discrepancy rather than treating the old guide as an implemented contract.

## How to interpret the recommendations

The studio layout, labels, reference defaults and chat affordances are design synthesis for this app. They are explicitly proposals. Source-backed facts are recorded in [01](01_current_project.md); provider possibilities in [03](03_gpt_generation_and_editing.md); unresolved implementation questions remain in [08](08_roadmap_and_gaps.md).

No app code, visual mockup, model training, image generation, live product usability test or provider-quality evaluation was produced.
