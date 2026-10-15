# Storytelling and creative writing research — WIP

**Documentation review:** 2026-10-14. **Actual status: WIP — implemented foundation behind a frontend flag; expanded authoring workflows are planned.** [`.env.example`](../../.env.example) disables novels by default with `VITE_FEATURE_NOVELS_ENABLED=false`; the reviewed local `.env` enables them. Only exact `true` enables the feature. Production availability is unverified. This is a historical June 2026 product brief, reconciled below with current source. Its vendor/package research was not refreshed by this update.

## Actual implementation and precedence

The current writing surface is the TipTap-based [NovelStudio](../../src/features/novel/components/NovelStudio.tsx), with a [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), chapter rail, inline AI generation, Codex snapshots, and generated-output history. The [current DTOs](../../src/shared/types/story.types.ts) use **Story → StoryChapter with a Markdown body**, rather than the `StoryScene` examples below. [featureFlags](../../src/shared/featureFlags.ts), [Sidebar](../../src/ui/components/Sidebar.tsx), [AppRouter](../../src/app/router/AppRouter.tsx), and the [API client](../../src/infrastructure/api/index.ts) gate the feature. Disabled navigation is hidden and direct routes render Not Found; a WIP placeholder is not current UI behavior.

Use the [novel refactor status and roadmap](../novel_refactor/14_status_and_roadmap.md) for current delivery status, the [source audit](../novel_refactor/01_current_state_and_evidence.md) for implementation evidence, and the [issue register](../novel_refactor/10_issues_gaps_and_risks.md) for the open reliability work. The newer dossier defines the expanded single-author novel target. Historical MVP scope, textarea advice, package alternatives, proposed scenes, and phase names below must not be interpreted as the current application contract or completed work.

| Area | Actual state on 2026-10-14 | Remaining work |
|---|---|---|
| Stories/gallery and routes | Implemented, gated `gallery-stories` and `story` routes | Disabled/release UX decision and live BFF readiness remain unverified |
| Editor | TipTap 3 with chapter Markdown persistence, basic formatting, mentions, beats, Find/Replace, focus/typewriter | Fidelity, stable reference IDs, Unicode offsets/counts, accepted-rewrite undo |
| Sources | Create modal supports blank or card; DTO/BFF also accepts adventure-session source | No session-history picker; character-chat/lorebook source kinds from this brief are absent |
| AI | Inline continue/rewrite/expand/condense/describe/critique/custom, streaming candidate review | Cursor grounding, flush/accept durability, explicit acceptance intent and review diff |
| Codex | Story-local snapshots, including selected lorebook entries | Story-to-card updates, temporal canon, appearances and source-update impact review |
| Context/stash | Preview/stash endpoints and client methods exist | Prospective preview and dedicated stash UI, enforced budget and truthful trace |
| Recovery/history | In-memory draft with autosave/retries/guards; generation history | Durable drafts, chapter CAS, manuscript revisions, trash/restore |
| Long-form organization and chat | Chapter create/select/rename/delete | Independent scenes/parts, reorder/split/merge, novel-bound conversational assistant |
| Delivery | Individual AI output can be copied | Complete manuscript import/export, DOCX/EPUB/PDF and revision manifest workflows |

Focused verification: `pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts` passed **27 files / 211 tests (6.52 seconds)**. This does not close the open findings or establish end-to-end/backend/model/accessibility acceptance.

## Current roadmap

| Phase | Status | Gap / exit gate |
|---|---|---|
| Availability | **WIP** | Confirm enabled/disabled behavior and deployed client/BFF/profile versions; decide disabled WIP UI |
| D1 reliability | **WIP, partial implementation** | Ordered revision-checked saves, draft recovery, undo/acceptance/selection/context correctness and accessible failure states |
| D2 organization | **Planned** | Versioned scene documents/structure, metadata, move/split/merge/trash/history; lossless migration and old-client protection |
| D3 assistant | **Planned** | Novel kind and grounded context, reviewable proposals and idempotent revision-bound application |
| D4 planning/review | **Planned** | Timeline/board/matrix, continuity evidence, personal notes/tasks and derived-memory invalidation |
| D5 portability | **Planned** | Supported import/export formats, conversion reports and frozen revision manifests |
| D6 series/extension | **Planned** | Versioned author-owned canon/overrides and bounded extensions |

Named owners, dates, canonical schema/anchors, retention/offline policies, exact format scope, and quality thresholds are **TBD** in the [decision register](../novel_refactor/13_sources_and_open_decisions.md). Multi-user collaboration is excluded from the current target, not a deferred phase.

## Purpose

This original research defines how Magic Worlds could add a creative writing surface
without becoming a separate novel-writing startup. The feature should let a user
write prose with AI while using the app's existing cards as the story codex:
characters, worlds, adventure templates, lorebooks, session snapshots, triggers,
and generated media should become usable writing context instead of sitting in a
separate project system.

The product direction is:

1. Keep Magic Worlds as an AI storytelling and RPG creation app.
2. Add a **Story Studio** feature for drafting scenes, chapters, vignettes, and
   adventure writeups from existing Magic Worlds cards.
3. Treat cards and lorebooks as the user's codex, not as content that must be
   recreated in a new "book database."
4. Treat AI as a reversible collaborator: draft, continue, rewrite, critique,
   extract, and update cards only after explicit user review.
5. Avoid competing directly with Scrivener, Reedsy Studio, Ulysses, or full
   publishing workflows in the MVP.

The original brief records an external-source review on June 11, 2026. Current implementation was reviewed on October 14, 2026; external vendor claims below remain a dated research snapshot.

## Research Sources

Primary and product sources:

- Sudowrite home: https://sudowrite.com/
- Sudowrite Chat: https://sudowrite.com/features/sudowrite-chat
- Sudowrite Plugins: https://sudowrite.com/features/plugins
- Novelcrafter home: https://www.novelcrafter.com/
- Novelcrafter Codex: https://www.novelcrafter.com/features/codex
- Novelcrafter all features: https://www.novelcrafter.com/features
- NovelAI text generation docs: https://docs.novelai.net/en/text/
- NovelAI editor docs: https://docs.novelai.net/en/text/editor/
- NovelAI writer's toolbox: https://docs.novelai.net/en/text/editor/writerstoolbox/
- NovelAI text adventure mode: https://docs.novelai.net/en/text/textadventure/
- Campfire home: https://www.campfirewriting.com/
- Campfire writing software: https://www.campfirewriting.com/write
- Campfire word processor: https://www.campfirewriting.com/word-processor
- World Anvil home: https://www.worldanvil.com/
- LivingWriter home: https://livingwriter.com/
- Plottr home: https://plottr.com/
- Reedsy Studio: https://reedsy.com/studio/write-a-book
- Ulysses: https://ulysses.app/
- Scrivener background and feature summary:
  https://en.wikipedia.org/wiki/Scrivener_%28software%29
- NN/g progressive disclosure:
  https://www.nngroup.com/articles/progressive-disclosure/
- Microsoft HAX guidelines:
  https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Tom's Guide long-form AI writing comparison:
  https://www.tomsguide.com/ai/writing-a-novel-in-2026-heres-why-chatgpt-alone-wont-get-you-to-the-finish-line

Interaction and package sources:

- Lexical: https://lexical.dev/
- Tiptap editor docs: https://tiptap.dev/docs/editor/getting-started/overview
- ProseMirror guide: https://prosemirror.net/docs/guide/
- CodeMirror: https://codemirror.net/
- Slate docs: https://docs.slatejs.org/
- React Aria: https://react-aria.adobe.com/
- Radix Primitives: https://www.radix-ui.com/primitives
- Floating UI: https://floating-ui.com/
- dnd kit: https://dndkit.com/
- TanStack Virtual: https://tanstack.com/virtual/latest
- cmdk: https://github.com/dip/cmdk
- react-resizable-panels:
  https://github.com/bvaughn/react-resizable-panels
- jsdiff: https://github.com/kpdecker/jsdiff
- XState: https://stately.ai/docs/xstate
- Yjs docs: https://docs.yjs.dev/

Local Magic Worlds sources:

- `README.md`
- `docs/lorebook/README.md`
- `src/shared/types/character.types.ts`
- `src/shared/types/world.types.ts`
- `src/shared/types/adventure.types.ts`
- `src/shared/types/aiCard.types.ts`
- `src/shared/types/lorebook.types.ts`
- `src/features/creation/common/components/assistant/`
- `src/features/interaction/components/AdventureCardDrawer.tsx`
- `src/features/lorebook/components/LorebookStudio.tsx`
- `src/app/router/AppRouter.tsx`

## Executive Read

The market has converged on a few patterns:

- **The manuscript stays central.** Strong writing tools make the draft the main
  surface and keep outline, notes, goals, cards, and AI in side panels or
  context menus.
- **Cards/codex matter more than raw chat.** Novelcrafter, Campfire, Plottr,
  World Anvil, LivingWriter, and Scrivener all solve continuity by structuring
  people, places, objects, notes, timelines, and metadata. AI writing tools work
  better when those structures feed model context.
