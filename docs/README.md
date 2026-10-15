# Documentation index

Reviewed against the local frontend and `magic-worlds-api` source on **2026-10-14**, with a [focused commit review on 2026-10-15](REVIEW_2026-10-14.md#commit-review-2026-10-15). Start with [feature status](FEATURE_STATUS.md) for availability and [the roadmap](ROADMAP.md) for remaining work. The [review record](REVIEW_2026-10-14.md) explains the evidence and validation limits.

The in-app `#/docs` page now has separate **Guide** and **Roadmap** views. Open `#/docs?view=roadmap` for the localized summary of 14 feature areas and the Novel Studio and Chara Studio phases; `section=` links to a specific section. The roadmap shows current foundations, build availability, next work and TBD decisions, with disabled and planned rows retained. The detailed engineering backlog remains in the Markdown dossiers below; update `src/features/docs/components/roadmapContent.ts` and both locales when it changes. A hosted site receives these views only after deploying the frontend change.

**WIP includes features disabled by their rollout gate even when their code exists.** A local opt-in, a passing test, a research proposal, and a deployed release are different facts. The status register records them separately. Historical documents and vendor research retain their original dates; their recommendations are not current product guarantees.

| Area | Current entry point | Reading guidance |
| --- | --- | --- |
| Novel / Story Studio | [Novel refactor](novel_refactor/README.md) | WIP default rollout; existing chapter editor versus proposed scene/revision/assistant architecture |
| Character image studio | [Chara Studio](chara_studio/README.md) | WIP proposal; existing portrait generation does not provide reference editing or a dedicated studio |
| Workspaces / Library | [Workspace R1](workspace_r1/README.md) | WIP default rollout; workspace transport is required even with the product flag off |
| Voices / calls | [Voice refactor](voice_refactor/README.md) | Native ElevenLabs implementation and remaining operational gates; earlier MiniMax plans are historical |
| LLM profiles / BYOK | [Profiles](llm_profiles/README.md) | Source implementation, historical execution log, and outstanding operational acceptance |
| Lorebooks / resources | [Lorebook plan](lorebook/README.md) | WIP default rollout; current implementation ledger precedes the original research plan |
| Assistants | [Assistant contract](app_assistant/README.md) | Three kinds (`card`, `lorebook`, `app`), frontend and backend gates; no novel assistant kind |
| Billing / membership | [Billing setup](billing/SETUP.md), [membership review](membership-management-review.md) | Purchase UI has its own frontend gate; pricing research is a dated proposal |
| Card enrichment | [Card research](cards_enrich/README.md) | Existing item support and still-proposed enrichment work |
| Card PNG export | [HTML rendering](html2img/README.md) | Existing export pipeline versus broader rendering research |
| Streaming / chat media | [Text streaming](interactive-text-streaming.md), [chat images](chat-image-websocket-delivery.md) | Implemented transports; availability follows each owning feature |
| Historical backend issues | [Issue register](issues/README.md) | June reports reconciled with current message and session contracts |
| Security | [Credential audit](security/secret-resolution-audit-2026-10-11.md) | Bounded October audit; remediation and deployed verification must be tracked separately |
| Writing research | [Storytelling](story_telling/README.md) | Research input to the novel plan, not a feature list |
| UI reviews | [September consolidation](ui-audit-2026-09-19.md), [UX backlog](ui-ux-review-2026-09-05.md) | Dated fixture/source evidence; does not prove current rollout or live accessibility |
| Monitoring notes | [Historical monitor workflow](monitor.md) | Tool-specific operational history, not a built-in app monitoring feature |

When updating a feature document, record the review date, source paths, gate behavior, implemented subset, gaps, and acceptance evidence. Put unresolved scope decisions in the roadmap with `TBD`; do not leave a target design headed “current state.”
