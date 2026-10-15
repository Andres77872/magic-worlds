# Uses and workflows

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Selected R1 workflows implemented in source; WIP rollout. Current evidence and gaps are in 02/04.\
**Refreshed:** 2026-10-12.

## Organize a novel's cards

1. Create or switch to Novel A.
2. Create Main cast, Locations, and Items collections.
3. Open Library, where collections appear as folders alongside cards of all types; select existing cards in bulk and add them to the appropriate collections.
4. Open the current novel workflow and filter the existing card picker by Main cast.
5. Select the intended cards using the existing Codex action.

Library keeps its search and current large/compact/list views. Open Main cast through its folder entry, with the location shown as Library > Main cast. Returning to Library restores the previous browsing context. Type filters are optional and do not split the collection into separate feature pages.

The collection remains library organization. Adding a card to Main cast later does not automatically change the novel's Codex, manuscript, or AI context. This avoids hidden context expansion.

## Find the same character for roleplay

Within Novel A, open the roleplay character picker and choose Main cast. Use the existing character and persona selection behavior. The user does not need a second copy merely because the activity changes from writing to roleplay.

If roleplay should have an independent interpretation, copy the character to a Roleplay workspace first. The UI should explain that future edits affect the copy.

## Experiment without changing mature content

1. Select cards in Novel A.
2. Choose Copy to workspace.
3. Select Sandbox and optionally a destination collection.
4. Review the cards and attached dependency summary.
5. Complete the copy and open Sandbox when convenient.
6. Edit or generate variations there.

Novel A keeps its originals and existing activity snapshots. Repeating a copy is an explicit new-copy choice, not automatic synchronization.

## Maintain a reusable library

A user may create a personal Reference library workspace containing reusable characters, worlds, and items. Copy selected cards to a new project workspace. This uses ordinary workspace semantics and does not require a second global card ownership model.

An account-wide search may be added later as an explicit search mode that labels source workspaces. It must not silently merge all cards into current-workspace pickers.

## Write short stories

A Short stories workspace may contain several flat collections such as Story 1 cast and Story 2 cast. One character can belong to both without duplication. Stories remain separate existing story records; a collection is not a story object.

When the user needs separate character development for each story, use independent workspace copies or explicit card duplication.

## Create in context

Library is the single sidebar entry for cards. Its New menu opens each existing type creator (including persona), collection creation, or the existing import flow. Collections are folder entries in the same browser as cards, not navigation chips.

The menu offers Character, Persona, World, Item, Adventure, Import card, and New collection for enabled features. New collection is a root action for R1's flat grouping. Choosing a card type goes straight to the existing creator; templates, empty-card entry, direct generation and assistant remain there, without an extra manual-versus-AI wizard.

Creating a card from an open collection preselects the current workspace and that collection. The destination appears before submission. Creating from the library root preselects only the workspace. Existing templates, empty card, direct AI generation and the card assistant remain available in their existing creator. An assistant/direct-generation result already saved by the server opens that same identity in the editor; Save does not make a second copy.

Manual creation, AI creation, public imports, share-link imports, and file imports must follow the same destination model. A switch while generation runs does not change it.

## Organize without changing content

| Action | Expected effect |
|---|---|
| Add to collection | Add membership for the existing card |
| Remove from collection | Remove only that membership |
| Delete collection | Remove grouping; retain cards |
| Duplicate within workspace | Create an independent local card |
| Copy to workspace | Create independent destination cards |
| Export card | Download the supported portable card format |
| Archive workspace | Hide it from ordinary switching; preserve content |
| Restore workspace | Make its preserved content available again |

Move is deliberately deferred because dependencies and references need a broader policy than a simple workspace-column update.

## Use during background work

A theme song, image, card generation, or assistant turn started in Novel A remains associated with Novel A. Switching to Sandbox may hide its content panel, but a completion notice names its origin. View result navigates to the correct workspace/resource.

Archiving should reject new content operations. Already admitted jobs finish into their captured origin, with that behavior visible in the archive dialog. If an initial collection was deleted during generation, the card still completes in the origin workspace and a notice reports the omitted grouping.

## Legacy account behavior

After migration, existing content appears together in a default workspace. The user can progressively organize collections and make independent copies into new workspaces. The system does not guess novel membership from names, triggers, or card attributes.

For interaction details, see [frontend UX](/home/andres/WebstormProjects/magic-worlds/docs/workspace_r1/08_frontend_ux_impact.md); for copying semantics, see [copy and export](/home/andres/WebstormProjects/magic-worlds/docs/workspace_r1/09_copy_export_and_dependencies.md).

## Defined lifecycle and reuse outcomes

- The default workspace is renameable and protected from archive. Sandbox/Novel A can be archived and restored; archived content opens read-only and may be copied/exported.
- Ending a live voice call is part of a committed workspace switch. A canceled switch leaves the call and current editor in place. An active call blocks workspace archive until it ends.
- Copy includes linked independent lorebook resources and embedded resource snapshots. Their destination editable identities are new; immutable media bytes can be reused.
- A copy either completes entirely or creates nothing; after a failure the user runs Copy again. Repeating the same request after success returns the original result instead of a duplicate. A deleted destination result stays deleted; replay never resurrects it.
- A notice from an archived workspace opens that origin read-only or offers Restore. An unavailable/deleted target shows retained status instead of opening an unrelated current-workspace gallery.
- Existing floating previews are read-only and close on a committed workspace switch, including a switch that stays on the same feature page.

Exact contracts and bounds are in [document 15](15_execution_contracts.md).
