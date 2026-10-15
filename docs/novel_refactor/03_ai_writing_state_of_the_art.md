# AI writing state of the art and design implications

**Documentation review:** 2026-10-14. **Status:** Dated research reference — design inspiration and unvalidated application proposals; no new model benchmark. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

Original research cutoff: 2026-10-14; external references were retained without a fresh literature/vendor review in this documentation update. Here, state of the art describes the dossier's combination of document-aware interaction, structured story memory, controlled editing, multi-step assistance, and task-specific evaluation. It does not mean that one model or vendor has been proven best for complete novels, or that these patterns are all implemented in Magic Worlds.

## Current capability patterns

| Pattern | Product/research evidence | Proposed application |
|---|---|---|
| Document-aware conversational work | Story-aware chat and planning/edit modes in contemporary fiction products; see [02](02_competitive_landscape.md) | Ask questions, discuss choices, retrieve evidence, and propose changes within novel scope |
| Structured plans plus incremental drafting | Re3 and DOC | Plan or revise a scene goal, then draft manageable passages with state updates |
| Adaptive rather than fixed workflows | WriteHERE | Let the author alternate researching, outlining, drafting, and revising without a mandatory wizard |
| Rich character memory | CHIRON | Evidence-backed character sheets, knowledge, dialogue traits, goals, and temporal facts |
| Reviewable editor operations | Current TipTap/BlockNote tooling | Typed document changes rather than unstructured prose pasted from chat |
| Human involvement in revision | Interaction-required suggestions and CoAuthor | Deliberate acceptance, alternatives, and edit retention as product outcomes |
| Feature-specific critique | CraftAlign, an emerging 2026 preprint | Explain pacing, information release, repetition, and causal structure through evidence-linked feedback |

## Research findings and their limits

### Re3: plans and recursively refreshed story state

