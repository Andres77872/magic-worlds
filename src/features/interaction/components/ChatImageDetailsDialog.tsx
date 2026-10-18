/**
 * One scene image's details: the image, the scene prompt it was drawn from
 * (editable), the model and how it was made, and a regenerate that runs the
 * edited prompt on the chosen model. Regenerating adds an image to the turn;
 * the one shown here stays. Prompt text belongs to the player who owns the
 * chat and is shown only here, never in socket frames.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Images, RefreshCw, RotateCcw } from 'lucide-react'
import type { ChatImageGeneration, ImageProfile } from '@/shared'
import { ImageKeyDialog } from '@/features/imageProfiles/ImageKeyDialog'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { AuthenticatedImage, Button, Field, Icon, Modal, Select, Textarea } from '@/ui/primitives'
import { formatApiDateTime } from '@/utils/time'
import type { ChatImageRegenerateOptions } from '../hooks/useChatImages'

/** The server's limit for an edited scene prompt. */
export const CHAT_SCENE_PROMPT_MAX = 2000
// The server refuses links and inline data in a scene prompt.
const REFUSED_PROMPT = /(https?:\/\/|data:)/i

export interface ChatImageDetailsDialogProps {
    /** The image shown; null closes the dialog. */
    generation: ChatImageGeneration | null
    /** The profiles chat images can run on (`chatPickableProfiles`). */
    profiles: readonly ImageProfile[]
    defaultId: string | null
    /** New images can be requested (the server supports it and the chat is writable). */
    canGenerate: boolean
    onClose: () => void
    onRegenerate: (options: ChatImageRegenerateOptions) => void
}

