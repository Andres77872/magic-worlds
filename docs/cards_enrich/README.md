# Roleplay Card Enrichment Research

**Status:** Mixed — core cards and item creation are implemented in source; advanced enrichment and adventure item state remain **WIP**. **Source audit:** 2026-10-14. **External research snapshot:** 2026-06-11, retained below without a new external comparison. **Scope:** Local frontend and sibling `magic-worlds-api` contracts, context assembly and test coverage; no deployed-state or model-quality attestation. **Delivery target / owner:** TBD.

## Actual implementation status

This audit supersedes the June research's local-state assumptions. Recommendations and example schemas below remain proposals unless marked implemented here.

| Area | Actual source status | Gap / release condition |
|---|---|---|
| Character/persona, world, adventure-template and item library cards | Implemented, including creators and API models | Adventure surfaces are **WIP / disabled** wherever `VITE_FEATURE_ADVENTURES_ENABLED` is false; local `.env` enabled it while `.env.example` defaults it off |
| First-class items | Implemented: `name`, `alias`, `type`, `rarity`, `description`, `effects`, `requirements`, `limitations`, `origin`, `value`, `category`, `triggers`, cover/theme | Owner/location/condition/use/cost/story details are guided `category` data, not independent relational inventory state |
| Item assistant and media | Implemented: `AssistantCardType` includes `item`; starter actions create, balance and add lore; media accepts `item` | Further quality grading/extraction/actions remain proposed |
| Items in character-chat Codex | Implemented as enabled/disabled frozen card snapshots; shared context assembly reads enabled items | No claim of automated inventory changes, equipment rules or charges; attached context does not create those systems |
| Adventure snapshots | Implemented for persona, cast, worlds and scenario with pinned source versions | No dedicated item collection in `AdventureTemplate` / `SnapshotTemplate`; attaching and evolving item state in adventures remains **WIP** |
| Card triggering and model context | Implemented: session-authorized card index, overview, triggered detail and read-card context tool; metadata carries `matched_card_ids` / `matched_triggers` | Full user-facing per-card included/skipped reason, token accounting and field trace remain **WIP** |
| GM/director cards | **WIP — reusable card type proposed** | Adventure Direction already stores tone, pacing, narration style and player agency in `category`; a separate reusable GM card and policy precedence remain TBD |
| Card versions, drafts, publishing and sharing | Implemented in source for current four card families | Per-session evolution timelines and portable Character Card V2 compatibility are separate proposed work |
| Guided enrichment | Implemented as `category` groups: character motivation/fear/secret, example dialogue and ties; persona agency/boundaries; world sensory/factions/conflict/reveal; adventure opening/stakes/opposition/direction | Advisory quality grading, mechanical enforcement and richer trace remain WIP |
| Aliases | Backend models accept singular `alias`; item UI/type exposes it | Plural `aliases` with dedicated matching rules remains a schema decision; do not add `aliases` or `object_type` to strict request bodies |

Current context assembly includes an overview of all authorized session cards
with descriptions and details; matching a trigger adds a focused detail block
for the matched cards. It is not a whole-library scan or a rule that unmatched
attached cards vanish from the base prompt. The detail builder includes
`race`, `type`, `rarity`, `origin`, `value`, item effect/requirement/limit lists
and category summaries. Media/owner transport fields are sanitized from
read-card snapshots. Full per-card token budgeting is not established by this
implementation.

There is no `cardsEnrich` or `items` page gate in [featureFlags.ts](../../src/shared/featureFlags.ts). WIP enrichment work is missing behavior, not an existing switch that can be turned on. Any independently gated adventure/community/lorebook surface must still be described as **WIP / disabled** in configurations where its flag is false. Local flags do not prove production rollout. See the [project roadmap](../ROADMAP.md).

Evidence: [Item types](../../src/shared/types/item.types.ts), [ItemCreator](../../src/features/creation/item/components/ItemCreator.tsx), [item guided fields](../../src/features/creation/item/fields.ts), [character guided fields](../../src/features/creation/character/fields.ts), [world guided fields](../../src/features/creation/world/fields.ts), [adventure guided fields](../../src/features/creation/adventure/fields.ts), [item creator tests](../../src/features/creation/item/components/ItemCreator.test.tsx), [assistant suggestions](../../src/features/creation/common/components/assistant/suggestions.ts), [character-chat Codex](../../src/features/characterChat/components/CharacterChatCodexPanel.tsx), [adventure types](../../src/shared/types/adventure.types.ts), [backend item model](/home/andres/PycharmProjects/magic-worlds-api/src/models/item.py), [item routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/cards/route_item.py), [card context](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_context.py), [trigger matching](/home/andres/PycharmProjects/magic-worlds-api/src/services/triggers.py), [card-context tests](/home/andres/PycharmProjects/magic-worlds-api/tests/test_card_context.py).

## Roadmap and unresolved gaps

All rows below are **WIP** proposals; owners and dates are **TBD**. Dependency order is a recommendation, not a schedule.

| ID | Priority | Next work | Concrete completion evidence |
|---|---|---|---|
| CARD-1 | P1 | Card quality feedback beyond name/description validation | Agreed warning rubric for vague behavior, missing/broad triggers and effects without limits; warnings are advisory, actionable and tested on actual saved drafts |
| CARD-2 | P1 | Complete context explainability | Extend existing safe trigger metadata with agreed included/skipped source reasons; document baseline overview versus triggered details; UI shows useful attribution without private prompts; token/field trace scope TBD |
| CARD-3 | P2 | Item attachments and state in adventures | Add a strict versioned snapshot contract, creator/picker and in-session editor; preserve library isolation; tests cover source-version pinning, owner/location/state and restart persistence |
| CARD-4 | P2 | Reusable GM/director policy | Build on the existing Direction category; decide a reusable card and precedence against adventure/persona rules; document fields entering prompt assembly and validate observed agency/pacing/consequences |
| CARD-5 | P2 | More focused enrichment/extraction actions | Build on current item balance/lore and adventure stakes actions; define a preview/apply contract for extracting new cards from play and avoid overwriting session/library originals |
| CARD-6 | P3 | Dialogue contract/aliases and compatibility | Example Dialogue already exists in a guided Voice category; decide whether a dedicated portable dialogue field is needed and define plural alias semantics; retain current `type` and singular `alias` until a versioned migration; define native format versus portable Character Card V2 and preserve supported extensions |
| CARD-7 | P3 | Session evolution and clocks | Define a history/clock model distinct from library card versions; persist divergence and reveal state explicitly and test reload/history behavior |