Re3 generates longer stories through overarching planning, repeated context injection, and revision. Its relevant contribution is an architecture for preserving intent and state across successive passages. Its experiments are not evidence of quality for current 100,000-word manuscripts or a live authoring UI. [Re3, EMNLP 2022](https://aclanthology.org/2022.emnlp-main.296/)

Inference for Reverie: keep a structured plan and a revision-bound account of what has actually happened. Refresh relevant memory as the author changes prose. An outline and draft may diverge intentionally, so do not silently overwrite either to force agreement.

### DOC: detailed outline control

DOC combines hierarchical outlines with a controller that checks alignment during generation. The paper reports improved coherence and controllability against its studied baseline for several-thousand-word stories. [DOC, ACL 2023](https://aclanthology.org/2023.acl-long.190/)

Inference: scene purpose, events, characters, and constraints should be explicit generation inputs. Offer outline adherence as an author choice. A discovery writer may want exploration rather than strict adherence.

### CHIRON: richer character representations and validation

CHIRON builds character sheets from textual evidence, then filters unsupported facts through a validation stage. Its evaluated tasks concern character representation, not a production guarantee that an assistant prevents every continuity error. [CHIRON, Findings of EMNLP 2024](https://aclanthology.org/2024.findings-emnlp.499/)

Inference: preserve nuanced prose descriptions alongside structured facts. Extracted character knowledge should include source passages, uncertainty, and review status. Promote approved facts into canon explicitly.

### Long context requires evaluation of information use

Lost in the Middle demonstrates position-sensitive retrieval in the models and question-answering tasks it studied. It does not establish identical behavior for every 2026 model or directly test literary voice. [TACL 2024](https://aclanthology.org/2024.tacl-1.9/)

Inference: test information at the beginning, middle, and end of manuscript packets. Compare full-text context with focused retrieval and summaries. A larger input window does not replace relevance selection, chronology rules, or verification.

### WriteHERE: adaptive recursive work

WriteHERE interleaves retrieval, reasoning, and composition through recursive task decomposition and evaluates fiction and technical writing. Its automatic metrics do not replace author preference or demonstrate superiority in this application's workflows. [EMNLP 2025](https://aclanthology.org/2025.emnlp-main.1254/)

Inference: allow bounded multi-step plans with visible progress and resumable work. Begin with a single controller and explicit task types; add parallel workers only when evaluations show a benefit worth their cost and complexity.

### StoryWriter: event planning and compressed history

The 2025 StoryWriter preprint separates outlining, event/chapter planning, and drafting with compressed history. It reports human and automated evaluation and a generated dataset averaging roughly 8,000 words. Treat it as a research reference, not a tested recipe for an entire commercial novel. [StoryWriter](https://arxiv.org/abs/2506.16445)

Inference: track causal events and plot threads, not just chapter summaries. Compression must remain connected to original evidence and refresh when the underlying text changes.

### Author involvement and ownership

The 2025 interaction-required suggestions paper presents revision interaction techniques and analyzes a case study; it argues for engagement and fine-grained control rather than proving universal gains. [In2Writing 2025](https://aclanthology.org/2025.in2writing-1.6/)

CoAuthor records human/model interaction across short English writing sessions. It supplies a research interface and dataset useful for studying requests, accepted suggestions, and subsequent editing, with a much smaller scale than full novels. [CoAuthor](https://coauthor.stanford.edu/)

Inference: measure whether writers keep and adapt suggestions, can explain changes, and feel ownership. Avoid treating acceptance rate alone as quality: accidental acceptance can inflate it.

### CraftAlign: emerging revision guidance

CraftAlign, submitted in August 2026, describes explicit narrative/style feature estimation and revision guidance. This is a recent preprint with reported experiments, not a validated universal standard of literary merit. [CraftAlign](https://arxiv.org/abs/2608.01377)

Inference: critique should identify concrete passages and plausible revision strategies. Do not label authors' prose as objectively inferior, use an AI-detection score as an editorial gate, or flatten deliberate genre/style choices.

## Proposed assistant capabilities

The assistant should support the entire writing process with the following task families:

1. **Ideation:** premise alternatives, character motives, settings, stakes, conflict, titles, and exploratory what-if branches.
2. **Planning:** synopsis, parts/chapters/scenes, beats, subplot placement, POV distribution, timeline, and outline alternatives.
3. **Drafting:** continue at cursor, bridge passages, expand a beat, write dialogue, sensory description, and alternative takes.
4. **Line editing:** tighten, expand, clarify, vary rhythm, adjust tense/POV, preserve voice, translate, and correct grammar with a reviewed diff.
5. **Developmental editing:** pacing, cause/effect, setups/payoffs, character motivation, exposition, scene purpose, and narrative distance.
6. **Continuity:** character knowledge, injuries, locations, relationships, possession of objects, chronology, and world rules.
7. **Knowledge work:** search manuscript and approved research, quote relevant passages, extract potential canon, and answer questions with references.
8. **Structural work:** propose splitting, moving, duplicating, adding or merging units, with a reviewable plan and atomic changeset.
9. **Editorial workflow:** add draft comments, create revision tasks, summarize reviewed issues, and assist with approved resolutions.
10. **Delivery:** chapter/book summaries, synopsis, blurb alternatives, glossary, continuity/style sheets, and export preparation.

These are the full target families, not a claim that every command should be visible in the first toolbar. See [05](05_feature_catalog.md) for concrete capabilities.

## Model and workflow selection

Use the existing published-profile system. Evaluate models per task and manuscript language instead of hardcoding a provider into the novel feature. Separate the roles for prose, planning, retrieval, critique, summarization, and fact extraction when the existing execution planner can authorize and account for them.

Compare at least these configurations using the same fixtures:

- A strong single-model request with focused context.
- A writer request plus deterministic validation.
- A bounded plan → draft → critique sequence.
- Retrieval with verified summaries versus full-text context.
- An optional specialized helper when it improves an identified task.

Score target accuracy, instruction adherence, continuity, author voice, edit usefulness, latency, and total execution cost. Freeze profile/graph revisions and context source revisions so results can be compared. Critic scores are advisory; deterministic contracts and author review decide application.

## Product implications

The recommended SOTA-inspired approach is a **grounded, revision-aware writing partner** with typed tools and visible control. It can act on a selection or a reviewed multi-scene plan, cite evidence for story questions, and maintain derived memory without silently inventing canon. It adapts to the author's workflow while preserving a fast ordinary editor.

Avoid a monolithic generate-the-whole-book operation as the central UX. Whole-book assistance belongs in bounded planning, analysis, and reviewed batch operations. Expose uncertainty and let the author choose among plausible creative directions. The exact model ranking, cost envelope, and quality thresholds require the evaluation in [12](12_validation_and_acceptance.md).
