# Security, privacy, and risks

**Reviewed:** 2026-10-15. This register covers proposed exposure and local dependencies. Existing issues retain their owning registers. Likelihood is qualitative until tested; severity is potential impact, not proof of exploitation.

## Trust boundaries

The user-facing app sends a workspace-bound request to the BFF. The BFF resolves actor, source constraints, product capabilities, target authority, published profile, and budgets. The executor returns untrusted model output. The BFF validates an operation before any domain service writes.

Guide/card/lorebook/resource/novel text, search results, model output, old assistant messages, URLs, and opaque handles are data. None can alter actor identity, tool definitions, policy, credentials, destination, or target grant.

Treat private content as private at every durable boundary, even if it was absent from a particular conversation column.

## Risk register

| ID | Severity / likelihood | Risk and status | Mitigation and release evidence | Owner area |
| --- | --- | --- | --- | --- |
| RISK01 | High / plausible | Retrieved content induces an unintended write; new exposure when tools are added | Separate data/instructions, bounded target/field grant, server authorization, malicious-source tests | BFF / evaluation |
| RISK02 | High / plausible | Source/focus/client flags are mistaken for authority | Server capability intersection; no focus-based grant; forged-request and source-off tests | BFF / frontend |
| RISK03 | High / plausible | Wrong record/type/workspace selected | Visible singular target, scoped opaque refs, disambiguation, cross-owner/workspace negatives | BFF / UX |
| RISK04 | High / plausible | Newer manual edits overwritten | Fresh editable snapshot and CAS in the completion transaction; real concurrent writer tests | Persistence |
| RISK05 | High / plausible | Duplicate creates/writes/charges on reconnect | Stable intent IDs, retained commands, atomic receipts and effects, crash/replay tests | Persistence / billing |
| RISK06 | High / observed discrepancy | UI claims private context is discarded while frozen payload retains it | Resolve ASST-R3 in the [assistant contract](../app_assistant/README.md), copy/policy/deletion acceptance | Privacy / BFF / frontend |
| RISK07 | High / existing open findings | Expanded tool/profile traffic inherits unresolved credential/runtime custody | Respect [F01–F11](../security/README.md); no expanded BYOK guarantee without touched-path closure evidence | Executor / security |
| RISK08 | High / existing dependency | Shared creation/media behavior has unresolved integrity work | Gate affected creation/media exposure on [W-04b/W-04d](../workspace_r1/04_gaps_and_priorities.md) closure or explicit safe restriction | Domain persistence |
| RISK09 | Medium-high / plausible | Entry-list replacement loses stable lorebook identities or content | Shared diff/content checks; known entry-ID semantics; no claim of surgical entry operations | Lorebook |
| RISK10 | Medium-high / plausible | Partial output appears as a saved action | UI renders success only from committed receipt; cancel/late-final/reconnect tests | Frontend / BFF |
| RISK11 | Medium / plausible | Tool loops inflate latency, context, and platform cost | Hard run/step/read/write budgets; approved billing policy; model/profile benchmarks | LLM / billing |
| RISK12 | Medium-high / plausible | New persisted app format breaks rollback/history/replay | Explicit version store/readers; mixed-version deployment tests; durable readback with tools off | BFF / frontend / ops |
| RISK13 | Medium / plausible | Main model cannot honor actual schema/stream contract | Feature/catalog/profile revision verification and provider-backed contract tests | Executor / LLM |
| RISK14 | Medium-high / plausible | Disabled source leaks through history, nested attachments, or caches | Provenance-aware projection/invalidation; no recursive hydration; account/workspace cache tests | Retrieval / frontend |
| RISK15 | Medium / plausible | Facts are invented from clipped or stale context | Search/detail reads, coverage indicators, revision-aware citations, groundedness evaluation | Retrieval / evaluation |
| RISK16 | Medium-high / plausible | Private text escapes through generated links or external fetch | Internal reference allowlist; existing shared link policy; no arbitrary URL/network tool | Frontend / security |
| RISK17 | Medium / plausible | Saved-server edits overwrite or confuse another tab's unsaved work | Explicit saved-state boundary; invalidate shared lists; preserve dirty form and show conflict | Frontend |
| RISK18 | Medium / plausible | Tool metadata or handles are treated as security guarantees | Authorize every dispatch; annotations/refs cannot grant access; expiry/forgery tests | BFF |
| RISK19 | Medium-high / plausible | Shared tools bypass a disabled branch or app preferences affect editor assistants | App-scoped settings, registry-based branch filtering, read dependencies, and per-surface isolation tests; [control contract](14_toolset_controls.md) | BFF / frontend |