Decisions still TBD: whether item state is in snapshot categories or dedicated fields; item transfer/equip/charge semantics; whether aliases match independently of triggers; quality-warning thresholds; per-card token tracing; GM policy precedence; portable-format support. Guided category fields can express content today, but they do not execute state transitions or enforce game mechanics.

This card-research sub-audit inspected source rather than executing its card/media acceptance flows. Fresh cross-suite checks are recorded in the [review record](../REVIEW_2026-10-14.md); existing card source tests are coverage evidence, not a live acceptance result.

## Purpose

This research defines what matters most in roleplay cards for Magic Worlds:
game master/director cards, character/persona cards, world/place cards,
adventure/scenario cards, item/object/prop cards, and related
lore/threat/faction cards.

The goal is not to make every card longer. The goal is to make cards more useful
during play: easy for a player to choose, easy for the AI game master to use,
easy to activate at the right moment, and easy to edit as the story changes.

External-source comparison below is the June 11, 2026 research snapshot.
The source audit above records current project behavior separately.

## Executive Findings

The most important aspect of a roleplay card is **actionable context**:

> The card must tell the AI or human GM what this thing is, how it behaves, when
> it matters, and what it should cause in play.

Across AI roleplay tools and tabletop RPG prep, the same pattern appears:

- **Identity is the entry point.** Name, type, role, image, and tags make a card
  findable and selectable, but they do not carry the roleplay by themselves.
- **Description is the behavioral core.** Character, world, item, and threat
  descriptions are the most consistently prompt-used fields across AI card
  systems.
- **Opening situation shapes the first turn.** Greetings, first messages,
  scenario text, and adventure premises strongly set response length, voice,
  stakes, and immediate action.
- **Triggers/keywords make cards usable at scale.** Mature AI RP systems use
  keyword activation, scan depth, and token budgets so the prompt gets the right
  cards instead of every card.
- **Motivation and pressure beat encyclopedic lore.** Tabletop GM tools work
  because they give threats impulses, stakes, consequences, and moves. A card
  that creates choices is more useful than a card that only stores facts.
- **Prompt text and UI metadata must stay separate.** Tags, creator notes,
  search labels, ownership, and gallery state are useful in the UI but
  should not be assumed to influence AI behavior unless explicitly inserted.
  This project explicitly includes `rarity` and other selected detail fields
  in card context, as recorded in the audit above.
- **Session copies matter.** Magic Worlds already clones cards into adventure
  snapshots. That is the correct model because roleplay state changes during
  play and should not silently mutate the user's library card.

The most used fields in the broader AI roleplay ecosystem are:

1. `name`
2. `description`
3. `personality` or personality summary
4. `scenario` or current circumstances
5. `first message` / `greeting`
6. `example dialogue`
7. `system prompt` / roleplay direction
8. `post-history instructions`
9. `alternate greetings`
10. `character book` / lorebook entries
11. tags and creator metadata for discovery, not prompting

Magic Worlds currently maps strongly to this pattern through `name`,
`description`, `greeting`, `system_instructions`, `category`, `triggers`,
`image_url`, `theme_song_url`, embedded adventure template cards, and
session-local snapshots. The remaining gaps are adventure item-state integration,
reusable GM/director policy, quality feedback and complete user-facing context traces.
First-class items and character-chat Codex item references now exist.

## Research Sources

External sources:

- SillyTavern Character Design:
  https://docs.sillytavern.app/usage/core-concepts/characterdesign/
- SillyTavern World Info:
  https://docs.sillytavern.app/usage/core-concepts/worldinfo/
- Character Card V1 spec:
  https://raw.githubusercontent.com/malfoyslastname/character-card-spec-v2/main/spec_v1.md
- Character Card V2 spec:
  https://raw.githubusercontent.com/malfoyslastname/character-card-spec-v2/main/spec_v2.md
- Chub AI Character Creation:
  https://docs.chub.ai/docs/the-basics/character-creation
- Chub AI Lorebooks:
  https://docs.chub.ai/docs/advanced-setups/lorebooks
- NovelAI Lorebook:
  https://docs.novelai.net/en/text/lorebook/
- NovelAI Text Adventure:
  https://docs.novelai.net/en/text/textadventure/
- AgnAI README:
  https://github.com/agnaistic/agnai
- D&D Beyond 2024 Free Rules, Creating a Character:
  https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character
- D&D Beyond 2024 Free Rules, Equipment:
  https://www.dndbeyond.com/sources/dnd/br-2024/equipment
- D&D Beyond 2024 Free Rules, Rules Glossary:
  https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary
- Fate SRD, Types of Aspects:
  https://fate-srd.com/fate-core/types-aspects
- Fate SRD, Invoking and Compelling Aspects:
  https://fate-srd.com/fate-core/invoking-compelling-aspects
- Dungeon World SRD, Gamemastering:
  https://www.dungeonworldsrd.com/gamemastering/
- Dungeon World SRD, Fronts:
  https://www.dungeonworldsrd.com/gamemastering/fronts/

