# General-assistant toolset controls

**User requirement:** the general assistant must offer an option to enable or disable its toolsets. **Design status:** proposed, 2026-10-15; no controls, preferences, or configuration are implemented by this document.

## Independent controls

Add an **Enable tools** master switch and individual toolset switches to the general Assistant page. A user can keep general-assistant card editing off while continuing to use the character/card editor assistant, or disable lorebook editing on the main page while retaining the lorebook studio assistant.

These settings are scoped to the app assistant. They must not change the shared tool registry definitions, global assistant-kind gates, roleplay tools, or editor-assistant preferences. Reuse is the implementation of the operation; availability can differ by surface.

## Proposed toolsets

| Toolset ID | User-facing purpose | Existing/proposed tools or branches | Dependency |
| --- | --- | --- | --- |
| `guide_read` | Search the app guide | `mw_search_guide` | Guide source and published guide capability |
| `cards_read` | Find and read cards | Card branches of `mw_search_content`, reused `mw_read_card`; card snapshot reads during preparation | Library source and relevant card-type capability |
| `cards_edit` | Create and edit a selected card | Card branch of `mw_prepare_edit`, `mw_replace_card`, `mw_patch_card`, `mw_no_card_change` | `cards_read`, Edit selected, target/destination grant, card assistant enabled |
| `lorebooks_read` | Find and read lorebooks | Lorebook branches of `mw_search_content` and `mw_get_content`; lorebook snapshot reads during preparation | Lorebooks source and product capability |
| `lorebooks_edit` | Create and edit a selected lorebook | Lorebook branch of `mw_prepare_edit`, `mw_replace_lorebook`, `mw_patch_lorebook`, `mw_no_lorebook_change` | `lorebooks_read`, Edit selected, target/destination grant, lorebook assistant enabled |
| `resources_read` | Find and read stored resources | Resource branches of `mw_search_content` and `mw_get_content` | Resources source and product dependencies |
| `novels_read` | Find novels and read excerpts | Novel branches of `mw_search_content` and `mw_get_content` | Novels source and product capability |

The catalog still has the same 11 tool names. Toolsets are registry groupings and parameter/result restrictions, not new functions, duplicated tools, or separate mutation handlers.

The P2 selected-target release applies read preferences to the host's snapshot preparation even before model-facing discovery/read tools ship in P3. A toolset switch cannot expose an unimplemented tool. Existing no-change tools appear only in an eligible document stage; ordinary Ask responses remain possible without them.

## Toolsets and sources mean different things

Sources determine what information may be supplied to the model. Toolsets determine which operations the model or controller may invoke against that information. Ask/Edit mode and the selected target then limit the permitted effects.

- Library on plus card editing off: the assistant may discuss eligible supplied card information and, if card reads are on, retrieve detail; it cannot edit.
- Card reads off: no new card lookup or implicit card-snapshot preparation. Card editing is effectively unavailable because its read dependency is missing.
- A source off: its corresponding read/edit operations are unavailable even if a toolset preference remains selected.
- Tools master off: no tool dispatch or implicit edit preparation. The assistant can still answer from the enabled context and user messages without tools.
- Turning tools off does not remove already supplied context, erase history, reverse saved actions, or turn sources off. Use source controls to restrict future supplied information.

Keep these differences visible in the interface. “Disable card tools” must not be presented as “forget card content.”

## Server policy and user preference

Resolve effective availability in one shared backend capability resolver:

~~~text
server/toolset rollout policy
AND user tools master enabled
AND user toolset selected
AND required read-toolset dependencies selected and available
AND source/product/assistant-family/profile capability
AND authorized workspace/mode/target/field scope
AND supported operation and run budget
~~~

User preferences only narrow server authority. An unavailable switch shows its reason; toggling it cannot enable a disabled product, unsupported profile, unimplemented operation, or inaccessible record.

If a read dependency is disabled, keep the edit preference inactive and explain the dependency. Do not silently turn reads on. Restoring a dependency may restore eligibility, but it does not re-create an editing target grant or authorize a new task.

