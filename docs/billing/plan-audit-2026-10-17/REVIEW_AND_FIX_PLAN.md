# Membership audit: focused review and fix plan

Status: reviewed and planned; no product fixes applied. Review date: October 17, 2026, America/Mexico_City (October 18 UTC).

This plan addresses the eight findings and the voice-pricing editor boundary in the [original audit](README.md). Checkout, subscriptions, payment reconciliation, new features, and unrelated refactoring are outside its scope.

## Review verdict

**Request changes before considering this audit resolved.** Root plan creation, assignment, live allowance changes, and the tested enforcement paths work. The highest priorities are the reset/refund accounting defect and the first-chat persona failure. The remaining findings require bounded reporting, contract, error-message, and assignment-history changes.

All ten source fingerprints recorded by the audit still match. The review traced the affected writers, refunds, partial settlements, projections, picker consumers, protocol handlers, and schema verification. The current worktrees contain substantial development changes, including changes in the accounting and chat files this plan touches. Implement against those current files; preserve existing staged and unstaged work.

| Finding | Priority | Evidence | Fix impact |
| --- | --- | --- | --- |
| F1: old refund removes post-reset usage | P1 | Real isolated MySQL reproduction; full-refund path verified in source | High: shared accounting, settlement, recovery, schema |
| F2: AI character selected as a player persona | P1 | Browser and live 422 response | Medium: shared picker has adventure, chat, and call consumers |
| F3: root and consumer monthly figures use different windows | P2 | Real isolated MySQL reproduction; intentional consumer reset filter also has an existing test | Medium: reporting semantics and response metadata |
| F4: split PAYG payment counts one action twice | P2 | Real isolated MySQL reproduction | High: ledger identity and monthly aggregation; amounts are already correct |
| F5: valid `novel_assistant` capacity response rejected | P2 | Captured response rerun through the current parser | Low: shared capacity/compatibility feature allowlist |
| F6: quota reasons become generic execution failures | P2 | Live AI/chat rejection and source trace | Medium: HTTP/WS contracts and recovery UI |
| F7: assignment reason lacks durable history | P2 | Assignment transaction and logger reviewed; no history contract in that path | Medium: additive persistence, root read API, retention |
| F8: inaccurate price and usage labels | P3 | Live UI and formatter reviewed | Low: display only; voice editor clarity is included here |

F1's partial-settlement exposure is a source-based extension of the reproduced full-refund defect. It must receive its own executable regression before being claimed as reproduced. F7 is a persistence-contract gap, not a demonstrated failure of a configured external log-retention service.

### Recommendations tightened by this review

1. A fix only in `refund_credit_ledger` is incomplete. `settle_media_reservation` also subtracts included credits after a reset, and the defensive zero-credit LLM failure path directly decrements an operation counter.
2. Do not change `personaCandidates` globally. Adventure creation and in-session adventure selection also use it. Restrict persona roles in the contexts whose backend requires them.
3. Do not make root's calendar totals zero just to match the consumer after a reset. Preserve both existing calculation bases and label them explicitly.
4. Do not count distinct nullable `reference_id` values as actions. Generic media reservations currently omit that identity. Some ledger rows represent duration-credit units rather than single actions.
5. An included operation allowance is not universally a hard stop: sufficient PAYG may fund the operation. Better errors must preserve that behavior.
6. Additive SQL is not automatically safe for rolling deployment here. The backend verifies exact schema contracts and a revision marker; an older binary can reject a database containing new columns or tables.

## Scope and protected behavior

Each implementation slice must satisfy its own acceptance checks and the relevant neighboring checks below. Avoid moving shared code, reformatting large files, renaming operations, replacing the charge system, or altering unrelated fixtures to obtain a green suite.

