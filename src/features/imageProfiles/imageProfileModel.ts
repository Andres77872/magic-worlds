/**
 * Pure helpers for the image profile screens: drafts, settings and the custom
 * provider field rules (mirroring magic-worlds-api `catalog.py`).
 */
import type {
    ImageCatalog,
    ImageCatalogModel,
    ImageProfile,
    ImageProfileMutation,
    ImageProvider,
    ImageSettingValue,
} from '@/shared/types/imageProfile.types'
import { CLIENT_PRIVATE, parseProviderOptions, type ProviderOptionsResult } from '@/features/llmProfiles/llmProfileModel'

export const IMAGE_PROVIDERS: readonly ImageProvider[] = ['fal', 'openrouter']

/** The magic-worlds-api variable holding each provider's platform key (named in root's warnings). */
export const PLATFORM_KEY_ENV: Record<ImageProvider, string> = { fal: 'FAL_KEY', openrouter: 'OPENROUTER_API_KEY' }

// Mirrors RESERVED_PROVIDER_FIELDS: fields the adapters own on every request.
const ADAPTER_FIELDS = ['prompt', 'negative_prompt', 'model', 'n', 'num_images', 'image_size', 'aspect_ratio', 'size',
    'sync_mode', 'webhook_url', 'stream', 'image_url', 'image_urls', 'input_references', 'reference_image_urls',
    'mask_url', 'user', 'api_key', 'authorization', 'fal_key', 'request_id', 'status_url', 'response_url', 'cancel_url']

/** Custom fields may not shadow an adapter field, one of the model's own settings or the field a setting is sent as. */
export function imageOptionsParser(model: ImageCatalogModel | undefined): (text: string) => ProviderOptionsResult {
    const settings = Object.entries(model?.settings ?? {}).flatMap(([key, setting]) => setting.field ? [key, setting.field] : [key])
    const reserved = new Set([...ADAPTER_FIELDS, ...CLIENT_PRIVATE, ...settings])
    return text => parseProviderOptions(text, reserved)
}

// Python's str.isprintable(): no control, format or separator character but the plain space.
const NOT_PRINTABLE = /(?! )[\p{C}\p{Z}]/u

/** Why the server would refuse a profile name (it takes one trimmed, printable line), or null. */
export function nameIssue(name: string): 'required' | 'text' | null {
    const trimmed = name.trim()
    if (!trimmed) return 'required'
    return NOT_PRINTABLE.test(trimmed) ? 'text' : null
}

/** The draft as the server takes it: name and description without surrounding whitespace. */
export function trimmedDraft(draft: ImageProfileMutation): ImageProfileMutation {
    return { ...draft, name: draft.name.trim(), description: draft.description.trim() }
}

export function catalogModel(catalog: ImageCatalog | null, provider: ImageProvider, modelId: string): ImageCatalogModel | undefined {
    return catalog?.models.find(model => model.provider === provider && model.model_id === modelId)
}

export function emptyDraft(catalog: ImageCatalog | null, system: boolean): ImageProfileMutation {
    const first = catalog?.models[0]
    return {
        name: first?.display_name ?? '',
        description: '',
        provider: first?.provider ?? 'fal',
        model_id: first?.model_id ?? '',
        settings: {},
        provider_options: {},
        ...(system ? { credit_cost: 1 } : {}),
    }
}

export function draftFrom(profile: ImageProfile, system: boolean): ImageProfileMutation {
    return {
        name: profile.name,
        description: profile.description,
        provider: profile.provider,
        model_id: profile.model_id,
        settings: { ...profile.settings },
        provider_options: { ...profile.provider_options },
        ...(system ? { credit_cost: profile.credit_cost } : {}),
    }
}

/** Switching models keeps only the settings the new model also has, with a value it accepts. */
export function withModel(draft: ImageProfileMutation, model: ImageCatalogModel, previousName?: string): ImageProfileMutation {
    const settings = Object.fromEntries(Object.entries(draft.settings)
        .filter(([key, value]) => key in model.settings && settingIssue(model, key, value) === null))
    const renamed = !draft.name.trim() || draft.name === previousName
    return { ...draft, provider: model.provider, model_id: model.model_id, settings, name: renamed ? model.display_name : draft.name }
}

/** `num_inference_steps` → `Inference steps`: provider field names read as labels. */
export function settingLabel(key: string): string {
    const words = key.replace(/^num_/, '').replace(/_/g, ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A typed value for a setting, or undefined to leave it to the default. */
export function settingValue(kind: 'bool' | 'int' | 'float' | 'enum', raw: string, choices: Array<string | number> = []): ImageSettingValue | undefined {
    if (raw === '') return undefined
    if (kind === 'bool') return raw === 'true'
    if (kind === 'enum') return choices.find(choice => String(choice) === raw)
    const value = Number(raw)
    if (!Number.isFinite(value)) return undefined
    return kind === 'int' ? Math.trunc(value) : value
}

/**
 * Why the server would refuse a setting value (mirroring `Setting.validate`), or null:
 * `choice` for an enum value outside the choices or a non-boolean switch, `range`
 * for a number that is out of range or not of the setting's kind.
 */
export function settingIssue(model: ImageCatalogModel, key: string, value: ImageSettingValue | undefined): 'range' | 'choice' | null {
    const setting = model.settings[key]
    if (value === undefined || !setting) return null
    if (setting.kind === 'bool') return typeof value === 'boolean' ? null : 'choice'
    if (setting.kind === 'enum') return setting.choices.includes(value as string | number) ? null : 'choice'
    if (typeof value !== 'number' || !Number.isFinite(value) || (setting.kind === 'int' && !Number.isInteger(value))) return 'range'
    if ((setting.minimum !== null && value < setting.minimum) || (setting.maximum !== null && value > setting.maximum)) return 'range'
    return null
}

/** The profiles a generation can pick, defaults first. */
export function pickableProfiles(profiles: ImageProfile[]): ImageProfile[] {
    return profiles.filter(profile => profile.status === 'active' && profile.available)
        .sort((a, b) => Number(a.scope === 'user') - Number(b.scope === 'user') || a.name.localeCompare(b.name))
}

export function sameDraft(a: ImageProfileMutation, b: ImageProfileMutation): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}
