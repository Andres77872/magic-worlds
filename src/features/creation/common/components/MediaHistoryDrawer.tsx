/**
 * MediaHistoryDrawer — a right-side drawer for browsing previously generated media
 * and re-pointing a card's default image / theme at any of them.
 *
 * Two tabs, reflecting the backend's data model (see the magic-worlds-api review):
 *  • Images — a USER-WIDE gallery (`GET /images/jobs`). Image jobs are owned per user,
 *    not attached to a card, so this surfaces every portrait you've generated and lets
 *    you reuse one as this card's image.
 *  • Themes — this CARD's theme-song history (`GET /theme-songs?target_type&target_id`).
 *    Theme jobs are card-scoped, so the list is specific to the card being edited.
 *
 * Selecting an item calls back into the editor to set the card's `image_url` /
 * `theme_song_url` (persisted on save). Deleting soft-deletes the asset; if it was the
 * current default, the selection is cleared too.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Download, Eye, ImageOff, Loader2, Music2, Trash2 } from 'lucide-react'
import type { CardMediaTargetType, ImageJobPublic, ThemeSongJobPublic } from '@/shared'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import { AuthenticatedImage, Button, cx, Drawer, Eyebrow, Icon, IconButton, ImageLightbox, Tag } from '@/ui/primitives'
import { AudioWavePlayer, getAudioBlob } from '@/ui/components/audio'
import { downloadBlob, safeFilename } from '../../../../utils/download'
import { dateFromApiTimestamp } from '../../../../utils/time'

type HistoryTab = 'images' | 'themes'

export interface MediaHistoryDrawerProps {
    open: boolean
    onClose: () => void
    cardType: CardMediaTargetType
    /** Card display name — used for thumbnail alt text / lightbox. */
    cardName: string
    /** Card id; when absent the Themes tab is disabled (save the card first). */
    themeTargetId?: string
    /** Current default image URL on the card (to mark the active tile). */
    currentImageUrl?: string
    /** Current default theme URL on the card (to mark the active row). */
    currentThemeSongUrl?: string
    /** Point the card's image at `url` (or clear it with `undefined`). */
    onSelectImage: (url: string | undefined) => void
    /** Point the card's theme at `url` (or clear it with `undefined`). */
    onSelectTheme: (url: string | undefined) => void
    /** Active tab — controlled by the parent so opening can target a tab. */
    tab: HistoryTab
    onTabChange: (tab: HistoryTab) => void
}

const PAGE_SIZE = 24

type GalleryImage = { assetId: string; url: string; createdAt: string }

/** Same-URL test that tolerates relative vs. resolved (absolute) forms. */
function sameUrl(a?: string, b?: string): boolean {
    if (!a || !b) return false
    return a === b || resolveMediaUrl(a) === resolveMediaUrl(b)
}

function formatWhen(iso?: string): string {
    const d = dateFromApiTimestamp(iso)
    if (!d) return ''
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
}

function flattenImages(items: ImageJobPublic[]): GalleryImage[] {
    const out: GalleryImage[] = []
    for (const job of items) {
        for (const asset of job.assets ?? []) {
            if (asset?.url) out.push({ assetId: asset.asset_id, url: asset.url, createdAt: job.created_at })
        }
    }
    return out
}

function firstThemeAsset(job: ThemeSongJobPublic) {
    return job.assets?.find((a) => a?.url)
}