| Boundary | Behavior to preserve |
| --- | --- |
| Root management | Consumer requests remain forbidden; default-plan protections, complete nine-operation maps, inactive-plan assignment rejection, and occupied-plan deactivation rejection remain enforced. |
| Assignment and plan edits | Existing consumption and PAYG balances survive reassignment and allowance changes. A reason remains optional with current validation limits. |
| Financial amounts | Included and PAYG totals, free/billed bucket balances, debit/refund order, compensation entries, and idempotency remain exact. F3/F4 must not reprice or rewrite financial history. |
| PAYG eligibility | Exhausting the included request allowance may still fall through to a sufficiently funded wallet. Concurrency and voice quantity limits retain their existing enforcement. |
| Independent meters | App-credit daily resets must not silently reset BYOK capacity, non-credit writer capacity, narration character meters, preview policies, or call-second meters. |
| Execution recovery | Preserve leases, execution ownership, request IDs, intent checks, dispatch boundaries, explicit retry behavior, and successful result persistence. No automatic paid retry. |
| Voice and media | Preserve narration settlement, cache reuse, preview charging, duration billing, image-profile prices, stale-job recovery, and account-wide limits across workspaces. |
| Development features | Preserve novel/assistant/variant behavior, workspace origin and isolation, feature flags, call modes, and the existing creator engine. Supporting a known feature in a parser must not enable the feature. |
| User data wipe | Content wipe retains the account and membership/billing history. Existing settlement and paid-preview refund behavior still runs correctly. |

Frontend UI changes must reuse the existing primitives, theme tokens, and EN/ES translations. No new design system or settings flow is needed.

## Implementation sequence

Use independently reviewable changes. The sequence is a dependency order, not a request to bundle every fix into one release.

| Slice | Work | Dependency / completion gate |
| --- | --- | --- |
| 0 | Add failing regressions for the targeted defects; capture the current lock order and schema predecessor | No behavior change; setup failures must fail normally |
| 1 | F2: constrain persona selection and use the existing persona creator entry | No accounting/schema dependency; first chat must succeed from the no-persona state |
| 2 | F5: correct and exhaustively check the feature allowlist | Independent small change; strict response validation remains enabled |
| 3 | F1: reset-aware full refunds and partial settlements | Accounting design and migration gates below are mandatory |
| 4 | F4: stable action identity and correct monthly counts | Coordinate with F1's ledger metadata; preserve all monetary and duration totals |
| 5 | F3: expose calculation windows and correct labels | Choose the explicit-window contract below; consume F4 counts when available |
| 6 | F6: additive quota details and actionable UI | Preserve existing admission, retry, and BYOK behavior |
| 7 | F7: transactional assignment history and root retrieval | Separate scoped schema change; no payment-path modification |
| 8 | F8: correct consumer units/copy and voice editor pricing descriptions | Can be reviewed independently; do not change pricing calculations |
| 9 | Combined regression and focused browser E2E | All affected slices pass; verify unchanged behavior under development |

F1 remains the highest-risk accounting work even though the two independent frontend fixes can land earlier. Do not hold those small fixes for a broad billing rewrite.

## F1 — Make compensation respect daily reset boundaries

**Primary files:** [models.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:3410), [LLM admission](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py:770), [db.sql](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql:1037), and the scoped schema migration/bootstrap contract.

**Recommended design:** persist a monotonically increasing reset generation for the user's app-credit usage day, and snapshot it on every reservation that contributes to that day's counters. Names such as `reset_generation` are proposed internal fields, not existing API fields. A refund always compensates its own valid ledger/wallet entries; it subtracts daily counters only if those counters still include that reservation's generation.

1. Advance the generation and zero the existing daily app-credit/operation counters in one transaction for both user and global resets. Repeated resets must advance the boundary even when the counters are already zero.
2. Record the generation in the included and PAYG ledger source rows, and in any reachable credit-billed reservation that has no ledger row. Snapshot the actual increment semantics; do not assume all counters increment by one.
3. Apply the same generation check to full refunds, partial settlement's included-credit adjustment, and any reachable zero-credit LLM failure decrement. Partial settlement must retain the accepted operation count; a full refund may remove that operation only once in the applicable generation.
4. Preserve exact ledger ownership checks, reference IDs, PAYG compensation, original ledger IDs used by recovery, and settlement's billed-PAYG → free-PAYG → included refund order. Any settlement-created row must carry the relevant reservation metadata.
5. Write down the lock order before coding: domain/job or execution locks, the counter/reset guard, ledger rows, and wallet rows. Check every participating writer and compensator against that order. Do not introduce a ledger-to-membership lock inversion to obtain the generation check.
6. Global reset must remain atomic and keep its existing missing-membership guard. Cover concurrent writers for multiple users; do not replace it with partially committed user batches.

