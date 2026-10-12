/**
 * Image generation profiles — mirrors magic-worlds-api `src/models/image_profiles.py`.
 *
 * A profile is a catalog model plus its settings and custom provider fields.
 * Root's system profiles run on the platform key and cost credits; a user's own
 * profiles run on the user's provider key (sent per request, never stored) and
 * cost no credits.
 */

export type ImageProvider = 'fal' | 'openrouter'
export type ImageProfileScope = 'system' | 'user'
export type ImageCredentialMode = 'platform' | 'user_byok'

/** A setting value: bool, int, float, or an enum choice (string or number). */
export type ImageSettingValue = boolean | number | string

export interface ImageCatalogSetting {
    kind: 'bool' | 'int' | 'float' | 'enum'
    /** Sent when the profile leaves the setting unset; null lets the provider decide. */
    default: ImageSettingValue | null
    minimum: number | null
    maximum: number | null
    choices: Array<string | number>
    /** The provider field the setting is sent as; null when it is the setting key. */
    field: string | null
}

export interface ImageCatalogModel {
    provider: ImageProvider
    model_id: string
    display_name: string
    vendor: string
    summary: string
    /** Prompt family: how the prompt writer phrases prompts for this model. */
    family: string
    supports_negative_prompt: boolean
    settings: Record<string, ImageCatalogSetting>
}

export interface ImageCatalogProvider {
    provider: ImageProvider
    /** Whether system profiles on this provider can run (a platform key exists). */
    platform_available: boolean
}

export interface ImageCatalog {
    models: ImageCatalogModel[]
    providers: ImageCatalogProvider[]
}

export interface ImageProfile {
    profile_id: string
    scope: ImageProfileScope
    name: string
    description: string
    status: 'active' | 'archived'
    provider: ImageProvider
    model_id: string
    model_display_name: string | null
    family: string | null
    settings: Record<string, ImageSettingValue>
    provider_options: Record<string, unknown>
    credit_cost: number
    credential_mode: ImageCredentialMode
    /** False when the model left the catalog or the platform key is missing. */
    available: boolean
    row_version: number
    created_at: string
    updated_at: string
}

export interface ImageProfileList {
    items: ImageProfile[]
    system_default_profile_id: string | null
    user_default_profile_id: string | null
    /** What a generation uses when no profile is picked. */
    effective_default_profile_id: string | null
}

export interface ImageProfileMutation {
    name: string
    description: string
    provider: ImageProvider
    model_id: string
    settings: Record<string, ImageSettingValue>
    provider_options: Record<string, unknown>
    /** System profiles only: credits one generation costs. */
    credit_cost?: number
}
