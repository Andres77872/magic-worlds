# Native API usage and original examples

These examples illustrate the **public Fish API**, not Magic Worlds routes. They were syntax-checked offline and were not sent to Fish. Running them requires an account, credit and a voice that is authorized for the intended use. Their dependencies are described, not installed by this report.

The first integration should call Fish from the backend. Never place `FISH_API_KEY` in a `VITE_` variable, browser bundle or client request. Keep application voice keys distinct from Fish voice IDs.

## Choose the right endpoint

| Need | Native endpoint | Input/response |
| --- | --- | --- |
| Complete approved text → audio asset | `POST /v1/tts` | JSON or MessagePack → audio bytes |
| Complete text → streamed audio with timing | `POST /v1/tts/stream/with-timestamp` | Full request → SSE carrying JSON/base64 audio and timing |
| Incremental approved text → streamed audio/timing | `WSS /v1/tts/live/with-timestamp` | MessagePack bidirectional frames |
| Incremental text without timing | `WSS /v1/tts/live` | MessagePack frames; different finish/reuse expectations |
| Generate synthetic voice candidates | `POST /v1/voice-design` | JSON, `model: voice-design-1` → candidate JSON |
| Persist a reference voice | `POST /model` | Multipart recording(s) and metadata → voice model |

Endpoint sources: [TTS](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech), [SSE](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps), [timestamp WS](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-live-with-timestamps), [plain WS](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live), [design](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design), [persistence](https://docs.fish.audio/api-reference/endpoint/model/create-model).

## Minimal Drama 3 HTTP request

The reference ID below is intentionally a placeholder. Replace it with an approved Fish voice ID before executing. Set `FISH_API_KEY` in the shell environment without saving it in the JSON file. The model belongs in the header, not the body.

```bash
: "${FISH_API_KEY:?Set FISH_API_KEY in your environment}"

cat > fish-drama-request.json <<'JSON'
{
  "text": "[calm, with restrained relief] The path is clear. We can return before sunset.",
  "reference_id": "REPLACE_WITH_APPROVED_FISH_VOICE_ID",
  "format": "mp3",
  "sample_rate": 44100,
  "mp3_bitrate": 128
}
JSON

curl --fail-with-body --show-error --request POST \
  'https://api.fish.audio/v1/tts' \
  --header "Authorization: Bearer $FISH_API_KEY" \
  --header 'Content-Type: application/json' \
  --header 'model: drama-3' \
  --data-binary @fish-drama-request.json \
  --output fish-drama-demo.mp3
```

Inspect HTTP success, actual audio format and duration before treating the file as a usable asset; curl can leave an error-body file on failure. Do not blindly play a file solely because its suffix is `.mp3`. The requested 44.1 kHz mono MP3 fits the current browser validator. [Native formats](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech).

The initial request deliberately omits sampling/prosody/quality fields until their Drama behavior is verified. Do not add a native TTS seed: no hosted native seed was documented. No automatic retries are included, because a timed-out generation may already have incurred supplier usage.

## Asynchronous HTTP with the existing backend stack

This standalone example uses `httpx`, already present in the backend. It uses application-chosen deadlines and a bounded output buffer; these are example limits, not Fish service limits. `FISH_VOICE_ID` must contain the approved reference ID.

```python
import asyncio
import os
from pathlib import Path

import httpx

MODEL = "drama-3"
MAX_AUDIO_BYTES = 20 * 1024 * 1024


async def synthesize_demo() -> bytes:
    payload = {
        "text": "[serena, con alivio contenido] La puerta está abierta. Podemos salir juntos.",
        "reference_id": os.environ["FISH_VOICE_ID"],
        "format": "mp3",
        "sample_rate": 44100,
        "mp3_bitrate": 128,
    }
    headers = {
        "Authorization": "Bearer " + os.environ["FISH_API_KEY"],
        "model": MODEL,
    }
    timeout = httpx.Timeout(60.0, connect=10.0, write=10.0, pool=5.0)
    audio = bytearray()
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST", "https://api.fish.audio/v1/tts", json=payload, headers=headers
        ) as response:
            response.raise_for_status()
            media_type = response.headers.get("content-type", "").split(";", 1)[0]
            if media_type not in {"audio/mpeg", "application/octet-stream"}:
                raise ValueError("Unexpected TTS response media type")
            async for block in response.aiter_bytes():
                if len(audio) + len(block) > MAX_AUDIO_BYTES:
                    raise ValueError("TTS example output exceeds local byte limit")
                audio.extend(block)
    if not audio:
        raise ValueError("TTS returned no audio")
    return bytes(audio)


async def main() -> None:
    audio = await synthesize_demo()
    Path("fish-drama-http-demo.mp3").write_bytes(audio)


if __name__ == "__main__":
    asyncio.run(main())
```

A production adapter should reuse its long-lived HTTP client, obtain secrets from backend configuration, classify errors, record admission/usage and validate the MP3 stream using the project's audio handling. It should not create an independent unmetered media path from this example.

## Multi-speaker scene payload

Use this body with the same native TTS headers. Replace each placeholder ID. The ordered reference array, text and directions form one generation identity.

```json
{
  "text": "<|speaker:0|>[measured storyteller] A light appeared beneath the door. <|speaker:1|>[quietly determined] I will check the lock. <|speaker:2|>[nervous but cooperative] I will hold the lantern. <|speaker:1|>[reassuring] Stay close.",
  "reference_id": [
    "APPROVED_NARRATOR_FISH_ID",
    "APPROVED_GUARDIAN_FISH_ID",
    "APPROVED_COMPANION_FISH_ID"
  ],
  "format": "mp3",
  "sample_rate": 44100,
  "mp3_bitrate": 128
}
```

Do not use display names such as `Guardian:` as routing controls; the documented routing token is `<|speaker:N|>`. Reject indices outside the reference array. Preserve logical lines without these tokens in application transcripts. [Drama scene contract](https://docs.fish.audio/features/text-to-speech/drama-3).

## Pronunciation dictionaries

The native field is singular **`pronunciation_dictionary`**, containing a list. Choose references or inline dictionaries, never mix the two forms. This original inline example controls the English name Nora:

```json
{
  "text": "[clear and welcoming] Nora will meet us near the lantern.",
  "reference_id": "APPROVED_ENGLISH_FISH_ID",
  "format": "mp3",
  "sample_rate": 44100,
  "mp3_bitrate": 128,
  "pronunciation_dictionary": [
    {
      "items": [
        {"key": "Nora", "value": "N AO1 R AH0", "case_sensitive": true}
      ]
    }
  ]
}
```

A versioned platform reference instead has this field shape:

```json
{
  "pronunciation_dictionary": [
    {"id": "APPROVED_DICTIONARY_ID", "version": "PINNED_VERSION_ID"}
  ]
}
```

That last block is a field fragment, not a complete synthesis request. The published schema allows up to three dictionaries and uses literal matching with leftmost-longest resolution. Values are phonemes without explicit phoneme wrapper tokens. Importantly, unresolved dictionary references can be silently dropped while synthesis succeeds. Validate the approved version before admission and listen for the intended result; HTTP success alone cannot certify pronunciation. [Schema](https://docs.fish.audio/api-reference/openapi.json), [dictionary guide](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries).

## Timestamp WebSocket example

This uses Python 3.11 or later (`TaskGroup` and `asyncio.timeout`), the `websockets` asynchronous client and `ormsgpack`. The example's client API fits the backend's current WebSockets 16 dependency; the backend would need an approved MessagePack dependency. It opens one socket for one turn; it does not assume reuse or concurrent provider contexts. Keep sending and receiving concurrent, and keep reading after `stop` until `finish`.

The example preserves metadata-only events and replaces per-chunk alignment snapshots. It produces an audio file and a normalized timestamp file for inspection. It is **not** a production call adapter: it does not implement moderation/admission, source-text matching, transcript commitment, barge-in, account concurrency or supplier usage reconciliation.

```python
import asyncio
import json
import os
from pathlib import Path

import ormsgpack
from websockets.asyncio.client import connect

MAX_AUDIO_BYTES = 20 * 1024 * 1024


async def stream_demo() -> tuple[bytes, list[dict]]:
    headers = {
        "Authorization": "Bearer " + os.environ["FISH_API_KEY"],
        "model": "drama-3",
    }
    request = {
        "text": "",
        "reference_id": os.environ["FISH_VOICE_ID"],
        "format": "mp3",
        "sample_rate": 44100,
        "mp3_bitrate": 128,
    }
    audio = bytearray()
    snapshots: dict[int, tuple[float, dict]] = {}

    async with asyncio.timeout(60):
        async with connect(
            "wss://api.fish.audio/v1/tts/live/with-timestamp",
            additional_headers=headers,
            max_size=4 * 1024 * 1024,
        ) as socket:

            async def send() -> None:
                await socket.send(ormsgpack.packb({"event": "start", "request": request}))
                for sentence in (
                    "[steady and attentive] The path is clear. ",
                    "We can return before sunset. ",
                ):
                    await socket.send(ormsgpack.packb({"event": "text", "text": sentence}))
                    await socket.send(ormsgpack.packb({"event": "flush"}))
                await socket.send(ormsgpack.packb({"event": "stop"}))

            async def receive() -> None:
                async for frame in socket:
                    if not isinstance(frame, bytes):
                        raise ValueError("Expected a MessagePack binary frame")
                    message = ormsgpack.unpackb(frame)
                    event = message.get("event")
                    if event == "error":
                        raise RuntimeError("Fish rejected the streaming request")
                    if event == "finish":
                        return
                    if event != "audio":
                        continue
                    alignment = message.get("alignment")
                    if alignment is not None:
                        seq = int(message["chunk_seq"])
                        offset = float(message["chunk_audio_offset_sec"])
                        snapshots[seq] = (offset, alignment)
                    block = message.get("audio", b"")
                    if not isinstance(block, bytes):
                        raise ValueError("Expected raw audio bytes")
                    if len(audio) + len(block) > MAX_AUDIO_BYTES:
                        raise ValueError("Streaming example exceeds local byte limit")
                    audio.extend(block)
                raise RuntimeError("Socket closed before finish")

            async with asyncio.TaskGroup() as group:
                group.create_task(receive())
                group.create_task(send())

    if not audio:
        raise ValueError("Streaming TTS returned no audio")
    words = []
    for seq in sorted(snapshots):
        offset, snapshot = snapshots[seq]
        for segment in snapshot["segments"]:
            words.append({
                "text": segment["text"],
                "start_seconds": offset + float(segment["start"]),
                "end_seconds": offset + float(segment["end"]),
                "provider_chunk_seq": seq,
            })
    return bytes(audio), words


async def main() -> None:
    audio, words = await stream_demo()
    Path("fish-drama-ws-demo.mp3").write_bytes(audio)
    Path("fish-drama-ws-demo.timestamps.json").write_text(
        json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    asyncio.run(main())
```

The 60-second turn deadline, 4 MiB frame limit and 20 MiB audio limit are local demonstration choices. They need adjustment from actual payload distributions before production. The transport contract is described in the [timestamp WS reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-live-with-timestamps); interruption and source mapping are covered in [06](06_streaming_calls_and_alignment.md).

## HTTP/SSE is a different response contract

For a completed script, `/v1/tts/stream/with-timestamp` returns SSE rather than a raw audio body. Each audio payload must be decoded from `audio_base64`; alignment follows chunk snapshot semantics. Use an actual SSE parser, not a raw line concatenation or `response.read()` saved as `.mp3`. This endpoint cannot receive later LLM sentences after the initial POST. Do not assume an OpenAI `[DONE]` marker without a documented Fish fixture. [SSE reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps).

## Voice design and persistence

Use `POST /v1/voice-design`, JSON, with **`model: voice-design-1`**, not `drama-3`. An original candidate request:

```json
{
  "instruction": "A patient adult storyteller with a clear Spanish accent and a gently textured voice. Natural conversation, without theatrical shouting.",
  "reference_text": "La lámpara sigue encendida. Todavía tenemos tiempo para encontrar el camino.",
  "language": "es",
  "n": 2,
  "seed": 42
}
```

This seed applies to design, not native Drama speech. The endpoint is stateless: the candidate ID is not a saved TTS reference. Decode `audio_base64`, inspect the format/rate, and curate the candidates before persistence. The API caps `reference_text` at 150 characters and permits one to four candidates. [Design endpoint](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design).

Persistent creation uses multipart `/model`, with `type=tts`, title, `train_mode=fast`, recordings in `voices`, optional transcripts in `texts`, and visibility. The API currently downgrades requested public creation to private; public publication is a separate web flow. Keep initial Magic Worlds voices private and curate their local catalogue publication independently. [Create-model contract](https://docs.fish.audio/api-reference/endpoint/model/create-model).

The candidate response schema still omits a signature field, but the October 15
live development probe returned `signature` with both English and Spanish WAV
candidates. Sending that exact signature and unchanged candidate audio to
multipart `/model` returned private, trained models with `source=voice_design`.
The implementation now follows this verified contract: the signature stays on
the server, missing signatures disable saving, and persistence must report the
verified design source and private visibility. Candidate IDs are never treated
as saved TTS references. See [voice-creation evidence](13_voice_creation_development.md).

Owned/public inventory is queried through the voice-model API; those models are voices, not speech engines. Paginate completely, normalize languages/provenance and respect availability/deletion notices. Only publish a voice into Magic Worlds after rights, samples and target-model acceptance have been verified. [List models](https://docs.fish.audio/api-reference/endpoint/model/list-models).
