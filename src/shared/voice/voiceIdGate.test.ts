/**
 * D35 grep gate (09 §3.4): no `voice_id` reads outside the V1 parser and the
 * identity helpers, so no FE check can silently key on the legacy V1 shape and
 * hide V2 voices. The repo has no CI workflow: `pnpm test` is the gate.
 */
import { describe, expect, it } from 'vitest'

const files = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
})

/** Permanent: the only modules allowed to read `voice_id` (D35). */
const ALLOW = new Set(['/src/shared/voice/parseStoredVoice.ts', '/src/shared/voice/voiceIdentity.ts'])

const BAD = [
    /\.voice_id\b/, // member access, including `?.voice_id`
    /\[['"]voice_id['"]\]/, // bracket access
    /\{[^}]*\bvoice_id\b[^}]*\}\s*=/, // destructuring assignment
    /\(\s*\{[^}]*\bvoice_id\b[^}]*\}\s*(?::[^)]*)?\)\s*=>/, // destructured arrow parameter
]

const offends = (source: string) => BAD.some((re) => re.test(source))

describe('voice_id grep gate (D35)', () => {
    it('scans the source tree', () => {
        expect(Object.keys(files).length).toBeGreaterThan(100)
        expect(files['/src/utils/cardTransforms.ts']).toEqual(expect.any(String))
        expect(Object.keys(files).some((path) => /\.test\.tsx?$/.test(path))).toBe(false)
    })

    it('finds no V1-keyed voice reads outside the V1 parser and the helpers', () => {
        const offenders = Object.entries(files)
            .filter(([path]) => !ALLOW.has(path))
            .filter(([, source]) => offends(source))
            .map(([path]) => path)
        expect(offenders).toEqual([])
    })

    it('detects every forbidden read form', () => {
        expect(offends('const id = voice.voice_id')).toBe(true)
        expect(offends('const id = voice?.voice_id')).toBe(true)
        expect(offends("const id = voice['voice_id']")).toBe(true)
        expect(offends('const { voice_id } = voice')).toBe(true)
        expect(offends('const { voice_id: id, speed } = voice')).toBe(true)
        expect(offends('const pick = ({ voice_id }: Voice) => voice_id')).toBe(true)
        // Writing the V1 key (e.g. a stored-row fixture) is not a read.
        expect(offends('runPreview({ voice_id: baseVoice.id, text })')).toBe(false)
        expect(offends('const id = preset.base_voice_id')).toBe(false)
    })
})
