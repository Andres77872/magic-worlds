# Emotions and performance direction

This is the central authoring guide for the requested Drama 3 integration. Scripts below are original examples for research and listening tests. They are not current Magic Worlds request fields or guarantees of identical audio on every render.

## Separate intent, delivery and events

An emotion describes what a character feels. An intention describes what they want the listener to do or understand. Delivery describes how speech sounds. An event describes a positioned nonverbal action. These often work together, but storing them as one emotion enum loses useful information.

| Layer | Original example | Proposed application representation |
| --- | --- | --- |
| Emotion | Relief after escaping danger | Existing semantic emotion plus optional bounded intensity |
| Intention | Reassure a frightened companion | Approved direction for this utterance |
| Delivery | Speak softly without losing clarity | Utterance delivery or scoped span |
| Local emphasis | Stress the word “north” | A span tied to logical text offsets |
| Event | A sigh before answering | An event at a text boundary |
| Rhythm | Hesitate before admitting the truth | A qualitative pause event, not assumed milliseconds |

Fish's current emotion guide uses bracket cues and accepts natural descriptions rather than a closed tag enum. Drama adds explicit paired delivery spans. The long emotion catalogue is vocabulary for experimentation; Magic Worlds should expose a smaller curated set and an advanced directed workflow only when it has been evaluated. [Emotion guide](https://docs.fish.audio/developer-guide/core-features/emotions), [Drama guide](https://docs.fish.audio/features/text-to-speech/drama-3).

## Begin with one clear direction

Put the performance direction near the utterance it controls. Write an actor brief that is short enough to understand and specific enough to distinguish two takes. Avoid asking for several conflicting intensities in one sentence.

```text
[quietly relieved, trying to reassure a companion] The gate is open. We can leave together.

[guarded and deliberate, hiding uncertainty] I recognize that seal, but I need a closer look.

[warm and playful, inviting an answer] You kept the silver key, didn't you?
```

Compare each with an undirected baseline using the same voice and logical text. Judge whether the delivery changes while the words and identity remain correct. If it does not, simplify the brief before adding more instructions.

For the initial application compiler, propose one primary emotion and one delivery/intent qualifier per utterance, with at most one local event in a short test line. That is an application policy for predictable results, not a provider syntax limit. Broad free-form directions can be offered later to trusted authors with bounded length and evaluation.

## Preserve the seven current emotions

The existing frontend/backend already share seven semantic labels. Keep them readable for old presets and compile them separately for each provider. The following Fish outputs are **proposed initial render choices**, not an API enumeration or an acoustic equivalence claim.

| Existing label | Proposed Fish cue | Calibration concern |
| --- | --- | --- |
| `happy` | `[happy]` | Avoid a laugh unless an event is requested |
| `sad` | `[sad, restrained]` | Speech should remain intelligible |
| `angry` | `[angry, controlled]` | Loudness should not substitute for intent |
| `fearful` | `[scared, trying to stay clear]` | Avoid unrequested gasps and skipped words |
| `disgusted` | `[disgusted, restrained]` | Check for exaggerated vocal artifacts |
| `surprised` | `[surprised]` | Keep the reaction proportional to the line |
| `calm` | `[calm and attentive]` | Distinguish neutral clarity from flat delivery |

