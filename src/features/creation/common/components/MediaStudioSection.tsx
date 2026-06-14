/**
 * MediaStudioSection — generated card image + music theme affordances shared
 * by the card creators and the in-session card drawer.
 *
 * Privacy contract: the client only ever sends the card's own information (the
 * `template`) plus an optional free-text direction. The backend builds the real,
 * optimized generation prompt — never the client. Portraits come from
 * `/images/card-portrait` (no saved card required); theme songs come from
 * `/theme-songs`, which needs an owned card id, so the theme button first awaits
 * `ensureSaved()` (the "auto-save then generate" flow).
 *
 * Both generators submit async backend jobs. Portraits still wait locally for a
 * renderable asset; theme songs hand off to the global background task drawer.
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Eye, History, ImagePlus, ImageUp, Music2, Sparkles, Trash2 } from 'lucide-react'
import type { CardMediaTargetType, CardPortraitRequest, ThemeSongJobPublic } from '@/shared'
import { useBackgroundTasks } from '@/app/hooks'
import { apiService, resolveMediaUrl, type ImageJobPublicResponse } from '@/infrastructure/api'
import { Button, Eyebrow, Icon, IconButton, ImageLightbox, Portrait, SectionHeader } from '@/ui/primitives'
import { AudioWavePlayer } from '@/ui/components/audio'
import { CreatorField, CreatorTextarea } from './CreatorField'
import { MediaHistoryDrawer } from './MediaHistoryDrawer'

type AttributeGroups = CardPortraitRequest['category']

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/**
 * Hover/focus overlay of image actions for a portrait thumbnail: view full-size,
 * replace (upload a custom file), and remove. Sits on top of a `Portrait`; the
 * parent must be `group relative` for the reveal-on-hover to work.
 */
function PortraitActions({
    onView,
    onReplace,
    onRemove,
    disabled,
}: {
    onView: () => void
    onReplace: () => void
    onRemove: () => void
    disabled?: boolean
}) {
    const { t } = useTranslation()
    return (
        <div className="absolute inset-0 flex items-start justify-end gap-1 rounded-xl bg-gradient-to-b from-ink-900/60 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <IconButton label={t('creation.common.media.viewImage')} size="sm" onClick={onView} disabled={disabled}>
                <Eye size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton label={t('creation.common.media.replaceImage')} size="sm" onClick={onReplace} disabled={disabled}>
                <ImageUp size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton label={t('creation.common.media.removeImage')} size="sm" tone="danger" onClick={onRemove} disabled={disabled}>
                <Trash2 size={16} strokeWidth={1.75} />
            </IconButton>
        </div>
    )
}

export interface MediaStudioSectionProps {
    cardType: CardMediaTargetType
    /** Lower-case noun for copy, e.g. "character" / "world" / "adventure". */
    noun: string
    /** Card-info template the backend folds into the private prompt. */
    template: {
        name: string
        description?: string
        /** Race for a character, type for a world. */
        subtype?: string
        /** Literal place kind for world cards; included in the backend prompt template. */
        place_type?: string
        category?: AttributeGroups
    }
    /** Current portrait URL (as returned by the backend; may be relative). */
    imageUrl?: string
    onImageUrl: (url: string | undefined) => void
    /** Current theme-song URL (as returned by the backend; may be relative). */
    themeSongUrl?: string
    /** Persist an explicitly selected theme onto the card (history picker). */
    onThemeSongUrl: (url: string | undefined) => void
    /** Update parent form state for a generated theme without issuing another card PUT. */
    onGeneratedThemeSongUrl?: (url: string | undefined) => void
    /**
     * Resolve to the owned card id used as the theme target — auto-saving the
     * card first if needed. Throw with a user-facing message if it can't.
     */
    ensureSaved: () => Promise<string>
    /** Known card id, if the card already exists — used to list existing themes. */
    themeTargetId?: string
    /** When set, theme generation is disabled and this hint is shown. */
    themeDisabledReason?: string
    isAuthenticated: boolean
    onAuthRequired: () => void
    /**
     * `full` (default) shows a portrait thumbnail + roomy layout — used where there
     * is no separate live-preview card (e.g. the in-session card drawer). `compact`
     * drops the thumbnail and tightens spacing for the creators' preview dock, where
     * the live-preview card above already shows the portrait.
     */
    layout?: 'full' | 'compact'
}