**Legacy and cutover rule:** do not use second-precision `created_at >= reset_at`, adjacent ledger IDs, or an unsynchronized `MAX(ledger_id)` as proof of generation. Existing records have no generation. Inventory outstanding legacy reservations and recovery jobs; settle them or assign a generation only from provable ownership/reset information before enabling the new compensation behavior. Ambiguous legacy records require a bounded reconciliation decision and block that cutover, rather than silently skipping compensation or rewriting balances. Nullable migration defaults must never be interpreted as “belongs to the current generation.”

**Required regressions:** real isolated MySQL tests with two connections and transaction barriers, plus focused model/service tests.

| Case | Expected result |
| --- | --- |
| Reserve 5; reset; reserve 2; fully refund old 5 | Daily included usage stays 2; current operation count stays 1; the old charge is compensated once |
| Reserve 5; reset; reserve 2; settle old reservation to 3 | Daily usage stays 2; new operation count stays 1; the old reservation retains the correct net 3-credit ledger charge |
| Refund or settle a reservation created after reset | Only its own currently counted contribution is removed; partial settlement retains its action count |
| Split PAYG reservation refunded after reset | Exact free/billed wallet restoration and compensation entries; current-day counters do not lose another action |
| Repeated refund/settlement, duplicate callback, stale sweep | No additional balance or counter change |
| Same-second reset/reserve/refund; two resets | Results follow serialized generation order rather than timestamps |
| User/global reset races with reserve, refund, settlement | No lost increments, partial global result, double compensation, or deadlock in the tested orderings |
| Midnight rollover and late old-day completion | Writes stay on the reservation's database usage day; the new day's counters are untouched |
| Narration wipe and paid-preview recovery after reset | Existing content-wipe cleanup and accounting remain valid |

Promote the original full-refund reproduction to an ordinary passing regression after the fix. Keep the original evidence unchanged.

## F2 — Prevent invalid persona selection before entering chat

**Primary files:** [NewCharacterChatDialog.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/characterChat/components/NewCharacterChatDialog.tsx:42), [PersonaPickerDialog.tsx](/home/andres/WebstormProjects/magic-worlds/src/ui/components/PersonaPickerDialog.tsx), its chat/group/call entry points, and the two chat-start methods in [DataProvider.tsx](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.tsx). Keep the backend's persona-role validation.

1. Filter the new-chat dialog to `isPersonaCard`. Add an explicit picker constraint for contexts that require role `persona`; preserve the existing adventure candidate behavior instead of changing `personaCandidates` globally.
2. Thread that constraint through Landing/Gallery chat and group entry points, Library chat entry, and call persona pickers that use the same backend requirement. Keep AI target-character lists separate and unchanged.
3. When no valid persona exists, disable confirmation and show a “Create persona” action. Use the existing [buildPersonaCreatorHash](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/galleryLinks.ts:396) / `#/character?role=persona` entry, which already presets the creator's role. Do not invent a second creator or auto-convert an AI character.
4. Recheck the selected card's role immediately before starting character/group chat, including direct DataProvider callers. Preserve lazy session creation, workspace/origin context, saved defaults, and group participant rules. If a selection disappears during refresh, require a valid replacement.
5. Reuse current navigation/resume behavior; make the next step back to chat clear after saving the persona. Do not persist a new cross-feature draft protocol solely for this fix.

**Acceptance:** an account with one AI character and zero personas cannot submit that character as its persona; it can create a persona, select it, send its first message, and receive one correctly charged response. Existing global/per-character default personas still work. Adventure creation and adventure persona replacement retain their current candidate behavior.

**Coverage:** `characterRoles.test.ts`, `NewCharacterChatDialog.test.tsx`, `ChatroomPage.test.tsx`, the affected Landing/Gallery/Library/Calls component tests, a narrow DataProvider start-method test, and the existing character-creator role-hint test. Include empty/loading/error states, stale selection, default selection, group chat, and a preserved adventure case. Avoid rewriting the large provider test fixture.

## F3 — Make monthly calculation windows explicit

**Primary files:** [consumer monthly query](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:4085), root member/overview projections in [membership_admin_models.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py:670), their schemas/types, and existing root/consumer usage labels.

**Recommended contract:** preserve root's calendar-month ledger consumption and the consumer's current reset-adjusted projection. Expose their calculation bases and effective window explicitly. A monthly reset currently changes a reporting window; it must not clear daily balances or erase ledger history.

