import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Info, KeyRound, RefreshCw, RotateCcw } from 'lucide-react'
import type { ChatImageError, ChatImageGeneration } from '../../../shared'
import { Button, Icon, IconButton } from '@/ui/primitives'
import type { ChatImageRegenerateOptions, ChatTurnImagesView } from '../hooks/useChatImages'
import { isSafeAssetUrl, type ChatImageStartFailure } from '../utils/chatImageStore'
import { useChatImageActions, type ChatImageActions } from './chatImageActions'
import { DEFAULT_SCENE_ASPECT, SCENE_OVERLAY_BUTTON, SceneImage, SceneImageNotice, SceneImagePlaceholder } from './GeneratedImage'
import { ReplyVersionSwitcher } from './ReplyVersionSwitcher'

interface ChatTurnImagesProps {
    /** The assistant message the images belong to; nothing renders before it is known. */
    messageId?: number
    images?: ChatTurnImagesView
    /** The turn has a scene prompt, so an image can be generated for it on request. */
    hasPrompt?: boolean
    streaming?: boolean
}

/**
 * Every scene image of one chat turn, newest shown first, with a pager to look
 * back. One aspect-reserved box carries the whole lifecycle: "starting" from
 * the end of the reply, then queued, generating and saving, then loading until
 * the image paints. Failures, a missing key, a quota, a removed image and an
 * image that never started each say so in a line under the turn.
 */
export function ChatTurnImages({ messageId, images, hasPrompt = false, streaming = false }: ChatTurnImagesProps) {
    const { t } = useTranslation()
    const actions = useChatImageActions()
    if (streaming || !messageId) return null

    const canGenerate = Boolean(actions?.canGenerate)
    const generations = images?.generations ?? []
    const found = generations.findIndex((generation) => generation.job_id === images?.selectedJobId)
    const index = found >= 0 ? found : generations.length - 1
    const selected = generations[index]
    const regenerate = (generation?: ChatImageGeneration) => actions?.regenerate(messageId, regenerateOptions(generation))
    const startFailure = images?.startFailure
    const retryStart = () => { if (startFailure) actions?.regenerate(messageId, retryOptions(startFailure)) }

    let body: ReactNode = null
    if (selected) {
        body = <GenerationBody messageId={messageId} generation={selected} actions={actions} onRegenerate={() => regenerate(selected)} />
    } else if (startFailure) {
        body = <FailureNotice messageId={messageId} failure={startFailure} actions={actions} onRetry={retryStart} />
    } else if (images?.scheduled && images.stalled) {
        body = (
            <SceneImageNotice tone="quiet" action={canGenerate && <NoticeButton icon={RotateCcw} onClick={() => regenerate()}>{t('interaction.image.retry')}</NoticeButton>}>
                {t('interaction.image.notStarted')}
            </SceneImageNotice>
        )
    } else if (images?.scheduled) {
        body = <SceneImagePlaceholder stage="starting" />
    } else if (hasPrompt && canGenerate) {
        body = (
            <Button variant="ghost" size="sm" className="self-start" iconLeft={<Icon icon={ImagePlus} size={16} />} onClick={() => regenerate()}>
                {t('interaction.image.generate')}
            </Button>
        )
    }

    // A refused regenerate leaves the shown image in place and explains under it.
    const refusal = selected && startFailure
        ? <FailureNotice messageId={messageId} failure={startFailure} actions={actions} onRetry={retryStart} />
        : null
    if (!body && !refusal) return null

    return (
        <div className="mt-4 flex w-full flex-col gap-2" data-testid="chat-turn-images">
            {body}
            {refusal}
            {generations.length > 1 && (
                <ReplyVersionSwitcher
                    index={index}
                    count={generations.length}
                    onSelect={(next) => actions?.select(messageId, generations[next].job_id)}
                    disabled={!actions}
                    labels={{
                        group: t('interaction.image.pager.group'),
                        previous: t('interaction.image.pager.previous'),
                        next: t('interaction.image.pager.next'),
                        position: t('interaction.image.pager.position', { index: index + 1, count: generations.length }),
                    }}
                />
            )}
        </div>
    )
}

