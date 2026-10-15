# Tool catalog and contracts

**Status:** proposed catalog, 2026-10-15. The six document tools and roleplay card-read tool already exist. Four search/non-card-read/preparation tools are new proposals. No tool is enabled by this document.

## Reuse these document tools

| Existing name | Model arguments | Meaning | Exposure |
| --- | --- | --- | --- |
| `mw_replace_card` | `response`, `card` | Complete validated card for creation or authorized broad replacement | Selected card type; creation/replacement grant |
| `mw_patch_card` | `response`, `patch` | Set the permitted top-level editable fields | Saved selected card and patch grant |
| `mw_no_card_change` | `response` | Answer without changing the card | Active card document stage |
| `mw_replace_lorebook` | `response`, `lorebook` | Complete validated lorebook for creation or authorized replacement | Selected lorebook/destination and grant |
| `mw_patch_lorebook` | `response`, `patch` | Patch permitted top-level fields; settings merge; entries list replaces | Saved selected lorebook and patch grant |
| `mw_no_lorebook_change` | `response` | Answer without changing the lorebook | Active lorebook document stage |

The existing document argument shapes stay canonical. Do not add an app-only `target_id`, `workspace_id`, `user_id`, or credentials parameter. Bind identity and target in the host context described in [04](04_architecture_and_reuse.md).

Current concise responses are capped at 1,200 characters; card tool arguments at 40,000 characters and lorebook arguments at 80,000. Preserve these bounds during extraction unless an explicit versioned change has tests. Provider-level argument limits also apply.

## Current editable content

| Family | Examples of editable fields | Fields/operations outside this tool scope |
| --- | --- | --- |
| Character/persona | Name, alias, role/persona markers, race, description, greeting, portrayal instructions, categories, triggers | Owner/scope/publication metadata; changing stored voice; generic engine rules |
| World | Name, alias, type, description, categories, triggers | Ownership, publication, runtime/provider configuration |
| Item | Name, alias, type, rarity, description, effects, requirements, limitations, origin, value, categories, triggers | Ownership, publication, runtime/provider configuration |
| Adventure template | Name, alias, description, persona/cast/world embedded content, categories, triggers | Mutating standalone referenced records or starting a play session |
| Lorebook | Name, description, tags, enabled, settings, entry text/types/activation/matching/priority/budget/placement fields | Attachments, resource ingestion, ownership/timestamps/IDs in model-authored documents |

Card media fields exist in the current schema. The assistant must preserve existing values unless explicitly authorized otherwise; URLs still require owned-asset validation. This is not image/music generation. Default-persona changes require the shared uniqueness invariant; withhold that field in the new main-page grant until its existing integrity dependency is resolved.

## Reuse the existing card-read contract

`mw_read_card(card_id)` already means reading an authorized card snapshot listed in the current Card Codex overview. Its current roleplay graph looks up snapshots injected before execution; it does not fetch live database content. Reuse its name/input definition and [card-context projection](../../../../PycharmProjects/magic-worlds-api/src/services/card_context.py), including owner/media/voice filtering, rather than implement a second card serializer.

For the main assistant, register the same read operation with a BFF adapter that resolves a card from the run's authorized result/selection set and rechecks scope. Record whether the snapshot is the saved/draft view and which revision it represents. This new host adapter is work to implement; current roleplay behavior stays unchanged. Do not preload the entire private library into an executor graph just to reuse its lookup node.

Project a typed allowlist of authored card content before reusing the sanitizer. Its current named exclusions were built for trusted session snapshot shapes; they are not a complete policy for arbitrary database responses or new metadata. In particular, scope/organization/credential/internal fields must never be forwarded merely because they were absent from the old exclusion list.

The existing `card_id` argument is an identifier, not authorization. Accept only host-issued/selected card IDs in the active run and validate ownership/workspace again. Generic record references remain available for preparation and other families. Do not expose both `mw_read_card` and a generic card-detail equivalent in one stage.

## New read and preparation tools

| Proposed name | Purpose and bounded input | Output | Reuse |
| --- | --- | --- | --- |
| `mw_search_guide` | Search localized in-app guide by query; optional section; limit 1–8 | Guide revision, section IDs, relevant excerpts, canonical available routes | Published artifact from the existing localized guide builder |
| `mw_search_content` | Find records by query and permitted source/types; opaque cursor; limit 1–20 | Names/types, concise matching metadata, opaque record refs, canonical links, continuation/coverage | Existing scoped list/search queries; one shared projection layer |
| `mw_get_content` | Read one authorized non-card record ref; bounded named section or passage cursor | Selected fields/excerpt, content revision/hash, source lineage, next cursor, truncation | Existing lorebook/resource/novel get selectors; cards use reused `mw_read_card` |
| `mw_prepare_edit` | Prepare a saved record ref or explicit new family/type/destination already covered by the target grant | Edit-context ID, exact target label/type, editable snapshot, CAS, allowed operations, field scope | Existing draft-aware snapshot/CAS readers and shared document policy |