Keep server rollout ceilings distinct from personal preferences. Operators may disable a general-assistant toolset for the deployment/workspace without disabling the underlying editor assistant. Existing app/domain kind gates still provide their broader ceiling.

## Shared-tool dispatch

For `mw_search_content` and `mw_get_content`, restrict allowed source/type arguments and result projections to the effectively enabled read toolsets. Removing lorebook reads must not remove resource reads when their independent source/product dependencies still permit them.

For `mw_prepare_edit`, expose only the eligible selected card or lorebook branch. If no editing toolset is effective, omit preparation and document-write tools entirely. If no eligible branch of a shared tool remains, omit that tool.

Enforce the same restrictions on dispatch even if a client/model submits a hidden name, stale handle, cached schema, or disabled branch. Neither search results nor preparation can re-enable a toolset. Do not add a model-callable settings tool.

Reuse the existing single-target schema specialization. Turning on both editing toolsets does not expose conflicting card/lorebook schemas or authorize two target edits in one turn.

## Preference storage and defaults

Persist preferences in authenticated, server-validated user/workspace settings scoped to the app assistant. Browser caching is a convenience and must include environment/API origin, viewer/project/group, workspace, and surface. The server remains the authority; localStorage alone cannot enforce tool access.

Store the user's selections separately from effective capability so a temporary server/profile outage does not rewrite personal choices. Include preference and capability revisions in the run fingerprint/readback.

Recommended initial defaults are master off until the user opts in, read toolsets selected subject to rollout/source availability, and editing toolsets off. Enabling the master does not silently enable editing. Unknown/new toolsets and unrecognized settings fail closed; existing users are not automatically granted newly introduced operations.

An illustrative preference document, not an existing API/configuration:

~~~json
{
  "surface": "app",
  "tools_enabled": true,
  "toolsets": {
    "guide_read": true,
    "cards_read": true,
    "cards_edit": false,
    "lorebooks_read": true,
    "lorebooks_edit": false,
    "resources_read": false,
    "novels_read": false
  },
  "preferences_revision": "server-issued-revision"
}
~~~

Use authenticated preference operations with concurrency/version validation. Do not invent an environment variable per user choice or let model text update preferences.

## Interface and task behavior

Add a **Toolsets** section separate from **What the assistant knows**. Show the master switch, seven grouped switches, concise read/edit descriptions, effective availability, dependency reasons, and an “Applies to the general assistant” note.

Use existing design-system controls and settings patterns during implementation. The product UI need not show raw tool IDs, registry terms, or preference fingerprints. Provide matching EN/ES copy and keyboard/screen-reader labels.

Keep editing controls unavailable when their toolset is off. If the user requests an edit in that state, explain which switch is required; do not route the operation through another tool, an editor conversation, or another type. Ordinary editor navigation can remain an explicit user action.

## In-flight runs and recovery

Freeze effective toolsets, source scope, and target grant at run admission. Disable these preference controls in the active page until the run completes or Stop is reconciled. Preference changes in another tab apply to subsequent runs and must not expand the admitted run's authority.

Disabling a toolset for subsequent runs invalidates its pending target grants and edit contexts there. Re-enabling it requires a new explicit target/task authorization before writing.

A server emergency kill switch stops new dispatch according to [07](07_execution_persistence_and_recovery.md); an already admitted/committed action may still need terminalization/readback. Personal switches are future-run preferences, not a promise to interrupt or reverse a commit.

Receipt/history access and idempotent result reconciliation remain available under ordinary authorization even with all toolsets disabled. They must not invoke a model, reapply a command, or debit again.

## Acceptance

The [evaluation plan](12_evaluation_and_acceptance.md) must cover master-off behavior, each toolset independently, read/edit dependencies, shared-tool branch filtering, preference isolation/persistence, unknown settings, in-flight/retry behavior, and unchanged editor/roleplay capability.

Shipping the new main-page editing capability without these switches would not meet the user's updated requirement.
