# Voice migration and current release work

**Lifecycle: migration completed in source and recorded test deployment; release acceptance remains open.** Documentation/source reconciliation: 2026-10-15, America/Mexico_City. No runtime test, migration, provider request or deployment was performed during this cleanup.

Start with [00 — Current status, evidence and remaining roadmap](00_current_status_and_roadmap.md). Its October 15 model-migration update records the focused v4/v4 Turbo changes and successful direct provider probes; earlier deployment evidence keeps its original scope. It owns implementation status, frontend gates, evidence boundaries, V-01–V-13 and every open vendor, counsel and IVC gate. The dated migration record establishes the completed ElevenLabs baseline; it does not certify production readiness.

## Maintained authority

| Concern | Authority | Lifecycle |
|---|---|---|
| Current implementation, release gaps and acceptance | [00](00_current_status_and_roadmap.md) | Active, maintained |
| Fish Audio provider contract | BFF [Fish Audio guide](/home/andres/PycharmProjects/magic-worlds-api/docs/fish_audio.md) | Implemented; release gates are V-14 in [00](00_current_status_and_roadmap.md). The execution dossier was removed 2026-10-26 |
| Moderation replacement and release guards | [Moderation suite](../moderation/README.md) | Active requirements; the older classifier-only proposal is historical |
| App workspace isolation/lifecycle | [Workspace status](../workspace_r1/02_current_status_and_findings.md), [execution contracts](../workspace_r1/15_execution_contracts.md) | Active contracts |
| Owner decisions of 2026-10-14 (I-68–I-73) | [00](00_current_status_and_roadmap.md) carries their current effect: I-68/I-69 MiniMax speech purge with no speech fallback; I-70 and then I-72 final schema, ending at native revision `2026_10_voice_native` with the six designed voices and V1/legacy-map removal; I-71 owner closure of the launch legal rows for the no-user project (vendor and counsel questions stay open in V-11); I-73 optional moderation for testing (V-01) | Historical decision text through git ([Historical record](#historical-dossier)); later accepted work controls where scope changes |

The current source has progressed beyond the migration's single-provider/V2 baseline. Fish Audio release gates are V-14 in 00; its contract is the BFF `docs/fish_audio.md`. Read the BFF bootstrap and provider contracts linked from 00 before preparing a release; historical native-schema instructions are not a current full migration chain.

## What was retired and what remains

The original R0–R5 dates, cohort rollout, dual speech routing, legacy maps/V1 readers, ≥40-voice catalog target and staffing estimate are superseded.

Open obligations remain in 00: required moderation, release-environment acceptance, operating schedules and deletion SLOs, catalog listening quality, end-to-end latency, real devices, live-call delivery topology (single process or sticky routing), protocol/UX decisions, and external key/storage cleanup. Vendor licensing/policy confirmations (L-n), counsel tasks (CN-n), IVC gates and live provider spikes (V-13), all listed in 00, remain unverified unless dated evidence closes them; removing the old records does not close an obligation.

App workspaces scope session/job content. Catalog, presets, consent, quotas, runtime controls and account-level call admission keep their separate account/application boundaries. Theme-song and LLM providers are outside the retired speech-provider cleanup.

## Historical dossier

**Historical record.** The dated MiniMax → ElevenLabs migration dossier (documents 01–16, the `research/` notes 00–15 and the two 2026-10-11 call reviews) was removed from the tree on 2026-10-15. Source comments in both repositories still cite it as `NN §x.y` (or `research NN §x`) and by its identifiers: D01–D39 decisions, I-nn implementation decisions (03 §5.16), S-n staging spikes, L-n ElevenLabs written confirmations, CN-n counsel tasks, Q-nn open questions, PA-n proposed amendments to 03, R0–R5 task rows such as `R0-BE-28`, CT-nn contract-test scripts (research 12 §13, mapped to spikes in 14 §1.7), PCT-F fixture tests (14 §4.3), X-n extra unverified items (14 §2.30), P-nn catalog proposals (04 §15.3; 15 §4 also numbers privacy criteria P-01–P-10), T1–T13 catalog test scripts (research 11 §9) and RB-1…RB-9 runbooks (11 §7, adapted in the BFF `docs/operations.md`). Read an original with `git show 5a29ad5:docs/voice_refactor/<NN>_<name>.md` (research notes: `git show 5a29ad5:docs/voice_refactor/research/<NN>_<name>.md`; reviews: `git show 5a29ad5:docs/voice-calls-review-2026-10-11.md` and `git show 5a29ad5:docs/voice-calls-latency-review-2026-10-11.md`); `git ls-tree --name-only 5a29ad5 docs/voice_refactor/` lists the file names. The 2026-10-14 execution record is 15 §§11–13, and the owner decisions I-68–I-73 are 03 §5.16. These are dated evidence, not current contracts; [00](00_current_status_and_roadmap.md) carries every gate they left open.
