# Source availability and permissions

**Status:** proposed policy, 2026-10-15. “Available source” means a selected, supported, authorized data family; a nonempty digest is not the definition.

## Capability intersection

A tool is eligible only when all applicable constraints hold:

~~~text
server product capability
AND app assistant enabled (plus domain assistant for document tools)
AND general-assistant tools master and applicable toolset effectively enabled
AND required source selected for this run
AND client surface supports the contract
AND authenticated actor/workspace authorization
AND selected mode and target grant allow the effect
AND target lifecycle and version are valid
AND selected profile supports the workflow
AND run budget permits another step
~~~

The client can narrow this set, never enlarge it. Its flags, source list, focus references, record text, and model arguments do not attest server policy or ownership.

For main-page document actions, require both the app family and the corresponding card/lorebook family to be enabled by the BFF registry. This makes disabling lorebook assistance effective across its surfaces. Document-family enablement alone does not make the app surface available.

Current BFF kind gating does not supply a complete per-product/card-type capability service. Add one authoritative capability resolver; reuse it for exposure and dispatch. Do not pretend frontend `VITE_FEATURE_*` values establish backend authorization.

The [toolset control contract](14_toolset_controls.md) adds independent master and read/edit toolset switches for the general assistant. Source controls govern supplied information; toolset controls govern operations. Disabling a general-assistant toolset does not disable the corresponding editor assistant. Read dependencies also cover the host's implicit editable-snapshot preparation.

## Source-to-capability matrix

| Source | Eligible read data | Eligible write family with Edit selected and target grant | Other conditions |
| --- | --- | --- | --- |
| guide | Localized published in-app guide sections and permitted routes | None | Guide artifact revision/locale available |
| library | Owned characters/personas, worlds, items, enabled adventure templates | Existing card tool family, specialized to the selected type | Card kind enabled; adventure product capability required for adventure templates |
| lorebooks | Owned lorebook settings/entries | Existing lorebook tool family | Lorebooks product capability and lorebook assistant kind enabled |
| resources | Owned stored resource summaries/passages | None in initial scope | Lorebooks and resources product capabilities; does not grant resource import, URL fetch, attach, or extraction |
| novels | Owned novel/chapter summaries and selected excerpts | None in this initiative | Novels product capability; manuscript tools remain in the novel plan |
| focus pins | Prioritize detail within an eligible source | None by themselves | Each pin inherits its source family and target authorization |

Personas are character cards with role semantics, not a new write tool family. An adventure edit changes its own embedded document, not every standalone character/world named inside it.

An empty library/lorebook source can still permit creation when the user explicitly chooses that type and destination. “Zero records” must not disable a valid create tool; a missing source or product capability must.

Card detail uses the reused `mw_read_card` contract; lorebook/resource/novel detail uses the proposed non-card detail tool. Both obey the same source constraints. Current roleplay read-card access does not grant main-page access or bypass fresh ownership checks.

## Ask and Edit selected

Ask permits eligible read tools and answers. Edit selected permits document tools only for one visible target or explicit creation destination, within a server-validated field scope.

The first editing release should use a target picker/chip to make authority concrete. The host records the user's selection and mode in a request-bound grant. The model may recommend a candidate or call preparation, but cannot mint the grant. Natural-language target discovery can prefill a picker; ambiguous names, multiple focus pins, and source text are not target authorization.

For a saved card, bind card type and ID. For a saved lorebook, bind its ID. For creation, bind family/type, workspace, and optional authorized initial collection IDs. No tool can choose another workspace, escalate a field scope, or convert the target type.

Do not ask again for every patch when the same bounded target/task is already authorized. Require a new target choice when the task changes target or destination. Broad replacement that removes substantial content should produce a reviewable proposal unless that exact replacement was already explicitly authorized; the first release may conservatively withhold such replacement authority.