Local Magic Worlds sources:

- `README.md`
- `docs/lorebook/README.md`
- `docs/story_telling/README.md`
- `src/shared/types/aiCard.types.ts`
- `src/shared/types/character.types.ts`
- `src/shared/types/world.types.ts`
- `src/shared/types/adventure.types.ts`
- `src/features/creation/character/components/CharacterCreator.tsx`
- `src/features/creation/world/components/WorldCreator.tsx`
- `src/features/creation/adventure/components/AdventureCreator.tsx`
- `src/features/interaction/components/AdventureCardDrawer.tsx`
- `src/features/interaction/utils/adventureSnapshot.ts`
- `src/features/creation/common/components/assistant/suggestions.ts`

## Current Magic Worlds Card Surface

Magic Worlds already has the most important base structure:

- **Character cards**: `name`, `role`, `is_default_persona`, `race`,
  `description`, `greeting`, `system_instructions`, `category`, `triggers`,
  portrait, and theme song.
- **Item cards**: `name`, `alias`, `type`, `rarity`, `description`, `effects`,
  `requirements`, `limitations`, `origin`, `value`, `category`, `triggers`,
  portrait and theme song. Guided Use, Whereabouts and Story sections serialize
  into `category`.
- **World cards**: `name`, `type`, `description`, `category`,
  `triggers`, image, and theme song.
- **Adventure templates**: `name`, `description` as scenario, persona, cast,
  world snapshots, objectives/components through `category`, `triggers`, cover,
  and theme song.
- **Adventure snapshots**: session-local clones of persona, cast, world, and
  scenario that the chat AI reads during play. Edits affect the current
  adventure only.
- **Assistant pattern**: the card assistant can propose or apply structured card
  updates and the frontend deliberately avoids silent form overwrites.

Important local implication:

> Magic Worlds cards are already more than gallery entries. They are promptable
> story context, selectable play pieces, generated media targets, and mutable
> session state.

The enrichment work should strengthen that existing model instead of adding a
separate "campaign wiki" layer for basic card facts.

## What Is Working In AI Roleplay Cards

### Character Cards

SillyTavern and Chub both validate the same practical anatomy:

- The only hard minimum can be `name`, but that only makes a shell.
- The main `description` is permanent prompt context and should contain the most
  important facts.
- Personality, scenario, and first message/greeting materially affect behavior.
- Example dialogue teaches voice, but it can be pruned when chat history needs
  context space.
- Advanced prompt fields are useful, but should be separated from ordinary
  metadata and exposed with care.

Character Card V1 and V2 show the same ecosystem convergence. V1 standardizes
`name`, `description`, `personality`, `scenario`, `first_mes`, and
`mes_example`. V2 adds `creator_notes`, `system_prompt`,
`post_history_instructions`, `alternate_greetings`, `tags`, and
`character_book`.

What works:

- Put durable identity and behavior in `description`.
- Put the immediate scene in `scenario` or the adventure premise.
- Put voice and response shape in `greeting` and examples.
- Put strict behavior rules in system/post-history instructions.
- Use tags for discovery, not AI behavior.
- Use character books/lorebooks for expandable facts that should activate only
  when relevant.

Magic Worlds fit:

- `description`, `greeting`, and `system_instructions` align well with the
  common AI RP fields.
- `role` cleanly separates AI cast members from user personas.
- `triggers` should be treated as activation keys, not merely decorative chips.

### Lorebooks and World Info

SillyTavern, Chub, NovelAI, Character Card V2, and AgnAI all confirm that
lorebooks/world info/memory books are a core pattern.

The recurring fields are:

- entry title/name for organization
- activation keys/keywords
- optional secondary keys or filters
- content inserted into the prompt
- scan depth or search range
- token budget
- insertion order and sometimes insertion position
- constant/always-on entries
- recursive/cascading activation in advanced systems
- source scope such as global, character, persona, chat, or story

What works:

- Keyword activation is the proven base. It is predictable and debuggable.
- Entry content must stand alone because keys and titles usually are not
  inserted.
- Token budget and scan depth prevent context bloat.
- Character-specific and chat-specific lore sources are useful because roleplay
  context differs by scene.
- The app should show why lore activated or was skipped.

Magic Worlds fit:

- `triggers` are already a lightweight version of activation keys.
- Current `card_context.py` includes category names and attribute pairs in
  context details; when a category has pairs, its group description is not
  repeated. This is actual prompt behavior, rather than a future assumption.
- `docs/lorebook/README.md` already recommends deterministic activation traces.
  Card enrichment should reuse that model for cards too.

### Text Adventure and AI Game Mastering

NovelAI Text Adventure mode and AI Dungeon-style play show that a game master
surface needs more than a character profile. It needs a turn contract:

- what kind of input the player can send
- how the AI interprets action versus dialogue versus narration
- how much material the AI needs before play starts
- how the system keeps story direction without taking away player agency

Dungeon World provides the strongest tabletop framing. The GM's job is to
describe concrete situations, use sensory detail, make moves that follow from
the fiction, fill characters' lives with adventure, and play to find out what
happens. Fronts organize threats through dangers, impulses, grim portents,
stakes questions, cast, and impending doom.

What works:

- GM/director behavior should be stored as procedures, not as a fictional
  biography.
- The GM card should create situations that demand response.
- The GM should use prep but should not force a predetermined story.
- Consequences should be visible and tied to player choices.
- The AI should ask "what do you do?" style prompts when a turn needs action.

Magic Worlds fit:

- Adventure template `description` already functions as scenario.
- `category` can already carry objectives, components, NPC notes, or custom
  groups.
- A Direction section already provides tone, pacing, narration style and
  player agency as category attributes. A reusable GM/director card and
  conflict/precedence policy remain proposed.

## What Is Working In Tabletop Roleplay Cards

