# Reproductions and evidence

## Safety and repeatability boundary

The audit used pure functions, route/model validation without persistence, mocked loader dependencies, and short-lived child processes. No probe called a live LLM, edited application code, migrated a database, or stressed a running service.

The snippets are repeatable reconstructions of the audit probes. Run them in the reviewed local checkouts with their existing dependencies. Helpers are imported from repository test fixtures; if those fixtures move, update the harness deliberately rather than treating changed imports as a product regression. Outputs below are baseline observations, not desired behavior.

## Reproduction catalogue

| Probe | Baseline observation | Finding |
|---|---|---|
| R01 | Depth 1 matched a key in an older supplied message | F01 |
| R02 | Reversing two books changed combined budget from 100 to 1,000 | F03 |
| R03 | Earlier low-priority candidate consumed capacity needed by a later high-priority candidate | F03 |
| R04 | A non-recursive book activated from another book's inserted text | F03 |
| R05 | Constant secret activated without reveal text | F04 |
| R06 | Case-sensitive book matched through case-insensitive entry default | F10 |
| R07 | sol matched inside solía in whole-word mode | F14 |
| R08 | 5,000 unspaced Chinese characters estimated as 2 tokens | F08 |
| R09 | Same book/entry IDs across snapshot/live variants kept the first activated variant | F03 |
| R10 | all mode activated without its secondary condition | F11 |
| R11 | Actual frontend snapshot serializer produced invalid embedded-resource backend input and omitted shared resources | F02 |
| R12 | Loader requested only lorebooks permission while activating a resource snippet | F07 |
| R13 | Named-group dialect differed; pathological pattern exceeded the bounded child deadline | F05 |

## Pure activation harness

From /home/andres/PycharmProjects/magic-worlds-api:

~~~bash
.venv/bin/python - <<'PY'
import json
import runpy

from src.services.lorebook_activation import build_activation_response, estimate_tokens

fixtures = runpy.run_path("tests/services/test_lorebook_activation.py")
book, entry = fixtures["_book"], fixtures["_entry"]

def settings(**changes):
    return {**book()["settings"], **changes}

def run(name, books, text="pact", messages=None):
    result = build_activation_response(
        books=books,
        target_kind="global",
        messages=messages if messages is not None else [{"role": "user", "content": text}],
        include_prompt_preview=True,
    )
    print(json.dumps({
        "probe": name,
        "budget": result["tokenBudget"],
        "active": [r["entryId"] for r in result["results"] if r["status"] == "activated"],
        "skipped": [
            {"entry": r["entryId"], "reason": r["reason"]}
            for r in result["results"] if r["status"] == "skipped"
        ],
        "promptPrefix": result["promptPreview"][:80],
    }, ensure_ascii=False))

run("R01", [book(settings=settings(scanDepth=1), entries=[entry()])],
    messages=[
        {"role": "user", "content": "pact"},
        {"role": "assistant", "content": "next"},
        {"role": "user", "content": "hello"},
    ])

small = book(id="small", settings=settings(tokenBudget=100),
             entries=[entry(id="small-entry", content="small")])
large = book(id="large", settings=settings(tokenBudget=1000),
             entries=[entry(id="large-entry", content="large " * 200)])
run("R02-small-first", [small, large])
run("R02-large-first", [large, small])

run("R03", [book(entries=[
    entry(id="low", priority=-100, insertionOrder=0, content="word " * 120),
    entry(id="high", priority=999, insertionOrder=10, content="urgent " * 60),
])])
run("R04", [
    book(id="recursive", settings=settings(recursiveScanning=True),
         entries=[entry(id="first", content="bridge")]),
    book(id="no-recursion",
         entries=[entry(id="second", keys=["bridge"], content="unexpected recursion")]),
])
run("R05", [book(entries=[
    entry(constant=True, isSecret=True, revealCondition="quest_complete")
])], text="hello")
run("R06", [book(settings=settings(caseSensitive=True),
                 entries=[entry(keys=["Pact"])])])