UI mode is an authority ceiling, not evidence that every model-generated edit matches the user's goal. Wrong-but-in-scope edits remain a quality risk; limit writable fields, show receipts, and evaluate no-op/over-edit behavior.

## Proposed host envelope

Illustrative host state, not a new model-facing tool schema:

~~~json
{
  "contract": "app_workflow_v1",
  "workspace_id": "authenticated-workspace",
  "allowed_sources": ["guide", "library", "lorebooks"],
  "mode": "edit_selected",
  "target_grant": {
    "family": "card",
    "card_type": "character",
    "target_id": "selected-card",
    "allowed_operations": ["patch_card"],
    "allowed_fields": ["greeting"]
  },
  "capability_revision": "server-policy-revision"
}
~~~

The server validates every field against session authorization, policy, and selected target. The received object cannot confer a right the actor does not have. The semantic strings and contract version are proposals, not accepted current DTO values.

Before model execution, the server replaces request claims with resolved scope and a stored policy fingerprint. The profile graph receives only the task, data, and tool projection needed for that step.

## Source switch semantics

Current focus is included independently of source switches. Proposed behavior makes this explicit and consistent:

1. Turning a source off disables its retrieval and write tools for subsequent runs and removes its focus items from the outgoing context. The UI marks affected pins inactive; it does not quietly bypass the switch.
2. A disabled source cannot be re-enabled by model output or by a preparation call. The user can restore it through the source control.
3. Source selection and target grants are frozen for an admitted run. Keep source/target controls disabled while that run executes; Stop cancels unstarted steps. Changing a source for a later run cannot undo an already committed action.
4. New runs invalidate stale record references/edit contexts and rebuild history under the selected sources.
5. Old generated answers and tool results may contain now-disabled data. Do not feed them back wholesale. Exclude affected derived messages/summaries using recorded lineage; direct text the user deliberately enters remains user input.
6. Switching off a source is future context control, not deletion of prior provider requests, execution payloads, saved messages, or backups. State that limit plainly.

Data dependencies also need projections: reading a lorebook must not automatically hydrate resource attachments when resources are off. Reading a novel must not silently expand linked library records or lorebooks. A mention or embedded authored quotation in an allowed document is distinct from fetching a linked private source.

## Revalidation and revocation

Recheck authorization and target state when resolving a reference, preparing an edit, admitting a model action, and committing a mutation. A known ID or server-issued handle is still not sufficient permission.

Distinguish new admission from retained work. Existing assistant executions can finish into an origin workspace archived after admission. Preserve that explicitly defined recovery behavior for admitted work; an unstarted app step must not inherit blanket permission from an earlier read. A new action in an archived workspace is refused.

An emergency tool kill switch stops new dispatch. If a commit already happened, recovery returns its receipt without pretending the action was reversed. Define exact in-flight behavior as part of rollout acceptance.

## Availability examples

| Situation | Expected behavior |
| --- | --- |
| Library selected, Ask mode | Search/read cards; no card mutation tools |
| Library selected, Edit selected, one saved item, compatible profile | Item-specific existing patch/no-change tools; replacement only if granted |
| Lorebooks selected but lorebook assistant kind disabled | Read if product read capability permits; no lorebook writes |
| Resources selected and lorebooks source switched off | Resource reads may remain eligible if product dependencies pass; no lorebook writes or attachment hydration |
| Novels selected | Read/explain/compare; no manuscript edits |
| Six pinned records, no edit target | Pins inform answers; no implied six-record edit grant |
| Empty enabled library, explicit New world destination | Existing replace-card creation operation if integrity gates pass |
| Client invents another workspace/owner in arguments | Reject before model execution/mutation; disclose no target details |
| Profile supports streaming but not tools | Explicit text-only capability; disable edit execution without silently changing profile |
| General tools master off, sources still selected | Tool-free answers from supplied context; no dispatch or editing preparation |
| General card editing off, card reads on | Read/answer about cards; card editor assistant remains governed by its own availability |