### Characters and Personas

D&D character creation treats a character as statistics, roleplaying hooks, and
imagination. Appearance, personality, background, species, ability scores, class,
alignment, equipment, and past relationships all provide playable hooks.

Fate aspects show why short, meaningful descriptors are powerful. Aspects work
because they are invoked or compelled when relevant. They are not just labels;
they create permissions, bonuses, complications, and narrative leverage.

Best card pattern:

- identity: name, role, species/type, visual signal
- behavior: wants, fears, habits, beliefs, boundaries
- capability: what they can do in play
- relationship: who they care about, owe, hate, or serve
- pressure: what makes them act now
- voice: how they speak, what they avoid saying
- trigger: when they should enter context

### Worlds and Places

World/place cards work when they are playable at scene level, not when they try
to be full encyclopedias.

Useful world/place content:

- scale: room, building, district, city, region, planet, realm
- genre/vibe: fantasy, gothic, solarpunk, political intrigue, horror, etc.
- sensory texture: sights, sounds, smells, weather, materials
- social forces: factions, laws, taboos, local authorities
- pressure: conflict, scarcity, threat, festival, disaster, invasion
- affordances: what players can do here
- secrets: what is true but not obvious
- triggers: names, aliases, landmarks, factions, slang

Dungeon World fronts validate that places can be active dangers. A cursed place
or dark portal is not backdrop; it has an impulse and moves that change play.

### Items, Objects, and Props

Magic Worlds now has first-class item/object cards. The remaining design work
is to carry those cards into adventure snapshots and provide explicit state
changes; objects often become the most concrete way players interact with the
world.

D&D equipment rules show that useful item records include category, cost,
weight, use, tool capability, and sometimes attunement or limits. D&D's
attunement rule is a strong product pattern: powerful items need ownership,
bonding, and scarcity rules so they do not become always-on noise.

Dungeon World fronts also treat sentient artifacts, ancient spells, gates, and
cursed places as dangers when they can push the story forward.

Fate treats an important possession as a valid aspect. That is the right lesson:
an item card should define what the item lets the player do and what trouble it
creates.

Useful item card content:

- identity: name, type, visual details, owner/location
- function: what it does, in plain language
- activation: how it is used, triggered, bonded, charged, spoken to, broken
- cost: charges, cooldown, sacrifice, attention, corruption, debt
- limits: who can use it, where it fails, what it cannot solve
- history: who made it, why it matters
- hooks: who wants it, what secret it reveals, what danger follows it
- state: intact, damaged, missing, cursed, awakened, spent
- triggers: aliases, inscriptions, owner names, item category, unique effects

### Item / Object Card Design

An item/object card should cover every playable non-character thing: weapons,
tools, keys, relics, vehicles, books, letters, portals, machines, containers,
clues, ritual components, treasures, hazards, and important mundane props. The
card should answer two questions faster than prose lore can:

1. What can the player do with this object?
2. What changes in the fiction when they do?

The design should use `item` as the product label when the object can be owned,
equipped, spent, traded, or carried. Use `object` when the thing is fixed,
environmental, architectural, or too large to own. Use `prop` as the broader
creative category for scene dressing that can become important later. Internally
these can share one card type with an `object_role` field.

#### Item / Object Taxonomy

Use a small taxonomy so the assistant, gallery, and prompt builder know how to
treat the card:

| Role | Meaning | Examples | Prompt behavior |
| --- | --- | --- | --- |
| `equipment` | Carried or worn by a character | sword, cloak, medkit, lockpicks | Include with owner/persona when relevant |
| `consumable` | Spent or depleted by use | potion, scroll, battery, ration | Track quantity and spent state |
| `key` | Opens access or resolves a lock | brass key, sigil, password tablet | Activate near matching doors, gates, barriers |
| `clue` | Reveals information | letter, bloodstain, broken lens | Activate during investigation and recap |
| `artifact` | Powerful unique object | cursed crown, star engine, oracle mirror | Always include costs, limits, and temptation |
| `container` | Holds other objects or secrets | chest, vault, satchel, coffin | Track contents, locked state, ownership |
| `vehicle` | Moves characters through space | airship, horse cart, mech, boat | Track location, damage, crew, fuel |
| `structure` | Fixed environmental object | portal, altar, bridge, tower | Treat as place-adjacent object |
| `hazard` | Object that creates risk | trap, unstable crystal, reactor core | Include trigger, warning signs, consequence |
| `mundane_prop` | Flavor object that can become useful | mug, rope, candle, book | Keep concise; do not over-inject |

This taxonomy prevents every object from being treated as a magic artifact. A
letter, a lock, and a cursed blade all need different prompt behavior.

#### Core Fields

The following is a proposed richer schema, not the current API DTO. Current
first-class fields are `type`, `effects`, `requirements`, `limitations`,
`origin`, `value`, plus shared fields. Use/owner/location/condition/story
fields currently serialize into `category`. Adding any proposed field to the
strict API request requires an explicit schema change.

The richer item/object card could include:

- `name`: Unique readable name.
- `object_role`: Taxonomy value such as `equipment`, `clue`, or `artifact`.
- `object_type`: Human label such as sword, letter, portal, engine, book.
- `description`: Appearance plus the one-sentence reason it matters.
- `function`: What it does in play.
- `interaction`: How the player can use, inspect, activate, repair, break,
  trade, unlock, equip, combine, or avoid it.
- `activation`: Required phrase, key, ritual, tool, location, time, owner, or
  condition.
- `cost`: Charges, time, attention, sacrifice, risk, debt, noise, corruption, or
  other tradeoff.
- `limits`: What it cannot do, where it fails, who cannot use it, cooldowns,
  attunement, carrying limits, or social consequences.