const EXTRA_DIRECTION_MAX = 600

function mediaErrorCopy(error: unknown, noun: string, t: TFunction): string {
    const err = error as { message?: string; category?: string; status?: number; retryAfterSeconds?: number; requestId?: string }
    const suffix = err.requestId ? t('creation.common.media.errors.supportId', { requestId: err.requestId }) : ''
    const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
    if (err.category === 'quota_exceeded' || err.status === 429) {
        const retry = err.retryAfterSeconds
            ? t('creation.common.media.errors.quotaRetryHours', { count: Math.ceil(err.retryAfterSeconds / 3600) })
            : t('creation.common.media.errors.quotaRetryLater')
        return `${t('creation.common.media.errors.quotaExceeded', { noun })}${retry}${suffix}`
    }
    if (err.category === 'unavailable' || err.status === 503) {
        return `${t('creation.common.media.errors.unavailable', { noun: Noun })}${suffix}`
    }
    if (err.category === 'not_found') return `${t('creation.common.media.errors.notFound', { noun })}${suffix}`
    if (err.category === 'invalid') return `${err.message || t('creation.common.media.errors.invalid')}${suffix}`
    if (err.status === 0 || err.category === 'timeout') {
        return `${t('creation.common.media.errors.timeout')}${suffix}`
    }
    return err.message || t('creation.common.media.errors.generic', { noun })
}

function firstCompletedThemeUrl(jobs: ThemeSongJobPublic[]): string | undefined {
    for (const job of jobs) {
        if (job.status === 'completed' && job.assets?.length) return job.assets[0].url
    }
    return undefined
}