1. Add bounded metadata identifying calendar-month versus since-monthly-reset calculation, the applicable reset identity/time when present, and the effective start. Retain existing amount fields and their meanings for existing clients.
2. Consumer copy must say usage is since the applicable monthly reset when one exists. Root copy must identify calendar-month consumption. A calendar-month heading alone is insufficient for a filtered consumer amount.
3. If root requires a comparison with the consumer, return a separately named reset-adjusted value/window; do not silently redefine `credits_used_month` or its overview totals. Do not sum reset-adjusted values for users with different reset times and label them as one shared period.
4. Cover precedence between the latest applicable user and global reset. Future reset boundaries should use a deterministic ordering/identity coordinated with F1/F4; equal-second timestamps cannot establish precise transaction order. Preserve historical ambiguity explicitly rather than fabricating an exact cutoff.
5. Keep capacity/BYOK monthly projections and payer-specific request counts separate from these membership-ledger projections.

**Correction to the audit probe:** its assertion that all three raw amounts must always equal is too strong. After the example reset, consumer 0 and root calendar 5 can both be valid. Replace that equality expectation with assertions for the chosen window metadata, labels, matching comparisons within the same basis, and preserved calendar consumption. Retain the captured discrepancy as evidence of the original unlabelled experience.

**Coverage:** no reset, user reset, global reset, user/global precedence, repeated reset, same-second boundary, month rollover, and a refund after reset. Test that daily counters, wallet balances, and ledger history are unchanged by the monthly reset. Contract-test backend metadata and the two UI calculation labels in EN/ES.

## F4 — Count actions independently of ledger payment sources

**Primary files:** the ledger writers in [models.py](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py:2895) and [LLM admission](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py:568), consumer/root monthly queries, and their scoped schema migration.

1. Add a stable reservation/action group identity for new action-based charges. Every source row of the same action shares it; different actions never do. Persist it atomically with the debit and reuse it on idempotent recovery.
2. LLM execution references and idempotent duration debit keys already provide identities in some paths. Use those existing ownership contracts where proven, and add the missing identity to generic media reservations. Do not replace execution IDs or the existing unique idempotency/source constraint.
3. Action-based monthly `used` counts distinct surviving action groups. Monetary fields still sum net reserved credit-source rows exactly. Full refunds remove the action; partial settlement retains one surviving action and the correct net credit amount.
4. Preserve voice-call `used` credit-unit semantics and `billable_seconds`. `debit_operation_credits` increments by `credit_count`, so universal `COUNT(DISTINCT group)` would introduce another defect. Preserve zero-cost preview/cache behavior rather than charging or counting it as a paid action to fill a reporting gap.
5. Backfill legacy identity only through reliable owner links such as an execution, persisted job/charge, or validated idempotency key. For ungroupable legacy records, expose/document the legacy count basis or uncertainty; do not claim an exact historical action count. Never infer groups from equal timestamps, costs, consecutive IDs, or NULL references.

**Acceptance:** a new 5-credit action paid with 2 free PAYG + 3 billed PAYG reports one daily action and one monthly action in consumer/root views. Credits remain 5 and the buckets remain correctly depleted. A second identical action counts separately. Voice duration and financial totals remain byte-for-byte equivalent for the same fixture inputs.

**Coverage:** included-only, free-only, billed-only, split PAYG, supported multi-source debit, duplicate admission, retry, full refund, partial refund, two concurrent identical actions, reset-window filtering, owner-linked legacy rows, and ambiguous legacy rows. Use real MySQL integration for identity/uniqueness/concurrency; SQL mocks alone cannot prove this fix.

## F5 — Accept the complete known LLM feature contract

**Primary files:** [llmProfileContract.ts](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/llmProfileContract.ts:83), its tests, and the existing [LlmFeature type](/home/andres/WebstormProjects/magic-worlds/src/shared/types/llm.types.ts).

Add `novel_assistant` to the maintained runtime feature contract and make the allowlist exhaustive against `LlmFeature`, using a small typed record or equivalent compile-time check. The same set validates profile compatibility and capacity usage, so test both consumers. Keep unknown-feature rejection, exact response shapes, and private-data rejection intact; do not accept arbitrary strings or drop features from the response to avoid the error.