- **AI must be close to the text.** Sudowrite, NovelAI, LivingWriter, and
  Novelcrafter all put AI actions beside the manuscript: continue, rewrite,
  expand, condense, summarize, analyze, chat, and extract structured story data.
- **Reversibility is a core trust feature.** AI edits need preview, undo,
  history, explicit "allow edits" style permissions, and clear provenance.
- **Planning should be optional.** Plottr and Novelcrafter support deep planning,
  but Sudowrite succeeds by helping intuitive writers keep momentum. Magic
  Worlds should not require a book outline before the user can write a scene.
- **Context transparency is a differentiator.** Novelcrafter exposes prompt
  components and prompt preview; NovelAI exposes edit history, context, and
  generation controls. Magic Worlds should show which cards and lore entries
  are being used before AI writes.

The Magic Worlds opportunity is not "build Scrivener with AI." It is:

> Let users turn their cards, adventures, worlds, character chats, and lorebooks
> into authored prose with an AI assistant that can see the same card codex the
> app already uses for play.

## Product Fit

Magic Worlds already has the hard parts that many writing tools ask users to
build from scratch:

- Character cards with descriptions, greetings, system instructions, attributes,
  triggers, portraits, and theme songs.
- World cards with setting descriptions, attributes, triggers, and media.
- Adventure templates with persona, cast, world, scenario, attributes, triggers,
  and generated media.
- In-progress adventure snapshots that isolate session edits from library cards.
- Character chats and adventure sessions that already produce narrative turns.
- Lorebook types and a Lorebook Studio surface for structured prompt retrieval.
- Reusable assistant conversations, streaming, request reconciliation and
  document-target version metadata. Current BFF card/lorebook tool handlers can
  apply document writes during assistant execution; a proposal-only acceptance
  contract for manuscript/card changes needs deliberate new implementation.

This means Story Studio can launch with a strong "bring your world with you"
promise. The user should not have to type a story bible again. The current card
library is the story bible.

### Non-Goals

Do not make Story Studio a pivot into a full book production platform.

Avoid these in the first release:

- Full desktop-grade Scrivener replacement.
- Print-ready PDF or EPUB typesetting.
- Marketplace for editors, beta readers, or published books.
- Full collaboration and tracked changes.
- Public story hosting or monetization.
- A separate duplicated card/codex datastore. The current `Story` object already
  owns chapters and story-local references/snapshots; snapshots preserve source
  isolation and are distinct from redundant library-card editing.
- AI that silently edits cards, lorebooks, or manuscripts without review.

The first useful version should help users draft and revise story text from the
assets they already made in Magic Worlds.

## Market Map

### AI-First Fiction Tools

| Product | What it optimizes | Key UI/UX pattern | Magic Worlds lesson |
| --- | --- | --- | --- |
| Sudowrite | Momentum, prose generation, writer's block, story-aware chat | Chat and one-click tools beside manuscript; Story Bible; Canvas; "allow edits" permission | Make AI feel like a writing partner, but keep edits explicit and reversible |
| Novelcrafter | Long-form continuity, structured codex, planning, model flexibility | Codex, mentions, progressions, prompt components, context options | Cards-as-codex is the strongest strategic match for Magic Worlds |
| NovelAI | Interactive AI storytelling, inline generation, lorebook, control | Editor with branching history, retry, colored provenance, context menu tools | Show provenance and preserve generation alternatives instead of replacing text blindly |
| LivingWriter | All-in-one writing workspace with AI features | Manuscript plus boards, elements, notes, goals, manuscript chat | Boards and cards are useful when they stay near the manuscript |

### Planning and Worldbuilding Tools

| Product | What it optimizes | Key UI/UX pattern | Magic Worlds lesson |
| --- | --- | --- | --- |
| Campfire | Modular writing and worldbuilding | Manuscript, index cards, notes sidebar, tagged story elements, modules | A writing feature can be modular and card-driven without becoming the whole app |
| Plottr | Visual outlines, timelines, series bible | Drag-and-drop timeline, templates, character sheets, places, notes | Visual planning is powerful but should be optional, especially for discovery writers |
| World Anvil | Deep worldbuilding and publication-ready lore | Wiki articles, templates, maps, timelines, family trees, access control | Rich world data should be searchable, linkable, and reusable across experiences |
| Scrivener | Long-form document management | Binder, corkboard/index cards, outliner, metadata, snapshots, compile | Writers like chunked documents, cards, and snapshots because long text is hard to manage |

### Production-Focused Writing Tools

| Product | What it optimizes | Key UI/UX pattern | Magic Worlds lesson |
| --- | --- | --- | --- |
| Reedsy Studio | Writing, formatting, goals, version history, collaboration | Familiar editor, manuscript structure, cloud history, book formatting | Production/export is valuable later, but the MVP should not start there |
| Ulysses | Focused writing across devices | Minimal editor, sheets, goals, library, proofing, export | A quiet editor matters; not every writing surface should look like a game board |

### General AI Chatbots

General assistants are useful for brainstorming, rewriting, and quick critique,
but they put context management on the user. Long-form fiction stresses memory:
character continuity, prior descriptions, subplot state, tone, and chronology
all matter. Purpose-built tools work because they surround generation with
project state, codex entries, scene structure, and scoped context controls.

For Magic Worlds, this means the user should not prompt "remember these
characters." They should select cards, and the system should show which card
facts are active.

## Competitive Deep Dives

### Sudowrite

Sudowrite is the strongest reference for writer momentum. Its product copy
centers fiction-specific AI: Write continues prose in the user's voice; Describe
adds sensory detail; Expand handles rushed sections; Rewrite revises prose;
Feedback critiques; Brainstorm produces options; Canvas explores plot points and
twists; Visualize generates art from story descriptions; Chat knows the story
and series.

What works:

- It does not ask users to understand model context. It presents writing jobs in
  author language: write, expand, rewrite, describe, feedback.
- It supports both focused text actions and open-ended chat.
- Chat is positioned as story-aware, not generic. The app can answer questions
  about earlier descriptions, update the Story Bible, create documents, leave
  comments, and propose multi-step plans.
- The "Allow edits" framing is important: the assistant can be conversational
  until the user grants mutation authority.
- Plugins show an appetite for custom one-click writing workflows, including
  craft analysis and character conversations.

Magic Worlds implication:

- The command vocabulary should be author-facing: `Continue`, `Rewrite`,
  `Expand`, `Condense`, `Describe`, `Critique`, `Outline`, `Extract Cards`,
  `Update Codex`.
- The assistant should ask for permission before editing the manuscript or card
  codex.
- The app should show "what changed" after AI actions, using the existing card
  assistant's staged apply model.
- Chat should be able to act on selected scene text and selected cards, not just
  answer questions in a detached panel.

Risk to avoid:

- Sudowrite is a full AI writing destination. Magic Worlds should not copy the
  entire product surface. Use the patterns that support writing from cards.

### Novelcrafter

Novelcrafter is the closest match to "cards as codex." Its Codex is a story
bible and world builder that tracks characters, locations, lore, objects,
subplots, aliases, references, mentions, colors, tags, relations, progressions,
and AI context rules. Its feature list also includes planning grids, matrix
views, scene labels, manual references, scene archive, text replacement, scene
summaries, scene beats, character detection, custom prompts, prompt preview,
chat context options, and extraction from chat into codex or outlines.

What works:

- The Codex is not a passive notebook. It is integrated into writing, planning,
  review, chat, and AI context.
- Mentions and aliases make the manuscript and codex mutually aware.
- Progressions solve a real long-form problem: characters, relationships, and
  world facts change over time.
- Prompt preview and context options build trust with technical and AI-heavy
  users.
- The app recognizes different author workflows: planners can use grids and
  matrices; discovery writers can use chat, scene tools, and extraction.

Magic Worlds implication:

- The app should treat existing cards as codex entries for Story Studio.
- A story scene should know which cards it references and should be able to
  create suggested card updates from manuscript text.
- Alias/trigger matching should power card mentions in the editor.
- "Progressions" map naturally to adventure session snapshots: a character card
  can be stable in the library while a story or session has a local state.
- AI prompt preview should be part of advanced disclosure, especially for users
  who already care about lorebook activation.

Risk to avoid:

- Novelcrafter's deep planning model can feel like setup work. Magic Worlds
  should let users start from a card, adventure turn, or blank scene in one
  click, then extract structure after writing.

### NovelAI

NovelAI is a strong reference for interactive AI prose. The editor is the main
writing surface; users write directly and send for AI generation. The system
keeps edit history like a branching timeline, supports retrying generations,
uses color to show text provenance, offers inline generation between earlier
points, exposes a context menu for selected text, and has a writer's toolbox for
rewrite, transform, expand, condense, and custom actions. Its text adventure
mode separates commands from story text and gives users clear `Do` and `Say`
input modes.

What works:

- Branching history makes experimentation feel safe.
- Retry acknowledges that generation is probabilistic and alternatives are part
  of the workflow.