- `owner`: Current character, faction, location, or "unknown".
- `location`: Current known place, room, world, or session snapshot location.
- `contents`: Optional child object names or ids for containers.
- `state`: Current condition such as intact, locked, hidden, revealed, damaged,
  depleted, attuned, cursed, awakened, missing, destroyed.
- `secrets`: Facts that should not be revealed until a condition is met.
- `reveal_conditions`: What causes secrets to enter the prompt or narration.
- `story_hooks`: Who wants it, what danger follows it, and what dilemma it
  creates.
- `triggers`: Names, aliases, inscriptions, owners, effects, places, and
  related locks.
- `category`: Existing flexible Magic Worlds attribute groups.
- `image_url` and `theme_song_url`: Useful for gallery recognition and mood,
  but not a substitute for playable text.

Minimum viable item/object card:

- `name`
- `object_role`
- `object_type`
- `description`
- `function`
- `owner` or `location`
- `state`
- `triggers`

Do not require every advanced field at creation time. A quick "object in this
scene" card should be possible with four or five fields, then enriched later by
the assistant.

#### Object State Model

Objects need state more than most cards because players constantly change them.
The state should live in the adventure snapshot when used in a session.

Recommended state values:

- `unknown`: Mentioned but not inspected.
- `hidden`: Exists but characters have not found it.
- `visible`: Present in the scene.
- `carried`: Owned or carried by a character/persona.
- `equipped`: Actively worn or wielded.
- `locked`: Requires a key, method, condition, or force.
- `open`: Container, portal, or mechanism is open.
- `spent`: One-use object has been used.
- `depleted`: Quantity, charge, fuel, or ammunition is gone.
- `damaged`: Still exists but impaired.
- `repaired`: Restored after damage.
- `attuned`: Bonded to a character or user.
- `cursed`: Carries an active negative effect.
- `awakened`: New function or personality is active.
- `destroyed`: No longer usable.
- `missing`: Removed from known location.

State changes should be written as explicit facts, not inferred only from chat
history. Example: "The Silver Key is carried by Mara, has opened the north gate,
and is now warm to the touch." That short state summary is more prompt-useful
than a long transcript excerpt.

#### Prompt Assembly Rules

Use item/object cards in prompt context only when they are likely to affect the
next turn.

Always include:

- objects carried or equipped by the active persona
- objects visible in the current scene
- objects directly named by the user
- objects selected/pinned by the user
- keys or clues tied to the current lock, mystery, or objective
- hazards that can immediately harm or constrain the scene

Conditionally include:

- object history when the user inspects, researches, or asks about it
- secrets only after `reveal_conditions` are satisfied
- costs and limits when the object is being used or considered
- owner/faction hooks when social conflict is relevant

Usually skip:

- mundane props not named by the user
- objects in distant locations
- objects already destroyed or spent unless recap is needed
- full history for equipment that is only being carried
- gallery tags, rarity labels, and creator metadata

The prompt block should be concise:

```text
Object: Silver Gate Key
Role: key
State: carried by Mara; opened the north gate; warm to the touch
Function: Opens gates marked with the crescent seal.
Limits: Works once per moonrise; cannot open unmarked locks.
Hooks: The gatewardens can sense when it is used.
```

This is more useful than a decorative paragraph because it gives the AI
permissions, constraints, and consequences.

#### UI Design

The item/object creator should be faster than the character creator because many
objects are created during play.

Recommended sections:

- **Identity**: name, object role, object type, image.
- **Use**: function, interaction, activation.
- **Limits**: cost, charges, cooldown, attunement, failure cases.
- **Where It Is**: owner, location, carried/equipped/visible state.
- **Secrets & Hooks**: reveal condition, who wants it, danger or dilemma.
- **Triggers**: aliases, inscriptions, owner names, related locks/places.

Creation modes:

- **Quick object**: name, role, location/owner, one-line function.
- **Playable item**: quick object plus cost, limits, state, triggers.
- **Artifact**: playable item plus secrets, hooks, attunement, side effects.
- **Clue**: description, visible evidence, hidden meaning, reveal condition.
- **Container**: locked/open state, contents, access method, trap/hazard.

The in-session drawer should support common state changes without opening the
full editor:

- move to location
- give to character
- equip/unequip
- mark spent/depleted
- damage/repair
- reveal secret
- add/remove contents
- pin to current scene

#### Assistant Actions

The card assistant should offer item/object-specific operations:

- "Make this object playable."
- "Add a cost and limit."
- "Turn this clue into a fair mystery clue."
- "Add three activation triggers."
- "Create a reveal condition for the secret."
- "Add a consequence for using it."
- "Summarize current state from the last scene."
- "Extract objects from this adventure turn."
- "Create a matching lock, owner, faction, or location."

Assistant output should avoid two common failures:

- Do not make every object magical or unique.
- Do not add powerful effects without cost, limit, state, and consequence.

#### Example Item / Object Cards

```text
Name: Silver Gate Key
Role: key
Type: engraved key
Description: A narrow silver key with a crescent seal cut into the bow.
Function: Opens gates marked with the crescent seal.
Activation: Must be turned while moonlight touches the lock.
Cost: Works once per moonrise.
Limits: Cannot open ordinary locks or gates without the crescent seal.
Owner: Mara
State: carried; north gate opened; warm to the touch
Triggers: silver key, crescent seal, moon gate, north gate
Hook: Gatewardens can sense every use.
```

```text
Name: Broken Surveyor's Lens
Role: clue
Type: cracked brass lens
Description: A cracked lens smelling faintly of ozone, found near the collapsed
observatory stair.
Function: Reveals that the blast came from below, not from the sky.
Activation: Inspect under blue flame or compare with the observatory map.
Cost: None, but handling it leaves glittering dust on the fingers.
Limits: Does not identify the saboteur by itself.
Location: observatory ruins
State: visible; unrevealed clue
Triggers: lens, surveyor, observatory, blue flame, blast
Reveal condition: Player inspects the lens, tests it, or asks about blast
direction.
```