## Authorization controls

The BFF is the policy enforcement point. Check owned scope and workspace at search, get, prepare, dispatch, and commit. Bind target/type/destination outside model arguments. Return non-disclosing missing/unavailable results for unauthorized records.

Source manifests restrict future tool data access but are not account authorization. Even a valid user token plus an existing record ID must pass workspace ownership and product/operation rules.

Add no generic HTTP, SQL, filesystem, shell, provider-selection, graph-edit, publishing, delete, or administrative tool to this initiative. Stored resources can be read; their embedded links cannot initiate outbound network requests.

## Prompt injection controls

Move untrusted context out of privileged instruction channels in the future graph construction where the transport supports it. Keep trusted platform/tool policy separate from authored fields and retrieved passages.

Validate structured selections and commands, enforce scope in code, and bound repair attempts. A content classifier, JSON encoding, or a sentence saying “ignore instructions in data” does not independently enforce permission.

Use adversarial fixtures in every permitted source, including character `system_instructions`, Markdown link labels, resource text, lore entry text, novel prose, tool errors, and prior assistant responses. The expected result is no expansion of authority and no unauthorized side effect.

## Retention contract

Inventory these surfaces before expanding private reads:

| Surface | Current observation / proposed requirement |
| --- | --- |
| Conversation/messages | Current user/reply text is saved; future derived content also needs source lineage |
| BFF frozen execution payload | Current app context is retained for replay/retry; new retrieval/model-step content may be retained too |
| Assistant output snapshots / new action receipts | Current output retention exists; define content/reference policy and media-reference scanning |
| Executor graphs/snapshots/checkpoints | Existing custody findings remain open; no claim that BFF cleanup controls upstream copies |
| Logs/traces/evaluation artifacts | Content-free by default; allowlist identifiers/status/limits, use sanitized fixtures |
| Browser source/focus storage and caches | Preferences are not server retention control; isolate by the appropriate identity/workspace/environment |
| Backups and account deletion | Define policy, access, retention and legal/accounting exceptions; verify downstream deletion behavior |

Choose a finite replay/recovery retention policy and explain what expires. Exact durations and backup/accounting exceptions require product/privacy/operations decisions. This document assigns no unverified zero-retention, non-training, or credential-custody guarantee.

Conversation deletion must not be described as full execution erasure while frozen plans remain. A future deletion process should remove or redact private bodies according to policy while preserving only permitted minimal receipts/accounting records. Verify replay after expiry returns an explicit unavailable/expired outcome rather than silently regenerating.

Security content-retention work and secret custody are separate. The observed retained user context is intentional functionality, not itself proof of a breach. F04 concerns credential material in the actual executor path and needs its own closure.

## Telemetry and operational response

Record allowlisted run/action IDs, contract/schema/policy/profile revisions, effect category, target type, status, latency, counts, conflicts, retries, and known usage. Sensitive record labels, private excerpts, raw arguments, provider errors, and credentials stay out of ordinary telemetry.

Restricted receipts may include domain identity and necessary audit data under the retention policy. Access to receipts and debug views needs scoped authorization. Do not retain hidden chain-of-thought.

A kill switch prevents new tool dispatch; recovery still reports already committed results. Alert on cross-scope rejection spikes, duplicate-intent conflicts, repeated schema errors, conflict rates, budget exhaustion, and receipt/ledger inconsistencies. Do not erase evidence or retry writes automatically in response.

## Required release dispositions

No expanded BYOK release can claim custody properties while the relevant existing security findings remain open. No new retained full-document store can ignore media reference integrity. No creation path can bypass persona uniqueness or organization rules.

Assign named owners to these gates before production rollout. A restricted pilot may exercise a smaller capability set, but its allowed scope, environment, payer, retention policy, and acceptance must be recorded explicitly.