- Text provenance helps the user distinguish AI output, user edits, and inputs.
- Selected-text tools reduce prompt friction.
- Text adventure mode shows that a writing app can support both authored prose
  and command-driven interactive narrative.

Magic Worlds implication:

- Story Studio should store AI generation alternatives for at least the active
  session, not only the accepted result.
- The editor should mark AI-generated or AI-modified ranges.
- `Continue from here`, `Insert between`, and `Regenerate paragraph` should be
  first-class interactions.
- Adventure sessions can export turns into story scenes, while story scenes can
  be used to seed future adventure play.

Risk to avoid:

- NovelAI exposes many model controls. Magic Worlds should keep model and
  sampling details collapsed unless the user opens advanced settings.

### Campfire

Campfire combines manuscript drafting with worldbuilding modules. It presents a
Manuscript Module, index card view, notes sidebar, tags for story elements, a
project-wide notepad, templates, timelines, research module, character sheets,
relationship webs, moodboards, maps, encyclopedia articles, calendars, systems,
focus mode, custom themes, custom layouts, collaboration, import/export, version
history, publishing preview, backups, and eighteen modules.

What works:

- It makes worldbuilding feel close to drafting. Notes and story elements are
  one click away while writing.
- Modules let users adopt only the complexity they need.
- Index cards and chapter goals make the long manuscript scannable.
- Tagged story elements connect text to structured notes.

Magic Worlds implication:

- Story Studio should open with a simple manuscript/scene editor, then let users
  reveal cards, lorebooks, timeline, and media panels as needed.
- Existing cards should be taggable in manuscript text through mentions.
- A chapter or scene card view can exist later, but it should not block writing.

Risk to avoid:

- Campfire's breadth is a product in itself. Magic Worlds should not create
  eighteen writing modules. Reuse cards, lorebooks, and adventure sessions.

### Plottr

Plottr is a visual outlining and series-bible tool. It emphasizes drag-and-drop
scene timelines, plotline and character arcs, plot templates, editing notes,
progress tracking, character sheets, places, notes, worldbuilding, family trees,
series views, export to Word and Scrivener, and no AI.

What works:

- It gives writers a visual way to see structure and holes.
- Templates lower the fear of a blank outline.
- It supports both plotters and discovery writers by making structure useful
  before or after drafting.
- The series bible keeps cross-book facts available.

Magic Worlds implication:

- A visual outline can be a later "Plan" tab, not the initial Story Studio
  requirement.
- Existing adventure templates already behave like a story seed. They can
  produce a scene list or beat board when the user wants planning help.
- Magic Worlds can differentiate from Plottr by making the cards AI-usable.

Risk to avoid:

- Visual planning can become a productivity theater if it delays drafting. The
  MVP should optimize "write a scene from these cards."

### World Anvil

World Anvil is the strongest reference for large worldbuilding repositories. It
uses wiki-like articles, many templates, maps, timelines, article linking,
search, nested categories, family trees, charts, roll tables, secrets, access
control, publication, monetization, tasks, and word counts.

What works:

- Templates make worldbuilding concrete.
- Search and cross-linking make large lore usable.
- Maps, timelines, and family trees are excellent for spatial and historical
  context.
- Access control and spoiler markers matter for public or multiplayer worlds.

Magic Worlds implication:

- The existing lorebook and card gallery should remain the deep worldbuilding
  layer. Story Studio only needs a filtered codex panel and fast card insertion.
- Secrets and spoilers should respect lorebook reveal rules when drafting.
- If a story is based on an adventure session, session-local card snapshots
  should override library cards.

Risk to avoid:

- World Anvil is a worldbuilding platform. Magic Worlds should not replace it;
  it should make its own cards more valuable inside AI writing.

### LivingWriter

LivingWriter combines planning, manuscript writing, boards, elements, notes,
goals, comments, stash, footnotes, tags, status, search, imports/exports, and
many AI features: outlines, element generation, rewrite, manuscript chat,
summarize, analysis, screenplay conversion, cover image, and thesaurus.

What works:

- Boards keep manuscript, elements, planning, and research in one place.
- Manuscript chat is context-aware and stays near the page.
- "Stash" solves a common writing problem: save good text without keeping it in
  the draft.
- Elements and aliases track appearances and relationships.

Magic Worlds implication:

- Add a `Stash` or `Clippings` concept for alternate AI generations, deleted
  paragraphs, and user snippets.
- AI manuscript chat should know selected story, scene, cards, lorebooks, and
  recent adventure/chat turns.
- The card codex should expose appearances: where a character/world/item is
  mentioned across story scenes and adventure sessions.

Risk to avoid:

- LivingWriter is a broad writing workspace. Magic Worlds should not start with
  screenwriting, covers, footnotes, or academic workflows.

### Reedsy Studio

Reedsy Studio is production oriented: a familiar editor, manuscript structure by
section/chapter/scene, front and back matter, import, formatting while writing,
writing goals, schedule, stats, cloud sync, collaboration, comments, tracked
changes, share previews, timeline/history, dark mode, PDF/EPUB typesetting, and
clear ownership/privacy positioning.

What works:

- Familiarity lowers onboarding cost.
- Built-in formatting and export are useful once a manuscript is close to done.
- Goals and timeline/history support sustained writing behavior.
- Copyright and AI-training messaging builds trust with writers.

Magic Worlds implication:

- A clean, familiar editor is more important than decorative fantasy UI inside
  the writing surface.
- Word count goals and version history are valuable but secondary.
- Privacy and training language will matter if AI writing is user-facing.

Risk to avoid:

- Reedsy Studio is about book production. Magic Worlds should only include
  lightweight export in early phases, such as Markdown, TXT, or copy-to-clipboard.

### Ulysses

Ulysses is a focused writing app with a library, sheets/chunks, minimalist
markup editor, project organization, goals, proofing, export, sync, and a calm
multi-device experience.

What works:

- Minimal writing UI reduces friction.
- Long work is split into manageable sheets.
- Goals and proofing sit behind the writing experience.
- The app can manage a large project without overwhelming the text surface.

Magic Worlds implication:

- The editor should have a focus mode that hides cards and AI panels.
- Scene/chapter chunks are enough for MVP; no need for a complex book compiler.
- The visual style should quiet down while drafting.

Risk to avoid:

- A pure minimalist editor would waste Magic Worlds' differentiator. The value is
  focus plus card context when requested.

### Scrivener

Scrivener remains the classic reference for long-form writing project
management: binder, research storage, corkboard, outliner, split screen,
metadata, keywords, snapshots, templates, and compile/export.

What works:

- The binder turns a long manuscript into manageable chunks.
- Corkboard cards make structure tactile and rearrangeable.
- Snapshots make revision safer.
- Metadata and keywords help writers reason about characters, locations,
  themes, and narrative lines.

Magic Worlds implication:

- Story Studio should store scenes as chunks with stable IDs, not as one huge
  blob.
- A scene card board can emerge naturally from story chunks.
- Snapshots and compare/restore matter because AI edits increase revision risk.

Risk to avoid:

- Scrivener's power-user depth is unnecessary for the Magic Worlds feature. Do
  not start with compile settings, research file import, split editor modes, or
  desktop-only assumptions.

## Feature Adoption Matrix

| Capability | Evidence in market | Magic Worlds recommendation |
| --- | --- | --- |
| Central prose editor | Sudowrite, NovelAI, Reedsy, Ulysses, Campfire, LivingWriter | MVP |
| Scene/chapter chunks | Scrivener, Reedsy, Ulysses, Campfire, LivingWriter | MVP |
| Existing cards as codex | Novelcrafter Codex, Campfire elements, Plottr character sheets, World Anvil articles | MVP differentiator |
| Card mentions in text | Novelcrafter mentions, Campfire tags, LivingWriter appearances | MVP |
| Alias/trigger matching | Novelcrafter aliases, Magic Worlds triggers | MVP |
| AI continue/retry | Sudowrite Write, NovelAI send/retry | MVP |
| Selected text rewrite/expand/condense | Sudowrite, NovelAI, LivingWriter | MVP |
| Story-aware AI chat | Sudowrite Chat, Novelcrafter Chat, LivingWriter Manuscript Chat | MVP as assistant drawer |
| Explicit apply/allow edits | Sudowrite Chat, Magic Worlds card assistant | MVP |
| Generation alternatives | NovelAI branching history, Reedsy timeline, Scrivener snapshots | MVP lightweight history |
| Context preview | Novelcrafter prompt preview/context options, NovelAI context | MVP advanced drawer |
| Extract cards from prose | Novelcrafter character detection/extract from chat, Magic Worlds card assistant | Phase 2 |
| Update card/lorebook from prose | Sudowrite Story Bible updates, Novelcrafter extract | Phase 2 with staged review |
| Visual scene board | Scrivener corkboard, Campfire index cards, Plottr timeline | Phase 2 |
| Writing goals | Reedsy, Ulysses, Campfire, LivingWriter | Phase 2 |
| Import/export | Reedsy, Ulysses, Campfire, Plottr, Scrivener | Phase 2 lightweight |
| Collaboration | Reedsy, Campfire, Novelcrafter, LivingWriter, World Anvil | Later |
| Publishing/monetization | Reedsy, Campfire, World Anvil | Non-goal for now |
| Deep model settings | NovelAI, Novelcrafter | Advanced only |

