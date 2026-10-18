# ADR 20: offline writing and reviewed reconciliation

**Status:** writer/review, persistent device entry and durable reconciliation choices implemented and locally verified; installation evidence is in 01/14. Opt-in production app copies now support network-independent cold loading; broader acceptance remains open. **Date:** 2026-10-16.
**Scope:** R02/R03/R13/R15 and the existing scene save service. The full
136-capability D1–D6 goal remains active. D2 and D3–D6 are not complete.

## Contract

The browser's offline signal pauses scene writes. Open canonical scenes remain
editable locally, with the existing scoped journal and visible pending-sync
state. The signal is a stop condition, not proof that a server is healthy when
it says online. Ordinary editing stays independent of AI; reconnect events never
start a new paid generation. Explicit AI operations require a connection.

An unsent offline draft first reads its owned current scene. A changed prose
head or independently changed title retains both versions for review before any
new write. An uncertain already-sent request replays its exact immutable identity
first; its newer unsent tail then checks the account head. All writes retain the
existing server CAS, receipt and atomic checkpoint behavior. Account/workspace
changes retire callbacks without moving their data into another scope.

Reconciliation uses the acknowledged canonical document as a base. An older
recovered draft reads that exact immutable checkpoint; if unavailable, every
difference requires a choice. Independent changes to distinct stable top-level
blocks can form a candidate. Concurrent changes inside one block, deletion
versus editing and incompatible reading orders require explicit choices. Rich
nodes, marks, links and mentions retain their exact data and identities. An
invalid or empty combined document, including duplicated nested identities,
cannot be applied; no silent normalization or invented identity repairs it.

The shared dialog shows device/account versions and the complete combined
candidate. Applying is bound to the original scene, owner, local sequence and
reviewed account revision. New typing or a changed review source cannot use an
old action. The ordinary server CAS still rejects a later account change.
Closing/reopening and full page reload recover retained choices only for the exact saved source described below. Recovery never applies writing automatically.

Before adopting any version, retain the original device document in a separate
immutable, API/author/workspace/novel/scene-scoped record. Retention failure
prevents adoption and keeps copy/download recovery available. These alternatives
remain separate from autosave, can be copied/downloaded, and are never evicted
to make space. Newer active journals and other owners' records remain intact.
No old browser-draft cleanup runs when a scene opens.

## Persistent confirmed copies and device entry

The installed confirmed-read store uses IndexedDB, scoped by API origin, stable
author hash, workspace and novel; scene identities remain inside that owned
record. It retains strict Studio reads and a separate `acknowledged_scene`
projection of verified save acknowledgements. Acknowledgements update saved
prose without inventing a server-checked context packet or carrying generation
collections. Drafts, uncertain requests and authored alternatives remain in
their existing journals. A late read cannot lower a saved head. Scenes absent
from a later cached outline remain explicit earlier device copies.

