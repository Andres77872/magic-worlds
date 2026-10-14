/**
 * The MiniMax grep gate (voice refactor 15 §6.2, amended for the voice purge,
 * I-68: purge plan §3.5 and decision D-10).
 *
 * The forbidden pattern and the row semantics match the BFF's
 * `tests/test_minimax_grep_gate.py`; the file listing and the default mode are
 * set separately in each repository, so check both gates when changing either.
 * Here every tracked and every untracked, non-ignored file (`git ls-files
 * --cached --others --exclude-standard`, so git-ignored `dist/`,
 * `storybook-static/`, `ds-bundle/` and `node_modules/` are skipped) is scanned
 * for the §6.2 forbidden patterns, and a hit is dropped only when an allow-list
 * row matches its path **and** its line. Dotenv files (`.env`, `.env.*`, except
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
 * and a glob that matches a directory covers everything under it. A row's
 * `except` globs take paths back out of its `globs`. Allowed line
 * regexes are case-insensitive, like the forbidden pattern. This file is
 * excluded from its own scan: it has to spell the patterns out.
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

interface AllowRule {
    globs: readonly string[]
    /** Paths the row never covers, even when one of its `globs` matches. */
    except?: readonly string[]
    line: RegExp
    reason: string
}

const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx'] as const

/** Legacy fixtures may be imported by tests, stories and story/test fixture modules only, never by shipped code. */
const FIXTURE_CONSUMERS = ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'src/**/fixtures.ts', 'src/**/storybook/**'] as const