**Coverage:** the captured complete response passes, every known feature is accepted, unknown/private/malformed values still fail, compatibility accepts `novel_assistant`, and the usage hook retains loading/error/reload and account-isolation behavior. The current negative probe must become a normal positive contract test; preserve its original evidence as historical evidence.

**Acceptance:** the consumer capacity meter renders the valid response. This does not enable the novel assistant or change BYOK admission, credentials, or pricing.

## F6 — Explain quota rejection without changing admission or retry

**Primary files:** [LLM admission](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py:568), [ProfileError/public_detail](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_profile_resolution.py:17) and its HTTP serialization consumers, [chat WS error mapping](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py:2728), [chatSocket.ts](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/chatSocket.ts), [useAdventureChatSocket.ts](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/hooks/useAdventureChatSocket.ts), and [InteractionCenterPanel.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:707).

1. Preserve current status codes and stable machine codes. Add a small allowlisted quota-detail contract explaining the exhausted included dimension(s), PAYG insufficiency when relevant, or the concurrency condition. These may coexist; do not pretend every rejection has one exclusive cause.
2. Derive details from the authoritative admission snapshot. Do not reconstruct the rejection from a later, potentially stale profile request. Expose only the quantities needed for useful copy and an authoritative reset time where available.
3. Serialize and validate those details through both HTTP AI-generation errors and WS chat errors. Preserve request/execution correlation, BYOK credential handling, and recovery metadata. Use a safe generic fallback for old or unknown quota payloads; never display raw provider exceptions or credentials.
4. Present an included request-limit explanation when credits remain but the included operation allowance is spent and the wallet cannot fund the request. Explain credit-budget, concurrency, and BYOK capacity failures separately. Payment controls remain outside this work.
5. Do not automatically retry or permanently disable manual Retry after a quota failure. Root can raise an allowance, as the audit demonstrated. A user-initiated retry must still pass current admission and retain existing idempotency/dispatch semantics.

**Coverage:** included requests exhausted with credits left and an empty wallet; sufficient PAYG still succeeds; included credits insufficient; both included dimensions exhausted; insufficient PAYG; in-flight capacity; BYOK capacity; unknown legacy error; and a genuine provider failure retaining its existing fallback. Assert no debit/reservation leakage on rejection. Test the existing retry-confirmation and workspace-terminal cases alongside the new quota copy, then repeat “root raises limit → manual Retry succeeds once.”

## F7 — Persist manual assignment history atomically

**Primary files:** [assign_user_plan](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py:796), [admin_membership.py](/home/andres/PycharmProjects/magic-worlds-api/src/routes/admin_membership.py), a scoped history table/migration, and the existing root API contracts.

1. Persist an append-only manual assignment event in the same transaction as a changed membership. Include server-generated event ID/time, authenticated actor identity/type, target identity, previous/new plan, reason, and the applicable existing scope context. Never trust client-supplied actor fields.
2. If the event cannot persist, roll back the assignment. A no-op assignment must not create a fictional plan-change event; repeated identical requests remain no-ops. Concurrent assignments must record a correct predecessor sequence.
3. Expose paginated root-only history retrieval for a member, with stable cursor ordering and a bounded page size. This supplies the missing audit contract without adding a new administration dashboard. Keep the console's reason-retention wording aligned with that contract.
4. Keep the existing application logger, but do not use it as the transaction's durable event. Do not fabricate pre-migration history or route automated subscription reconciliation through the manual-assignment endpoint.
5. Apply the existing membership/billing retention policy. `delete_all_user_data` keeps billing records and the account, so a content wipe should retain assignment history. Verify foreign-key behavior for any separate account-erasure path; do not introduce a new retention duration or silently block deletion. Document the history start date.

**Coverage:** changed assignment/event commit; event insert failure rolls back membership; no-op; repeated request; concurrent A→B→C history; authenticated actor/reason validation; inactive/missing plan; missing user; consumer denial; existing root scope behavior; pagination ties; content wipe; and the applicable account-erasure policy. Usage, balances, and paid-subscription state must remain unchanged.

## F8 — Correct display units and describe effective prices

**Primary files:** [MembershipSection.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/profile/components/MembershipSection.tsx), [UsageSection.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/profile/components/UsageSection.tsx:433), EN/ES locales, and [PlanEditorDialog.tsx](/home/andres/WebstormProjects/magic-worlds/src/features/admin/membership/components/PlanEditorDialog.tsx).

