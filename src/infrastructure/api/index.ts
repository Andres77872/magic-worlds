import type { NovelAssistantTurnPreview,NovelRefinementContext } from '@/shared/types/storyAssistant.types'
import type { StoryVariantCreate,StoryVariantDecision,StoryVariantIntent,StoryVariantPage,StoryVariantQuery,StoryVariantRecord,StoryVariantSnapshot } from '@/shared/types/storyVariant.types'
import { isStoryVariantCreate,isStoryVariantDecision,isStoryVariantIntent,isStoryVariantQuery,isStoryVariantReference,verifyStoryVariantCreation,verifyStoryVariantDecision,verifyStoryVariantPage,verifyStoryVariantRecord,verifyStoryVariantSnapshot } from './storyVariantContract'
import { verifyNovelRefinement } from './novelRefinementContract'
import { verifyNovelAssistantPreview } from './novelAssistantContract'
import { isAssistantContextRequest,verifyAssistantContext } from './storyAssistantContextContract'
import { isStoryExportRequest,sha256Hex,storyExportQuery,verifyStoryExportJob,verifyStoryExportManifest } from './storyExportContract'
import type { StoryExportJob,StoryExportManifest,StoryExportRequest } from '@/shared/types/storyExport.types'
import { isStoryImportOptions,isStoryImportWrite,verifyStoryImportAcknowledgement,verifyStoryImportManifest,verifyStoryImportRecord } from './storyImportContract'
import { STORY_OUTLINE_MAX_TEXT,verifyStoryOutlinePreview } from './storyOutlineContract'
import { STORY_PROGRESS_MAX_DAYS,verifyStoryWritingProgress } from './storyProgressContract'
import type { StoryWritingProgress } from '@/shared/types/storyProgress.types'
import type { StoryImportAcknowledgement,StoryImportManifest,StoryImportOptions,StoryImportRecord,StoryImportWrite } from '@/shared/types/storyImport.types'
import { isStoryPackageOptions,isStoryPackageWrite,storyPackageQuery,verifyStoryPackageAcknowledgement,verifyStoryPackageManifest,verifyStoryPackagePreview } from './storyPackageContract'
import type { StoryPackageAcknowledgement,StoryPackageManifest,StoryPackageOptions,StoryPackagePreview,StoryPackageWrite } from '@/shared/types/storyPackage.types'
import type { StoryOutlinePreview } from '@/shared/types/storyOutline.types'
import type { StoryAssistantContext,StoryAssistantContextRequest,StoryAssistantPreferences,StoryAssistantPreferencesState,StoryAssistantPreset,StoryAssistantPresetDefinition,StoryAssistantPresetList } from '@/shared/types/storyAssistant.types'
import { isAssistantPreferences,isAssistantPreferencesState } from '@/shared/storyAssistantPreferences'
import { isPresetDefinition,isStoryAssistantPreset,isStoryAssistantPresetList } from './storyAssistantPresetContract'
import type { StoryStudioDocument } from '@/shared/types/storyStudio.types'
import { verifyStoryStudioDocument } from './storyContract'
import { verifyGenerationHistoryPage,verifyGenerationDetail } from './storyGenerationHistoryContract'
import type { StoryGenerationHistoryPage,StoryGenerationDetail } from '@/shared/types/storyStudio.types'
import { studioExcerptsRequest,verifyStudioExcerpts } from './storyStudioExcerptsContract'
import type { StoryOutline,StorySceneOutline,StoryStudioExcerpts } from '@/shared/types/storyStudio.types'
import { canonicalJson } from '@/utils/json'
import type { StorySceneHeader,StoryStudioIndex,StoryStudioSource,StoryStudioScene } from '@/shared/types/storyStudio.types'
import { verifyStoryStudioIndex,verifyStoryStudioSource,storyStudioSceneRequest,verifyStoryStudioScene } from './storyStudioContract'
import type { StoryReadingPage,StoryReadingRequest } from '@/shared/types/storyReading.types'
import { verifyReadingPage } from './storyReadingContract'
import type { StoryReplacementAck,StoryReplacementPreview,StoryReplacementRequest,StoryReplacementReverseRequest,StoryReplacementWrite } from '@/shared/types/storyReplacement.types'
import { verifyReplacementPreview,verifyReplacementAck } from './storyReplacementContract'
import { verifyStory, verifyStoryScene, verifyStoryMetadata, verifyStoryCodexAcknowledgement, verifyStoryCodexLibraryVersions, verifyStoryCodexLibraryReview, verifyStoryCodexLibraryDraft, verifyStoryCodexLibraryEntry, verifyStoryStructureAcknowledgement, verifyStoryLifecycleAcknowledgement, matchesStoryWrite } from './storyContract'
import type { StorySearchPage,StorySearchRequest,StorySearchResolve,StorySearchResult } from '@/shared/types/storySearch.types'
import { verifySearchPage,verifySearchResult } from './storySearchContract'
import { verifyStoryCopyPreview,verifyStoryCopyAcknowledgement,verifyStoryCopyProvenance } from './storyCopyContract'
import { verifyStoryErasePreview,verifyStoryEraseAcknowledgement } from './storyEraseContract'
import type { StoryErasePreview,StoryEraseWrite,StoryEraseAcknowledgement } from '@/shared/types/story.types'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from './storyCreationContract'
import { isCreationSourcesSelection,verifyCreationSourcesPreview,verifyCreationSources } from './storyCreationSourcesContract'
import { isStoryLibraryFilters,storyLibraryParams } from '@/shared/storyLibrary'
import type { StoryLibraryFilters } from '@/shared/types/storyLibrary.types'
import type { StoryCreationSources,StoryCreationSourcesPreview,StoryCreationSourcesSelection } from '@/shared'
import type { StoryCopyWrite,StoryCopyPreview,StoryCopyAcknowledgement,StoryCopyProvenance } from '@/shared/types/story.types'
import type { StoryCardRef, StoryCodexLibraryDraft, StoryCodexLibraryEntry, StoryCodexLibraryReview, StoryCodexLibraryNotices, StoryCodexWrite, StoryCodexAcknowledgement, StoryScene, StorySceneWrite, StoryUnitMetadata, StoryStructureWrite, StoryStructureAcknowledgement, StoryStructureRevision, StoryStructureHistoryPage, StoryStructureHistoryQuery } from '@/shared/types/story.types'
import { verifyStoryStructureHistory,verifyStoryStructureRevision } from './storyHistoryContract'
import type { StorySnapshotPreview,StorySnapshotPage,StorySnapshotDetail,StorySnapshotComparison,StorySnapshotSceneView,StorySnapshotScene,StorySnapshotRestorePreview,StorySnapshotRestoreOptions } from '@/shared/types/story.types'
import { verifySnapshotPreview,verifySnapshotPage,verifySnapshotDetail,verifySnapshotComparison,verifySnapshotScene,verifySnapshotRestorePreview } from './storySnapshotContract'
import { verifySceneRevisionPage,verifySceneRevision,verifySceneRestoreAck } from './storyRevisionContract'
import { verifyGenerationChangeset,verifyGenerationChangesetUndo } from './storyGenerationChangesetContract'
import { verifyAnnotation,verifyAnnotationPage,verifyAnnotationAck,verifyAnnotationCopyPreview } from './storyAnnotationContract'
import { verifyPlanAck,verifyPlanPage } from './storyPlanningContract'
import type { StoryPlanAcknowledgement,StoryPlanKind,StoryPlanPage,StoryPlanQuery,StoryPlanWrite } from '@/shared/types/storyPlanning.types'
import { verifySnapshotAnnotationPage,verifySnapshotAnnotationDetail } from './storySnapshotAnnotationContract'
import type { StorySnapshotAnnotationQuery,StorySnapshotAnnotationIndex,StorySnapshotAnnotationPage,StorySnapshotAnnotationDetail } from '@/shared/types/storyAnnotation.types'
import type { StoryAnnotation,StoryAnnotationPage,StoryAnnotationQuery,StoryAnnotationWrite,StoryAnnotationAcknowledgement,StoryAnnotationCopyPreview } from '@/shared/types/storyAnnotation.types'
import type { StorySceneRevisionQuery,StorySceneRevisionPage,StorySceneRestoreWrite,StorySceneRestoreAcknowledgement } from '@/shared/types/story.types'
import { AvailableLibraryPages } from './availableLibraryPage'
import { isCardSourceStatusList } from './cardSourceStatusContract'
import type { CardIdentity, CardSourceStatusList } from '@/shared/types/workspace.types'
import { assertFeatureEnabled, assertContentTypeFeatureEnabled, assertLlmFeatureEnabled, isLlmFeatureEnabled, isContentTypeFeatureEnabled, isTaskFeatureEnabled, isOperationFeatureEnabled } from '@/shared/featureFlags'
import { verifyAssistantTurn } from './assistantContract'
import { verifyNovelAssistantTurnState } from './novelAssistantControlContract'
import type { NovelAssistantTurnState } from '@/shared/types/novelAssistantControl.types'
import { trackResourceTaskRequest } from './resourceTaskEvents'
import { assertPublicLlmData, assertEffectiveLlmProfile, assertLlmCapacityUsage, assertLlmProfileCompatibility, assertLlmProviderUsage } from './llmProfileContract'
import { prepareLlmRequest, prepareRetainedLlmRequest } from './llmPreparation'
import { isLlmRequestSpent, llmIntents } from './llmIntent'
import type { LlmFeature, LlmRequest, LlmSelection } from '@/shared/types/llm.types'
import type { ImageCatalog, ImageProfile, ImageProfileList, ImageProfileMutation } from '@/shared/types/imageProfile.types'
import type {
    LlmPage, LlmProfileSummary, LlmProfileDetail, LlmProfileMutation, LlmPreferences,
    LlmPreferencesView, LlmFeatureView, LlmCatalogModel, LlmConnection,
    EffectiveLlmProfile, LlmAuditEvent, LlmProfileTestResult, LlmProfileTestTarget, LlmCapacityUsage, LlmProfileCompatibility,
    LlmProviderUsage, LlmExecutionState,
} from '@/shared/types/llmProfile.types'
import { verifyThemeSongJob, verifyThemeSongList, verifyUserThemeSongList } from './themeSongContract'
import { verifyCardGeneration } from './cardContract'
import {
    canonicalInitialCollectionIds,
    isCopyRequestId,
    isWorkspaceErrorCode,
    isWorkspaceUuid,
    MAX_COPY_CARDS,
    stripCardBodyOrganization,
    stripOrganization,
    verifyCollection,
    verifyCollectionList,
    verifyContentResolution,
    verifyCopyResult,
    verifyLibraryPage,
    verifyMembershipResult,
    verifyWorkspace,
    verifyWorkspaceList,
    verifyWorkspaceMediaPage,
} from './workspaceContract'
import type {
    Collection,
    CollectionCreate,
    CollectionList,
    CollectionUpdate,
    ContentResolution,
    ContentResolveQuery,
    CopyCommand,
    CopyOutcome,
    LibraryPage,
    LibraryQuery,
    MembershipCommand,
    MembershipResult,
    RootOrganization,
    Workspace,
    WorkspaceCreate,
    WorkspaceErrorCode,
    WorkspaceList,
    WorkspaceMediaPage,
    WorkspaceMediaQuery,
    WorkspaceScopeOptions,
    WorkspaceUpdate,
} from '@/shared/types/workspace.types'
import { verifyLorebookExtraction, verifyLorebookExtractionStatus, matchesLorebookExtractionProfile, extractionContainsCredential } from './lorebookExtractionContract'
import type { LorebookExtractionCommand, LorebookExtractionOptions, LorebookExtractionResult, LorebookExtractionStatus } from '@/shared/types/lorebookExtraction.types'
import { verifyAgentList, verifyAgentDetail, verifyCustomAgentDetail, verifyAgentVersions, verifyAgentTest } from './workflowContract'
import type { TextGenerationEvent, TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * API infrastructure - centralized API request handling
 */

import { readEventStream, StreamContractError, type SseEvent } from './sse'
import type {
    AcceptanceRenderRequest,
    AcceptanceRenderResponse,
    AcceptanceVerdictRequest,
    AcceptanceVerdictResponse,
    AdminCatalogDeleteResponse,
    AdminCatalogImpact,
    AdminCatalogPage,
    AdminCatalogQuery,
    AdminCatalogUpdate,
    AdminCatalogUpdateOptions,
    AdminCatalogVoice,
    AdminLabSynthesisRequest,
    AdminLabSynthesisResult,
    AdminVoiceLimits,
    AdminVoiceMetricsArea,
    AdminVoiceMetricsByArea,
    AdminVoiceMetricsQuery,
    AdminVoiceSyncRequest,
    AdminVoiceSyncResponse,
    CatalogSampleRenderRequest,
    CatalogSampleRenderResponse,
    LibraryAddRequest,
    LibraryVoicePage,
    LibraryVoiceQuery,
    VoiceDefaultRole,
    VoiceDefaultsResponse,
    VoiceDefaultsUpdateResponse,
    VoiceDesignRequest,
    VoiceDesignResponse,
    VoiceDesignSaveRequest,
    VoiceRemixRequest,
    VoiceRuntimeSetting,
    VoiceRuntimeSettingsResponse,
    AdminGlobalPresetInput,
    AdminGlobalPresetList,
    AdminGlobalPresetRow,
    AdminLabModel,
} from '../../shared/types/adminVoiceCatalog.types'
import type {
    PreviewTextsResponse,
    VoicePresetPreviewRequestV2,
    VoicePresetPreviewResponse,
    VoicePreset,
    VoicePresetV2Write,
} from '../../shared/types/voicePreset.types'
import type {
    CatalogPage,
    CatalogQuery,
    CatalogVoice,
    EffectiveVoiceRefType,
    EffectiveVoiceResponse,
    VoiceCapabilities,
} from '../../shared/types/voiceCatalog.types'
import type { SessionVoiceSettings, VoiceSessionBasePath } from '../../shared/types/sessionVoice.types'
import type {
    MinorReportAccepted,
    MinorReportAdminItem,
    MinorReportAdminList,
    MinorReportInput,
    MinorReportOutcome,
    MinorReportStatus,
} from '../../shared/types/minorReport.types'
import { VOICE_CAPABILITIES_TTL_MS, cachedVoiceCapabilities, toVoiceCapabilities } from '../../shared/voice/voiceCapabilities'
import { catalogKeyBatches, catalogQueryString, toCatalogItems, toCatalogPage } from '../../shared/voice/voiceCatalog'
import { stripVoiceProjections } from '../../shared/voice/stripVoiceProjections'
import type {
    AttestationMethod,
    AttestationRecord,
    AttestationRequirement,
    AttestationStatus,
    AttestationSubmission,
} from '../../shared/types/attestation.types'
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
    AvatarVariantId,
    BrowserAuthResponse,
    ChangePasswordResponse,
    EmailListResponse,
    GenericMessageResponse,
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    NarrationTier,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfile,
} from '../../shared/types/auth.types'
import { DEFAULT_NARRATION_TIER } from '../../shared/types/auth.types'
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
import { ACTIVE_FEATURE_KEYS } from '@/shared/featureFlagCatalog'
import { featureFlagRuntime, type FeatureFlagSnapshot } from '@/shared/featureFlagRuntime'
import { parseFeatureFlagSnapshot } from './featureFlagContract'
import {
    isAppAssistantFeatureEnabled,
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
} from '../../shared/featureFlags'
import { makeRequestId } from '../../utils/uuid'
import { configureChatSocketAuthRefresh } from './chatSocket'
import { configureVoiceSocketAuthRefresh } from './voiceSocket'
import { authSession, type AuthSessionSnapshot } from './authSession'
import { isLorebookExtractionDisabled } from './lorebookExtractionErrors'
import {
    serializeActivationPreview,
    serializeLorebookAttachment,
    serializeLorebookDraft,
    serializeLorebookEntry,
    serializeLorebookResource,
} from './lorebookWire'
import type { StoredConversationMessage, ChatTurnReconciliation, ChatImageAsset, ChatImageError, ChatImageGenerateBody, ChatImageGeneration, ChatTtsAsset, ChatTtsError, ImageLifecycleStatus, TtsLifecycleStatus } from '../../shared/types/interaction.types'
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
    StoryChapterWrite,
    StoryGenerationCommit,
    StoryGenerationChangeset,
    StoryGenerationChangesetUndo,
    StoryGenerationChangesetWrite,
    StoryDocumentRevision,
    StoryContextTrace,
    StoryCreateWrite,
    StoryCreationAcknowledgement,
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
    /** Workspace R1: the job's durable origin (server-owned). */
    organization?: RootOrganization
}

export interface TtsJobPublicResponse {
    job_id: string
    status: TtsLifecycleStatus
    status_url: string
    result_url: string
    assets?: ChatTtsAsset[]
    error?: ChatTtsError | null
    /** Workspace R1: the job's durable origin (server-owned). */
    organization?: RootOrganization
}

export interface SceneNarrationResponse {
    enabled: boolean
    available: boolean
    reason: string | null
    max_speakers: number
    max_compiled_chars: number
    counted_chars: number
    estimated_credits: number
    current_identity: string | null
    matches_current: boolean
    job: TtsJobPublicResponse | null
    manifest: import('@/shared/types/voiceScene.types').SceneManifest | null
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
 * The last settled capabilities read per account key, for a synchronous peek
 * (`peekVoiceCapabilities`). Set once per read (not per cache hit), so it never
 * outlives that read by more than the request time; a failed read clears it.
 */
let voiceCapabilitiesLatestRead: Promise<VoiceCapabilities> | null = null
let voiceCapabilitiesSnapshot: { key: string; value: VoiceCapabilities; expiresAt: number } | null = null

function rememberVoiceCapabilities(key: string, read: Promise<VoiceCapabilities>): void {
    if (read === voiceCapabilitiesLatestRead) return
    voiceCapabilitiesLatestRead = read
    read.then(
        (value) => {
            if (voiceCapabilitiesLatestRead === read) voiceCapabilitiesSnapshot = { key, value, expiresAt: Date.now() + VOICE_CAPABILITIES_TTL_MS }
        },
        () => {
            if (voiceCapabilitiesLatestRead === read) voiceCapabilitiesSnapshot = null
        },
    )
}

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

/**
 * A named workspace contract error (`{detail: {code}}`, document 15 Error
 * contract). Thrown by every route, so UI can branch on `code` — e.g.
 * `WORKSPACE_ARCHIVED` → read-only notice, `*_VERSION_CONFLICT` → reload and
 * retry, `COPY_LIMIT_EXCEEDED` → explain the limit. Still an `ApiError`.
 */
export class WorkspaceApiError extends ApiError {
    declare readonly code: WorkspaceErrorCode