run("R07", [book(entries=[entry(keys=["sol"])])], text="Ella solía cantar")
print(json.dumps({"probe": "R08", "characters": 5000,
                  "estimatedTokens": estimate_tokens("龍" * 5000)}))
run("R09", [
    book(entries=[entry(content="old snapshot")]),
    book(entries=[entry(content="new live canon")]),
])
run("R10", [book(entries=[
    entry(keys=["pact"], secondaryKeys=["permission"], selectiveLogic="all")
])])
PY
~~~

Expected baseline details:

- R03: low uses 162 estimated tokens; high needs 81 and is excluded under 200.
- R04: both first and second activate.
- R05/R06/R07/R10: entry-1 activates.
- R09: the rendered prefix is old snapshot.

R03 deliberately sets different insertion orders. Persisted queries already use priority for equal insertion-order ties; the issue is not that priority is unused everywhere. Live loading's latest-user-only input for F01 is additionally established by the loader source.

## Resource wire harness

First run from /home/andres/WebstormProjects/magic-worlds. This only writes a synthetic temporary JSON fixture.

~~~bash
node --input-type=module - <<'JS' > /tmp/lorebook-audit-wire.json
import { serializeLorebookSnapshot } from './src/infrastructure/api/lorebookWire.ts';

const entry = {
  id: 'entry-1', title: 'Court', entryType: 'other',
  content: 'The court is hidden.', keys: ['court'], secondaryKeys: [],
  selectiveLogic: 'any', enabled: true, constant: false,
  caseSensitive: false, matchWholeWords: true, regex: false,
  isSecret: false, revealCondition: null, insertionOrder: 0, priority: 0,
  insertionPosition: 'before_context', tokenBudget: null
};
const resource = {
  id: 'resource-1', title: 'Archive', description: null, triggers: ['court'],
  fileName: 'archive.md', fileType: 'md', content: 'The court is hidden.',
  contentLength: 20, contentHash: 'synthetic', evaluationHash: 'synthetic',
  extractionStatus: 'completed',
  extraction: { keywords: ['court'], longSummary: 'The court is hidden.', snippets: [] }
};
const book = {
  id: 'book-1', name: 'Court', description: null, tags: [], enabled: true,
  settings: {
    scanDepth: 8, tokenBudget: 1200, recursiveScanning: false,
    matchWholeWords: true, caseSensitive: false
  },
  entries: [entry], attachments: [],
  metadata: { resources: [resource], sharedResources: [{ ...resource, id: 'shared-1' }] }
};
process.stdout.write(JSON.stringify({
  embedded: serializeLorebookSnapshot(book),
  sharedOnly: serializeLorebookSnapshot({
    ...book, metadata: { resources: [], sharedResources: [resource] }
  })
}));
JS
~~~

The synthetic authoritative fields are intentionally irrelevant: the serializer removes them before backend validation. This is not a fixture for testing whether a forged extraction should be accepted.

Then run from /home/andres/PycharmProjects/magic-worlds-api:

~~~bash
.venv/bin/python - <<'PY'
import json
from fastapi import HTTPException
from src.routes.lorebooks import (
    ActivationPreviewPayload, LorebookAttachmentPayload, _activation_preview_for_books,
)
from src.database.mysql import LorebookModel

with open("/tmp/lorebook-audit-wire.json") as source:
    wire = json.load(source)

