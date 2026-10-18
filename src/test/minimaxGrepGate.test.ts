import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
/**
 * The MiniMax grep gate (voice refactor 15 §6.2), narrowed by the native
 * cutover (`2026_10_voice_native`): MiniMax is no longer a voice provider and
 * the V1 stored-voice machinery is gone, so MiniMax may only appear as the
 * theme-song model, as an LLM vendor, and in dated history.
 *
 * Two scans, each with its own allow-list:
 * - the §6.2 MiniMax pattern (`FORBIDDEN`), over the whole repository. Its
 *   pattern and row semantics match the BFF's `tests/test_minimax_grep_gate.py`;
 *   the file listing and the default mode are set separately in each
 *   repository, so check both gates when changing either;
 * - the retired legacy-voice machinery (`LEGACY_VOICE`), under `src/` and
 *   `.storybook/` only: V1 stored voices and their translation, V1 presets
 *   (`base_voice_id` / `base_voice_name`, the convert-from-V1 copy) and the
 *   legacy global preset conflict, the `unmapped_legacy` reason and
 *   `legacy_voice_id`, review flags (D15) with their MiniMax drop values and
 *   the review notice, the first-exposure notice, the legacy mapping and
 *   coverage console, `legacy_hidden`, conversion drafts, and the
 *   `rollout_mode` / `canary_percent` runtime settings.
 *
 * Every tracked and every untracked, non-ignored file (`git ls-files
 * --cached --others --exclude-standard`, so git-ignored `dist/`,
 * `storybook-static/`, `ds-bundle/` and `node_modules/` are skipped) is
 * scanned, and a hit is dropped only when an allow-list row of its scan
 * matches its path **and** its line. Dotenv files (`.env`, `.env.*`, except
 * `.env.example`) are never listed or read, ignored or not: they hold local
 * secrets, and a hit would echo the line into the failure message.
 *
 * `MINIMAX_GATE_MODE` (strict by default since the purge: R4-QA-01, D-10):
 * - unset, empty, `strict` (the §6.2 name) or `enforce`: fails on any hit
 *   outside the allow-list, so `pnpm vitest run` carries the gate;
 * - `report`: prints the count and every hit and never fails, whatever the
 *   repository holds (for a local inventory);
 * - any other value enforces too, after a warning, so a mistyped mode never
 *   turns the gate off.
 * Vitest hides the console of passing tests, and the default reporter may not
 * show it even with `--silent=false`: run
 * `MINIMAX_GATE_MODE=report pnpm vitest run src/test/minimaxGrepGate.test.ts --reporter=verbose --silent=false`
 * to see the report.
 *
 * Path globs: `**` spans directories, `*` and `?` stay inside one path segment,
 * and a glob that matches a directory covers everything under it. Patterns
 * and allowed line regexes are case-insensitive. This file is excluded from its
 * own scans: it has to spell the patterns out.
 */
import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'

const MODE_ENV = 'MINIMAX_GATE_MODE'
const SELF = 'src/test/minimaxGrepGate.test.ts'
const MAX_HIT_CHARS = 120

type GateMode = 'report' | 'strict' | 'enforce'

/** 15 §6.2, verbatim (case-insensitive). */
const FORBIDDEN =
    /minimax|speech[-_]2[._]8|t2a(_v2)?|MINIMAX_|VOICE_MINIMAX|TTS_DEFAULT_VOICE_ID|language_boost|audio_hex|hex_payload|base_resp|\b32_?000\b/i

/**
 * The legacy-voice machinery the native cutover removed (case-insensitive).
 * Kept on purpose and not matched: `needs_reselect`, `voice_reload_required`,
 * `consent_stale`, speech markup v1 (D27) and the workspace R1 rollout states.
 * The D15 `needs_review` value is not matched either: the lorebook draft
 * status reuses the name.
 */
