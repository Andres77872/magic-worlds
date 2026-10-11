export type LlmCredentialMode = 'platform' | 'user_byok'

export type LlmFeature =
    | 'card_generation' | 'card_assistant' | 'novel'
    | 'chat_adventure' | 'chat_character' | 'chat_group'
    | 'lorebook_assistant' | 'lorebook_extraction'
    | 'image_prompt' | 'theme_song_writer' | 'callbot'
    | 'app_assistant'

export type LlmSelection =
    | { mode: 'inherit' }
    | { mode: 'profile'; profile_id: string }

/** Transient execution input; exclude from history, drafts and preferences. */
export interface LlmRequest {
    retry_of_execution_id?: string
    selection?: LlmSelection
    expected_revision_id?: string
    credentials?: { api_key: string }
}

export interface LlmExecutionProvenance {
    execution_id: string
    profile_id: string
    revision_id: string
    resolution_source: 'user_feature' | 'user_default' | 'system_feature' | 'system_default' | 'explicit'
    credential_mode: LlmCredentialMode
    replayed: boolean
}