Use a discriminated existing/new input for preparation; invalid combinations are rejected. Creation type and destination come from user-selected host state, not from a model's free choice. Preparation changes no card/lorebook and reserves no user-facing content object. It may create bounded operational context for the run.

Discovery returns metadata matches initially. Do not label it full-text or semantic search unless those query semantics are actually implemented. Detail tools can page through text after discovery. Add body search only if evaluation shows a need and its indexing/query plan is designed.

References are opaque identifiers tied to actor/workspace/run/source policy. The server resolves them; model-generated IDs, URLs, and cross-run references are not trusted.

## Stage-specific projection

| Stage | Visible tools |
| --- | --- |
| Answer from already available evidence | No tools needed |
| Discovery | Eligible guide/content search, reused card read, and non-card detail tools |
| Prepare | Preparation for the already granted target; eligible detail reads |
| Saved card editing | That card type's existing patch/no-change, plus replace only if granted |
| New card creation | That card type's existing replace/no-change; no patch |
| Saved lorebook editing | Existing lorebook patch/no-change, plus replace only if granted |
| New lorebook creation | Existing lorebook replace/no-change; withhold patch in the new app path |

A registry projection must support the exact granted subset. The existing card loader checks fixed patch/no-patch tool sets; adapting graph construction to smaller policy subsets is required work, not a supported current behavior.

Apply the [master/per-toolset controls](14_toolset_controls.md) before this stage projection. Shared search/get/preparation tools keep one implementation but accept only enabled family branches; omit them when no branch remains. The catalog stays at 11 names, rather than adding separate enabled/disabled variants.

Never expose every card-type schema simultaneously under the same tool name. One editing context selects one schema specialization. The same name must have one unambiguous schema within a model call.

## Illustrative call and host binding

Model call using the unchanged card schema:

~~~json
{
  "name": "mw_patch_card",
  "arguments": {
    "response": "I updated Mira's greeting.",
    "patch": { "greeting": "You found the archive. Now tell me what followed you." }
  }
}
~~~

The host binds the selected character ID, authenticated workspace, allowed field `greeting`, saved revision/hash, and action ID. The response string is a preview until commit. The model cannot redirect this patch by inserting a different ID into `patch`.

The same tool name, schema version, validator, planner, and commit implementation must serve the editor panel and the main page. Surface-specific authority and allowed-field constraints may narrow what the host accepts.

## Result contract

Proposed structured action result:

~~~json
{
  "action_id": "opaque-action-id",
  "tool": "mw_patch_card",
  "tool_version": "canonical-version",
  "status": "committed",
  "target": { "kind": "character", "id": "selected-card", "name": "Mira" },
  "changed_fields": ["greeting"],
  "revision_before": "opaque-revision",
  "revision_after": "opaque-revision",
  "href": "#/gallery/characters?card=selected-card"
}
~~~

This is an illustrative app-facing receipt. The actual target document/CAS should use the existing domain and wire types. The host supplies links and target labels. A no-change result has no fabricated changed fields or write revision.

Read results contain `items` or a typed record projection, source/revision metadata, `next_cursor`, `truncated`, and explicit coverage. A large record is not silently represented as complete.

The reused card-read schema has no passage cursor. If a full card exceeds its allowed result/profile budget, return a clear limit result rather than add an app-only argument silently. A versioned narrower card-read extension, if needed, belongs to the shared read contract.

## Errors and repair

| Proposed code category | Model/host recovery |
| --- | --- |
| Source/tool disabled | Explain availability; no alternative path around the gate |
| Target selection required/ambiguous | Ask the user to choose; perform no mutation |
| Not found or unauthorized | Return a non-disclosing missing/unavailable result |
| Reference/edit context expired | Re-read or prepare again within the same grant |
| Stale snapshot | Show conflict; no automatic overwrite or silent retargeting |
| Invalid schema/field | At most one bounded repair when failure is known pre-mutation |
| Profile incompatible | Explain text-only/unavailable capability; preserve explicit profile choice |
| Budget exhausted | Stop with available evidence and recorded action state |
| Unknown commit outcome | Reconcile receipt before any new attempt |

These categories do not replace existing error codes without a versioned mapping. Do not return stack traces, SQL, credentials, provider diagnostics, or private unrelated record names.

## Tool additions deliberately deferred

Entry-level lorebook operations, attachment management, resource import/extraction, media jobs, cross-record bulk patches, deletion, publishing, workspace administration, and novel writes require their own domain contracts. If entry editing is added, add it to the shared lorebook tool family and preserve entry identity; do not create an app-only patch implementation.

A simple lorebook audit can use reads plus an answer or existing authorized patch. A new “audit” function is unnecessary unless it offers deterministic validation or activation evidence beyond ordinary model reasoning.
