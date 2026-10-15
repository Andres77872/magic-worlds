# Execution, persistence, and recovery

**Status:** proposed, 2026-10-15. The current atomic one-target lifecycle is a foundation, not an already implemented general tool loop.

## Protocol boundary

Keep legacy app text turns and editor turns readable with their existing strict contracts. Add an explicit app protocol version for tool-enabled runs. Suggested labels are app wire version 2 and workflow `app_workflow_v1`; exact DTO naming must be settled before implementation.

Versioned app input carries source selection, Ask/Edit mode, a server-validated target grant reference, locale, and limits constrained by policy. It must not accept provider URLs, graphs, model names, tool definitions, SQL, or user-supplied runtime authority.

Resolve the app-scoped tools master, toolset selections/dependencies, and preference/capability revisions server-side before admission. Include the resulting toolset fingerprint in run intent and readback. Personal preference changes apply to later runs; [14](14_toolset_controls.md) defines in-flight and receipt behavior.

A versioned app final contains a run result and zero or more action receipts, rather than pretending that the app conversation has one permanent `target`. A single-target first release limits this to one document action. Frontend verification must reject mixed legacy/v2 shapes.

Do not loosen the old app message validator to accept arbitrary tool rows or use the narrative output contract as a generic app-action escape hatch.

Recommended storage approach: keep app conversation rows as ordinary user/assistant text under the existing metadata allowlist. Store action/tool trajectories in scoped versioned run/step/action records linked by conversation and request identity. Project v2 results from that store through a version-aware read path. Do not inject new unrecognized keys into legacy message metadata or legacy immutable snapshots; explicit migration/read support is required.

## Incremental execution strategy

**First editing release:** one selected target/destination, one tool-generating model execution, one validated document action or no-change result, then atomic completion with a receipt and the user-facing response. It can use the existing single external action projection after the shared document extraction and versioned app persistence adapter exist.

**Later retrieval release:** a bounded controller can alternate model steps and tool results. The current collector only accepts one external action and recognizes `assistant_reply`/`narrative`. Add a separately versioned app-step projection for a text final or one recognized tool call with typed arguments. Validate its complete result before dispatch. Preserve the old projection unchanged.

Do not append retrieval tool transcripts to the existing `history_text` and assume they survive: it explicitly omits tool messages. The new controller constructs a typed, bounded trajectory from validated step records and tool results.

## Proposed durable records

These are logical entities, not executable DDL or approved table names:

| Record | Required identity/state |
| --- | --- |
| App run | Actor/project/group/workspace, conversation, user request ID, contract/policy/source fingerprints, user mode/target grant, status, step/write budgets, parent billing reference |
| Model step | Stable run/step/attempt identity, published profile/revision/feature/role, execution reference, input fingerprint, result status and permitted usage metadata |
| Document action | Stable action/intent identity, selected target or creation destination, tool/schema version, expected CAS, validated command fingerprint, status, committed result reference |
| Action receipt | Exact resulting identity/revision, changed fields, organization warnings, checkpoint reference if supported, commit time, idempotency identity |
| Read lineage | Source/ref/revision, excerpt boundaries or digest, coverage, policy fingerprint; raw content retained only under the chosen privacy policy |

Foreign keys and scoped queries must bind these records to the same authenticated scope. A receipt must remain available for authorized reconciliation even if a capability is later disabled. Deletion/retention must be designed deliberately; do not add cascade assumptions around financial or execution records.

## Transaction boundaries

1. Admit the run/step and reserve the applicable budget under a stable request identity.
2. Release database locks while the model runs. Never hold an open SQL transaction across a provider request.
3. Parse the complete action and run the existing shared domain planning/validation.
4. Open the short completion transaction. Acquire locks in the established order, verify ownership/lifecycle/CAS and the retained admitted operation, then apply the shared document command.
5. Write the action receipt, terminal step result, applicable run state, and billing/reservation transition in the same transaction as the document mutation.
6. Deliver the authoritative saved document/result after commit.

For the one-action release, finish the app conversation's terminal messages and release its guard in that same completion transaction, preserving existing semantics.

For the later multi-step controller, persist intermediate read/model results separately. A document action may commit before a narrative summary. Its receipt remains authoritative if summary generation fails; the run reports the saved action and a summary warning, not “nothing happened.” Never regenerate a committed command solely to finish prose.