export function ChatImageDetailsDialog({ generation, profiles, defaultId, canGenerate, onClose, onRegenerate }: ChatImageDetailsDialogProps) {
    const { t } = useTranslation()
    const jobId = generation?.job_id ?? null
    const original = generation?.prompt?.trim() ?? ''
    const initialProfile = generation?.image_profile_id && profiles.some(profile => profile.profile_id === generation.image_profile_id)
        ? generation.image_profile_id : ''
    const [draft, setDraft] = useState({ jobId, prompt: original, profileId: initialProfile })
    const [copied, setCopied] = useState(false)
    const [keyNeeded, setKeyNeeded] = useState<ImageProfile | null>(null)
    // The asset that failed to load; another asset (a new job) gets its own try.
    const [failedUrl, setFailedUrl] = useState<string | null>(null)
    const copiedTimer = useRef<number | null>(null)

    // Another image opened: start from its own prompt and model.
    let current = draft
    if (draft.jobId !== jobId) {
        current = { jobId, prompt: original, profileId: initialProfile }
        setDraft(current)
        setCopied(false)
    }

    useEffect(() => () => { if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current) }, [])

    if (!generation) return null

    const prompt = current.prompt
    const chosen = profiles.find(profile => profile.profile_id === current.profileId)
    const runsOn = chosen ?? profiles.find(profile => profile.profile_id === defaultId)
    const promptIssue = prompt.length > CHAT_SCENE_PROMPT_MAX ? t('chatImages.details.promptTooLong', { count: CHAT_SCENE_PROMPT_MAX })
        : REFUSED_PROMPT.test(prompt) ? t('chatImages.details.promptLinks') : null
    const asset = generation.assets[0]
    const providerName = generation.provider ? t(`imageProfiles.providers.${generation.provider}`) : null
    const price = (profile: ImageProfile) => profile.credential_mode === 'user_byok'
        ? t('chatImages.control.yourKey') : t('chatImages.control.credits', { count: profile.credit_cost })
    const regenerateLabel = runsOn && runsOn.credential_mode === 'platform' && runsOn.credit_cost > 0
        ? t('chatImages.details.regenerateCost', { count: runsOn.credit_cost }) : t('chatImages.details.regenerate')
    const howMade = generation.trigger === 'regenerate'
        ? t(generation.prompt_edited ? 'chatImages.details.triggers.edited' : 'chatImages.details.triggers.regenerate')
        : t('chatImages.details.triggers.auto')
    const cost = generation.credential_mode === 'user_byok' ? t('chatImages.details.costYourKey')
        : typeof generation.credit_cost === 'number' ? t('chatImages.control.credits', { count: generation.credit_cost }) : null
    const metadata: Array<[string, string | null | undefined]> = [
        [t('chatImages.details.fields.model'), generation.model_display_name ?? generation.model],
        [t('chatImages.details.fields.profile'), generation.profile_name],
        [t('chatImages.details.fields.provider'), providerName],
        [t('chatImages.details.fields.size'), asset?.width && asset.height ? `${asset.width} × ${asset.height}` : null],
        [t('chatImages.details.fields.seed'), typeof asset?.seed === 'number' ? String(asset.seed) : null],
        [t('chatImages.details.fields.created'), formatApiDateTime(generation.created_at)],
        [t('chatImages.details.fields.status'), t(`chatImages.details.status.${generation.status}`)],
        [t('chatImages.details.fields.cost'), cost],
        [t('chatImages.details.fields.trigger'), howMade],
    ]

    const setPrompt = (value: string) => setDraft({ ...current, prompt: value })
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(prompt)
            setCopied(true)
            if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
            copiedTimer.current = window.setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard refused (permissions, insecure context): nothing to report beyond the unchanged label.
        }
    }

    const run = () => {
        const edited = prompt.trim()
        onRegenerate({
            ...(edited && edited !== original ? { prompt: edited } : {}),
            ...(chosen ? { imageProfileId: chosen.profile_id } : {}),
            ...(chosen?.credential_mode === 'user_byok' ? { provider: chosen.provider } : {}),
        })
        onClose()
    }

    const regenerate = () => {
        if (promptIssue) return
        // A personal profile runs on the player's key: ask for it first when none is held.
        if (chosen?.credential_mode === 'user_byok' && !imageCredentialSession.has(chosen.provider)) {
            setKeyNeeded(chosen)
            return
        }
        run()
    }

    const submitKey = (key: string) => {
        if (!keyNeeded) return
        imageCredentialSession.remember(keyNeeded.provider, key)
        setKeyNeeded(null)
        run()
    }

    const options = [
        { value: '', label: runsOn && !chosen && defaultId ? t('chatImages.control.useDefaultNamed', { name: runsOn.name }) : t('chatImages.control.useDefault') },
        ...profiles.map(profile => ({
            value: profile.profile_id,
            label: profile.name,
            textValue: profile.name,
            description: `${profile.model_display_name ?? profile.model_id} · ${price(profile)}`,
        })),
    ]

    return <>
        <Modal open={keyNeeded === null} onClose={onClose} size="lg" icon={<Icon icon={Images} size={18} />}
            title={t('chatImages.details.title')}
            footer={<>
                <Button variant="ghost" onClick={onClose}>{t('chatImages.details.close')}</Button>
                {canGenerate && <Button iconLeft={<Icon icon={RefreshCw} size={15} />} disabled={promptIssue !== null} onClick={regenerate}>
                    {regenerateLabel}
                </Button>}
            </>}>
            <div className="flex flex-col gap-4">
                {asset && failedUrl !== asset.url
                    ? <AuthenticatedImage src={asset.url} alt={t('chatImages.details.imageAlt')} onError={() => setFailedUrl(asset.url)}
                        // The box keeps the image's shape while its bytes load.
                        style={asset.width && asset.height ? { aspectRatio: `${asset.width} / ${asset.height}` } : undefined}
                        className="max-h-[40vh] w-full rounded-md bg-ink-900 object-contain" />
                    : <p className="rounded-md bg-ink-900 px-3 py-6 text-center text-caption text-parchment-400">
                        {t(asset ? 'interaction.image.loadFailed' : 'chatImages.details.noImage')}
                    </p>}

                <Field label={t('chatImages.details.prompt')} error={promptIssue ?? undefined}
                    helper={promptIssue ? undefined : t(original ? 'chatImages.details.promptHelper' : 'chatImages.details.promptMissing')}>
                    <Textarea rows={4} value={prompt} maxLength={CHAT_SCENE_PROMPT_MAX + 200} readOnly={!canGenerate}
                        className="font-narrative" onChange={event => setPrompt(event.target.value)} />
                </Field>
                <div className="-mt-2 flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" disabled={!prompt} onClick={() => void copy()}
                        iconLeft={<Icon icon={copied ? Check : Copy} size={14} />}>
                        {t(copied ? 'chatImages.details.copied' : 'chatImages.details.copy')}
                    </Button>
                    {canGenerate && original && prompt !== original && <Button variant="ghost" size="sm" onClick={() => setPrompt(original)}
                        iconLeft={<Icon icon={RotateCcw} size={14} />}>
                        {t('chatImages.details.reset')}
                    </Button>}
                </div>

                {canGenerate && profiles.length > 0 && <Field label={t('chatImages.details.model')}>
                    <Select size="sm" value={current.profileId} options={options}
                        onChange={profileId => setDraft({ ...current, profileId })} />
                </Field>}

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-caption">
                    {metadata.filter(([, value]) => value).map(([label, value]) => <div key={label} className="contents">
                        <dt className="text-parchment-400">{label}</dt>
                        <dd className="min-w-0 break-words text-parchment-100">{value}</dd>
                    </div>)}
                </dl>

                {generation.model_prompt && <details className="rounded-md border border-parchment-50/[.08] px-3 py-2">
                    <summary className="cursor-pointer font-ui text-caption text-parchment-300">{t('chatImages.details.modelPrompt')}</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words font-mono text-caption text-parchment-200">{generation.model_prompt}</p>
                </details>}
            </div>
        </Modal>
        <ImageKeyDialog provider={keyNeeded?.provider ?? null} onSubmit={submitKey} onCancel={() => setKeyNeeded(null)} />
    </>
}