export function MediaHistoryDrawer({
    open,
    onClose,
    cardType,
    cardName,
    themeTargetId,
    currentImageUrl,
    currentThemeSongUrl,
    onSelectImage,
    onSelectTheme,
    tab,
    onTabChange,
}: MediaHistoryDrawerProps) {
    const { t } = useTranslation()
    const [lightboxUrl, setLightboxUrl] = useState<string | undefined>(undefined)

    /* ---- image gallery state ---- */
    const [images, setImages] = useState<GalleryImage[]>([])
    const [imgNext, setImgNext] = useState<number | null>(null)
    const [imgLoading, setImgLoading] = useState(false)
    const [imgError, setImgError] = useState<string | null>(null)
    const imgLoadedRef = useRef(false)

    /* ---- theme history state ---- */
    const [themes, setThemes] = useState<ThemeSongJobPublic[]>([])
    const [themeNext, setThemeNext] = useState<number | null>(null)
    const [themeLoading, setThemeLoading] = useState(false)
    const [themeError, setThemeError] = useState<string | null>(null)
    const themeLoadedRef = useRef(false)

    const loadImages = useCallback(
        async (offset: number) => {
            setImgLoading(true)
            setImgError(null)
            try {
                const res = await apiService.listImageJobs({ status: 'completed', limit: PAGE_SIZE, offset })
                const batch = flattenImages(res.items)
                setImages((prev) => (offset === 0 ? batch : [...prev, ...batch]))
                setImgNext(res.next_offset ?? null)
                imgLoadedRef.current = true
            } catch {
                setImgError(t('creation.common.mediaHistory.errors.loadImages'))
            } finally {
                setImgLoading(false)
            }
        },
        [t],
    )

    const loadThemes = useCallback(
        async (offset: number) => {
            if (!themeTargetId) return
            setThemeLoading(true)
            setThemeError(null)
            try {
                const res = await apiService.listThemeSongs(cardType, themeTargetId, PAGE_SIZE, offset)
                const batch = res.items.filter((j) => j.status === 'completed' && firstThemeAsset(j))
                setThemes((prev) => (offset === 0 ? batch : [...prev, ...batch]))
                setThemeNext(res.next_offset ?? null)
                themeLoadedRef.current = true
            } catch {
                setThemeError(t('creation.common.mediaHistory.errors.loadThemes'))
            } finally {
                setThemeLoading(false)
            }
        },
        [cardType, themeTargetId, t],
    )

    // On close, forget which tabs were loaded so a fresh open refetches (picking up
    // generations made meanwhile). Mutating refs — not state — so no cascading render.
    useEffect(() => {
        if (open) return
        imgLoadedRef.current = false
        themeLoadedRef.current = false
    }, [open])

    // Load the active tab on open, and lazily the first time each tab is shown. The
    // *_loadedRef guards make this fire once per tab per open (no double-fetch).
    useEffect(() => {
        if (!open) return
        if (tab === 'images' && !imgLoadedRef.current) void loadImages(0)
        if (tab === 'themes' && !themeLoadedRef.current) void loadThemes(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, open])

    const handleDeleteImage = async (img: GalleryImage) => {
        try {
            await apiService.deleteImageAsset(img.assetId)
            setImages((prev) => prev.filter((i) => i.assetId !== img.assetId))
            if (sameUrl(currentImageUrl, img.url)) onSelectImage(undefined)
        } catch {
            setImgError(t('creation.common.mediaHistory.errors.deleteImage'))
        }
    }

    const handleDeleteTheme = async (job: ThemeSongJobPublic) => {
        const asset = firstThemeAsset(job)
        if (!asset) return
        try {
            await apiService.deleteThemeSongAsset(asset.asset_id)
            setThemes((prev) => prev.filter((j) => j.job_id !== job.job_id))
            if (sameUrl(currentThemeSongUrl, asset.url)) onSelectTheme(undefined)
        } catch {
            setThemeError(t('creation.common.mediaHistory.errors.deleteTheme'))
        }
    }

    const [downloadingThemeId, setDownloadingThemeId] = useState<string | null>(null)

    const handleDownloadTheme = async (job: ThemeSongJobPublic) => {
        const asset = firstThemeAsset(job)
        const url = resolveMediaUrl(asset?.url)
        if (!asset || !url || downloadingThemeId) return
        setDownloadingThemeId(job.job_id)
        try {
            // Same cache the in-row player/waveform uses — no refetch after a play.
            const blob = await getAudioBlob(url)
            const title = job.lyrics?.song_title?.trim() || 'theme'
            downloadBlob(blob, `${safeFilename(title, 'theme')}.${asset.output_format ?? 'mp3'}`)
        } catch {
            setThemeError(t('creation.common.mediaHistory.errors.downloadTheme'))
        } finally {
            setDownloadingThemeId(null)
        }
    }

    const tabBtn = (key: HistoryTab, label: string, count: number) => (
        <button
            type="button"
            onClick={() => onTabChange(key)}
            className={cx(
                'relative px-1 pb-2 font-ui text-sm font-semibold transition-colors',
                tab === key ? 'text-parchment-50' : 'text-parchment-400 hover:text-parchment-200',
            )}
        >
            {label}
            {count > 0 && <span className="ml-1.5 text-xs text-parchment-500">{count}</span>}
            {tab === key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-arcane-400" />}
        </button>
    )

    const imageLabel = cardType === 'adventure_template'
        ? t('creation.common.mediaHistory.imageLabel.cover')
        : cardType === 'item'
          ? t('creation.common.mediaHistory.imageLabel.item')
          : t('creation.common.mediaHistory.imageLabel.portrait')
    const cardNoun = cardType === 'adventure_template'
        ? t('creation.common.mediaHistory.cardNoun.adventure')
        : cardType === 'item'
          ? t('creation.common.mediaHistory.cardNoun.item')
          : cardType === 'world'
            ? t('creation.common.mediaHistory.cardNoun.world')
            : t('creation.common.mediaHistory.cardNoun.character')

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="2xl"
            eyebrow={<Eyebrow tone="arcane">{t('creation.common.mediaHistory.eyebrow')}</Eyebrow>}
            title={t('creation.common.mediaHistory.title')}
            footer={
                <Button variant="secondary" onClick={onClose}>
                    {t('creation.common.mediaHistory.done')}
                </Button>
            }
        >
            <ImageLightbox open={Boolean(lightboxUrl)} src={lightboxUrl} alt={cardName} onClose={() => setLightboxUrl(undefined)} />

            <div className="mb-4 flex items-center gap-5 border-b border-parchment-50/10">
                {tabBtn('images', t('creation.common.mediaHistory.tabImages'), images.length)}
                {tabBtn('themes', t('creation.common.mediaHistory.tabThemes'), themes.length)}
            </div>

            {tab === 'images' ? (
                <section className="flex flex-col gap-4">
                    <p className="font-narrative text-xs leading-snug text-parchment-400">
                        <Trans
                            i18nKey="creation.common.mediaHistory.imagesIntro"
                            values={{ label: imageLabel, noun: cardNoun }}
                            components={[<span className="text-parchment-200" />]}
                        />
                    </p>

                    {imgError && <p className="text-sm text-blood-500">{imgError}</p>}

                    {images.length === 0 && !imgLoading && !imgError ? (
                        <EmptyState
                            icon={ImageOff}
                            title={t('creation.common.mediaHistory.noImagesTitle')}
                            hint={t('creation.common.mediaHistory.noImagesHint', { label: imageLabel })}
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {images.map((img) => {
                                const current = sameUrl(currentImageUrl, img.url)
                                const resolved = resolveMediaUrl(img.url)
                                return (
                                    <div
                                        key={img.assetId}
                                        className={cx(
                                            'group relative aspect-square overflow-hidden rounded-xl border bg-ink-800',
                                            current ? 'border-arcane-400 ring-2 ring-arcane-400/40' : 'border-parchment-50/10',
                                        )}
                                    >
                                        <AuthenticatedImage src={resolved} alt={cardName} loading="lazy" className="h-full w-full object-cover" />
                                        {current && (
                                            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-arcane-500/90 px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide text-parchment-50">
                                                <Check size={11} strokeWidth={2.5} /> {t('creation.common.mediaHistory.current')}
                                            </span>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-ink-900/85 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                            <span className="font-ui text-[10px] text-parchment-300">{formatWhen(img.createdAt)}</span>
                                            <div className="flex items-center gap-1">
                                                <IconButton label={t('creation.common.mediaHistory.viewFullSize')} size="sm" onClick={() => setLightboxUrl(resolved)}>
                                                    <Eye size={15} strokeWidth={1.75} />
                                                </IconButton>
                                                <IconButton
                                                    label={current ? t('creation.common.mediaHistory.currentDefault') : t('creation.common.mediaHistory.setAsDefault')}
                                                    size="sm"
                                                    tone={current ? 'default' : 'active'}
                                                    disabled={current}
                                                    onClick={() => onSelectImage(img.url)}
                                                >
                                                    <Check size={15} strokeWidth={1.75} />
                                                </IconButton>
                                                <IconButton label={t('creation.common.mediaHistory.deleteImage')} size="sm" tone="danger" onClick={() => void handleDeleteImage(img)}>
                                                    <Trash2 size={15} strokeWidth={1.75} />
                                                </IconButton>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {imgLoading && <LoadingRow label={t('creation.common.mediaHistory.loadingGallery')} />}
                    {imgNext != null && !imgLoading && (
                        <Button variant="secondary" size="sm" onClick={() => void loadImages(imgNext)}>
                            {t('creation.common.mediaHistory.loadMore')}
                        </Button>
                    )}
                </section>
            ) : (
                <section className="flex flex-col gap-4">
                    {!themeTargetId ? (
                        <EmptyState
                            icon={Music2}
                            title={t('creation.common.mediaHistory.saveFirstTitle')}
                            hint={t('creation.common.mediaHistory.saveFirstHint')}
                        />
                    ) : (
                        <>
                            <p className="font-narrative text-xs leading-snug text-parchment-400">
                                <Trans
                                    i18nKey="creation.common.mediaHistory.themesIntro"
                                    components={[<span className="text-parchment-200" />]}
                                />
                            </p>

                            {themeError && <p className="text-sm text-blood-500">{themeError}</p>}

                            {themes.length === 0 && !themeLoading && !themeError ? (
                                <EmptyState
                                    icon={Music2}
                                    title={t('creation.common.mediaHistory.noThemesTitle')}
                                    hint={t('creation.common.mediaHistory.noThemesHint')}
                                />
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {themes.map((job) => {
                                        const asset = firstThemeAsset(job)
                                        if (!asset) return null
                                        const current = sameUrl(currentThemeSongUrl, asset.url)
                                        const title = job.lyrics?.song_title?.trim() || t('creation.common.mediaHistory.themeTitleFallback', { when: formatWhen(job.created_at) })
                                        const tags = job.lyrics?.style_tags ?? []
                                        return (
                                            <li
                                                key={job.job_id}
                                                className={cx(
                                                    'flex flex-col gap-2.5 rounded-xl border bg-ink-800 p-3.5',
                                                    current ? 'border-arcane-400 ring-2 ring-arcane-400/30' : 'border-parchment-50/10',
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex min-w-0 flex-col gap-0.5">
                                                        <span className="truncate font-display text-sm font-semibold text-parchment-50">{title}</span>
                                                        <span className="font-ui text-[11px] text-parchment-500">{formatWhen(job.created_at)}</span>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        {current ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-arcane-500/90 px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide text-parchment-50">
                                                                <Check size={11} strokeWidth={2.5} /> {t('creation.common.mediaHistory.current')}
                                                            </span>
                                                        ) : (
                                                            <Button
                                                                variant="arcane"
                                                                size="sm"
                                                                onClick={() => onSelectTheme(asset.url)}
                                                                iconLeft={<Icon icon={Check} size={14} />}
                                                            >
                                                                {t('creation.common.mediaHistory.set')}
                                                            </Button>
                                                        )}
                                                        <IconButton
                                                            label={t('creation.common.mediaHistory.downloadTheme')}
                                                            size="sm"
                                                            disabled={downloadingThemeId === job.job_id}
                                                            onClick={() => void handleDownloadTheme(job)}
                                                        >
                                                            {downloadingThemeId === job.job_id ? (
                                                                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Download size={15} strokeWidth={1.75} />
                                                            )}
                                                        </IconButton>
                                                        <IconButton label={t('creation.common.mediaHistory.deleteTheme')} size="sm" tone="danger" onClick={() => void handleDeleteTheme(job)}>
                                                            <Trash2 size={15} strokeWidth={1.75} />
                                                        </IconButton>
                                                    </div>
                                                </div>
                                                {tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {tags.slice(0, 6).map((t) => (
                                                            <Tag key={t}>{t}</Tag>
                                                        ))}
                                                    </div>
                                                )}
                                                <AudioWavePlayer
                                                    src={resolveMediaUrl(asset.url)!}
                                                    title={title}
                                                    durationMs={asset.duration_ms}
                                                    peakSeed={asset.asset_id}
                                                    trackMeta={{
                                                        cardName,
                                                        cardType,
                                                        cardId: themeTargetId,
                                                        artworkUrl: resolveMediaUrl(currentImageUrl),
                                                    }}
                                                />
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}

                            {themeLoading && <LoadingRow label={t('creation.common.mediaHistory.loadingThemes')} />}
                            {themeNext != null && !themeLoading && (
                                <Button variant="secondary" size="sm" onClick={() => void loadThemes(themeNext)}>
                                    {t('creation.common.mediaHistory.loadMore')}
                                </Button>
                            )}
                        </>
                    )}
                </section>
            )}
        </Drawer>
    )
}

function EmptyState({ icon, title, hint }: { icon: typeof ImageOff; title: string; hint: string }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-parchment-50/15 bg-ink-800/50 px-6 py-10 text-center">
            <Icon icon={icon} size={26} className="text-parchment-500" />
            <p className="font-display text-sm font-semibold text-parchment-200">{title}</p>
            <p className="max-w-xs font-narrative text-xs text-parchment-400">{hint}</p>
        </div>
    )
}

function LoadingRow({ label }: { label: string }) {
    return (
        <div className="flex items-center justify-center gap-2 py-4 font-ui text-xs text-parchment-400">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-arcane-400/40 border-t-arcane-400" />
            {label}
        </div>
    )
}
