/**
 * Image profile fixtures for stories and tests: a slice of the real catalog
 * (magic-worlds-api `catalog.py`) and the profiles root and a user would see.
 */
import type { ImageCatalog, ImageProfile, ImageProfileList } from '@/shared/types/imageProfile.types'
import type { ImageProfilesConsole } from './useImageProfilesConsole'
import { emptyDraft, draftFrom } from './imageProfileModel'

export const imageCatalog: ImageCatalog = {
    providers: [{ provider: 'fal', platform_available: true }, { provider: 'openrouter', platform_available: false }],
    models: [
        { provider: 'fal', model_id: 'fal-ai/krea-2/turbo', display_name: 'Krea 2 Turbo', vendor: 'Krea',
            summary: 'Fast 8-step model with a strong painterly and photographic eye.', family: 'krea2', supports_negative_prompt: false,
            settings: {
                acceleration: { kind: 'enum', default: 'none', minimum: null, maximum: null, choices: ['none', 'regular'], field: null },
                enable_safety_checker: { kind: 'bool', default: true, minimum: null, maximum: null, choices: [], field: null },
            } },
        { provider: 'fal', model_id: 'openai/gpt-image-2.5/flare/text-to-image', display_name: 'GPT Image 2.5 Flare', vendor: 'OpenAI',
            summary: 'OpenAI’s fast image model; quality comparable to GPT Image 2.', family: 'gpt-image', supports_negative_prompt: false,
            settings: {
                quality: { kind: 'enum', default: 'low', minimum: null, maximum: null, choices: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'], field: null },
                background: { kind: 'enum', default: null, minimum: null, maximum: null, choices: ['auto', 'transparent', 'opaque'], field: null },
                output_compression: { kind: 'int', default: null, minimum: 0, maximum: 100, choices: [], field: null },
            } },
        { provider: 'fal', model_id: 'fal-ai/fast-lightning-sdxl', display_name: 'SDXL Lightning', vendor: 'ByteDance',
            summary: 'Cheapest and fastest; short prompts only (77-token CLIP window).', family: 'sdxl-lightning', supports_negative_prompt: false,
            settings: {
                num_inference_steps: { kind: 'enum', default: 4, minimum: null, maximum: null, choices: [1, 2, 4, 8], field: null },
                // This endpoint calls its output format field "format".
                output_format: { kind: 'enum', default: 'jpeg', minimum: null, maximum: null, choices: ['jpeg', 'png'], field: 'format' },
            } },
        { provider: 'fal', model_id: 'fal-ai/sana', display_name: 'Sana', vendor: 'NVIDIA',
            summary: 'Efficient linear DiT with real guidance and a negative prompt.', family: 'sana', supports_negative_prompt: true,
            settings: {
                num_inference_steps: { kind: 'int', default: 18, minimum: 1, maximum: 50, choices: [], field: null },
                guidance_scale: { kind: 'float', default: 5, minimum: 0, maximum: 20, choices: [], field: null },
            } },
        { provider: 'openrouter', model_id: 'google/gemini-3.1-flash-image', display_name: 'Gemini 3.1 Flash Image', vendor: 'Google',
            summary: 'Nano Banana 2; sharper detail with a choice of resolution.', family: 'gemini-image', supports_negative_prompt: false,
            settings: { resolution: { kind: 'enum', default: '1K', minimum: null, maximum: null, choices: ['512', '1K', '2K', '4K'], field: null } } },
    ],
}

const stamp = { created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-08T16:30:00Z' }

export const kreaProfile: ImageProfile = {
    profile_id: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2e01', scope: 'system', status: 'active', name: 'Krea 2 Turbo',
    description: 'The house look: painterly portraits in seconds.', provider: 'fal', model_id: 'fal-ai/krea-2/turbo',
    model_display_name: 'Krea 2 Turbo', family: 'krea2', settings: {}, provider_options: {}, credit_cost: 1,
    credential_mode: 'platform', available: true, row_version: 3, ...stamp,
}

export const gptProfile: ImageProfile = {
    ...kreaProfile, profile_id: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2e02', name: 'GPT Image 2.5 Flare', description: 'Reads long briefs well; slower.',
    model_id: 'openai/gpt-image-2.5/flare/text-to-image', model_display_name: 'GPT Image 2.5 Flare', family: 'gpt-image',
    settings: { quality: 'medium' }, credit_cost: 3, row_version: 1,
}

export const geminiProfile: ImageProfile = {
    ...kreaProfile, profile_id: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2e03', name: 'Gemini Flash Image', description: '',
    provider: 'openrouter', model_id: 'google/gemini-3.1-flash-image', model_display_name: 'Gemini 3.1 Flash Image', family: 'gemini-image',
    credit_cost: 2, available: false, row_version: 1,
}

export const archivedProfile: ImageProfile = {
    ...kreaProfile, profile_id: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2e04', name: 'Sana (retired)', description: 'Kept for the images it made.',
    status: 'archived', model_id: 'fal-ai/sana', model_display_name: 'Sana', family: 'sana', settings: { guidance_scale: 4.5 },
    provider_options: { style_name: 'Cinematic' }, row_version: 5,
}

export const personalProfile: ImageProfile = {
    ...kreaProfile, profile_id: '0b6f1d7e-4f6a-4c55-9a1e-7a3f0c1d2e05', scope: 'user', name: 'My Sana', description: 'Moody, cinematic covers on my fal key.',
    model_id: 'fal-ai/sana', model_display_name: 'Sana', family: 'sana', settings: { num_inference_steps: 24 }, credit_cost: 0,
    credential_mode: 'user_byok', row_version: 2,
}

export const rootList: ImageProfileList = {
    items: [kreaProfile, gptProfile, geminiProfile, archivedProfile],
    system_default_profile_id: kreaProfile.profile_id, user_default_profile_id: null, effective_default_profile_id: kreaProfile.profile_id,
}

export const userList: ImageProfileList = {
    items: [kreaProfile, gptProfile, geminiProfile, personalProfile],
    system_default_profile_id: kreaProfile.profile_id, user_default_profile_id: personalProfile.profile_id,
    effective_default_profile_id: personalProfile.profile_id,
}

const noop = () => {}

function consoleState(systemAdmin: boolean, list: ImageProfileList | null): ImageProfilesConsole {
    return {
        systemAdmin, loading: false, busy: false, error: null, notice: null, catalog: imageCatalog, list,
        editor: null, confirm: null, heldKeys: [],
        actions: {
            refresh: noop, openCreate: noop, openEdit: noop, closeEditor: noop, updateDraft: noop, chooseModel: noop, setPropsValid: noop,
            save: noop, requestArchive: noop, cancelArchive: noop, confirmArchive: noop, setUserDefault: noop, setGlobalDefault: noop,
            seedStarter: noop, forgetKeys: noop, clearNotice: noop,
        },
    }
}

export const rootConsole = consoleState(true, rootList)
export const userConsole = consoleState(false, userList)
export const emptyRootConsole = consoleState(true, { items: [], system_default_profile_id: null, user_default_profile_id: null, effective_default_profile_id: null })

export const newSystemDraft = emptyDraft(imageCatalog, true)
export const gptDraft = draftFrom(gptProfile, true)
export const personalDraft = draftFrom(personalProfile, false)
