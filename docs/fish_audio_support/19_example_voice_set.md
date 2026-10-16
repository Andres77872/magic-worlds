# Example Fish voice set — development handoff

October 15, 2026. The owner asked for example Fish voices in the catalogue,
in Spanish and English, published after automatic checks. This adds twelve
original voices designed with Fish voice design. They complement Gabriel, the
licensed Spanish narrator, and they are separate from the seven unapproved
licensed auditions, which remain admin-only drafts.

## What was created

Six roleplay archetypes per language, three female and three male: narrator,
young heroine, elder, rogue, veteran warrior and villain. Spanish voices use a
neutral Latin American accent, matching the ElevenLabs starter set; the English
set is American except the elder and the sorcerer, which are British for variety.
Each catalogue entry is one distinct provider voice: a private, signed Fish
`voice_design` model plus its owned preview and Drama 3 showcase sample.
Emotions remain preset choices and never create catalogue voices.

| Voice | Lang | Traits | Design pitch (Hz) | Rendered pitch (Hz) | LUFS | Gain (dB) | Voice key |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Lucía · Narradora | es | female, adult, latin american | 222 | 229–250 | -16.8 | -1.2 | `vk_b2181fd85907a0cea6cb88ee52e96be6` |
| Valeria · Aventurera | es | female, young, latin american | 320 | 302–320 | -16.8 | -1.2 | `vk_7d40266cc3788e93605e70375faaea55` |
| Rosa · Abuela sabia | es | female, elder, latin american | 178 | 174–182 | -17.4 | -0.6 | `vk_a4015d8b79067cc65e387c682264d7b2` |
| Mateo · Pícaro | es | male, young, latin american | 133 | 131–140 | -18.5 | 0.0 | `vk_76dc441b8db06648b4170dd931e025b7` |
| Bruno · Guerrero veterano | es | male, elder, latin american | 136 | 131–146 | -18.9 | 0.0 | `vk_cde94a513904a1119da77db1497be40a` |
| Damián · Hechicero oscuro | es | male, adult, latin american | 170 | 157–182 | -20.3 | 0.0 | `vk_6c7354ac04f630d60d94d8b5efeb1b46` |
| Claire · Storyteller | en | female, adult, american | 205 | 205–242 | -17.2 | -0.8 | `vk_2fc736ee99c32d494c56dea8bf3fe562` |
| Maya · Adventurer | en | female, young, american | 229 | 235–320 | -16.6 | -1.4 | `vk_fe8bda1d63c7fe0f200c015890f0df0b` |
| Agnes · Wise elder | en | female, elder, british | 163 | 160–190 | -20.2 | 0.0 | `vk_f9061fa2919c2c8f00d89f37d5b0be87` |
| Jack · Rogue | en | male, young, american | 101 | 86–148 | -17.7 | -0.3 | `vk_bed5048ceedb5be0492bb298cdf6cce1` |
| Harlan · Veteran warrior | en | male, elder, american | 118 | 95–182 | -16.7 | -1.3 | `vk_4add7df9dfc143f849679f97f062ad7b` |
| Silas · Dark sorcerer | en | male, adult, british | 127 | 104–157 | -19.8 | 0.0 | `vk_84f73090c35bec4d45552a9ca99b303b` |

Design pitch is the median of the chosen design candidate; rendered pitch is the
range of the four Drama 3 acceptance clips. Loudness is the integrated
loudness of the narration, dialogue and numbers acceptance clips together; the
gain is the stored attenuation toward −18 LUFS.

## How the voices were checked

`scripts/voice_catalog/fish_set.py` in `magic-worlds-api` runs the same service
functions as the root console, with its spec in `fish_set.spec.json`:

1. One `voice-design-1` request per voice for two candidates ($0.01 per request).
2. A signed, unclipped candidate whose median pitch fits its gender band
   (male 60–175 Hz, female 145–400 Hz) is saved as a private signed model and
   a `designed` draft. The pitch check only rejects an obvious gender mismatch.
   It does not judge age, accent or quality.
3. Drama 3 renders the four `acc-v1` acceptance scripts in the voice's language.
   The voice passes when every clip is audible and the measured loudness allows
   the existing gain rule (−12 LUFS or quieter), as in the ElevenLabs starter set.
4. The verdict stores no numeric scores. An `acceptance_auto_note` catalogue event
   records that nobody listened, with the loudness and candidate pitch.
5. The owned showcase is rendered and the voice is published (`active`/`public`).

The run designed each voice once, with no rejected candidates or retries.

**Review finding.** The run took the first fitting candidate. For Damián, designed
as a low villain, that was a 170 Hz candidate whose Drama 3 clips render at
157–182 Hz, the 145–175 Hz overlap where a voice can read as either gender. His
other candidate measured 99 Hz. The script now prefers a fitting candidate
outside that overlap and falls back to provider order only when none exists.
Damián stays published until the owner listens. Agnes (160–190 Hz) is plausible
for an elderly woman but also sits in the overlap.
Its estimated supplier cost was about $0.33, within the $1 development daily
budget. Request-level debit reconciliation remains the open rollout task
recorded in [implementation status](11_implementation_status.md).

## English availability

User preview and narration resolve a Fish voice only when its language is in
`FISH_AUDIO_APPROVED_LANGUAGES`. The development `.env` now lists `es,en`.
The API reads it at launch from the PyCharm run configuration, so English voices
become usable after that run configuration restarts. The earlier English rejection
concerned a licensed reference's metallic sound. These designed English voices
have passed only the automatic checks.

## Listening and hiding

Nobody has listened to these voices yet. A private
[listening page](https://claude.ai/artifact/K6Sutt1RUa6qA3w7rrBs9H) plays each
voice's catalogue sample and character line, flags Damián and Agnes to hear
first, and lets the owner mark voices to keep or hide. In the running app, root
**Voices → Explore voices → Fish Audio** lists all thirteen Fish voices; Spanish
and English catalogue samples returned 200 and played. Fish voices cannot be deleted from the catalogue. Hide one from
**Root → Voice console → Voices**, or with
`PATCH /admin/voices/catalog/{voice_key}` and `{"status": "hidden"}`; setting
`active` again unhides it.

Evidence: [2026-10-15-example-voices.json](evidence/2026-10-15-example-voices.json).
