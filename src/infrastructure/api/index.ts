import { verifyAssistantTurn } from './assistantContract'
import { assertPublicLlmData, assertEffectiveLlmProfile, assertLlmCapacityUsage, assertLlmProfileCompatibility, assertLlmProviderUsage } from './llmProfileContract'
import { prepareLlmRequest, prepareRetainedLlmRequest } from './llmPreparation'
import { isLlmRequestSpent, llmIntents } from './llmIntent'
import type { LlmFeature, LlmRequest, LlmSelection } from '@/shared/types/llm.types'
import type {
    LlmPage, LlmProfileSummary, LlmProfileDetail, LlmProfileMutation, LlmPreferences,
    LlmPreferencesView, LlmFeatureView, LlmCatalogModel, LlmConnection,
    EffectiveLlmProfile, LlmAuditEvent, LlmProfileTestResult, LlmProfileTestTarget, LlmCapacityUsage, LlmProfileCompatibility,
    LlmProviderUsage, LlmExecutionState,
} from '@/shared/types/llmProfile.types'
import { verifyThemeSongJob, verifyThemeSongList, verifyUserThemeSongList } from './themeSongContract'
import { verifyCardGeneration } from './cardContract'
import { verifyLorebookExtraction, verifyLorebookExtractionStatus, matchesLorebookExtractionProfile, extractionContainsCredential } from './lorebookExtractionContract'
import type { LorebookExtractionCommand, LorebookExtractionOptions, LorebookExtractionResult, LorebookExtractionStatus } from '@/shared/types/lorebookExtraction.types'
import { verifyAgentList, verifyAgentDetail, verifyCustomAgentDetail, verifyAgentVersions, verifyAgentTest } from './workflowContract'
import type { TextGenerationEvent, TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * API infrastructure - centralized API request handling
 */

import { readEventStream, StreamContractError, type SseEvent } from './sse'
import type {
    AdminVoiceCloneRequest,
    AdminVoiceCloneResponse,
    AdminVoiceClonePurpose,
    AdminVoiceCloneUploadResponse,
    AdminVoiceConcreteType,
    AdminVoiceDeleteResponse,
    AdminVoiceDesignRequest,
    AdminVoiceDesignResponse,
    AdminVoiceListResponse,
    AdminVoiceQueryType,
    AdminVoiceTestRequest,
    AdminVoiceTestResponse,
} from '../../shared/types/adminVoice.types'
import type {
    VoicePreset,
    VoicePresetCreatePayload,
    VoicePresetPreviewRequest,
    VoicePresetUpdatePayload,
} from '../../shared/types/voicePreset.types'
import type {
    AgentCreateRequest,
    AgentDetail,
    CustomAgentDetail,
    AgentSummary,
    AgentTestRequest,
    AgentTestResponse,
    AgentUpdateDraftRequest,
    AgentVersionsResponse,
} from '../../shared/types/agent.types'
import type {
    BrowserAuthResponse,
    ChangePasswordResponse,
    EmailListResponse,
    GenericMessageResponse,
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfile,
} from '../../shared/types/auth.types'
import type {
    BillingCheckoutSessionResponse,
    BillingPlanCatalogResponse,
    BillingPortalSessionResponse,
    BillingReconcileResponse,
    CreditCodeGrant,
    CreditCodeGrantCreateRequest,
    CreditCodeGrantListResponse,
    CreditCodeGrantUpdateRequest,
    CreditGrantListParams,
    CreditGrantSummaryResponse,
    CreditCodeRedeemResponse,
    EmailCreditGrant,
    EmailCreditGrantClaimResponse,
    EmailCreditGrantCreateRequest,
    EmailCreditGrantListResponse,
    EmailCreditGrantOfferListResponse,
    EmailCreditGrantUpdateRequest,
    QuotaResetRequest,
    QuotaResetResponse,
    MembershipAssignRequest,
    MembershipAssignResponse,
    MembershipMemberListParams,
    MembershipMemberListResponse,
    MembershipOverviewResponse,
    MembershipPlan,
    MembershipPlanCreateRequest,
    MembershipPlanListResponse,
    MembershipPlanUpdateRequest,
} from '../../shared/types/billing.types'
import type {
    PatreonLinkRequest,
    PatreonLinkStatusResponse,
    PatreonProofConfirmRequest,
    PatreonProofRequestResponse,
    PatreonUnlinkRequest,
    PatreonUnlinkResponse,
} from '../../shared/types/patreon.types'
import { API_BASE_URL } from './baseUrl'
import { getProtectedMediaPath } from './mediaUrl'
import { isPatreonFeatureEnabled } from '../../shared/patreonFeatureFlag'
import {
    isAppAssistantFeatureEnabled,
    isTextStreamingFeatureEnabled,
    isCallsFeatureEnabled,
    isCommunityCardsFeatureEnabled,
    isLorebookResourcesFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
    isVoicesFeatureEnabled,
} from '../../shared/featureFlags'
import { makeRequestId } from '../../utils/uuid'
import { configureChatSocketAuthRefresh } from './chatSocket'
import { configureVoiceSocketAuthRefresh } from './voiceSocket'
import { authSession, type AuthSessionSnapshot } from './authSession'
import {
    serializeActivationPreview,
    serializeLorebookAttachment,
    serializeLorebookDraft,
    serializeLorebookEntry,
    serializeLorebookResource,
} from './lorebookWire'
import type { StoredConversationMessage, ChatTurnReconciliation, ChatImageAsset, ChatImageError, ChatTtsAsset, ChatTtsError, ImageLifecycleStatus, TtsLifecycleStatus } from '../../shared/types/interaction.types'
import type { VoiceCallLimits, VoiceCallListResponse, VoiceCallTranscriptResponse, VoiceSegmentUploadRequest, VoiceSegmentUploadResponse } from '../../shared/types/voice.types'
import type { AdventureSnapshot } from '../../shared/types/adventure.types'
import type {
    AssistantConversationCreate,
    AssistantConversationListResponse,
    AssistantConversationResponse,
    AssistantConversationScope,
    AssistantKind,
    AssistantLlmFeature,
    AssistantRequestOptions,
    AssistantStreamEvent,
    AssistantTurnRequest,
    AssistantTurnResponse,
    AssistantTurnStatus,
} from '../../shared/types/assistant.types'
import type {
    LoreActivationPreviewRequest,
    LoreActivationPreviewResponse,
    Lorebook,
    LorebookAttachment,
    LorebookDraft,
    LorebookEntry,
    LorebookEntryDraft,
    LorebookIssue,
    LorebookResource,
    LorebookTargetKind,
} from '../../shared/types/lorebook.types'
import type {
    AdventureTemplateCardResponse,
    AiCardRequestOptions,
    AiCardGeneratedResult,
    CharacterCardResponse,
    ItemCardResponse,
    WorldCardResponse,
} from '../../shared/types/aiCard.types'
import type {
    CardCloneResponse,
    CardShareLinkResponse,
    SharedCardListResponse,
    SharedCardResource,
    ShareableCardType,
} from '../../shared/types/cardSharing.types'
import type {
    CardDraftDocument,
    CardHistoricalDocument,
    CardPublishResult,
    CardUsage,
    CardVersion,
    CardVersionList,
    VersionableCardType,
} from '../../shared/types/cardVersion.types'
import type {
    CardMediaTargetType,
    CardPortraitRequest,
    ImageJobListResponse,
    ImageUploadResponse,
    ThemeSongCreateRequest,
    ThemeSongJobPublic,
    ThemeSongJobStatus,
    ThemeSongListResponse,
    UserThemeSongListResponse,
} from '../../shared/types/media.types'
import { THEME_SONG_NON_TERMINAL_STATUSES } from '../../shared/types/media.types'
import type {
    BackgroundTaskListResponse,
    BackgroundTaskOperation,
    BackgroundTaskPublic,
    BackgroundTaskState,
} from '../../shared/types/task.types'
import type {
    NotificationListResponse,
    NotificationReadAllResponse,
    NotificationUnreadCountResponse,
    UserNotification,
} from '../../shared/types/notification.types'
import type {
    Story,
    StoryCardRef,
    StoryChapter,
    StoryContextTrace,
    StoryCreateRequest,
    StoryGenerateRequest,
    StoryGenerateResponse,
} from '../../shared/types/story.types'

export interface AdventureSessionMessagesResponse {
    adventure_id: number
    version: number
    messages: StoredConversationMessage[]
}

export interface CharacterChatMessagesResponse {
    chat_id: number
    version: number
    messages: StoredConversationMessage[]
}

export interface ImageJobPublicResponse {
    job_id: string
    status: ImageLifecycleStatus
    status_url: string
    result_url: string
    assets?: ChatImageAsset[]
    error?: ChatImageError | null
}

export interface TtsJobPublicResponse {
    job_id: string
    status: TtsLifecycleStatus
    status_url: string
    result_url: string
    assets?: ChatTtsAsset[]
    error?: ChatTtsError | null
}

export interface ApiHealthResponse {
    status: string
}

export type ApiDependencyStatus = 'ok' | 'degraded' | 'offline'

export interface ApiDependencyService {
    id: string
    label: string
    status: ApiDependencyStatus | string
    message?: string | null
    latency_ms?: number | null
    components?: ApiDependencyService[]
}

export interface ApiDependencyHealthResponse {
    status: 'ok' | 'degraded' | 'offline' | string
    checked_at?: string
    services: ApiDependencyService[]
}

export interface VoiceConsentResponse {
    status: 'accepted'
    consent_version: string
    limits: VoiceCallLimits
}

export interface VoiceEndResponse {
    status: 'ended' | 'not_found'
    voice_session_id: string | null
    reason: string
}

export type CardExportType = 'character' | 'world' | 'adventure_template' | 'item'
export type CardShareType = ShareableCardType

const TOKEN_STORAGE_KEY = 'magic_worlds:token'
const USER_STORAGE_KEY = 'magic_worlds:user'

type AuthRefreshedDetail = BrowserAuthResponse & { token: string }

let refreshInFlight: Promise<string> | null = null

/**
 * Error thrown for non-2xx HTTP responses, carrying the status code so callers
 * can distinguish a transient backend outage (5xx — e.g. the auth service is
 * briefly down and the API returns 503) from a real client-side error. Transient
 * failures should be handled gently (retry, empty state) rather than surfaced as
 * alarming error UI.
 */
export class ApiError extends Error {
    readonly status: number
    readonly category?: string
    readonly code?: string
    readonly requestId?: string
    readonly retryable?: boolean
    readonly retryAfterSeconds?: number
    readonly action?: string
    llmRetry?: Pick<LlmRequest, 'retry_of_execution_id' | 'selection' | 'expected_revision_id'>
    /** The raw structured `detail` object, when the server returned one (e.g. a 409 already-imported conflict). */
    readonly details?: Record<string, unknown>

    constructor(status: number, message: string, metadata: Partial<Pick<ApiError, 'category' | 'code' | 'requestId' | 'retryable' | 'retryAfterSeconds' | 'action' | 'details'>> = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.category = metadata.category
        this.code = metadata.code
        this.requestId = metadata.requestId
        this.retryable = metadata.retryable
        this.retryAfterSeconds = metadata.retryAfterSeconds
        this.action = metadata.action
        this.details = metadata.details
    }

    /** A transient server-side failure (502/503/504, or any 5xx) worth retrying. */
    get isTransient(): boolean {
        return this.status >= 500 || this.retryable === true
    }
}

interface ParsedApiError {
    message: string
    category?: string
    code?: string
    requestId?: string
    retryable?: boolean
    retryAfterSeconds?: number
    action?: string
    details?: Record<string, unknown>
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined
}

function validationMessage(value: unknown): string | undefined {
    if (!Array.isArray(value) || value.length === 0) return undefined
    const first = recordValue(value[0])
    if (!first || typeof first.msg !== 'string') return undefined
    const location = Array.isArray(first.loc)
        ? first.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
            .filter((part) => part !== 'body')
            .join('.')
        : ''
    return location ? `${location}: ${first.msg}` : first.msg
}

function nestedErrorRecord(body: Record<string, unknown>): Record<string, unknown> {
    return recordValue(body.error) ?? recordValue(body.detail) ?? body
}

export function normalizeApiErrorBody(
    value: unknown,
    defaults: Pick<ParsedApiError, 'requestId' | 'retryAfterSeconds'> = {},
): ParsedApiError | null {
    const body = recordValue(value)
    if (!body) return null
    const validation = validationMessage(body.detail)
    if (validation) {
        return {
            message: validation,
            ...defaults,
            details: { validation: body.detail },
        }
    }

    const nested = nestedErrorRecord(body)
    const deeper = nestedErrorRecord(nested)
    const stringDetail = typeof body.detail === 'string' ? body.detail : undefined
    const message = stringDetail
        ?? (typeof nested.message === 'string' ? nested.message : undefined)
        ?? (typeof nested.detail === 'string' ? nested.detail : undefined)
        ?? (typeof deeper.message === 'string' ? deeper.message : undefined)
        ?? (typeof deeper.detail === 'string' ? deeper.detail : undefined)
        ?? (typeof body.message === 'string' ? body.message : undefined)
    const metadata = deeper === nested ? nested : { ...nested, ...deeper }
    const code = typeof metadata.code === 'string' ? metadata.code : undefined
    // Profile and execution errors carry only a stable code ({detail: {code}}).
    if (!message && !code) return null

    const numberValue = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
    const booleanValue = (candidate: unknown) => typeof candidate === 'boolean' ? candidate : undefined
    return {
        message: message ?? code!,
        category: typeof metadata.category === 'string' ? metadata.category : undefined,
        code,
        requestId: typeof metadata.request_id === 'string'
            ? metadata.request_id
            : typeof body.request_id === 'string'
              ? body.request_id
              : defaults.requestId,
        retryable: booleanValue(metadata.retryable),
        retryAfterSeconds: numberValue(metadata.retry_after_seconds) ?? defaults.retryAfterSeconds,
        action: typeof metadata.action === 'string' ? metadata.action : undefined,
        details: recordValue(body.detail) ?? recordValue(body.error),
    }
}

type ApiRequestOptions = RequestInit & {
    timeoutMs?: number
    rejectAccepted?: boolean
}

type HeaderRecord = Record<string, string>

type AuthRequestOwner = Pick<AuthSessionSnapshot, 'authEpoch' | 'accountKey' | 'userHash'> & {
    token: string
}

class ApiService {
    private baseUrl: string

    private async profileRequest<T>(path: string, method = 'GET', payload?: unknown, version?: number): Promise<T> {
        if (payload !== undefined) assertPublicLlmData(payload)
        if (version !== undefined && (!Number.isSafeInteger(version) || version < 0)) throw new Error('Invalid profile version.')
        const result = await this.authenticatedRequest<T>(path, this.getStoredToken(), {
            method, cache: 'no-store',
            headers: version === undefined ? {} : { 'If-Match': `"${version}"` },
            ...(payload === undefined ? {} : { body: payload as BodyInit }),
        })
        assertPublicLlmData(result)
        return result
    }

    getLlmFeatures(): Promise<{ features: LlmFeatureView[] }> {
        return this.profileRequest('/llm/features')
    }

    getLlmModels(params: { feature?: LlmFeature; provider_target?: string; role?: string; credential_mode?: string; limit?: number; offset?: number } = {}): Promise<LlmPage<LlmCatalogModel>> {
        const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
        return this.profileRequest(`/llm/models?${query}`)
    }

    getLlmProfiles(scope: 'available' | 'user' | 'system' = 'available', offset = 0, systemAdmin = false): Promise<LlmPage<LlmProfileSummary>> {
        return this.profileRequest(systemAdmin ? `/admin/llm/profiles?limit=25&offset=${offset}` : `/llm/profiles?scope=${scope}&limit=25&offset=${offset}`)
    }

    getLlmProfile(id: string, systemAdmin = false): Promise<LlmProfileDetail> {
        return this.profileRequest(`${systemAdmin ? '/admin/llm/profiles' : '/llm/profiles'}/${encodeURIComponent(id)}`)
    }

    saveLlmProfile(payload: LlmProfileMutation, systemAdmin: boolean, existing?: { id: string; version: number }): Promise<LlmProfileDetail> {
        const base = systemAdmin ? '/admin/llm/profiles' : '/user/llm/profiles'
        return this.profileRequest(existing ? `${base}/${encodeURIComponent(existing.id)}${systemAdmin ? '/draft' : ''}` : base,
            existing ? 'PATCH' : 'POST', payload, existing?.version)
    }

    archiveLlmProfile(id: string, version: number, systemAdmin = false): Promise<{ profile_id: string; status: 'archived'; row_version: number }> {
        return this.profileRequest(`${systemAdmin ? '/admin/llm/profiles' : '/user/llm/profiles'}/${encodeURIComponent(id)}/archive`, 'POST', {}, version)
    }

    getLlmPreferences(systemAdmin = false): Promise<LlmPreferencesView> {
        return this.profileRequest(systemAdmin ? '/admin/llm/policy' : '/user/llm/preferences')
    }

    saveLlmPreferences(payload: LlmPreferences, version: number, systemAdmin = false): Promise<LlmPreferencesView> {
        return this.profileRequest(systemAdmin ? '/admin/llm/policy' : '/user/llm/preferences', 'PUT', payload, version)
    }

    async resolveLlmProfile(feature: LlmFeature, selection: LlmSelection = { mode: 'inherit' }): Promise<EffectiveLlmProfile> {
        const result = await this.profileRequest<EffectiveLlmProfile>(`/llm/features/${encodeURIComponent(feature)}/resolve`, 'POST', selection)
        assertEffectiveLlmProfile(result)
        return result
    }

    async getLlmRetryProfile(feature: LlmFeature, executionId: string): Promise<EffectiveLlmProfile> {
        const result = await this.profileRequest<EffectiveLlmProfile>(`/llm/features/${encodeURIComponent(feature)}/retry-profiles/${encodeURIComponent(executionId)}`)
        assertEffectiveLlmProfile(result)
        return result
    }

    async getLlmRecoveryProfile(feature: LlmFeature, requestId: string, signal?: AbortSignal): Promise<EffectiveLlmProfile> {
        const result = await this.authenticatedRequest<EffectiveLlmProfile>(`/llm/features/${feature}/executions/${encodeURIComponent(requestId)}/profile`,
            this.getStoredToken(), { method: 'GET', cache: 'no-store', timeoutMs: 5000, signal })
        assertEffectiveLlmProfile(result)
        return result
    }

    validateLlmProfile(id: string): Promise<{ valid: true; row_version: number; affected_features: LlmFeature[] }> {
        return this.profileRequest(`/admin/llm/profiles/${encodeURIComponent(id)}/validate`, 'POST', {})
    }

    publishLlmProfile(id: string, version: number): Promise<LlmProfileDetail> {
        return this.profileRequest(`/admin/llm/profiles/${encodeURIComponent(id)}/publish`, 'POST', {}, version)
    }

    rollbackLlmProfile(id: string, revisionId: string, version: number): Promise<LlmProfileDetail> {
        return this.profileRequest(`/admin/llm/profiles/${encodeURIComponent(id)}/rollback`, 'POST', { revision_id: revisionId }, version)
    }

    getLlmConnections(): Promise<{ connections: LlmConnection[] }> {
        return this.profileRequest('/admin/llm/connections')
    }

    syncLlmCatalog(): Promise<{ model_count: number; connection_count: number; catalog_revisions: string[] }> {
        return this.profileRequest('/admin/llm/catalog/sync', 'POST', {})
    }

    /** Per-feature compatibility of a configuration as the server would resolve it; nothing is saved. */
    async checkLlmProfileCompatibility(config: LlmProfileMutation['config'], systemAdmin: boolean): Promise<LlmProfileCompatibility> {
        const result = await this.profileRequest<LlmProfileCompatibility>(`${systemAdmin ? '/admin' : '/user'}/llm/profiles/compatibility`, 'POST', config)
        assertLlmProfileCompatibility(result)
        return result
    }

    /** The caller's own LLM request counts per payer (platform credits, own key, unattributed history). */
    async getLlmCapacityUsage(): Promise<LlmCapacityUsage> {
        const result = await this.profileRequest<LlmCapacityUsage>('/llm/capacity-usage')
        assertLlmCapacityUsage(result)
        return result
    }

    /** Root: this project's provider estimates by payer for a UTC date range (defaults to this month). */
    async getLlmProviderUsage(range: { from: string; to: string } | null = null): Promise<LlmProviderUsage> {
        const day = /^\d{4}-\d{2}-\d{2}$/
        if (range && (!day.test(range.from) || !day.test(range.to) || range.from > range.to)) throw new Error('Invalid provider usage range.')
        const query = range ? `?from_date=${range.from}&to_date=${range.to}` : ''
        const result = await this.profileRequest<LlmProviderUsage>(`/admin/llm/provider-usage${query}`)
        assertLlmProviderUsage(result)
        if (range && (result.from_date !== range.from || result.to_date !== range.to)) throw new Error('Invalid LLM provider usage.')
        return result
    }

    getLlmAudit(offset = 0, profileId?: string): Promise<LlmPage<LlmAuditEvent>> {
        return this.profileRequest(`/admin/llm/audit?limit=25&offset=${offset}${profileId ? `&profile_id=${encodeURIComponent(profileId)}` : ''}`)
    }

    /** Test one feature contract (every role it uses) against a published revision or, for root, the saved draft version. */
    async testLlmProfile(id: string, target: LlmProfileTestTarget, feature: LlmFeature, requestId: string, systemAdmin: boolean, credentials?: { api_key: string }, retryOfExecutionId?: string): Promise<LlmProfileTestResult> {
        const owner = authSession.getSnapshot()
        if (credentials && !this.baseUrl.startsWith('https://')) throw new Error('Personal credentials require HTTPS.')
        if (systemAdmin && credentials) throw new Error('Platform tests cannot use personal credentials.')
        if (target.kind === 'draft' && !systemAdmin) throw new Error('Only system drafts can be tested before publishing.')
        const body: { feature: LlmFeature; expected_revision_id?: string; expected_draft_version?: number; credentials?: { api_key: string }; retry_of_execution_id?: string } = { feature,
            ...(retryOfExecutionId ? { retry_of_execution_id: retryOfExecutionId } : {}),
            ...(target.kind === 'published' ? { expected_revision_id: target.revisionId } : { expected_draft_version: target.draftVersion }),
            ...(credentials ? { credentials: { ...credentials } } : {}) }
        try {
            const result = await this.authenticatedRequest<LlmProfileTestResult>(`${systemAdmin ? '/admin/llm/profiles' : '/user/llm/profiles'}/${encodeURIComponent(id)}/test`, this.getStoredToken(), {
                method: 'POST', cache: 'no-store', headers: { 'X-Request-Id': requestId }, body: body as unknown as BodyInit,
            })
            assertPublicLlmData(result)
            if (credentials && extractionContainsCredential(result, credentials.api_key)) throw new Error('Invalid profile test response.')
            const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            if (Object.keys(result).sort().join(',') !== 'execution_id,feature,output,payer_mode,profile_id,replayed,revision_id,roles,target'
                || !uuid.test(result.execution_id) || !uuid.test(result.revision_id)
                || typeof result.replayed !== 'boolean' || result.payer_mode !== (systemAdmin ? 'platform' : 'user_byok')
                || typeof result.output !== 'string' || !result.output.trim() || result.output.length > 4096
                || result.profile_id !== id || result.feature !== feature || result.target !== target.kind
                || target.kind === 'published' && result.revision_id !== target.revisionId
                || !Array.isArray(result.roles) || result.roles[0] !== 'primary' || new Set(result.roles).size !== result.roles.length
                || result.roles.some(role => !['primary', 'metadata', 'preflight'].includes(role))) throw new Error('Invalid profile test response.')
            return result
        } catch (error) {
            await this.confirmTerminalLlmAttempt(error, feature, requestId, { selection: { mode: 'profile', profile_id: id },
                ...(target.kind === 'published' ? { expected_revision_id: target.revisionId } : {}) }, owner)
            throw error
        } finally {
            delete body.credentials
        }
    }

    async getLlmExecutionState(feature: LlmFeature, requestId: string, signal?: AbortSignal): Promise<LlmExecutionState> {
        const value = await this.authenticatedRequest<Record<string, unknown>>(`/llm/features/${feature}/executions/${encodeURIComponent(requestId)}`,
            this.getStoredToken(), { method: 'GET', cache: 'no-store', timeoutMs: 5000, signal })
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!value || Object.keys(value).sort().join(',') !== 'execution_id,recovery_required,request_id,status'
            || value.request_id !== requestId || typeof value.execution_id !== 'string' || !uuid.test(value.execution_id)
            || typeof value.recovery_required !== 'boolean'
            || !['admitted', 'running', 'completed', 'failed', 'cancelled', 'awaiting_credential'].includes(String(value.status))
            || value.status === 'completed' && value.recovery_required) {
            throw new ApiError(502, 'Execution reconciliation returned an invalid state.', { code: 'llm_execution_state_contract', retryable: false })
        }
        return { execution_id: value.execution_id, request_id: requestId,
            status: value.status as LlmExecutionState['status'], recovery_required: value.recovery_required }
    }

    private async confirmTerminalLlmAttempt(error: unknown, feature: LlmFeature, requestId: string, target: LlmRequest,
        owner: ReturnType<typeof authSession.getSnapshot>): Promise<void> {
        this.assertCurrentOwner(owner)
        if (!(error instanceof ApiError) || error.category === 'timeout'
            || error.code === 'workflow_execution_contract' || error.code === 'llm_execution_state_contract'
            || !(error.status === 0 || error.status >= 500 || ['LLM_EXECUTION_UPSTREAM_FAILED', 'LLM_EXECUTION_FINISHED'].includes(error.code || ''))) return
        const retained = await this.getLlmExecutionState(feature, requestId).catch(() => null)
        this.assertCurrentOwner(owner)
        if (retained && ['failed', 'cancelled'].includes(retained.status) && retained.recovery_required) {
            error.llmRetry = { retry_of_execution_id: retained.execution_id,
                selection: target.selection ? { ...target.selection } : { mode: 'inherit' },
                ...(target.expected_revision_id ? { expected_revision_id: target.expected_revision_id } : {}) }
        }
    }

    constructor() {
        this.baseUrl = API_BASE_URL
    }

    private assertCommunityCardsEnabled() {
        if (!isCommunityCardsFeatureEnabled()) throw new Error('Community card sharing is disabled.')
    }

    /** Card assistants are always on; lorebook and app assistants follow their feature flags. */
    private assistantKindEnabled(kind: AssistantKind): boolean {
        if (kind === 'lorebook') return isLorebooksFeatureEnabled()
        if (kind === 'app') return isAppAssistantFeatureEnabled()
        return true
    }

    private assertAssistantKindEnabled(kind: AssistantKind) {
        if (kind === 'lorebook') this.assertLorebooksEnabled()
        if (kind === 'app' && !isAppAssistantFeatureEnabled()) throw new Error('The app assistant is disabled.')
    }

    private assertLorebooksEnabled() {
        if (!isLorebooksFeatureEnabled()) throw new Error('Lorebooks are disabled.')
    }

    private assertLorebookResourcesEnabled() {
        if (!isLorebookResourcesFeatureEnabled()) throw new Error('Lorebook resources are disabled.')
    }

    private assertVoicesEnabled() {
        if (!isVoicesFeatureEnabled()) throw new Error('Voices are disabled.')
    }

    private assertCallsEnabled() {
        if (!isCallsFeatureEnabled()) throw new Error('Calls are disabled.')
    }

    private assertNovelsEnabled() {
        if (!isNovelsFeatureEnabled()) throw new Error('Novels are disabled.')
    }

    /**
     * Generic fetch wrapper with common configuration
     */
    private async request<T>(
        endpoint: string,
        options: ApiRequestOptions = {},
        parseAsJson: boolean = true,
        isAuthEndpoint: boolean = false
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const { timeoutMs, rejectAccepted, ...fetchOptions } = options
        
        // Handle JSON serialization if body is an object
        let body = fetchOptions.body
        if (body && typeof body === 'object' && (typeof FormData === 'undefined' || !(body instanceof FormData))) {
            body = JSON.stringify(body)
        }

        let didTimeout = false
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined
        let signal = fetchOptions.signal
        if (timeoutMs && timeoutMs > 0) {
            const controller = new AbortController()
            signal = controller.signal
            if (fetchOptions.signal) {
                if (fetchOptions.signal.aborted) {
                    controller.abort(fetchOptions.signal.reason)
                } else {
                    fetchOptions.signal.addEventListener('abort', () => controller.abort(fetchOptions.signal?.reason), { once: true })
                }
            }
            timeoutHandle = setTimeout(() => {
                didTimeout = true
                controller.abort(new DOMException('AI card request timed out locally', 'AbortError'))
            }, timeoutMs)
        }
         
        // Multipart uploads must NOT carry a JSON content type — the browser sets
        // `multipart/form-data; boundary=…` itself, and forcing application/json
        // (or any explicit value) strips the boundary and breaks server parsing.
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
        const headers: HeaderRecord = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            'Accept': 'application/json',
            ...this.toHeaderRecord(fetchOptions.headers)
        }
        if (isFormData) delete headers['Content-Type']
        const config: RequestInit = {
            ...fetchOptions,
            headers,
            body,
            signal
        }
        const skipAuthRecovery = isAuthEndpoint || this.isAuthLifecycleEndpoint(endpoint)
        const initiatingToken = this.authorizationToken(config.headers)
        const owner = initiatingToken && !skipAuthRecovery
            ? { ...authSession.getSnapshot(), token: initiatingToken }
            : null

        try {
            let response = await fetch(url, config)
            this.assertCurrentOwner(owner)

            // Session-expiry handling applies ONLY to already-authenticated
            // requests — never to login/register, whose 401/400/422 responses
            // must surface to the user as the real error message.
            if (response.status === 401 && !skipAuthRecovery) {
                const rotatedToken = this.getStoredToken()
                if (rotatedToken && rotatedToken !== initiatingToken) {
                    this.assertCurrentOwner(owner)
                    response = await fetch(url, this.withAuthorization(config, rotatedToken))
                    this.assertCurrentOwner(owner)
                }
                try {
                    if (response.status === 401) {
                        const nextToken = await this.waitForSignal(
                            this.refreshAccessToken(rotatedToken || initiatingToken),
                            signal,
                        )
                        this.assertCurrentOwner(owner)
                        response = await fetch(url, this.withAuthorization(config, nextToken))
                        this.assertCurrentOwner(owner)
                    }
                } catch (error) {
                    if (this.isTerminalAuthError(error)) {
                        return this.terminalAuthResult()
                    }
                    throw error
                }

                // If refresh succeeded but the retried endpoint still rejects the
                // request, keep the session intact and surface that endpoint's
                // error below. Login is forced only when /auth/refresh itself is
                // denied.
            }

            if (rejectAccepted && response.status === 202) {
                throw new ApiError(502, 'AI card generation returned an unsupported async response.', {
                    category: 'configuration_unavailable',
                    code: 'ai_card_unexpected_async_contract',
                    requestId: response.headers.get('X-Request-Id') || undefined,
                    retryable: true,
                    action: 'try_again_later',
                })
            }

            if (!response.ok) {
                const parsed = await this.extractError(response)
                // 5xx is a transient backend outage (e.g. the auth service is
                // briefly down → 503) — log quietly. Other statuses are real
                // errors worth an error-level log.
                const log = response.status >= 500 ? console.warn : console.error
                log('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    message: parsed.message,
                    category: parsed.category,
                    code: parsed.code,
                    requestId: parsed.requestId,
                })
                throw new ApiError(response.status, parsed.message, parsed)
            }

            if (parseAsJson) {
                // 204 No Content (e.g. asset deletes) and other empty bodies have no
                // JSON to parse — calling response.json() on them throws. Treat as success.
                if (response.status === 204 || response.headers.get('content-length') === '0') {
                    this.assertCurrentOwner(owner)
                    return undefined as T
                }
                const parsed = await response.json()
                this.assertCurrentOwner(owner)
                return parsed
            } else {
                const parsed = await response.text() as T
                this.assertCurrentOwner(owner)
                return parsed
            }
        } catch (error) {
            if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
                throw new ApiError(0, 'Local wait timed out. The server may still finish and save the card; retrying uses the same key to avoid duplicates.', {
                    category: 'timeout',
                    code: 'ai_card_client_timeout',
                    retryable: true,
                    action: 'retry_with_same_idempotency_key',
                })
            }
            // ApiError was already logged above with the right level; only log
            // genuine network/unexpected failures here (and keep it gentle).
            if (!(error instanceof ApiError)) {
                console.warn(`API request error for ${endpoint}:`, error)
            }
            throw error
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle)
        }
    }

    private toHeaderRecord(headers?: HeadersInit): HeaderRecord {
        const result: HeaderRecord = {}
        if (!headers) return result
        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                result[key] = value
            })
            return result
        }
        if (Array.isArray(headers)) {
            for (const [key, value] of headers) {
                result[key] = value
            }
            return result
        }
        return { ...headers }
    }

    private isAuthLifecycleEndpoint(endpoint: string): boolean {
        const path = endpoint.split('?')[0].replace(/\/+$/, '')
        return path === '/auth/login'
            || path === '/auth/register'
            || path === '/auth/platform/login'
            || path === '/auth/refresh'
            || path === '/auth/logout'
            || path === '/auth/provider-init/google'
            || path === '/auth/google/exchange'
    }

    private withAuthorization(config: RequestInit, token: string): RequestInit {
        return {
            ...config,
            headers: {
                ...this.toHeaderRecord(config.headers),
                Authorization: `Bearer ${token}`,
            },
        }
    }

    /**
     * Keep the initiating request's deadline authoritative while a process-wide
     * refresh continues for other callers. Aborting one request must not cancel
     * the shared refresh, but it must stop that request from waiting or replaying.
     */
    private async waitForSignal<T>(operation: Promise<T>, signal?: AbortSignal | null): Promise<T> {
        if (!signal) return operation
        if (signal.aborted) {
            throw signal.reason instanceof DOMException
                ? signal.reason
                : new DOMException('Request aborted', 'AbortError')
        }
        return new Promise<T>((resolve, reject) => {
            const abort = () => {
                cleanup()
                reject(signal.reason instanceof DOMException
                    ? signal.reason
                    : new DOMException('Request aborted', 'AbortError'))
            }
            const cleanup = () => signal.removeEventListener('abort', abort)
            signal.addEventListener('abort', abort, { once: true })
            operation.then(
                (value) => {
                    cleanup()
                    resolve(value)
                },
                (error) => {
                    cleanup()
                    reject(error)
                },
            )
        })
    }

    private authorizationToken(headers?: HeadersInit): string {
        const record = this.toHeaderRecord(headers)
        const entry = Object.entries(record).find(([key]) => key.toLowerCase() === 'authorization')
        const value = entry?.[1] ?? ''
        return value.replace(/^Bearer\s+/i, '').trim()
    }

    private assertCurrentOwner(owner: AuthRequestOwner | null): void {
        if (!owner) return
        if (!authSession.isCurrent(owner)) {
            throw new ApiError(401, 'Authentication changed while this request was in progress.', {
                category: 'authentication_changed',
                code: 'auth_epoch_changed',
                retryable: false,
            })
        }
    }

    private terminalAuthResult(): never {
        // A terminal refresh failure must reject every request, including GETs.
        // Returning a fabricated empty value here violates the caller's response
        // type and can overwrite real state just as the auth-expired event fires.
        throw new ApiError(401, 'Your session has expired. Please log in again.')
    }

    private expireAuth(): void {
        authSession.expire()
        localStorage.removeItem(USER_STORAGE_KEY)
        window.dispatchEvent(new CustomEvent('auth:expired'))
    }

    private selectAccessToken(response: BrowserAuthResponse): string {
        return response.session_token || response.access_token || ''
    }

    private sanitizeAuthResponse(response: BrowserAuthResponse & Record<string, unknown>, token: string): AuthRefreshedDetail {
        const sanitized = { ...response }
        delete sanitized.refresh_token
        return { ...sanitized, token }
    }

    private isTerminalAuthError(error: unknown): boolean {
        return error instanceof ApiError
            && (error.status === 401 || (error.status === 403 && !this.isForbiddenOriginError(error.status, error.message)))
    }

    private isForbiddenOriginError(status: number, message: string): boolean {
        return status === 403 && /origin not allowed/i.test(message)
    }

    private async performRefresh(oldToken: string = this.getStoredToken()): Promise<string> {
        const owner = { ...authSession.getSnapshot(), token: oldToken }
        const headers: HeaderRecord = {
            'Accept': 'application/json',
        }
        if (oldToken) {
            headers.Authorization = `Bearer ${oldToken}`
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers,
        })

        if (!response.ok) {
            const parsed = await this.extractError(response)
            const error = new ApiError(response.status, parsed.message, parsed)
            if ((response.status === 401 || response.status === 403) && !this.isForbiddenOriginError(response.status, parsed.message)) {
                this.expireAuth()
            }
            throw error
        }

        const body = await response.json() as BrowserAuthResponse & Record<string, unknown>
        const nextToken = this.selectAccessToken(body)
        if (!nextToken) {
            throw new ApiError(503, 'Authentication service returned no access token', {
                category: 'authentication_unavailable',
                code: 'auth_refresh_missing_access_token',
                retryable: true,
            })
        }

        this.assertCurrentOwner(owner)
        authSession.rotateToken(nextToken, body.user?.user_hash)
        if (body.user) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(body.user))
        }
        const detail = this.sanitizeAuthResponse(body, nextToken)
        window.dispatchEvent(new CustomEvent<AuthRefreshedDetail>('auth:refreshed', { detail }))
        return nextToken
    }

    async refreshAccessToken(oldToken: string = this.getStoredToken()): Promise<string> {
        const rotatedToken = this.getStoredToken()
        if (rotatedToken && oldToken && rotatedToken !== oldToken) return rotatedToken
        if (!refreshInFlight) {
            refreshInFlight = this.performRefresh(oldToken).finally(() => {
                refreshInFlight = null
            })
        }
        return refreshInFlight
    }

    /**
     * Extract a human-readable error message from a failed response.
     * Mirrors the API's error shapes: FastAPI `{detail}`, the provider
     * `{error: {message}}` envelope, or a plain `{message}` — falling back to
     * raw text, then the status code.
     */
    private async extractError(response: Response): Promise<ParsedApiError> {
        const requestIdHeader = response.headers.get('X-Request-Id') || undefined
        const retryAfterHeader = response.headers.get('Retry-After')
        const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined
        try {
            const body = await response.clone().json()
            const normalized = normalizeApiErrorBody(body, {
                requestId: requestIdHeader,
                retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
            })
            if (normalized) return normalized
        } catch {
            // Body is not JSON — fall through to text.
        }
        try {
            const text = (await response.text()).trim()
            if (text) return { message: text.slice(0, 300), requestId: requestIdHeader, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined }
        } catch {
            // Body already consumed or unreadable.
        }
        return { message: `Request failed (${response.status})`, requestId: requestIdHeader, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined }
    }

    /**
     * Make authenticated requests with token
     */
    async authenticatedRequest<T>(
        endpoint: string,
        token: string,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            headers: {
                ...options.headers,
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        })
    }

    private async authenticatedBlob(endpoint: string, errorMessage: string, accept: string): Promise<Blob> {
        const url = `${this.baseUrl}${endpoint}`
        const fetchOnce = (token: string) => fetch(url, {
            method: 'GET',
            headers: {
                Accept: accept,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })

        const token = this.getStoredToken()
        const owner = { ...authSession.getSnapshot(), token }
        let response = await fetchOnce(token)
        this.assertCurrentOwner(owner)
        if (response.status === 401) {
            const rotatedToken = this.getStoredToken()
            if (rotatedToken && rotatedToken !== token) {
                response = await fetchOnce(rotatedToken)
                this.assertCurrentOwner(owner)
            }
            if (response.status === 401) {
                const nextToken = await this.refreshAccessToken(rotatedToken || token)
                this.assertCurrentOwner(owner)
                response = await fetchOnce(nextToken)
                this.assertCurrentOwner(owner)
            }
        }
        if (!response.ok) {
            const parsed = await this.extractError(response)
            throw new ApiError(response.status, parsed.message || errorMessage, parsed)
        }
        const blob = await response.blob()
        this.assertCurrentOwner(owner)
        return blob
    }

    /**
     * Login via the API proxy
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        await authSession.waitForLogout()
        return this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            credentials: 'include',
            body: credentials as unknown as BodyInit
        }, true, true)
    }

    /**
     * Register via the API proxy
     */
    async register(data: RegisterData): Promise<RegisterResponse> {
        await authSession.waitForLogout()
        return this.request<RegisterResponse>('/auth/register', {
            method: 'POST',
            credentials: 'include',
            body: data as unknown as BodyInit
        }, true, true)
    }

    /**
     * Platform login via the API proxy. The BFF sets the HttpOnly refresh cookie.
     */
    async platformLogin(credentials: LoginCredentials): Promise<LoginResponse> {
        await authSession.waitForLogout()
        return this.request<LoginResponse>('/auth/platform/login', {
            method: 'POST',
            credentials: 'include',
            body: credentials as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Logout through the BFF so the HttpOnly refresh cookie is deleted.
     */
    async logout(): Promise<{ success?: boolean; message?: string }> {
        const token = this.getStoredToken()
        const refresh = refreshInFlight
        authSession.beginLogout()
        const operation = (async () => {
            try {
                if (refresh) await refresh.catch(() => undefined)
                return await this.request<{ success?: boolean; message?: string }>('/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }, true, true)
            } finally {
                authSession.finishLogout()
            }
        })()
        return authSession.retainLogout(operation)
    }

    /**
     * Mint an opaque Google provider-init token (step 1 of "Continue with Google").
     *
     * The BFF binds the strict project/group scope server-side and returns only the
     * opaque token. We then navigate the browser top-level to the BFF start-shim
     * (see {@link buildGoogleStartUrl}). `returnOrigin` must equal the origin used
     * here so the provider-init binding validates on redeem.
     */
    async createGoogleProviderInit(returnOrigin: string): Promise<{ provider_init_token: string; expires_in: number; provider?: string }> {
        return this.request<{ provider_init_token: string; expires_in: number; provider?: string }>('/auth/provider-init/google', {
            method: 'POST',
            credentials: 'include',
            body: { return_origin: returnOrigin, purpose: 'login' } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Build the top-level navigation URL to the BFF Google start-shim (step 2).
     *
     * api.auth's /auth/google/start is POST+JSON, so the browser cannot navigate to
     * it directly; the BFF shim accepts this GET and 303-redirects to Google. Use
     * with `window.location.assign(...)` — this is a full navigation, not a fetch.
     */
    buildGoogleStartUrl(providerInitToken: string, rememberMe: boolean, returnOrigin: string): string {
        const params = new URLSearchParams({
            pit: providerInitToken,
            return_origin: returnOrigin,
            remember_me: String(rememberMe),
        })
        return `${this.baseUrl}/auth/google/start/shim?${params.toString()}`
    }

    /**
     * Redeem the one-time delivery code from the Google return (final step).
     *
     * After the OAuth dance the BFF set the HttpOnly refresh cookie and redirected
     * the browser to the SPA with an opaque single-use code. This exchanges it for
     * the sanitized auth body (access token + user), the same shape as /auth/login.
     */
    async exchangeGoogleReturn(code: string): Promise<LoginResponse> {
        await authSession.waitForLogout()
        return this.request<LoginResponse>('/auth/google/exchange', {
            method: 'POST',
            credentials: 'include',
            body: { code } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Request a password-reset email by email or username. The BFF always
     * returns a generic accepted body (it never discloses whether the account
     * exists), so this resolves rather than throwing for an unknown identifier.
     */
    async requestPasswordReset(emailOrUsername: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/password/forgot', {
            method: 'POST',
            body: { email_or_username: emailOrUsername } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Consume a password-reset link token and set a new password. Unauthenticated
     * and cookie-free; a weak password surfaces as a 422 ApiError. On success the
     * provider revokes all sessions and mints none, so the user must sign in after.
     */
    async resetPassword(token: string, newPassword: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/password/reset', {
            method: 'POST',
            body: { token, new_password: newPassword } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Change the signed-in user's password. `isAuthEndpoint=true` skips the auto
     * refresh-and-retry on 401, so a wrong-current-password 401 (AUTH_1001)
     * surfaces as a form error instead of logging the user out. The provider
     * preserves the current session, so the user stays signed in on success.
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
        const token = this.getStoredToken()
        return this.request<ChangePasswordResponse>('/auth/password/change', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: { current_password: currentPassword, new_password: newPassword } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Consume an email-activation link token. Unauthenticated; generic accepted
     * body. On success the provider activates the address AND revokes the user's
     * sessions, so the caller must clear local auth and sign in again.
     */
    async verifyEmail(token: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/email/verify', {
            method: 'POST',
            body: { token } as unknown as BodyInit,
        }, true, true)
    }

    /** List the signed-in user's email addresses (masked). */
    async listEmails(): Promise<EmailListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailListResponse>('/user/me/emails', token, {
            method: 'GET',
        })
    }

    /** Add an email address and enqueue an activation link. */
    async addEmail(email: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>('/user/me/emails', token, {
            method: 'POST',
            body: { email } as unknown as BodyInit,
        })
    }

    /** Resend the activation link for a pending email address. */
    async resendEmailActivation(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}/resend`, token, { method: 'POST' },
        )
    }

    /** Remove one of the user's email addresses. */
    async removeEmail(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}`, token, { method: 'DELETE' },
        )
    }

    /** Mark an activated email as the user's primary address. */
    async setPrimaryEmail(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}/primary`, token, { method: 'POST' },
        )
    }

    /**
     * Get the stored token from localStorage
     */
    private getStoredToken(): string {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY)
        if (!token) {
            return ''
        }
        return token.replace(/"/g, '') // Remove quotes from token
    }

    private createClientId(prefix: string): string {
        return makeRequestId(prefix)
    }

    private aiHeaders(options: AiCardRequestOptions): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-Request-Id': options.requestId || this.createClientId('mw-ai-card-req'),
            'Idempotency-Key': options.idempotencyKey || this.createClientId('mw-ai-card-idem'),
        }
    }

    private assertAiCardSynchronousContract(value: unknown, requestId?: string): void {
        if (!verifyCardGeneration(value, requestId)) {
            throw new ApiError(502, 'Card generation returned an invalid execution result.', {
                category: 'upstream_contract', code: 'card_execution_contract', retryable: false,
            })
        }
    }

    private async generateCard<T>(endpoint: string, description: string, options: AiCardRequestOptions): Promise<AiCardGeneratedResult<T>> {
        const owner = authSession.getSnapshot()
        const requestOptions = { ...options, requestId: options.requestId || this.createClientId('mw-ai-card-req'),
            idempotencyKey: options.idempotencyKey || this.createClientId('mw-ai-card-idem') }
        return this.withLlmIntent('card_generation', requestOptions.requestId, options.llm, options.signal, async (llm) => {
            try {
                const body = { description: description.trim(), llm }
                if (options.onEvent && isTextStreamingFeatureEnabled()) {
                    return await this.streamGeneratedResult<AiCardGeneratedResult<T>>(`${endpoint}/stream`, body, 'card', requestOptions)
                }
                const result = await this.authenticatedRequest<AiCardGeneratedResult<T>>(`${endpoint}/`, this.getStoredToken(), {
                    method: 'POST', headers: this.aiHeaders(requestOptions), body: body as unknown as BodyInit,
                    ...this.aiRequestOptions(requestOptions),
                })
                this.assertAiCardSynchronousContract(result, requestOptions.requestId)
                return result
            } catch (error) {
                this.assertCurrentOwner(owner)
                if (error instanceof ApiError && error.category !== 'timeout'
                    && error.code !== 'card_execution_contract' && !options.signal?.aborted
                    && (error.status === 0 || error.status >= 500 || ['LLM_EXECUTION_RECOVERY_REQUIRED', 'LLM_EXECUTION_FINISHED'].includes(error.code || ''))) {
                    const retained = await this.authenticatedRequest<{ status: string; request_id: string; execution_id?: string; recovery_required: boolean }>(
                        `${endpoint}/result`, this.getStoredToken(), { method: 'GET', timeoutMs: 5000,
                            headers: { 'Idempotency-Key': requestOptions.idempotencyKey, 'X-Request-Id': requestOptions.requestId } },
                    ).catch(() => null)
                    this.assertCurrentOwner(owner)
                    if (retained && ['failed', 'cancelled'].includes(retained.status) && retained.recovery_required === true
                        && retained.request_id === requestOptions.requestId
                        && typeof retained.execution_id === 'string'
                        && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(retained.execution_id)
                        && Object.keys(retained).sort().join(',') === 'execution_id,recovery_required,request_id,status') {
                        error.llmRetry = { retry_of_execution_id: retained.execution_id,
                            selection: llm.selection ? { ...llm.selection } : { mode: 'inherit' },
                            ...(llm.expected_revision_id ? { expected_revision_id: llm.expected_revision_id } : {}) }
                    }
                }
                throw error
            }
        })
    }

    /**
     * One logical LLM request. A retry of the same request ID reuses the target
     * its first attempt froze and asks without a key, since a finished or
     * platform execution needs none. Only when the server asks for a key does
     * the user supply one, and only for that same profile revision.
     */
    private async withLlmIntent<T>(feature: LlmFeature, requestId: string, supplied: LlmRequest | undefined, signal: AbortSignal | undefined,
        send: (llm: LlmRequest) => Promise<T>, finished: (value: T) => boolean = () => true,
        settleError: (error: unknown) => boolean = isLlmRequestSpent): Promise<T> {
        const owner = authSession.getSnapshot()
        let llm = llmIntents.retained(feature, requestId) ?? await (supplied?.retry_of_execution_id
            ? prepareRetainedLlmRequest(feature, supplied, signal) : prepareLlmRequest(feature, supplied, signal))
        this.assertCurrentOwner(owner)
        llmIntents.retain(feature, requestId, llm)
        try {
            let value: T
            try {
                value = await send(llm)
            } catch (error) {
                if (!(error instanceof ApiError) || error.code !== 'BYOK_CREDENTIAL_REQUIRED' || llm.credentials || !llm.expected_revision_id) throw error
                const target = llm
                llm = await prepareRetainedLlmRequest(feature, target, signal, requestId)
                if (!llm.credentials || !llmIntents.matches(target, llm)) {
                    delete llm.credentials
                    throw new ApiError(409, 'The profile changed since this request started.', { code: 'LLM_EXECUTION_INTENT_CHANGED', requestId, retryable: false })
                }
                this.assertCurrentOwner(owner)
                value = await send(llm)
            }
            if (finished(value)) llmIntents.settle(feature, requestId)
            return value
        } catch (error) {
            if (settleError(error)) llmIntents.settle(feature, requestId)
            throw error
        } finally {
            delete llm.credentials
        }
    }

    private aiRequestOptions(options: AiCardRequestOptions): Pick<ApiRequestOptions, 'signal' | 'timeoutMs' | 'rejectAccepted'> {
        return {
            signal: options.signal,
            timeoutMs: options.timeoutMs,
            rejectAccepted: true,
        }
    }

    private assistantRequestOptions(options: AssistantRequestOptions): Pick<ApiRequestOptions, 'headers' | 'signal' | 'timeoutMs'> {
        return {
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Id': options.requestId || this.createClientId('mw-assistant-req'),
            },
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        }
    }

    /** All POST streams share auth ownership, pre-consumption refresh, and cleanup. */
    private async authenticatedStream<T extends { type: string }>(
        endpoint: string,
        body: unknown,
        onEvent: (event: T) => void,
        options: { signal?: AbortSignal; requestId?: string; timeoutMs?: number; idempotencyKey?: string } = {},
    ): Promise<void> {
        const token = this.getStoredToken()
        const owner = { ...authSession.getSnapshot(), token }
        const requestId = options.requestId || this.createClientId('mw-stream')
        const controller = new AbortController()
        const abort = () => controller.abort(options.signal?.reason)
        if (options.signal?.aborted) abort()
        else options.signal?.addEventListener('abort', abort, { once: true })
        const unsubscribe = authSession.subscribe(() => {
            if (!authSession.isCurrent(owner)) controller.abort(new DOMException('Authentication changed', 'AbortError'))
        })
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            controller.abort(new DOMException('Generation timed out', 'AbortError'))
        }, options.timeoutMs ?? 180_000)
        const config: RequestInit = {
            method: 'POST', signal: controller.signal,
            headers: {
                'Content-Type': 'application/json', Accept: 'text/event-stream',
                'X-Request-Id': requestId,
                ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        }
        try {
            controller.signal.throwIfAborted()
            let response = await fetch(`${this.baseUrl}${endpoint}`, config)
            this.assertCurrentOwner(owner)
            if (response.status === 401) {
                await response.body?.cancel()
                const rotated = this.getStoredToken()
                const nextToken = rotated && rotated !== token ? rotated : await this.waitForSignal(this.refreshAccessToken(token), controller.signal)
                this.assertCurrentOwner(owner)
                controller.signal.throwIfAborted()
                response = await fetch(`${this.baseUrl}${endpoint}`, this.withAuthorization(config, nextToken))
                this.assertCurrentOwner(owner)
                if (response.status === 401 && rotated && rotated !== token) {
                    await response.body?.cancel()
                    const refreshed = await this.waitForSignal(this.refreshAccessToken(rotated), controller.signal)
                    this.assertCurrentOwner(owner)
                    controller.signal.throwIfAborted()
                    response = await fetch(`${this.baseUrl}${endpoint}`, this.withAuthorization(config, refreshed))
                    this.assertCurrentOwner(owner)
                }
            }
            if (!response.ok) {
                const parsed = await this.extractError(response)
                throw new ApiError(response.status, parsed.message, parsed)
            }
            await readEventStream(response, (event: T) => {
                const identity = event as T & { request_id?: string }
                if (identity.request_id && identity.request_id !== requestId) throw new StreamContractError('The stream returned a result for a different request.')
                onEvent(event)
            }, { signal: controller.signal, assertOwner: () => this.assertCurrentOwner(owner) })
            this.assertCurrentOwner(owner)
        } catch (error) {
            if (timedOut || error instanceof StreamContractError) {
                throw new ApiError(0, timedOut ? 'The generation wait timed out.' : (error as Error).message, {
                    category: timedOut ? 'timeout' : 'stream',
                    code: error instanceof StreamContractError ? error.code : 'stream_timeout',
                    requestId, retryable: false, action: 'reload_conversation',
                })
            }
            throw error
        } finally {
            clearTimeout(timeout)
            unsubscribe()
            options.signal?.removeEventListener('abort', abort)
            controller.abort()
        }
    }

    /**
     * Lightweight API liveness check. This intentionally avoids auth recovery:
     * the sidebar needs to know whether the API process is reachable even before login.
     */
    async getHealth(options: { signal?: AbortSignal } = {}): Promise<ApiHealthResponse> {
        const response = await fetch(`${this.baseUrl}/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: options.signal,
        })
        if (!response.ok) {
            throw new ApiError(response.status, `Health check failed (${response.status})`)
        }
        return await response.json() as ApiHealthResponse
    }

    /**
     * Detailed health view used by the sidebar monitor. The backend aggregates
     * this API, its local engines, and upstream services owned by adjacent projects.
     */
    async getDependencyHealth(options: { signal?: AbortSignal } = {}): Promise<ApiDependencyHealthResponse> {
        const response = await fetch(`${this.baseUrl}/health/dependencies`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: options.signal,
        })
        if (!response.ok) {
            throw new ApiError(response.status, `Dependency health check failed (${response.status})`)
        }
        return await response.json() as ApiDependencyHealthResponse
    }

    /**
     * Fetch the current user's profile (`GET /user/me`): identity, role, usage
     * quota, and per-type counts of authored cards. Read-only on this API.
     */
    async getUserProfile(): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me', token, {
            method: 'GET',
        })
    }

    /**
     * Update the current user's public-facing display name (`PATCH /user/me`).
     * Pass `null` (or whitespace, which the backend normalises to null) to clear
     * it and fall back to the username. Returns the refreshed profile.
     */
    async updateDisplayName(displayName: string | null): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me', token, {
            method: 'PATCH',
            body: { display_name: displayName } as unknown as BodyInit,
        })
    }

    async getUserPreferences(): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserPreferences>('/user/preferences', token, {
            method: 'GET',
        })
    }

    async updateUserPreferences(body: UserPreferencesUpdate): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserPreferences>('/user/preferences', token, {
            method: 'PATCH',
            body: body as unknown as BodyInit,
        })
    }

    async listNotifications(params: {
        unreadOnly?: boolean
        category?: string
        limit?: number
        offset?: number
    } = {}): Promise<NotificationListResponse> {
        const token = this.getStoredToken()
        const query = new URLSearchParams({
            unread_only: String(params.unreadOnly ?? false),
            limit: String(params.limit ?? 50),
            offset: String(params.offset ?? 0),
        })
        if (params.category?.trim()) query.set('category', params.category.trim())
        return this.authenticatedRequest<NotificationListResponse>(`/notifications?${query.toString()}`, token, {
            method: 'GET',
        })
    }

    async getNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<NotificationUnreadCountResponse>('/notifications/unread-count', token, {
            method: 'GET',
        })
    }

    async markNotificationRead(notificationId: number): Promise<UserNotification> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserNotification>(`/notifications/${notificationId}/read`, token, {
            method: 'PATCH',
        })
    }

    async markAllNotificationsRead(): Promise<NotificationReadAllResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<NotificationReadAllResponse>('/notifications/read-all', token, {
            method: 'POST',
        })
    }

    async dismissNotification(notificationId: number): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/notifications/${notificationId}`, token, {
            method: 'DELETE',
        })
    }

    async listAdminVoices(voiceType: AdminVoiceQueryType = 'all'): Promise<AdminVoiceListResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceListResponse>(
            `/admin/voices?voice_type=${encodeURIComponent(voiceType)}`,
            token,
            { method: 'GET' },
        )
    }

    async designAdminVoice(body: AdminVoiceDesignRequest): Promise<AdminVoiceDesignResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceDesignResponse>('/admin/voices/design', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async deleteAdminVoice(
        voiceType: Exclude<AdminVoiceConcreteType, 'system'>,
        voiceId: string,
    ): Promise<AdminVoiceDeleteResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceDeleteResponse>(
            `/admin/voices/${encodeURIComponent(voiceType)}/${encodeURIComponent(voiceId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    async testAdminVoice(body: AdminVoiceTestRequest): Promise<AdminVoiceTestResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceTestResponse>('/admin/voices/test', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    // --- Billing / promotional credit grants -------------------------------

    /** Serialise admin grant list filters into a query string (omitting empties). */
    private creditGrantQuery(params: CreditGrantListParams = {}): string {
        const search = new URLSearchParams()
        if (params.status) search.set('status', params.status)
        if (params.search?.trim()) search.set('search', params.search.trim())
        if (params.sort) search.set('sort', params.sort)
        search.set('limit', String(params.limit ?? 100))
        search.set('offset', String(params.offset ?? 0))
        return search.toString()
    }

    /** Per-state counts (codes + email grants) for the console KPI tiles. Root only. */
    async getCreditGrantsSummary(): Promise<CreditGrantSummaryResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditGrantSummaryResponse>(
            '/admin/billing/credit-grants/summary',
            token,
            { method: 'GET' },
        )
    }

    /** Reset daily and/or monthly included-membership quota counters. Root only. */
    async resetMembershipQuotas(body: QuotaResetRequest): Promise<QuotaResetResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<QuotaResetResponse>('/admin/billing/quota-resets', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** List one-time credit code grants, filtered / sorted / paginated. Root only. */
    async listCreditCodeGrants(params: CreditGrantListParams = {}): Promise<CreditCodeGrantListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrantListResponse>(
            `/admin/billing/credit-codes?${this.creditGrantQuery(params)}`,
            token,
            { method: 'GET' },
        )
    }

    /** Create a one-time credit code. The response includes the raw `code` once. Root only. */
    async createCreditCodeGrant(body: CreditCodeGrantCreateRequest): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>('/admin/billing/credit-codes', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Update an unclaimed credit code (credits / label / status / expiry / reason). Root only. */
    async updateCreditCodeGrant(codeId: number, body: CreditCodeGrantUpdateRequest): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>(
            `/admin/billing/credit-codes/${encodeURIComponent(codeId)}`,
            token,
            { method: 'PATCH', body: body as unknown as BodyInit },
        )
    }

    /** Disable an unclaimed credit code. Root only. */
    async disableCreditCodeGrant(codeId: number): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>(
            `/admin/billing/credit-codes/${encodeURIComponent(codeId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    /** List email-address credit grants, filtered / sorted / paginated. Root only. */
    async listEmailCreditGrants(params: CreditGrantListParams = {}): Promise<EmailCreditGrantListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantListResponse>(
            `/admin/billing/email-credit-grants?${this.creditGrantQuery(params)}`,
            token,
            { method: 'GET' },
        )
    }

    /** Create email-address credit grants for a batch of addresses. Root only. */
    async createEmailCreditGrants(body: EmailCreditGrantCreateRequest): Promise<EmailCreditGrant[]> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant[]>('/admin/billing/email-credit-grants', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Update an unclaimed email-address credit grant. Root only. */
    async updateEmailCreditGrant(grantId: number, body: EmailCreditGrantUpdateRequest): Promise<EmailCreditGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant>(
            `/admin/billing/email-credit-grants/${encodeURIComponent(grantId)}`,
            token,
            { method: 'PATCH', body: body as unknown as BodyInit },
        )
    }

    /** Disable an unclaimed email-address credit grant. Root only. */
    async disableEmailCreditGrant(grantId: number): Promise<EmailCreditGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant>(
            `/admin/billing/email-credit-grants/${encodeURIComponent(grantId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    /** Redeem a credit code for the signed-in user. Any authed user. */
    async redeemCreditCode(code: string): Promise<CreditCodeRedeemResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeRedeemResponse>('/billing/credit-codes/redeem', token, {
            method: 'POST',
            body: { code } as unknown as BodyInit,
        })
    }

    /** List credit grants attached to the signed-in user's activated emails. */
    async listEmailCreditGrantOffers(): Promise<EmailCreditGrantOfferListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantOfferListResponse>('/billing/email-credit-grants', token, {
            method: 'GET',
        })
    }

    /** Claim credit grants attached to the signed-in user's activated emails. */
    async claimEmailCreditGrants(): Promise<EmailCreditGrantClaimResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantClaimResponse>('/billing/email-credit-grants/claim', token, {
            method: 'POST',
        })
    }

    // --- Membership plans & members (root console) --------------------------

    /** Every plan (default + custom) with limits and member counts. Root only. */
    async listMembershipPlans(): Promise<MembershipPlanListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipPlanListResponse>('/admin/billing/plans', token, { method: 'GET' })
    }

    async getMembershipPlan(planCode: string): Promise<MembershipPlan> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipPlan>(
            `/admin/billing/plans/${encodeURIComponent(planCode)}`,
            token,
            { method: 'GET' },
        )
    }

    /** Create a custom plan. The body must carry a limit row for every operation. */
    async createMembershipPlan(body: MembershipPlanCreateRequest): Promise<MembershipPlan> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipPlan>('/admin/billing/plans', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async updateMembershipPlan(planCode: string, body: MembershipPlanUpdateRequest): Promise<MembershipPlan> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipPlan>(
            `/admin/billing/plans/${encodeURIComponent(planCode)}`,
            token,
            { method: 'PATCH', body: body as unknown as BodyInit },
        )
    }

    /** Paginated accounts with plan, usage, and PAYG balances. Root only. */
    async listMembershipMembers(params: MembershipMemberListParams = {}): Promise<MembershipMemberListResponse> {
        const token = this.getStoredToken()
        const query = new URLSearchParams()
        if (params.plan_code) query.set('plan_code', params.plan_code)
        if (params.search) query.set('search', params.search)
        if (params.sort) query.set('sort', params.sort)
        if (params.limit != null) query.set('limit', String(params.limit))
        if (params.offset != null) query.set('offset', String(params.offset))
        const suffix = query.toString()
        return this.authenticatedRequest<MembershipMemberListResponse>(
            `/admin/billing/memberships${suffix ? `?${suffix}` : ''}`,
            token,
            { method: 'GET' },
        )
    }

    /** Move one account onto a plan (root override; custom plans survive billing reconcile). */
    async assignMembershipPlan(body: MembershipAssignRequest): Promise<MembershipAssignResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipAssignResponse>('/admin/billing/memberships/assign', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Aggregate membership KPIs: members per plan, usage today / this month, wallets. */
    async getMembershipOverview(): Promise<MembershipOverviewResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<MembershipOverviewResponse>('/admin/billing/membership-overview', token, {
            method: 'GET',
        })
    }

    // --- Subscriptions & PAYG checkout (api.auth-backed billing) -----------

    /** Static plan + credit-pack catalog with a live `enabled` flag. Any authed user. */
    async getBillingPlans(): Promise<BillingPlanCatalogResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingPlanCatalogResponse>('/billing/plans', token, {
            method: 'GET',
        })
    }

    /** Start a Stripe subscription Checkout. Redirect the browser to the returned `url`. */
    async createSubscriptionCheckout(planCode: string): Promise<BillingCheckoutSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingCheckoutSessionResponse>('/billing/subscription/checkout', token, {
            method: 'POST',
            body: { plan_code: planCode } as unknown as BodyInit,
        })
    }

    /** Start a Stripe one-time Checkout for a PAYG credit pack. Redirect to the returned `url`. */
    async createCreditCheckout(creditProductCode: string): Promise<BillingCheckoutSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingCheckoutSessionResponse>('/billing/credits/checkout', token, {
            method: 'POST',
            body: { credit_product_code: creditProductCode } as unknown as BodyInit,
        })
    }

    /** Create a restricted Stripe Portal session (cancel / payment method). Redirect to `url`. */
    async createBillingPortal(returnUrl?: string): Promise<BillingPortalSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingPortalSessionResponse>('/billing/portal', token, {
            method: 'POST',
            body: { return_url: returnUrl ?? null } as unknown as BodyInit,
        })
    }

    /**
     * Pull api.auth billing/Patreon facts and apply them to the local membership.
     * Idempotent — safe to call on checkout return and whenever the billing UI opens.
     */
    async reconcileBilling(): Promise<BillingReconcileResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingReconcileResponse>('/billing/reconcile', token, {
            method: 'POST',
        })
    }

    /** Start the Patreon email-loop proof for the signed-in user. */
    async requestPatreonLink(body: PatreonLinkRequest): Promise<PatreonProofRequestResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonProofRequestResponse>('/patreon/link/request', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Consume a Patreon proof token/parts for the signed-in user. */
    async confirmPatreonLink(body: PatreonProofConfirmRequest): Promise<PatreonLinkStatusResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/confirm', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Read the signed-in user's safe Patreon link and entitlement projection. */
    async getPatreonLinkStatus(): Promise<PatreonLinkStatusResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/status', token, {
            method: 'GET',
        })
    }

    /** Soft-unlink Patreon entitlement state for the signed-in user. */
    async unlinkPatreon(body?: PatreonUnlinkRequest): Promise<PatreonUnlinkResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonUnlinkResponse>('/patreon/link', token, {
            method: 'DELETE',
            body: body ? body as unknown as BodyInit : undefined,
        })
    }

    // --- Voice presets (user-facing) ---------------------------------------

    async listVoicePresets(q?: string): Promise<VoicePreset[]> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
        return this.authenticatedRequest<VoicePreset[]>(`/voice-presets${query}`, token, { method: 'GET' })
    }

    async createVoicePreset(body: VoicePresetCreatePayload): Promise<VoicePreset> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>('/voice-presets', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async updateVoicePreset(presetId: string, body: VoicePresetUpdatePayload): Promise<VoicePreset> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>(`/voice-presets/${encodeURIComponent(presetId)}`, token, {
            method: 'PUT',
            body: body as unknown as BodyInit,
        })
    }

    async deleteVoicePreset(presetId: string): Promise<void> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/voice-presets/${encodeURIComponent(presetId)}`, token, { method: 'DELETE' })
    }

    /** Authenticated (non-root) catalog of MiniMax system voices for the studio + picker. */
    async listSystemVoices(): Promise<AdminVoiceListResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceListResponse>('/voice-presets/system-voices', token, { method: 'GET' })
    }

    /** Ephemeral, non-root preview synthesis of a system voice + recipe (hex audio). */
    async previewVoice(body: VoicePresetPreviewRequest): Promise<AdminVoiceTestResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceTestResponse>('/voice-presets/preview', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    // --- Agent Studio (root-only) ------------------------------------------

    async listAgents(): Promise<AgentSummary[]> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentSummary[]>('/admin/agents', token, { method: 'GET' }).then((result) => this.workflowResult(result, verifyAgentList))
    }

    async getAgent(workflowKey: string): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}`, token, {
            method: 'GET',
        }).then((result) => this.workflowResult(result, verifyAgentDetail))
    }

    async createAgent(body: AgentCreateRequest): Promise<CustomAgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CustomAgentDetail>('/admin/agents', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        }).then((result) => this.workflowResult(result, verifyCustomAgentDetail))
    }

    async updateAgentDraft(workflowKey: string, body: AgentUpdateDraftRequest, rowVersion: number): Promise<CustomAgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CustomAgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}/draft`, token, {
            method: 'PUT',
            headers: { 'If-Match': `"${rowVersion}"` },
            body: body as unknown as BodyInit,
        }).then((result) => this.workflowResult(result, verifyCustomAgentDetail))
    }

    async publishAgent(workflowKey: string, rowVersion: number): Promise<CustomAgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CustomAgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}/publish`, token, {
            method: 'POST',
            headers: { 'If-Match': `"${rowVersion}"` },
        }).then((result) => this.workflowResult(result, verifyCustomAgentDetail))
    }

    async listAgentVersions(workflowKey: string): Promise<AgentVersionsResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentVersionsResponse>(
            `/admin/agents/${encodeURIComponent(workflowKey)}/versions`,
            token,
            { method: 'GET' },
        ).then((result) => this.workflowResult(result, verifyAgentVersions))
    }

    async rollbackAgentVersion(workflowKey: string, versionId: string, rowVersion: number): Promise<CustomAgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CustomAgentDetail>(
            `/admin/agents/${encodeURIComponent(workflowKey)}/rollback/${encodeURIComponent(versionId)}`,
            token,
            { method: 'POST', headers: { 'If-Match': `"${rowVersion}"` } },
        ).then((result) => this.workflowResult(result, verifyCustomAgentDetail))
    }

    async deleteAgent(workflowKey: string, rowVersion: number): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/admin/agents/${encodeURIComponent(workflowKey)}`, token, {
            method: 'DELETE',
            headers: { 'If-Match': `"${rowVersion}"` },
        })
    }

    /** Root test run; sending the same request ID again resumes it with the target it first froze. */
    async testAgent(workflowKey: string, body: Omit<AgentTestRequest, 'llm'> & { llm?: LlmRequest }, requestId: string,
        feature: LlmFeature = 'card_generation'): Promise<AgentTestResponse> {
        const owner = authSession.getSnapshot()
        return this.withLlmIntent(feature, requestId, body.llm, undefined, async (llm) => {
            try {
                const result = await this.authenticatedRequest<AgentTestResponse>(`/admin/agents/${encodeURIComponent(workflowKey)}/test`, this.getStoredToken(), {
                    method: 'POST', cache: 'no-store', headers: { 'X-Request-Id': requestId }, body: { ...body, llm } as unknown as BodyInit,
                })
                return this.workflowResult(result, verifyAgentTest)
            } catch (error) {
                await this.confirmTerminalLlmAttempt(error, feature, requestId, llm, owner)
                throw error
            }
        }, undefined, () => false)
    }

    private workflowResult<T>(value: unknown, verify: (value: unknown) => value is T): T {
        if (!verify(value)) throw new ApiError(502, 'The workflow service returned an invalid response.', {
            code: 'workflow_execution_contract', category: 'upstream_contract', retryable: false,
        })
        return value
    }

    /** Step 1 of cloning: upload an audio sample (multipart). The browser sets the boundary. */
    async uploadAdminVoiceCloneSample(
        file: File,
        purpose: AdminVoiceClonePurpose = 'voice_clone',
        options: { signal?: AbortSignal } = {},
    ): Promise<AdminVoiceCloneUploadResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('file', file)
        form.append('purpose', purpose)
        return this.authenticatedRequest<AdminVoiceCloneUploadResponse>('/admin/voices/clone-file', token, {
            method: 'POST',
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /** Step 2 of cloning: create the custom voice from an uploaded sample reference. */
    async cloneAdminVoice(body: AdminVoiceCloneRequest): Promise<AdminVoiceCloneResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceCloneResponse>('/admin/voices/clone', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /**
     * Create a new character
     */
    async createCharacter(characterData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/characters/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: characterData
        })
    }

    /**
     * Generate + persist a new character from a description via the AI endpoint.
     * The backend creates the card and returns it.
     */
    async createCharacterAI(description: string, options: AiCardRequestOptions = {}): Promise<AiCardGeneratedResult<CharacterCardResponse>> {
        return this.generateCard<CharacterCardResponse>('/characters/ai', description, options)
    }

    /** Select one owned persona as the account default. */
    async setDefaultPersona(characterId: string): Promise<CharacterCardResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CharacterCardResponse>(`/characters/${encodeURIComponent(characterId)}/default-persona`, token, {
            method: 'PUT',
        })
    }

    async exportCardImage(cardType: CardExportType, cardId: string): Promise<Blob> {
        return this.authenticatedBlob(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/export.png`,
            'Card image could not be exported.',
            'image/png',
        )
    }

    async createCardShareLink(cardType: CardShareType, cardId: string): Promise<CardShareLinkResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardShareLinkResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/share`,
            token,
            { method: 'POST' },
        )
    }

    async getSharedCard(shareToken: string): Promise<SharedCardResource> {
        this.assertCommunityCardsEnabled()
        return this.request<SharedCardResource>(`/cards/shared/${encodeURIComponent(shareToken)}`, {
            method: 'GET',
        })
    }

    async importSharedCard(shareToken: string, opts?: { force?: boolean }): Promise<CardCloneResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        const query = opts?.force ? '?force=true' : ''
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/shared/${encodeURIComponent(shareToken)}/import${query}`,
            token,
            { method: 'POST' },
        )
    }

    async revokeSharedCardLink(shareToken: string): Promise<void> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/cards/shared/${encodeURIComponent(shareToken)}`, token, {
            method: 'DELETE',
        })
    }

    async publishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'POST' },
        )
    }

    async unpublishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'DELETE' },
        )
    }

    async cloneCard(cardType: CardShareType, cardId: string, opts?: { force?: boolean }): Promise<CardCloneResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        const query = opts?.force ? '?force=true' : ''
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/clone${query}`,
            token,
            { method: 'POST' },
        )
    }

    async duplicateCard(cardType: CardShareType, cardId: string): Promise<CardCloneResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/duplicate`,
            token,
            { method: 'POST' },
        )
    }

    // --- Explicit card versioning + usage (character / world / item only) --------------

    /** Route prefix for the versionable card type (characters/worlds/items). */
    private versionBasePath(cardType: VersionableCardType): string {
        if (cardType === 'world') return '/worlds'
        if (cardType === 'item') return '/items'
        return '/characters'
    }

    /** List a card's saved versions (newest first) plus its current latest pointer. */
    async listCardVersions(cardType: VersionableCardType, cardId: string): Promise<CardVersionList> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardVersionList>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions`,
            token,
            { method: 'GET' },
        )
    }

    /** Snapshot the card's current content as a new immutable version ("Save version"). */
    async saveCardVersion(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardVersion> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardVersion>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions`,
            token,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { label: label?.trim() || null } as unknown as BodyInit,
            },
        )
    }

    /** Restore an earlier version into the live card (in place). Returns the updated card. */
    async restoreCardVersion(cardType: VersionableCardType, cardId: string, versionNumber: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}/restore`,
            token,
            { method: 'POST' },
        )
    }

    /** Derived usage for a card: distinct sessions (adventures + chats) and stories. */
    async getCardUsage(cardType: VersionableCardType, cardId: string): Promise<CardUsage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardUsage>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/usage`,
            token,
            { method: 'GET' },
        )
    }

    // --- Draft buffer + publish (character / world / item only) -------------------------
    // Editing writes to a PRIVATE draft; Publish promotes it to the live card + a new version.
    // Sessions/clones/public viewers always see the published body, never the draft.

    /** Fetch the editable body: the private draft if present, else the published body. */
    async getCardDraft(cardType: VersionableCardType, cardId: string): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'GET' },
        )
    }

    /** Write the editor's payload into the private draft (does not touch the live card). */
    async saveCardDraft(cardType: VersionableCardType, cardId: string, body: unknown): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: body as unknown as BodyInit,
            },
        )
    }

    /** Discard the draft, reverting to the published version. Idempotent. */
    async discardCardDraft(
        cardType: VersionableCardType,
        cardId: string,
    ): Promise<{ card_id: string; discarded: boolean; has_draft: boolean }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'DELETE' },
        )
    }

    /** Promote the draft → live and cut a new version (v{n+1}). 409 when there's nothing to publish. */
    async publishCardDraft(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardPublishResult> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardPublishResult>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/publish`,
            token,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { label: label?.trim() || null } as unknown as BodyInit,
            },
        )
    }

    /** Load an earlier version into the draft for review (the live card is unchanged until publish). */
    async restoreVersionIntoDraft(
        cardType: VersionableCardType,
        cardId: string,
        versionNumber: number,
    ): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}/restore`,
            token,
            { method: 'POST' },
        )
    }

    /**
     * Read-only load of a single historical version's body for display in the editor — does NOT
     * touch the private draft (unlike {@link restoreVersionIntoDraft}). Flagged `is_historical`.
     */
    async getCardVersion(
        cardType: VersionableCardType,
        cardId: string,
        versionNumber: number,
    ): Promise<CardHistoricalDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardHistoricalDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}`,
            token,
            { method: 'GET' },
        )
    }

    /** Fetch the latest PUBLISHED body for a versionable card (ignores any private draft). */
    async getPublishedBody(cardType: VersionableCardType, cardId: string): Promise<CardDraftDocument> {
        if (cardType === 'world') return (await this.getWorld(cardId)) as CardDraftDocument
        if (cardType === 'item') return (await this.getItem(cardId)) as CardDraftDocument
        return (await this.getCharacter(cardId)) as CardDraftDocument
    }

    /**
     * Patch published-body media (image_url / theme_song_url) directly — media is a
     * published-level property persisted immediately, so a generated portrait/theme shows
     * without a publish and is never staged as unpublished authored content.
     */
    async setCardMedia(
        cardType: VersionableCardType,
        cardId: string,
        media: { image_url?: string | null; theme_song_url?: string | null },
    ): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/media`,
            token,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: media as unknown as BodyInit,
            },
        )
    }

    /**
     * Create a new world
     */
    async createWorld(worldData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/worlds/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: worldData
        })
    }

    /**
     * Generate + persist a new world from a description via the AI endpoint.
     * The backend creates the card and returns it.
     */
    async createWorldAI(description: string, options: AiCardRequestOptions = {}): Promise<AiCardGeneratedResult<WorldCardResponse>> {
        return this.generateCard<WorldCardResponse>('/worlds/ai', description, options)
    }

    /**
     * Create a new item/object
     */
    async createItem(itemData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/items/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: itemData
        })
    }

    /**
     * Generate + persist a new item/object from a description via the AI endpoint.
     */
    async createItemAI(description: string, options: AiCardRequestOptions = {}): Promise<AiCardGeneratedResult<ItemCardResponse>> {
        return this.generateCard<ItemCardResponse>('/items/ai', description, options)
    }

    /** Build the shared list query string; `q` searches name/alias/triggers server-side. */
    private listQuery(skip: number, limit: number, q?: string): string {
        const term = q?.trim()
        return `?skip=${skip}&limit=${limit}${term ? `&q=${encodeURIComponent(term)}` : ''}`
    }

    private sharedCardListQuery(
        skip: number,
        limit: number,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): string {
        const params = new URLSearchParams()
        params.set('skip', String(skip))
        params.set('limit', String(limit))
        if (q?.trim()) params.set('q', q.trim())
        if (cardType) params.set('card_type', cardType)
        if (role) params.set('role', role)
        return `?${params.toString()}`
    }

    async listPublicCards(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/public${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    async getPublicCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/public/${cardType}/${encodeURIComponent(cardId)}`,
            token,
            { method: 'GET' },
        )
    }

    async listMyPublicCards(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/me/public${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    async listMyShareLinks(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/me/share-links${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    /**
     * Get characters list with pagination and optional search
     */
    async getCharacters(skip: number = 0, limit: number = 100, q?: string, role?: 'character' | 'persona'): Promise<any> {
        const token = this.getStoredToken()
        const query = this.listQuery(skip, limit, q)
        const roleQuery = role ? `${query}&role=${encodeURIComponent(role)}` : query
        return this.authenticatedRequest(`/characters/${roleQuery}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get worlds list with pagination and optional search
     */
    async getWorlds(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get items list with pagination and optional search
     */
    async getItems(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get adventure templates list with pagination and optional search
     */
    async getAdventureTemplates(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * List lorebooks with pagination and optional search.
     */
    async getLorebooks(skip: number = 0, limit: number = 100, q?: string): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getLorebook(lorebookId: string): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'GET',
        })
    }

    async createLorebook(lorebook: LorebookDraft | Record<string, unknown>): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest('/lorebooks', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookDraft(lorebook as LorebookDraft & Record<string, unknown>) as unknown as BodyInit,
        })
    }

    async updateLorebook(lorebookId: string, lorebook: Partial<LorebookDraft> | Record<string, unknown>): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookDraft(lorebook as LorebookDraft & Record<string, unknown>) as unknown as BodyInit,
        })
    }

    async deleteLorebook(lorebookId: string): Promise<void> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'DELETE',
        })
    }

    async getLorebookResources(skip: number = 0, limit: number = 100, q?: string): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getLorebookResource(resourceId: string): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'GET',
        })
    }

    async createLorebookResource(resource: LorebookResource | Record<string, unknown>): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest('/lorebook-resources', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookResource(resource as Partial<LorebookResource> & Record<string, unknown>, { includeIdentity: true }) as unknown as BodyInit,
        })
    }

    async updateLorebookResource(resourceId: string, resource: Partial<LorebookResource> | Record<string, unknown>): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookResource(resource as Partial<LorebookResource> & Record<string, unknown>, { includeIdentity: false }) as unknown as BodyInit,
        })
    }

    async extractLorebookResource(resourceId: string, command: LorebookExtractionCommand, options: LorebookExtractionOptions, lorebookId: string | null = null): Promise<LorebookExtractionResult> {
        this.assertLorebookResourcesEnabled()
        if (!/^[A-Za-z0-9._:-]{1,64}$/.test(options.requestId) || !/^[a-f0-9]{64}$/.test(command.expected_evaluation_hash)) {
            throw new ApiError(422, 'Invalid extraction identity.', { code: 'lorebook_extraction_identity' })
        }
        return this.withLlmIntent('lorebook_extraction', options.requestId, command.llm, options.signal, async (llm) => {
            const prepared = { ...command, llm }
            const owner = authSession.getSnapshot()
            this.assertCurrentOwner(owner)
            options.signal?.throwIfAborted()
            const path = lorebookId === null
                ? `/lorebook-resources/${encodeURIComponent(resourceId)}/metadata-sync`
                : `/lorebooks/${encodeURIComponent(lorebookId)}/resource-extractions/${encodeURIComponent(resourceId)}`
            const safeResult = (result: unknown): result is LorebookExtractionResult =>
                verifyLorebookExtraction(result, resourceId, command.expected_evaluation_hash, lorebookId)
                && matchesLorebookExtractionProfile(result, prepared.llm)
                && (!prepared.llm.credentials || result.llm_execution.credential_mode === 'user_byok'
                    && !extractionContainsCredential(result, prepared.llm.credentials.api_key))
            try {
                const result = await this.authenticatedRequest<unknown>(path, this.getStoredToken(), {
                    method: 'POST', body: prepared as unknown as BodyInit,
                    headers: { 'Content-Type': 'application/json', 'X-Request-Id': options.requestId },
                    signal: options.signal, timeoutMs: options.timeoutMs,
                })
                this.assertCurrentOwner(owner)
                options.signal?.throwIfAborted()
                if (!safeResult(result)) {
                    throw new ApiError(502, 'Invalid extraction result.', { code: 'lorebook_extraction_contract' })
                }
                return result
            } catch (error) {
                this.assertCurrentOwner(owner)
                options.signal?.throwIfAborted()
                if (error instanceof ApiError && error.status > 0 && error.status < 500) throw error
                // A lost response can follow a committed result. Read this request only.
                let status: LorebookExtractionStatus
                try {
                    status = await this.getLorebookResourceExtraction(resourceId, command.expected_evaluation_hash, options, lorebookId)
                } catch {
                    this.assertCurrentOwner(owner)
                    options.signal?.throwIfAborted()
                    throw new ApiError(0, 'Extraction outcome is unknown. Check this request before starting another.', {
                        code: 'lorebook_extraction_unknown', requestId: options.requestId, retryable: false,
                    })
                }
                this.assertCurrentOwner(owner)
                if (status.status === 'completed') {
                    if (!safeResult(status.result)) throw new ApiError(502, 'Invalid extraction result.', { code: 'lorebook_extraction_contract' })
                    return status.result
                }
                throw new ApiError(409, 'Extraction has not completed. Check the existing request.', {
                    code: `lorebook_extraction_${status.status}`, requestId: options.requestId, retryable: false,
                })
            }
        })
    }

    async getLorebookResourceExtraction(resourceId: string, expectedHash: string, options: LorebookExtractionOptions, lorebookId: string | null = null): Promise<LorebookExtractionStatus> {
        this.assertLorebookResourcesEnabled()
        const owner = authSession.getSnapshot()
        options.signal?.throwIfAborted()
        const path = lorebookId === null
            ? `/lorebook-resources/${encodeURIComponent(resourceId)}/metadata-extractions/${encodeURIComponent(options.requestId)}`
            : `/lorebooks/${encodeURIComponent(lorebookId)}/resource-extractions/${encodeURIComponent(resourceId)}/${encodeURIComponent(options.requestId)}`
        const result = await this.authenticatedRequest<unknown>(path, this.getStoredToken(), {
            method: 'GET', signal: options.signal, timeoutMs: options.timeoutMs,
        })
        this.assertCurrentOwner(owner)
        options.signal?.throwIfAborted()
        if (!verifyLorebookExtractionStatus(result, resourceId, expectedHash, options.requestId, lorebookId)) {
            throw new ApiError(502, 'Invalid extraction status.', { code: 'lorebook_extraction_contract' })
        }
        return result
    }

    async deleteLorebookResource(resourceId: string): Promise<void> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'DELETE',
        })
    }

    async getLorebookLinkedResources(lorebookId: string): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources`, token, {
            method: 'GET',
        })
    }

    async attachLorebookResource(lorebookId: string, resourceId: string): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'PUT',
        })
    }

    async detachLorebookResource(lorebookId: string, resourceId: string): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'DELETE',
        })
    }

    async createLorebookEntry(lorebookId: string, entry: LorebookEntryDraft | Record<string, unknown>): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookEntry(entry as Partial<LorebookEntry> & Record<string, unknown>, { includeIdentity: false }) as unknown as BodyInit,
        })
    }

    async updateLorebookEntry(lorebookId: string, entryId: string, entry: Partial<LorebookEntry> | Record<string, unknown>): Promise<unknown> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries/${encodeURIComponent(entryId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookEntry(entry as Partial<LorebookEntry> & Record<string, unknown>, { includeIdentity: false }) as unknown as BodyInit,
        })
    }

    async deleteLorebookEntry(lorebookId: string, entryId: string): Promise<void> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries/${encodeURIComponent(entryId)}`, token, {
            method: 'DELETE',
        })
    }

    async listLorebookAttachments(targetKind?: LorebookTargetKind, targetId?: string): Promise<LorebookAttachment[]> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        const params = new URLSearchParams()
        if (targetKind) params.set('targetKind', targetKind)
        if (targetId) params.set('targetId', targetId)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        return this.authenticatedRequest<LorebookAttachment[]>(`/lorebook-attachments${suffix}`, token, {
            method: 'GET',
        })
    }

    async putLorebookAttachment(attachment: Partial<LorebookAttachment> | Record<string, unknown>): Promise<LorebookAttachment> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<LorebookAttachment>('/lorebook-attachments', token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookAttachment(attachment as Partial<LorebookAttachment> & Record<string, unknown>) as unknown as BodyInit,
        })
    }

    async deleteLorebookAttachment(attachmentId: string): Promise<void> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebook-attachments/${encodeURIComponent(attachmentId)}`, token, {
            method: 'DELETE',
        })
    }

    async validateLorebook(lorebook: Lorebook | LorebookDraft | Record<string, unknown>): Promise<{ issues: LorebookIssue[] }> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<{ issues: LorebookIssue[] }>('/lorebooks/validate', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializeLorebookDraft(lorebook as Lorebook & Record<string, unknown>, { includeIdentity: true }) as unknown as BodyInit,
        })
    }

    async previewLoreActivation(request: LoreActivationPreviewRequest): Promise<LoreActivationPreviewResponse> {
        this.assertLorebooksEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<LoreActivationPreviewResponse>('/lorebooks/activation-preview', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializeActivationPreview(request) as unknown as BodyInit,
        })
    }

    async getStories(skip: number = 0, limit: number = 100, q?: string): Promise<Story[]> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story[]>(`/stories${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getStory(storyId: string): Promise<Story> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'GET',
        })
    }

    async createStory(story: StoryCreateRequest | Record<string, unknown>): Promise<Story> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>('/stories', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: story as unknown as BodyInit,
        })
    }

    async updateStory(storyId: string, story: Partial<Story> | Record<string, unknown>): Promise<Story> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: story as unknown as BodyInit,
        })
    }

    async deleteStory(storyId: string): Promise<void> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'DELETE',
        })
    }

    async createStoryChapter(storyId: string, chapter: Partial<StoryChapter> | Record<string, unknown>): Promise<StoryChapter> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryChapter>(`/stories/${encodeURIComponent(storyId)}/chapters`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: chapter as unknown as BodyInit,
        })
    }

    async updateStoryChapter(storyId: string, chapterId: string, chapter: Partial<StoryChapter> | Record<string, unknown>): Promise<StoryChapter> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryChapter>(`/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: chapter as unknown as BodyInit,
        })
    }

    async deleteStoryChapter(storyId: string, chapterId: string): Promise<void> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`, token, {
            method: 'DELETE',
        })
    }

    async addStoryCardRef(storyId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryCardRef>(`/stories/${encodeURIComponent(storyId)}/card-refs`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: ref as unknown as BodyInit,
        })
    }

    async updateStoryCardRef(storyId: string, refId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryCardRef>(`/stories/${encodeURIComponent(storyId)}/card-refs/${encodeURIComponent(refId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: ref as unknown as BodyInit,
        })
    }

    async deleteStoryCardRef(storyId: string, refId: string): Promise<void> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/card-refs/${encodeURIComponent(refId)}`, token, {
            method: 'DELETE',
        })
    }

    async previewStoryContext(storyId: string, request: StoryGenerateRequest): Promise<StoryContextTrace> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryContextTrace>(`/stories/${encodeURIComponent(storyId)}/context-preview`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                chapterId: request.chapterId, command: request.command, selection: request.selection,
                instruction: request.instruction, contextSettings: request.contextSettings,
            } as unknown as BodyInit,
        })
    }

    async generateStory(storyId: string, request: StoryGenerateRequest, options: TextGenerationOptions = {}): Promise<StoryGenerateResponse> {
        this.assertNovelsEnabled()
        const requestId = options.requestId || this.createClientId('mw-story-generate')
        return this.withLlmIntent('novel', requestId, request.llm, options.signal, async (llm) => {
            const payload = { ...request, llm }
            const owner = authSession.getSnapshot()
            if (!isTextStreamingFeatureEnabled()) {
                const result = await this.authenticatedRequest<StoryGenerateResponse>(`/stories/${encodeURIComponent(storyId)}/generate`, this.getStoredToken(), {
                    method: 'POST', body: payload as unknown as BodyInit,
                    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId }, signal: options.signal, timeoutMs: options.timeoutMs,
                })
                this.assertStoryExecutionResult(result, request.chapterId, requestId)
                return result
            }
            try {
                const result = await this.streamGeneratedResult<StoryGenerateResponse>(`/stories/${encodeURIComponent(storyId)}/generate/stream`, payload, null, { ...options, requestId })
                this.assertStoryExecutionResult(result, request.chapterId, requestId)
                return result
            } catch (error) {
                this.assertCurrentOwner(owner)
                if (options.signal?.aborted) throw error
                // Reconcile only the exact saved candidate; never start a second generation.
                if (!(error instanceof ApiError) || error.status === 0) {
                    const saved = await this.authenticatedRequest<StoryGenerateResponse>(
                        `/stories/${encodeURIComponent(storyId)}/generation-requests/${encodeURIComponent(requestId)}`,
                        this.getStoredToken(), { method: 'GET', signal: options.signal },
                    ).catch(() => null)
                    this.assertCurrentOwner(owner)
                    options.signal?.throwIfAborted()
                    if (saved) {
                        this.assertStoryExecutionResult(saved, request.chapterId, requestId)
                        return saved
                    }
                    console.warn('text_stream_recovery_failed', { requestId, surface: 'story' })
                }
                throw error
            }
        })
    }

    private assertStoryExecutionResult(result: StoryGenerateResponse, chapterId: string, requestId: string): void {
        const plan = result?.llm_execution
        const generation = result?.generation
        const keys = ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed']
        if (!plan || typeof plan !== 'object' || Array.isArray(plan)
            || Object.keys(plan).some((key) => !keys.includes(key))
            || ![plan.execution_id, plan.profile_id, plan.revision_id].every((value) => typeof value === 'string' && value.length > 0)
            || !['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(plan.resolution_source)
            || !['platform', 'user_byok'].includes(plan.credential_mode) || typeof plan.replayed !== 'boolean'
            || generation?.id !== plan.execution_id || generation.requestId !== requestId
            || generation.chapterId !== chapterId || result.chapter?.id !== chapterId
            || typeof generation.output !== 'string' || !generation.output.trim()) {
            throw new ApiError(502, 'Story generation returned an invalid execution result.', {
                code: 'story_execution_contract', category: 'upstream_contract', retryable: false,
            })
        }
    }

    private async streamGeneratedResult<T>(endpoint: string, body: unknown, resultKey: 'card' | null, options: TextGenerationOptions & { idempotencyKey?: string }): Promise<T> {
        const owner = authSession.getSnapshot()
        options = { ...options, requestId: options.requestId || this.createClientId('mw-generation'),
            ...(resultKey ? { idempotencyKey: options.idempotencyKey || this.createClientId('mw-generation-idem') } : {}) }
        let result: T | undefined
        let failure: ApiError | undefined
        try {
            await this.authenticatedStream(endpoint, body, (event: SseEvent) => {
                if (event.type === 'final') {
                    const candidate = resultKey ? event[resultKey] : event.generation
                    if (!candidate || typeof candidate !== 'object' || typeof (candidate as { id?: unknown }).id !== 'string') {
                        throw new StreamContractError('The stream returned an invalid saved result.')
                    }
                    if (resultKey) this.assertAiCardSynchronousContract(candidate, options.requestId)
                    result = (resultKey ? candidate : event) as T
                }
                else if (event.type === 'error') {
                    const detail = (event.error || (event.detail && typeof event.detail === 'object' ? event.detail : undefined)) as Record<string, unknown> | undefined
                    failure = new ApiError(typeof event.status_code === 'number' ? event.status_code : 502, typeof event.detail === 'string' ? event.detail : String(detail?.message || 'Generation failed.'), {
                        category: typeof detail?.category === 'string' ? detail.category : 'generation',
                        code: typeof detail?.code === 'string' ? detail.code : undefined,
                        requestId: options.requestId,
                        retryable: detail?.retryable !== false,
                    })
                } else if (event.type === 'delta' || event.type === 'progress' || event.type === 'preview') {
                    const valid = event.type === 'delta' ? typeof event.delta === 'string'
                        : event.type === 'progress' ? ['generating', 'validating', 'saving'].includes(String(event.stage))
                        : typeof event.text === 'string' && Array.isArray(event.path) && event.path.length > 0 && event.path.length < 32
                            && event.path.every((part) => typeof part === 'string' || (Number.isInteger(part) && Number(part) >= 0))
                    if (!valid) throw new StreamContractError('The stream returned an invalid preview event.')
                    options.onEvent?.(event as unknown as TextGenerationEvent)
                }
            }, options)
        } catch (error) {
            this.assertCurrentOwner(owner)
            const stopped = options.signal?.aborted && options.signal.reason?.message === 'Stopped by user'
            if (resultKey && options.idempotencyKey && (!options.signal?.aborted || stopped)) {
                const deadline = Date.now() + 11_000
                for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt++) {
                    this.assertCurrentOwner(owner)
                    const recovered = await this.authenticatedRequest<{ status: string; card?: T; request_id: string; recovery_required?: boolean }>(
                        endpoint.replace(/\/stream$/, '/result'), this.getStoredToken(), {
                            method: 'GET', headers: { 'Idempotency-Key': options.idempotencyKey, 'X-Request-Id': options.requestId! }, timeoutMs: 5000,
                        }).catch(() => null)
                    this.assertCurrentOwner(owner)
                    if (options.signal?.aborted && !stopped) throw error
                    if (recovered?.status === 'completed' && recovered.card && recovered.request_id === options.requestId) {
                        this.assertAiCardSynchronousContract(recovered.card, options.requestId)
                        return recovered.card
                    }
                    if (!recovered || recovered.recovery_required || !['admitted', 'running'].includes(recovered.status)) break
                    await new Promise((resolve) => setTimeout(resolve, Math.min(250 * (attempt + 1), 1000)))
                }
                if (!stopped) console.warn('text_stream_recovery_failed', { requestId: options.requestId, surface: 'card' })
            }
            throw error
        }
        if (failure) throw failure
        if (!result) throw new ApiError(502, 'The stream ended without a saved result.', { code: 'stream_incomplete', requestId: options.requestId })
        return result
    }

    async acceptStoryGeneration(storyId: string, generationId: string): Promise<Story> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/accept`, token, {
            method: 'POST',
        })
    }

    async stashStoryGeneration(storyId: string, generationId: string): Promise<unknown> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/stash`, token, {
            method: 'POST',
        })
    }

    async discardStoryGeneration(storyId: string, generationId: string): Promise<unknown> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/discard`, token, {
            method: 'POST',
        })
    }

    /**
     * Get adventure sessions list
     */
    async getAdventureSessions(): Promise<any> {
        const token = this.getStoredToken()
        try {
            return await this.authenticatedRequest('/adventure-sessions/', token, {
                method: 'GET'
            })
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                // Return empty array if user has no sessions or user not found yet
                return []
            }
            throw error
        }
    }

    /**
     * Create a new adventure template
     */
    async createAdventureTemplate(templateData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-templates/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: templateData
        })
    }

    /**
     * Generate + persist a new adventure template from a description via the AI
     * endpoint. The backend creates the card and returns it.
     */
    async createAdventureTemplateAI(description: string, options: AiCardRequestOptions = {}): Promise<AiCardGeneratedResult<AdventureTemplateCardResponse>> {
        return this.generateCard<AdventureTemplateCardResponse>('/adventure-templates/ai', description, options)
    }

    // --- Assistants (/assistant/conversations) ---------------------------------
    // One conversation, turn, and reconcile protocol for every kind: `card` and
    // `lorebook` edit a saved document through tool calls; `app` streams a plain
    // Markdown answer from a client-built context.

    async createAssistantConversation<K extends AssistantKind>(
        body: AssistantConversationCreate<K>,
        options: AssistantRequestOptions = {},
    ): Promise<AssistantConversationResponse<K>> {
        this.assertAssistantKindEnabled(body.kind)
        return this.authenticatedRequest<AssistantConversationResponse<K>>('/assistant/conversations', this.getStoredToken(), {
            method: 'POST',
            body: body as unknown as BodyInit,
            ...this.assistantRequestOptions(options),
        })
    }

    /**
     * Conversations in a scope (without a target id, the unbound ones of that
     * kind), or with a null scope the whole history: every kind the server and
     * this build offer, bound or not, newest first.
     */
    async listAssistantConversations(
        scope: AssistantConversationScope | null,
        options: AssistantRequestOptions = {},
    ): Promise<AssistantConversationListResponse> {
        if (!scope) {
            const history = await this.authenticatedRequest<AssistantConversationListResponse>('/assistant/conversations', this.getStoredToken(), {
                method: 'GET',
                ...this.assistantRequestOptions(options),
            })
            return { conversations: history.conversations.filter((conversation) => this.assistantKindEnabled(conversation.kind)) }
        }
        this.assertAssistantKindEnabled(scope.kind)
        const params = new URLSearchParams({ kind: scope.kind })
        if (scope.kind === 'card') {
            params.set('card_type', scope.card_type)
            if (scope.card_id) params.set('card_id', scope.card_id)
        }
        if (scope.kind === 'lorebook' && scope.lorebook_id) params.set('lorebook_id', scope.lorebook_id)
        return this.authenticatedRequest<AssistantConversationListResponse>(`/assistant/conversations?${params.toString()}`, this.getStoredToken(), {
            method: 'GET',
            ...this.assistantRequestOptions(options),
        })
    }

    async getAssistantConversation<K extends AssistantKind>(
        kind: K,
        conversationId: number,
        options: AssistantRequestOptions = {},
    ): Promise<AssistantConversationResponse<K>> {
        this.assertAssistantKindEnabled(kind)
        return this.authenticatedRequest<AssistantConversationResponse<K>>(`/assistant/conversations/${conversationId}`, this.getStoredToken(), {
            method: 'GET',
            ...this.assistantRequestOptions(options),
        })
    }

    /** Delete an assistant conversation and its messages. 409 while a turn is in flight. */
    async deleteAssistantConversation(kind: AssistantKind, conversationId: number, options: AssistantRequestOptions = {}): Promise<void> {
        this.assertAssistantKindEnabled(kind)
        await this.authenticatedRequest<void>(`/assistant/conversations/${conversationId}`, this.getStoredToken(), {
            method: 'DELETE',
            ...this.assistantRequestOptions(options),
        })
    }

    async streamAssistantMessage<K extends AssistantKind>(
        conversationId: number,
        body: AssistantTurnRequest<K>,
        onEvent: (event: AssistantStreamEvent<K>) => void,
        options: AssistantRequestOptions = {},
    ): Promise<void> {
        const kind: AssistantKind = body.kind
        this.assertAssistantKindEnabled(kind)
        const feature: AssistantLlmFeature = `${kind}_assistant`
        const requestId = options.requestId || this.createClientId('mw-assistant-turn')
        const outcome = { finished: false }
        return this.withLlmIntent(feature, requestId, options.llm, options.signal, async (llm) => this.withAssistantRetry(conversationId, requestId, llm, options.signal, async () => {
            outcome.finished = false
            await this.authenticatedStream<AssistantStreamEvent<K>>(`/assistant/conversations/${conversationId}/messages/stream`,
                { ...body, llm }, this.assistantIntentEvents<AssistantStreamEvent<K>>((event) => {
                    if (event.type === 'final') {
                        // The turn is the final event without its SSE type.
                        const turn: Record<string, unknown> = { ...event }
                        delete turn.type
                        this.assertAssistantTurn(turn, kind, conversationId, requestId)
                    }
                    onEvent(event)
                }, outcome), { ...options, requestId })
        }), () => outcome.finished)
    }

    /**
     * Assistant streams report failures as events. A key demand before any turn
     * output becomes an error so the intent can ask for that target's key and
     * resend; a final turn or spent request releases the frozen target.
     */
    private assistantIntentEvents<E extends { type: string }>(onEvent: (event: E) => void, outcome: { finished: boolean }): (event: E) => void {
        let started = false
        return (incoming) => {
            let event = incoming
            let code: unknown
            if (event.type === 'error') {
                const failure = event as { error?: Record<string, unknown>; detail?: unknown }
                if (failure.detail && typeof failure.detail === 'object') {
                    // Profile and execution failures carry only a stable code
                    // ({detail: {code}}); consumers read it from `error`.
                    const { detail, ...rest } = failure
                    event = { ...rest, error: { ...(detail as Record<string, unknown>), ...failure.error } } as unknown as E
                }
                code = (event as { error?: { code?: unknown } }).error?.code
            }
            if (code === 'BYOK_CREDENTIAL_REQUIRED' && !started) throw new ApiError(409, 'A key is required to continue this request.', { code, retryable: false })
            if (code === 'LLM_EXECUTION_FINISHED' || code === 'LLM_EXECUTION_UPSTREAM_FAILED') {
                throw new ApiError(code === 'LLM_EXECUTION_FINISHED' ? 409 : 502, code, { code, retryable: true })
            }
            if (event.type !== 'progress') started = true
            if (event.type === 'final' || isLlmRequestSpent({ code })) outcome.finished = true
            onEvent(event)
        }
    }

    /** Reconcile a turn whose stream dropped: null until the server finished it. */
    async getAssistantTurn<K extends AssistantKind>(
        kind: K,
        conversationId: number,
        requestId: string,
        options: AssistantRequestOptions = {},
    ): Promise<AssistantTurnResponse<K> | null> {
        this.assertAssistantKindEnabled(kind)
        const result = await this.authenticatedRequest<AssistantTurnStatus<K>>(
            `/assistant/conversations/${conversationId}/turns/${encodeURIComponent(requestId)}`, this.getStoredToken(),
            { method: 'GET', signal: options.signal, timeoutMs: options.timeoutMs })
        if (result.request_id !== requestId) throw new ApiError(502, 'Assistant reconciliation returned a different request.')
        if (result.status !== 'completed') return null
        this.assertAssistantTurn(result.turn, kind, conversationId, requestId)
        return result.turn!
    }

    private async withAssistantRetry<T>(conversationId: number, requestId: string,
        llm: LlmRequest, signal: AbortSignal | undefined, send: () => Promise<T>): Promise<T> {
        const owner = authSession.getSnapshot()
        try {
            return await send()
        } catch (error) {
            this.assertCurrentOwner(owner)
            if (error instanceof ApiError && !signal?.aborted
                && ['LLM_EXECUTION_UPSTREAM_FAILED', 'LLM_EXECUTION_FINISHED'].includes(error.code || '')) {
                const status = await this.authenticatedRequest<unknown>(
                    `/assistant/conversations/${conversationId}/turns/${encodeURIComponent(requestId)}`,
                    this.getStoredToken(), { method: 'GET', signal, timeoutMs: 5000 },
                ).catch(() => null)
                this.assertCurrentOwner(owner)
                if (status && typeof status === 'object' && !Array.isArray(status)) {
                    const retained = status as Record<string, unknown>
                    if (Object.keys(retained).sort().join(',') === 'execution_id,recovery_required,request_id,status'
                        && retained.request_id === requestId && retained.recovery_required === true
                        && ['failed', 'cancelled'].includes(retained.status as string)
                        && typeof retained.execution_id === 'string'
                        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(retained.execution_id)) {
                        error.llmRetry = { retry_of_execution_id: retained.execution_id,
                            selection: llm.selection ? { ...llm.selection } : { mode: 'inherit' },
                            ...(llm.expected_revision_id ? { expected_revision_id: llm.expected_revision_id } : {}) }
                    }
                }
            }
            throw error
        }
    }

    private assertAssistantTurn(result: unknown, kind: AssistantKind, conversationId: number, requestId: string): void {
        if (!verifyAssistantTurn(result, kind, conversationId, requestId)) {
            throw new ApiError(502, 'Assistant returned an invalid execution result.', {
                code: 'assistant_execution_contract', category: 'upstream_contract', retryable: false,
            })
        }
    }

    /**
     * Update an existing adventure template
     */
    async updateAdventureTemplate(templateId: string, templateData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: templateData
        })
    }

    /**
     * Delete an adventure template
     */
    async deleteAdventureTemplate(templateId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific character by ID
     */
    async getCharacter(characterId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${characterId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete a character
     */
    async deleteCharacter(characterId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${characterId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific world by ID
     */
    async getWorld(worldId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${worldId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete a world
     */
    async deleteWorld(worldId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${worldId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific item/object by ID
     */
    async getItem(itemId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${itemId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete an item/object
     */
    async deleteItem(itemId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${itemId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Delete all of the current user's data (cards, adventures, generated media).
     * The account itself — username, role and credits — stays active.
     */
    async deleteAllUserData(): Promise<{ message: string; deleted: Record<string, number> }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/user/data', token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific adventure template by ID
     */
    async getAdventureTemplate(templateId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get a specific adventure session by ID
     */
    async getAdventureSession(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'GET'
        })
    }

    async getAdventureSessionMessages(sessionId: number): Promise<AdventureSessionMessagesResponse> {
        const token = this.getStoredToken()
        const limit = 200
        let beforeSequence: number | undefined
        let response: AdventureSessionMessagesResponse | null = null
        let messages: StoredConversationMessage[] = []
        while (true) {
            const query = new URLSearchParams({ limit: String(limit) })
            if (beforeSequence !== undefined) query.set('before_sequence', String(beforeSequence))
            const page = await this.authenticatedRequest<AdventureSessionMessagesResponse>(
                `/adventure-sessions/${sessionId}/messages?${query.toString()}`,
                token,
                { method: 'GET' },
            )
            response ??= page
            messages = [...page.messages, ...messages]
            if (page.messages.length < limit) break
            const nextBefore = page.messages[0]?.sequence_no
            if (typeof nextBefore !== 'number' || nextBefore < 1 || nextBefore >= (beforeSequence ?? Number.POSITIVE_INFINITY)) break
            beforeSequence = nextBefore
        }
        return { ...(response as AdventureSessionMessagesResponse), messages }
    }

    /** Durable state of a chat request, read without running it; the completed turn itself comes from the history. */
    async reconcileChatTurn(basePath: 'adventure-sessions' | 'character-chats', sessionId: number, requestId: string, signal?: AbortSignal): Promise<ChatTurnReconciliation> {
        const result = await this.authenticatedRequest<Record<string, unknown>>(
            `/${basePath}/${sessionId}/turns/${encodeURIComponent(requestId)}`, this.getStoredToken(), { method: 'GET', cache: 'no-store', signal, timeoutMs: 5000 })
        const keys = Object.keys(result ?? {}).sort().join(',')
        const status = result?.status
        if ((keys !== 'dispatch,execution_id,recovery_required,request_id,status' && !(status === 'completed' && keys === 'execution_id,recovery_required,request_id,status,turn'))
            || result.request_id !== requestId || typeof result.recovery_required !== 'boolean'
            || typeof result.execution_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.execution_id)
            || !['admitted', 'running', 'completed', 'failed', 'cancelled', 'awaiting_credential'].includes(status as string)
            || (status === 'completed' && result.recovery_required)) {
            throw new ApiError(502, 'Chat reconciliation returned an invalid state.')
        }
        let dispatch: ChatTurnReconciliation['dispatch']
        if (status !== 'completed') {
            const value = result.dispatch as Record<string, unknown> | undefined
            const llm = value?.llm as Record<string, unknown> | undefined
            const selection = llm?.selection as Record<string, unknown> | undefined
            const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
            if (!value || Object.keys(value).sort().join(',') !== 'content,existing_user_message_id,llm'
                || typeof value.content !== 'string' || !value.content.trim() || value.content.length > 32000
                || value.existing_user_message_id !== null && (!Number.isSafeInteger(value.existing_user_message_id) || Number(value.existing_user_message_id) < 1)
                || !llm || Object.keys(llm).some(key => !['selection', 'expected_revision_id', 'retry_of_execution_id'].includes(key))
                || !selection || (selection.mode === 'inherit' ? Object.keys(selection).join(',') !== 'mode'
                    : selection.mode !== 'profile' || Object.keys(selection).sort().join(',') !== 'mode,profile_id' || !uuid(selection.profile_id))
                || llm.expected_revision_id !== undefined && !uuid(llm.expected_revision_id)
                || llm.retry_of_execution_id !== undefined && !uuid(llm.retry_of_execution_id)) {
                throw new ApiError(502, 'Chat reconciliation returned an invalid command.')
            }
            dispatch = { content: value.content, existing_user_message_id: value.existing_user_message_id as number | null,
                llm: { selection: selection.mode === 'inherit' ? { mode: 'inherit' } : { mode: 'profile', profile_id: String(selection.profile_id) },
                    ...(llm.expected_revision_id ? { expected_revision_id: String(llm.expected_revision_id) } : {}),
                    ...(llm.retry_of_execution_id ? { retry_of_execution_id: String(llm.retry_of_execution_id) } : {}) } }
        }
        return { status: status as ChatTurnReconciliation['status'], request_id: requestId, execution_id: result.execution_id, recovery_required: result.recovery_required,
            ...(dispatch ? { dispatch } : {}) }
    }

    async updateAdventureSessionMessage(
        sessionId: number,
        messageId: number,
        content: string,
    ): Promise<StoredConversationMessage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: { content } as unknown as BodyInit,
        })
    }

    /** Make this reply the active version of the latest exchange; the others stay stored. */
    async activateAdventureSessionMessage(sessionId: number, messageId: number): Promise<StoredConversationMessage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}/activate`, token, {
            method: 'POST'
        })
    }

    async deleteAdventureSessionMessage(sessionId: number, messageId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}`, token, {
            method: 'DELETE'
        })
    }

    async clearAdventureSessionMessages(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages`, token, {
            method: 'DELETE'
        })
    }

    async getImageJob(jobId: string): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/images/jobs/${encodeURIComponent(jobId)}`, token, {
            method: 'GET'
        })
    }

    async getImageResult(jobId: string): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/images/jobs/${encodeURIComponent(jobId)}/result`, token, {
            method: 'GET'
        })
    }

    /* ------------------------------ voice call ------------------------------ */

    async saveVoiceConsent(sessionId: number, options: { signal?: AbortSignal } = {}): Promise<VoiceConsentResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceConsentResponse>(`/character-chats/${sessionId}/voice-consent`, token, {
            method: 'POST',
            body: {} as unknown as BodyInit,
            signal: options.signal,
        })
    }

    async uploadVoiceSegment(
        sessionId: number,
        body: VoiceSegmentUploadRequest,
        options: { signal?: AbortSignal } = {},
    ): Promise<VoiceSegmentUploadResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('voice_session_id', body.voice_session_id)
        form.append('client_call_id', body.client_call_id)
        form.append('seq', String(body.seq))
        form.append('started_at_ms', String(body.started_at_ms))
        form.append('duration_ms', String(body.duration_ms))
        form.append('encoding', body.encoding)
        form.append('sample_rate', String(body.sample_rate))
        form.append('channels', String(body.channels))
        form.append('audio_sha256', body.audio_sha256)
        form.append('vad_json', JSON.stringify(body.vad))
        form.append('audio', body.audio, `voice-segment-${body.seq}`)
        const idempotencyKey = `voice:${body.voice_session_id}:${body.seq}:${body.audio_sha256}`

        return this.authenticatedRequest<VoiceSegmentUploadResponse>(`/character-chats/${sessionId}/voice-segments`, token, {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /**
     * End a call over HTTP. `keepalive` lets the request outlive the page
     * (pagehide / tab close), where the socket's own `voice_end` may be lost.
     */
    async endVoiceCall(
        sessionId: number,
        body: { voiceSessionId: string; reason?: 'user' },
        options: { signal?: AbortSignal; keepalive?: boolean } = {},
    ): Promise<VoiceEndResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceEndResponse>(`/character-chats/${sessionId}/voice-end`, token, {
            method: 'POST',
            body: {
                voice_session_id: body.voiceSessionId,
                reason: 'user',
            } as unknown as BodyInit,
            signal: options.signal,
            ...(options.keepalive ? { keepalive: true } : {}),
        })
    }

    /* ------------------------------ chat tts ------------------------------ */

    async getTtsJob(jobId: string): Promise<TtsJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tts/jobs/${encodeURIComponent(jobId)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Fetch an owned narration audio asset (`/tts/assets/{asset_id}.mp3`) as a
     * Blob. The download route is ownership-checked, and `<audio>`/`Audio()`
     * requests can't carry an Authorization header — so callers fetch through
     * here and play from an object URL instead.
     */
    async fetchTtsAudioBlob(url: string): Promise<Blob> {
        return this.fetchProtectedMediaBlob(url, 'audio/mpeg')
    }

    async fetchProtectedMediaBlob(url: string, accept: string = '*/*'): Promise<Blob> {
        const protectedPath = getProtectedMediaPath(url)
        const requestUrl = protectedPath
            ? `${this.baseUrl}${protectedPath}`
            : /^https?:/i.test(url)
              ? url
              : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
        // Only attach the bearer token when the request targets our own API origin.
        // An absolute, foreign URL (e.g. a community card or a future external CDN)
        // must never receive the access token.
        const isSameOrigin = (() => {
            try {
                return new URL(requestUrl, window.location.href).origin === new URL(this.baseUrl, window.location.href).origin
            } catch {
                return false
            }
        })()
        const fetchOnce = (token: string) => fetch(requestUrl, {
            method: 'GET',
            headers: {
                Accept: accept,
                ...(token && isSameOrigin ? { 'Authorization': `Bearer ${token}` } : {}),
            },
        })
        const token = this.getStoredToken()
        const owner = isSameOrigin ? { ...authSession.getSnapshot(), token } : null
        let response = await fetchOnce(token)
        this.assertCurrentOwner(owner)
        if (isSameOrigin && response.status === 401) {
            const rotatedToken = this.getStoredToken()
            if (rotatedToken && rotatedToken !== token) {
                response = await fetchOnce(rotatedToken)
                this.assertCurrentOwner(owner)
            }
            if (response.status === 401) {
                const nextToken = await this.refreshAccessToken(rotatedToken || token)
                this.assertCurrentOwner(owner)
                response = await fetchOnce(nextToken)
                this.assertCurrentOwner(owner)
            }
        }
        if (!response.ok) {
            throw new ApiError(response.status, 'Protected media could not be loaded.', {
                category: 'protected_media',
                retryable: response.status >= 500,
            })
        }
        const blob = await response.blob()
        this.assertCurrentOwner(owner)
        return blob
    }

    /** Poll a chat TTS job until it reaches a terminal status (or the deadline). */
    async waitForTts(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: TtsJobPublicResponse) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<TtsJobPublicResponse> {
        return this.pollUntilTerminal(
            () => this.getTtsJob(jobId),
            ['pending', 'in_progress', 'synthesizing', 'mirroring'],
            opts,
            { intervalMs: 2_000, maxWaitMs: 120_000 },
        )
    }

    /* ---------------------------- card media ---------------------------- */

    /** Resolve after `ms`, or reject early if `signal` aborts. */
    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new DOMException('Aborted', 'AbortError'))
                return
            }
            const timer = setTimeout(() => {
                cleanup()
                resolve()
            }, ms)
            const onAbort = () => {
                cleanup()
                reject(new DOMException('Aborted', 'AbortError'))
            }
            const cleanup = () => {
                clearTimeout(timer)
                signal?.removeEventListener('abort', onAbort)
            }
            signal?.addEventListener('abort', onAbort, { once: true })
        })
    }

    private isPageFocused(): boolean {
        return typeof document === 'undefined' || (document.visibilityState === 'visible' && document.hasFocus())
    }

    /** Wait for the next poll slot, suspending automatic requests outside the focused page. */
    private waitForFocusedPoll(intervalMs: number, signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
        if (typeof document === 'undefined' || typeof window === 'undefined') return this.delay(intervalMs, signal)

        const focused = () => this.isPageFocused()
        if (intervalMs === 0 && focused()) return Promise.resolve()

        return new Promise((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null
            let paused = !focused()
            const cleanup = () => {
                if (timer !== null) clearTimeout(timer)
                window.removeEventListener('focus', onFocusChange)
                window.removeEventListener('blur', onFocusChange)
                document.removeEventListener('visibilitychange', onFocusChange)
                signal?.removeEventListener('abort', onAbort)
            }
            const onAbort = () => {
                cleanup()
                reject(new DOMException('Aborted', 'AbortError'))
            }
            const onFocusChange = () => {
                if (!focused()) {
                    paused = true
                    if (timer !== null) clearTimeout(timer)
                    timer = null
                    return
                }
                if (paused) {
                    cleanup()
                    resolve()
                    return
                }
                if (timer === null) {
                    timer = setTimeout(() => {
                        timer = null
                        if (focused()) {
                            cleanup()
                            resolve()
                        } else {
                            paused = true
                        }
                    }, intervalMs)
                }
            }
            window.addEventListener('focus', onFocusChange)
            window.addEventListener('blur', onFocusChange)
            document.addEventListener('visibilitychange', onFocusChange)
            signal?.addEventListener('abort', onAbort, { once: true })
            if (signal?.aborted) onAbort()
            else onFocusChange()
        })
    }

    /**
     * Poll `fetchJob` until its `status` leaves `nonTerminalStatuses` or the
     * deadline passes, returning the last job either way. Shared by the TTS,
     * image, and theme-song waiters (each supplies its own statuses + cadence).
     */
    private async pollUntilTerminal<T extends { status: string }>(
        fetchJob: () => Promise<T>,
        nonTerminalStatuses: Iterable<string>,
        opts: { signal?: AbortSignal; onUpdate?: (job: T) => void; intervalMs?: number; maxWaitMs?: number },
        defaults: { intervalMs: number; maxWaitMs: number },
    ): Promise<T> {
        const nonTerminal = new Set<string>(nonTerminalStatuses)
        const interval = opts.intervalMs ?? defaults.intervalMs
        const maxWaitMs = opts.maxWaitMs ?? defaults.maxWaitMs
        let focusedElapsedMs = 0
        let focusedAt: number | null = this.isPageFocused() ? Date.now() : null
        const trackFocus = () => {
            const now = Date.now()
            if (this.isPageFocused()) {
                if (focusedAt === null) focusedAt = now
            } else if (focusedAt !== null) {
                focusedElapsedMs += now - focusedAt
                focusedAt = null
            }
        }
        if (typeof document !== 'undefined' && typeof window !== 'undefined') {
            window.addEventListener('focus', trackFocus)
            window.addEventListener('blur', trackFocus)
            document.addEventListener('visibilitychange', trackFocus)
        }
        try {
            let nextInterval = 0
            for (;;) {
                await this.waitForFocusedPoll(nextInterval, opts.signal)
                // Focus can change between the wake-up event and this continuation.
                if (!this.isPageFocused()) {
                    nextInterval = 0
                    continue
                }
                const job = await fetchJob()
                opts.signal?.throwIfAborted()
                opts.onUpdate?.(job)
                if (!nonTerminal.has(job.status)) return job
                trackFocus()
                const activeTimeMs = focusedElapsedMs + (focusedAt === null ? 0 : Date.now() - focusedAt)
                if (activeTimeMs >= maxWaitMs) return job
                nextInterval = interval
            }
        } finally {
            if (typeof document !== 'undefined' && typeof window !== 'undefined') {
                window.removeEventListener('focus', trackFocus)
                window.removeEventListener('blur', trackFocus)
                document.removeEventListener('visibilitychange', trackFocus)
            }
        }
    }

    /**
     * Generate a profile portrait from a card's own information. The client sends
     * only the card template (+ optional art direction); the backend builds the
     * private prompt. Returns the job (200 = already done, 202 = poll it).
     */
    async generateCardPortrait(body: CardPortraitRequest, options: AiCardRequestOptions = {}): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<ImageJobPublicResponse>('/images/card-portrait', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: body as unknown as BodyInit,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        })
    }

    /**
     * Upload a user-supplied custom card image. Returns the stored asset's URL,
     * which is set onto the card's `image_url` and persisted on save — mirroring
     * the generate flow. Stateless (no card id), so it works for unsaved cards too.
     */
    async uploadCardImage(file: File, options: { signal?: AbortSignal } = {}): Promise<ImageUploadResponse> {
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('file', file)
        // No Content-Type header — request() lets the browser set the multipart boundary.
        return this.authenticatedRequest<ImageUploadResponse>('/images/upload', token, {
            method: 'POST',
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /** Poll an image job until it reaches a terminal status (or the deadline). */
    async waitForImageJob(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: ImageJobPublicResponse) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<ImageJobPublicResponse> {
        return this.pollUntilTerminal(
            () => this.getImageJob(jobId),
            ['pending', 'in_progress', 'mirroring'],
            opts,
            { intervalMs: 2_500, maxWaitMs: 180_000 },
        )
    }

    /**
     * List the caller's own generated image jobs (newest first) — the user gallery.
     * Image jobs are owned per user (not attached to a card), so this is a user-wide
     * gallery the card editor picks a default image from. Defaults to completed jobs
     * (the only ones with renderable assets). Offset-based pagination.
     */
    async listImageJobs(
        opts: {
            status?: 'completed' | 'failed' | 'canceled' | 'pending' | 'in_progress' | 'mirroring'
            limit?: number
            offset?: number
            /** Narrow to jobs tagged with a card at creation (legacy jobs are untagged). */
            cardType?: CardMediaTargetType
            cardId?: string
        } = {},
    ): Promise<ImageJobListResponse> {
        const token = this.getStoredToken()
        const status = opts.status ?? 'completed'
        const limit = opts.limit ?? 24
        const offset = opts.offset ?? 0
        let query = `status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`
        if (opts.cardType) query += `&card_type=${encodeURIComponent(opts.cardType)}`
        if (opts.cardId) query += `&card_id=${encodeURIComponent(opts.cardId)}`
        return this.authenticatedRequest(`/images/jobs?${query}`, token, { method: 'GET' })
    }

    /** Soft-delete a generated image asset (removes it from the gallery). */
    async deleteImageAsset(assetId: string, options: { signal?: AbortSignal } = {}): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/images/assets/${encodeURIComponent(assetId)}`, token, {
            method: 'DELETE',
            signal: options.signal,
        })
    }

    /**
     * Create a card theme song. Requires an owned, persisted card (`target_id`);
     * the backend derives the private prompt from the card + the `description`
     * direction. Returns the job (200 = done, 202 = poll it).
     */
    async generateThemeSong(body: ThemeSongCreateRequest, options: AiCardRequestOptions = {}): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<unknown>('/theme-songs', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: body as unknown as BodyInit,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        }).then((value) => this.workflowResult(value, (value): value is ThemeSongJobPublic => verifyThemeSongJob(value)
            && value.target.type === body.target_type && value.target.id === body.target_id
            && value.instrumental === (body.instrumental ?? false)
            && (body.model_alias === undefined || value.model_alias === body.model_alias)))
    }

    async getThemeSongJob(jobId: string): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<unknown>(`/theme-songs/jobs/${encodeURIComponent(jobId)}`, token, { method: 'GET' })
            .then((value) => this.workflowResult(value, (value): value is ThemeSongJobPublic => verifyThemeSongJob(value) && value.job_id === jobId))
    }

    async getThemeSongResult(jobId: string): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<unknown>(`/theme-songs/jobs/${encodeURIComponent(jobId)}/result`, token, { method: 'GET' })
            .then((value) => this.workflowResult(value, (value): value is ThemeSongJobPublic => verifyThemeSongJob(value) && value.job_id === jobId))
    }

    /** List the theme songs attached to a given card (most recent first). */
    async listThemeSongs(targetType: CardMediaTargetType, targetId: string, limit = 20, offset = 0): Promise<ThemeSongListResponse> {
        const token = this.getStoredToken()
        const query = `target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&limit=${limit}&offset=${offset}`
        return this.authenticatedRequest<unknown>(`/theme-songs?${query}`, token, { method: 'GET' })
            .then((value) => this.workflowResult(value, (value): value is ThemeSongListResponse => verifyThemeSongList(value)
                && value.target.type === targetType && value.target.id === targetId))
    }

    /**
     * List the user's theme songs across all cards (most recent first) — the media
     * gallery. Each item carries its own `target` ref; optional filters narrow to a
     * card type or a single card.
     */
    async listUserThemeSongs(
        opts: {
            targetType?: CardMediaTargetType
            targetId?: string
            status?: ThemeSongJobStatus
            limit?: number
            offset?: number
        } = {},
    ): Promise<UserThemeSongListResponse> {
        const token = this.getStoredToken()
        const limit = opts.limit ?? 20
        const offset = opts.offset ?? 0
        let query = `limit=${limit}&offset=${offset}`
        if (opts.targetType) query += `&target_type=${encodeURIComponent(opts.targetType)}`
        if (opts.targetId) query += `&target_id=${encodeURIComponent(opts.targetId)}`
        if (opts.status) query += `&status=${encodeURIComponent(opts.status)}`
        return this.authenticatedRequest<unknown>(`/theme-songs/user?${query}`, token, { method: 'GET' })
            .then((value) => this.workflowResult(value, (value): value is UserThemeSongListResponse => verifyUserThemeSongList(value)
                && value.items.every((job) => (!opts.targetType || job.target.type === opts.targetType)
                    && (!opts.targetId || job.target.id === opts.targetId) && (!opts.status || job.status === opts.status))))
    }

    /** Soft-delete a theme-song audio asset (removes it from the card's history). */
    async deleteThemeSongAsset(assetId: string, options: { signal?: AbortSignal } = {}): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/theme-songs/assets/${encodeURIComponent(assetId)}`, token, {
            method: 'DELETE',
            signal: options.signal,
        })
    }

    /** Poll a theme-song job until it reaches a terminal status (or the deadline). */
    async waitForThemeSong(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: ThemeSongJobPublic) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<ThemeSongJobPublic> {
        return this.pollUntilTerminal(
            () => this.getThemeSongJob(jobId),
            THEME_SONG_NON_TERMINAL_STATUSES,
            opts,
            { intervalMs: 3_000, maxWaitMs: 240_000 },
        )
    }

    async listTasks(
        opts: {
            state?: BackgroundTaskState
            operation?: BackgroundTaskOperation
            statuses?: ThemeSongJobStatus[]
            limit?: number
            offset?: number
        } = {},
    ): Promise<BackgroundTaskListResponse> {
        const token = this.getStoredToken()
        const state = opts.state ?? 'active'
        const operation = opts.operation ?? 'theme_song'
        const limit = opts.limit ?? 20
        const offset = opts.offset ?? 0
        const params = new URLSearchParams({
            state,
            operation,
            limit: String(limit),
            offset: String(offset),
        })
        for (const status of opts.statuses ?? []) {
            params.append('status', status)
        }
        const query = params.toString()
        return this.authenticatedRequest(`/tasks?${query}`, token, { method: 'GET' })
    }

    async getTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'GET' })
    }

    async cancelTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'DELETE' })
    }

    async archiveTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}/archive`, token, { method: 'POST' })
    }

    async importMarkdownUrl(sourceUrl: string): Promise<{ source_url: string; markdown: string; rate_limit_remaining?: string | null }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/imports/markdown', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { url: sourceUrl } as unknown as BodyInit,
        })
    }

    /**
     * Create a new adventure session
     */
    async createAdventureSession(adventureTemplate: string, personaId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-sessions/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: { adventure_template: adventureTemplate, persona_id: personaId } as unknown as BodyInit
        })
    }

    /**
     * Persist edits to an adventure's cloned cards (persona/cast/world/scenario).
     * Writes only to this session's own snapshot — the original template and
     * library cards are never touched. The chat AI reads its context from here.
     */
    async updateAdventureSnapshot(sessionId: number, snapshot: AdventureSnapshot): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/template-snapshot`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                template: snapshot.template,
                narrator_voice: snapshot.narrator_voice ?? null,
                narrate_thoughts: snapshot.narrate_thoughts ?? false,
            } as unknown as BodyInit
        })
    }

    /**
     * Delete an adventure session
     */
    async deleteAdventureSession(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Start a fresh 1:1 character chat and seed the character's greeting as the first turn.
     */
    async createCharacterChat(characterId: string, personaId?: string | null): Promise<any> {
        const token = this.getStoredToken()
        const body: { character_id: string; persona_id?: string } = { character_id: characterId }
        const resolvedPersonaId = personaId?.trim()
        if (resolvedPersonaId) body.persona_id = resolvedPersonaId
        return this.authenticatedRequest('/character-chats/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body as unknown as BodyInit
        })
    }

    /**
     * Start a new group character chat with 2-6 AI character cards.
     * Unlike 1:1 chat, this intentionally creates a fresh room every time.
     */
    async createCharacterGroupChat(characterIds: string[], personaId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/groups', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { character_ids: characterIds, persona_id: personaId } as unknown as BodyInit
        })
    }

    /** List the user's 1:1 character chats (most recent state per chat). */
    async getCharacterChats(): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/', token, {
            method: 'GET'
        })
    }

    /** Fetch character-chat session metadata. Conversation rows live under `/messages`. */
    async getCharacterChat(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}`, token, {
            method: 'GET'
        })
    }

    async getCharacterChatMessages(chatId: number): Promise<CharacterChatMessagesResponse> {
        const token = this.getStoredToken()
        const limit = 200
        let beforeSequence: number | undefined
        let response: CharacterChatMessagesResponse | null = null
        let messages: StoredConversationMessage[] = []
        while (true) {
            const query = new URLSearchParams({ limit: String(limit) })
            if (beforeSequence !== undefined) query.set('before_sequence', String(beforeSequence))
            const page = await this.authenticatedRequest<CharacterChatMessagesResponse>(
                `/character-chats/${chatId}/messages?${query.toString()}`,
                token,
                { method: 'GET' },
            )
            response ??= page
            messages = [...page.messages, ...messages]
            if (page.messages.length < limit) break
            const nextBefore = page.messages[0]?.sequence_no
            if (typeof nextBefore !== 'number' || nextBefore < 1 || nextBefore >= (beforeSequence ?? Number.POSITIVE_INFINITY)) break
            beforeSequence = nextBefore
        }
        return { ...(response as CharacterChatMessagesResponse), messages }
    }

    async getCharacterChatCodexCards(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards`, token, {
            method: 'GET',
        })
    }

    /** Recent voice calls across all of the user's character chats (call-history feed). */
    async getRecentVoiceCalls(params: { skip?: number; limit?: number } = {}): Promise<VoiceCallListResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        const query = this.listQuery(params.skip ?? 0, params.limit ?? 20)
        return this.authenticatedRequest<VoiceCallListResponse>(`/voice-calls${query}`, token, { method: 'GET' })
    }

    /** Voice calls that belong to one character chat, newest first. */
    async getCharacterChatCalls(chatId: number, params: { skip?: number; limit?: number } = {}): Promise<VoiceCallListResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        const query = this.listQuery(params.skip ?? 0, params.limit ?? 20)
        return this.authenticatedRequest<VoiceCallListResponse>(`/character-chats/${chatId}/calls${query}`, token, { method: 'GET' })
    }

    /** Ordered transcript for one call (user STT lines + character lines with saved audio). */
    async getVoiceCallTranscript(voiceSessionId: string): Promise<VoiceCallTranscriptResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceCallTranscriptResponse>(
            `/voice-calls/${encodeURIComponent(voiceSessionId)}/transcript`,
            token,
            { method: 'GET' },
        )
    }

    /** Make this reply the active version of the latest exchange; the others stay stored. */
    async activateCharacterChatMessage(chatId: number, messageId: number): Promise<StoredConversationMessage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages/${messageId}/activate`, token, {
            method: 'POST'
        })
    }

    async deleteCharacterChatMessage(chatId: number, messageId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages/${messageId}`, token, {
            method: 'DELETE'
        })
    }

    async updateCharacterChatMessage(
        chatId: number,
        messageId: number,
        content: string,
    ): Promise<StoredConversationMessage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages/${messageId}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: { content } as unknown as BodyInit,
        })
    }

    async clearCharacterChatMessages(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages`, token, {
            method: 'DELETE'
        })
    }

    async addCharacterChatCodexCards(chatId: number, cards: Array<{ kind: string; cardId: string }>): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { cards: cards.map((card) => ({ kind: card.kind, card_id: card.cardId })) } as unknown as BodyInit,
        })
    }

    async updateCharacterChatCodexCard(chatId: number, codexCardId: string, enabled: boolean): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards/${encodeURIComponent(codexCardId)}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: { enabled } as unknown as BodyInit,
        })
    }

    async deleteCharacterChatCodexCard(chatId: number, codexCardId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards/${encodeURIComponent(codexCardId)}`, token, {
            method: 'DELETE',
        })
    }

    /** Delete a character chat. */
    async deleteCharacterChat(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}`, token, {
            method: 'DELETE'
        })
    }
}

export const apiService = new ApiService()
configureChatSocketAuthRefresh(() => apiService.refreshAccessToken())
configureVoiceSocketAuthRefresh(() => apiService.refreshAccessToken())

export const refreshAccessToken = (oldToken?: string): Promise<string> => apiService.refreshAccessToken(oldToken)
export type { ApiService }

export { isProtectedMediaUrl, isPublicMediaUrl, resolveMediaUrl } from './mediaUrl'
export { ChatSocket, configureChatSocketAuthRefresh } from './chatSocket'
export type { ChatSocketStatus, ChatSocketHandlers } from './chatSocket'
export { VoiceSocket, configureVoiceSocketAuthRefresh } from './voiceSocket'
export type { VoiceSocketStatus, VoiceSocketHandlers } from './voiceSocket'