1. Replace the fixed “1 credit per action” claim with copy that reflects variable operation pricing. Where a specific chat/AI cost is shown, read the active plan's cost rather than using a default or introducing a second price table. Do not promise a fixed price for profile- or quantity-priced operations.
2. Choose monthly units using the operation's effective billing semantics, not whether `billable_seconds` happens to be numeric. Chat and AI show action counts; calls show their existing duration measure, including a legitimate zero. Do not relabel credit units as action counts. Preserve quantities versus requests for narration.
3. For root narration/call/preview rows, show the effective pricing source or a read-only unit description. Preserve stored credit-cost fields in the complete update payload so editing another limit does not reset legacy values. Keep request/concurrency/quantity controls that actually govern runtime behavior.
4. Leave narration quantity calculations, call duration pricing, preview free/cache policies, image-profile pricing, feature flags, and provider settings untouched. This is a truth-in-display change, not a voice repricing project.

**Coverage:** custom chat cost 3 / AI cost 2, zero/nonzero action counts with `billable_seconds: 0`, actual call seconds, narration labels, unknown-operation fallback, EN/ES, and current feature-flag states. Verify a root edit of a different limit submits all nine valid operation rows without changing preserved voice costs. Reuse the existing profile/admin component tests; run story typechecking only if stories are edited.

## Schema, rollout, and rollback gates

F1/F4 and F7 require separate review of persistence changes. Final field/table names and indexes belong in those implementation diffs. They must satisfy these gates before use:

1. Recheck current source fingerprints and local development changes before editing. Capture the actual current schema predecessor and preserve the ongoing novel/voice migration chain. Do not reset or reprovision an existing database to make bootstrap pass.
2. Update canonical `db.sql`, the exact bootstrap contracts/revision handling, and the repository's scoped migration tooling together. Verify a fresh disposable database and an upgrade from the actual predecessor, including row fingerprints for unrelated content, balances, usage, and execution history.
3. Define defaults and legacy-null behavior explicitly. Validate outstanding jobs/reservations before cutover. New and old writers must not run concurrently if one cannot record the accounting generation/identity correctly.
4. Do not assume an old server can restart on the additive schema. Prove a compatible rollback binary/schema contract or plan a forward repair that preserves the new records. Do not drop accounting/history columns as a routine rollback.
5. Test interrupted migration, rerun/check behavior, revision mismatch, and invalid input without a partial reported success. Run migration checks on isolated data; production application is a separate operational step.
6. Review the monthly aggregate query plan/indexes on representative isolated data. Avoid per-ledger or per-member N+1 lookups and unbounded history reads. Index additions must justify their write cost.

The implementation is not ready to ship merely because its unit tests pass. Unknown legacy accounting classification, unproven lock order, or failed predecessor-schema validation is a stop condition for the affected accounting slice.

## Coverage and completion criteria

### Evidence already available versus review reruns

The original audit recorded **441 passing tests**, a production typecheck/build pass, three strict-XFAIL accounting probes, and the browser/API evidence. Those results are retained; they were not all rerun during this planning review.

This review reran **97 frontend tests in 6 files** and **259 backend tests in 4 files**, all passing, plus the captured capacity-parser probe, which still confirms F5. See [review validation](review-validation.json) for exact commands and counts. No real provider, payment flow, live user mutation, migration, or new isolated-MySQL reproduction was run during this review. A build rerun is unnecessary for document-only changes; the implementation gates below still require it.

The passing baseline is evidence of existing behavior, not evidence that the eight findings are fixed. Existing tests exercise monthly reset filtering, split wallet debits, settlement priority/idempotency, and generic error recovery while missing the failing cross-path combinations.

### Targeted verification by layer

