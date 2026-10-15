# GPT Image 2.5: capabilities and honest controls

**Documentation rechecked:** 2026-10-15. **Status:** Provider research; application editing/reference inputs remain WIP. Only the project's registered GPT Image 2.5 Flare and Sunburst families are in scope. See [current contracts](01_current_project.md).

## Fit for the character studio

| Capability | Character use | UX implication |
|---|---|---|
| Text-to-image | First portrait or full-body design | Start from card appearance plus direction |
| Image and instruction | Outfit, expression, hairstyle or background edit | Keep the selected source visible |
| Multiple images | Identity plus clothing or additional views | Show each input and explain its purpose |
| Region guidance | Focus a change on a prop or detail | Optional edit-area tool; inspect the entire result |
| Reference-based composition | Character in a different scene or pose | Distinguish new composition from small retouch |
| Transparent output | Cutouts for reuse | Preview actual alpha on a checkerboard |

OpenAI documents generation/editing for both models, positioning Flare for everyday generation and Sunburst for editing precision. This is provider guidance, not a measured character-quality ranking. Masks guide edits and may not preserve exact boundaries; recurring identity and precise composition can still fail. [Official image guide](https://developers.openai.com/api/docs/guides/image-generation).

Use the configured GPT profiles already available to the project. The studio's choices should be compatible GPT profiles; a global image menu containing other model families should not accidentally expand this feature's model scope. Availability still depends on published profiles, credentials and provider access.

## fal: documented editing path

| Existing GPT family | Documented edit endpoint |
|---|---|
| Flare | `openai/gpt-image-2.5/flare/edit` |
| Sunburst | `openai/gpt-image-2.5/sunburst/edit` |

Both schemas accept `image_urls`, optional `mask_url`, and up to 16 input images. They document quality, size, background and image formats. The maximum is provider capacity, not a useful default reference count for a character editor. [Flare edit schema](https://fal.ai/models/openai/gpt-image-2.5/flare/edit/api), [Sunburst edit schema](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api).

The current backend catalog registers their **text-to-image** endpoints. Selecting a generation profile does not currently enable the corresponding edit endpoint. References/masks also cannot be smuggled through custom profile overrides: the catalog reserves those inputs. First-class authorized edit handling is the missing integration.

## OpenRouter: existing Image API

The app already uses OpenRouter's dedicated Image API through its adapter. The provider documents `input_references` with HTTP(S) or base64 image inputs; limits and accepted parameters vary by serving endpoint. Check the chosen GPT endpoint's capabilities instead of inheriting every generic Image API option. [OpenRouter image documentation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

Continue through the existing backend/provider integration. An OpenAI example using Responses does not require this app to adopt Responses, a new service, or conversational provider state. Iterative editing can supply the selected prior result and current instruction through the existing provider path once editing is connected.

## Controls that fit this app

The source of truth for currently registered settings is the [local catalog](/home/andres/PycharmProjects/magic-worlds-api/src/services/image_generation/catalog.py). A research suggestion for a control does not mean the current UI accepts a per-request override.

| Control | Current evidence | Suggested presentation |
|---|---|---|
| GPT model/profile | Flare and Sunburst exist on fal/OpenRouter; profiles govern availability | Existing profile picker, scoped to compatible GPT choices |
| Quality | Both catalog entries accept auto, low, medium, high, xhigh and max; app default is low | Keep the working default; expose supported quality through existing profile settings |
| Framing | App requests support aspect ratios; providers map sizes differently | Simple portrait/square/landscape choices when exposed by the selected operation |
| Background | Auto/opaque/transparent are registered | Plain language option; ensure compatible output format |
| Format | fal profiles expose JPEG/PNG/WebP; OpenRouter profile catalog currently does not expose format | Show only options actually available through that route |
| Extra direction | Current card portrait request folds it into a server-written prompt | Keep a user-facing creative instruction; keep writer configuration secondary |
| Source/references/mask | Provider support exists, app request support is missing | WIP until connected and authorized |
| Seed/negative prompt/reference strength | No such GPT controls are registered here | Express desired preservation/change in the instruction |

The official API's defaults and a fal schema's defaults are different from this application's chosen profile defaults. Keep the UI grounded in the resolved app profile.

The current portrait/scene prompt path adds generation direction and house style. Reference edits should retain the source's visual style unless the user requests a change. An instruction to alter a coat should keep its narrow meaning when the existing prompt-writing path is reused; expanding it into a fresh portrait description can work against the edit intent.

Do not label a higher-quality choice “same character guaranteed.” Detail, cost and latency tradeoffs differ from identity correctness. Where a trustworthy estimate is available, show it before submission; otherwise avoid fixed per-image promises. Selecting another model/profile should be explicit rather than a hidden reaction to an edit failure.

Reuse the [profile picker's](../../src/features/imageProfiles/ImageProfilePicker.tsx) existing credit/BYOK presentation. An app credit quote and the provider's raw image cost are different quantities; any new edit operation needs accurate copy for whichever charge actually applies.

## References, masks and cutouts

For refinement, send the current source image and a precise instruction. For another scene, send the character references and a new scene description. Keep source/reference ordering stable and map the images to their intended roles. If masking is implemented, the mask must target the intended source rather than whichever thumbnail was clicked most recently.

A protected app URL is not automatically readable by an external provider. The backend needs to resolve authorized assets and transfer them in a supported form. This fits existing media ownership and provider dispatch; it does not require a second media service.

For transparent output, use an alpha-capable format such as PNG or WebP. JPEG cannot preserve alpha. Inspect edges around fur, hair, wings and accessories; a checkerboard drawn into opaque pixels is not transparency. The provider documentation describes alpha-compatible background/format behavior. [fal Sunburst schema](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit/api), [OpenRouter output options](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

No live generation, edit, mask, provider-quality comparison or cost measurement was performed. See [prompt practices](05_best_practices_and_prompts.md) for original, untested examples.
