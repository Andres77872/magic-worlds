# Gaps and requirements

**Reviewed:** 2026-10-15. All requirements below are proposed. Priorities describe work order and exposure risk, not a claim of an exploitable production incident.

## Gap register

| ID | Priority | Observed gap | Required outcome |
| --- | --- | --- | --- |
| G01 | P1 | App assistant has no tools | Offer the same card/lorebook operations from the main page when eligible |
| G02 | P1 | Tool availability is coupled to conversation kind and bound target | Separate surface, capability, and target context |
| G03 | P1 | Tool schemas are embedded across type/patch-specific graph artifacts | One maintained tool definition per operation/type, shared by runtime graph assembly |
| G04 | P1 | Current source switches control digest sections; focus is included independently | Define visible, consistent source/focus behavior before source-scoped tools ship |
| G05 | P1 | The model cannot search or fetch missing records | Add authorized paginated search and bounded detail reads |
| G06 | P1 | App role accepts streaming-only profiles | Publish and verify a versioned tool-capable contract without silently replacing text-only profiles |
| G07 | P1 | App messages/snapshots reject document tool shapes | Add explicit workflow/action persistence and versioned readback |
| G08 | P1 | Retries are built for one execution/target, not a multi-step run | Preserve receipts and budget/charge ownership per model step and document action |
| G09 | P1 | Context-retention copy disagrees with frozen-payload persistence | Resolve policy/copy/deletion dependencies before broader private reads |
| G10 | P1 | A client feature flag is not authoritative backend permission | Resolve capability intersection server-side and enforce it on every call |
| G11 | P1 | Editor mutations can commit before final delivery | Keep direct-apply semantics explicit; never treat a streamed preview as a receipt |
| G12 | P1 | Known shared creation/media integrity work remains open | Close or explicitly restrict affected capabilities using the existing owning ledgers |
| G13 | P2 | Main knowledge has character caps, fixed list samples, and one resource page | Replace blanket digests with relevant retrieval plus a small index |
| G14 | P2 | New, unsaved card form fields are not sent to the editor assistant | Keep behavior documented; plan an optional shared draft-input contract rather than claiming live unsaved-form awareness |
| G15 | P2 | Lorebook entry-list edits can regenerate entry identities | Define safe replacement behavior now; design identity-preserving entry operations only in the shared domain layer |
| G16 | P2 | Conversation summaries do not provide durable action truth | Read action state from committed receipts and cite exact record versions |
| G17 | P1 | No independent user-facing toolset controls exist for the main assistant | Master and per-toolset switches without changing editor assistants or tool implementations |

Evidence is mapped in [00](00_current_status_and_evidence.md). G09 and G12 reference existing owned findings; this register does not replace them.

## Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| F01 | Reuse the six existing document tools and existing card-read contract; no app-specific copies | Schema fingerprints and domain behavior parity across surfaces |
| F02 | Choose tools from enabled source families, server product capabilities, assistant registry, target rights, and profile support | Availability matrix and forged-request negative tests |
| F03 | Support editing one saved character/persona, world, item, adventure template, or lorebook from the main page | End-to-end cases for every eligible type, with exact committed target receipt |
| F04 | Support new card/lorebook creation into an explicitly selected destination when creation gates pass | One new object and expected memberships after repeated submission/reconnect |
| F05 | Support read-only guide, library, lorebook, resource, and novel retrieval when selected | Bounded results; zero records from disallowed sources/workspaces |
| F06 | Keep ambiguous targets unresolved until the user selects one | Duplicate-name and multiple-focus cases perform no mutation |
| F07 | Distinguish Ask from Edit selected; source/focus choices alone cannot authorize writes | No-change questions and crafted source instructions write nothing |
| F08 | Show actions, affected fields, destination, status, and record links | UI is consistent with server receipts after refresh and recovery |
| F09 | Preserve editing handoff and existing panels | Editor and main page observe the same resulting document and conflicts |
| F10 | Return a useful answer or explain a disabled capability | No model-generated workaround bypasses disabled tools or creates another type |
| F11 | Offer main-assistant master and individual read/edit toolset switches | Each toolset can be disabled independently; all-off retains tool-free answers; editor assistants are unaffected |
| F12 | Persist user/workspace/app-scoped preferences and enforce effective toolset branches server-side | Dependency, shared-tool filtering, isolation, reload, forged-request, and unknown-setting tests |

## Integrity and operational requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| N01 | Recheck ownership, application scope, workspace, target identity, field policy, and revision before mutation | Race and cross-owner/workspace database tests |
| N02 | One action receipt and domain mutation commit atomically | Crash injection at each persistence boundary; no duplicate creates |
| N03 | A replay of completed work performs no provider call or new debit | Provider spies and ledger assertions |
| N04 | Treat partial streams and unknown cancellation outcomes as incomplete | Reconcile from action/run receipts before reporting success or retrying |
| N05 | Enforce bounded model steps, reads, writes, input/output size, wall time, and cost | Budget exhaustion terminates without additional actions |
| N06 | Keep credentials, raw private context, and provider diagnostics out of ordinary logs | Fake-key/private-text canaries across success, validation, error, and recovery paths |
| N07 | Version contracts explicitly; retain old history/replay integrity | Mixed-version reads; feature-off and rollback matrix |
| N08 | Preserve draft/published semantics, owner voices/media, persona roles, and collection ownership | Shared-domain parity cases and existing integrity closure evidence |
| N09 | Use published profiles for every model step | Recorded role/profile/revision/payer provenance; no hidden model calls |
| N10 | Preserve consistent source policy over retrieval, focus, nested references, and future history construction | Source-off/re-enable cases and lineage-aware context tests |

## First-release boundary

The minimum useful release is an explicitly selected single target on the main page with eligible existing tools, shared validation/mutation, conflict handling, and an authoritative receipt. Search and read tools can follow independently after that boundary is safe. Bulk edits, deletion, public publishing, moving records between workspaces, novel writes, media generation, and unrestricted external access are deferred.

A tool family is unavailable when any required gate is missing. The assistant explains the limitation and can offer an enabled editor link; it must not silently copy the record into another type or workspace.