| Layer | Required coverage / existing suites to extend |
| --- | --- |
| Model and transaction contracts | `tests/models/test_membership_payg.py`, `test_membership_admin.py`; ordinary regressions for F1/F4; deliberate F3 window assertions |
| Settlement and recovery | `tests/services/test_turn_charge.py`, `test_preview_meter.py`, turn-charge workspace tests, existing wipe/preview tests; partial/full compensation and locking |
| Root/API security | `tests/routes/test_admin_membership.py`, `test_admin_billing.py`; root/consumer guards, strict plan maps, history transaction and read contract |
| Real database | Membership custom-plan, payer, LLM execution-admission, and turn-charge workspace integration suites; add deterministic reset races, action identity, and scoped migration upgrade tests |
| HTTP/WS quota errors | Existing `tests/test_chat_quota_errors.py`, admission integration, `chatSocket.test.ts`, `useAdventureChatSocket.test.tsx`, and `InteractionCenterPanel.test.tsx`; retain recovery/workspace cases |
| Frontend contract/profile | `llmProfileContract.test.ts`, `useLlmCapacityUsage.test.ts`, `UsageSection.test.tsx`, profile/admin membership tests |
| Persona entry points | New-chat, Landing/Gallery/Library/Calls tests, narrow provider validation, existing role-hint/creator tests, preserved adventure selection |
| Development neighbors | When shared admission/schema files change, run current novel-assistant/variant transport, workspace isolation, schema/migration, voice quota/call billing, narration, preview, and wipe suites relevant to those files |

Do not leave broad `xfail` wrappers around the corrected regressions. They can hide setup or unrelated SQL failures. Convert F1/F4 to normal failing-before/passing-after tests; update F3 to the explicit calculation-window contract. Keep database fixtures and setup assertions outside expected-failure handling. Use two database connections and deterministic barriers for concurrency cases rather than timing sleeps.

Backend database commands must use an explicitly disposable test socket/database, with no fallback to the configured application database. Use fake transports for provider-facing boundary coverage; no live payment, rendering, microphone call, or model spend is needed to prove the accounting fixes.

### Final focused E2E

Use synthetic test identities and a dedicated custom plan. Keep the original evidence/account available until the replacement evidence is reviewed.

1. Register a new consumer and confirm every root management endpoint remains forbidden to that consumer. Root creates the complete custom plan and assigns it with a reason; the history API returns the authenticated actor and correct plan transition.
2. Start with 12 included credits, AI cost 2 / one included request, chat cost 3 / two included replies, an empty PAYG wallet, and zero narration/call quantities. Confirm assignment and consumer display agree.
3. Generate one AI character: usage becomes 2. With no persona, show the explicit create-persona path, save a persona, and complete two replies: usage becomes 8. No invalid 422 start or extra debit occurs.
4. Reject an additional AI request and third included chat reply with actionable quota reasons. Preserve usage 8 and remaining 4. Verify rejected work leaves no active reservation or stuck retry state.
5. Root raises daily credits to 18 and chat allowance to 3. Usage stays 8. Consumer manually retries the failed reply once; usage becomes 11 and remaining 7, with persisted history and no duplicate charge.
6. Verify zero-cap narration rejection, correct monthly action labels, the working capacity meter, variable-price copy, and accurate root voice-pricing descriptions. Reopen/sign in again and verify account/workspace isolation.
7. In disposable MySQL, separately prove old-refund/partial-settlement/reset races, split PAYG one-action counts, both monthly calculation bases, and history rollback. Wallet funding is fixture data, not checkout. Do not run global quota resets against the shared development database.
8. Repeat occupied-plan deactivation and default-plan guards. Verify a valid adventure selection and the existing recovery/voice/wipe neighbors remain green. Record actual results and the limits of what was exercised.

### Definition of done

- Every finding has a linked focused change and an ordinary passing regression or an explicit contract/UI acceptance check.
- F1 has real-MySQL full-refund, partial-settlement, and concurrent-reset evidence; F4 has real-MySQL identity/count evidence with unchanged monetary totals.
- F3 exposes truthful windows and preserves calendar ledger consumption; unresolved legacy count/cutoff ambiguity is disclosed, never silently invented.
- F2 first chat succeeds from the no-persona state; F5 renders the captured valid contract; F6 permits the tested root-change/manual-retry flow.
- F7 history is durable, atomic, root-retrievable, and compatible with retention/wipe behavior. F8 changes display semantics without repricing operations.
- Relevant neighboring tests and `pnpm build` pass on the final combined source. Pre-existing unrelated failures are recorded separately, with before/after evidence; do not change developing features to silence them.
- Only the identified membership/plan issues and their necessary contracts, migrations, tests, translations, and documentation appear in the final diffs.

No product code, plan configuration, account state, or schema was changed by this review. Implementation and its acceptance evidence remain to be done.