The cue words draw on the [emotion guide](https://docs.fish.audio/developer-guide/core-features/emotions); the qualifiers and application mapping are proposed here. Intensity should be a small semantic choice such as restrained/clear/strong, translated by a versioned renderer, rather than a numeric promise that the supplier has a linear emotion-strength control.

For thoughts, use a validated soft or whisper delivery when the content model says “thought.” Do not equate every thought with sadness, or turn every `fearful` preset into shouting. A preset provides defaults; scene context can choose a different bounded performance when explicitly authorized.

## Place local delivery on the intended words

Drama documents these paired delivery tags: `whisper`, `emphasis`, `soft`, `fast`, `slow`, `stress`, and `forceful`. Use a span when only a phrase should change. [Scoped delivery reference](https://docs.fish.audio/features/text-to-speech/drama-3).

```text
[steady and helpful] Follow the river until you reach <emphasis>the second bridge</emphasis>.

[watchful, speaking normally] The guard is close. <whisper>Keep the map inside your coat.</whisper> We will talk outside.

[measured narrator] She answered, <soft>I remember you.</soft> Then the room fell silent.
```

A local whisper should not unintentionally carry into the final sentence. The acceptance corpus should test a normal → scoped change → normal sequence. Initially allow non-overlapping spans only. Nested tags, partial words, invalid boundaries and spans crossing a speaker change should be rejected by the application compiler until deliberately supported.

Paired tags look like markup, but they are a provider input grammar. They belong in compiled provider text, never directly in the ordinary chat transcript or arbitrary HTML rendering.

## Position events and pauses

Bracketed event descriptions belong where their audible effect should occur. Start with simple human reactions, test that they are not read aloud, and avoid adding written reaction words merely to force an effect unless those words are intended spoken content.

```text
[worn out but relieved] We reached the tower. [sigh] I thought the road would never end.

[amused, sharing a small secret] The dragon asked for tea. [small chuckle] I brought the largest cup.

[hesitant, gathering courage] I found the letter. [brief pause] It was addressed to you.
```

The generic emotion guide includes `[break]` and `[long-break]`; Drama also describes pauses in natural language. A descriptive pause has no documented exact duration. If the product needs a precise 700 ms silence, schedule it in an owned audio composition layer and account for it explicitly, rather than promising that a phrase means 700 ms. [Event guidance](https://docs.fish.audio/developer-guide/core-features/emotions).

Events produce audio without corresponding dialogue words. They must remain on the media timeline while being excluded from spoken-word transcript commits. A pause must not inflate credited spoken text, and a sigh must not appear as “sigh” in a conversation transcript unless it was intentionally spoken.

## Spanish and mixed-language content

Drama permits a direction in a language different from the script. Use that to support authors' language preferences, then listen for the same intent rather than assuming translated briefs are identical.

```text
[serena, con alivio contenido] La puerta ya está abierta. Podemos salir juntos.

[calm, with restrained relief] La puerta ya está abierta. Podemos salir juntos.

[curiosa, con una pausa antes de la pregunta] Encontré otra marca en el mapa. ¿Tú sabes qué significa?
```

Keep a multilingual reference voice that actually matches the desired character and accent. Test numbers, abbreviations, accents, names and short responses separately. The application's number expansion already supports English/Spanish; decide once whether application or provider normalization owns each transformation and preserve a mapping back to displayed text.

Phrase-level language tags are documented as experimental. This report deliberately does not invent their syntax from a guessed locale tag. Use the exact current provider documentation and a live fixture before enabling them. A valid XML-like locale name alone is not evidence of a supported tag. [Experimental language switching](https://docs.fish.audio/features/text-to-speech/drama-3).

## Pronunciation for fictional names

Treat pronunciation as a separate concern from emotion. A warmer direction is unlikely to fix a consistently misread name. Prefer a versioned dictionary for repeated proper nouns and a local explicit span for one-off testing.

An original English example, using CMU Arpabet:

```text
[clear and welcoming] Ask <|phoneme_start|>N AO1 R AH0<|phoneme_end|> to bring the lantern.
```

The logical line is “Ask Nora to bring the lantern.” The compiler substitutes pronunciation controls only in provider text and retains the display offsets for “Nora.” Dictionaries use literal substring matching, immutable `(id, version)` references, and a separate inline form. Do not use regex-like keys or wrap a dictionary value in phoneme delimiters when the dictionary engine already does that. [Dictionary guide](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries), [dictionary schema](https://docs.fish.audio/api-reference/openapi.json).

No universal IPA or Spanish phoneme mechanism was established by this research. Use only the documented language-specific alphabet and mark other pronunciations as experiments. Store the validated locale and dictionary version with the preview used for approval.

## Multi-speaker authoring

Author a scene in application cast identities, then compile speaker indices in a deterministic order. Do not let an LLM select raw provider voice IDs or hand-write arbitrary speaker indices.

```text
<|speaker:0|>[measured storyteller] The lantern flickered beside the unopened door.
<|speaker:1|>[quietly determined] I will check the lock. Stay behind me.
<|speaker:2|>[nervous but cooperative] All right. <whisper>Tell me if it moves.</whisper>
<|speaker:1|>[reassuring] I promise.
```

This is compiled Fish input for three references, not ordinary transcript syntax. The speaker array order is part of the request and cache identity. Each turn needs its own logical source range, voice identity and performance. A scene renderer must not reuse a global prefix that accidentally assigns every character the narrator's emotion.

## Trusted performance representation

The following is a **proposed internal application representation**, not a Fish API payload and not a current Magic Worlds DTO:

```json
{
  "version": 1,
  "logical_text": "Keep the map inside your coat.",
  "direction": {
    "emotion": "calm",
    "intent": "reassure"
  },
  "spans": [
    {"start": 0, "end": 30, "delivery": "whisper"}
  ],
  "events": [],
  "pronunciations": []
}
```

Offsets are proposed as zero-based Unicode code points with an exclusive end. The frontend uses UTF-16 indexing, so any editable spans require an explicit conversion at the boundary; emoji and combining marks must be tested. The example spans the complete 30-code-point line. For a production editor, grapheme-safe selection should also prevent visually splitting a combined character.

Compile after validating spoken content and performance metadata. The existing sanitizer should continue to reject/neutralize control syntax in ordinary content. A direction supplied by an author belongs in a separate authorized field with limits and provenance. A direction inferred by an LLM must pass a server-owned schema/allowlist. Neither route should allow raw system tokens, unapproved speaker routing or unbounded reference data.

Keep three artifacts distinct: canonical display text, the trusted performance representation, and the final provider text plus source map. This preserves user-visible transcripts, supplier request identity and interruption accounting while enabling Drama's features.

## Quality workflow

1. Listen to undirected text with the intended reference voice.
2. Change one performance dimension, keeping text and voice fixed.
3. Generate multiple takes to assess variation; native TTS has no verified reproducible seed.
4. Rate word correctness, identity, accent, intention, local scope, events and unwanted sounds separately.
5. Approve a small reusable recipe only after English/Spanish and short/long samples pass.
6. Version the compiler/recipe and retain the evaluated preview's effective configuration.

Do not measure success solely by “sounds emotional.” A useful result follows the requested intent, remains intelligible and respects boundaries. The matrix and proposed pass thresholds are in [09](09_validation_plan_and_roadmap.md).