```text
Name: Saint Orven's Bell
Role: artifact
Type: hand bell
Description: A blackened silver bell that rings without sound in the hands of a
liar.
Function: Forces oathbreakers in the room to hear the voice of the person they
betrayed.
Activation: Ring it while naming a broken promise.
Cost: The ringer must confess one true guilt aloud.
Limits: Fails against creatures that cannot remember or understand promises.
Owner: Cathedral vault
State: locked away; cursed; not attuned
Triggers: bell, Orven, oath, promise, cathedral vault
Hook: Three factions want it for mutually incompatible trials.
```

#### Local Magic Worlds Fit

The current app already provides an item creator, gallery/picker, assistant,
media generation and character-chat Codex references. Continue incrementally:

1. Retain guided item `category` groups and first-class effect/limit fields.
2. Define item attachments and state for adventure snapshots (WIP).
3. Add previewed object extraction from play (WIP).
4. Add explicit state transitions only after their ownership, persistence and
   library-isolation rules are agreed (TBD).

The strongest first implementation is not a full inventory system. It is a
playable object card that can be selected, triggered, edited in the session
snapshot, and summarized into the prompt with function, state, cost, and limits.

## Most Important Card Anatomy

The ranked anatomy below is the practical answer to "what is most important in
roleplay cards?"

| Rank | Card aspect | Why it matters | Magic Worlds status |
| --- | --- | --- | --- |
| 1 | Actionable description | Permanent context that tells the AI what the card is and how it behaves | Present for characters, worlds, adventures and items |
| 2 | Immediate use case | The scene, greeting, premise, or action loop where the card starts being useful | Present as greeting and adventure scenario, weaker for worlds |
| 3 | Motivation/impulse | Drives behavior when the user does something unexpected | Character motivation/fear/secret and world conflict have guided category fields |
| 4 | Triggers/aliases | Focuses context on relevant attached cards | Existing overview includes attached cards; `triggers` add matched detail; full trace/quality feedback WIP |
| 5 | Constraints/costs | Prevents powers, items, NPCs, and GM actions from becoming arbitrary | Items have first-class effects/requirements/limitations and guided costs; other card rules are freeform/category |
| 6 | Relationships | Creates emotional and plot hooks | Guided Allies/Rivals/Bonds category fields; no relational campaign model |
| 7 | Voice/examples | Teaches style and response shape | Greeting/system instructions, narration voice and guided Example Dialogue category exist; portable dialogue contract TBD |
| 8 | Structured attributes | Scannable facts for UI and prompt assembly | Present as `category` |
| 9 | Media | Improves browsing, recognition, inspiration, and generated asset continuity | Present through image/theme |
| 10 | Metadata | Search, privacy, versioning, source, ownership, tags | Visibility, source creator, versions/drafts and workspace organization exist; proposed schema below is not the wire contract |

The strongest card is not the longest card. It is the card with:

- a compact permanent identity
- a clear behavior model
- a reason to enter the current scene
- an activation path
- a consequence or affordance that changes play

## Most Used Card Types

### 1. Character / NPC Card

Most used because roleplay revolves around dialogue, identity, relationships,
and agency.

Minimum useful fields:

- name
- role: AI character or user persona
- species/type/race
- description
- greeting or first scene line
- motivation
- voice notes
- triggers

Recommended enrichment:

- wants
- fears
- secrets
- relationships
- speech style
- do/don't behavior rules
- example dialogue
- current state in this session

### 2. Persona / Player Character Card

Most important for grounding the user as a participant, especially when the AI
needs to address the character rather than the account holder.

Minimum useful fields:

- name
- identity/species/background
- what the persona wants
- how they act under pressure
- relationship to the cast/world
- default persona flag

Recommended enrichment:

- boundaries and agency rules: what the AI should not decide for the player
- preferred pronouns and address style
- known skills and limitations
- secrets known by the persona
- session state overrides

### 3. World / Place Card

Most used for setting context and media generation.

Minimum useful fields:

- name
- place type/scale
- genre/vibe
- description
- key details
- triggers

Recommended enrichment:

- factions
- local laws or taboos
- sensory anchors
- active conflict
- secrets
- travel/entry constraints
- scene affordances
- weather/time/state

### 4. Adventure / Scenario Card

Most used for starting play and giving the AI a coherent opening contract.

Minimum useful fields:

- premise
- selected persona/cast/world
- opening scene
- objective or unresolved question
- triggers

Recommended enrichment:

- inciting incident
- stakes
- ticking clock
- opposition
- likely locations
- failure consequences
- moral choice
- scene beats as suggestions, not a forced plot
- GM/director style

### 5. Item / Object / Prop Card

Present as a first-class Magic Worlds card. Adventure inventory and state
transitions remain WIP. Items and objects matter because players can touch,
trade, lose, break, activate, steal, inspect, or sacrifice them.

Minimum useful fields:

- name
- object role
- object type
- appearance
- function
- interaction
- owner/location
- state
- limits/cost
- triggers

Recommended enrichment:

- activation condition
- charges/cooldown/attunement/bond
- side effects
- clue text or inscriptions
- who wants it
- current state summary
- reveal conditions for secrets
- contents for containers
- linked lock, place, owner, faction, or objective
- story consequence if ignored or used

### 6. GM / Director Card

This is not a common portable character-card standard, but it is the clearest
missing reusable Magic Worlds card type. The existing adventure Direction
category already carries tone/pacing/narration/agency. A reusable card would
behave like a rule and style profile
for the AI game master.

Minimum useful fields:

- name: "Cinematic GM", "Cozy Mystery Keeper", "Hard Moves Dungeon Master"
- genre and tone
- narration style
- agency rules
- pacing rules
- consequence policy
- question policy
- safety/content boundaries
- mechanical strictness