const LEGACY_VOICE =
    /unmapped[-_]?legacy|review[-_ ]?(?:flag|notice)|pitch[-_]?dropped|vol[-_]?dropped|speed[-_]?clamped|first[-_ ]?exposure|legacy[-_ ]?(?:mapping|coverage|hidden|provider|audition|inventory|voice[-_]?id)|global[-_]?preset[-_]?legacy|legacy[-_]?global[-_]?preset|base[-_]?voice[-_]?(?:id|name)|(?:legacy|voice)[-_]?v1|v1[-_]?(?:translation|not[-_]?allowed|preset)|converted[-_]?from[-_]?v1|conversion[-_]?(?:draft|flags)|rollout[-_]?mode|canary[-_]?percent|English_radiant/i

/** The legacy-voice scan covers the shipped app and its stories only; docs keep their history. */
const LEGACY_VOICE_SCOPE = ['src/**', '.storybook/**'] as const

interface AllowRule {
    globs: readonly string[]
    line: RegExp
    reason: string
}

const ANY_LINE = /.*/
const SELF_ROW: AllowRule = { globs: [SELF], line: ANY_LINE, reason: 'The gate itself' }

/** MiniMax rows: theme songs, MiniMax as an LLM vendor, non-MiniMax 32 kHz values, and dated history. */
const ALLOWLIST: readonly AllowRule[] = [
    { globs: ['**'], line: /minimax_music_3|minimax\/music-3|MiniMax Music/i, reason: 'Theme songs (D01)' },
    {
        globs: ['CLAUDE.md', 'AGENTS.md'],
        line: /OpenAI\/Anthropic\/Google\/MiniMax/i,
        reason: 'magic-llm provider list (LLM, not speech)',
    },
    {
        globs: [
            'src/features/interaction/audio/voicePlaybackBuffer.ts',
            'src/infrastructure/api/themeSongContract.ts',
            'src/infrastructure/api/index.ts',
            'src/features/interaction/audio/voiceVadProcessor.worklet.test.ts',
            'src/features/llmProfiles/llmProfileFixtures.ts',
        ],
        line: /\b32_?000\b/i,
        reason: 'MPEG-1 table, bitrate floor, text cap, sample counts, LLM token limits: not MiniMax',
    },
    {
        globs: ['docs/voice_refactor/**'],
        line: ANY_LINE,
        reason: 'The voice plan and its pointer to the removed dated history',
    },
    {
        globs: ['docs/llm_profiles/**'],
        line: /minimax_music_3|music_3_0|ACE-Step y MiniMax|aliases direct-MiniMax/i,
        reason: 'Theme-song writer and retired music-alias lines only',
    },
    { globs: ['.design/**'], line: ANY_LINE, reason: 'Design scratch (base64 false positives); not shipped' },
    SELF_ROW,
    // Q1 is closed (I-71, 2026-10-14): the Privacy page publishes the ElevenLabs variant, so the
    // legal copy keeps no allowance (the self-tests below pin the former rows as refused).
    {
        globs: ['docs/**'],
        line: /MiniMax-(?:M\d|Text)|\bLLM providers?\b|proveedor(?:es)? (?:de )?LLM/i,
        reason: 'MiniMax as an LLM vendor or model (out of scope): docs from other workflows may list it',
    },
]

/** Legacy-voice rows: only the guard tests that assert the removed pieces stay absent. */
const LEGACY_VOICE_ALLOWLIST: readonly AllowRule[] = [
    {
        globs: [
            'src/features/admin/voices/consoleModules.guard.test.ts',
            'src/infrastructure/api/__tests__/adminVoiceConsoleApi.test.ts',
            'src/shared/types/adminVoiceCatalog.types.test.ts',
        ],
        line: ANY_LINE,
        reason: 'Guard tests: they name the removed modules, routes and fields to assert they stay gone',
    },
    SELF_ROW,
]

/** A forbidden pattern, the paths it scans, and the rows that drop its hits. */
interface Scan {
    pattern: RegExp
    globs: readonly string[]
    allow: readonly AllowRule[]
}