## Interaction And Package Research

This section focuses on the product surface, component behavior, and package
choices that can make Story Studio feel good to use. It intentionally avoids
deeper storytelling mechanics. The question is not "what should the story be?"
but "how should the user move through writing, selecting, reviewing, reusing
cards, and recovering from AI output?"

The current stack includes React 19, Tailwind v4, TipTap 3 and its ProseMirror/Markdown/mention extensions, lucide icons, Markdown rendering, Storybook, Testing Library, and Vitest. See [`package.json`](../../package.json) for exact versions. Reuse the current editor and the repo's UI primitives before evaluating another package.

### Current Repo Interaction Assets

The implemented feature already has [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx), [inline AI lifecycle](../../src/features/novel/editor/hooks/useInlineAI.ts), slash/mention menus, beat composer, Find/Replace, Codex snapshots and generation history. Selection mapping, accepted-replacement undo, persisted reference identity, original/proposed comparison and crash recovery remain gaps or partial behavior, rather than reasons to restart from a textarea.

Reusable cross-feature infrastructure includes the shared [assistant shell](../../src/features/creation/common/components/assistant/AssistantShell.tsx), `useAssistant`, workspace-scoped API clients, `Drawer`/`Modal` primitives, and existing lorebook/session snapshot patterns. Existing document-assistant tools can persist writes; reusing their shell does not automatically provide novel proposal/review/commit semantics.

The package matrix below is **historical candidate research**, not a list of missing installed dependencies or selected purchases. Current implementation takes precedence.

### Package Selection Matrix

| Need | Candidate package | Use when | Avoid when | Recommendation |
| --- | --- | --- | --- | --- |
| Rich prose editor | Lexical | Custom React editor behavior, custom nodes, inline provenance, mentions, slash commands, plugin-owned AI behavior | The MVP only needs plain Markdown and selected-text actions | Strong Phase 2 candidate |
| Rich prose editor | Tiptap | Fast extension ecosystem, mentions, bubble menus, selection commands, collaboration path, ProseMirror model without building directly on ProseMirror | Avoiding paid/pro extensions is important, or the app needs very custom low-level editor internals | Strong Phase 2 candidate |
| Rich prose editor core | ProseMirror | Maximum control over schema, transactions, collaboration, and editor state | The team wants a faster React integration path | Only choose directly if editor behavior becomes core infrastructure |
| Markdown/text editor | CodeMirror 6 | Markdown-first editing, strong keyboard/selection behavior, autocompletion, search, large documents | The product needs true rich prose, inline comments, and card nodes as first-class document objects | Good if Story Studio stays Markdown-first |
| Custom rich editor | Slate | Highly custom document model and React rendering | The team wants a maintained batteries-included editor stack | Consider only for unusual document models |
| Floating menus | Floating UI | Selection toolbars, card preview popovers, mention menus, context-budget tooltips, AI action menus | A full accessible component primitive is needed instead of positioning math | Add early if selection UX ships |
| Accessible primitives | Radix Primitives | Dialogs, popovers, menus, tooltips, tabs, and focus management with incremental adoption | The team wants one complete ARIA-first component system with collection behavior | Good incremental fit |
| Accessible primitives | React Aria | Comboboxes, list boxes, menus, dialogs, overlays, tabs, and complex keyboard behavior | The team wants minimal dependencies and already has simple primitives | Strong for high-a11y editor controls |
| Command menu | cmdk | Global `Command+K`, card search, scene jump, action discovery | Primary actions are missing from visible UI | Good Phase 2 utility |
| Drag and reorder | dnd kit | Scene board, card ordering, context priority, stash organization | Simple up/down buttons are enough | Best fit for board interactions |
| Virtualization | TanStack Virtual | Long codex lists, mention results, generation history, context traces | Lists are small and static | Add when list size causes measurable issues |
| Resizable panes | react-resizable-panels | Desktop writing workbench with persistent left/editor/right widths | Mobile-only or fixed layout is enough | Good fit for desktop Story Studio |
| Diff review | jsdiff | Before/after rewrite review, staged card updates, changed paragraph display | A richer operational transform diff is required | Good lightweight first diff utility |
| Complex workflow state | XState | Generation, retry, stop, accept, stash, recover, and staged card updates become hard to reason about | Local reducer/state hooks remain clear | Use after workflow complexity proves it |
| Collaboration | Yjs | Real-time multi-user story editing becomes a product goal | MVP or single-user writing | Later only |

### Editor Stack Recommendation — reconciled

TipTap is already installed and used by Story Studio. The present recommendation is to retain it and harden document identity, persistence, targeting, proposal review, and undo behind a manuscript adapter. A controlled textarea is no longer the implementation baseline; choosing between Lexical and TipTap is no longer an unresolved initial setup question.

Alternative editors and paid add-ons remain prototype candidates only if fixtures demonstrate a material improvement. Validate mentions, duplicate names, multi-block selected rewrites, Markdown/link preservation, review acceptance, undo/redo, Unicode and backend integration on the same corpus. See [target architecture](../novel_refactor/07_target_architecture.md) and [validation](../novel_refactor/12_validation_and_acceptance.md).

### Useful Components To Build

#### `StoryWorkbench`

The shell that holds the writing flow.

Responsibilities:

- Three-pane desktop layout: scenes, editor, card codex.
- Drawer-based mobile layout: editor first, scene/codex/assistant as drawers.
- Save status, word count, active source, focus mode, and context summary.
- Persistent desktop panel widths if `react-resizable-panels` is adopted.
- Route-level ownership of active story, active scene, selected source card, and
  assistant drawer state.

Interactions:

- `Command+K` opens a command menu if shipped.
- `Escape` closes transient menus before closing drawers.
- Focus mode hides side rails but keeps a small context summary visible.
- Dirty state is visible but quiet. Writing should not feel like filling a form.

#### `SceneRail`

The left navigation for scene chunks.

Responsibilities:

- Scene list with title, status, source, word count, and last edited state.
- Add, duplicate, rename, archive, and reorder scenes.
- Show source badges: blank, card, adventure, chat, world, lorebook.
- Support later board view without changing the scene data model.

Interactions:

- In MVP, use explicit move up/down actions for accessibility and simplicity.
- Add dnd kit when reorder becomes a frequent action or when a board view ships.
- Preserve keyboard navigation and visible focus states.
- Do not make planning mandatory; a story with one scene is valid.

#### `SceneEditor`

The primary text surface.

Responsibilities:

- Own scene body editing, save debounce, selection state, and insertion points.
- Expose selected text and cursor context to assistant commands.
- Reserve stable areas for inline toolbar, generation insertion, and review.
- Keep typography quiet: readable line length, generous text area, minimal chrome.

Interactions:

- Selecting text opens a small action toolbar near the selection.
- Cursor-only state offers `Continue`, `Ask`, and `Insert from card`.
- Large AI operations create a snapshot before replacing text.
- Empty state should be actionable: select cards, paste text, continue from
  source, or start writing.

Package notes:

- Plain textarea is enough for MVP if selection offsets and replacements are
  handled carefully.
- Lexical or Tiptap becomes valuable when inline marks, comment anchors, card
  nodes, or per-span provenance are needed.
- Floating UI is useful even with a textarea because selected-text toolbars need
  collision-aware positioning.

#### `SelectionActionToolbar`

The fastest way to invoke AI on selected prose.

Responsibilities:

- Show a compact set of author-facing actions: rewrite, expand, condense,
  describe, critique, ask.
- Keep destructive actions behind review, not immediate replacement.
- Preserve selection while the user opens the action menu.

Interactions:

- Toolbar appears only when a valid text selection exists.
- Primary actions should be one click, with more options behind a menu.
- On mobile, use a bottom sheet or compact drawer instead of a hover toolbar.
- Keyboard path should exist through command menu or shortcuts later.

Package notes:

- Floating UI is the best fit for selection anchoring.
- Radix or React Aria can provide accessible menu/dialog primitives around the
  positioned surface.

#### `CardMentionMenu`

The bridge between prose and the card codex.

Responsibilities:

- Let users insert card references with `@` or another explicit mention trigger.
- Search character, world, adventure, and lorebook entries.
- Show aliases/triggers when matching ambiguous card names.
- Insert a mention reference that can be rendered as text in MVP and as a rich
  node later.

Interactions:

- Mention suggestions should prioritize active cards, source cards, and recent
  cards before global library results.
- If two cards share a name or alias, force a clear pick.
- Mentioning a card does not automatically include every token from that card;
  it creates an explainable context suggestion.
- A mention should have a hover/focus preview and a quick include/exclude
  toggle.

Package notes:

