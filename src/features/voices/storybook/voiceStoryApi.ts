/**
 * Story-only fakes for the R1 voice UI (never imported by the application).
 *
 *     beforeEach: (context) => installVoiceStoryApi(context.parameters.voiceApi)
 *
 * Every `apiService` method is shadowed by a local fake for the story's
 * lifetime: the voice reads answer from the shared fixtures, writes echo the
 * draft back, audio renders reject (Storybook plays no audio), and any other
 * call rejects, so a voice story never reaches an API. The returned function
 * restores the singleton.
 */
import { apiService } from '@/infrastructure/api'
import type {
    CatalogPage,
    CatalogQuery,
    CatalogVoice,
    PreviewTextsResponse,
    UserPreferences,
    UserPreferencesUpdate,
    VoiceCapabilities,
    VoicePreset,
    VoicePresetV2Write,
} from '@/shared'
import { CAPABILITIES_EL_PLUS, CATALOG_PAGE, PRESET_V2_USER } from '../fixtures'

export interface VoiceStoryApiOptions {
    /** `'fail'`: the capabilities read fails (the V2 surfaces show their read-only state). */
    capabilities?: VoiceCapabilities | 'fail'
    presets?: VoicePreset[]
    /** `'unavailable'`: the catalog answers 404; `'loading'`: it never answers. */
    catalog?: CatalogVoice[] | 'unavailable' | 'loading'
    /** Page size of the fake catalog, to show "Load more". */
    catalogPageSize?: number
    /**
     * `GET /user/me`'s membership (usage fields, `limits.voice_preview`): the preview
     * allowance, the credit label and the Studio usage strip. Unset, the read fails.
     */
    membership?: Record<string, unknown>
}

const STORY_PREVIEW_TEXTS: PreviewTextsResponse = {
    items: [
        { text_id: 'narration', kind: 'narration', text: 'The lanterns along the harbour flickered as the tide came in.' },
        { text_id: 'dialogue', kind: 'dialogue', text: '"Keep your voice down. The ferryman listens to everything."' },
        { text_id: 'thought', kind: 'thought', text: 'One more crossing, and the promise would finally be kept.' },
    ],
}

class StoryApiError extends Error {
    readonly status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

const never = () => new Promise<never>(() => {})

function storyCatalogPage(catalog: CatalogVoice[], filters: CatalogQuery, cursor: string | null | undefined, pageSize: number): CatalogPage {
    const q = (filters.q ?? '').trim().toLowerCase()
    const matches = catalog.filter((item) => (!q || item.display_name.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q))
        && (!filters.provider || (item.provider ?? 'elevenlabs') === filters.provider)
        && (!filters.gender || item.gender === filters.gender)
        && (!filters.age || item.age === filters.age)
        && (filters.tags ?? []).every((tag) => item.tags.includes(tag)))
    const start = Number(cursor ?? 0) || 0
    const end = start + pageSize
    return { items: matches.slice(start, end), next_cursor: end < matches.length ? String(end) : null }
}

export function installVoiceStoryApi(options: VoiceStoryApiOptions = {}): () => void {
    const capabilities = options.capabilities ?? CAPABILITIES_EL_PLUS
    const catalog = options.catalog ?? CATALOG_PAGE
    const catalogItems = Array.isArray(catalog) ? catalog : []
    const pageSize = options.catalogPageSize ?? 24
    let presets = [...(options.presets ?? [])]
    let preferences: UserPreferences = {
        preferred_language: 'en',
        has_preference: true,
        narration_tier: (capabilities === 'fail' ? null : capabilities.narration_tier) ?? 'standard',
    }
    const service = apiService as unknown as Record<string, unknown>
    const saved = new Map<string, PropertyDescriptor | undefined>()
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(apiService))) {
        if (key === 'constructor' || typeof service[key] !== 'function') continue
        saved.set(key, Object.getOwnPropertyDescriptor(apiService, key))
        Object.defineProperty(apiService, key, {
            configurable: true,
            writable: true,
            value: async () => { throw new StoryApiError(`The voice story has no fake for ${key}.`, 0) },
        })
    }
    const write = (body: VoicePresetV2Write, presetId: string): VoicePreset => ({
        ...PRESET_V2_USER,
        ...body,
        ...(body.provider === 'fish_audio' ? { schema_version: 3 as const, provider: 'fish_audio' as const, settings: null } : { schema_version: 2 as const, provider: 'elevenlabs' as const }),
        preset_id: presetId,
        voice_name: catalogItems.find((item) => item.voice_key === body.voice_key)?.display_name ?? PRESET_V2_USER.voice_name,
        is_global: false,
    })
    Object.assign(service, {
        withWorkspace: () => apiService,
        getVoiceCapabilities: async () => {
            if (capabilities === 'fail') throw new StoryApiError('Voice capabilities are not available.', 404)
            return capabilities
        },
        // Synchronous, like the real cache peek: the async catch-all above would hand useVoiceCapabilities a Promise.
        peekVoiceCapabilities: () => null,
        listVoiceCatalog: (filters: CatalogQuery = {}, cursor?: string | null) => {
            if (catalog === 'loading') return never()
            if (catalog === 'unavailable') return Promise.reject(new StoryApiError('The voice catalog is not available.', 404))
            return Promise.resolve(storyCatalogPage(catalog, filters, cursor, pageSize))
        },
        getVoiceCatalogByKeys: async (keys: readonly string[]) => catalogItems.filter((item) => keys.includes(item.voice_key)),
        listVoicePresets: async () => presets,
        createVoicePreset: async (body: VoicePresetV2Write) => {
            const row = write(body, `story-${presets.length + 1}`)
            presets = [row, ...presets]
            return row
        },
        updateVoicePreset: async (presetId: string, body: VoicePresetV2Write) => {
            const row = write(body, presetId)
            presets = presets.map((item) => (item.preset_id === presetId ? row : item))
            return row
        },
        deleteVoicePreset: async (presetId: string) => {
            presets = presets.filter((row) => row.preset_id !== presetId)
        },
        getUserProfile: async () => {
            if (!options.membership) throw new StoryApiError('The voice story has no profile.', 0)
            return { membership: options.membership }
        },
        getUserPreferences: async () => preferences,
        updateUserPreferences: async (body: UserPreferencesUpdate) => {
            preferences = { ...preferences, ...body }
            return preferences
        },
        getPreviewTexts: async () => STORY_PREVIEW_TEXTS,
        previewVoice: async () => { throw new StoryApiError('Previews are not rendered in Storybook.', 503) },
        fetchProtectedMediaBlob: async () => { throw new StoryApiError('Samples are not played in Storybook.', 503) },
    })
    return () => {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(apiService, key, descriptor)
            else delete service[key]
        }
    }
}