const SCANS: readonly Scan[] = [
    { pattern: FORBIDDEN, globs: ['**'], allow: ALLOWLIST },
    { pattern: LEGACY_VOICE, globs: LEGACY_VOICE_SCOPE, allow: LEGACY_VOICE_ALLOWLIST },
]

/** Local dotenv files (the BFF's `.gitignore` rule: `.env`, `.env.*`, not `.env.example`). */
function isDotenv(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1)
    return (name === '.env' || name.startsWith('.env.')) && name !== '.env.example'
}

const globCache = new Map<string, RegExp>()

/** `**` + `/` = any directories (or none), a trailing `/**` = everything below, `*`/`?` = one segment. */
function globRegex(glob: string): RegExp {
    const cached = globCache.get(glob)
    if (cached) return cached
    let source = ''
    for (let index = 0; index < glob.length; ) {
        if (glob.startsWith('**/', index)) {
            source += '(?:.*/)?'
            index += 3
        } else if (glob.startsWith('/**', index) && index + 3 === glob.length) {
            source += '(?:/.*)?'
            index += 3
        } else if (glob.startsWith('**', index)) {
            source += '.*'
            index += 2
        } else if (glob[index] === '*') {
            source += '[^/]*'
            index += 1
        } else if (glob[index] === '?') {
            source += '[^/]'
            index += 1
        } else {
            source += glob[index].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
            index += 1
        }
    }
    const pattern = new RegExp(`^(?:${source})$`)
    globCache.set(glob, pattern)
    return pattern
}

/** The glob matches the path or one of its directories. */
function pathMatches(path: string, glob: string): boolean {
    const pattern = globRegex(glob)
    const segments = path.split('/')
    for (let end = segments.length; end > 0; end -= 1) {
        if (pattern.test(segments.slice(0, end).join('/'))) return true
    }
    return false
}

function covers(rule: AllowRule, path: string): boolean {
    return rule.globs.some((glob) => pathMatches(path, glob))
}

function allowed(path: string, line: string, rules: readonly AllowRule[] = ALLOWLIST): boolean {
    return rules.some((rule) => covers(rule, path) && rule.line.test(line))
}

/** Each line is a hit at most once: when any scan that covers the path matches it outside that scan's rows. */
function scanLines(path: string, lines: readonly string[], scans: readonly Scan[] = SCANS): string[] {
    const active = scans.filter((scan) => scan.globs.some((glob) => pathMatches(path, glob)))
    const hits: string[] = []
    lines.forEach((line, index) => {
        if (active.some((scan) => scan.pattern.test(line) && !allowed(path, line, scan.allow))) {
            hits.push(`${path}:${index + 1}: ${line.trim().slice(0, MAX_HIT_CHARS)}`)
        }
    })
    return hits
}

/** The repository's top level (vitest runs from the project root). */
function repoRoot(): string {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 }).trim()
}

/**
 * Tracked plus untracked, non-ignored files (D-10: the purge left many files
 * untracked), without dotenv files; throws when git cannot list them.
 * Read-only: never writes the index.
 */
function listedFiles(root: string): string[] {
    const output = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000,
    })
    return [...new Set(output.split('\0').filter((path) => path && !isDotenv(path)))]
}

/** The file's lines, or null for a symlink, a binary, or a file missing from the work tree. */
function readLines(root: string, relative: string): string[] | null {
    const path = join(root, relative)
    try {
        const stat = lstatSync(path)
        if (stat.isSymbolicLink() || !stat.isFile()) return null
        const data = readFileSync(path)
        if (data.includes(0)) return null
        return data.toString('utf8').split(/\r\n|\r|\n/)
    } catch {
        return null
    }
}

function scanRepository(root: string, list: (root: string) => string[] = listedFiles): string[] {
    const hits: string[] = []
    for (const relative of list(root)) {
        if (isDotenv(relative)) continue // never read, whatever the lister returns
        const lines = readLines(root, relative)
        if (lines) hits.push(...scanLines(relative, lines))
    }
    return hits
}