- Tiptap has built-in paths for suggestion and mention-style extensions.
- Lexical can support custom mention nodes and plugins.
- React Aria combobox or cmdk can power a standalone mention picker if the MVP
  stays textarea-based.

#### `CardCodexRail`

The right rail that makes Magic Worlds different from generic AI writing tools.

Responsibilities:

- Show active, mentioned, suggested, and excluded cards.
- Show lorebook activations and token estimates.
- Support quick card preview, include/exclude, pin/unpin, and open full card.
- Surface weak triggers, missing descriptions, conflicts, and secret-leakage
  warnings.

Interactions:

- Default tab should be `Active`, not a raw search panel.
- Mentioned cards should be visible but not silently forced into context.
- Every included card should explain why it is included: selected, source,
  mention, trigger, lore activation, or pinned.
- Token budget should be visible on demand, not always competing with prose.

Package notes:

- TanStack Virtual is useful if card lists, traces, or search results grow past
  simple rendering.
- Floating UI supports preview cards and context tooltips.
- Existing Magic Worlds `Card`, `Badge`, `Tag`, and `Chip` components are enough
  for the first version.

#### `ContextPreviewPanel`

The trust surface for AI behavior.

Responsibilities:

- Show active cards, lore entries, scene excerpt, source adventure/chat context,
  and excluded items.
- Show approximate token budget and the order used to assemble context.
- Explain why an item was included or skipped.
- Offer advanced controls without forcing novices to manage prompts.

Interactions:

- Start collapsed behind a summary such as `Context: 5 cards, 3 lore entries`.
- Use progressive disclosure: simple include/exclude toggles first, prompt
  preview and ordering later.
- The user should be able to run a dry preview before AI writes.
- If the AI output references something outside visible context, the UI should
  make that easy to diagnose.

Package notes:

- Existing Lorebook activation preview is the local template to reuse.
- Virtualization may be needed for trace rows if context assembly becomes large.

#### `AIAssistantDock`

The conversational and command-driven assistant surface.

Responsibilities:

- Scope chat to current story, scene, selection, and active card context.
- Show streaming output, stop/retry controls, and context summary.
- Store conversation history per story/scene where useful.
- Route results into `GenerationCandidates` or `StagedCardUpdateReview`, not
  directly into final state.

Interactions:

- Assistant suggestions adapt to the current source: character, world,
  adventure, chat, or lorebook.
- "Allow edits" should be a temporary command-level permission, not a permanent
  mode.
- Chat can ask questions and propose changes, but text/card mutations remain
  explicit.
- The assistant should show when it is using selected text versus the whole
  scene.

Package notes:

- Existing assistant components should be reused first.
- XState is not needed unless the command lifecycle grows beyond clear local
  reducer logic.

#### `GenerationCandidates`

The review surface for generated prose.

Responsibilities:

- Show one or more generated alternatives.
- Preserve retry results instead of replacing them silently.
- Support accept, insert below, replace selection, stash, copy, and discard.
- Show the context bundle used for each candidate.

Interactions:

- `Accept` should be precise: replace selection, insert at cursor, or append to
  scene.
- `Retry` creates another candidate, not a destructive overwrite.
- `Stash` makes "not now" safe. This supports exploration without cluttering the
  manuscript.
- Generated text remains visually distinct until accepted or edited.

Package notes:

- jsdiff is useful when a candidate is a rewrite rather than a continuation.
- A simple local candidate list is enough for MVP.

#### `StagedCardUpdateReview`

The review surface for AI-proposed codex changes.

Responsibilities:

- Show proposed changes to character, world, adventure, and lorebook cards.
- Compare current and proposed values.
- Let the user apply all, apply selected, edit before applying, or reject.
- Preserve source provenance: which scene or passage caused the suggestion.

Interactions:

- Card updates should never be hidden inside chat.
- Dangerous changes, such as replacing core descriptions or changing public
  secrets, need stronger confirmation than adding an alias or trigger.
- User edits in the review panel should become the applied value, not require a
  trip to the full card editor.

Package notes:

- Reuse the existing card assistant staged apply pattern.
- jsdiff can support readable value-level comparisons.

#### `SceneBoard`

The optional planning and organization surface.

Responsibilities:

- Show scenes as cards with status, summary, source, word count, and active cast.
- Support reorder, grouping, and later timeline/arc views.
- Keep this optional so discovery writers are not blocked by planning.

Interactions:

- Drag and drop is valuable here, not in the main manuscript.
- Provide keyboard alternatives for reorder and move-to-section.
- Board cards should open the editor, not become separate editing surfaces.

Package notes:

- dnd kit is the best fit when board interactions move beyond simple buttons.
- TanStack Virtual may be useful if board columns grow large.

#### `StashDrawer`

The place where useful generated material goes instead of being lost.

Responsibilities:

- Store rejected-but-interesting AI alternatives, user snippets, scene ideas,
  card facts, and critique notes.
- Let users drag or insert stash items into the scene later.
- Keep stash scoped by story, with optional scene-level filters.

Interactions:

- `Stash` should be available wherever generated output can be discarded.
- Stashed items need source labels: generated from selection, generated from
  card, clipped by user, extracted from adventure, critique note.
- Inserting a stash item should not erase the stash by default.

Package notes:

- No special package is needed in MVP.
- dnd kit becomes useful if dragging snippets into scenes becomes a major flow.

### What Works Elsewhere, Translated To UI

| Observed pattern | Products | UX reason it works | Magic Worlds component |
| --- | --- | --- | --- |
| Selected-text actions near the manuscript | Sudowrite, NovelAI, LivingWriter | Users do not leave the draft to request a rewrite | `SelectionActionToolbar` |
| Story-aware assistant beside the manuscript | Sudowrite, Novelcrafter, LivingWriter | Chat stays grounded in the current writing task | `AIAssistantDock` |
| Codex/story bible references | Novelcrafter, Campfire, World Anvil | Continuity is easier when entities are structured and searchable | `CardCodexRail` |
| Mention/tag links inside prose | Novelcrafter, Campfire | Text and structured data reinforce each other | `CardMentionMenu` |
| Prompt/context preview | Novelcrafter, NovelAI | Users can debug AI memory instead of guessing | `ContextPreviewPanel` |
| Retry and alternatives | NovelAI, Sudowrite | Generation becomes exploration, not overwrite | `GenerationCandidates` |
| Explicit edit permission | Sudowrite, Magic Worlds card assistant | Trust increases when mutation is reversible | `StagedCardUpdateReview` |
| Corkboard/index card planning | Scrivener, Campfire, Plottr | Long-form text is easier to manage in chunks | `SceneRail` and `SceneBoard` |
| Quiet writing surface | Ulysses, Reedsy, Scrivener | Concentration improves when supporting tools recede | `SceneEditor` focus mode |
| Version/snapshot history | Scrivener, Reedsy, NovelAI | Recovery makes experimentation safer | scene snapshots and candidate history |

### Recommended Build Order For UX

1. Build `StoryWorkbench` with fixed desktop rails and drawer-based mobile
   behavior using existing primitives.
2. Build `SceneEditor` as plain text or Markdown with autosave, selection state,
   and stable insertion/replacement helpers.
3. Build `CardCodexRail` with active cards, mention suggestions, include/exclude
   controls, and context summary.
4. Build `AIAssistantDock` by adapting the existing assistant pattern to story
   commands and scene context.
5. Add `SelectionActionToolbar` using browser selection APIs. Add Floating UI if
   native positioning becomes brittle.
6. Add `GenerationCandidates` and lightweight diff review with jsdiff for
   rewrites.
7. Add `ContextPreviewPanel` by reusing the Lorebook activation preview model.
8. Add `StashDrawer` so retry/reject flows do not feel destructive.
9. Prototype Lexical versus Tiptap only after the MVP proves that mentions,
   inline provenance, or comment anchors are actually needed.
10. Add dnd kit, cmdk, TanStack Virtual, and resizable panels incrementally when
    the corresponding interactions have a clear product reason.

### Interaction Principles Specific To Packages

- A package should map to a user-visible interaction, not to an abstract future
  architecture preference.
- Keep the editor replaceable until the story data model and AI review flows are
  stable.
- Prefer headless or unstyled packages so Magic Worlds keeps its existing visual
  language.
- Do not let a command palette hide important actions. It should accelerate
  expert flows, not become the only navigation.
- Do not make drag and drop the only way to reorder. Always provide explicit
  keyboard-accessible controls.
- Treat virtualization as a performance tool, not a layout system.
- Treat collaboration packages as a later product decision. They affect storage,
  conflict resolution, permissions, presence, and support burden.
- Keep AI output review in first-party components. This is central to trust and
  should not be delegated to a generic editor plugin without product review.

### Package Adoption Decisions — current status

- **Implemented:** TipTap is the current editor; custom extension/menu code exists.
- **Recommended:** retain the editor and shared UI primitives, then fix the documented reliability/fidelity contracts.
- **TBD:** diff/anchor/schema implementation, optional resizing/virtualization dependencies, add-on licensing and conversion runtime. Choose from measured needs and fixture evidence.
- **Excluded:** Yjs and multi-user collaboration are outside the current single-author scope.

