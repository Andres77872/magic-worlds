# Character image studio research

**Source and lifecycle review:** 2026-10-15. **Focus:** UI/UX, integration with this app, character image practices and dated product/research references. **Implementation status:** Existing portrait generation is present; editing, reusable character references and their use in chat remain planned. Individual owners, delivery dates and release acceptance are unassigned.

The [CHARA-1–9 backlog](08_roadmap_and_gaps.md) is this area's status authority. The [project inventory](01_current_project.md) describes existing source; documents 02–05 describe proposed interaction/provider behavior, and 07 records their evidence dates. This cleanup rechecked the local request/router/catalog boundary; it did not refresh external provider research or run image generation. The [shared matrix](../STATUS_MATRIX.md) distinguishes implementation from release availability.

The proposed starting experience is to open **Character images** from a character card, select or generate artwork, describe an edit, compare the result, and keep useful images with the character. In that target workflow, choosing the card portrait is explicit and relevant character assets can provide references for chat illustrations. These editing/reference interactions are not current application behavior.

**GPT Image 2.5 Flare and Sunburst, through the project's existing fal/OpenRouter integrations, are the only models considered for this feature.** Other studios and research projects supply interaction examples and best practices.

## Main findings

- **Edit in context.** A selected image, one instruction field, task suggestions and visible inputs are the core studio interaction. Give editing more space than the compact portrait preview.
- **Keep asset purposes clear.** Inspecting an image, editing it, keeping it with a character, choosing a portrait and using it as a reference have different effects.
- **Reuse the existing app.** Extend the creator/media controls, history, GPT profile picker, owned assets and asynchronous image delivery.
- **Show references in chat context.** Included cards can expose their available images; generation should use the relevant depicted subjects and outfits.
- **Let the user start with one image.** Full-body views, expressions, sheets and masks are useful additions when needed.

The product references in [07](07_sources.md) cover Leonardo, Midjourney, Recraft, NovelAI, Scenario, InvokeAI, Krita AI Diffusion, SillyTavern and fal's character assets. Recommendations are based on primary documentation and source review, not hands-on product testing or a model leaderboard.

## Reading guide

| Document | Contents |
|---|---|
| [02 — Studio UI/UX](02_ai_image_section.md) | Entry point, layout, task suggestions, asset actions, comparison, states, mobile/accessibility and component reuse |
| [01 — Current project review](01_current_project.md) | Source-backed behavior, UI friction, registered GPT models and missing connections |
| [03 — GPT generation and editing](03_gpt_generation_and_editing.md) | Current provider support, supported settings and honest controls |
| [04 — Assets in chat](04_assets_in_chat.md) | Included-card reference UX, subject/outfit selection, delivery and session behavior |
| [05 — Practices and prompts](05_best_practices_and_prompts.md) | Preparing references, describing edits, inspecting identity and original prompt examples |
| [07 — Sources](07_sources.md) | Primary references, refresh dates and local evidence |
| [08 — Existing roadmap and gaps](08_roadmap_and_gaps.md) | Retained proposed backlog and unresolved integration decisions |

## Current implementation boundary

| Capability | Source-backed status |
|---|---|
| Portrait generation, uploads, profile/BYOK selection, history and cover changes | Implemented; live operation depends on configuration and was not tested here |
| Workspace media discovery and card-tagged portrait jobs | Implemented; neither is a curated character reference collection |
| Image editing and outfit/expression/pose changes from source pixels | WIP: current requests/providers are wired for text-to-image |
| Multiple reusable assets associated with a character | WIP: the character currently has one cover field |
| Character pixels supplied to chat illustrations | WIP: current scene enqueue supplies a textual brief |

The missing integration is supplying authorized source/reference pixels and retaining their character association. Text descriptions or asset URLs pasted into a prompt do not create image inputs. Current portrait completion also links the result as the cover, which must be distinguished from keeping a variant.

Documents 02–05 are research and design guidance. The retained backlog in 08 is proposed work, without committed dates. No application code, provider calls, image generation or paid evaluation was performed. Deployment gates and static test evidence are recorded in [01](01_current_project.md).