/** Only `report` reports; unset, empty, strict and enforce fail on hits, and any other value does too, with a warning. */
function gateMode(value: string | undefined): { mode: GateMode; warning: string | null } {
    const mode = (value ?? '').trim().toLowerCase() || 'strict'
    if (mode === 'report' || mode === 'strict' || mode === 'enforce') return { mode, warning: null }
    return { mode: 'strict', warning: `${MODE_ENV}='${mode.slice(0, 40)}' is not report, strict or enforce: enforcing` }
}

function report(hits: readonly string[]): string {
    const files = new Set(hits.map((hit) => hit.split(':', 1)[0])).size
    return [`${hits.length} MiniMax or legacy-voice references outside the allow-list in ${files} files`, ...hits].join('\n')
}

/** Report mode logs and never throws; every other mode throws on any hit. */
function runGate(value: string | undefined, scan: () => string[] = () => scanRepository(repoRoot()), log: (text: string) => void = console.log): void {
    const { mode, warning } = gateMode(value)
    if (warning) log(warning)
    if (mode === 'report') {
        try {
            log(report(scan()))
        } catch (error) {
            log(`MiniMax grep gate could not scan (${error instanceof Error ? error.name : 'unknown'}); nothing recorded`)
        }
        return
    }
    const hits = scan()
    if (hits.length > 0) throw new Error(report(hits))
}

describe('MiniMax and legacy-voice grep gate (15 §6.2, native cutover)', () => {
    it('fails on any hit outside the allow-list (reports only in report mode)', () => {
        runGate(process.env[MODE_ENV])
    }, 60_000)
})