for name, snapshot in wire.items():
    payload = ActivationPreviewPayload.model_validate({
        "targetKind": "global",
        "messages": [{"role": "user", "content": "court"}],
        "includePromptPreview": True,
        "overrides": {"lorebooks": [snapshot]},
    })
    try:
        result = _activation_preview_for_books(
            books=[payload.overrides.lorebooks[0].model_dump()], payload=payload,
        )
        print(name, "preview active:",
              [r["entryId"] for r in result["results"] if r["status"] == "activated"])
    except HTTPException as error:
        print(name, "preview:", error.status_code, error.detail)

    attachment = LorebookAttachmentPayload.model_validate({
        "lorebookId": snapshot["id"], "targetKind": "global",
        "mode": "snapshot", "snapshot": snapshot,
    })
    try:
        LorebookModel._validate_snapshot(
            attachment.snapshot.model_dump(), lorebook_id=snapshot["id"],
        )
        print(name, "snapshot accepted; resource count:", len(snapshot["metadata"]["resources"]))
    except ValueError as error:
        print(name, "snapshot rejected:", str(error))
PY
~~~

Observed output:

~~~text
embedded preview: 422 Lorebook resource violates the valid fields
embedded snapshot rejected: Lorebook metadata resource violates the valid fields
sharedOnly preview active: ['entry-1']
sharedOnly snapshot accepted; resource count: 0
~~~

These validate route/model functions directly. They do not establish a full HTTP response for snapshot persistence, because no database write was attempted.

## Loader permission harness

From the backend root:

~~~bash
.venv/bin/python - <<'PY'
import asyncio
import runpy
from unittest.mock import AsyncMock, patch
from src.database.mysql import LorebookModel
from src.services import lorebook_loader
from src.services.scope import AppScope

fixtures = runpy.run_path("tests/services/test_lorebook_activation.py")
book = fixtures["_book"](metadata={"resources": [fixtures["_resource"]()]})

async def main():
    authorize = AsyncMock()
    with patch.object(
        LorebookModel, "list_for_activation_targets",
        AsyncMock(return_value={"books": [book], "attachments": []}),
    ), patch("src.services.feature_flags.scope.authorize_user_flags", authorize):
        result = await lorebook_loader.load_lorebook_context(
            user_id=42,
            scope=AppScope(project_hash="project", user_group_hash="group"),
            workspace_id="workspace-1", targets=[],
            target_kind="global", target_id=None, user_input="glass seal",
        )
        print("permission keys:", authorize.call_args.args[1])
        print("active:", [
            r["entryId"] for r in result.response["results"] if r["status"] == "activated"
        ])

asyncio.run(main())
PY
~~~

Observed keys: ['lorebooks']. Observed activated snippet: resource:res-1:snippet:seal. The authorization service is mocked so no permission/database call escapes the harness.

## Regex probes

The common-pattern mismatch can be reproduced with JavaScript (?<term>pact): frontend buildKeyRegex accepts it; Python activation rejects it as an invalid regular expression. Do not assume changing the syntax alone solves execution cost.

The expensive-pattern test must stay in killable children:

~~~bash
.venv/bin/python - <<'PY'
import json
import subprocess
import sys

commands = [
    ("python", [sys.executable, "-c",
                "import re; re.search('(a+)+$', 'a'*32+'!')"]),
    ("javascript", ["node", "--input-type=module", "-e",
                    "new RegExp('(a+)+$').test('a'.repeat(32)+'!')"]),
]
for engine, command in commands:
    try:
        result = subprocess.run(command, timeout=0.5, check=False, capture_output=True)
        print(json.dumps({"engine": engine, "completed": True, "code": result.returncode}))
    except subprocess.TimeoutExpired:
        print(json.dumps({"engine": engine, "completed": False, "terminatedAfter": 0.5}))
PY
~~~

Both children exceeded that deadline in the audit environment. Timing includes subprocess overhead and is not a production benchmark. Never paste the pathological match into the application's live request handler as a demonstration.

## Source-only cases and evidence not collected

F06, F09, F12, F13, F15, F16, and F17 are established through inspected control flow/semantics, not a completed browser or load reproduction. Future cases and evidence requirements are specified in [document 08](08_validation_and_evaluation.md). Do not mark them as browser-tested or benchmarked based on this file.