function GenerationBody({ messageId, generation, actions, onRegenerate }: {
    messageId: number
    generation: ChatImageGeneration
    actions: ChatImageActions | null
    onRegenerate: () => void
}) {
    const { t } = useTranslation()
    const canGenerate = Boolean(actions?.canGenerate)
    // The store already filters assets; a view built elsewhere is filtered here too.
    const asset = generation.assets.find((candidate) => isSafeAssetUrl(candidate.url))
    const aspectRatio = asset?.width && asset.height ? asset.width / asset.height : parseAspectRatio(generation.aspect_ratio)

    switch (generation.status) {
        case 'pending':
        case 'in_progress':
        case 'mirroring':
            return <SceneImagePlaceholder stage={generation.status} aspectRatio={aspectRatio} />
        case 'completed': {
            if (!asset) {
                return (
                    <SceneImageNotice tone="quiet" action={canGenerate && <NoticeButton icon={RefreshCw} onClick={onRegenerate}>{t('interaction.image.regenerate')}</NoticeButton>}>
                        {t('interaction.image.deleted')}
                    </SceneImageNotice>
                )
            }
            const cost = generation.credit_cost ?? 0
            const regenerateLabel = cost > 0 ? t('interaction.image.regenerateCost', { count: cost }) : t('interaction.image.regenerate')
            const overlay = (
                <>
                    {actions?.openDetails && (
                        <IconButton label={t('interaction.image.details')} size="sm" className={SCENE_OVERLAY_BUTTON} onClick={() => actions.openDetails?.(messageId, generation.job_id)}>
                            <Icon icon={Info} size={16} />
                        </IconButton>
                    )}
                    {canGenerate && (
                        <IconButton label={regenerateLabel} size="sm" className={SCENE_OVERLAY_BUTTON} onClick={onRegenerate}>
                            <Icon icon={RefreshCw} size={16} />
                        </IconButton>
                    )}
                </>
            )
            return <SceneImage key={asset.url} url={asset.url} aspectRatio={aspectRatio} actions={overlay} />
        }
        case 'unavailable':
            return <SceneImageNotice tone="quiet">{t('interaction.image.unavailable')}</SceneImageNotice>
        default:
            return (
                <FailureNotice
                    messageId={messageId}
                    failure={{ status: generation.status, error: generation.error ?? { category: 'failed', detail: '' }, image_profile_id: generation.image_profile_id, provider: generation.provider }}
                    actions={actions}
                    onRetry={onRegenerate}
                />
            )
    }
}

function FailureNotice({ messageId, failure, actions, onRetry }: {
    messageId: number
    failure: ChatImageStartFailure
    actions: ChatImageActions | null
    onRetry: () => void
}) {
    const { t } = useTranslation()
    const canGenerate = Boolean(actions?.canGenerate)
    if (isKeyNeeded(failure.error)) {
        const addKey = actions?.addKeyAndGenerate
        return (
            <SceneImageNotice
                tone="quiet"
                action={canGenerate && addKey && (
                    <NoticeButton icon={KeyRound} onClick={() => addKey(messageId, { provider: failure.provider ?? 'fal', imageProfileId: failure.image_profile_id })}>
                        {t('interaction.image.addKeyAndGenerate')}
                    </NoticeButton>
                )}
            >
                {t('interaction.image.keyNeeded')}
            </SceneImageNotice>
        )
    }
    if (failure.status === 'unavailable') return <SceneImageNotice tone="quiet">{t('interaction.image.unavailable')}</SceneImageNotice>
    if (failure.status === 'quota_exceeded' || failure.error.code === 'quota_exceeded') {
        return <SceneImageNotice>{t('interaction.image.quota')}</SceneImageNotice>
    }
    return (
        <SceneImageNotice action={canGenerate && <NoticeButton icon={RotateCcw} onClick={onRetry}>{t('interaction.image.retry')}</NoticeButton>}>
            {failure.error.detail || t('interaction.image.failed')}
        </SceneImageNotice>
    )
}

function NoticeButton({ icon, onClick, children }: { icon: typeof RotateCcw; onClick: () => void; children: ReactNode }) {
    return (
        <Button variant="ghost" size="xs" iconLeft={<Icon icon={icon} size={14} />} onClick={onClick}>
            {children}
        </Button>
    )
}

/** Another image on the same profile; a personal (BYOK) profile also names its provider so the held key rides along. */
function regenerateOptions(generation?: ChatImageGeneration): ChatImageRegenerateOptions {
    if (!generation?.image_profile_id) return {}
    return {
        imageProfileId: generation.image_profile_id,
        ...(generation.credential_mode === 'user_byok' && generation.provider ? { provider: generation.provider } : {}),
    }
}

/** Codes that refuse the profile itself: retrying it would fail the same way, so Retry uses the default one. */
const PROFILE_REFUSED_CODES = new Set(['chat_image_provider_unsupported', 'image_profile_requires_platform', 'image_profile_unavailable'])

function retryOptions(failure: ChatImageStartFailure): ChatImageRegenerateOptions {
    if (!failure.image_profile_id || PROFILE_REFUSED_CODES.has((failure.error.code ?? '').toLowerCase())) return {}
    return { imageProfileId: failure.image_profile_id, ...(failure.provider ? { provider: failure.provider } : {}) }
}

function isKeyNeeded(error: ChatImageError | null | undefined): boolean {
    return (error?.code ?? '').toLowerCase() === 'provider_credentials_missing'
}

function parseAspectRatio(value: string | null | undefined): number {
    const match = value ? /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value) : null
    const ratio = match ? Number(match[1]) / Number(match[2]) : Number.NaN
    return Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_SCENE_ASPECT
}