export function MediaStudioSection({
    cardType,
    noun,
    template,
    imageUrl,
    onImageUrl,
    themeSongUrl,
    onThemeSongUrl,
    onGeneratedThemeSongUrl,
    ensureSaved,
    themeTargetId,
    themeDisabledReason,
    isAuthenticated,
    onAuthRequired,
    layout = 'full',
}: MediaStudioSectionProps) {
    const { t } = useTranslation()
    const { tasks, registerThemeSongJob } = useBackgroundTasks()
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    /* ----------------------------- portrait ----------------------------- */
    const [direction, setDirection] = useState('')
    const [imgBusy, setImgBusy] = useState(false)
    const [imgBusyKind, setImgBusyKind] = useState<'generate' | 'upload'>('generate')
    const [imgError, setImgError] = useState<string | null>(null)
    const [viewerOpen, setViewerOpen] = useState(false)
    const imgAbortRef = useRef<AbortController | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const openFilePicker = () => fileInputRef.current?.click()

    const handleUploadImage = async (file: File) => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
            setImgError(t('creation.common.media.notices.chooseImageType'))
            return
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setImgError(t('creation.common.media.notices.tooLarge'))
            return
        }
        const controller = new AbortController()
        imgAbortRef.current = controller
        setImgBusyKind('upload')
        setImgBusy(true)
        setImgError(null)
        try {
            const res = await apiService.uploadCardImage(file, { signal: controller.signal })
            if (!mountedRef.current) return
            onImageUrl(res.url)
        } catch (err) {
            if (!mountedRef.current) return
            if (controller.signal.aborted) {
                setImgError(t('creation.common.media.notices.uploadCanceled'))
            } else {
                setImgError(mediaErrorCopy(err, 'image', t))
            }
        } finally {
            if (mountedRef.current) setImgBusy(false)
            imgAbortRef.current = null
        }
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = '' // allow re-selecting the same file
        if (file) void handleUploadImage(file)
    }

    const handleRemoveImage = () => {
        onImageUrl(undefined)
        setImgError(null)
        setViewerOpen(false)
    }

    const handleGenerateImage = async () => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        if (!template.name.trim()) {
            setImgError(t('creation.common.media.notices.nameFirst', { noun }))
            return
        }
        const controller = new AbortController()
        imgAbortRef.current = controller
        setImgBusyKind('generate')
        setImgBusy(true)
        setImgError(null)
        try {
            const body: CardPortraitRequest = {
                card_type: cardType,
                // Tags the job with the saved card so the media gallery can filter
                // by card; unsaved cards generate untagged (gallery-wide) images.
                card_id: themeTargetId || undefined,
                name: template.name.trim(),
                description: template.description?.trim() || undefined,
                subtype: template.subtype?.trim() || undefined,
                place_type: template.place_type?.trim() || undefined,
                category: template.category,
                extra_direction: direction.trim() || undefined,
            }
            let job: ImageJobPublicResponse = await apiService.generateCardPortrait(body, { signal: controller.signal })
            if (job.status !== 'completed') {
                job = await apiService.waitForImageJob(job.job_id, { signal: controller.signal })
            }
            if (!mountedRef.current) return
            const url = job.assets?.[0]?.url
            if (job.status === 'completed' && url) {
                onImageUrl(url)
            } else {
                setImgError(mediaErrorCopy(job.error ?? { category: job.status }, 'portrait', t))
            }
        } catch (err) {
            if (!mountedRef.current) return
            if (controller.signal.aborted) {
                setImgError(t('creation.common.media.notices.imageCanceled'))
            } else {
                setImgError(mediaErrorCopy(err, 'portrait', t))
            }
        } finally {
            if (mountedRef.current) setImgBusy(false)
            imgAbortRef.current = null
        }
    }

    /* ------------------------------ theme ------------------------------ */
    const [songDirection, setSongDirection] = useState('')
    const [themeUrl, setThemeUrl] = useState<string | undefined>(themeSongUrl)
    const [themeBusy, setThemeBusy] = useState(false)
    const [themeError, setThemeError] = useState<string | null>(null)
    const [themeNotice, setThemeNotice] = useState<string | null>(null)
    const [themeJobId, setThemeJobId] = useState<string | null>(null)
    const themeAbortRef = useRef<AbortController | null>(null)

    // Surface the latest completed theme for an already-saved card.
    useEffect(() => {
        if (!themeTargetId) return
        let cancelled = false
        apiService
            .listThemeSongs(cardType, themeTargetId)
            .then((res) => {
                if (cancelled) return
                const found = firstCompletedThemeUrl(res.items)
                // Display ONLY: surface the latest completed theme in the studio player.
                // Never persist from inside this fetch — calling onThemeSongUrl here writes
                // on read, which triggers loadData → the page unmounts/remounts (AppRouter
                // shows a spinner while loading) → this effect re-runs → it persists again:
                // an infinite fetch/PUT loop. Persistence happens only on the user-driven
                // generate (handleGenerateTheme) and on Save.
                if (found) setThemeUrl((prev) => prev ?? found)
            })
            .catch(() => {
                /* best-effort — a missing/forbidden list is not an error worth showing */
            })
        return () => {
            cancelled = true
        }
    }, [cardType, themeTargetId])

    useEffect(() => {
        if (!themeJobId) return
        const task = tasks.find((item) => item.operation === 'theme_song' && item.task_id === themeJobId)
        if (!task) return
        if (task.status === 'completed') {
            const timer = window.setTimeout(() => {
                const url = task.result?.assets?.[0]?.url
                if (url) {
                    setThemeUrl(url)
                    onGeneratedThemeSongUrl?.(url)
                    setThemeNotice(t('creation.common.media.themeReady'))
                }
                setThemeJobId(null)
            }, 0)
            return () => window.clearTimeout(timer)
        }
        if (task.status === 'failed' || task.status === 'canceled') {
            const timer = window.setTimeout(() => {
                setThemeError(task.error?.detail || mediaErrorCopy({ category: task.status }, 'theme', t))
                setThemeNotice(null)
                setThemeJobId(null)
            }, 0)
            return () => window.clearTimeout(timer)
        }
    }, [onGeneratedThemeSongUrl, tasks, themeJobId])

    const handleGenerateTheme = async () => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        if (themeDisabledReason) return
        const controller = new AbortController()
        themeAbortRef.current = controller
        setThemeBusy(true)
        setThemeError(null)
        setThemeNotice(null)
        try {
            const targetId = await ensureSaved()
            if (!targetId) {
                setThemeError(t('creation.common.media.notices.saveFirst', { noun }))
                return
            }
            const themeFor = template.name.trim() || t('creation.common.media.notices.defaultThemeTarget', { noun })
            const description = songDirection.trim() || t('creation.common.media.notices.defaultThemeDescription', { name: themeFor })
            const job = await apiService.generateThemeSong(
                { target_type: cardType, target_id: targetId, description },
                { signal: controller.signal },
            )
            if (!mountedRef.current) return
            registerThemeSongJob(job)
            setThemeJobId(job.job_id)
            const url = job.assets?.[0]?.url
            if (job.status === 'completed' && url) {
                setThemeUrl(url)
                onGeneratedThemeSongUrl?.(url)
                setThemeNotice(t('creation.common.media.themeReady'))
            } else if (job.status === 'failed') {
                setThemeError(mediaErrorCopy(job.error ?? { category: job.status }, 'theme', t))
            } else {
                setThemeNotice(t('creation.common.media.themeComposing'))
            }
        } catch (err) {
            if (!mountedRef.current) return
            if (controller.signal.aborted) {
                setThemeError(t('creation.common.media.notices.themeCanceled'))
            } else {
                setThemeError(mediaErrorCopy(err, 'theme', t))
            }
        } finally {
            if (mountedRef.current) setThemeBusy(false)
            themeAbortRef.current = null
        }
    }

    /* --------------------------- media history --------------------------- */
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyTab, setHistoryTab] = useState<'images' | 'themes'>('images')

    const openHistory = (whichTab: 'images' | 'themes') => {
        if (!isAuthenticated) {
            onAuthRequired()
            return
        }
        setHistoryTab(whichTab)
        setHistoryOpen(true)
    }

    // Rendered once per layout (like `imageControls`). Selecting an image points the
    // card's image_url; selecting a theme updates both the local player and the
    // persisted theme_song_url. The creators' onImageUrl/onThemeSongUrl handlers
    // persist either immediately when the card already exists; an unsaved new card
    // picks them up on Create via its payload.
    const historyDrawer = (
        <MediaHistoryDrawer
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            cardType={cardType}
            cardName={template.name}
            themeTargetId={themeTargetId}
            currentImageUrl={imageUrl}
            currentThemeSongUrl={themeUrl}
            onSelectImage={(url) => onImageUrl(url)}
            onSelectTheme={(url) => {
                setThemeUrl(url)
                onThemeSongUrl(url)
            }}
            tab={historyTab}
            onTabChange={setHistoryTab}
        />
    )

    const resolvedImage = resolveMediaUrl(imageUrl)
    const resolvedTheme = resolveMediaUrl(themeUrl)
    const isAdventure = cardType === 'adventure_template'
    const imageLabel = isAdventure
        ? t('creation.common.media.coverImage')
        : cardType === 'world'
          ? t('creation.common.media.settingImage')
          : cardType === 'item'
            ? t('creation.common.media.itemImage')
            : t('creation.common.media.profileImage')
    const imgBusyLabel = imgBusyKind === 'upload' ? t('creation.common.media.uploading') : t('creation.common.media.generating')

    // Rendered once per layout — the hidden picker drives Replace/Upload, the
    // lightbox drives View. Both read the same refs/state as the action buttons.
    const imageControls = (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleFileChange}
            />
            <ImageLightbox open={viewerOpen} src={resolvedImage} alt={template.name} onClose={() => setViewerOpen(false)} />
        </>
    )

    if (layout === 'compact') {
        return (
            <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-4 shadow-sm">
                <div className="flex flex-col gap-0.5">
                    <Eyebrow tone="arcane">{isAdventure ? t('creation.common.media.coverTheme') : t('creation.common.media.portraitTheme')}</Eyebrow>
                    <p className="font-narrative text-xs leading-snug text-parchment-400">
                        {t('creation.common.media.compactBlurb')}
                    </p>
                </div>

                {/* Portrait */}
                <div className="flex flex-col gap-2.5">
                    {imageControls}
                    <div className="flex items-center gap-2">
                        <Icon icon={ImagePlus} size={15} className="text-arcane-300" />
                        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-parchment-300">{imageLabel}</span>
                    </div>
                    {resolvedImage && (
                        <div className="group relative">
                            <Portrait name={template.name} src={resolvedImage} height={150} className="rounded-xl" />
                            <PortraitActions
                                onView={() => setViewerOpen(true)}
                                onReplace={openFilePicker}
                                onRemove={handleRemoveImage}
                                disabled={imgBusy}
                            />
                        </div>
                    )}
                    <CreatorTextarea
                        value={direction}
                        onChange={setDirection}
                        rows={2}
                        maxLength={EXTRA_DIRECTION_MAX}
                        placeholder={t('creation.common.media.artDirectionPlaceholderCompact')}
                    />
                    {imgError && <p className="text-xs text-blood-500">{imgError}</p>}
                    {imgBusy ? (
                        <div className="flex justify-end gap-2">
                            <Button kind="secondary" size="sm" onClick={() => imgAbortRef.current?.abort()}>
                                {t('common.cancel')}
                            </Button>
                            <Button kind="arcane" size="sm" disabled iconLeft={<Icon icon={Sparkles} size={15} />}>
                                {imgBusyLabel}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button kind="arcane" size="sm" full onClick={handleGenerateImage} iconLeft={<Icon icon={Sparkles} size={15} />}>
                                {resolvedImage
                                    ? t('creation.common.media.regenerateImage', { label: imageLabel.toLowerCase() })
                                    : t('creation.common.media.generateImage', { label: imageLabel.toLowerCase() })}
                            </Button>
                            <div className="flex items-center justify-center gap-3">
                                {!resolvedImage && (
                                    <button
                                        type="button"
                                        onClick={openFilePicker}
                                        className="text-[11px] text-parchment-400 underline-offset-2 transition-colors hover:text-parchment-200 hover:underline"
                                    >
                                        {t('creation.common.media.uploadOwn')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => openHistory('images')}
                                    className="inline-flex items-center gap-1 text-[11px] text-arcane-300 underline-offset-2 transition-colors hover:text-arcane-200 hover:underline"
                                >
                                    <Icon icon={History} size={12} /> {t('creation.common.media.browseGallery')}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="h-px bg-parchment-50/[.07]" />

                {/* Theme song */}
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        <Icon icon={Music2} size={15} className="text-arcane-300" />
                        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-parchment-300">{t('creation.common.media.musicTheme')}</span>
                    </div>
                    {resolvedTheme && (
                        <AudioWavePlayer
                            src={resolvedTheme}
                            title={template.name.trim() ? t('creation.common.media.themeSuffix', { name: template.name.trim() }) : t('creation.common.media.themeFallback')}
                            trackMeta={{
                                cardName: template.name.trim() || undefined,
                                cardType,
                                cardId: themeTargetId,
                                artworkUrl: resolveMediaUrl(imageUrl),
                            }}
                            className="rounded-xl border border-arcane-500/20 bg-ink-800/60 p-2.5"
                        />
                    )}
                    <CreatorTextarea
                        value={songDirection}
                        onChange={setSongDirection}
                        rows={2}
                        maxLength={EXTRA_DIRECTION_MAX}
                        placeholder={t('creation.common.media.songDirectionPlaceholderCompact')}
                    />
                    {themeDisabledReason ? (
                        <Eyebrow tone="muted">{themeDisabledReason}</Eyebrow>
                    ) : (
                        <>
                            {themeNotice && <p className="text-xs text-arcane-300">{themeNotice}</p>}
                            {themeError && <p className="text-xs text-blood-500">{themeError}</p>}
                        </>
                    )}
                    {themeBusy ? (
                        <div className="flex justify-end gap-2">
                            <Button kind="secondary" size="sm" onClick={() => themeAbortRef.current?.abort()}>
                                {t('common.cancel')}
                            </Button>
                            <Button kind="arcane" size="sm" disabled iconLeft={<Icon icon={Sparkles} size={15} />}>
                                {t('creation.common.media.starting')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            kind="arcane"
                            size="sm"
                            full
                            onClick={handleGenerateTheme}
                            disabled={Boolean(themeDisabledReason)}
                            iconLeft={<Icon icon={Sparkles} size={15} />}
                        >
                            {resolvedTheme ? t('creation.common.media.regenerateTheme') : t('creation.common.media.generateTheme')}
                        </Button>
                    )}
                    <button
                        type="button"
                        onClick={() => openHistory('themes')}
                        className="inline-flex items-center justify-center gap-1 self-center text-[11px] text-arcane-300 underline-offset-2 transition-colors hover:text-arcane-200 hover:underline"
                    >
                        <Icon icon={History} size={12} /> {t('creation.common.media.browseThemes')}
                    </button>
                </div>

                {historyDrawer}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Portrait */}
            <div className="flex flex-col gap-4">
                {imageControls}
                <SectionHeader icon={ImagePlus} tone="arcane" title={imageLabel} />
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                    <div className="group relative">
                        <Portrait name={template.name} src={resolvedImage} height={180} className="rounded-xl" />
                        {resolvedImage && (
                            <PortraitActions
                                onView={() => setViewerOpen(true)}
                                onReplace={openFilePicker}
                                onRemove={handleRemoveImage}
                                disabled={imgBusy}
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        <CreatorField label={t('creation.common.media.artDirectionLabel')} tooltip={t('creation.common.media.artDirectionHelper')}>
                            <CreatorTextarea
                                value={direction}
                                onChange={setDirection}
                                rows={3}
                                maxLength={EXTRA_DIRECTION_MAX}
                                placeholder={t('creation.common.media.artDirectionPlaceholder')}
                            />
                        </CreatorField>
                        {imgError && <p className="text-sm text-blood-500">{imgError}</p>}
                        <div className="flex items-center justify-between gap-2">
                            <Button kind="ghost" onClick={() => openHistory('images')} iconLeft={<Icon icon={History} size={16} />}>
                                {t('creation.common.media.gallery')}
                            </Button>
                            <div className="flex justify-end gap-2">
                                {imgBusy && (
                                    <Button kind="secondary" onClick={() => imgAbortRef.current?.abort()}>
                                        {t('common.cancel')}
                                    </Button>
                                )}
                                {!imgBusy && !resolvedImage && (
                                    <Button kind="secondary" onClick={openFilePicker} iconLeft={<Icon icon={ImageUp} size={16} />}>
                                        {t('creation.common.media.upload')}
                                    </Button>
                                )}
                                <Button
                                    kind="arcane"
                                    onClick={handleGenerateImage}
                                    disabled={imgBusy}
                                    iconLeft={<Icon icon={Sparkles} size={16} />}
                                >
                                    {imgBusy ? imgBusyLabel : resolvedImage ? t('creation.common.media.regeneratePortrait') : t('creation.common.media.generatePortrait')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Theme song */}
            <div className="flex flex-col gap-4">
                <SectionHeader icon={Music2} tone="arcane" title={t('creation.common.media.musicTheme')} />
                {resolvedTheme && (
                    <AudioWavePlayer
                        src={resolvedTheme}
                        title={template.name.trim() ? t('creation.common.media.themeSuffix', { name: template.name.trim() }) : t('creation.common.media.themeFallback')}
                        trackMeta={{
                            cardName: template.name.trim() || undefined,
                            cardType,
                            cardId: themeTargetId,
                            artworkUrl: resolveMediaUrl(imageUrl),
                        }}
                        className="rounded-xl border border-arcane-500/20 bg-ink-800/60 p-3"
                    />
                )}
                <CreatorField label={t('creation.common.media.songDirectionLabel')} tooltip={t('creation.common.media.songDirectionHelper')}>
                    <CreatorTextarea
                        value={songDirection}
                        onChange={setSongDirection}
                        rows={3}
                        maxLength={EXTRA_DIRECTION_MAX}
                        placeholder={t('creation.common.media.songDirectionPlaceholder')}
                    />
                </CreatorField>
                {themeDisabledReason ? (
                    <Eyebrow tone="muted">{themeDisabledReason}</Eyebrow>
                ) : (
                    <>
                        {themeNotice && <p className="text-sm text-arcane-300">{themeNotice}</p>}
                        {themeError && <p className="text-sm text-blood-500">{themeError}</p>}
                    </>
                )}
                <div className="flex items-center justify-between gap-2">
                    <Button kind="ghost" onClick={() => openHistory('themes')} iconLeft={<Icon icon={History} size={16} />}>
                        {t('creation.common.media.history')}
                    </Button>
                    <div className="flex justify-end gap-2">
                        {themeBusy && (
                            <Button kind="secondary" onClick={() => themeAbortRef.current?.abort()}>
                                {t('common.cancel')}
                            </Button>
                        )}
                        <Button
                            kind="arcane"
                            onClick={handleGenerateTheme}
                            disabled={themeBusy || Boolean(themeDisabledReason)}
                            iconLeft={<Icon icon={Sparkles} size={16} />}
                        >
                            {themeBusy ? t('creation.common.media.starting') : resolvedTheme ? t('creation.common.media.regenerateTheme') : t('creation.common.media.generateTheme')}
                        </Button>
                    </div>
                </div>
            </div>

            {historyDrawer}
        </div>
    )
}