Recommended enrichment:

- turn loop: describe situation, resolve action, show consequence, ask for next
  action
- allowed GM moves
- forbidden GM moves
- combat/rules detail level
- randomness policy
- how to handle player silence
- how to use card context
- how to escalate stakes
- how to summarize and preserve state

The GM card should not be another NPC. It should be a reusable director profile
that controls how adventures are run.

## Card Enrichment Model

Every roleplay card should be enriched along five dimensions:

1. **Identity**: What is it?
2. **Behavior**: What does it do?
3. **Activation**: When should it matter?
4. **Interaction**: How can the player affect it?
5. **State**: What has changed during this session?

### Identity

Identity supports browsing, selection, media generation, and prompt grounding.

Fields:

- name
- card type
- subtype: race, place type, item type, faction type, threat type
- visual description
- image/theme links
- aliases
- tags

### Behavior

Behavior is what makes the card roleplay-capable.

Fields:

- motivation
- impulse
- voice
- methods
- capabilities
- limitations
- relationships
- conflict style
- roleplay rules

### Activation

Activation determines when context enters the prompt.

Fields:

- triggers
- aliases
- scan scope
- priority
- always-on or situational
- source: library, template, session snapshot, lorebook, manual selection
- skipped reason when not inserted

### Interaction

Interaction makes the card playable.

Fields:

- actions players can take
- offers/opportunities
- costs/consequences
- checks or conditions
- choices the card naturally creates
- what changes if the player ignores it

### State

State makes play continuity possible.

Fields:

- current location
- current owner
- attitude
- damage/condition
- revealed secrets
- spent charges
- relationship changes
- active clocks/portents
- session-specific notes

Magic Worlds already isolates persona/cast/world/scenario in adventure
snapshots and attached Codex cards in character chats. The missing step is
defining adventure item state and explicit transitions without corrupting
library originals; a guided owner/location category is not an inventory engine.

## Prompt Usage Rules

### Use Three Prompt Layers

The layers below are design guidance. Current implementation supplies the
session-card overview plus trigger-focused detail and authorized read-card
context; it does not implement every scan/budget policy described here.

1. **Always-on card core**
   - Short identity and essential behavior.
   - Example: character name, compact description, key roleplay direction.

2. **Activated context**
   - Triggered by user text, scene text, selected cards, or lorebook keys.
   - Example: world detail, item history, secret faction, active threat.

3. **Session state**
   - Latest adventure snapshot and explicit play changes.
   - Example: the sword is broken, the NPC now trusts the player, the gate is
     open.

This is safer than putting every fact into one permanent prompt block.

### Keep Prompt and Metadata Separate

Prompt-used:

- description
- greeting
- scenario
- system/roleplay instructions
- selected attributes
- activated lore entry content
- active state summaries

Usually not prompt-used:

- creator name
- creator notes
- tags
- gallery labels
- privacy status
- version
- UI-only category names unless included with values
- internal IDs

The Character Card V2 spec and SillyTavern docs both reinforce this distinction.
Magic Worlds should preserve it in imports/exports and prompt assembly.

### Add Context Traces

Current backend turn metadata already includes safe matched card IDs and
trigger keywords. The following richer trace is proposed (WIP), including
user-facing inclusion/skipping reasons and token/field accounting:

Every generated turn should be explainable:

- cards included
- cards skipped
- why each card was included: selected, persona, cast, world, trigger, manual,
  lore activation, pinned, or session state
- prompt fields included per card
- token estimate per card
- skipped reason: no trigger match, token budget, disabled, lower priority,
  duplicate, stale snapshot, missing description

This is the fastest way to debug "the AI ignored my card."

## Card Quality Rubric

Use this rubric for AI card generation, assistant feedback, and validation
warnings.

| Score | Meaning | Signals |
| --- | --- | --- |
| 0 | Empty shell | Name only, no description, no trigger, no role |
| 1 | Displayable | Has identity and image/tag metadata, but weak behavior |
| 2 | Promptable | Has description and enough facts to answer basic questions |
| 3 | Playable | Has motivation, interaction hooks, triggers, and constraints |
| 4 | Scene-ready | Has opening situation, stakes, relationships, and state hooks |
| 5 | Campaign-ready | Has activation rules, session-state model, conflicts, secrets, and evolution paths |

Validation warnings should focus on play usefulness:

- Missing description.
- Description is pure appearance with no behavior.
- No trigger keywords.
- Trigger too broad, such as "the" or "magic".
- Trigger not mentioned in description.
- Item/object has powers but no cost or limit.
- World has atmosphere but no conflict or playable affordances.
- Character has backstory but no present desire.
- Adventure has premise but no immediate first scene.
- GM/director card has tone but no turn procedure.
- Card has secrets but no reveal rule.
- Session snapshot is diverging from the library card, which may be intended.

## Recommended Magic Worlds Card Fields

### Common Card Fields

This is a proposed target schema. Current DTOs are source-defined and strict;
`aliases`, generic `card_type`, and renamed timestamps are not guaranteed wire
fields. Ownership, visibility, draft/version and organization projections
already exist and should be reused.

The target shared concepts are:

- `id`
- `source_card_id` for clones
- `card_type`
- `name`
- `aliases`
- `description`
- `category`
- `triggers`
- `image_url`
- `theme_song_url`
- `visibility` or privacy if cards are shared later
- `created_at`
- `updated_at`

### Character Fields

Keep:

- `role`
- `is_default_persona`
- `race`
- `greeting`
- `system_instructions`

Already supported through guided categories; these are content concepts, not
first-class request keys:

- `motivation`
- `fear`
- `secret`
- `voice`
- `relationships`
- `boundaries`
- `example_dialogue`
- `current_state` for snapshots (a richer explicit state model remains proposed)