    constructor(status: number, message: string, metadata: Partial<Pick<ApiError, 'category' | 'requestId' | 'retryable' | 'retryAfterSeconds' | 'action' | 'details'>> & { code: WorkspaceErrorCode }) {
        super(status, message, metadata)
        this.name = 'WorkspaceApiError'
    }
}

export function isWorkspaceApiError(error: unknown, code?: WorkspaceErrorCode): error is WorkspaceApiError {
    return error instanceof WorkspaceApiError && (code === undefined || error.code === code)
}

/** Window event dispatched when any response says `WORKSPACE_REQUIRED` (a stale client build). */
export const WORKSPACE_REQUIRED_EVENT = 'workspace:required'

/**
 * HTTP 428 `attestation_required` (D26): the account has not accepted the
 * current 18+ or Terms of Service version. Voice consent and the recipe
 * preview answer it (13 §3.2). `AttestationProvider.withAttestation` opens the
 * blocking prompt and retries the request once after the user attests.
 */
export class AttestationRequiredError extends ApiError {
    constructor(status: number, message: string, metadata: Partial<Pick<ApiError, 'category' | 'code' | 'requestId' | 'retryable' | 'retryAfterSeconds' | 'action' | 'details'>> = {}) {
        super(status, message, { ...metadata, code: metadata.code ?? 'attestation_required', action: metadata.action ?? 'attest' })
        this.name = 'AttestationRequiredError'
    }
}

export function isAttestationRequiredError(error: unknown): error is AttestationRequiredError {
    return error instanceof AttestationRequiredError
}

/** Window event dispatched for every 428 `attestation_required`, so the prompt opens wherever it came from. */
export const ATTESTATION_REQUIRED_EVENT = 'attestation:required'

/**
 * The immutable workspace selector a scoped client captured. It is sent on
 * every private REST/SSE/blob request of that client, including the replay
 * after an auth refresh; the singleton itself never holds one.
 */
export interface WorkspaceRequestScope {
    readonly workspaceId: string
    readonly initialCollectionIds: readonly string[]
}

let workspaceWritesBlocked = false

/**
 * Once this tab is known to run a stale build (a newer workspace contract or a
 * `WORKSPACE_REQUIRED` response), every private write — scoped-client and
 * `/workspaces` mutations — is refused locally until reload (document 08:
 * "block private writes"). Reads, auth and account routes keep working.
 */
export function setWorkspaceWritesBlocked(blocked: boolean): void {
    workspaceWritesBlocked = blocked
}

export function areWorkspaceWritesBlocked(): boolean {
    return workspaceWritesBlocked
}

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function blockedWorkspaceWriteError(): ApiError {
    return new ApiError(409, 'This page is out of date. Reload to continue.', {
        category: 'client_stale', code: 'workspace_client_stale', retryable: false,
    })
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

/** `/user/preferences` as served: a server before R0 sends no `narration_tier`. */
type UserPreferencesWire = Omit<UserPreferences, 'narration_tier'> & { narration_tier?: unknown }

/** A server before R0 sends no `narration_tier`: it reads as the D05 default, `standard`. */
function withNarrationTier(preferences: UserPreferencesWire): UserPreferences {
    const tier = preferences?.narration_tier
    return { ...preferences, narration_tier: tier === 'standard' || tier === 'expressive' ? tier : DEFAULT_NARRATION_TIER }
}

type ApiRequestOptions = RequestInit & {
    timeoutMs?: number
    rejectAccepted?: boolean
    /** Workspace routes select by path; they never carry the scoped client's header. */
    omitWorkspaceScope?: boolean
    /** Observe the final response (after any auth replay) for its status and headers. */
    onResponse?: (response: Response) => void
}

type HeaderRecord = Record<string, string>

type AuthRequestOwner = Pick<AuthSessionSnapshot, 'authEpoch' | 'accountKey' | 'userHash'> & {
    token: string
}

/** Session kinds whose assistant messages carry chat images. */
export type ChatImageBasePath = 'adventure-sessions' | 'character-chats'

/**
 * The chat image endpoints do not exist on this server (it predates them): a
 * plain 404/405 from the router rather than a coded error. Callers hide
 * regenerate instead of reporting a failure.
 */
export class ChatImagesUnsupportedError extends ApiError {
    constructor(status: number) {
        super(status, 'Chat images are not available on this server.', { code: 'CHAT_IMAGES_UNSUPPORTED' })
        this.name = 'ChatImagesUnsupportedError'
    }
}

function chatMessageImagesPath(basePath: ChatImageBasePath, sessionId: number, messageId: number): string {
    return `/${basePath}/${sessionId}/messages/${messageId}/images`
}

async function chatImagesRequest<T>(run: () => Promise<T>): Promise<T> {
    try {
        return await run()
    } catch (error) {
        if (error instanceof ApiError && !error.code && (error.status === 404 || error.status === 405)) throw new ChatImagesUnsupportedError(error.status)
        throw error
    }
}

function isChatImageGenerationWire(value: unknown): value is ChatImageGeneration {
    if (!value || typeof value !== 'object') return false
    const row = value as Record<string, unknown>
    return typeof row.job_id === 'string' && row.job_id.length > 0 && typeof row.status === 'string'
}

class ApiService {
    private baseUrl: string
    private readonly libraryPages = new AvailableLibraryPages()
    /**
     * The captured workspace of a scoped client from {@link withWorkspace};
     * always `null` on the exported singleton (document 15: the singleton never
     * stores a mutable active workspace).
     */
    readonly workspaceScope: WorkspaceRequestScope | null = null

    /**
     * A client whose private REST, SSE and blob requests carry `X-Workspace-Id`
     * (and `X-Initial-Collection-Ids` when given). It shares the singleton's
     * auth, refresh and LLM-intent state — only the frozen scope differs — and
     * an auth refresh replays the request with the same captured headers.
     *
     *     const api = apiService.withWorkspace(workspaceId)
     *     const characters = await api.getCharacters()
     *     const created = await apiService
     *         .withWorkspace(workspaceId, { initialCollectionIds: [collectionId] })
     *         .createCharacter(payload)
     *
     * Workspace management routes (`/workspaces/...`) select by path and never
     * send the header, so call them on either client.
     */
    withWorkspace(workspaceId: string, options: WorkspaceScopeOptions = {}): ApiService {
        if (!isWorkspaceUuid(workspaceId)) throw new Error('A workspace scope needs a lowercase workspace UUID.')
        const scope: WorkspaceRequestScope = Object.freeze({
            workspaceId,
            initialCollectionIds: canonicalInitialCollectionIds(options.initialCollectionIds),
        })
        // Scopes never stack: a facade's prototype is always the unscoped singleton.
        const root: ApiService = this.workspaceScope ? Object.getPrototypeOf(this) as ApiService : this
        const scoped = Object.create(root) as ApiService
        Object.defineProperty(scoped, 'workspaceScope', { value: scope, enumerable: true, writable: false, configurable: false })
        Object.freeze(scoped)
        return scoped
    }

    /** The captured selector headers; empty on the unscoped singleton. */
    private workspaceHeaders(): HeaderRecord {
        const scope = this.workspaceScope
        if (!scope) return {}
        return {
            'X-Workspace-Id': scope.workspaceId,
            ...(scope.initialCollectionIds.length ? { 'X-Initial-Collection-Ids': scope.initialCollectionIds.join(',') } : {}),
        }
    }

    /** One error shape for every transport; a stale build is announced once per response. */
    private responseError(status: number, parsed: ParsedApiError): ApiError {
        if (parsed.code?.startsWith('FEATURE_FLAG_')) {
            featureFlagRuntime.invalidate()
            window.dispatchEvent(new Event('feature-flags:invalidate'))
        }
        if (parsed.code === 'WORKSPACE_REQUIRED' && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(WORKSPACE_REQUIRED_EVENT))
        }
        if (status === 428 || parsed.code === 'attestation_required') {
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ATTESTATION_REQUIRED_EVENT))
            return new AttestationRequiredError(status, parsed.message, parsed)
        }
        return isWorkspaceErrorCode(parsed.code)
            ? new WorkspaceApiError(status, parsed.message, { ...parsed, code: parsed.code })
            : new ApiError(status, parsed.message, parsed)
    }

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

    async getLlmFeatures(): Promise<{ features: LlmFeatureView[] }> {
        const result = await this.profileRequest<{ features: LlmFeatureView[] }>('/llm/features')
        return { ...result, features: result.features.filter(feature => isLlmFeatureEnabled(feature.feature_key)) }
    }

    getLlmModels(params: { feature?: LlmFeature; provider_target?: string; role?: string; credential_mode?: string; limit?: number; offset?: number } = {}): Promise<LlmPage<LlmCatalogModel>> {
        if (params.feature) assertLlmFeatureEnabled(params.feature)
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
        assertLlmFeatureEnabled(feature)
        const result = await this.profileRequest<EffectiveLlmProfile>(`/llm/features/${encodeURIComponent(feature)}/resolve`, 'POST', selection)
        assertEffectiveLlmProfile(result)
        return result
    }

    async getLlmRetryProfile(feature: LlmFeature, executionId: string): Promise<EffectiveLlmProfile> {
        assertLlmFeatureEnabled(feature)
        const result = await this.profileRequest<EffectiveLlmProfile>(`/llm/features/${encodeURIComponent(feature)}/retry-profiles/${encodeURIComponent(executionId)}`)
        assertEffectiveLlmProfile(result)
        return result
    }

    async getLlmRecoveryProfile(feature: LlmFeature, requestId: string, signal?: AbortSignal): Promise<EffectiveLlmProfile> {
        assertLlmFeatureEnabled(feature)
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
        assertLlmFeatureEnabled(feature)
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
        assertLlmFeatureEnabled(feature)
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
        assertFeatureEnabled('communityCards')
    }

    /** Card assistants are always on; lorebook and app assistants follow their feature flags. */
    private assistantKindEnabled(kind: AssistantKind): boolean {
        if (kind === 'lorebook') return isLorebooksFeatureEnabled()
        if (kind === 'app') return isAppAssistantFeatureEnabled()
        if (kind === 'novel') return isNovelsFeatureEnabled()
        return true
    }

    private assertAssistantKindEnabled(kind: AssistantKind) {
        if (kind === 'lorebook') this.assertLorebooksEnabled()
        if (kind === 'app') assertFeatureEnabled('appAssistant')
        if (kind === 'novel') this.assertNovelsEnabled()
    }

    private assertLorebooksEnabled() {
        assertFeatureEnabled('lorebooks')
    }

    private assertLorebookResourcesEnabled() {
        assertFeatureEnabled('lorebookResources')
    }

    private assertVoicesEnabled() {
        assertFeatureEnabled('voices')
    }

    private assertCallsEnabled() {
        assertFeatureEnabled('calls')
    }

    private assertNovelsEnabled() {
        assertFeatureEnabled('novels')
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
        const { timeoutMs, rejectAccepted, omitWorkspaceScope, onResponse, ...fetchOptions } = options
        const changesContent = !SAFE_HTTP_METHODS.has((fetchOptions.method ?? 'GET').toUpperCase())
        if (changesContent) this.libraryPages.clear()
        if (workspaceWritesBlocked && !SAFE_HTTP_METHODS.has((fetchOptions.method ?? 'GET').toUpperCase())
            && (this.workspaceScope !== null || endpoint.startsWith('/workspaces'))) {
            throw blockedWorkspaceWriteError()
        }

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
        // The captured workspace selector rides in `config.headers`, so every
        // auth replay below (withAuthorization keeps the headers) re-sends it.
        const headers: HeaderRecord = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            'Accept': 'application/json',
            'X-MW-Voice-Contract': '5',
            ...this.toHeaderRecord(fetchOptions.headers),
            ...(omitWorkspaceScope ? {} : this.workspaceHeaders()),
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

            onResponse?.(response)

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
                throw this.responseError(response.status, parsed)
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
            if (changesContent) this.libraryPages.clear()
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
        const scopeHeaders = this.workspaceHeaders()
        const fetchOnce = (token: string) => fetch(url, {
            method: 'GET',
            headers: {
                Accept: accept,
                ...scopeHeaders,
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
            throw this.responseError(response.status, { ...parsed, message: parsed.message || errorMessage })
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
        if (!verifyCardGeneration(value, requestId, this.workspaceScope?.workspaceId)) {
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
                if (options.onEvent) {
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
        assertLlmFeatureEnabled(feature)
        const owner = authSession.getSnapshot()
        // Workspace R1: retained retry/recovery profile reads ride this client's captured origin.
        const origin = this.workspaceScope?.workspaceId
        let llm = llmIntents.retained(feature, requestId) ?? await (supplied?.retry_of_execution_id
            ? prepareRetainedLlmRequest(feature, supplied, signal, undefined, origin) : prepareLlmRequest(feature, supplied, signal, undefined, origin))
        this.assertCurrentOwner(owner)
        llmIntents.retain(feature, requestId, llm)
        try {
            let value: T
            try {
                value = await send(llm)
            } catch (error) {
                if (!(error instanceof ApiError) || error.code !== 'BYOK_CREDENTIAL_REQUIRED' || llm.credentials || !llm.expected_revision_id) throw error
                const target = llm
                llm = await prepareRetainedLlmRequest(feature, target, signal, requestId, origin)
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
        if (workspaceWritesBlocked && this.workspaceScope !== null) throw blockedWorkspaceWriteError()
        this.libraryPages.clear()
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
                ...this.workspaceHeaders(),
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
                throw this.responseError(response.status, parsed)
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
            this.libraryPages.clear()
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

    // --- Workspaces (R1, document 15) ---------------------------------------------------
    // Every `/workspaces/...` route selects by path (or carries no selector), so
    // these never send a scoped client's `X-Workspace-Id`. Responses are checked
    // against the strict DTOs; named failures surface as WorkspaceApiError.

    private workspaceRequest<T>(endpoint: string, init: {
        method?: string
        body?: unknown
        version?: number
        signal?: AbortSignal
        onResponse?: (response: Response) => void
    } = {}): Promise<T> {
        if (init.version !== undefined && (!Number.isSafeInteger(init.version) || init.version < 1)) {
            throw new Error('Workspace and collection versions are positive integers.')
        }
        return this.authenticatedRequest<T>(endpoint, this.getStoredToken(), {
            method: init.method ?? 'GET',
            cache: 'no-store',
            omitWorkspaceScope: true,
            headers: init.version === undefined ? {} : { 'If-Match': `"${init.version}"` },
            ...(init.body === undefined ? {} : { body: init.body as BodyInit }),
            ...(init.signal ? { signal: init.signal } : {}),
            ...(init.onResponse ? { onResponse: init.onResponse } : {}),
        })
    }

    private workspacePath(workspaceId: string, suffix = ''): string {
        if (!isWorkspaceUuid(workspaceId)) throw new Error('Workspace IDs are lowercase UUIDs.')
        return `/workspaces/${workspaceId}${suffix}`
    }

    private collectionPath(workspaceId: string, collectionId: string, suffix = ''): string {
        if (!isWorkspaceUuid(collectionId)) throw new Error('Collection IDs are lowercase UUIDs.')
        return this.workspacePath(workspaceId, `/collections/${collectionId}${suffix}`)
    }

    private assertWorkspaceContract(valid: boolean, what: string): void {
        if (!valid) {
            throw new ApiError(502, `The ${what} response did not match the workspace contract.`, {
                category: 'upstream_contract', code: 'workspace_contract', retryable: false,
            })
        }
    }

    /**
     * Startup handshake step 1 (no selector). Returns the raw body; classify it
     * with `classifyWorkspaceCapabilities` — a newer contract must not be
     * rejected here because it means this build is stale, not that the API is.
     */
    async getWorkspaceCapabilities(options: { signal?: AbortSignal } = {}): Promise<Record<string, unknown>> {
        const value = await this.workspaceRequest<unknown>('/workspaces/capabilities', { signal: options.signal })
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    }

    /** Startup handshake step 2 (no selector): the protected default first, then created_at/id. */
    async listWorkspaces(options: { includeArchived?: boolean; signal?: AbortSignal } = {}): Promise<WorkspaceList> {
        const value = await this.workspaceRequest<unknown>(`/workspaces${options.includeArchived ? '?include_archived=true' : ''}`,
            { signal: options.signal })
        this.assertWorkspaceContract(verifyWorkspaceList(value)
            && (options.includeArchived === true || value.items.every((workspace) => workspace.archived_at === null)), 'workspace list')
        return value as WorkspaceList
    }

    async getWorkspace(workspaceId: string): Promise<Workspace> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId))
        this.assertWorkspaceContract(verifyWorkspace(value) && value.id === workspaceId, 'workspace')
        return value as Workspace
    }

    async createWorkspace(body: WorkspaceCreate): Promise<Workspace> {
        const value = await this.workspaceRequest<unknown>('/workspaces', { method: 'POST', body })
        this.assertWorkspaceContract(verifyWorkspace(value), 'workspace')
        return value as Workspace
    }

    /** `version` is the workspace's current `row_version` (sent as `If-Match`); a stale one is `WORKSPACE_VERSION_CONFLICT`. */
    async updateWorkspace(workspaceId: string, version: number, patch: WorkspaceUpdate): Promise<Workspace> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId), { method: 'PATCH', body: patch, version })
        this.assertWorkspaceContract(verifyWorkspace(value) && value.id === workspaceId, 'workspace')
        return value as Workspace
    }

    /** The default is `WORKSPACE_DEFAULT_PROTECTED`; a live call is `WORKSPACE_ACTIVE_CALL`. Replaying with the current version is a no-op. */
    async archiveWorkspace(workspaceId: string, version: number): Promise<Workspace> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, '/archive'), { method: 'POST', body: {}, version })
        this.assertWorkspaceContract(verifyWorkspace(value) && value.id === workspaceId, 'workspace')
        return value as Workspace
    }

    async restoreWorkspace(workspaceId: string, version: number): Promise<Workspace> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, '/restore'), { method: 'POST', body: {}, version })
        this.assertWorkspaceContract(verifyWorkspace(value) && value.id === workspaceId, 'workspace')
        return value as Workspace
    }

    async listCollections(workspaceId: string): Promise<CollectionList> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, '/collections'))
        this.assertWorkspaceContract(verifyCollectionList(value, workspaceId), 'collection list')
        return value as CollectionList
    }

    async getCollection(workspaceId: string, collectionId: string): Promise<Collection> {
        const value = await this.workspaceRequest<unknown>(this.collectionPath(workspaceId, collectionId))
        this.assertWorkspaceContract(verifyCollection(value, workspaceId) && value.id === collectionId, 'collection')
        return value as Collection
    }

    async createCollection(workspaceId: string, body: CollectionCreate): Promise<Collection> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, '/collections'), { method: 'POST', body })
        this.assertWorkspaceContract(verifyCollection(value, workspaceId), 'collection')
        return value as Collection
    }

    async updateCollection(workspaceId: string, collectionId: string, version: number, patch: CollectionUpdate): Promise<Collection> {
        const value = await this.workspaceRequest<unknown>(this.collectionPath(workspaceId, collectionId), { method: 'PATCH', body: patch, version })
        this.assertWorkspaceContract(verifyCollection(value, workspaceId) && value.id === collectionId, 'collection')
        return value as Collection
    }

    /** Deleting a collection keeps its cards (204). */
    async deleteCollection(workspaceId: string, collectionId: string, version: number): Promise<void> {
        await this.workspaceRequest<void>(this.collectionPath(workspaceId, collectionId), { method: 'DELETE', version })
    }

    /** A set operation: already present/absent memberships count as `unchanged`. */
    async setCollectionMembers(workspaceId: string, collectionId: string, command: MembershipCommand): Promise<MembershipResult> {
        const value = await this.workspaceRequest<unknown>(this.collectionPath(workspaceId, collectionId, '/members'), {
            method: 'PUT', body: { add: command.add ?? [], remove: command.remove ?? [] },
        })
        this.assertWorkspaceContract(verifyMembershipResult(value, collectionId), 'membership')
        return value as MembershipResult
    }

    /** Mixed-type library page (`creation_at DESC, card_id DESC`); refresh from offset 0 after list-changing commands. */
    async listLibraryCards(workspaceId: string, query: LibraryQuery = {}, options: { signal?: AbortSignal } = {}): Promise<LibraryPage> {
        if (query.collection_id !== undefined && query.uncollected) throw new Error('Collection and uncollected filters are exclusive.')
        if (query.character_role !== undefined && query.card_type !== 'character') throw new Error('A character role needs the character card type.')
        const owner = authSession.getSnapshot()
        const scope = JSON.stringify([owner.authEpoch, owner.accountKey, workspaceId])
        return this.libraryPages.read((pageQuery) => this.listLibraryCardsPage(workspaceId, pageQuery, options), query, scope, options.signal)
    }

    private async listLibraryCardsPage(workspaceId: string, query: LibraryQuery, options: { signal?: AbortSignal }): Promise<LibraryPage> {
        const params = new URLSearchParams()
        if (query.card_type) params.set('card_type', query.card_type)
        if (query.character_role) params.set('character_role', query.character_role)
        if (query.q?.trim()) params.set('q', query.q.trim())
        if (query.collection_id) params.set('collection_id', query.collection_id)
        if (query.uncollected) params.set('uncollected', 'true')
        if (query.limit !== undefined) params.set('limit', String(query.limit))
        if (query.offset !== undefined) params.set('offset', String(query.offset))
        const search = params.toString()
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, `/cards${search ? `?${search}` : ''}`),
            { signal: options.signal })
        this.assertWorkspaceContract(verifyLibraryPage(value, workspaceId), 'library')
        return value as LibraryPage
    }

    async getCardSourceStatuses(workspaceId: string, cards: readonly CardIdentity[], signal?: AbortSignal): Promise<CardSourceStatusList> {
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, '/cards/source-status'), {
            method: 'POST', body: { cards }, signal,
        })
        if (!isCardSourceStatusList(value, cards)) throw new Error('Invalid card source status response')
        return value
    }

    async listWorkspaceMedia(workspaceId: string, query: WorkspaceMediaQuery = {}, options: { signal?: AbortSignal } = {}): Promise<WorkspaceMediaPage> {
        const mediaKind = query.media_kind ?? 'image'
        const params = new URLSearchParams({ media_kind: mediaKind })
        if (query.limit !== undefined) params.set('limit', String(query.limit))
        if (query.offset !== undefined) params.set('offset', String(query.offset))
        const value = await this.workspaceRequest<unknown>(this.workspacePath(workspaceId, `/media?${params.toString()}`),
            { signal: options.signal })
        this.assertWorkspaceContract(verifyWorkspaceMediaPage(value, workspaceId, mediaKind), 'workspace media')
        return value as WorkspaceMediaPage
    }

    /**
     * All-or-nothing synchronous copy into `destinationId`. Reuse the same
     * `request_id` for Try again after an error or uncertain response (a copy
     * that did succeed comes back with `replayed: true`); mint a new one for
     * Copy again or any change of cards, destination or collections.
     */
    async copyCardsToWorkspace(destinationId: string, command: CopyCommand): Promise<CopyOutcome> {
        const cardKeys = command.cards.map((card) => `${card.card_type}:${card.card_id}`)
        if (!isCopyRequestId(command.request_id)) throw new Error('Copy request IDs match [A-Za-z0-9._:-]{1,64}.')
        if (!isWorkspaceUuid(command.source_workspace_id)) throw new Error('The copy source must be a workspace UUID.')
        if (cardKeys.length < 1 || cardKeys.length > MAX_COPY_CARDS || new Set(cardKeys).size !== cardKeys.length) {
            throw new Error(`Copy accepts 1-${MAX_COPY_CARDS} distinct cards.`)
        }
        const collections = canonicalInitialCollectionIds(command.destination_collection_ids)
        let status = 0
        const value = await this.workspaceRequest<unknown>(this.workspacePath(destinationId, '/copy-cards'), {
            method: 'POST',
            body: {
                request_id: command.request_id,
                source_workspace_id: command.source_workspace_id,
                cards: command.cards.map(({ card_type, card_id }) => ({ card_type, card_id })),
                destination_collection_ids: [...collections],
            },
            onResponse: (response) => { status = response.status },
        })
        this.assertWorkspaceContract(verifyCopyResult(value, command.request_id, destinationId)
            && value.source_workspace_id === command.source_workspace_id && (status === 200 || status === 201), 'copy')
        return { result: value as CopyOutcome['result'], replayed: status === 200 }
    }

    /** Owned lookup of a legacy link or origin target: which workspace holds it and whether it is archived. */
    async resolveContent(query: ContentResolveQuery): Promise<ContentResolution> {
        if (query.card_type !== undefined && query.kind !== 'card') throw new Error('Only cards take a card type.')
        const params = new URLSearchParams({ kind: query.kind, id: query.id })
        if (query.card_type) params.set('card_type', query.card_type)
        const value = await this.workspaceRequest<unknown>(`/workspaces/resolve-content?${params.toString()}`)
        this.assertWorkspaceContract(verifyContentResolution(value, query.kind, query.id), 'content resolution')
        return value as ContentResolution
    }

    /**
     * Fetch the current user's profile (`GET /user/me`): identity, role, usage
     * quota, and per-type counts of authored cards. Read-only on this API.
     * Account scope (09 §2.1): never carries a workspace selector, even on a
     * scoped client.
     */
    async getUserProfile(): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me', token, {
            method: 'GET',
            omitWorkspaceScope: true,
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

    /**
     * Select one of the user's pre-generated avatar variants (`PUT /user/me/avatar`).
     * Returns the refreshed `UserProfile` with updated `avatar_url` and `active_avatar_variant`.
     */
    async updateAvatarVariant(variant: AvatarVariantId): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me/avatar', token, {
            method: 'PUT',
            omitWorkspaceScope: true,
            body: { variant } as unknown as BodyInit,
        })
    }

    async getUserPreferences(): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return withNarrationTier(await this.authenticatedRequest<UserPreferencesWire>('/user/preferences', token, {
            method: 'GET',
        }))
    }

    /** Partial update (08 §5.2): only the fields present are sent and written. */
    async updateUserPreferences(body: UserPreferencesUpdate): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return withNarrationTier(await this.authenticatedRequest<UserPreferencesWire>('/user/preferences', token, {
            method: 'PATCH',
            body: body as unknown as BodyInit,
        }))
    }

    /**
     * The account's attestation status (D26): the current version required per
     * kind and what the account accepted (`GET /user/attestations`, a proposal
     * of 08 §5.1). Account scope: never carries a workspace selector. A 404
     * means the route is not deployed yet; callers must not block on it.
     */
    async getAttestationStatus(): Promise<AttestationStatus> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AttestationStatus>('/user/attestations', token, {
            method: 'GET',
            cache: 'no-store',
            omitWorkspaceScope: true,
        })
    }

    /**
     * Records attestations (`POST /user/attestations`). 08 §5.1 takes one
     * `{kind, version, method}` per request and answers 201 `{kind, version,
     * accepted_at}` (409 on a stale version), so each item is posted in turn.
     */
    async submitAttestations(items: AttestationRequirement[], method: AttestationMethod): Promise<AttestationRecord[]> {
        const token = this.getStoredToken()
        const records: AttestationRecord[] = []
        for (const item of items) {
            const body: AttestationSubmission = { kind: item.kind, version: item.version, method }
            records.push(await this.authenticatedRequest<AttestationRecord>('/user/attestations', token, {
                method: 'POST',
                body: body as unknown as BodyInit,
                omitWorkspaceScope: true,
            }))
        }
        return records
    }

    // --- User voice catalog and capabilities (D13, D35; 08 §5.1) --------------
    // Account scope: no workspace selector, except `recommended_for` an owned card,
    // which the caller sends through that card's workspace client (08 §5.1).

    /**
     * Controls, ranges, defaults, text limits and health per surface and tier
     * (`GET /voices/capabilities`), mapped to the 09 §1.5 view model by
     * `toVoiceCapabilities`. Shared for 60 s per account (09 §7); `fresh` skips
     * the cache. A body that is not a capabilities object rejects.
     */
    async getVoiceCapabilities(options: { fresh?: boolean } = {}): Promise<VoiceCapabilities> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const read = cachedVoiceCapabilities(`voice-v3:${token}`, async () => {
            const raw = await this.authenticatedRequest<unknown>('/voices/capabilities', token, {
                method: 'GET',
                omitWorkspaceScope: true,
            })
            const capabilities = toVoiceCapabilities(raw)
            if (!capabilities) throw new ApiError(502, 'The voice capabilities response was not recognised.')
            return capabilities
        }, options)
        rememberVoiceCapabilities(token, read)
        return read
    }

    /**
     * This account's last capabilities read, synchronously, while it is within the
     * 60 s cache lifetime; otherwise null (never a request). Lets a voice surface
     * render its settled state on its first frame when the cache is warm.
     */
    peekVoiceCapabilities(): VoiceCapabilities | null {
        const snapshot = voiceCapabilitiesSnapshot
        if (!snapshot || snapshot.key !== this.getStoredToken() || snapshot.expiresAt <= Date.now()) return null
        return snapshot.value
    }

    /** One page of the user catalog (`GET /voices/catalog`); `cursor` is the previous page's `next_cursor`. */
    async listVoiceCatalog(filters: CatalogQuery = {}, cursor?: string | null, options: { signal?: AbortSignal } = {}): Promise<CatalogPage> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const raw = await this.authenticatedRequest<unknown>(`/voices/catalog${catalogQueryString(filters, cursor)}`, token, {
            method: 'GET',
            omitWorkspaceScope: !filters.recommended_for?.trim(),
            ...(options.signal ? { signal: options.signal } : {}),
        })
        return toCatalogPage(raw)
    }

    /**
     * Batch lookup for badges (`GET /voices/catalog?keys=`, ≤ 100 per request):
     * includes non-public voices the caller references. Blank and repeated keys
     * are dropped; more than 100 keys go out in several requests.
     */
    async getVoiceCatalogByKeys(keys: readonly string[]): Promise<CatalogVoice[]> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const items: CatalogVoice[] = []
        for (const batch of catalogKeyBatches(keys)) {
            const query = new URLSearchParams({ keys: batch.join(',') })
            const raw = await this.authenticatedRequest<unknown>(`/voices/catalog?${query.toString()}`, token, {
                method: 'GET',
                omitWorkspaceScope: true,
            })
            items.push(...toCatalogItems(raw))
        }
        return items
    }

    /**
     * What the caller hears for each voice path of one document (`GET
     * /voices/effective`, D35). A `preset` ref is account level; every other
     * ref must be called on the document's `withWorkspace(id)` client (422
     * without the selector, 404 elsewhere).
     */
    async getEffectiveVoice(refType: EffectiveVoiceRefType, refId: string): Promise<EffectiveVoiceResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const query = new URLSearchParams({ ref_type: refType, ref_id: refId })
        return this.authenticatedRequest<EffectiveVoiceResponse>(`/voices/effective?${query.toString()}`, token, {
            method: 'GET',
            omitWorkspaceScope: refType === 'preset',
        })
    }

    // --- Minor reports (R2-BE-02, EP-10) -------------------------------------
    // Account scope. While the feature is closed, the status reads `enabled:
    // false` and the POST answers 404 as if the route did not exist (I-16).

    async getMinorReportStatus(): Promise<MinorReportStatus> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<MinorReportStatus>('/reports/minor/status', token, {
            method: 'GET',
            cache: 'no-store',
            omitWorkspaceScope: true,
        })
    }

    /** 202 `{report_id, received: true}`; 429 `minor_report_limit`, 403 `minor_report_disabled`, 404 when closed. */
    async submitMinorReport(body: MinorReportInput): Promise<MinorReportAccepted> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<MinorReportAccepted>('/reports/minor', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
            omitWorkspaceScope: true,
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

    // --- Root voice console (D20; routes from 08 §5.3) -------------------------
    // Account-level: the unscoped singleton, no workspace selector (D39). Audio
    // comes back as `audio/*` bytes (`adminVoiceAudio`) or base64, never hex.

    private adminVoiceQuery(params: object = {}): string {
        const search = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue
            search.set(key, String(value))
        }
        const query = search.toString()
        return query ? `?${query}` : ''
    }

    private async adminVoiceRequest<T>(path: string, method = 'GET', payload?: unknown, signal?: AbortSignal): Promise<T> {
        this.assertVoicesEnabled()
        return this.authenticatedRequest<T>(path, this.getStoredToken(), {
            method,
            signal,
            omitWorkspaceScope: true,
            ...(payload === undefined ? {} : { body: payload as BodyInit }),
        })
    }

    /**
     * POST that answers audio: the auth replay and error mapping of `request`, the bytes as a Blob.
     * A 2xx without an `audio/*` body is refused (502 `unexpected_audio_response`), so a JSON or
     * HTML answer never reaches a player.
     */
    private async adminVoiceAudio(path: string, payload: unknown, signal?: AbortSignal): Promise<AdminLabSynthesisResult> {
        this.assertVoicesEnabled()
        let received: Response | null = null
        await this.request<string>(path, {
            method: 'POST',
            signal,
            omitWorkspaceScope: true,
            body: payload as BodyInit,
            // §2.9: the lab answers any audio container (mp3, pcm, opus…).
            headers: { Accept: 'audio/*', Authorization: `Bearer ${this.getStoredToken()}` },
            onResponse: (response) => {
                if (response.ok) received = response.clone()
            },
        }, false)
        const response = received as Response | null
        const noAudio = () => new ApiError(502, 'The voice service returned no audio.', { code: 'unexpected_audio_response' })
        if (!response) throw noAudio()
        const contentType = response.headers.get('content-type')?.trim() ?? ''
        // I-14: provider-neutral headers only (the provider's names stay inside the BFF adapter).
        const requestId = response.headers.get('X-Voice-Request-Id')?.trim() || null
        if (/^audio\//i.test(contentType)) {
            const costHeader = response.headers.get('X-Voice-Character-Cost')?.trim() ?? ''
            const blob = await response.blob()
            return { blob, content_type: contentType, request_id: requestId, character_cost: /^\d+$/.test(costHeader) ? Number(costHeader) : null }
        }
        throw noAudio()
    }

    private adminVoiceKeyPath(voiceKey: string): string {
        return `/admin/voices/catalog/${encodeURIComponent(voiceKey)}`
    }

    async listAdminCatalog(query: AdminCatalogQuery = {}, signal?: AbortSignal): Promise<AdminCatalogPage> {
        return this.adminVoiceRequest(`/admin/voices/catalog${this.adminVoiceQuery(query)}`, 'GET', undefined, signal)
    }

    async getFishInventory(): Promise<import('@/shared').FishInventoryResponse> {
        return this.adminVoiceRequest('/admin/voices/fish/inventory', 'GET')
    }

    async getFishReferences(language: string, query = '', page = 1): Promise<import('@/shared').FishReferencePage> {
        const params = new URLSearchParams({ language, page: String(page) })
        if (query.trim()) params.set('q', query.trim())
        return this.adminVoiceRequest(`/admin/voices/fish/references?${params}`, 'GET')
    }

    async getFishDesignCapabilities(signal?: AbortSignal): Promise<import('@/shared').FishDesignCapabilities> {
        return this.adminVoiceRequest('/admin/voices/fish/design/capabilities', 'GET', undefined, signal)
    }

    async designFishVoice(body: import('@/shared').FishDesignRequest, signal?: AbortSignal): Promise<import('@/shared').VoiceDesignResponse> {
        return this.adminVoiceRequest('/admin/voices/fish/design', 'POST', body, signal)
    }

    async saveFishDesign(body: import('@/shared').VoiceDesignSaveRequest): Promise<import('@/shared').AdminCatalogVoice> {
        return this.adminVoiceRequest('/admin/voices/fish/design/save', 'POST', body)
    }

    async importFishReference(body: import('@/shared').FishReferenceImport): Promise<{ voice_key: string }> {
        return this.adminVoiceRequest('/admin/voices/fish/import', 'POST', body)
    }

    /**
     * `repointDependentsTo` answers a 409 `voice_is_replacement`: the same change,
     * with the dependent voices moved to that replacement in one transaction (I-34).
     */
    async updateAdminCatalogVoice(voiceKey: string, body: AdminCatalogUpdate, options: AdminCatalogUpdateOptions = {}): Promise<AdminCatalogVoice> {
        const query = this.adminVoiceQuery({ repoint_dependents_to: options.repointDependentsTo })
        return this.adminVoiceRequest(`${this.adminVoiceKeyPath(voiceKey)}${query}`, 'PATCH', body)
    }

    async getAdminCatalogImpact(voiceKey: string, signal?: AbortSignal): Promise<AdminCatalogImpact> {
        return this.adminVoiceRequest(`${this.adminVoiceKeyPath(voiceKey)}/impact`, 'GET', undefined, signal)
    }

    async syncAdminCatalog(body: AdminVoiceSyncRequest): Promise<AdminVoiceSyncResponse> {
        return this.adminVoiceRequest('/admin/voices/sync', 'POST', body)
    }

    /** Two-step provider delete (D19): call without a token for the challenge, then again with it. */
    async deleteAdminCatalogVoice(voiceKey: string, confirmToken?: string): Promise<AdminCatalogDeleteResponse> {
        return this.adminVoiceRequest(`${this.adminVoiceKeyPath(voiceKey)}${this.adminVoiceQuery({ confirm_token: confirmToken })}`, 'DELETE')
    }

    async renderAcceptance(body: AcceptanceRenderRequest, signal?: AbortSignal): Promise<AcceptanceRenderResponse> {
        return this.adminVoiceRequest('/admin/voices/acceptance/renders', 'POST', body, signal)
    }

    async putAcceptanceVerdict(voiceKey: string, modelId: string, language: string, body: AcceptanceVerdictRequest): Promise<AcceptanceVerdictResponse> {
        const path = `/admin/voices/acceptance/${encodeURIComponent(voiceKey)}/${encodeURIComponent(modelId)}/${encodeURIComponent(language)}`
        return this.adminVoiceRequest(path, 'PUT', body)
    }

    async renderCatalogSamples(voiceKey: string, body: CatalogSampleRenderRequest = {}): Promise<CatalogSampleRenderResponse> {
        return this.adminVoiceRequest(`${this.adminVoiceKeyPath(voiceKey)}/samples`, 'POST', body)
    }

    async getVoiceDefaults(signal?: AbortSignal): Promise<VoiceDefaultsResponse> {
        return this.adminVoiceRequest('/admin/voices/defaults', 'GET', undefined, signal)
    }

    async putVoiceDefaults(role: VoiceDefaultRole, language: string, voiceKeys: string[]): Promise<VoiceDefaultsUpdateResponse> {
        const path = `/admin/voices/defaults/${encodeURIComponent(role)}/${encodeURIComponent(language)}`
        return this.adminVoiceRequest(path, 'PUT', { voice_keys: voiceKeys })
    }

    /** Live Library browse. The D09 filters are always sent (AC-R6) and re-enforced by the BFF. */
    async listAdminLibrary(query: LibraryVoiceQuery = {}, signal?: AbortSignal): Promise<LibraryVoicePage> {
        const enforced = { ...query, min_notice_period_days: 365, include_custom_rates: false, include_live_moderated: false }
        return this.adminVoiceRequest(`/admin/voices/library${this.adminVoiceQuery(enforced)}`, 'GET', undefined, signal)
    }

    async addAdminLibraryVoice(body: LibraryAddRequest): Promise<AdminCatalogVoice> {
        return this.adminVoiceRequest('/admin/voices/library/add', 'POST', body)
    }

    async saveAdminDesign(body: VoiceDesignSaveRequest): Promise<AdminCatalogVoice> {
        return this.adminVoiceRequest('/admin/voices/design/save', 'POST', body)
    }

    async remixAdminVoice(voiceKey: string, body: VoiceRemixRequest, signal?: AbortSignal): Promise<VoiceDesignResponse> {
        return this.adminVoiceRequest(`${this.adminVoiceKeyPath(voiceKey)}/remix`, 'POST', body, signal)
    }

    async getVoiceLimits(signal?: AbortSignal): Promise<AdminVoiceLimits> {
        return this.adminVoiceRequest('/admin/voices/limits', 'GET', undefined, signal)
    }

    /**
     * Root voice metrics (R0-OPS-07): `GET /admin/voices/metrics/{area}`. `spend`
     * takes `days` (1–90); every other area takes `hours` (1–720). Omitted: the BFF
     * defaults (24 hours, 7 days).
     */
    async getAdminVoiceMetrics<A extends AdminVoiceMetricsArea>(
        area: A,
        query: AdminVoiceMetricsQuery = {},
        signal?: AbortSignal,
    ): Promise<AdminVoiceMetricsByArea[A]> {
        const window = area === 'spend' ? { days: query.days } : { hours: query.hours }
        return this.adminVoiceRequest(`/admin/voices/metrics/${area}${this.adminVoiceQuery(window)}`, 'GET', undefined, signal)
    }

    async getRuntimeSettings(signal?: AbortSignal): Promise<VoiceRuntimeSettingsResponse> {
        return this.adminVoiceRequest('/admin/voices/runtime-settings', 'GET', undefined, signal)
    }

    /** The console writes only `daily_budget_chars` (D37); other switches are out of scope. */
    async putRuntimeSetting(settingKey: string, value: unknown): Promise<VoiceRuntimeSetting> {
        return this.adminVoiceRequest(`/admin/voices/runtime-settings/${encodeURIComponent(settingKey)}`, 'PUT', { value_json: value })
    }

    /** Voice Design: three base64 previews to choose from (save with `saveAdminDesign`). */
    async designAdminVoice(body: VoiceDesignRequest, signal?: AbortSignal): Promise<VoiceDesignResponse> {
        return this.adminVoiceRequest('/admin/voices/design', 'POST', body, signal)
    }

    /** Synth lab render on the `admin_lab` surface; `audio/mpeg` back (the path is reused from R0, 08 §5.3). */
    async testAdminVoice(body: AdminLabSynthesisRequest, signal?: AbortSignal): Promise<AdminLabSynthesisResult> {
        return this.adminVoiceAudio('/admin/voices/test', body, signal)
    }

    /**
     * Per-model lab capabilities (`GET /admin/voices/test/models`, A4). The route
     * may not exist yet: the ApiError (404/501) propagates so the caller falls
     * back to the R0 model list.
     */
    async listAdminLabModels(signal?: AbortSignal): Promise<{ models: AdminLabModel[] }> {
        return this.adminVoiceRequest('/admin/voices/test/models', 'GET', undefined, signal)
    }

    // Global voice presets (EP-5). Root only; account level.

    async listAdminGlobalPresets(): Promise<AdminGlobalPresetList> {
        return this.adminVoiceRequest('/admin/voice-presets/global')
    }

    async createAdminGlobalPreset(input: AdminGlobalPresetInput): Promise<AdminGlobalPresetRow> {
        return this.adminVoiceRequest('/admin/voice-presets/global', 'POST', input)
    }

    /** Partial update. */
    async updateAdminGlobalPreset(presetId: string, input: Partial<AdminGlobalPresetInput>): Promise<AdminGlobalPresetRow> {
        return this.adminVoiceRequest(`/admin/voice-presets/global/${encodeURIComponent(presetId)}`, 'PUT', input)
    }

    async deleteAdminGlobalPreset(presetId: string): Promise<void> {
        await this.adminVoiceRequest<void>(`/admin/voice-presets/global/${encodeURIComponent(presetId)}`, 'DELETE')
    }

    // Minor-report review queue (EP-10). Root only.

    async adminListMinorReports(params: { status?: string; limit?: number; before?: string } = {}): Promise<MinorReportAdminList> {
        return this.adminVoiceRequest(`/admin/voices/minor-reports${this.adminVoiceQuery(params)}`)
    }

    /** A second review answers 409 `minor_report_reviewed`. */
    async adminReviewMinorReport(reportId: string, outcome: MinorReportOutcome): Promise<MinorReportAdminItem> {
        return this.adminVoiceRequest(`/admin/voices/minor-reports/${encodeURIComponent(reportId)}/review`, 'POST', { outcome })
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

    async getFeatureFlagSnapshot(): Promise<FeatureFlagSnapshot> {
        const query = new URLSearchParams()
        for (const key of ACTIVE_FEATURE_KEYS) query.append('expected_flags', key)
        const value = await this.authenticatedRequest<unknown>(
            `/user/me/features?${query}`, this.getStoredToken(), { method: 'GET', cache: 'no-store' },
        )
        return parseFeatureFlagSnapshot(value)
    }

    async watchFeatureFlagInvalidations(onInvalidate: () => void, signal: AbortSignal): Promise<void> {
        const owner = authSession.getSnapshot()
        const request = (token: string) => fetch(`${this.baseUrl}/user/me/features/events`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            credentials: 'include', cache: 'no-store', signal,
        })
        let response = await request(this.getStoredToken())
        this.assertCurrentOwner(owner)
        if (response.status === 401) {
            const token = await this.refreshAccessToken(this.getStoredToken())
            this.assertCurrentOwner(owner)
            response = await request(token)
        }
        if (!response.ok) throw this.responseError(response.status, await this.extractError(response))
        await readEventStream(response, onInvalidate, { signal, assertOwner: () => this.assertCurrentOwner(owner) })
    }

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
        return this.saveMembershipPlan('/admin/billing/plans', 'POST', body)
    }

    async updateMembershipPlan(planCode: string, body: MembershipPlanUpdateRequest): Promise<MembershipPlan> {
        return this.saveMembershipPlan(`/admin/billing/plans/${encodeURIComponent(planCode)}`, 'PATCH', body)
    }

    private async saveMembershipPlan(path: string, method: 'POST' | 'PATCH', body: MembershipPlanCreateRequest | MembershipPlanUpdateRequest): Promise<MembershipPlan> {
        const token = this.getStoredToken()
        const owner = authSession.getSnapshot()
        try {
            return await this.authenticatedRequest<MembershipPlan>(path, token, { method, body: body as unknown as BodyInit })
        } catch (error) {
            if (!(error instanceof ApiError) || error.code !== 'FEATURE_FLAG_UPDATING' || error.details?.committed !== true
                || typeof error.details.mutation_id !== 'string') throw error
            // The SQL mutation already committed. Poll its publication; never
            // send a second write to recover an uncertain cache acknowledgement.
            for (let attempt = 0; attempt < 20; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 250))
                this.assertCurrentOwner(owner)
                const result = await this.authenticatedRequest<{ status: string; entity_kind: string; entity_key: string }>(
                    `/admin/billing/feature-mutations/${encodeURIComponent(error.details.mutation_id)}`, this.getStoredToken(), { method: 'GET' })
                if (result.status === 'published' && result.entity_kind === 'plan') {
                    this.assertCurrentOwner(owner)
                    return this.getMembershipPlan(result.entity_key)
                }
            }
            throw error
        }
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
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonProofRequestResponse>('/patreon/link/request', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Consume a Patreon proof token/parts for the signed-in user. */
    async confirmPatreonLink(body: PatreonProofConfirmRequest): Promise<PatreonLinkStatusResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/confirm', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Read the signed-in user's safe Patreon link and entitlement projection. */
    async getPatreonLinkStatus(): Promise<PatreonLinkStatusResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/status', token, {
            method: 'GET',
        })
    }

    /** Soft-unlink Patreon entitlement state for the signed-in user. */
    async unlinkPatreon(body?: PatreonUnlinkRequest): Promise<PatreonUnlinkResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonUnlinkResponse>('/patreon/link', token, {
            method: 'DELETE',
            body: body ? body as unknown as BodyInit : undefined,
        })
    }

    // --- Voice presets (user-facing) ---------------------------------------

    /** The caller's presets plus the globals the BFF shows them (EP-4), never filtered here (R-15). */
    async listVoicePresets(q?: string): Promise<VoicePreset[]> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        const rows: VoicePreset[] = []
        for (let skip = 0; ; skip += 100) {
            const params = new URLSearchParams({ skip: String(skip), limit: '100' })
            if (q?.trim()) params.set('q', q.trim())
            const page = await this.authenticatedRequest<VoicePreset[]>(`/voice-presets?${params}`, token, { method: 'GET' })
            rows.push(...page)
            if (page.length < 100) return [...new Map(rows.map(row => [row.preset_id, row])).values()]
        }
    }

    /** EP-3: a V2 body. */
    async createVoicePreset(body: VoicePresetV2Write): Promise<VoicePreset> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>('/voice-presets', token, {
            method: 'POST',
            body: stripVoiceProjections(body) as unknown as BodyInit,
        })
    }

    /** EP-3: a V2 body; the row keeps its preset_id. */
    async updateVoicePreset(presetId: string, body: VoicePresetV2Write): Promise<VoicePreset> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>(`/voice-presets/${encodeURIComponent(presetId)}`, token, {
            method: 'PUT',
            body: stripVoiceProjections(body) as unknown as BodyInit,
        })
    }

    async deleteVoicePreset(presetId: string): Promise<void> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/voice-presets/${encodeURIComponent(presetId)}`, token, { method: 'DELETE' })
    }

    /**
     * Metered recipe preview (D18, 08 §5.2): a fixed `text_id`, never free text.
     * Answers `{cache_key, url, cached, previews_left}`; the audio is fetched as
     * an authed blob from `/voice-presets/preview/{cache_key}.mp3`. Errors: 428
     * `attestation_required`, 429 (daily limit or bucket), 503
     * `moderation_unavailable`. Account scope: no workspace selector. V2 body only.
     */
    async previewVoice(
        body: VoicePresetPreviewRequestV2,
        options: { signal?: AbortSignal } = {},
    ): Promise<VoicePresetPreviewResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePresetPreviewResponse>('/voice-presets/preview', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
            signal: options.signal,
            omitWorkspaceScope: true,
        })
    }

    async getVoicePerformanceCapabilities(): Promise<import('@/shared').VoicePerformanceCapabilities> {
        return this.authenticatedRequest('/voice-performance/capabilities', this.getStoredToken(), { omitWorkspaceScope: true })
    }

    async listPronunciationDictionaries(): Promise<{ items: import('@/shared').PronunciationDictionary[] }> {
        return this.authenticatedRequest('/voice-performance/dictionaries', this.getStoredToken(), { omitWorkspaceScope: true })
    }

    async savePronunciationDictionary(body: import('@/shared').PronunciationDictionaryWrite, dictionaryId?: string): Promise<import('@/shared').PronunciationDictionary> {
        return this.authenticatedRequest(`/voice-performance/dictionaries${dictionaryId ? `/${encodeURIComponent(dictionaryId)}` : ''}`, this.getStoredToken(), {
            method: dictionaryId ? 'PUT' : 'POST', body: body as unknown as BodyInit, omitWorkspaceScope: true,
        })
    }

    async archivePronunciationDictionary(dictionaryId: string): Promise<void> {
        await this.authenticatedRequest(`/voice-performance/dictionaries/${encodeURIComponent(dictionaryId)}`, this.getStoredToken(), { method: 'DELETE', omitWorkspaceScope: true })
    }

    async previewVoicePerformance(body: import('@/shared').AuthoredVoicePreview, signal?: AbortSignal): Promise<VoicePresetPreviewResponse> {
        this.assertVoicesEnabled()
        return this.authenticatedRequest('/voice-performance/preview', this.getStoredToken(), { method: 'POST', body: body as unknown as BodyInit, signal, omitWorkspaceScope: true })
    }

    /**
     * The fixed recipe-preview texts for a language (`GET /voices/preview-texts`,
     * 08 §5.1, 03 §5.16 I-4). Account scope. A 404 means an older server: the
     * caller falls back to its built-in copies of the same texts.
     */
    async getPreviewTexts(language: string, options: { signal?: AbortSignal } = {}): Promise<PreviewTextsResponse> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<PreviewTextsResponse>(`/voices/preview-texts?language=${encodeURIComponent(language)}`, token, {
            method: 'GET',
            signal: options.signal,
            omitWorkspaceScope: true,
        })
    }

    // --- Session voice settings and voice refresh (EP-1, EP-2) ---------------
    // Session documents: call these on the session's `withWorkspace(id)` client so
    // X-Workspace-Id is sent and 409 WORKSPACE_ARCHIVED follows the workspace path.

    /** `GET /{basePath}/{id}/voice-settings`: the session's narration tier override and effective tier. */
    async getSessionVoiceSettings(basePath: VoiceSessionBasePath, sessionId: number): Promise<SessionVoiceSettings> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SessionVoiceSettings>(`/${basePath}/${sessionId}/voice-settings`, token, {
            method: 'GET',
        })
    }

    /** `PUT /{basePath}/{id}/voice-settings` with `{tier_override}`; null clears the override. */
    async setSessionNarrationTier(
        basePath: VoiceSessionBasePath,
        sessionId: number,
        tierOverride: NarrationTier | null,
    ): Promise<SessionVoiceSettings> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SessionVoiceSettings>(`/${basePath}/${sessionId}/voice-settings`, token, {
            method: 'PUT',
            body: { tier_override: tierOverride } as unknown as BodyInit,
        })
    }

    /** `POST /character-chats/{id}/voice/refresh` with `{}`: the raw chat DTO (normalise and strip before any echo). */
    async refreshChatVoice(chatId: number): Promise<unknown> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<unknown>(`/character-chats/${chatId}/voice/refresh`, token, {
            method: 'POST',
            body: {} as unknown as BodyInit,
        })
    }

    /** `POST /adventure-sessions/{id}/voices/refresh` with `{card_ids}` (null: every cast card): the raw session DTO. */
    async refreshAdventureVoices(sessionId: number, cardIds: string[] | null): Promise<unknown> {
        this.assertVoicesEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<unknown>(`/adventure-sessions/${sessionId}/voices/refresh`, token, {
            method: 'POST',
            body: { card_ids: cardIds } as unknown as BodyInit,
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
        assertLlmFeatureEnabled(feature)
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
            // D35: the read-only voice projections never reach a write (copy-on-write; identity without them).
            body: stripCardBodyOrganization(stripVoiceProjections(characterData))
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        return this.authenticatedBlob(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/export.png`,
            'Card image could not be exported.',
            'image/png',
        )
    }

    async createCardShareLink(cardType: CardShareType, cardId: string): Promise<CardShareLinkResponse> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/cards/shared/${encodeURIComponent(shareToken)}`, token, {
            method: 'DELETE',
        })
    }

    async publishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'POST' },
        )
    }

    async unpublishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'DELETE' },
        )
    }

    async cloneCard(cardType: CardShareType, cardId: string, opts?: { force?: boolean }): Promise<CardCloneResponse> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        if (cardType === 'world') return '/worlds'
        if (cardType === 'item') return '/items'
        return '/characters'
    }

    /** List a card's saved versions (newest first) plus its current latest pointer. */
    async listCardVersions(cardType: VersionableCardType, cardId: string): Promise<CardVersionList> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardVersionList>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions`,
            token,
            { method: 'GET' },
        )
    }

    /** Snapshot the card's current content as a new immutable version ("Save version"). */
    async saveCardVersion(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardVersion> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}/restore`,
            token,
            { method: 'POST' },
        )
    }

    /** Derived usage for a card: distinct sessions (adventures + chats) and stories. */
    async getCardUsage(cardType: VersionableCardType, cardId: string): Promise<CardUsage> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'GET' },
        )
    }

    /** Write the editor's payload into the private draft (does not touch the live card). */
    async saveCardDraft(cardType: VersionableCardType, cardId: string, body: unknown): Promise<CardDraftDocument> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: stripCardBodyOrganization(stripVoiceProjections(body)) as unknown as BodyInit,
            },
        )
    }

    /** Discard the draft, reverting to the published version. Idempotent. */
    async discardCardDraft(
        cardType: VersionableCardType,
        cardId: string,
    ): Promise<{ card_id: string; discarded: boolean; has_draft: boolean }> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'DELETE' },
        )
    }

    /** Promote the draft → live and cut a new version (v{n+1}). 409 when there's nothing to publish. */
    async publishCardDraft(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardPublishResult> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardHistoricalDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}`,
            token,
            { method: 'GET' },
        )
    }

    /** Fetch the latest PUBLISHED body for a versionable card (ignores any private draft). */
    async getPublishedBody(cardType: VersionableCardType, cardId: string): Promise<CardDraftDocument> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
            body: stripCardBodyOrganization(worldData)
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
            body: stripCardBodyOrganization(itemData)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
        this.assertCommunityCardsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/public${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    async getPublicCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        if (cardType) assertContentTypeFeatureEnabled(cardType)
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
        assertFeatureEnabled('adventures')
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

    /** Import a PDF as a saved Markdown resource, tracked in Tasks without LLM usage. */
    async importLorebookResourcePdf(file: File): Promise<unknown> {
        this.assertLorebookResourcesEnabled()
        const body = new FormData()
        body.append('file', file)
        return trackResourceTaskRequest(() => this.authenticatedRequest('/lorebook-resources/import-pdf', this.getStoredToken(), {
            method: 'POST', body, headers: { 'X-Request-Id': makeRequestId('pdf-import') },
        }), this.workspaceScope?.workspaceId ?? null)
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
        return this.withLlmIntent('lorebook_extraction', options.requestId, command.llm, options.signal, async (llm) => trackResourceTaskRequest(async () => {
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
                if (isLorebookExtractionDisabled(error) || isLlmRequestSpent(error) || error instanceof ApiError && error.status > 0 && error.status < 500) throw error
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
        }, this.workspaceScope?.workspaceId ?? null))
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

    async getStories(skip=0,limit=100,q?:string,trashed=false,filters:StoryLibraryFilters={}): Promise<Story[]> {
        this.assertNovelsEnabled()
        if(!isStoryLibraryFilters(filters))throw new ApiError(422,'Invalid novel library filters.',{code:'story_contract',retryable:false})
        const query=this.listQuery(skip,limit,q)
        const extra=storyLibraryParams(filters)
        if(trashed)extra.set('trashed','true')
        const value=await this.authenticatedRequest<unknown>(`/stories${query}${extra.size?(query?'&':'?')+extra.toString():''}`,this.getStoredToken())
        if (!Array.isArray(value) || !value.every((story)=>verifyStory(story,undefined,true))) throw new ApiError(502,'Invalid novel summaries.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryStudioIndex(storyId:string,options?:{signal?:AbortSignal}):Promise<StoryStudioIndex> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/studio-index`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyStoryStudioIndex(value,storyId))throw new ApiError(502,'Invalid novel outline. Your saved content has not been changed.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async getStoryStudioScene(index:StoryStudioSource,scene:StorySceneHeader,options?:{signal?:AbortSignal}):Promise<StoryStudioScene> {
        this.assertNovelsEnabled()
        const request=verifyStoryStudioSource(index,index.id)?storyStudioSceneRequest(index,scene):null
        if(!request)throw new ApiError(409,'The saved outline changed. Refresh it before opening this scene.',{code:'STORY_STUDIO_SOURCE_CHANGED',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(index.id)}/studio-scenes/${encodeURIComponent(scene.id)}`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:request as unknown as BodyInit,signal:options?.signal})
        if(!verifyStoryStudioScene(value,index,scene))throw new ApiError(502,'The scene does not match this saved outline. Refresh it before writing.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async updateStoryStudio(storyId:string,patch:Partial<Story>|Record<string,unknown>):Promise<StoryStudioIndex> {
        this.assertNovelsEnabled()
        const write=patch as Record<string,unknown>
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/studio-index`,this.getStoredToken(),
            {method:'PUT',headers:{'Content-Type':'application/json'},body:patch as unknown as BodyInit})
        if(!value||typeof value!=='object'||!('acknowledgement' in value)||!('index' in value)||!('write' in value)
            ||canonicalJson(value.write)!==canonicalJson(write)||!verifyStoryLifecycleAcknowledgement(value.acknowledgement,storyId,Number(write.expectedMetadataRevision))||!verifyStoryStudioIndex(value.index,storyId)
            ||value.index.metadataRevision<Number(write.expectedMetadataRevision)+1
            ||value.index.metadataRevision===Number(write.expectedMetadataRevision)+1&&!matchesStoryWrite(value.index,write))throw new ApiError(502,'Invalid novel metadata acknowledgement. Your request is retained.',{code:'story_studio_contract',retryable:false})
        return value.index
    }
    async getStoryStudioExcerpts(source:StoryOutline,scenes:StorySceneOutline[],options?:{signal?:AbortSignal}):Promise<StoryStudioExcerpts> {
        this.assertNovelsEnabled()
        const request=verifyStoryStudioSource(source)?studioExcerptsRequest(source,scenes):null
        if(!request)throw new ApiError(409,'The saved scene preview changed.',{code:'STORY_STUDIO_SOURCE_CHANGED',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(source.id)}/studio-excerpts`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:request as unknown as BodyInit,signal:options?.signal})
        if(!verifyStudioExcerpts(value,source.id,request))throw new ApiError(502,'The saved scene preview could not be verified.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async getStoryGenerationHistory(storyId:string,before:string|null=null,options?:{signal?:AbortSignal}):Promise<StoryGenerationHistoryPage> {
        this.assertNovelsEnabled()
        const query=before?'?before='+encodeURIComponent(before):''
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-history${query}`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyGenerationHistoryPage(value,storyId,before))throw new ApiError(502,'Saved generation history could not be verified.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async getStoryGenerationHistoryDetail(storyId:string,id:string,options?:{signal?:AbortSignal}):Promise<StoryGenerationDetail> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-history/${encodeURIComponent(id)}`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyGenerationDetail(value,storyId,id))throw new ApiError(502,'The saved generation could not be verified.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async getStoryRefinementParent(storyId:string,id:string,options?:{signal?:AbortSignal}):Promise<NovelRefinementContext> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-history/${encodeURIComponent(id)}/refinement-parent`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyNovelRefinement(value,storyId)||value.parent.id!==id)throw new ApiError(502,'The retained proposal could not be verified.',{code:'novel_refinement_contract',retryable:false})
        return value
    }
    async previewStoryVariant(storyId:string,intent:StoryVariantIntent,options?:{signal?:AbortSignal}):Promise<StoryVariantSnapshot> {
        this.assertNovelsEnabled()
        if(!isStoryVariantIntent(intent))throw new ApiError(422,'Invalid authored version.',{code:'story_variant_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variants/preview`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:intent as unknown as BodyInit,signal:options?.signal})
        if(!verifyStoryVariantSnapshot(value,storyId,intent))throw new ApiError(502,'The authored version review could not be verified.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async createStoryVariant(storyId:string,write:StoryVariantCreate,options?:{signal?:AbortSignal}):Promise<StoryVariantRecord> {
        this.assertNovelsEnabled()
        if(!isStoryVariantCreate(write))throw new ApiError(422,'Invalid authored version request.',{code:'story_variant_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variants`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit,signal:options?.signal})
        if(!verifyStoryVariantCreation(value,storyId,write))throw new ApiError(502,'The saved authored version could not be verified. Its request is retained.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async getStoryVariant(storyId:string,id:string,options?:{signal?:AbortSignal}):Promise<StoryVariantRecord> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variants/${encodeURIComponent(id)}`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyStoryVariantRecord(value,storyId)||value.variant.id!==id)throw new ApiError(502,'The saved authored version could not be verified.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async getStoryVariants(storyId:string,query:StoryVariantQuery={},options?:{signal?:AbortSignal}):Promise<StoryVariantPage> {
        this.assertNovelsEnabled()
        if(!isStoryVariantQuery(query))throw new ApiError(422,'Invalid authored version history request.',{code:'story_variant_contract',retryable:false})
        const params=new URLSearchParams()
        if(query.generationId!==undefined)params.set('generation_id',query.generationId)
        if(query.before!==undefined)params.set('before',query.before)
        if(query.limit!==undefined)params.set('limit',String(query.limit))
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variants${params.size?'?'+params.toString():''}`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyStoryVariantPage(value,storyId,query))throw new ApiError(502,'Authored version history could not be verified.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async decideStoryVariant(storyId:string,write:StoryVariantDecision,options?:{signal?:AbortSignal}):Promise<StoryVariantRecord> {
        this.assertNovelsEnabled()
        if(!isStoryVariantDecision(write))throw new ApiError(422,'Invalid authored version decision.',{code:'story_variant_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variants/${encodeURIComponent(write.reference.id)}/decision`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit,signal:options?.signal})
        if(!verifyStoryVariantDecision(value,storyId,write))throw new ApiError(502,'The authored version decision could not be verified. Its request is retained.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async getStoryVariantResult(storyId:string,write:StoryVariantCreate|StoryVariantDecision,options?:{signal?:AbortSignal}):Promise<StoryVariantRecord|null> {
        this.assertNovelsEnabled()
        const creating=isStoryVariantCreate(write)
        if(!creating&&!isStoryVariantDecision(write))throw new ApiError(422,'Invalid authored version recovery request.',{code:'story_variant_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-variant-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken(),{signal:options?.signal})
        if(value===null)return null
        if(creating){
            if(!verifyStoryVariantCreation(value,storyId,write as StoryVariantCreate))throw new ApiError(502,'The original authored version receipt could not be verified.',{code:'story_variant_contract',retryable:false})
            return value
        }
        if(!verifyStoryVariantDecision(value,storyId,write as StoryVariantDecision))throw new ApiError(502,'The original authored version receipt could not be verified.',{code:'story_variant_contract',retryable:false})
        return value
    }
    async getStorySceneDocument(storyId:string,sceneId:string):Promise<StoryStudioDocument> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}?projection=document`,this.getStoredToken())
        if(!verifyStoryStudioDocument(value,storyId,sceneId))throw new ApiError(502,'The saved scene could not be verified.',{code:'story_studio_contract',retryable:false})
        return value
    }
    async getStory(storyId:string): Promise<Story> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}`,this.getStoredToken())
        if (!verifyStory(value,storyId)) throw new ApiError(502,'Unsupported novel document. Your saved content has not been changed.',{code:'story_contract',retryable:false})
        return value
    }
    async createStory(write:StoryCreateWrite): Promise<StoryCreationAcknowledgement> {
        this.assertNovelsEnabled()
        if(!isStoryCreateWrite(write))throw new ApiError(422,'Invalid novel creation request.',{code:'story_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories',this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryCreationAcknowledgement(value,write))throw new ApiError(502,'Invalid novel creation receipt. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryCreationResult(write:StoryCreateWrite):Promise<StoryCreationAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/creation-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryCreationAcknowledgement(value,write))throw new ApiError(502,'Invalid novel creation recovery receipt.',{code:'story_contract',retryable:false})
        return value
    }
    async previewStoryCreationSources(selection:StoryCreationSourcesSelection):Promise<StoryCreationSourcesPreview> {
        this.assertNovelsEnabled()
        if(!isCreationSourcesSelection(selection))throw new ApiError(422,'Invalid novel source selection.',{code:'story_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/creation-source-preview',this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:selection as unknown as BodyInit})
        if(!verifyCreationSourcesPreview(value,selection))throw new ApiError(502,'Invalid novel source review.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryCreationSources(storyId:string):Promise<StoryCreationSources|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/creation-sources`,this.getStoredToken())
        if(value===null)return null
        if(!verifyCreationSources(value,storyId))throw new ApiError(502,'Invalid novel source provenance.',{code:'story_contract',retryable:false})
        return value
    }
    /** What importing this file would create and what the conversion cannot keep; nothing is saved. The preview must be of these very bytes. */
    async previewStoryImport(file:File,options:StoryImportOptions,request?:{signal?:AbortSignal}):Promise<StoryImportManifest> {
        this.assertNovelsEnabled()
        if(!isStoryImportOptions(options))throw new ApiError(422,'Choose valid import options.',{code:'story_import_request',retryable:false})
        const body=new FormData();body.append('file',file,file.name);body.append('options',JSON.stringify(options))
        const [value,sha256]=await Promise.all([this.authenticatedRequest<unknown>('/stories/import-preview',this.getStoredToken(),{method:'POST',body,signal:request?.signal}),sha256Hex(file)])
        if(!verifyStoryImportManifest(value,{size:file.size,sha256},options))throw new ApiError(502,'The import preview does not match this file.',{code:'story_import_contract',retryable:false})
        return value
    }
    /** The parts, chapters, scenes and planned beats an outline describes (S18); nothing is saved. */
    async previewStoryOutline(text:string,chapterLevel:number|null,request?:{signal?:AbortSignal}):Promise<StoryOutlinePreview> {
        this.assertNovelsEnabled()
        if(!text.trim()||[...text].length>STORY_OUTLINE_MAX_TEXT||chapterLevel!==null&&!(Number.isInteger(chapterLevel)&&chapterLevel>=1&&chapterLevel<=6))
            throw new ApiError(422,'Paste an outline of at most 500,000 characters.',{code:'story_outline_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/outline-preview',this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{text,chapterLevel} as unknown as BodyInit,signal:request?.signal})
        if(!verifyStoryOutlinePreview(value,chapterLevel))throw new ApiError(502,'Unsupported outline preview.',{code:'story_outline_contract',retryable:false})
        return value
    }
    /** Create a new novel from the reviewed preview of the same file; the server keeps the original file with the novel. */
    async importStory(file:File,write:StoryImportWrite):Promise<StoryImportAcknowledgement> {
        this.assertNovelsEnabled()
        if(!isStoryImportWrite(write))throw new ApiError(422,'Invalid novel import request.',{code:'story_import_request',retryable:false})
        const body=new FormData();body.append('file',file,file.name);body.append('write',JSON.stringify(write))
        const value=await this.authenticatedRequest<unknown>('/stories/import',this.getStoredToken(),{method:'POST',body})
        if(!verifyStoryImportAcknowledgement(value,write))throw new ApiError(502,'Invalid novel import receipt. Check your library before importing again.',{code:'story_import_contract',retryable:false})
        return value
    }
    /** The receipt of an import whose response was lost, or null when it never committed. */
    async getStoryImportResult(write:StoryImportWrite):Promise<StoryImportAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/import-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryImportAcknowledgement(value,write))throw new ApiError(502,'Invalid novel import recovery receipt.',{code:'story_import_contract',retryable:false})
        return value
    }
    /** The novel's goals, saved words and writing log, with days grouped in an IANA time zone. */
    async getStoryWritingProgress(storyId:string,request:{timeZone:string;days:number},options?:{signal?:AbortSignal}):Promise<StoryWritingProgress> {
        this.assertNovelsEnabled()
        if(!request.timeZone||[...request.timeZone].length>64||!Number.isSafeInteger(request.days)||request.days<1||request.days>STORY_PROGRESS_MAX_DAYS)
            throw new ApiError(422,'Choose a valid time zone and number of days.',{code:'story_progress_request',retryable:false})
        const query=new URLSearchParams({timeZone:request.timeZone,days:String(request.days)})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/writing-progress?${query}`,this.getStoredToken(),{signal:options?.signal})
        if(!verifyStoryWritingProgress(value,storyId,request))throw new ApiError(502,'Invalid writing progress.',{code:'story_progress_contract',retryable:false})
        return value
    }
    async getStoryImportRecord(storyId:string):Promise<StoryImportRecord|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/import-record`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryImportRecord(value,storyId))throw new ApiError(502,'Invalid novel import record.',{code:'story_import_contract',retryable:false})
        return value
    }
    /** The original imported file; accepted only when its size and SHA-256 match the import record. */
    async downloadStoryImportSource(record:StoryImportRecord):Promise<Blob> {
        this.assertNovelsEnabled()
        const types:Record<StoryImportRecord['format'],string>={markdown:'text/markdown',text:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            epub:'application/epub+zip',odt:'application/vnd.oasis.opendocument.text',rtf:'application/rtf'}
        const blob=await this.authenticatedBlob(`/stories/${encodeURIComponent(record.storyId)}/import-source`,'The original file could not be read.',types[record.format])
        if(blob.size!==record.bytes||await sha256Hex(blob)!==record.sourceHash)throw new ApiError(502,'The original file does not match its import record.',{code:'story_import_contract',retryable:false})
        return blob
    }
    async previewStoryErase(storyId:string):Promise<StoryErasePreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/erase-preview`,this.getStoredToken())
        if(!verifyStoryErasePreview(value,storyId))throw new ApiError(502,'Invalid novel erasure preview.',{code:'story_contract',retryable:false})
        return value
    }
    async permanentlyEraseStory(storyId:string,write:StoryEraseWrite):Promise<StoryEraseAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/erase`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryEraseAcknowledgement(value,storyId,write))throw new ApiError(502,'Invalid novel erasure acknowledgement. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryEraseResult(storyId:string,write:StoryEraseWrite):Promise<StoryEraseAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/erase-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryEraseAcknowledgement(value,storyId,write))throw new ApiError(502,'Invalid novel erasure recovery receipt. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async previewStoryCopy(storyId:string,bookmarks=false):Promise<StoryCopyPreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/copy-preview?comments=true${bookmarks?'&bookmarks=true':''}`,this.getStoredToken())
        if(!verifyStoryCopyPreview(value,storyId)||bookmarks&&value.variants.some((variant)=>variant.bookmarks===undefined))throw new ApiError(502,'Invalid novel copy preview.',{code:'story_contract',retryable:false})
        return value
    }
    async copyStory(storyId:string,write:StoryCopyWrite):Promise<StoryCopyAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/copy`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryCopyAcknowledgement(value,storyId,write))throw new ApiError(502,'Invalid novel copy acknowledgement. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryCopyResult(storyId:string,write:StoryCopyWrite):Promise<StoryCopyAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/copy-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryCopyAcknowledgement(value,storyId,write))throw new ApiError(502,'Invalid novel copy recovery acknowledgement.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryCopyProvenance(storyId:string):Promise<StoryCopyProvenance|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/copy-provenance`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryCopyProvenance(value,storyId))throw new ApiError(502,'Invalid novel copy provenance.',{code:'story_contract',retryable:false})
        return value
    }
    async updateStory(storyId:string,story:Partial<Story>|Record<string,unknown>): Promise<Story> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}`,this.getStoredToken(),{method:'PUT',headers:{'Content-Type':'application/json'},body:stripOrganization(story) as unknown as BodyInit})
        if (!verifyStory(value,storyId)||!matchesStoryWrite(value,story)) throw new ApiError(502,'Invalid novel acknowledgement.',{code:'story_contract',retryable:false})
        return value
    }
    async storyLifecycle(storyId:string,write:{requestId:string;expectedMetadataRevision:number;action:'archive'|'trash'|'restore'}): Promise<void> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/lifecycle`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryLifecycleAcknowledgement(value,storyId,write.expectedMetadataRevision))throw new ApiError(502,'Unsupported novel lifecycle acknowledgement. Your request is retained.',{code:'story_contract',retryable:false})
    }
    async updateStoryChapter(storyId:string,chapterId:string,write:StoryChapterWrite): Promise<StoryUnitMetadata> {
        return this.updateStoryGroup(storyId,'chapters',chapterId,write)
    }
    async updateStoryPart(storyId:string,partId:string,write:StoryChapterWrite): Promise<StoryUnitMetadata> {
        return this.updateStoryGroup(storyId,'parts',partId,write)
    }
    private async updateStoryGroup(storyId:string,kind:'chapters'|'parts',id:string,write:StoryChapterWrite): Promise<StoryUnitMetadata> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/${kind}/${encodeURIComponent(id)}`,this.getStoredToken(),{method:'PUT',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryMetadata(value,storyId,id)||!matchesStoryWrite(value,write))throw new ApiError(502,'Unsupported writing details acknowledgement. Your draft is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryScene(storyId:string,sceneId:string): Promise<StoryScene> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}`,this.getStoredToken())
        return this.storySceneAcknowledgement(value,storyId,sceneId)
    }
    async previewStoryReplacement(storyId:string,query:StoryReplacementRequest):Promise<StoryReplacementPreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-replacements/preview`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:query as unknown as BodyInit})
        if(!verifyReplacementPreview(value,storyId,query))throw new ApiError(502,'Unsupported replacement preview.',{code:'story_replacement_contract',retryable:false})
        return value
    }
    async previewStoryReplacementReverse(storyId:string,query:StoryReplacementReverseRequest):Promise<StoryReplacementPreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-replacements/reverse-preview`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:query as unknown as BodyInit})
        if(!verifyReplacementPreview(value,storyId,query))throw new ApiError(502,'Unsupported replacement reversal preview.',{code:'story_replacement_contract',retryable:false})
        return value
    }
    async replaceStoryManuscript(storyId:string,write:StoryReplacementWrite):Promise<StoryReplacementAck> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-replacements`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyReplacementAck(value,storyId,write))throw new ApiError(502,'Unsupported replacement acknowledgement. The request is retained.',{code:'story_replacement_contract',retryable:false})
        return value
    }
    async getStoryReplacementResult(storyId:string,write:StoryReplacementWrite):Promise<StoryReplacementAck|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-replacements/requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(value===null)return null
        if(!verifyReplacementAck(value,storyId,write))throw new ApiError(502,'Unsupported replacement recovery acknowledgement. The request is retained.',{code:'story_replacement_contract',retryable:false})
        return value
    }
    async previewStoryAssistantContext(index:StoryStudioIndex,request:StoryAssistantContextRequest,options?:{signal?:AbortSignal}):Promise<StoryAssistantContext> {
        this.assertNovelsEnabled()
        if(!verifyStoryStudioIndex(index,index.id)||!isAssistantContextRequest(request)||request.sourceVersion!==index.sourceVersion)throw new ApiError(409,'Refresh the saved novel before preparing sources.',{code:'STORY_ASSISTANT_SOURCE_CHANGED',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(index.id)}/assistant-context`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:request as unknown as BodyInit,signal:options?.signal})
        if(!verifyAssistantContext(value,index,request))throw new ApiError(502,'The assistant source packet does not match this saved novel.',{code:'story_assistant_context_contract',retryable:false})
        return value
    }
    /** The account's assistant reply preferences (A25), in every workspace; version 0 means none are saved. */
    async getStoryAssistantPreferences(options?:{signal?:AbortSignal}):Promise<StoryAssistantPreferencesState> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-preferences',this.getStoredToken(),{signal:options?.signal})
        if(!isAssistantPreferencesState(value))throw new ApiError(502,'The assistant preferences could not be read.',{code:'story_assistant_preferences_contract',retryable:false})
        return value
    }
    /** Saves the preferences at the version last read; another tab's save first is a 409 STORY_ASSISTANT_PREFERENCES_CHANGED. */
    async saveStoryAssistantPreferences(preferences:StoryAssistantPreferences,expectedVersion:number):Promise<StoryAssistantPreferencesState> {
        this.assertNovelsEnabled()
        if(!isAssistantPreferences(preferences)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new ApiError(422,'Choose valid reply preferences.',{code:'story_assistant_preferences_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-preferences',this.getStoredToken(),{method:'PUT',headers:{'Content-Type':'application/json'},body:{preferences,expectedVersion} as unknown as BodyInit})
        if(!isAssistantPreferencesState(value)||canonicalJson(value.preferences)!==canonicalJson(preferences)||value.version<=expectedVersion)
            throw new ApiError(502,'The saved assistant preferences do not match.',{code:'story_assistant_preferences_contract',retryable:false})
        return value
    }
    /** Clears the saved preferences at the version last read, so the assistant answers as it does by default. */
    async clearStoryAssistantPreferences(expectedVersion:number):Promise<StoryAssistantPreferencesState> {
        this.assertNovelsEnabled()
        if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw new ApiError(422,'There are no saved reply preferences to clear.',{code:'story_assistant_preferences_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-preferences?expectedVersion='+expectedVersion,this.getStoredToken(),{method:'DELETE'})
        if(!isAssistantPreferencesState(value)||value.preferences!==null)throw new ApiError(502,'The assistant preferences were not cleared.',{code:'story_assistant_preferences_contract',retryable:false})
        return value
    }
    /** The account's prompt presets (A19), in use and in Trash, in every workspace. */
    async listStoryAssistantPresets(options?:{signal?:AbortSignal}):Promise<StoryAssistantPresetList> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-presets',this.getStoredToken(),{signal:options?.signal})
        if(!isStoryAssistantPresetList(value))throw new ApiError(502,'The prompt presets could not be read.',{code:'story_assistant_presets_contract',retryable:false})
        return value
    }
    private checkedPreset(value:unknown,expected:(preset:StoryAssistantPreset)=>boolean):StoryAssistantPreset {
        if(!isStoryAssistantPreset(value)||!expected(value))throw new ApiError(502,'The saved prompt preset does not match.',{code:'story_assistant_presets_contract',retryable:false})
        return value
    }
    /** Saves a new preset under the client's own id, so a retried save returns the same preset instead of a second one. */
    async createStoryAssistantPreset(presetId:string,name:string,definition:StoryAssistantPresetDefinition):Promise<StoryAssistantPreset> {
        this.assertNovelsEnabled()
        if(!isPresetDefinition(definition))throw new ApiError(422,'Write a valid prompt preset.',{code:'story_assistant_presets_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-presets',this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{presetId,name,definition} as unknown as BodyInit})
        return this.checkedPreset(value,(preset)=>preset.id===presetId&&preset.revision===1&&preset.name===name&&canonicalJson(preset.definition)===canonicalJson(definition))
    }
    /** Saves the next revision at the revision last read; another tab's save first is a 409 STORY_ASSISTANT_PRESET_CHANGED. */
    async updateStoryAssistantPreset(presetId:string,name:string,definition:StoryAssistantPresetDefinition,expectedRevision:number):Promise<StoryAssistantPreset> {
        this.assertNovelsEnabled()
        if(!isPresetDefinition(definition))throw new ApiError(422,'Write a valid prompt preset.',{code:'story_assistant_presets_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-presets/'+encodeURIComponent(presetId),this.getStoredToken(),{method:'PUT',headers:{'Content-Type':'application/json'},body:{name,definition,expectedRevision} as unknown as BodyInit})
        return this.checkedPreset(value,(preset)=>preset.id===presetId&&preset.revision===expectedRevision+1&&preset.name===name&&canonicalJson(preset.definition)===canonicalJson(definition))
    }
    /** Moves a preset to Trash, or back, at the revision last read; replies sent from it keep their frozen copy either way. */
    async setStoryAssistantPresetTrashed(presetId:string,trashed:boolean,expectedRevision:number):Promise<StoryAssistantPreset> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-presets/'+encodeURIComponent(presetId)+(trashed?'/trash':'/restore'),this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{expectedRevision} as unknown as BodyInit})
        return this.checkedPreset(value,(preset)=>preset.id===presetId&&preset.revision===expectedRevision&&(preset.trashedAt!==null)===trashed)
    }
    /** Deletes a preset that is already in Trash. */
    async deleteStoryAssistantPreset(presetId:string,expectedRevision:number):Promise<void> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>('/stories/assistant-presets/'+encodeURIComponent(presetId)+'?expectedRevision='+expectedRevision,this.getStoredToken(),{method:'DELETE'})
        if(canonicalJson(value)!==canonicalJson({deleted:true,id:presetId}))throw new ApiError(502,'The prompt preset was not deleted.',{code:'story_assistant_presets_contract',retryable:false})
    }
    /** The manifest of a whole-manuscript export at its source version: scenes in and out, notes, size and SHA-256. */
    async previewStoryExport(storyId:string,request:StoryExportRequest,options?:{signal?:AbortSignal}):Promise<StoryExportManifest> {
        this.assertNovelsEnabled()
        if(!isStoryExportRequest(request))throw new ApiError(422,'Choose valid export options.',{code:'story_export_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/export-preview`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:request as unknown as BodyInit,signal:options?.signal})
        if(!verifyStoryExportManifest(value,storyId,request))throw new ApiError(502,'The export summary does not match this novel or these choices.',{code:'story_export_contract',retryable:false})
        return value
    }
    /** The file a preview described; it is accepted only when its size and SHA-256 match that preview. */
    async downloadStoryExport(manifest:StoryExportManifest):Promise<Blob> {
        this.assertNovelsEnabled()
        const blob=await this.authenticatedBlob(`/stories/${encodeURIComponent(manifest.storyId)}/export?${storyExportQuery(manifest.request)}`,'The manuscript could not be exported.',manifest.contentType)
        if(blob.size!==manifest.bytes||await sha256Hex(blob)!==manifest.sha256)throw new ApiError(409,'The exported file does not match its preview.',{code:'STORY_EXPORT_SOURCE_CHANGED',retryable:false})
        return blob
    }
    private storyExportJob(value:unknown,storyId:string):StoryExportJob {
        if(!verifyStoryExportJob(value,storyId))throw new ApiError(502,'The export job does not match this novel.',{code:'story_export_job_contract',retryable:false})
        return value
    }
    /** Builds the file of a reviewed export in the background, at the source version that review saw; a replayed id returns the same job. */
    async createStoryExportJob(storyId:string,request:StoryExportRequest,requestId:string):Promise<StoryExportJob> {
        this.assertNovelsEnabled()
        if(!isStoryExportRequest(request))throw new ApiError(422,'Choose valid export options.',{code:'story_export_request',retryable:false})
        const job=this.storyExportJob(await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/export-jobs`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{requestId,request} as unknown as BodyInit}),storyId)
        if(job.requestId!==requestId||canonicalJson(job.request)!==canonicalJson(request))throw new ApiError(502,'The export job does not match this request.',{code:'story_export_job_contract',retryable:false})
        return job
    }
    /** The novel's newest export jobs, newest first, each with its stage, log and file. */
    async listStoryExportJobs(storyId:string,options?:{signal?:AbortSignal}):Promise<StoryExportJob[]> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/export-jobs`,this.getStoredToken(),{signal:options?.signal})
        const jobs=value&&typeof value==='object'&&Object.keys(value).length===1?(value as {jobs?:unknown}).jobs:null
        if(!Array.isArray(jobs))throw new ApiError(502,'The export jobs could not be read.',{code:'story_export_job_contract',retryable:false})
        return jobs.map((job)=>this.storyExportJob(job,storyId))
    }
    /** Stops a queued or running job; it keeps no file. */
    async cancelStoryExportJob(storyId:string,jobId:string):Promise<StoryExportJob> {
        this.assertNovelsEnabled()
        const job=this.storyExportJob(await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/export-jobs/${encodeURIComponent(jobId)}/cancel`,this.getStoredToken(),{method:'POST'}),storyId)
        if(job.id!==jobId)throw new ApiError(502,'The export job does not match this request.',{code:'story_export_job_contract',retryable:false})
        return job
    }
    /** A new attempt of a failed or canceled job with its same request; refused when the novel changed since. */
    async retryStoryExportJob(previous:StoryExportJob,requestId:string):Promise<StoryExportJob> {
        this.assertNovelsEnabled()
        const job=this.storyExportJob(await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(previous.storyId)}/export-jobs/${encodeURIComponent(previous.id)}/retry`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{requestId} as unknown as BodyInit}),previous.storyId)
        if(job.retryOf!==previous.id||job.requestId!==requestId||canonicalJson(job.request)!==canonicalJson(previous.request))throw new ApiError(502,'The export job does not match this request.',{code:'story_export_job_contract',retryable:false})
        return job
    }
    /** A completed job's file; accepted only when its size and SHA-256 match the job's file. */
    async downloadStoryExportJob(job:StoryExportJob):Promise<Blob> {
        this.assertNovelsEnabled()
        if(!job.file||job.file.removed)throw new ApiError(410,'This file is no longer kept.',{code:'STORY_EXPORT_FILE_REMOVED',retryable:false})
        const blob=await this.authenticatedBlob(`/stories/${encodeURIComponent(job.storyId)}/export-jobs/${encodeURIComponent(job.id)}/file`,'The file could not be downloaded.',job.file.contentType)
        if(blob.size!==job.file.bytes||await sha256Hex(blob)!==job.file.sha256)throw new ApiError(502,'The downloaded file does not match its job.',{code:'STORY_EXPORT_FILE_MISMATCH',retryable:true})
        return blob
    }
    /** What a project package of the novel holds with these choices, and the size and SHA-256 of the file they download. */
    async previewStoryPackage(storyId:string,options:StoryPackageOptions,request?:{signal?:AbortSignal}):Promise<StoryPackageManifest> {
        this.assertNovelsEnabled()
        if(!isStoryPackageOptions(options))throw new ApiError(422,'Choose valid backup options.',{code:'story_package_request',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/package-preview`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{options} as unknown as BodyInit,signal:request?.signal})
        if(!verifyStoryPackageManifest(value,storyId,options))throw new ApiError(502,'The backup summary does not match this novel or these choices.',{code:'story_package_contract',retryable:false})
        return value
    }
    /** The package a summary described; accepted only when its size and SHA-256 match that summary. */
    async downloadStoryPackage(manifest:StoryPackageManifest):Promise<Blob> {
        this.assertNovelsEnabled()
        const blob=await this.authenticatedBlob(`/stories/${encodeURIComponent(manifest.storyId)}/package?${storyPackageQuery(manifest)}`,'The novel could not be backed up.',manifest.contentType)
        if(blob.size!==manifest.bytes||await sha256Hex(blob)!==manifest.sha256)throw new ApiError(409,'The backup does not match its summary.',{code:'STORY_PACKAGE_SOURCE_CHANGED',retryable:false})
        return blob
    }
    /** What restoring this package file would create; nothing is saved. The preview must be of these very bytes. */
    async previewStoryPackageRestore(file:File,request?:{signal?:AbortSignal}):Promise<StoryPackagePreview> {
        this.assertNovelsEnabled()
        const body=new FormData();body.append('file',file,file.name)
        const [value,sha256]=await Promise.all([this.authenticatedRequest<unknown>('/stories/package-preview',this.getStoredToken(),{method:'POST',body,signal:request?.signal}),sha256Hex(file)])
        if(!verifyStoryPackagePreview(value,{size:file.size,sha256}))throw new ApiError(502,'The restore preview does not match this file.',{code:'story_package_contract',retryable:false})
        return value
    }
    /** Restore the reviewed package as a new novel with new identities. */
    async restoreStoryPackage(file:File,write:StoryPackageWrite):Promise<StoryPackageAcknowledgement> {
        this.assertNovelsEnabled()
        if(!isStoryPackageWrite(write))throw new ApiError(422,'Invalid novel restore request.',{code:'story_package_request',retryable:false})
        const body=new FormData();body.append('file',file,file.name);body.append('write',JSON.stringify(write))
        const value=await this.authenticatedRequest<unknown>('/stories/package-import',this.getStoredToken(),{method:'POST',body})
        if(!verifyStoryPackageAcknowledgement(value,write))throw new ApiError(502,'Invalid novel restore receipt. Check your library before restoring again.',{code:'story_package_contract',retryable:false})
        return value
    }
    /** The receipt of a restore whose response was lost, or null when it never committed. */
    async getStoryPackageRestoreResult(write:StoryPackageWrite):Promise<StoryPackageAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/package-imports/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryPackageAcknowledgement(value,write))throw new ApiError(502,'Invalid novel restore recovery receipt.',{code:'story_package_contract',retryable:false})
        return value
    }
    async readStoryManuscript(storyId:string,query:StoryReadingRequest):Promise<StoryReadingPage> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-reader`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:query as unknown as BodyInit})
        if(!verifyReadingPage(value,storyId,query))throw new ApiError(502,'Unsupported saved manuscript page.',{code:'story_reading_contract',retryable:false})
        return value
    }
    async searchStoryManuscript(storyId:string,query:StorySearchRequest):Promise<StorySearchPage> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-search`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:query as unknown as BodyInit})
        if(!verifySearchPage(value,storyId,query))throw new ApiError(502,'Unsupported manuscript search results.',{code:'story_search_contract',retryable:false})
        return value
    }
    async resolveStoryManuscriptSearch(storyId:string,query:StorySearchResolve):Promise<StorySearchResult> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/manuscript-search/resolve`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:query as unknown as BodyInit})
        if(!verifySearchResult(value,storyId,query))throw new ApiError(502,'Unsupported manuscript search target.',{code:'story_search_contract',retryable:false})
        return value
    }
    async updateStoryScene(storyId:string,sceneId:string,write:StorySceneWrite): Promise<StoryScene> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}`,this.getStoredToken(),{method:'PUT',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!matchesStoryWrite(value,write))throw new ApiError(502,'The scene acknowledgement does not match this request. Your draft is retained.',{code:'story_contract',retryable:false})
        return this.storySceneAcknowledgement(value,storyId,sceneId)
    }
    private storySceneAcknowledgement(value:unknown,storyId:string,sceneId:string): StoryScene {
        if (!verifyStoryScene(value,storyId,sceneId)) throw new ApiError(502,'Unsupported scene acknowledgement. Your device draft is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async changeStoryStructure(storyId:string,write:StoryStructureWrite): Promise<StoryStructureAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/structure`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryStructureAcknowledgement(value,write.expectedStructureRevision,{storyId,write}))throw new ApiError(502,'Unsupported outline acknowledgement. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryStructureResult(storyId:string,write:StoryStructureWrite):Promise<StoryStructureAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/structure-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyStoryStructureAcknowledgement(value,write.expectedStructureRevision,{storyId,write}))throw new ApiError(502,'Unsupported outline recovery acknowledgement.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryStructureRevisions(storyId:string,query:StoryStructureHistoryQuery={}): Promise<StoryStructureHistoryPage> {
        this.assertNovelsEnabled()
        const params=new URLSearchParams()
        if(query.before!==undefined)params.set('before',String(query.before))
        if(query.action)params.set('action',query.action)
        if(query.fromDate)params.set('from_date',query.fromDate)
        if(query.throughDate)params.set('through_date',query.throughDate)
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/structure/revisions${params.size?'?'+params.toString():''}`,this.getStoredToken())
        if(!verifyStoryStructureHistory(value,storyId,query.before))throw new ApiError(502,'Unsupported organization history.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryStructureRevision(storyId:string,revision:number):Promise<StoryStructureRevision> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/structure/revisions/${revision}`,this.getStoredToken())
        if(!verifyStoryStructureRevision(value,storyId,revision))throw new ApiError(502,'Unsupported organization checkpoint.',{code:'story_contract',retryable:false})
        return value
    }
    async getStorySnapshotPreview(storyId:string):Promise<StorySnapshotPreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots/preview?annotations=true`,this.getStoredToken())
        if(!verifySnapshotPreview(value,storyId))throw new ApiError(502,'Unsupported manuscript snapshot preview.',{code:'story_contract',retryable:false})
        return value
    }
    async getStorySnapshots(storyId:string,before?:number):Promise<StorySnapshotPage> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots${before?'?before='+before:''}`,this.getStoredToken())
        if(!verifySnapshotPage(value,storyId,before))throw new ApiError(502,'Unsupported manuscript snapshot list.',{code:'story_contract',retryable:false})
        return value
    }
    async getStorySnapshot(storyId:string,id:number):Promise<StorySnapshotDetail> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots/${id}`,this.getStoredToken())
        if(!verifySnapshotDetail(value,storyId,id))throw new ApiError(502,'Unsupported manuscript snapshot.',{code:'story_contract',retryable:false})
        return value
    }
    async compareStorySnapshot(storyId:string,id:number):Promise<StorySnapshotComparison> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots/${id}/comparison`,this.getStoredToken())
        if(!verifySnapshotComparison(value,storyId,id))throw new ApiError(502,'Unsupported manuscript snapshot comparison.',{code:'story_contract',retryable:false})
        return value
    }
    async getStorySnapshotScene(storyId:string,id:number,scene:StorySnapshotScene,manifestHash:string):Promise<StorySnapshotSceneView> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots/${id}/scenes/${encodeURIComponent(scene.id)}`,this.getStoredToken())
        if(!verifySnapshotScene(value,storyId,id,scene,manifestHash))throw new ApiError(502,'Unsupported saved snapshot scene.',{code:'story_contract',retryable:false})
        return value
    }

    async previewStorySnapshotRestore(storyId:string,id:number,options:StorySnapshotRestoreOptions):Promise<StorySnapshotRestorePreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/snapshots/${id}/restore-preview`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:options as unknown as BodyInit})
        if(!verifySnapshotRestorePreview(value,storyId,id,options))throw new ApiError(502,'Unsupported manuscript restore review.',{code:'story_contract',retryable:false})
        return value
    }

    async getStorySnapshotAnnotations(snapshot:StorySnapshotDetail,query:StorySnapshotAnnotationQuery={}):Promise<StorySnapshotAnnotationPage> {
        this.assertNovelsEnabled()
        const params=new URLSearchParams()
        if(query.after)params.set('after',query.after)
        if(query.sceneId)params.set('scene_id',query.sceneId)
        if(query.state)params.set('state',query.state)
        if(query.anchorState)params.set('anchor_state',query.anchorState)
        if(query.kind)params.set('kind',query.kind)
        const suffix=params.size?'?'+params.toString():''
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(snapshot.storyId)}/snapshots/${snapshot.id}/annotations${suffix}`,this.getStoredToken())
        if(!verifySnapshotAnnotationPage(value,snapshot,query))throw new ApiError(502,'Unsupported captured personal notes.',{code:'story_contract',retryable:false})
        return value
    }
    async getStorySnapshotAnnotation(snapshot:StorySnapshotDetail,index:StorySnapshotAnnotationIndex):Promise<StorySnapshotAnnotationDetail> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(snapshot.storyId)}/snapshots/${snapshot.id}/annotations/${encodeURIComponent(index.id)}`,this.getStoredToken())
        if(!verifySnapshotAnnotationDetail(value,snapshot,index))throw new ApiError(502,'Unsupported captured personal note.',{code:'story_contract',retryable:false})
        return value
    }

    async changeStoryCodex(storyId:string,write:StoryCodexWrite):Promise<StoryCodexAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/codex`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyStoryCodexAcknowledgement(value,storyId,write))throw new ApiError(502,'Unsupported Codex acknowledgement. Your request is retained.',{code:'story_contract',retryable:false})
        return value
    }
    /** Codex copies whose library card has a saved version newer than the one they name, and templates or lorebook entries whose library details changed. */
    async getStoryCodexLibraryVersions(storyId:string):Promise<StoryCodexLibraryNotices> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/codex/library-versions`,this.getStoredToken())
        if(!verifyStoryCodexLibraryVersions(value))throw new ApiError(502,'Unsupported library versions.',{code:'story_contract',retryable:false})
        return value
    }
    /** The library card's current version and the version this Codex copy was taken from, for a field-by-field review. */
    async getStoryCodexLibrary(ref:StoryCardRef):Promise<StoryCodexLibraryReview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(ref.storyId)}/codex/${encodeURIComponent(ref.id)}/library`,this.getStoredToken())
        if(!verifyStoryCodexLibraryReview(value,ref))throw new ApiError(502,'Unsupported library card.',{code:'story_contract',retryable:false})
        return value
    }
    /** The description a stage into this Codex entry's library card starts from (its draft, else its published body). */
    async getStoryCodexLibraryDraft(ref:StoryCardRef):Promise<StoryCodexLibraryDraft> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(ref.storyId)}/codex/${encodeURIComponent(ref.id)}/library-draft`,this.getStoredToken())
        if(!verifyStoryCodexLibraryDraft(value,ref.id))throw new ApiError(502,'Unsupported library draft.',{code:'story_contract',retryable:false})
        return value
    }
    /** Saves a reviewed description into the library card's private draft; publishing stays in the card editor. */
    async stageStoryCodexLibraryDraft(ref:StoryCardRef,description:string,expectedStamp:string):Promise<StoryCodexLibraryDraft> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(ref.storyId)}/codex/${encodeURIComponent(ref.id)}/library-draft`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:{description,expectedStamp} as unknown as BodyInit})
        if(!verifyStoryCodexLibraryDraft(value,ref.id)||value.basis!=='draft')throw new ApiError(502,'Unsupported library draft acknowledgement.',{code:'story_contract',retryable:false})
        return value
    }
    /** The library lorebook entry this Codex entry was copied from, as stored. */
    async getStoryCodexLibraryEntry(ref:StoryCardRef):Promise<StoryCodexLibraryEntry> {
        this.assertNovelsEnabled()
        this.assertLorebooksEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(ref.storyId)}/codex/${encodeURIComponent(ref.id)}/library-entry`,this.getStoredToken())
        if(!verifyStoryCodexLibraryEntry(value,ref))throw new ApiError(502,'Unsupported library lorebook entry.',{code:'story_contract',retryable:false})
        return value
    }
    /** Writes reviewed text into the library lorebook entry itself; it has no draft, so it applies at once. */
    async writeStoryCodexLibraryEntry(ref:StoryCardRef,content:string,expectedStamp:string):Promise<StoryCodexLibraryEntry> {
        this.assertNovelsEnabled()
        this.assertLorebooksEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(ref.storyId)}/codex/${encodeURIComponent(ref.id)}/library-entry`,this.getStoredToken(),
            {method:'POST',headers:{'Content-Type':'application/json'},body:{content,expectedStamp} as unknown as BodyInit})
        if(!verifyStoryCodexLibraryEntry(value,ref)||value.content!==content)throw new ApiError(502,'Unsupported library lorebook entry acknowledgement.',{code:'story_contract',retryable:false})
        return value
    }

    async previewStoryContext(storyId: string, request: StoryGenerateRequest): Promise<StoryContextTrace> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryContextTrace>(`/stories/${encodeURIComponent(storyId)}/context-preview`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                sceneId: request.sceneId, baseRevision:request.baseRevision,cursorOffset:request.cursorOffset,command: request.command, selection: request.selection,
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

            try {
                const result = await this.streamGeneratedResult<StoryGenerateResponse>(`/stories/${encodeURIComponent(storyId)}/generate/stream`, payload, null, { ...options, requestId })
                this.assertStoryExecutionResult(result, request.sceneId, requestId)
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
                        this.assertStoryExecutionResult(saved, request.sceneId, requestId)
                        return saved
                    }
                    console.warn('text_stream_recovery_failed', { requestId, surface: 'story' })
                }
                throw error
            }
        })
    }

    private assertStoryExecutionResult(result: StoryGenerateResponse, sceneId: string, requestId: string): void {
        const plan = result?.llm_execution
        const generation = result?.generation
        const keys = ['execution_id', 'profile_id', 'revision_id', 'resolution_source', 'credential_mode', 'replayed']
        if (!plan || typeof plan !== 'object' || Array.isArray(plan)
            || Object.keys(plan).some((key) => !keys.includes(key))
            || ![plan.execution_id, plan.profile_id, plan.revision_id].every((value) => typeof value === 'string' && value.length > 0)
            || !['user_feature', 'user_default', 'system_feature', 'system_default', 'explicit'].includes(plan.resolution_source)
            || !['platform', 'user_byok'].includes(plan.credential_mode) || typeof plan.replayed !== 'boolean'
            || generation?.id !== plan.execution_id || generation.requestId !== requestId
            || generation.sceneId !== sceneId || result.scene?.id !== sceneId
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
                    if (resultKey) result = candidate as T
                    else {
                        const saved: Record<string, unknown> = { ...event }
                        delete saved.type
                        delete saved.request_id
                        result = saved as T
                    }
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

    async acceptStoryGeneration(storyId:string,generationId:string,commit:StoryGenerationCommit): Promise<StoryScene> {
        this.assertNovelsEnabled()
        if('variant'in commit&&(!isStoryVariantReference(commit.variant)||commit.variant.id===generationId
            ||[commit.variant.id,generationId].includes(commit.requestId)))throw new ApiError(422,'Invalid authored version application.',{code:'story_variant_contract',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/accept`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:commit as unknown as BodyInit})
        if(!matchesStoryWrite(value,commit))throw new ApiError(502,'The accepted scene acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return this.storySceneAcknowledgement(value,storyId,commit.sceneId)
    }
    /** Accepts 2–12 reviewed suggestions in distinct scenes as one manuscript changeset (R14): all scenes are written or none. */
    async acceptStoryGenerationsTogether(storyId:string,write:StoryGenerationChangesetWrite):Promise<StoryGenerationChangeset> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generations/accept-together`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyGenerationChangeset(value,storyId,write))throw new ApiError(502,'The changeset acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return value
    }
    /** The saved acknowledgement of a changeset request, so a lost response is recovered instead of sent again; null when it was never written. */
    async getStoryGenerationChangeset(storyId:string,write:StoryGenerationChangesetWrite):Promise<StoryGenerationChangeset|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/generation-changesets/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyGenerationChangeset(value,storyId,write))throw new ApiError(502,'Unsupported changeset recovery receipt.',{code:'story_contract',retryable:false})
        return value
    }
    /** Puts back the writing from before the changeset in every scene that still holds it; later writing is kept and reported. */
    async undoStoryGenerationChangeset(changeset:StoryGenerationChangeset,requestId:string):Promise<StoryGenerationChangesetUndo> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(changeset.storyId)}/generation-changesets/${encodeURIComponent(changeset.requestId)}/undo`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:{requestId} as unknown as BodyInit})
        if(!verifyGenerationChangesetUndo(value,changeset))throw new ApiError(502,'The changeset undo acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryRevisions(storyId:string,sceneId:string,query:StorySceneRevisionQuery={}): Promise<StorySceneRevisionPage> {
        this.assertNovelsEnabled()
        const params=new URLSearchParams()
        if(query.before!==undefined)params.set('before',String(query.before))
        if(query.source)params.set('source',query.source)
        if(query.actor)params.set('actor',query.actor)
        if(query.fromDate)params.set('from_date',query.fromDate)
        if(query.throughDate)params.set('through_date',query.throughDate)
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}/revisions${params.size?'?'+params.toString():''}`,this.getStoredToken())
        if(!verifySceneRevisionPage(value,storyId,sceneId,query))throw new ApiError(502,'Unsupported scene history summary.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryRevision(storyId:string,sceneId:string,revision:number,expectedHash?:string,options:{signal?:AbortSignal}={}):Promise<StoryDocumentRevision> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}/revisions/${revision}`,this.getStoredToken(),{signal:options.signal})
        if(!verifySceneRevision(value,storyId,sceneId,revision,expectedHash))throw new ApiError(502,'Unsupported scene checkpoint.',{code:'story_contract',retryable:false})
        return value
    }
    async restoreStoryRevision(storyId:string,sceneId:string,revision:number,write:StorySceneRestoreWrite): Promise<StorySceneRestoreAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}/revisions/${revision}/restore`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifySceneRestoreAck(value,storyId,sceneId,revision,write))throw new ApiError(502,'The scene restore acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryRevisionRestoreResult(storyId:string,sceneId:string,revision:number,write:StorySceneRestoreWrite):Promise<StorySceneRestoreAcknowledgement|null> {
        this.assertNovelsEnabled()
        const query=new URLSearchParams({expectedRevision:String(write.expectedRevision),expectedContentHash:write.expectedContentHash,sourceContentHash:write.sourceContentHash})
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}/revisions/${revision}/restore-requests/${encodeURIComponent(write.requestId)}?${query}`,this.getStoredToken())
        if(value===null)return null
        if(!verifySceneRestoreAck(value,storyId,sceneId,revision,write))throw new ApiError(502,'Unsupported scene restore recovery receipt.',{code:'story_contract',retryable:false})
        return value
    }

    async stashStoryGeneration(storyId: string, generationId: string): Promise<unknown> {
        this.assertNovelsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/stash`, token, {
            method: 'POST',
        })
    }

    async getStoryAnnotations(storyId:string,query:StoryAnnotationQuery={}):Promise<StoryAnnotationPage> {
        this.assertNovelsEnabled()
        const params=new URLSearchParams()
        if(query.sceneId)params.set('scene_id',query.sceneId)
        if(query.state)params.set('state',query.state)
        if(query.anchorState)params.set('anchor_state',query.anchorState)
        if(query.kind)params.set('kind',query.kind)
        if(query.before)params.set('before',query.before)
        if(query.q)params.set('q',query.q)
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/annotations${params.size?'?'+params.toString():''}`,this.getStoredToken())
        if(!verifyAnnotationPage(value,storyId,query))throw new ApiError(502,'Unsupported annotation summary.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryAnnotationCopyPreview(storyId:string,kind:'note'|'bookmark'='note'):Promise<StoryAnnotationCopyPreview> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/annotation-copy-preview${kind==='bookmark'?'?kind=bookmark':''}`,this.getStoredToken())
        if(!verifyAnnotationCopyPreview(value,storyId,kind))throw new ApiError(502,'Unsupported personal-note copy summary.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryAnnotation(storyId:string,annotationId:string):Promise<StoryAnnotation> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/annotations/${encodeURIComponent(annotationId)}`,this.getStoredToken())
        if(!verifyAnnotation(value,storyId,annotationId))throw new ApiError(502,'Unsupported personal note.',{code:'story_contract',retryable:false})
        return value
    }
    async changeStoryAnnotation(storyId:string,write:StoryAnnotationWrite):Promise<StoryAnnotationAcknowledgement> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/annotations`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyAnnotationAck(value,storyId,write))throw new ApiError(502,'The personal-note acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryAnnotationResult(storyId:string,write:StoryAnnotationWrite):Promise<StoryAnnotationAcknowledgement|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/annotation-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyAnnotationAck(value,storyId,write))throw new ApiError(502,'Unsupported personal-note recovery receipt.',{code:'story_contract',retryable:false})
        return value
    }

    async listStoryPlanItems<K extends StoryPlanKind>(storyId:string,kind:K,query:StoryPlanQuery={}):Promise<StoryPlanPage<K>> {
        this.assertNovelsEnabled()
        const params=new URLSearchParams({kind})
        if(query.state)params.set('state',query.state)
        if(query.sceneId)params.set('scene_id',query.sceneId)
        if(query.q)params.set('q',query.q)
        if(query.includeTrashed)params.set('include_trashed','true')
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/plan-items?${params.toString()}`,this.getStoredToken())
        if(!verifyPlanPage(value,storyId,kind))throw new ApiError(502,'Unsupported planning items.',{code:'story_contract',retryable:false})
        return value
    }
    async changeStoryPlanItem<K extends StoryPlanKind>(storyId:string,write:StoryPlanWrite<K>):Promise<StoryPlanAcknowledgement<K>> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/plan-items`,this.getStoredToken(),{method:'POST',headers:{'Content-Type':'application/json'},body:write as unknown as BodyInit})
        if(!verifyPlanAck(value,storyId,write))throw new ApiError(502,'The planning acknowledgement does not match this request.',{code:'story_contract',retryable:false})
        return value
    }
    async getStoryPlanItemResult<K extends StoryPlanKind>(storyId:string,write:StoryPlanWrite<K>):Promise<StoryPlanAcknowledgement<K>|null> {
        this.assertNovelsEnabled()
        const value=await this.authenticatedRequest<unknown>(`/stories/${encodeURIComponent(storyId)}/plan-item-requests/${encodeURIComponent(write.requestId)}`,this.getStoredToken())
        if(value===null)return null
        if(!verifyPlanAck(value,storyId,write))throw new ApiError(502,'Unsupported planning recovery receipt.',{code:'story_contract',retryable:false})
        return value
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
        assertFeatureEnabled('adventures')
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
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-templates/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: stripCardBodyOrganization(stripVoiceProjections(templateData))
        })
    }

    /**
     * Generate + persist a new adventure template from a description via the AI
     * endpoint. The backend creates the card and returns it.
     */
    async createAdventureTemplateAI(description: string, options: AiCardRequestOptions = {}): Promise<AiCardGeneratedResult<AdventureTemplateCardResponse>> {
        assertFeatureEnabled('adventures')
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
        if (body.kind === 'card') assertContentTypeFeatureEnabled(body.card_type)
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
            return { conversations: history.conversations.filter((conversation) => this.assistantKindEnabled(conversation.kind) && (conversation.kind !== 'card' || isContentTypeFeatureEnabled(conversation.card_type ?? ''))) }
        }
        this.assertAssistantKindEnabled(scope.kind)
        if (scope.kind === 'card') assertContentTypeFeatureEnabled(scope.card_type)
        const params = new URLSearchParams({ kind: scope.kind })
        if (scope.kind === 'card') {
            params.set('card_type', scope.card_type)
            if (scope.card_id) params.set('card_id', scope.card_id)
        }
        if (scope.kind === 'lorebook' && scope.lorebook_id) params.set('lorebook_id', scope.lorebook_id)
        if (scope.kind === 'novel') params.set('story_id',scope.story_id)
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
    /** Read-only published-profile preview; this never sends a provider credential. */
    async previewNovelAssistantTurn(conversationId:number,index:StoryStudioIndex,body:Pick<AssistantTurnRequest<'novel'>,'message'|'source'|'expected_packet_hash'|'refinement'|'preset'>,options:AssistantRequestOptions={}):Promise<NovelAssistantTurnPreview> {
        this.assertAssistantKindEnabled('novel')
        if(options.llm?.credentials || options.llm?.retry_of_execution_id)throw new ApiError(422,'A turn preview does not take credentials or dispatch a retry.',{code:'novel_assistant_preview_input',retryable:false})
        const value=await this.authenticatedRequest<unknown>(`/assistant/conversations/${conversationId}/novel-preview`,this.getStoredToken(),{
            method:'POST',body:{...body,kind:'novel',llm:options.llm??{}} as unknown as BodyInit,...this.assistantRequestOptions(options),
        })
        if(!verifyNovelAssistantPreview(value,conversationId,index,body.source,body.refinement??null,body.preset??null))throw new ApiError(502,'Invalid novel assistant turn preview.',{code:'novel_assistant_preview_contract',retryable:false})
        return value
    }

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

    /** A novel control read keeps terminal uncertainty visible instead of returning null. */
    async getNovelAssistantTurnState(storyId: string, conversationId: number, requestId: string,
        options: AssistantRequestOptions = {}): Promise<NovelAssistantTurnState> {
        return this.novelAssistantTurnControl('GET', storyId, conversationId, requestId, options)
    }

    /** Explicit Stop takes the retained identity only; it never resolves a profile or requests a key. */
    async stopNovelAssistantTurn(storyId: string, conversationId: number, requestId: string,
        options: AssistantRequestOptions = {}): Promise<NovelAssistantTurnState> {
        return this.novelAssistantTurnControl('POST', storyId, conversationId, requestId, options)
    }

    private async novelAssistantTurnControl(method: 'GET' | 'POST', storyId: string, conversationId: number,
        requestId: string, options: AssistantRequestOptions): Promise<NovelAssistantTurnState> {
        this.assertAssistantKindEnabled('novel')
        const owner = authSession.getSnapshot()
        const detail = await this.getAssistantConversation('novel', conversationId, { signal: options.signal, timeoutMs: options.timeoutMs })
        this.assertCurrentOwner(owner)
        options.signal?.throwIfAborted()
        if (detail.conversation.story_id !== storyId) throw new ApiError(409, 'The assistant belongs to another novel.', { code: 'ASSISTANT_SCOPE_CHANGED' })
        const result = await this.authenticatedRequest<unknown>(
            `/assistant/conversations/${conversationId}/turns/${encodeURIComponent(requestId)}${method === 'POST' ? '/stop' : ''}`,
            this.getStoredToken(), { method, signal: options.signal, timeoutMs: options.timeoutMs,
                ...(method === 'POST' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}) })
        this.assertCurrentOwner(owner)
        options.signal?.throwIfAborted()
        if (!verifyNovelAssistantTurnState(result, storyId, conversationId, requestId)) {
            throw new ApiError(502, 'The assistant returned an invalid request state.', { code: 'assistant_control_contract', retryable: false })
        }
        return result
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
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: stripCardBodyOrganization(stripVoiceProjections(templateData))
        })
    }

    /**
     * Delete an adventure template
     */
    async deleteAdventureTemplate(templateId: string): Promise<any> {
        assertFeatureEnabled('adventures')
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
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get a specific adventure session by ID
     */
    async getAdventureSession(sessionId: number): Promise<any> {
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'GET'
        })
    }

    async getAdventureSessionMessages(sessionId: number): Promise<AdventureSessionMessagesResponse> {
        assertFeatureEnabled('adventures')
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
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: { content } as unknown as BodyInit,
        })
    }

    /** Make this reply the active version of the latest exchange; the others stay stored. */
    async activateAdventureSessionMessage(sessionId: number, messageId: number): Promise<StoredConversationMessage> {
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}/activate`, token, {
            method: 'POST'
        })
    }

    async deleteAdventureSessionMessage(sessionId: number, messageId: number): Promise<any> {
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}`, token, {
            method: 'DELETE'
        })
    }

    async clearAdventureSessionMessages(sessionId: number): Promise<any> {
        assertFeatureEnabled('adventures')
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

    /**
     * Start another image for a completed assistant message (regenerate, or an
     * edited prompt). Answers 202 once the job exists, before it finishes; the
     * socket frames and job polling carry it from there. `null` means the job
     * was slow to create: frames and the listing still deliver it. Throws
     * `ChatImagesUnsupportedError` on a server that has no such endpoint.
     * `credentials` (a personal profile's key) only ever travels over HTTPS.
     */
    async generateChatMessageImage(basePath: ChatImageBasePath, sessionId: number, messageId: number, body: ChatImageGenerateBody = {}): Promise<ChatImageGeneration | null> {
        if (body.credentials && !API_BASE_URL.startsWith('https://')) throw new Error('IMAGE_CREDENTIAL_HTTPS_REQUIRED')
        const value = await chatImagesRequest(() => trackResourceTaskRequest(() => this.authenticatedRequest<unknown>(
            chatMessageImagesPath(basePath, sessionId, messageId), this.getStoredToken(), {
                method: 'POST',
                cache: 'no-store',
                body: body as unknown as BodyInit,
            }), this.workspaceScope?.workspaceId ?? null))
        const generation = value && typeof value === 'object' ? (value as { generation?: unknown }).generation : undefined
        if (generation === null) return null
        if (!isChatImageGenerationWire(generation)) throw new ApiError(502, 'The image response was not recognised.', { code: 'chat_image_contract' })
        return generation
    }

    /** The image jobs of one assistant message, newest first, as the server keeps them. Throws `ChatImagesUnsupportedError` on an older server. */
    async listChatMessageImages(basePath: ChatImageBasePath, sessionId: number, messageId: number, signal?: AbortSignal): Promise<ChatImageGeneration[]> {
        const value = await chatImagesRequest(() => this.authenticatedRequest<unknown>(
            chatMessageImagesPath(basePath, sessionId, messageId), this.getStoredToken(), { method: 'GET', cache: 'no-store', signal }))
        const list = Array.isArray(value) ? value : (value as { items?: unknown } | null)?.items
        if (!Array.isArray(list)) throw new ApiError(502, 'The image list was not recognised.', { code: 'chat_image_contract' })
        return list.filter(isChatImageGenerationWire)
    }

    /* ------------------------------ voice call ------------------------------ */

    async saveVoiceConsent(sessionId: number, options: { signal?: AbortSignal; consentVersion?: 'voice-v2' | 'voice-v3' } = {}): Promise<VoiceConsentResponse> {
        this.assertCallsEnabled()
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceConsentResponse>(`/character-chats/${sessionId}/voice-consent`, token, {
            method: 'POST',
            body: (options.consentVersion ? { consent_version: options.consentVersion } : {}) as unknown as BodyInit,
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

    async getSceneNarration(basePath: VoiceSessionBasePath, sessionId: number, turn: import('@/shared/types/voiceScene.types').SceneNarrationRequest): Promise<SceneNarrationResponse> {
        this.assertVoicesEnabled()
        const query = new URLSearchParams({ assistant_message_id: String(turn.assistant_message_id), turn_id: turn.turn_id })
        return this.authenticatedRequest(`/${basePath}/${sessionId}/scene-narration?${query}`, this.getStoredToken(), { method: 'GET' })
    }

    async generateSceneNarration(basePath: VoiceSessionBasePath, sessionId: number, turn: import('@/shared/types/voiceScene.types').SceneNarrationRequest): Promise<SceneNarrationResponse> {
        this.assertVoicesEnabled()
        return this.authenticatedRequest(`/${basePath}/${sessionId}/scene-narration`, this.getStoredToken(), {
            method: 'POST', body: turn as unknown as BodyInit,
        })
    }

    async getTtsJob(jobId: string): Promise<TtsJobPublicResponse> {
        this.assertVoicesEnabled()
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
        this.assertVoicesEnabled()
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
     * `credentials` (a personal profile's key) only ever travels over HTTPS.
     */
    async generateCardPortrait(body: CardPortraitRequest, options: AiCardRequestOptions = {}): Promise<ImageJobPublicResponse> {
        if (body.credentials && !API_BASE_URL.startsWith('https://')) throw new Error('IMAGE_CREDENTIAL_HTTPS_REQUIRED')
        const token = this.getStoredToken()
        return trackResourceTaskRequest(() => this.authenticatedRequest<ImageJobPublicResponse>('/images/card-portrait', token, {
            method: 'POST',
            cache: 'no-store',
            headers: this.aiHeaders(options),
            body: body as unknown as BodyInit,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        }), this.workspaceScope?.workspaceId ?? null)
    }

    // --- Image profiles ----------------------------------------------------
    // Root owns the system profiles and the global default; every user picks a
    // profile and may keep personal BYOK profiles. No call here carries a key.

    getImageCatalog(): Promise<ImageCatalog> {
        return this.profileRequest('/images/catalog')
    }

    /** Active app profiles plus the caller's own, with the defaults. */
    getImageProfiles(): Promise<ImageProfileList> {
        return this.profileRequest('/images/profiles')
    }

    /** Pick a personal default image profile; null falls back to the app default. */
    setImagePreference(profileId: string | null): Promise<ImageProfileList> {
        return this.profileRequest('/images/preferences', 'PUT', { profile_id: profileId })
    }

    createImageProfile(payload: ImageProfileMutation, system = false): Promise<ImageProfile> {
        return this.profileRequest(system ? '/admin/images/profiles' : '/user/images/profiles', 'POST', payload)
    }

    updateImageProfile(profileId: string, payload: ImageProfileMutation, version: number, system = false): Promise<ImageProfile> {
        const base = system ? '/admin/images/profiles' : '/user/images/profiles'
        return this.profileRequest(`${base}/${encodeURIComponent(profileId)}`, 'PATCH', payload, version)
    }

    archiveImageProfile(profileId: string, version: number, system = false): Promise<ImageProfile> {
        const base = system ? '/admin/images/profiles' : '/user/images/profiles'
        return this.profileRequest(`${base}/${encodeURIComponent(profileId)}/archive`, 'POST', undefined, version)
    }

    /** Root: every system profile, archived ones included. */
    getSystemImageProfiles(): Promise<ImageProfileList> {
        return this.profileRequest('/admin/images/profiles')
    }

    /** Root: add a 1-credit profile for each starter model that has no active one. */
    seedStarterImageProfiles(): Promise<ImageProfileList> {
        return this.profileRequest('/admin/images/profiles/starter', 'POST')
    }

    /** Root: the profile every generation uses when the user has not picked one. */
    setGlobalImageDefault(profileId: string): Promise<ImageProfileList> {
        return this.profileRequest('/admin/images/default', 'PUT', { profile_id: profileId })
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
            operation?: BackgroundTaskOperation | 'all'
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
        if (operation !== 'all' && !isOperationFeatureEnabled(operation)) return { items: [], limit, offset, next_offset: null }
        const result = await this.authenticatedRequest<BackgroundTaskListResponse>(`/tasks?${query}`, token, { method: 'GET' })
        return { ...result, items: result.items.filter(isTaskFeatureEnabled) }
    }

    async getTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        if (!isOperationFeatureEnabled(operation)) throw new Error('This task feature is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'GET' })
    }

    async cancelTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        if (!isOperationFeatureEnabled(operation)) throw new Error('This task feature is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'DELETE' })
    }

    async archiveTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        if (!isOperationFeatureEnabled(operation)) throw new Error('This task feature is disabled.')
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
        assertFeatureEnabled('adventures')
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
        assertFeatureEnabled('adventures')
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/template-snapshot`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            // Defence in depth: `writableAdventureSnapshot` already strips the projections (D35).
            body: stripVoiceProjections({
                template: snapshot.template,
                narrator_voice: snapshot.narrator_voice ?? null,
                narrate_thoughts: snapshot.narrate_thoughts ?? false,
            }) as unknown as BodyInit
        })
    }

    /**
     * Delete an adventure session
     */
    async deleteAdventureSession(sessionId: number): Promise<any> {
        assertFeatureEnabled('adventures')
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
        assertFeatureEnabled('groupChats')
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
export {
    classifyWorkspaceCapabilities,
    isWorkspaceUuid,
    stripCardBodyOrganization,
    stripOrganization,
    WORKSPACE_CONTRACT_VERSION,
    type WorkspaceCapabilityVerdict,
} from './workspaceContract'