describe('MiniMax and legacy-voice grep gate logic', () => {
    const scratch: string[] = []
    afterEach(() => {
        for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
    })

    it('uses the §6.2 forbidden pattern', () => {
        for (const line of ['MiniMax', 'speech-2.8-turbo', 'speech_2_8_turbo', 't2a_v2', 'MINIMAX_AUDIO_API_KEY', 'VOICE_MINIMAX_X', 'TTS_DEFAULT_VOICE_ID', 'language_boost', 'audio_hex', 'hex_payload', 'base_resp', 'sample_rate: 32000', '32_000']) {
            expect(FORBIDDEN.test(line), line).toBe(true)
        }
        for (const line of ['eleven_flash_v2_5', 'sample_rate: 44100', '320000', '132000', 'mini max']) {
            expect(FORBIDDEN.test(line), line).toBe(false)
        }
    })

    it('uses the legacy-voice pattern, without the kept voice terms', () => {
        for (const line of [
            "reason: 'unmapped_legacy'",
            'useVoiceReviewFlags()',
            '/voice-review-flags',
            'export function ReviewNotice()',
            "flags: ['pitch_dropped', 'vol_dropped', 'speed_clamped']",
            'FirstExposureNotice',
            'voice_first_exposure',
            'LegacyMappingModule',
            '/admin/voices/legacy-mapping/coverage',
            'legacy_hidden: true',
            "code: 'global_preset_legacy'",
            'isLegacyGlobalPreset(row)',
            'legacy_voice_id: string',
            'base_voice_id: string | null',
            'preset.base_voice_name',
            't.voiceCatalog.convertedFromV1',
            'v1PresetNeedsUpdate',
            'LEGACY_PROVIDER',
            'CharacterVoiceLegacyV1',
            'MiniMaxVoiceV1',
            "'voice_v1_not_allowed'",
            'v1_translation',
            "'voice-v1'",
            'conversion_draft',
            'conversion_flags',
            "setting: 'rollout_mode'",
            'canary_percent',
            "voice_id: 'English_radiant_girl'",
        ]) {
            expect(LEGACY_VOICE.test(line), line).toBe(true)
        }
        for (const line of [
            "badges: ['needs_reselect']",
            "code: 'voice_reload_required'",
            "category: 'consent_stale'",
            'stripSpeechMarkupV1(text)',
            "const WS_BEARER_SUBPROTOCOL = 'mw.bearer.v1'",
            "script_version: 'acc-v1'",
            "version: 'tos-v1'",
            'Workspace R1 rollout states',
            "const KEY = 'FAKE_KEY_CANARY'",
            'legacyGalleryTarget(hash)',
            "model_id: 'eleven_flash_v2_5'",
            'Review removals',
            "status: 'needs_review'",
            'runPreview({ voice_id: baseVoice.id, text })',
            'provider_voice_id: string',
        ]) {
            expect(LEGACY_VOICE.test(line), line).toBe(false)
        }
    })

    it('matches globs per path segment and covers directories', () => {
        expect(pathMatches('docs/voice_refactor/research/06.md', 'docs/voice_refactor/**')).toBe(true)
        expect(pathMatches('src/shared/voice/voiceIdentity.ts', 'src/**')).toBe(true)
        expect(pathMatches('src', 'src/**')).toBe(true)
        expect(pathMatches('docs/src/x.md', 'src/**')).toBe(false)
        expect(pathMatches('.storybook/preview.tsx', '.storybook/**')).toBe(true)
        expect(pathMatches('src/features/x/y.test.tsx', '**/*.test.tsx')).toBe(true)
        expect(pathMatches('src/features/x/y.test.tsx', 'src/*.test.tsx')).toBe(false)
        expect(pathMatches('CLAUDE.md', 'CLAUDE.md')).toBe(true)
        expect(pathMatches('docs/CLAUDE.md', 'CLAUDE.md')).toBe(false)
    })

    it('allows a hit only when the path and the line both match', () => {
        expect(allowed('src/features/gallery/x.ts', "model_alias: 'minimax_music_3'")).toBe(true)
        expect(allowed('src/features/gallery/x.ts', 'spoken with MiniMax text-to-speech')).toBe(false)
        expect(allowed('src/app/i18n/locales/en.ts', "label: 'MiniMax Music 3',")).toBe(true)
        expect(allowed('src/app/i18n/locales/en.ts', 'replies are spoken with MiniMax text-to-speech.')).toBe(false)
        expect(allowed('CLAUDE.md', 'provider abstraction (OpenAI/Anthropic/Google/MiniMax…)')).toBe(true)
        expect(allowed('README.md', 'provider abstraction (OpenAI/Anthropic/Google/MiniMax…)')).toBe(false)
        expect(allowed(SELF, 'minimax')).toBe(true)
    })

    it('refuses MiniMax as a voice in every shipped file: no V1 reader, no stored-row fixture', () => {
        // The V1 parser, voiceIdentity and storedVoiceLanguage rows are gone with the V1 schema.
        expect(allowed('src/shared/voice/voiceIdentity.ts', 'return `minimax:${voice.voice_id}`')).toBe(false)
        expect(allowed('src/shared/voice/storedVoiceLanguage.ts', "const boost = (voice.language_boost ?? '').trim()")).toBe(false)
        expect(allowed('src/shared/types/voicePreset.types.ts', '  language_boost?: string | null;')).toBe(false)
        expect(allowed('src/shared/types/voice.types.ts', "provider_route: 'minimax' | 'elevenlabs'")).toBe(false)
        // The legacy stored-row fixture module and its imports are gone too.
        expect(allowed('src/test/fixtures/legacyMinimax.ts', "export const LEGACY_TTS_PROVIDER = 'minimax' as const")).toBe(false)
        expect(allowed('src/features/x/y.test.ts', "import { LEGACY_CALL_TTS_PROVIDER } from '@/test/fixtures/legacyMinimax'")).toBe(false)
        expect(allowed('src/features/interaction/utils/callTurnMarkup.test.ts', "metadata: { voice: { tts_provider: 'minimax_streaming' } }")).toBe(false)
        expect(allowed('src/features/x/y.test.ts', "model_alias: 'speech_2_8_turbo'")).toBe(false)
        // 32 kHz only where it is not MiniMax; the live voice frame types lost their row.
        expect(allowed('src/infrastructure/api/index.ts', 'value.content.length > 32000')).toBe(true)
        expect(allowed('src/shared/types/voice.types.ts', 'export type VoiceAudioSampleRate = 32000')).toBe(false)
        // Q1 closed (I-71): the retired privacy variant and the MiniMax consent copy are refused wherever they lived.
        for (const [path, line] of [
            ['src/features/legal/documents/privacyVoiceCopy.ts', "export const PRIVACY_VOICE_VARIANT: PrivacyVoiceVariantId = 'minimaxOnly'"],
            ['src/features/legal/documents/privacyVoiceCopy.ts', 'depending on your account, MiniMax or ElevenLabs'],
            ['src/features/legal/documents/consentCopy.ts', "'voice-v1': { processing: 'Replies are synthesized with MiniMax text-to-speech.' },"],
            ['src/features/legal/documents/consentCopy.release.test.ts', "expect(copy.processing).toContain('MiniMax')"],
            ['src/features/legal/components/LegalPage.test.tsx', "provider_route: 'minimax',"],
            ['src/features/legal/components/LegalPage.tsx', 'minimaxOnly'],
            ['src/app/i18n/locales/en.ts', "        body1: 'Character replies may be synthesized with MiniMax text-to-speech.',"],
            ['src/app/i18n/locales/es.ts', "        body1: 'Las respuestas de personajes pueden sintetizarse con texto a voz de MiniMax.',"],
        ]) {
            expect(allowed(path, line), `${path}: ${line}`).toBe(false)
        }
    })

    it('allows the documentation rows only for their files and lines', () => {
        // Q7 is closed (owner OK, 2026-10-14): the agent instruction file names ElevenLabs, so no stale TTS line is allowed.
        expect(allowed('AGENTS.md', 'media `FAL_KEY`, `MINIMAX_*`; runtime')).toBe(false)
        expect(allowed('README.md', 'media `FAL_KEY`, `MINIMAX_*`; runtime')).toBe(false)
        // docs/llm_profiles: theme-song lines only, never a speech line that mentions a song.
        expect(allowed('docs/llm_profiles/a.md', 'los aliases `ace_step`/`minimax_music_3`')).toBe(true)
        expect(allowed('docs/llm_profiles/a.md', 'la canción y la voz de MiniMax')).toBe(false)
        // docs: MiniMax as an LLM vendor or model (out of scope), never as a voice.
        expect(allowed('docs/novel_refactor/02.md', '| MiniMax-M2 | 200k context |')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'OpenAI, Anthropic and MiniMax are LLM providers behind magic-llm')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'MiniMax como proveedor de LLM')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'Narration is spoken with MiniMax text-to-speech')).toBe(false)
        expect(allowed('src/features/novel/x.ts', "model: 'MiniMax-M2'")).toBe(false)
    })

    it('scans for the legacy-voice machinery in src and .storybook only, allowing the guard tests', () => {
        expect(scanLines('src/features/voices/x.ts', ["reason: 'unmapped_legacy'"])).toEqual(["src/features/voices/x.ts:1: reason: 'unmapped_legacy'"])
        expect(scanLines('.storybook/preview.tsx', ['useFirstExposure()'])).toEqual(['.storybook/preview.tsx:1: useFirstExposure()'])
        expect(scanLines('src/features/x/y.test.ts', ['listVoiceReviewFlags'])).toEqual(['src/features/x/y.test.ts:1: listVoiceReviewFlags'])
        // Docs keep their history: the legacy-voice scan never covers them.
        expect(scanLines('docs/voice_refactor/03.md', ['unmapped_legacy', 'rollout_mode'])).toEqual([])
        expect(scanLines('docs/a.md', ['canary_percent'])).toEqual([])
        // The guard tests name what they assert is gone; only they and the gate are allowed.
        const guard = "expect(apiSource).not.toContain('review-flags')"
        expect(scanLines('src/features/admin/voices/consoleModules.guard.test.ts', [guard])).toEqual([])
        expect(scanLines('src/shared/types/adminVoiceCatalog.types.test.ts', ['expect(source).not.toMatch(/legacy_hidden/)'])).toEqual([])
        expect(scanLines('src/features/admin/voices/other.test.ts', [guard])).toEqual([`src/features/admin/voices/other.test.ts:1: ${guard}`])
        expect(allowed(SELF, 'unmapped_legacy', LEGACY_VOICE_ALLOWLIST)).toBe(true)
        // A MiniMax row never allows a legacy-voice hit, and a guard row never allows MiniMax.
        expect(scanLines('src/features/x/y.ts', ["'minimax_music_3' // rollout_mode"])).toEqual(["src/features/x/y.ts:1: 'minimax_music_3' // rollout_mode"])
        expect(scanLines('src/shared/types/adminVoiceCatalog.types.test.ts', ["provider: 'minimax'"])).toEqual([
            "src/shared/types/adminVoiceCatalog.types.test.ts:1: provider: 'minimax'",
        ])
        // A line is reported once, even when both scans match it.
        expect(scanLines('src/a.ts', ["{ provider: 'minimax', reason: 'unmapped_legacy' }"])).toHaveLength(1)
    })

    it('never lists or reads dotenv files, except the committed example', () => {
        for (const path of ['.env', '.env.local', '.env.production', 'config/.env', 'apps/web/.env.development']) {
            expect(isDotenv(path), path).toBe(true)
        }
        for (const path of ['.env.example', 'config/.env.example', '.envrc', 'src/env.ts', 'docs/environment.md']) {
            expect(isDotenv(path), path).toBe(false)
        }
        const dir = mkdtempSync(join(tmpdir(), 'minimax-gate-dotenv-'))
        scratch.push(dir)
        writeFileSync(join(dir, '.env'), 'VITE_MINIMAX_KEY=secret-value\n')
        writeFileSync(join(dir, 'kept.ts'), "const x = 'minimax'\n")
        // Even a lister that returns the file never gets it read or echoed.
        expect(scanRepository(dir, () => ['.env', 'kept.ts'])).toEqual(["kept.ts:1: const x = 'minimax'"])
    })

    it('skips an untracked, non-ignored .env in a real repository', () => {
        const dir = mkdtempSync(join(tmpdir(), 'minimax-gate-dotenv-repo-'))
        scratch.push(dir)
        try {
            // A throwaway repository in the temp dir: nothing is staged or committed anywhere.
            execFileSync('git', ['init', '-q', dir], { encoding: 'utf8', timeout: 60_000, stdio: 'ignore' })
        } catch {
            return // no git here: nothing to check
        }
        mkdirSync(join(dir, 'config'))
        writeFileSync(join(dir, '.env'), 'VITE_MINIMAX_KEY=secret-value\n')
        writeFileSync(join(dir, '.env.production'), 'MINIMAX_AUDIO_API_KEY=secret-value\n')
        writeFileSync(join(dir, join('config', '.env')), 'minimax\n')
        writeFileSync(join(dir, '.env.example'), 'MINIMAX_AUDIO_API_KEY=\n')
        expect(listedFiles(dir).sort()).toEqual(['.env.example'])
        const hits = scanRepository(dir)
        expect(hits).toEqual(['.env.example:1: MINIMAX_AUDIO_API_KEY='])
        expect(hits.join('\n')).not.toContain('secret-value')
    })

    it('reports path, line number and a bounded excerpt', () => {
        expect(scanLines('docs/a.md', ['ok', '  TTS via MiniMax  ', 'minimax_music_3', `${'x'.repeat(200)} minimax`])).toEqual([
            'docs/a.md:2: TTS via MiniMax',
            `docs/a.md:4: ${'x'.repeat(MAX_HIT_CHARS)}`,
        ])
    })

    it('reads listed text files only: no binaries, symlinks or missing files', () => {
        const dir = mkdtempSync(join(tmpdir(), 'minimax-gate-'))
        scratch.push(dir)
        writeFileSync(join(dir, 'kept.ts'), "const x = 'minimax'\n")
        writeFileSync(join(dir, 'blob.bin'), Buffer.from([0x6d, 0x69, 0x6e, 0x69, 0x6d, 0x61, 0x78, 0x00]))
        writeFileSync(join(dir, 'unlisted.ts'), 'minimax\n')
        symlinkSync(join(dir, 'kept.ts'), join(dir, 'link.ts'))
        const list = () => ['kept.ts', 'blob.bin', 'link.ts', 'deleted.ts']
        expect(scanRepository(dir, list)).toEqual(["kept.ts:1: const x = 'minimax'"])
    })

    it('lists the repository without build output or dependencies', () => {
        let files: string[]
        try {
            files = listedFiles(repoRoot())
        } catch {
            return // git cannot list this checkout: nothing to check
        }
        expect(files).toContain('package.json')
        expect(files).toContain(SELF)
        expect(files.some((path) => /^(?:node_modules|dist|storybook-static|ds-bundle)\//.test(path))).toBe(false)
        expect(files.some(isDotenv)).toBe(false)
    })

    it('lists untracked files and skips ignored ones', () => {
        const dir = mkdtempSync(join(tmpdir(), 'minimax-gate-repo-'))
        scratch.push(dir)
        try {
            // A throwaway repository in the temp dir: nothing is staged or committed anywhere.
            execFileSync('git', ['init', '-q', dir], { encoding: 'utf8', timeout: 60_000, stdio: 'ignore' })
        } catch {
            return // no git here: nothing to check
        }
        writeFileSync(join(dir, '.gitignore'), 'dist/\n')
        mkdirSync(join(dir, 'src'))
        mkdirSync(join(dir, 'dist'))
        writeFileSync(join(dir, 'src', 'new.ts'), "const x = 'minimax'\n")
        writeFileSync(join(dir, 'dist', 'bundle.js'), "const x = 'minimax'\n")
        expect(listedFiles(dir).sort()).toEqual(['.gitignore', 'src/new.ts'])
        expect(scanRepository(dir)).toEqual(["src/new.ts:1: const x = 'minimax'"])
    })

    it('enforces by default, reports only in report mode, and never turns off on a typo', () => {
        const hits = ['src/a.ts:1: MiniMax']
        const log = vi.fn()
        runGate('report', () => hits, log)
        runGate(' Report ', () => hits, log)
        expect(log).toHaveBeenCalledTimes(2)
        expect(log.mock.calls[0][0]).toContain('1 MiniMax or legacy-voice references outside the allow-list in 1 files')
        runGate('report', () => {
            throw new Error('git missing')
        }, log)
        expect(log.mock.calls[2][0]).toContain('could not scan (Error)')
        for (const mode of [undefined, '', '  ', 'strict', 'ENFORCE']) {
            expect(() => runGate(mode, () => hits, log), String(mode)).toThrow('src/a.ts:1: MiniMax')
            expect(() => runGate(mode, () => [], log), String(mode)).not.toThrow()
        }
        // Strict mode never swallows a scan failure.
        expect(() => runGate(undefined, () => {
            throw new Error('git missing')
        }, log)).toThrow('git missing')
        // Any other value enforces, with a warning line first.
        log.mockClear()
        expect(() => runGate('stirct', () => hits, log)).toThrow('src/a.ts:1: MiniMax')
        expect(log.mock.calls.map((call) => call[0])).toEqual([`${MODE_ENV}='stirct' is not report, strict or enforce: enforcing`])
    })
})