Each novel has a 16 MiB confirmed-read allowance; each author/API scope has
64 MiB. The candidate and usage counter commit in one native transaction.
Concurrent tabs retain both scene reads. A failed or oversized candidate keeps
all earlier copies; the store has no deletion or eviction path. Corrupt records
remain preserved and are reported separately from an empty library. These are
read-cache allowances, not a promise of browser backup or a new retention limit
for authored journals. Browser/OS eviction and broader storage policy remain
acceptance work. Transaction handling follows the [IndexedDB lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

The novel/library page offers **Device novel copies** independently of a failed
workspace handshake. Its explicit device writer reuses `NovelEditor` and
`useSceneDraft` with `deviceOnly`; it cannot commit a workspace, mark account
access ready, call an API, replay a pending generation or start a provider.
Known archive states remain read-only. Connectivity changes retain an existing
AI proposal and unsent instruction; new AI requests and proposal acceptance/
regeneration remain paused. The author can checkpoint locally,
copy/download, change cached scenes and return later. Navigation must retain the
current draft first; storage failure keeps the writer open. Scope changes hide
old-owner copies immediately. The disabled-workspaces product boundary exposes
only the cached default workspace.

Once the app assets load after a reload, this entry rereads its native confirmed
copies and offers the existing scoped draft for deliberate resume. Reopening
the account requires a committed owned workspace, refreshed workspace state,
a fresh Studio index and the exact current scene. A missing/moved/erased target
refuses the handoff instead of substituting another scene or creating content.
New writing typed during the read is checkpointed again before navigation.
The account editor then offers its normal recovery and revision comparison.
A preferred opening scene remains explicit in memory if optional view storage
is blocked. Checked reconnect reads also publish their current scene through
the existing DataProvider confirmation boundary.

## Remaining implementation and acceptance

R13 remains **partial**. Opt-in production app copies now provide verified cold
loading under the contract below. Durable review choices remain separate from
app assets. Broader author, browser/device, eviction, shared-device/logout and
retention/performance acceptance is still required.
Account archive/removal/erasure keeps device copies available for manual
recovery and must never recreate server content automatically.

Strict unreadable-request handling and independent reopened-writer journals are
implemented and verified, together with durable unsent reconciliation choices across full reloads. Broader draft/revision quota policy and full author/device/assistive-technology acceptance remain open. Broader
revision/device/shared-device/logout and backup/provider retention remain open.
This decision does not authorize journal/media/record purge, project test CRUD,
database reset, schema change, deployment or release.

## Verification and installation evidence

Installed full frontend verification passes **5,112 tests / one conditional
fixture skipped (549 files)**, production build and Storybook typecheck. All
24 changed TypeScript files pass lint. Controlled browser checks cover the wide
shared review, keyboard choices, Escape/focus return, unchanged reopening,
apply/recovery, archived controls and refused retention failure.

Actual frontend canonical merge JSON passed HTTP/MySQL through revision **5** in
`magic_worlds_novel_reconnect_test_5b9b8a539028`, a new retained synthetic database.
Original/base/account/merge checkpoints, exact receipt replay after newer prose,
stale-write refusal, preserved other novel and note body/origin, explicit orphan
state and workspace archive refusal pass. No provider or project CRUD is used.
The BFF runtime/schema are unchanged; the new backend file is only that smoke.

[01](01_current_state_and_evidence.md#d2-open-scene-reconnect-and-reconciliation-evidence--2026-10-16)
records commands, native wire, browser images and installation artifact paths.
[14](14_status_and_roadmap.md#d2-open-scene-reconnect-and-reconciliation--2026-10-16)
remains the delivery authority. This checkpoint does not close full R13, D2,
any later phase, author/device acceptance or the original goal.


## Persistent-entry verification — 2026-10-16

Frontend verification passes **5,134 tests / one conditional fixture skipped
(553 files)**, production build and Storybook typecheck. Changed TypeScript
has no added lint diagnostics; DataProvider retains its four unchanged baseline
diagnostics. The actual retained HTTP/MySQL Studio wire is accepted by the
native-copy validator without a new database operation.

Opt-in fictional-browser checks verify atomic concurrent retention, correct
usage, owner retirement, other-author isolation, invalid-read refusal and the
controlled novel allowance. Thirteen large scenes remain intact at
**15,728,107 bytes** after the next candidate is refused. Keyboard checks verify
scene entry, focus return, explicit checkpoint, full page reload, draft resume,
editor focus and reachable copy controls. No account client exists in this
fixture. No private account, provider, project CRUD, browser-record cleanup,
schema operation or API restart is involved.

The exact installation and runtime evidence is in
[01](01_current_state_and_evidence.md#d2-persistent-device-entry-evidence--2026-10-16)
and [14](14_status_and_roadmap.md#d2-persistent-device-entry--2026-10-16).
D2, full R13 and D3–D6 remain open.

## Durable review choices and independent recovery — 2026-10-16

Reconciliation form choices use their own IndexedDB store, separate from authored
prose journals and optional confirmed reads. Each live review/source has an
independent writer key. Recovery requires exact equality of API/author/workspace,
novel/scene/chapter, base and both canonical manuscripts, both titles, account
prose/metadata heads, content hash and read-only state. A new comparison ID or
local sequence alone does not invalidate identical source material. A changed
source never reuses its choices; earlier records remain preserved.

Each record is limited to 16 MiB and the form store to 64 MiB per author/API.
Record and usage counter commit atomically. Lower writer sequences and changed
equal-sequence choices are refused. Failed, corrupt or oversized writes retain
earlier records; there is no deletion or eviction path. These allowances do not
replace prose-journal retention or promise protection from browser/OS eviction.

The dialog announces loading, retained/recovered choices and storage failure.
Choice fields stay usable during persistence. Closing flushes the newest choices;
a failed checkpoint keeps the dialog open and offers full review/choice export.
Device-library navigation and browser unload respect outstanding local changes.
Account adoption still requires the existing original-device retention and
current-revision CAS; stored choices contain no server mutation intent.

**Saved reconciliations** is available directly from the account-scoped device
library even if confirmed-read storage is unavailable or its scene is absent.
The saved account document is labelled as a snapshot. Local choices can continue
and be exported; refresh/adoption controls cannot write from this snapshot.
Fresh owned account comparison is required before applying writing. Known
archive states remain read-only, other owners are hidden immediately, and the
disabled-workspaces boundary exposes only a recorded default-workspace review.

Native browser checks cover page-reload recovery, independent direct entry,
editable saved choices with account actions disabled, and 13 real IndexedDB
preservation/isolation/refusal checks. Focused regressions include storage-failed
close and successful retry. [01](01_current_state_and_evidence.md#d2-durable-reconciliation-choice-evidence--2026-10-16)
records commands and screenshots. App-shell cold loading, full R13, wider D2
acceptance and D3–D6 remain open. No BFF/schema/project-data operation is involved.

## Opt-in cold offline app loading — 2026-10-17

**Download app for offline writing** is available inside Device novel copies.
It registers only this app's known module worker, after an explicit action.
An unrelated covering worker is preserved and the action is refused. Production
builds require HTTPS or localhost, following the browser's
[registration rules](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
LAN HTTP and development builds show a clear unavailable state; neither changes
browser security or prevents an already loaded device writer from working.

The build plugin uses the [Vite JavaScript API](https://vite.dev/guide/api-javascript)
to emit a standalone module worker and a manifest of final app HTML, bundled
code/styles/fonts/images and explicit public icons/manifest. Every entry has an
exact byte length and SHA-256 digest. Version checks, auth links, API responses,
user media, source maps and arbitrary public-directory contents are excluded.
Downloads omit credentials, reject redirects and verify bytes before caching.
A rolling deployment or HTML fallback cannot be accepted as a matching script.

Each app base has a 64 MiB build-asset allowance. Native IndexedDB atomically
reserves each immutable build before any new cache writes; concurrent workers
cannot exceed it. A failed/partial candidate keeps its reservation for bounded
retry and preserves earlier complete copies. CacheStorage holds separate build
copies and a ready marker written only after every file verifies. Status checks
verify retained files again. No worker unregister, cache deletion/eviction,
private-data caching, draft clearing or existing-journal migration runs.
Browser/OS eviction and explicit long-term app-copy management remain broader
retention work; the allowance is not a browser backup guarantee.

Only exact manifest GETs and query-free app-root/index navigations are handled.
Authorization/range requests, writes, auth deep links, version checks and unknown
URLs use their ordinary network path. Navigation uses one verified pinned build
until normal activation, so a new HTML page cannot mix with an older asset set.
The worker never calls [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)
or reloads an editor. A downloaded update waits while old controlled tabs remain;
after retaining writing, closing those tabs and reopening uses the new build.
The global update banner follows this rule instead of offering a reload that
would continue to use the pinned old build. An unchanged active copy is labelled
as an existing verified copy, not a newly downloaded update.

App files are public build material and have no account authority. The existing
saved sign-in, account retirement and explicit device-only writer remain the
ownership boundary. Account handoff still requires fresh workspace/index/exact-
scene reads and revision comparison; reconnect never creates server writing.
First-time legal/age gates and normal sign-in requirements remain in effect.

Native verification cold-loads the actual built app after its loopback server is
stopped, then cold-loads the fictional device writer, deliberately resumes its
exact draft and retains new local prose without that server. Another download
waits while the earlier writer remains unchanged, activates after old tabs close,
and rejects mismatched deployment files. Ten native CacheStorage/IndexedDB checks
cover preservation, source scope and concurrent reservation refusal without large
fixture downloads. No project database, provider or account operation is used.
[01](01_current_state_and_evidence.md#d2-cold-offline-app-evidence--2026-10-17)
records exact artifacts and limitations. Full R13, D2 and D3–D6 remain open.

## D2 retained workspace lifecycle — 2026-10-17

Checked workspace lists now retain the actual positive `row_version` independently
of scene reads. The [shared ordering rule](../../src/shared/workspaceLifecycle.ts)
keeps greater observed versions and conservatively keeps an archive at equal
heads. Older list/scene responses cannot undo it. A strictly newer version can
confirm a restore. Legacy cached descriptors without a version remain readable;
a legacy archive cannot be automatically unlocked by an unordered active copy.
Open the fresh account version for current writing in that case. No version is
invented, and cached observations never make account authorization ready.

[Workspace metadata retention](../../src/features/novel/persistence/deviceWorkspaceStorage.ts)
uses typed, account/API-scoped rows in the existing schema-1 `usage` store. It
adds no database version, store migration or cleanup. Its 8 KiB record / 4 MiB
account/API allowance is separate from the existing 16 MiB novel / 64 MiB
confirmed-prose allowance. Native read/write transactions coordinate scene-copy
writes with metadata; workspace-only batches commit atomically. Refused or
unreadable storage stays intact. Workspace-only updates leave original novel
records and their byte counter unchanged. Caller data is captured before awaits.

[Device readers](../../src/features/novel/hooks/useDeviceWorkspaceStates.ts)
retain already-known restrictions across failed, empty, older or overlapping
refreshes, and ignore retired-owner completions. A content-free BroadcastChannel
notification and focus/visibility refresh update other open tabs. The open device
writer keeps its selected source and unsent prose while the latest known workspace
state changes its read-only restriction. Missing/unreadable lifecycle storage
keeps manual copy/download recovery available and blocks device editing. Saved
reviews keep their original compared source; a later known archive blocks new
choices without removing export or existing choices. Local saved-snapshot review
still cannot apply account writing and remains available when the optional
workspace ledger cannot be read. Normal fresh account checks and revision CAS
remain required for handoff.

The [native fixture](../../src/test/fixtures/novelWorkspaceNativeProof.ts) verifies
22 transaction/isolation/allowance/preservation checks, including preservation of
an earlier fictional app copy without a schema upgrade. A separate two-tab writer
check proves archive locking, refusal to unlock on a late older active observation,
and newer restore/continued writing with the same draft. This is controlled
desktop evidence. Unit/root lifecycle overlays, full shared-device/logout policy,
long-term retention, browser eviction, author/device/accessibility acceptance,
remaining R13/D2 and D3–D6 remain open.

## D2 novel and unit device lifecycle — 2026-10-17

Checked novel lists/Studio sources and acknowledged root lifecycle operations now
retain a separate [lifecycle projection](../../src/features/novel/persistence/novelDeviceLifecycle.ts).
Root and unit metadata revisions order their own read-only flags; structure
revisions order actual scene membership and parent placement. Equal metadata
heads keep restrictions. Contradictory equal structure heads stay read-only until
a newer placement is known. A newer root restore cannot undo an independently
archived chapter/scene, while a newer move can change the scene's current ancestor.
Missing/removed scenes remain recoverable read-only copies. Derived old inheritance
flags do not override newer explicit workspace/root/unit observations.

[Native retention](../../src/features/novel/persistence/deviceNovelStorage.ts)
uses a new typed namespace in the existing schema-1 metadata store, without a
store upgrade, prose rewrite or cleanup. Its separate limits are 2 MiB per novel
state and 16 MiB per author/API. Keys also bind workspace and novel. One native
transaction merges actual observations with their usage counter; partial or
corrupt state is refused and retained. Old unit observations stay available after
membership changes. A confirmed erase is terminal and retains previous metadata;
later sources cannot reintroduce account writing. No title, prose, summary,
credential or model output is stored in this projection.

[Account publication](../../src/features/novel/hooks/useNovelLifecycleRetention.ts)
checks ownership of the loaded list as well as the current session/workspace.
Root archive/Trash acknowledgement is retained before its follow-up read, including
when Trash hides the root. Its revision is confirmed by the existing compact
receipt guard. Confirmed erasure callbacks retain the terminal observation; they
do not delete browser copies. Retired callbacks/owners and unmounted publishers
cannot store a late result under another owner. Gallery reads retain their checked
root states independently from Studio. Failure is visible, and the current device
entry blocks further editing while preserving manual recovery.

[Open device views](../../src/features/novel/hooks/useDeviceNovelState.ts) merge
newer observations through the existing tab/focus notifications while keeping the
selected manuscript and original source unchanged. Device writers lock for known
archive/Trash/removal/erasure or unverifiable lifecycle storage. Newer applicable
restores can unlock them; confirmed erasure stays terminal. A read-only retained
draft offers inspection, copy and download. Saved reconciliation sources/choices
remain available, with new choices blocked by known restrictions; a missing optional
lifecycle ledger alone does not remove independent local review recovery. No
cached observation authorizes account writes; fresh owned sources and CAS remain
mandatory.

Thirty native checks cover ordering, scope isolation, actual transaction limits,
unchanged original/earlier fictional manuscript copies, preserved corrupt evidence
and schema 1. The account-ceiling case explicitly seeds a reserved ceiling in a
fresh fictional namespace; it is not a browser/OS quota claim. Two-tab Trash and
chapter archive/restore plus terminal-receipt reload/inspection are verified in
[01](01_current_state_and_evidence.md#d2-novel-and-unit-device-lifecycle-evidence--2026-10-17).
Unobserved remote changes still require a checked account read. General retention,
shared-device/logout, browser eviction, large-project and broader author/device/
accessibility acceptance, remaining D2 catalog cases and all D3–D6 stay open.
