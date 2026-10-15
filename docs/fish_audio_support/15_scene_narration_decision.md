# ADR-15: Optional scene narration as one independent asset

**Status:** Accepted for development implementation; R3 release acceptance open  
**Date:** 2026-10-15  
**Deciders:** Implementation within the authorized Fish plan; project owner for acoustic release acceptance

## Context

Fish's [Drama 3 contract](https://docs.fish.audio/features/text-to-speech/drama-3#multi-speaker-dialogue) supports ordered reference arrays and speaker tags in one request. The application already has durable per-segment jobs, one turn charge, authenticated owned assets, text moderation and a segment playback queue. Binary HTTP scenes do not provide verified utterance timestamps. A scene cannot safely be cut into separately billed or volume-adjusted fragments without such timings.

The initial voice catalogue remains Gabriel alone. Development probes of licensed references do not publish additional catalogue entries. Mixed casts and casts needing individual thought volume retain the existing per-segment route.

## Decision

Implement an explicit scene preview of a completed assistant turn as one narration job and one owned audio asset. Use the existing narration budget, admission, settlement, storage and job-status routes. Keep scene state separate from the existing segment queue and its WebSocket metadata. A scene request never rewrites individual voice choices, message text, session snapshots or previously accepted segment assets.

Resolve every utterance's voice and pinned pronunciation versions before cache/admission. Order the cast deterministically, validate indices, preserve logical text and compile routing controls only after moderation. Persist a safe manifest of cast/utterance indices, logical source ranges, voice keys and hashes; keep native reference IDs internal. Cache identity includes the entire cast, utterance order, performance, compiler and renderer versions.

Scene transport explicitly selects Fish's documented signed 16-bit mono PCM at
44.1 kHz. After successful bounded HTTP completion, encode all received samples
to owned 128 kbps MP3 and verify every frame. Native MP3 scenes at longer sizes
had incomplete tails; a native WAV alternative returned placeholder RIFF/data
lengths and was rejected. The explicit PCM path avoids depending on either
container. It does not retry a failed native request in a different format.
The existing in-process encoder adds no deployment binary. Ordinary per-segment
narration and calls keep their existing native MP3 contracts. See the
[codec evidence](evidence/2026-10-15-scene-codec.json).

One scene uses the most conservative nonpositive gain of its cast. A visible thought requiring the existing individual -3 dB factor is ineligible until trustworthy timing permits per-utterance processing. Ineligible/mixed scenes explain why and leave the existing individual narration available. They do not silently replace voices.

A successful complete response becomes an owned immutable asset. Partial audio is never delivered or appended. A failed or uncertain native request never triggers another provider generation automatically. An explicit retry uses the normal job reuse/credit rules; uncertain supplier spend remains recorded separately. Reconnects recover the existing scene job before offering another request. New scene assets remain separate from earlier individual clips and are played as one item, preventing duplicate dialogue in the segment queue.

## Options considered

| Option | Complexity | Effect on existing playback | Limitation |
| --- | --- | --- | --- |
| Split a binary scene into existing fragment assets | High | Retains fragment queue | Needs verified utterance timings that this HTTP response does not provide. |
| Automatically replace each turn's fragment set with a scene | High | Requires new replacement/replay protocol | Concurrent generation, retries and old clients can duplicate accepted dialogue. |
| Explicit independent scene asset | Moderate | Existing fragment playback remains available | Adds a separate preview/status control and does not automatically optimize every turn. |

## Consequences

Scene mode can be evaluated without changing the default narration contract. Each request has one admission/credit settlement and an auditable logical cast map. The frontend needs a scoped scene preview/status control alongside the current cast/narrator controls. Automatic scene optimization and volume processing within a scene can be considered after timing and acoustic evidence support them.

## Action items

1. Implement and test the trusted planner, source map, exact native array contract and disabled flag.
2. Probe hosted request boundaries for the application's supported cast and text caps; distinguish tested application bounds from unknown absolute vendor limits.
3. Integrate a distinct scene job/asset with the existing narration meter and owned message/workspace checks.
4. Add scene availability, recovery and playback to the cast/narrator controls with English/Spanish copy.
5. Verify idempotence, failures/refunds, mixed casts, source mapping, deletion/archive and native acoustic acceptance before enabling R3.
