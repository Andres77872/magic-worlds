# Research and best practices

## Research method and limits

Primary sources were reviewed on 2026-10-19. The selection covers established roleplay lorebooks, retrieval research relevant to document resources, and the two concrete security concerns found in this implementation. Community anecdotes and search-result summaries are not treated as product requirements.

The source observations below are distinct from project recommendations. Competitor behavior is useful design evidence, not a compatibility standard. No source establishes the correct defaults, model, chunk size, latency target, or budget for Magic Worlds. Those need the project's own evaluation.

No external article or documentation page is copied in full. Vendor experiments are not forecasts for this application.

## Source register

| ID | Primary source | Kind | Why it is relevant |
|---|---|---|---|
| S01 | [SillyTavern: World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) | Maintainer documentation; rolling | Comparable dynamic roleplay context activation |
| S02 | [NovelAI: Lorebook](https://docs.novelai.net/en/text/lorebook/) | Product documentation; rolling | Entry authoring, recent context, placement, and portability |
| S03 | [Anthropic: Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) | Vendor engineering research | Resource chunk context and retrieval evaluation |
| S04 | [OWASP: LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Security guidance | Imported content and model trust boundaries |
| S05 | [OWASP: Regular expression Denial of Service](https://community.owasp.org/attacks/Regular_expression_Denial_of_Service_-_ReDoS) | Security guidance | User-controlled synchronous regex |

All links were accessed for this audit. Recheck rolling documentation before implementing an external-format adapter or adopting a platform-specific feature.

## S01 — Comparable activation controls

SillyTavern documents recent-message scan depth separately from recursion limits, context budgeting, matching controls, and timed effects. It explains that activation can be excluded when budget is exhausted. Its ordering rules distinguish constant and directly triggered entries from recursive activations. Timed effects include sticky, cooldown, and delay behavior. It also describes optional vector matching while retaining additional activation checks. Source: [World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/).

**Project interpretation:** the current scanDepth overload and implicit combined-book policy should be made explicit before adding more retrieval modes. Decide each stage independently. Do not import competitor numeric defaults or assume advanced probability/group controls are needed.

**Applicable findings:** F01, F03, F04, F09, F12. Related backlog: G02, G07, G09.

## S02 — Entry quality and authoring

NovelAI documents entries activated by keys in recent context. Its title is organizational rather than automatically sent to the model, so the content should identify the subject. Its tools include search, duplication, multi-selection, and lorebook interchange. Advanced controls expose placement, budgets, reservation, and trimming choices. Source: [Lorebook](https://docs.novelai.net/en/text/lorebook/).

**Project interpretation:** make an entry understandable on its own, disclose inclusion/exclusion, and offer manageable authoring for larger books. Keep Magic Worlds' native semantics explicit; an adapter must report conversion loss rather than imply identical behavior.

**Applicable findings:** F08, F09, F11, F16. Related backlog: G05, G06.

## S03 — Resource retrieval

Anthropic's contextual-retrieval work investigates adding chunk-specific context, combining lexical and embedding retrieval, and reranking. It evaluates retrieval failures using relevant chunks missed from the returned set and emphasizes evaluation on the use case. Its experiments include fiction among other domains. Source: [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval).

**Project interpretation:** preserve resource identity, section, and entity context with each chunk. Compare a lexical baseline against any semantic candidate. Do not assume published improvement percentages, top-k values, chunk sizes, or specific embedding vendors will transfer to this project.

**Applicable findings:** F03, F08, F17. Related backlog: G04, G07, G08.

## S04 — Imported content and model instructions

OWASP identifies external files/web content as an indirect prompt-injection channel and recommends separating untrusted material, limiting privileges, validating output, and adversarial testing. It does not claim that prompt wording provides a complete prevention mechanism. Source: [LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).

**Project interpretation:** distinguish author-approved instructions from imported reference facts. Structural extraction validation and freshness hashes do not prove faithfulness. Test attempted instruction laundering through summaries and snippets; do not infer a demonstrated exploit from the current source review.

**Applicable findings:** F04, F07, F16. Related backlog: G04, G08.

## S05 — Regex

OWASP explains that backtracking regular expressions can take disproportionate time on crafted input, including patterns supplied by users. Source: [ReDoS](https://community.owasp.org/attacks/Regular_expression_Denial_of_Service_-_ReDoS).

**Project interpretation:** constrain the dialect and execution cost on both sides of the wire. Compilation success and a browser worker are not server-side execution bounds. Preserve local safety by testing hostile cases only in isolated processes with a deadline.

**Applicable finding:** F05.

## Project best-practice checklist

These are recommendations derived from the audit, not declarations of completed implementation.

| Principle | Recommended application | Evidence to require |
|---|---|---|
| One activation policy | Shared policy identity and fixtures across live generation and previews | Same candidate decisions and rendered context for equal inputs |
| Separate retrieval stages | Resolve, authorize, scan, evaluate gates, recurse, rank, budget, place, trace | Each exclusion has a stable reason |
| Deterministic selection | Explicit scope/priority/tie rules; no dependence on incidental SQL timestamps | Reordered inputs preserve decisions |
| Bounded work | Limits on books, entries, keys, regex, scan text, recursion, and prompt size | Resource-exhaustion fixtures and execution deadlines |
| Recent-scene continuity | A named history-window policy with branch/edit behavior | Multi-turn follow-ups and assistant-introduced entity cases |
| Context integrity | Keep a fact and its conditions together; identify its subject | Author-reviewed gold fixtures |
| Model-aware budget | Account for complete serialized context and reserve output | Captured request accounting with labeled fallback |
| Reliable authorship | Revision checks, dirty recovery, lossless snapshots | Delayed-response and multi-client scenarios |
| Explicit knowledge policy | Reveal/audience gates independent of keyword or constant activation | No disallowed secret in the selected generation packet |
| Source provenance | Versioned source anchors and reviewable generated changes | Each accepted claim can be inspected against its source |
| Honest UI | Mention markers differ from actual activation; stale traces are marked | Session/preview/turn inspector agreement |
| Permission-first retrieval | Owner/workspace/feature checks apply to every source and derivative | Non-root grant combinations, revocation, and negative scope cases |
| Native portability | Versioned lossless native export; bounded adapters with loss reports | Round-trip and malformed-file fixtures |
| Measured expansion | Semantic retrieval and ranking evaluated against a fixed baseline | Quality, latency, and cost results before rollout |

## Authoring guidance to prototype

Use short, independently useful entries with the entity name in the content. Keep immutable canon separate from scene state. Prefer distinctive aliases over generic keys; use secondaries to disambiguate. State exceptions together with the facts they qualify. Use constant mode only for material that deserves persistent context cost, and make disclosure policy explicit.

An illustrative entry might say:

> The Glass Market opens only after moonrise. Its traders refuse unsealed silver. These rules apply inside the market, not throughout the city.

This is an original synthetic example. Its desired triggers and exclusions belong in evaluation fixtures. Do not claim a universal entry length threshold; choose warnings from actual budget usage and task quality.

## Research questions still open

- Does short-window lexical retrieval sufficiently handle the application's real follow-ups?
- Which actor's knowledge should constrain narrator and character replies?
- Are resources mostly reference documents, authorial rules, or GM-only scenario material?
- Which languages and normalization rules need explicit support beyond English and Spanish?
- What proportion of books needs semantic recall after alias/key quality improves?
- What are typical and high-percentile book, entry, and source-text sizes?
- How much edit/review burden will extraction approval introduce?
- Which interchange format has actual user demand?

Record answers as decisions or measured research, not assumptions embedded in code.