Shared commit code accepts a caller-owned cursor and never starts or commits a nested transaction.

## Proposed state transitions

~~~text
run: admitted -> running -> completed
                      -> awaiting_target
                      -> conflicted
                      -> failed
                      -> cancelled

action: prepared -> generated -> validated -> committed
                                      -> no_change
                                      -> conflicted
                                      -> failed
                                      -> cancelled_before_commit
~~~

An admitted action with an unknown client outcome is reconciled, not labeled cancelled-before-commit. A committed action is never transitioned back to uncommitted. After a committed action, later failure is represented as a completed action plus a run warning/partial narrative outcome.

The first release does not pause while holding a conversation/database lock for target selection. Return a terminal needs-target result; the user's selection starts a new request with explicit scope.

## Idempotency hierarchy

The user request identifies the run. Server-owned stable step IDs identify model work. A document action identity binds the intended business effect independently of provider tool-call IDs, which may change across attempts.

Reuse of an admitted identity with different message/source/target/tool/arguments/profile intent is a conflict, not a new operation. A linked retry can have a new execution-attempt ID while preserving the same intended action. Completed action receipts take precedence over newly generated output.

For a new object, allocate/reserve the destination identity in operational state before commit, or generate it once in a retained command record. Retry must not call `uuid4` again and create a second object.

These are application idempotency guarantees; they do not prove that an upstream provider computed a response exactly once.

## Failure and recovery matrix

| Failure point | Required behavior |
| --- | --- |
| Before admission | No domain effect or platform debit; safe corrected request |
| Model error or malformed arguments | No mutation; compensate/release according to the admitted step policy |
| Authorization or CAS fails at completion | No domain mutation; persist conflict/failure and safe user guidance |
| Crash before completion transaction | Read durable execution/action state; never infer commit from streamed text |
| Crash inside completion transaction | All mutation/receipt/billing writes roll back together |
| Commit succeeds, response is lost | Reconciliation returns original saved result; no provider call or additional debit |
| User stops during generation | Cancel future steps and drain/terminalize current work safely |
| Stop arrives after commit | Show the committed receipt; stop cannot undo it |
| Workspace archives during admitted work | Finish/replay only the retained admitted operation under existing origin rules; no new action admission |
| Profile/key disappears during recovery | Preserve intent and receipts; request required credentials only for genuinely new model work |
| Final summary fails after saved action | Show saved action with warning; no reapplication |

## Billing and capacity

Current assistant model turns use `ai_card_generation` unless BYOK applies. Reusing tools does not authorize a hidden second editor execution or an additional profile charge.

For the first one-model-action release, keep one user-visible app execution and the existing applicable operation charge. Domain search/get/preparation implementations are database work, not independent LLM generations.

For later multi-step runs, recommend one run-level platform reservation/debit under a versioned operation policy, with model steps consuming server-enforced sub-budgets and recording their individual execution provenance. Do not nest the existing per-turn charged admission for every internal model call.

This needs admission/ledger work and product approval of the accounting policy. Until that decision is accepted and tested, multi-step rollout is blocked. BYOK skips platform-wallet debit but still consumes provider resources and needs rate/capacity limits. No new prices or “free” claims are established here.

Current app replies report `usage: null` in assistant metadata. Accurate aggregate usage requires retaining available execution usage through a versioned projection; unavailable usage stays unknown. Do not manufacture token totals from UI character estimates.

## Initial bounded-run defaults

Suggested experimental ceilings, to be tuned by evaluation: one document mutation, at most six model steps and eight read calls, one pre-mutation argument-repair attempt, and a two-minute overall deadline subject to stricter profile limits. The single-action release uses only one model step.

Context/tool-result caps are specified in [08](08_context_retrieval_and_citations.md). A backend policy can reduce all ceilings. A tool or model cannot increase them.

## Rollback compatibility

A server kill switch disables new tool-enabled app runs while leaving legacy Ask and authorized result readback available. Pending/committed action records are not discarded. Retained execution cannot silently resolve a newer graph/schema/profile in place of the original.

Database and protocol rollback needs forward-compatible readers or a separate versioned result store before enabling writes. A feature flag alone cannot make a new persisted format safe for old binaries.