const ANY_LINE = /.*/
/** Purge plan §3.5, in its order, then the rows the purge integration (F3b) added. */
const ALLOWLIST: readonly AllowRule[] = [
    { globs: ['**'], line: /minimax_music_3|minimax\/music-3|MiniMax Music/i, reason: 'Theme songs (D01)' },
    {
        globs: ['CLAUDE.md', 'AGENTS.md'],
        line: /OpenAI\/Anthropic\/Google\/MiniMax/i,
        reason: 'magic-llm provider list (LLM, not speech)',
    },
    { globs: ['src/app/i18n/locales/en.ts', 'src/app/i18n/locales/es.ts'], line: /minimax_music_3|MiniMax Music/i, reason: 'Theme-song model keys only' },
    {
        // Amended from §3.5: no `voice_id` alternative (`minimax:` covers voiceIdentity), and never a test,
        // since tests import the legacy literals (plan §2.0 rule 4).
        globs: ['src/shared/**/voice*'],
        except: TEST_FILES,
        line: /minimax:|language_boost/i,
        reason: 'V1 parser, voiceIdentity, storedVoiceLanguage (D35)',
    },
    { globs: ['src/test/fixtures/legacyMinimax.ts'], line: ANY_LINE, reason: 'Legacy stored-row fixtures (D23)' },
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
        globs: [
            'docs/voice_refactor/**',
            'docs/voice-calls-review-2026-10-11.md',
            'docs/voice-calls-latency-review-2026-10-11.md',
            'docs/ui-audit-2026-09-19-play-admin.md',
        ],
        line: ANY_LINE,
        reason: 'Dated history and the plan',
    },
    {
        globs: ['docs/llm_profiles/**'],
        line: /minimax_music_3|music_3_0|ACE-Step y MiniMax|aliases direct-MiniMax/i,
        reason: 'Theme-song writer and retired music-alias lines only',
    },
    { globs: ['.design/**'], line: ANY_LINE, reason: 'Design scratch (base64 false positives); not shipped' },
    { globs: [SELF], line: ANY_LINE, reason: 'The gate itself' },
    // Rows added by the purge integration (F3b), each for a named owner decision.
    {
        globs: FIXTURE_CONSUMERS,
        // The whole line is the import (one-line form, or the closing line of a multi-line import).
        line: /^\s*(?:import\s+(?:type\s+)?(?:\{[^'"}]*\}|\*\s+as\s+\w+)\s+|\}\s*)from\s+['"]@\/test\/fixtures\/legacyMinimax['"];?\s*$/i,
        reason: 'Imports of the legacy stored-row fixtures (plan §2.0 rule 4: legacy literals are imported, never re-typed)',
    },
    // Q1 is closed (I-71, 2026-10-14): the Privacy page publishes the ElevenLabs variant, so the
    // legal copy keeps no allowance (the self-tests below pin the former rows as refused).
    {
        globs: ['AGENTS.md'],
        line: /`MINIMAX_\*`|TTS via MiniMax|MiniMax \(TTS speech-2\.8-turbo\)/i,
        reason: 'Q7: agent instruction files are not edited without the owner OK; stale TTS lines until approved',
    },
    {
        globs: ['docs/llm_profiles/12_implementation_status.md'],
        line: /`MINIMAX_API_KEY` \(sin lector\)/i,
        reason: 'Retired LLM catalog key history (MiniMax as an LLM provider is out of scope)',
    },
    {
        globs: ['docs/**'],
        line: /MiniMax-(?:M\d|Text)|\bLLM providers?\b|proveedor(?:es)? (?:de )?LLM/i,
        reason: 'MiniMax as an LLM vendor or model (out of scope): docs from other workflows may list it',
    },
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
    return rule.globs.some((glob) => pathMatches(path, glob)) && !(rule.except ?? []).some((glob) => pathMatches(path, glob))
}

function allowed(path: string, line: string, rules: readonly AllowRule[] = ALLOWLIST): boolean {
    return rules.some((rule) => covers(rule, path) && rule.line.test(line))
}

function scanLines(path: string, lines: readonly string[], rules: readonly AllowRule[] = ALLOWLIST): string[] {
    const hits: string[] = []
    lines.forEach((line, index) => {
        if (FORBIDDEN.test(line) && !allowed(path, line, rules)) hits.push(`${path}:${index + 1}: ${line.trim().slice(0, MAX_HIT_CHARS)}`)
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
    return [`${hits.length} MiniMax references outside the allow-list in ${files} files`, ...hits].join('\n')
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

describe('MiniMax grep gate (15 §6.2)', () => {
    it('fails on any hit outside the allow-list (reports only in report mode)', () => {
        runGate(process.env[MODE_ENV])
    }, 60_000)
})

describe('MiniMax grep gate logic', () => {
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

    it('matches globs per path segment and covers directories', () => {
        expect(pathMatches('docs/voice_refactor/research/06.md', 'docs/voice_refactor/**')).toBe(true)
        expect(pathMatches('src/shared/voice/voiceIdentity.ts', 'src/shared/**/voice*')).toBe(true)
        expect(pathMatches('src/shared/voice/parseStoredVoice.ts', 'src/shared/**/voice*')).toBe(true)
        expect(pathMatches('src/shared/types/voice.types.ts', 'src/shared/**/voice*')).toBe(true)
        expect(pathMatches('src/shared/hooks/useThing.ts', 'src/shared/**/voice*')).toBe(false)
        expect(pathMatches('src/features/voice/x.ts', 'src/shared/**/voice*')).toBe(false)
        expect(pathMatches('CLAUDE.md', 'CLAUDE.md')).toBe(true)
        expect(pathMatches('docs/CLAUDE.md', 'CLAUDE.md')).toBe(false)
    })

    it('allows a hit only when the path and the line both match', () => {
        expect(allowed('src/features/gallery/x.ts', "model_alias: 'minimax_music_3'")).toBe(true)
        expect(allowed('src/features/gallery/x.ts', 'spoken with MiniMax text-to-speech')).toBe(false)
        expect(allowed('src/app/i18n/locales/en.ts', "label: 'MiniMax Music 3',")).toBe(true)
        expect(allowed('src/app/i18n/locales/en.ts', 'replies are spoken with MiniMax text-to-speech.')).toBe(false)
        expect(allowed('src/shared/voice/voiceIdentity.ts', 'return `minimax:${voice.voice_id}`')).toBe(true)
        expect(allowed('src/shared/voice/voiceIdentity.ts', "provider: 'minimax'")).toBe(false)
        expect(allowed('src/features/call/x.ts', 'return `minimax:${id}`')).toBe(false)
        expect(allowed('CLAUDE.md', 'provider abstraction (OpenAI/Anthropic/Google/MiniMax…)')).toBe(true)
        expect(allowed('README.md', 'provider abstraction (OpenAI/Anthropic/Google/MiniMax…)')).toBe(false)
        expect(allowed(SELF, 'minimax')).toBe(true)
    })

    it('keeps the shared V1 reader row out of tests and off voice_id lines', () => {
        expect(allowed('src/shared/types/voicePreset.types.ts', '  language_boost?: string | null;')).toBe(true)
        expect(allowed('src/shared/voice/storedVoiceLanguage.ts', "const boost = (voice.language_boost ?? '').trim()")).toBe(true)
        expect(allowed('src/shared/types/voice.types.ts', "provider_route: 'minimax' | 'elevenlabs' // voice_id")).toBe(false)
        // Tests import the legacy literals instead (plan §2.0 rule 4).
        expect(allowed('src/shared/voice/parseStoredVoice.test.ts', "    language_boost: 'English',")).toBe(false)
        expect(allowed('src/shared/voice/voiceIdentity.test.ts', "expect(voiceIdentity(v1())).toBe('minimax:English_radiant_girl')")).toBe(false)
        expect(allowed('src/shared/voice/voiceIdentity.test.tsx', 'return `minimax:${id}`')).toBe(false)
    })

    it('allows the purge rows only for their files and lines', () => {
        // The legacy-fixture import line, in tests, stories and their fixture modules only; never a re-typed literal.
        const fixtureImport = "import { LEGACY_V1_VOICE } from '@/test/fixtures/legacyMinimax'"
        expect(allowed('src/features/x/y.test.ts', fixtureImport)).toBe(true)
        expect(allowed('src/features/x/Y.test.tsx', `${fixtureImport};`)).toBe(true)
        expect(allowed('src/features/x/Y.stories.tsx', fixtureImport)).toBe(true)
        expect(allowed('src/features/voices/fixtures.ts', "import { LEGACY_V1_PRESET, LEGACY_V1_VOICE } from '@/test/fixtures/legacyMinimax'")).toBe(true)
        expect(allowed('src/features/voices/storybook/voiceStoryApi.ts', fixtureImport)).toBe(true)
        expect(allowed('src/features/x/y.test.ts', "import type { LegacyRow } from '@/test/fixtures/legacyMinimax'")).toBe(true)
        expect(allowed('src/features/x/y.test.ts', "} from '@/test/fixtures/legacyMinimax'")).toBe(true)
        expect(allowed('src/features/x/y.test.ts', "const provider = 'minimax'")).toBe(false)
        expect(allowed('docs/x.md', fixtureImport)).toBe(false)
        // Shipped code never imports the fixtures (the literal would reach the bundle).
        expect(allowed('src/features/call/useStartCall.ts', "import { LEGACY_CALL_TTS_PROVIDER } from '@/test/fixtures/legacyMinimax'")).toBe(false)
        expect(allowed('src/features/voices/voiceFromCatalog.ts', fixtureImport)).toBe(false)
        // The whole line must be the import: no trailing statement, no other import before it.
        expect(allowed('src/features/x/y.test.ts', `${fixtureImport}; const provider = 'minimax'`)).toBe(false)
        expect(allowed('src/features/x/y.test.ts', `import { x } from 'y'; const p = 'minimax'; ${fixtureImport}`)).toBe(false)
        expect(allowed('src/test/fixtures/legacyMinimax.ts', "export const LEGACY_TTS_PROVIDER = 'minimax' as const")).toBe(true)
        // 32 kHz only where it is not MiniMax; the live voice frame types lost their row.
        expect(allowed('src/infrastructure/api/index.ts', 'value.content.length > 32000')).toBe(true)
        expect(allowed('src/shared/types/voice.types.ts', 'export type VoiceAudioSampleRate = 32000')).toBe(false)
        // Q1 closed (I-71): the retired privacy variant is refused in every file that carried it; Q7: the agent instruction file.
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "export const PRIVACY_VOICE_VARIANT: PrivacyVoiceVariantId = 'minimaxOnly'")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "id: 'privacy-voice-minimax',")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "'Character replies may be synthesized with MiniMax text-to-speech.',")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "'Las respuestas de personajes pueden sintetizarse con texto a voz de MiniMax.',")).toBe(false)
        // The deleted dual-provider draft (I-68) is not allowed back, in either language.
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "`... según tu cuenta, MiniMax o ElevenLabs. En las llamadas ...`")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', 'depending on your account, MiniMax or ElevenLabs')).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.ts', "const provider = 'minimax'")).toBe(false)
        expect(allowed('src/features/legal/documents/consentCopy.ts', "return switches.privacyVariant !== 'minimaxOnly'")).toBe(false)
        expect(allowed('src/features/legal/documents/consentCopy.ts', "'voice-v1': { processing: 'Replies are synthesized with MiniMax text-to-speech.' },")).toBe(false)
        expect(allowed('src/features/legal/documents/consentCopy.ts', "provider: 'minimax',")).toBe(false)
        expect(allowed('src/features/legal/documents/consentCopy.release.test.ts', "expect(IN_APP_COPY_SWITCHES.privacyVariant).toBe('minimaxOnly')")).toBe(false)
        expect(allowed('src/features/legal/documents/consentCopy.release.test.ts', "expect(copy.processing).toContain('MiniMax')")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.test.ts', "expect(PRIVACY_VOICE_VARIANT).toBe('minimaxOnly')")).toBe(false)
        expect(allowed('src/features/legal/documents/legalDocuments.gate.test.ts', "if (PRIVACY_VOICE_VARIANT !== 'minimaxOnly') expect(wired.status).toBe('final')")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.test.ts', "expect(text).toContain('MiniMax')")).toBe(false)
        expect(allowed('src/features/legal/documents/privacyVoiceCopy.test.ts', "expect(text).toContain('minimax_streaming')")).toBe(false)
        expect(allowed('src/features/legal/components/LegalPage.test.tsx', "'... con texto a voz de MiniMax.',")).toBe(false)
        expect(allowed('src/features/legal/components/LegalPage.test.tsx', "'Character replies may be synthesized with MiniMax text-to-speech.',")).toBe(false)
        expect(allowed('src/features/legal/components/LegalPage.test.tsx', "provider_route: 'minimax',")).toBe(false)
        expect(allowed('src/features/legal/components/LegalPage.test.tsx', 'minimaxOnly')).toBe(false)
        expect(allowed('src/features/legal/components/LegalPage.tsx', 'minimaxOnly')).toBe(false)
        expect(allowed('src/app/i18n/locales/en.ts', "        body1: 'Character replies may be synthesized with MiniMax text-to-speech.',")).toBe(false)
        expect(allowed('src/app/i18n/locales/es.ts', "        body1: 'Las respuestas de personajes pueden sintetizarse con texto a voz de MiniMax.',")).toBe(false)
        expect(allowed('src/app/i18n/locales/en.ts', "        processing: 'Replies are synthesized with MiniMax text-to-speech.',")).toBe(false)
        expect(allowed('AGENTS.md', 'media `FAL_KEY`, `MINIMAX_*`; runtime')).toBe(true)
        expect(allowed('README.md', 'media `FAL_KEY`, `MINIMAX_*`; runtime')).toBe(false)
        // docs/llm_profiles: theme-song lines only, never a speech line that mentions a song.
        expect(allowed('docs/llm_profiles/a.md', 'los aliases `ace_step`/`minimax_music_3`')).toBe(true)
        expect(allowed('docs/llm_profiles/a.md', 'la canción y la voz de MiniMax')).toBe(false)
        // docs: MiniMax as an LLM vendor or model (out of scope), never as a voice.
        expect(allowed('docs/novel_refactor/02_competitive_landscape.md', '| MiniMax-M2 | 200k context |')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'OpenAI, Anthropic and MiniMax are LLM providers behind magic-llm')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'MiniMax como proveedor de LLM')).toBe(true)
        expect(allowed('docs/novel_refactor/03.md', 'Narration is spoken with MiniMax text-to-speech')).toBe(false)
        expect(allowed('src/features/novel/x.ts', "model: 'MiniMax-M2'")).toBe(false)
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
        expect(log.mock.calls[0][0]).toContain('1 MiniMax references outside the allow-list in 1 files')
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
