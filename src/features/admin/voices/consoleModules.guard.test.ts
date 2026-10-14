import { describe, expect, it } from 'vitest'

/**
 * Voice console module guard (R1-FE-06, the I-68 voice purge, then the native
 * cutover): the console modules deleted with the redesign stay deleted, and so
 * do the legacy-route modules the purges removed (the provider inventory, the
 * legacy audition, the reverse and forward legacy mappings with their coverage
 * report) and the user-facing legacy studio. The API keeps no legacy-provider,
 * legacy-mapping or review-flag route.
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
    // Removed with the native cutover: no legacy voice can reach the catalog.
    'components/mapping/LegacyMappingModule',
    'components/mapping/CoverageReport',
    'components/mapping/MappingEditorDrawer',
    'components/shell/OrderedVoiceList',
]

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

    it('keeps the legacy mapping folder deleted', () => {
        expect(consoleFiles.filter((file) => file.includes('/components/mapping/'))).toEqual([])
    })

    it('keeps the user-facing legacy studio deleted', () => {
        expect(legacyStudioFiles).toEqual([])
    })

    it('keeps no legacy-provider, legacy-mapping, review-flag or clone route in the API', () => {
        // Any `/admin/voices/legacy/…` path was the provider; `legacy-…` paths were the mappings.
        expect(apiSource).not.toMatch(/\/admin\/voices\/legacy[/-]/)
        expect(apiSource).not.toContain('review-flags')
        expect(apiSource).not.toMatch(/['`"]\/admin\/voices\/clone/)
    })
})