The historical matrix is supporting research, not a dependency plan. Current decisions and gates are in the [novel refactor roadmap](../novel_refactor/14_status_and_roadmap.md).

## UX Principles

### 1. Prose Is The Primary Object

The first screen should be a usable writing workbench, not a marketing page, a
dashboard, or a planning wizard. The user should be able to select cards, open a
blank scene, and start writing.

Recommended primary layout:

- Left rail: story scenes, active source adventure, scene status, word counts.
- Center: manuscript editor.
- Right rail: card codex, active cards, lorebook entries, mentions, context.
- Bottom or floating panel: AI assistant, generation alternatives, issues.

For small screens, the center editor remains first; card codex and AI become
drawers.

### 2. Cards Are The Codex

Magic Worlds should not ask users to create a separate "Codex Entry" for every
character and location they already made. In Story Studio:

- Character cards are codex entries.
- World cards are codex entries.
- Adventure templates are codex entries for scenario and cast setup.
- Lorebook entries are advanced codex memory.
- In-progress adventure snapshots are story/session-specific codex overrides.
- Triggers and aliases power mention detection.

The right rail should feel like a card-aware codex:

- Active cards selected for the current scene.
- Mentioned cards detected in text.
- Suggested cards based on triggers.
- Lorebook entries activated by the scene.
- Context budget estimate.
- Warnings for missing descriptions, weak triggers, or conflicting snapshots.

### 3. AI Actions Should Be Reversible

AI writing makes revision faster, but it also increases the risk of losing the
user's voice. Every AI mutation should produce a reviewable state:

- Inserted text is highlighted as AI-generated until edited or accepted.
- Rewrites show before/after diff.
- Card or lorebook updates are staged, not automatic.
- The user can keep, retry, stash, or discard each result.
- A scene snapshot is created before large AI changes.

This matches the existing Magic Worlds card assistant pattern: AI streams,
produces structured output, and the user explicitly applies it.

### 4. Context Should Be Visible On Demand

Users should not have to guess why the AI wrote something. The context drawer
should answer:

- Which cards are included?
- Which lorebook entries activated?
- Which scene text is being used?
- Which adventure or character-chat turns are being referenced?
- Which items were excluded and why?
- What approximate token budget is used?

For novice users, hide this behind a compact "Context: 5 cards, 3 lore entries"
control. NN/g's progressive disclosure guidance applies directly: show the few
options most users need, and reveal specialized controls only when requested.

### 5. Planning Is Optional

Some users want a beat sheet; others want a first line and a character. Story
Studio should support both:

- Quick start: select cards -> create scene -> write.
- From adventure: convert latest turn or session arc into prose.
- From character: write a vignette or dialogue scene.
- From world: write an establishing scene.
- From template: generate a beat outline.
- Advanced: open a board/grid/timeline.

The product should extract structure from writing as readily as it generates
writing from structure.

### 6. The Writing Surface Should Be Quieter Than The Game Surface

Magic Worlds can keep its fantasy brand, but the editor must prioritize
legibility and concentration:

- Strong line length and typography.
- Minimal chrome in focus mode.
- Cards and AI controls in side rails, not on top of prose.
- No heavy decorative backgrounds behind long text.
- Clear keyboard and mouse interactions.
- Dense but readable card context panels.

### 7. Use AI Design Guidelines

Microsoft's HAX guidance is relevant because writing assistants are ambiguous:
the user needs to know what the AI can do, what it is doing, and how to recover
when it is wrong.

Story Studio should:

- Set expectations for AI capabilities and limits.
- Make current context visible.
- Support efficient invocation and correction.
- Let users dismiss, undo, retry, and refine.
- Track feedback over time, such as user style preferences.
- Avoid pretending the AI has perfect memory; show the context that is actually
  sent.

## Recommended Product Shape

### Name

Use `Story Studio` or `Story Writer`.

`Story Studio` fits the existing `Creator Studio` and `Lorebook Studio` naming
pattern. It also avoids implying this is only for novels. Users can write
chapters, adventure recaps, character scenes, short fiction, dialogue tests,
world vignettes, or campaign prose.

### Entry Points

Add Story Studio as a feature of current surfaces:

- Sidebar: `Stories`.
- Character card: `Write with this character`.
- World card: `Write in this world`.
- Adventure template: `Write from this adventure`.
- Adventure session: `Turn into story` or `Continue as prose`.
- Character chat: `Draft scene from chat`.
- Lorebook: `Write with this lorebook`.

The user should never have to start from an empty project if they already have
cards.

### MVP User Flows

#### Flow 1: Write From Cards

1. User opens Story Studio.
2. User selects a character, world, and optional adventure template.
3. App creates a story with one blank scene.
4. Right rail shows selected cards as active codex context.
5. User writes manually or clicks `Continue`.
6. AI drafts the next passage using selected cards and lorebook context.
7. User accepts, retries, edits, or stashes the result.

#### Flow 2: Rewrite Selected Text

1. User selects a paragraph.
2. Inline toolbar offers `Rewrite`, `Expand`, `Condense`, `Describe`, `Sharpen voice`.
3. AI returns one or more alternatives.
4. User previews diff.
5. User replaces, inserts below, stashes, or discards.

#### Flow 3: Use Adventure As Source

1. User opens an in-progress adventure session.
2. User chooses `Turn into story`.
3. App creates a story linked to the session snapshot.
4. Scene text starts from selected turns or summary.
5. Active codex context uses the adventure's snapshot cards, not the mutable
   library originals.
6. User revises the prose and can continue from the current session state.

#### Flow 4: Extract Card Updates From Prose

1. User writes a new fact in the scene.
2. App detects that the fact appears to change a character/world/card.
3. Assistant suggests a staged update, such as new alias, changed relationship,
   new trigger, or lorebook entry.
4. User reviews and applies or rejects.

This should be Phase 2 unless the backend card-assistant contract already
supports it cleanly for story objects.

### Workbench Layout

```text
+--------------------------------------------------------------------------+
| Header: Story title, linked source, save status, word count, focus toggle |
+--------------+---------------------------------------+-------------------+
| Scenes       | Manuscript editor                     | Card Codex        |
|              |                                       |                   |
| Scene list   | Rich/plain prose editing              | Active cards      |
| statuses     | Inline AI toolbar                     | Mentioned cards   |
| word counts  | AI provenance marks                   | Lore activations  |
| source link  | Comments/issues later                 | Context preview   |
+--------------+---------------------------------------+-------------------+
| Assistant drawer: chat, suggested actions, alternatives, staged updates    |
+--------------------------------------------------------------------------+
```

Mobile:

- Editor first.
- Scene switcher in a top or bottom sheet.
- Card Codex as a drawer.
- Assistant as a drawer.
- Inline actions remain selected-text driven.

### Core Commands

MVP commands:

- `Continue`: generate prose after cursor.
- `Retry`: generate an alternate continuation.
- `Rewrite`: replace selected text after review.
- `Expand`: add sensory/concrete detail to selected text.
- `Condense`: make selected text shorter.
- `Describe`: enrich a person/place/object from selected card context.
- `Critique`: return comments and issues, not direct edits.
- `Ask`: chat about current scene and active cards.
- `Stash`: save selected text or generated alternative for later.

Phase 2 commands:

- `Outline scene`.
- `Generate scene beats`.
- `Extract card updates`.
- `Create lorebook entries`.
- `Find contradictions`.
- `Show appearances`.
- `Continue from adventure session`.
- `Write recap`.

Advanced commands:

- `Prompt preview`.
- `Context budget`.
- `Model/prompt profile`.
- `Include/exclude card`.
- `Lock style`.
- `Generate between paragraphs`.

## Historical data model recommendations

The TypeScript examples below describe the June brief, **not current DTOs**. Actual `Story` has `chapters: StoryChapter[]`; source types also include items and omit character-chat/lorebook; `StoryContextSettings` uses recent chapters and the current generated trace schema differs. Use [story.types.ts](../../src/shared/types/story.types.ts) for the wire contract and [04](../novel_refactor/04_novel_chapter_and_scene_management.md) / [07](../novel_refactor/07_target_architecture.md) for proposed future scenes/revisions. No scene endpoint or migration has been implemented by this documentation update.

### Story

```ts
export interface Story {
    id: string
    title: string
    description?: string
    source?: StorySource
    scenes: StoryScene[]
    activeContext: StoryContextSettings
    createdAt?: string
    updatedAt?: string
}
```

### Story Source

```ts
export type StorySourceKind =
    | 'blank'
    | 'character'
    | 'world'
    | 'adventure_template'
    | 'adventure_session'
    | 'character_chat'
    | 'lorebook'

export interface StorySource {
    kind: StorySourceKind
    id?: string
    title?: string
    snapshotId?: string
}
```

Use `snapshotId` for adventure sessions so writing from a session does not drift
when library cards later change.

### Story Scene

