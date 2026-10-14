import { describe, expect, it } from 'vitest'

/**
 * Voice console module guard (R1-FE-06, then the I-68 voice purge): the
 * console modules deleted with the redesign stay deleted, and so do the
 * legacy-route modules the purge removed (the provider inventory, the legacy
 * audition, the reverse mapping) and the user-facing legacy studio. The
 * forward legacy mapping stays: it is pure data the V1 reader and the R5
 * rewrite read. The API keeps no legacy-provider admin route.
 */

const consoleFiles = Object.keys(import.meta.glob('/src/features/admin/voices/**/*.{ts,tsx}'))
const legacyStudioFiles = Object.keys(import.meta.glob('/src/features/voices/legacy/**/*.{ts,tsx}'))
const apiSource = Object.values(
    import.meta.glob<string>('/src/infrastructure/api/index.ts', { query: '?raw', import: 'default', eager: true }),
)[0]

/** Any spelling of the retired speech provider's name in a module path. */
const RETIRED_PROVIDER_NAME = /mini[-_ ]?max/i

const DELETED_CONSOLE_MODULES = [
    'components/AudioDropzone',
    'components/ControlSlider',
    'components/SynthControls',
    'components/SynthLabPanel',
    'components/SystemVoiceBrowser',
    'components/TextArtifactToolbar',
    'components/VoiceCloneForm',
    'components/VoiceCreatePanel',
    'components/VoiceDesignForm',
    'components/VoiceLibraryPanel',
    'components/VoiceResultCard',
    'components/VoiceRow',
    'hexAudio',
    'hooks/useVoiceStudio',
    'voiceIdRules',
    'voiceLanguage',
    // Removed with the legacy route (I-68).
    'components/mapping/LegacyCustomVoices',
    'components/mapping/ReverseMappingTable',
    'legacyAudition',
    'legacyInventory',
]

/** The forward legacy mapping: kept (03 §1.6 "Remain"). */
const KEPT_MAPPING = ['components/mapping/LegacyMappingModule.tsx', 'components/mapping/CoverageReport.tsx', 'components/mapping/MappingEditorDrawer.tsx']

const stem = (file: string) => file.replace('/src/features/admin/voices/', '').replace(/(\.test|\.stories)?\.tsx?$/, '')

describe('voice console module guard (R1-FE-06, I-68)', () => {
    it('finds the console sources', () => {
        expect(consoleFiles.length).toBeGreaterThan(40)
        expect(consoleFiles).toContain('/src/features/admin/voices/components/globalPresets/GlobalPresetsModule.tsx')
    })

    it.each(DELETED_CONSOLE_MODULES)('keeps the console module %s deleted (with its tests and stories)', (module) => {
        expect(consoleFiles.filter((file) => stem(file) === module)).toEqual([])
    })

    it('has no console module named after the retired speech provider', () => {
        expect(consoleFiles.filter((file) => RETIRED_PROVIDER_NAME.test(file))).toEqual([])
    })

    it.each(KEPT_MAPPING)('keeps the forward legacy mapping module %s', (file) => {
        expect(consoleFiles).toContain(`/src/features/admin/voices/${file}`)
    })

    it('keeps the user-facing legacy studio deleted', () => {
        expect(legacyStudioFiles).toEqual([])
    })

    it('keeps no legacy-provider, reverse-mapping or clone admin route in the API', () => {
        // `/admin/voices/legacy-mapping` (hyphen) is the kept forward mapping; any `/admin/voices/legacy/…` path was the provider.
        expect(apiSource).toContain('/admin/voices/legacy-mapping')
        expect(apiSource).not.toMatch(/\/admin\/voices\/legacy\//)
        // Nor any other `legacy-…` route (the reverse mapping was one).
        expect(apiSource).not.toMatch(/\/admin\/voices\/legacy-(?!mapping)/)
        expect(apiSource).not.toMatch(/['`"]\/admin\/voices\/clone/)
    })
})