### World Fields

Keep:

- `type`
- `category` (guided sensory/factions/conflict/secrets/scenes content)

A separate `place_type` field is a proposal; it is not accepted by the current
strict World model.

Add or support through categories:

- `scale`
- `sensory_anchors`
- `factions`
- `conflicts`
- `laws`
- `secrets`
- `affordances`
- `current_state`

### Adventure Fields

Keep:

- `description` as scenario
- `persona`
- `characters`
- `world`
- `category` for objectives/components

Add or support through categories:

- `opening_scene`
- `stakes`
- `ticking_clock`
- `opposition`
- `failure_consequences`
- `gm_director_card_id`
- `scene_beats`
- `state_summary`

### Item / Object Fields

A first-class `item` type already exists. Proposed richer concepts below are
additional design options; current `effects`, `requirements`, `limitations`,
`origin`, `value` and guided category groups cover part of them:

- `object_role`
- `object_type`
- `appearance`
- `function`
- `interaction`
- `owner`
- `location`
- `contents`
- `activation`
- `cost`
- `limits`
- `charges`
- `attunement`
- `side_effects`
- `history`
- `hooks`
- `state`
- `secrets`
- `reveal_conditions`
- `linked_cards`

Current stored subtype is `type`. The research names `object_type` and
`item_type` are proposed naming/compatibility options, not accepted current
request fields. A rename would require a versioned migration decision.

Pragmatic path:

1. Reuse the current first-class item creator, assistant (`AssistantCardType`
   already includes `item`), media and Codex attachment support.
2. Define adventure item snapshot/state support before adding inventory-like
   transitions. Keep extra descriptive content in guided categories meanwhile.

### GM / Director Fields

Add as a new card type or adventure-level policy:

- `tone`
- `genre`
- `narration_style`
- `player_agency_rules`
- `turn_loop`
- `allowed_moves`
- `forbidden_moves`
- `consequence_style`
- `pacing`
- `rules_strictness`
- `question_policy`
- `safety_boundaries`
- `context_policy`

Pragmatic path:

1. Reuse current Direction category values (tone, pacing, narration style and
   player agency) and agree precedence against persona/system rules.
2. Convert repeated styles into reusable GM/director cards (WIP).
3. Define attachment/version semantics for a GM/director card on an adventure
   template or session (TBD).

## Assistant Generation Guidance

The card assistant should stop generating "more lore" by default. It should
generate more playable card structure.

Good assistant prompts by type:

- Character: "Add a current desire, secret, and roleplay voice without changing
  the core identity."
- Persona: "Clarify what the AI may not decide for this player character."
- World: "Add three scene affordances, two factions, and one active conflict."
- Adventure: "Add a ticking clock, opposition, and failure consequence."
- Item/object: "Add activation, cost, limitation, current state, and a
  complication."
- GM/director: "Define a turn loop and allowed GM moves for this tone."

Bad assistant behavior:

- Expanding every card into long prose.
- Adding secrets without reveal conditions.
- Adding powers without costs.
- Adding triggers that are too broad.
- Mutating player persona agency.
- Treating tags as prompt instructions.
- Overwriting session snapshots with library state.

## Product Recommendations

The older phase labels below are a proposed work sequence, not completed
release milestones. The dated roadmap above is the authoritative gap list;
all outstanding capabilities remain WIP/TBD.

### MVP Priority

1. **Card quality warnings**
   - Missing description, no triggers, broad triggers, no motivation, no cost for
     item/object-like cards.

2. **Trigger explainability**
   - Show why a card entered the adventure/chat context.

3. **Card enrichment assistant actions**
   - Add motivation, stakes, scene affordances, triggers, and constraints.

4. **Reusable GM/director policy** — WIP
   - Extend the existing guided Direction category with agreed precedence and
     reusable policy semantics before creating a new card type.

5. **Item/object component support**
   - Extend existing item cards into adventure-template/snapshot attachments
     with explicit state semantics (WIP).

### Phase 2

1. **Adventure item state** — WIP
   - First-class library creator/gallery/assistant/media and character-chat
     Codex attachment exist; adventure item attachment and state editing remain
     to be defined.

2. **First-class GM/director cards**
   - Reusable game master profiles attachable to adventures.

3. **Card context trace panel**
   - Active, skipped, pinned, triggered, and token-trimmed cards.

4. **Example dialogue portability** — TBD
   - Guided Example Dialogue already exists in the Voice category. Decide a
     dedicated token-aware/portable schema only if required.

5. **Alias matching rules** — TBD
   - Singular `alias` already exists in backend models; decide plural aliases
     and name resolution separately from existing contextual triggers.

### Phase 3

1. **Session card evolution history** — WIP
   - Library drafts/versions and pinned source versions exist; a timeline of
     session divergence remains a separate feature.

2. **Import/export compatibility**
   - Character Card V2 import/export with extension preservation.

3. **Card extraction from play**
   - Turn newly introduced NPCs, places, items, or objects into draft cards.

4. **Stateful clocks and portents**
   - Threat/faction/world cards can advance through visible states.

## Remaining product work

The winning roleplay card is a compact, active play object:

- It has a name and identity so users can find it.
- It has description and behavior so the AI can portray it.
- It has triggers so it appears at the right moment.
- It has motivations, costs, stakes, or affordances so it changes play.
- It has session state so the story can remember what happened.

For Magic Worlds, the immediate opportunity is to enrich existing cards with
activation, motivation, constraints, and state rather than just adding longer
descriptions. Character, world, and adventure cards are already in the right
shape. Item/object cards now exist. The remaining work is adventure item state,
GM/director policy, quality feedback, and visible context attribution. Dates,
owners and schema decisions remain TBD in the roadmap above.
