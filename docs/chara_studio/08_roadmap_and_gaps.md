# Character image studio roadmap — WIP

**Status:** Proposed implementation backlog. **Reviewed:** 2026-10-14. **Scope:** Character image editing, durable reference assets and their use in existing chat illustrations. **Owner / delivery dates:** TBD. **Release evidence:** Source inventory only; no live editing or provider-quality acceptance. See [current implementation](01_current_project.md) and the [project roadmap](../ROADMAP.md).

## Sequence and acceptance

**Research update — 2026-10-15:** The deeper [studio UX review](02_ai_image_section.md), [product/project comparison](06_sota_and_examples.md) and [chat reference UX](04_assets_in_chat.md) now supply design input for the existing gaps below. This update does not implement these items or add delivery commitments. Begin with the selected image, one instruction and retained results; sheets and region tools are optional extensions.

The existing generation/upload/media-history flow is the base. Each row below remains **WIP** until its acceptance evidence is recorded. Priority is a suggested dependency order, not a delivery commitment.

| ID | Priority | Work | Actual gap | Completion evidence |
|---|---|---|---|---|
| CHARA-1 | P1 | Define reference-asset associations | Character has one `image_url`; portrait job tags provide filtering but no reference purpose | Stored association contract for selected assets; optional identity/outfit/expression labels; separate cover selection; migration and API/frontend round-trip tests |
| CHARA-2 | P1 | Add authorized image-edit inputs | Request models lack reference/mask fields and reject extras; profile overrides block them | A first-class edit DTO/route resolves owned/access-authorized asset IDs, validates types/count/bytes and rejects unauthorized references without calling a provider |
| CHARA-3 | P1 | Dispatch edits through registered GPT providers | Catalog and engine build text-only requests; fal registers only text-to-image IDs | Operation-aware capability contract and adapter tests map fal edits to `image_urls`/optional `mask_url`, and OpenRouter references to its supported image API fields; unsupported profiles fail before submission |
| CHARA-4 | P1 | Keep variants without replacing the cover | Saved portrait completion links output to the card | Edit/variation jobs persist owned results without changing `image_url`; explicit “Use as portrait” is separate; deleted-card and unsaved/snapshot behaviors tested |
| CHARA-5 | P2 | Extend existing media controls | Current UI generates, uploads and picks a cover; it has no source-image selection or edit controls | User can select a source, submit one direction, inspect before/after, retain a result and choose the cover; async errors and read-only workspaces handled; reuse project UI primitives/tokens |
| CHARA-6 | P2 | Use relevant included-card references in scenes | Shared chat enqueue sends only textual `imagePrompt` | References come only from the current session's authorized cards; subject/reference mapping is explicit; no-reference text generation still works; multi-character and privacy tests cover the dispatch |
| CHARA-7 | P2 | Make sessions and sharing predictable | Current snapshots pin card versions; media protection and imports have existing rules, but reference packs have no rule | Document and test whether references freeze with the card version, follow later edits or require refresh; shared/imported cards carry only permitted references; deletion/reference retention behavior tested |
| CHARA-8 | P2 | Record acceptance and rollout state | No live character/edit evaluation was performed | Record provider/model/profile, inputs, observed results, cost/latency, failure behavior and limitations for portrait, outfit, expression, pose, single-character scene and two-character scene; document enabled deployment and any gate |
| CHARA-9 | P3 | Add mask editing if justified | Provider research describes masks; app has no mask workflow | Decide whether masks belong in first release; if included, validate image/mask compatibility, protected transfer and UI selection; if deferred, keep mask tasks visibly WIP |

## Decisions still TBD

| Decision | Why it must be explicit | Suggested starting point |
|---|---|---|
| Reference storage shape | A job tag is not a durable reusable-asset contract | Associate owned asset IDs with a character; keep `image_url` as the cover |
| Reference limits and roles | Provider maxima do not define a usable UI or subject separation | Begin with one selected source; add one identity and one outfit/full-body reference when useful; enforce limits per provider capability |
| Source transport | Protected app URLs are not provider-readable without authorization | Backend resolves assets and transfers bytes or a scoped provider-supported URL; never accept arbitrary URLs as an ownership shortcut |
| Profile compatibility | Existing profiles are configured for text-to-image | Publish edit capability separately and make unsupported-profile behavior clear before paid work |
| Unsaved card behavior | Portraits can be generated before a saved card exists | Allow a temporary source/result, then attach references when the card is saved; exact lifecycle TBD |
| Snapshot/version behavior | Current session snapshots are intentionally isolated from library edits | Decide which asset associations freeze with snapshots and expose refresh explicitly if allowed |
| Shared references | A public cover does not grant access to every owner's private source asset | Share/import only explicitly permitted associations and copy or authorize their assets under existing ownership rules |
| Rollout control | No dedicated studio flag currently exists | Decide if this extension needs a new gate; any disabled deployment is WIP, and flag-on requires actual edit contract acceptance |
| Default scene selection | Included cards may have several contradictory outfits | Prefer the explicit request selection; automatic selection needs deterministic rules and visible input attribution |
| History versus reusable assets | Old generated images are retained already | Use “keep with character” for an association, not a duplicate blob or an implicit cover replacement |

## Concrete regression coverage

Existing tests to preserve:

- [MediaStudioSection tests](../../src/features/creation/common/components/MediaStudioSection.test.tsx): upload validation, cover actions, progress, continuing server job after wait cancellation and profile/BYOK recovery.
- [Fake image flow](/home/andres/PycharmProjects/magic-worlds-api/tests/routes/test_image_generation_fake_flow.py) and [engine tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_image_generation_engine.py): job lifecycle, result mirroring/persistence and owned assets.
- [Image privacy tests](/home/andres/PycharmProjects/magic-worlds-api/tests/services/test_image_generation_privacy.py): retain sanitized public errors and credential handling when adding new provider inputs.
- [Card context tests](/home/andres/PycharmProjects/magic-worlds-api/tests/test_card_context.py): retain session-card isolation; source images must not become private text prompt/tool content.

New tests should verify actual reference transport, operation dispatch, ownership/workspace checks, cover independence and session/share behavior. Provider schema mocks establish the wire contract; live examples establish observed quality. Neither is a substitute for the other.

## Documentation repairs outside this pack

The sibling [backend image API guide](/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/image_generation.md) still describes a removed edit route. Correct that guide against [the current router](/home/andres/PycharmProjects/magic-worlds-api/src/routes/images.py) before publishing a new edit contract. This frontend documentation review records the gap; it does not modify the sibling guide or restore the route.

Documents 02–06 remain useful design and research input. Recheck provider account availability, input limits and settings when implementation begins. A model's documented editing support is not app implementation evidence or a quality guarantee.