```ts
export interface StoryScene {
    id: string
    storyId: string
    title: string
    body: string
    order: number
    status: 'draft' | 'revising' | 'complete' | 'archived'
    povCardId?: string
    locationCardId?: string
    activeCardRefs: StoryCardRef[]
    mentionRefs: StoryMentionRef[]
    generationHistory?: StoryGeneration[]
    createdAt?: string
    updatedAt?: string
}
```

Start with Markdown or structured text. A richer editor model can come later,
but scene chunks need stable IDs from the beginning.

### Story Card References

```ts
export type StoryCardKind =
    | 'character'
    | 'world'
    | 'adventure_template'
    | 'lorebook'
    | 'lorebook_entry'
    | 'snapshot_card'

export interface StoryCardRef {
    kind: StoryCardKind
    id: string
    source: 'manual' | 'mention' | 'suggested' | 'source' | 'lore_activation'
    enabled: boolean
    precedence: number
}
```

### Mention References

```ts
export interface StoryMentionRef {
    id: string
    sceneId: string
    cardKind: StoryCardKind
    cardId: string
    matchedText: string
    matchSource: 'name' | 'alias' | 'trigger' | 'manual'
    startOffset: number
    endOffset: number
    confidence: 'exact' | 'likely' | 'manual'
}
```

### Context Settings

```ts
export interface StoryContextSettings {
    includeSelectedCards: boolean
    includeMentionedCards: boolean
    includeLorebooks: boolean
    includeRecentScenes: number
    includeAdventureTurns?: number
    includeCharacterChatTurns?: number
    tokenBudget: number
    styleSource?: 'current_scene' | 'whole_story' | 'card' | 'custom'
    customStyleInstruction?: string
}
```

### Generation History

```ts
export interface StoryGeneration {
    id: string
    sceneId: string
    command: 'continue' | 'rewrite' | 'expand' | 'condense' | 'describe' | 'critique' | 'custom'
    inputRange?: { startOffset: number; endOffset: number }
    promptSummary: string
    contextTrace: StoryContextTrace
    output: string
    status: 'candidate' | 'accepted' | 'rejected' | 'stashed'
    createdAt?: string
}
```

### Context Trace

```ts
export interface StoryContextTrace {
    cards: Array<{
        kind: StoryCardKind
        id: string
        title: string
        included: boolean
        reason: 'selected' | 'mentioned' | 'source' | 'lore_activation' | 'recent'
        estimatedTokens?: number
        skippedReason?: 'disabled' | 'budget' | 'duplicate' | 'missing_content'
    }>
    loreEntries: Array<{
        lorebookId: string
        entryId: string
        title: string
        included: boolean
        matchedKeys: string[]
        estimatedTokens?: number
        skippedReason?: string
    }>
    scenes: Array<{
        sceneId: string
        title: string
        included: boolean
        reason: 'current' | 'recent' | 'manual'
        estimatedTokens?: number
    }>
    totalEstimatedTokens: number
}
```

The trace is a product feature, not only a debug artifact. It is how users learn
why the AI did or did not remember a card.

## Backend and API Implications

The BFF already owns story storage, context assembly and profile-backed generation. The source contract is in sibling `magic-worlds-api/src/routes/stories.py`, `src/models/story.py`, and `src/services/story_generation.py`; the frontend uses [apiService](../../src/infrastructure/api/index.ts) through workspace scope. A frontend flag does not disable these BFF routes.

| Current route family | Actual status / limitation |
|---|---|
| `GET /stories`, `POST /stories`, `GET/PUT/DELETE /stories/{story_id}` | Implemented owner/workspace-scoped CRUD; deployment unverified |
| `POST /stories/{story_id}/chapters`, `PUT/DELETE /stories/{story_id}/chapters/{chapter_id}` | Implemented chapter CRUD, not independent scenes or revision-CAS writes |
| `POST/PUT/DELETE` under `/stories/{story_id}/card-refs` | Implemented story-local references/snapshots; updates/deletes use `/{ref_id}` |
| `POST /stories/{story_id}/context-preview` | Implemented trace endpoint; prospective UI and prompt/budget correctness remain gaps |
| `POST /stories/{story_id}/generate` and `/generate/stream` | Implemented profile-backed candidate generation; stream uses the shared text-generation protocol |
| `GET /stories/{story_id}/generation-requests/{request_id}` | Retained exact-request recovery; not a second generation |
| `POST /stories/{story_id}/generations/{generation_id}/accept`, `/stash`, `/discard` | Implemented status actions; acceptance does not atomically save a manuscript revision |
| `/scenes`, `/extract-card-updates`, manuscript revisions/trash/import/export | Not current route families; planned contracts require implementation |

Current generation input uses `chapterId`, `command`, optional `selection`/`instruction`/`contextSettings`, and the LLM request envelope; request IDs are transported by the client. It does not send a revision-bound cursor/anchor. Current result includes `generation`, `chapter`, `stagedCardUpdates: []`, and execution provenance.

The request/response/staged-update examples below are **historical proposals**, not current wire types. Use [story.types.ts](../../src/shared/types/story.types.ts) and the BFF payload classes for integration.

Historical generation request:

```ts
export interface StoryGenerateRequest {
    sceneId: string
    command: 'continue' | 'rewrite' | 'expand' | 'condense' | 'describe' | 'critique' | 'custom'
    selection?: { startOffset: number; endOffset: number; text: string }
    instruction?: string
    contextSettings?: Partial<StoryContextSettings>
    requestId?: string
}
```

Historical generation response:

```ts
export interface StoryGenerateResponse {
    generation: StoryGeneration
    scene?: StoryScene
    stagedCardUpdates?: StoryStagedCardUpdate[]
}
```

Proposed staged card update — not implemented in the novel result:

```ts
export interface StoryStagedCardUpdate {
    id: string
    cardKind: 'character' | 'world' | 'adventure_template' | 'lorebook_entry'
    cardId?: string
    operation: 'create' | 'patch'
    fields: string[]
    before?: Record<string, unknown>
    after: Record<string, unknown>
    evidence: {
        sceneId: string
        quote: string
    }
}
```

Streaming should follow the existing card assistant pattern: optimistic user
message, assistant deltas, final structured payload, done/error frames,
request IDs, abort support, and retry-safe persistence.

## Frontend Integration

### Route and Navigation — implemented behind a flag

The current router already exposes the following page types when the novels flag is enabled:

- `gallery-stories`
- `story`

The current Sidebar puts Stories in its Activity group and filters it out when the feature is disabled. Placement in this historical brief is no longer an implementation task.

### Reuse Existing UI

Reuse:

- `PageHeader` for Story Studio header.
- `Drawer` for card codex and assistant on small screens.
- `Card`, `Badge`, `Tag`, `Chip`, `Button`, `IconButton`, `Field`.
- Shared assistant shell/transport patterns for streaming and conversation
  history; implement novel proposal review explicitly rather than assuming
  existing document tools stage every mutation.
- `LorebookStudio` validation and activation-preview concepts.
- `AdventureCardDrawer` snapshot ownership model.

Do not reuse the highly decorative landing hero style inside the editor.

### Editor Choice — implemented baseline

The current editor is TipTap, not a controlled textarea. It serializes chapter bodies to Markdown and includes mention, beat, detection, search/replace, slash-command and AI-suggestion extensions. Retain this foundation; preserve document/reference fidelity and undo before enlarging AI scope. See [source audit](../novel_refactor/01_current_state_and_evidence.md) and [target adapter](../novel_refactor/07_target_architecture.md).

### Card Codex Panel

The right panel should have tabs:

- `Active`: cards and lore currently included.
- `Mentions`: detected card mentions in the scene.
- `Search`: add cards from library.
- `Context`: prompt preview and token budget.
- `Issues`: missing card fields, weak triggers, contradictions, secret leakage.

Card rows should show:

- Thumbnail/portrait if present.
- Name and type.
- Source: selected, source adventure, mention, lore activation, suggestion.
- Toggle include/exclude.
- Token estimate.
- Quick actions: open card, insert description, ask AI, update from scene.

### Assistant Panel

The assistant should be scoped to the current story and scene.

It should show:

- Current command.
- Which context bundle is active.
- Streaming text.
- Alternatives.
- Staged card updates.
- Retry and stop controls.
- Conversation history.

Suggested prompts should adapt to source:

- Character source: "Write a tense dialogue scene with this character."
- World source: "Describe this location through a character's senses."
- Adventure source: "Turn the last encounter into polished prose."
- Lorebook source: "Draft a scene that reveals this lore without exposition."

## AI Context Strategy

### Context Assembly Order

Recommended backend order:

1. System instruction for Story Studio writing behavior.
2. User's explicit command and selected text.
3. Current scene body around cursor/selection.
4. Active source card or session snapshot.
5. Manually selected cards.
6. Mentioned cards from scene text.
7. Activated lorebook entries.
8. Recent related scenes.
9. Relevant adventure or character-chat turns, if linked.
10. Style sample, if requested.
11. Output contract.

### Context Rules

- Session snapshots override library cards.
- Manual card selections override automatic mentions.
- Secret lore is excluded unless revealed or explicitly selected by the user.
- Card descriptions must be summarized when budget is tight.
- Empty or weak card descriptions should create UI warnings.
- Triggers and aliases should detect mentions but should not be inserted as
  prompt content by themselves.
- AI should receive card content, not UI-only labels, unless the label helps
  disambiguate.

### Prompt Transparency

The UI should display a summary by default:

```text
Context: 4 cards, 2 lore entries, current scene, last 2 adventure turns.
```

The advanced drawer should show:

- Included cards.
- Excluded/skipped cards and reasons.
- Lore activation trace.
- Scene excerpts.
- Token estimates.
- Prompt preview if allowed by backend policy.

## Story/Card Feedback Loop

The key Magic Worlds advantage is bidirectional flow:

- Cards generate better stories.
- Stories enrich cards.

Examples:

- A user writes that Mira now wears a silver oath ring. Assistant suggests
  adding `silver oath ring` to Mira's attributes or lorebook.
- A generated scene invents a new tavern. Assistant stages a new World/Location
  card or lorebook entry.
- A character gets a nickname in dialogue. Assistant suggests adding it as an
  alias/trigger.
- A scene contradicts a lorebook rule. Assistant shows a warning before
  rewriting.
- An adventure session changes a relationship. Story Studio stores it in a
  session/story snapshot rather than mutating the library character.

This loop should always be explicit. Never silently mutate stored cards from
draft prose.

## MVP Scope

### Must Have

- Stories gallery.
- Story Studio page.
- Story object with scene chunks.
- Create story from blank, character, world, adventure template, or adventure
  session.
- Select active cards for a scene.
- Basic card codex panel.
- Mention detection from card names, aliases, and triggers.
- AI `Continue`, `Rewrite`, `Expand`, `Condense`, `Critique`.
- Staged AI output with accept/retry/discard/stash.
- Context preview summary.
- Save/load stories.
- Lightweight export or copy as Markdown.

### Should Have

- Generate from selected adventure turns.
- Scene snapshots before AI rewrites.
- Word count per scene and story.
- Focus mode.
- Staged card update suggestions for aliases/triggers.
- Lorebook activation preview reuse.

### Could Have

- Scene card board.
- Goals.
- Custom prompt presets.
- Full prompt preview.
- Diff viewer.
- Extract new lorebook entries from story text.
- Appearances per card.

### Not Yet

- Rich collaboration.
- Public publishing.
- PDF/EPUB typesetting.
- Full print formatting.
- Marketplace.
- Deep screenplay conversion.
- Mobile offline writing.

## Historical phased plan — superseded delivery sequence

The four phases below preserve the June MVP proposal. They are not completion statuses or current scheduling commitments. Some Phase 1/2 pieces exist, while recovery, export, card extraction, scene organization and novel chat remain incomplete. Use the D1–D6 [current roadmap](../novel_refactor/14_status_and_roadmap.md) for dependency order and gates. Shared reviewer access/collaboration is excluded from the current target.

### Phase 1: Story Studio MVP

Goal: users can write prose with AI from existing cards.

Deliverables:

- Story gallery and Story Studio route.
- Story and scene CRUD.
- Active card selection.
- Basic card codex panel.
- AI continue/rewrite/expand/condense/critique.
- Generation candidates with accept/retry/discard/stash.
- Context preview summary.
- Markdown export/copy.

Success criteria:

- A user can select a character and world, create a scene, generate prose, revise
  a paragraph, and save the story.
- A user can open an adventure session and draft a prose recap using session
  snapshot cards.
- The UI shows which cards were used for an AI generation.

### Phase 2: Codex Feedback Loop

Goal: story text and cards improve each other.

Deliverables:

- Mention decorations.
- Alias/trigger suggestions.
- Extract card updates from prose.
- Create lorebook entries from scene facts.
- Appearances list per card.
- Lorebook activation trace in Story Studio.
- Diff view for AI rewrites and card updates.

Success criteria:

- A user can write a new fact in a scene and stage a card/lorebook update from
  it.
- A user can see every scene where a character/world is mentioned.
- AI can critique continuity using active cards and lorebooks.

### Phase 3: Planning and Review

Goal: support longer stories without copying full novel tools.

Deliverables:

- Scene board.
- Outline/beat generation.
- Scene status and goals.
- Continuity review.
- Character arc/progression view for selected cards.
- Story-level style guide.

Success criteria:

- A user can organize 10+ scenes.
- AI can identify missing character appearances, unresolved plot threads, and
  card contradictions.

### Phase 4: Export and Sharing

Goal: let users take work out of Magic Worlds.

Deliverables:

- DOCX export if backend support exists.
- Better Markdown export with front matter.
- Print-friendly HTML preview.
- Shareable read-only story preview, if aligned with product direction.

Success criteria:

- Users can write in Magic Worlds and continue elsewhere without lock-in.

## UX Risks and Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Story Studio feels like a pivot | Users came for cards, adventures, and AI storytelling | Position it as "write from your cards"; launch from existing surfaces |
| Too much planning before writing | Writers differ: plotters, pantsers, players, GMs | Quick start first, planning optional |
| AI overwrites user voice | Writers are sensitive to authorship | Diff, accept/reject, stash, provenance, snapshots |
| AI ignores cards | Main feature promise breaks | Context trace, active-card panel, token budget warnings |
| Card data becomes duplicated | Separate story bible creates maintenance burden | Cards are codex; snapshots only when source needs isolation |
| Canon changes accidentally | Draft prose should not mutate world truth | Staged card updates only |
| UI becomes too busy | Writing requires focus | Progressive disclosure and focus mode |
| Long stories degrade performance | Large manuscript text is hard to render and send to AI | Scene chunks, recent-scene context, summaries |
| Secrets leak into prose | Lorebooks may contain spoiler material | Respect reveal rules and show secret warnings |
| General chatbot expectations | Users may expect perfect memory | Show included context and skipped items |

## Implementation Decision Records

### Decision 1: Story Studio Is A Feature, Not A Product Pivot

Story Studio should live inside Magic Worlds navigation and reuse cards,
lorebooks, adventures, character chats, media, and assistant patterns. It should
not create a separate product identity, publishing platform, or marketplace.

### Decision 2: Cards Are The Story Codex

Do not duplicate card data into a separate Codex model for MVP. Use references
to existing cards and snapshots. Add story-specific metadata only when needed:
active refs, mentions, generation history, and staged updates.

### Decision 3: Backend Owns AI Context Assembly

Frontend can preview and request context, but backend should resolve card
content, lorebook activation, session snapshots, token budgets, and prompt
contracts. This keeps Story Studio consistent with adventure and character-chat
AI behavior.

### Decision 4: AI Mutations Are Reviewable — target contract

Manuscript and card/lorebook changes should be proposed until deliberately accepted. The current novel editor has candidate review, but acceptance durability and accidental acceptance behavior remain open findings. Current card/lorebook assistant tools can write bound documents during execution, so this desired contract is not already guaranteed across the app. See [assistant proposal](../novel_refactor/08_ai_assistant_context_and_tools.md).

### Decision 5: Scene Chunks — historical proposal, not current storage

The actual implementation stores chapter Markdown bodies. Independent scenes and structured revision-bound documents remain a planned D2 migration. Preserve chapter IDs, raw bodies, source pins and old generation semantics while migrating; do not infer scene breaks automatically. See [migration plan](../novel_refactor/11_refactor_and_migration_plan.md).

## Open Questions

- **Resolved baseline:** TipTap is already used; Markdown is the persisted body. **TBD:** canonical structured schema, compatibility bridge and stable anchors for the refactor.
- **Actual:** generation-level history exists; acceptance is not manuscript revision history. **TBD:** durable instruction/proposal/revision lineage and any span-level annotations.
- Should story creation from adventure sessions pull stored message history
  from a backend endpoint, or only use the frontend's current turn state?
- How much prompt preview can be safely exposed without leaking system prompts?
- Should card mentions be automatic in MVP or first limited to manual selected
  cards?
- Should lorebook entries be editable inside Story Studio, or opened in
  Lorebook Studio?
- Should stories be private-only forever, or eventually shareable?

## Recommended First Design Brief

Design a Story Studio that opens directly into writing.

First viewport:

- Header with story title, source, save status, word count, focus toggle.
- Center editor with one scene.
- Left compact scene rail.
- Right card codex rail.
- Floating or docked assistant button.

Primary empty state:

- If launched from a card, preselect that card and offer:
  - `Start with a scene`
  - `Ask AI for an opening`
  - `Import recent chat/adventure turn`
- If launched blank, offer:
  - card picker
  - blank scene
  - paste/import text

Primary assistant actions:

- `Continue`
- `Rewrite selection`
- `Expand selection`
- `Critique scene`
- `Ask about active cards`

Primary card codex actions:

- Add/remove active card.
- Open card details.
- Insert card summary.
- Ask AI using this card.
- Show why included.

The first release should feel like a writer sat down at a page with their Magic
Worlds characters standing ready beside it.
