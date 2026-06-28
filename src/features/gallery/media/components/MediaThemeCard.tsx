/**
 * MediaThemeCard — a theme song's tile in the media gallery's mixed feed. Same
 * square footprint as image tiles so the feed keeps an even rhythm, with an
 * arcane tint marking it as audio at a glance. The header is a waveform play
 * bar (AudioWavePlayer: seekable strip + time readout — the real waveform
 * morphs in on first play); while playing the card glows ember. Footer offers
 * download (cached blob → file named after the song) and delete.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { Badge, cx, IconButton, Tag } from '@/ui/primitives'
import { AudioWavePlayer, getAudioBlob } from '@/ui/components/audio'
import { downloadBlob, safeFilename } from '../../../../utils/download'
import { formatWhen, type CardRef, type MediaThemeItem } from '../mediaGalleryTypes'

export interface MediaThemeCardProps {
    item: MediaThemeItem
    /** Resolved card portrait/cover for the global playlist dock. */
    artworkUrl?: string
    deleting?: boolean
    onDelete: () => void
    /** Filter the gallery to this theme's card. */
    onFilterCard?: (card: CardRef) => void
}

export function MediaThemeCard({ item, artworkUrl, deleting = false, onDelete, onFilterCard }: MediaThemeCardProps) {
    const { t } = useTranslation()
    const [playing, setPlaying] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState(false)

    const handleDownload = async () => {
        if (downloading) return
        setDownloading(true)
        setDownloadError(false)
        try {
            // Reuses the player/waveform blob cache — zero refetch after a play.
            const blob = await getAudioBlob(item.url)
            downloadBlob(blob, `${safeFilename(item.title, 'theme')}.${item.outputFormat}`)
        } catch {
            setDownloadError(true)
        } finally {
            setDownloading(false)
        }
    }
    const cardName = item.card?.name

    return (
        <div
            className={cx(
                'group relative flex aspect-square flex-col overflow-hidden rounded-xl border bg-ink-800 p-4 transition-all',
                playing
                    ? 'border-ember-500/40 shadow-glow-ember'
                    : 'border-arcane-500/20 hover:border-arcane-400/40 hover:shadow-glow-arcane',
                deleting && 'pointer-events-none opacity-60',
            )}
            aria-busy={deleting}
            data-testid="media-theme-card"
        >
            {/* Subtle arcane wash so audio reads differently from images. */}
            <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(143,111,227,0.12),transparent_60%)]"
                aria-hidden="true"
            />

            <div className="relative">
                <AudioWavePlayer
                    src={item.url}
                    title={item.title}
                    durationMs={item.durationMs}
                    peakSeed={item.id}
                    trackMeta={{
                        cardName: item.card?.name,
                        cardType: item.card?.type,
                        cardId: item.card?.id,
                        artworkUrl,
                    }}
                    onPlayingChange={setPlaying}
                />
            </div>

            <div className="relative mt-3 flex min-h-0 flex-1 flex-col gap-1">
                <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-parchment-50">
                    {item.title}
                </h3>
                <span className="font-mono text-[10px] text-parchment-500">{formatWhen(item.createdAt)}</span>
                {item.styleTags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 overflow-hidden">
                        {item.styleTags.slice(0, 4).map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative mt-2 flex items-center justify-between gap-2">
                {item.card ? (
                    <Badge
                        tone="glass"
                        className={cx('max-w-[65%]', onFilterCard && 'cursor-pointer hover:text-arcane-200')}
                        onClick={onFilterCard ? () => onFilterCard(item.card!) : undefined}
                        role={onFilterCard ? 'button' : undefined}
                        tabIndex={onFilterCard ? 0 : undefined}
                        onKeyDown={
                            onFilterCard
                                ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          onFilterCard(item.card!)
                                      }
                                  }
                                : undefined
                        }
                        title={
                            onFilterCard
                                ? cardName
                                    ? t('mediaGallery.tile.showAllMediaForCard', { name: cardName })
                                    : t('mediaGallery.tile.showAllMediaForThisCard')
                                : undefined
                        }
                        data-testid="media-card-badge"
                    >
                        <span className="min-w-0 truncate">{cardName ?? t('mediaGallery.tile.cardFallback')}</span>
                    </Badge>
                ) : (
                    <span />
                )}
                <div
                    className={cx(
                        'flex items-center gap-1 transition-opacity',
                        // An active card keeps its actions visible; idle ones reveal on hover/focus.
                        playing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    )}
                >
                    <IconButton
                        label={t('mediaGallery.tile.downloadTheme')}
                        size="sm"
                        tone={downloadError ? 'danger' : 'default'}
                        title={downloadError ? t('mediaGallery.tile.downloadFailed') : t('mediaGallery.tile.downloadTheme')}
                        disabled={downloading}
                        onClick={() => void handleDownload()}
                    >
                        {downloading ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Download size={15} strokeWidth={1.75} />
                        )}
                    </IconButton>
                    <IconButton label={t('mediaGallery.tile.deleteTheme')} size="sm" tone="danger" onClick={onDelete}>
                        <Trash2 size={15} strokeWidth={1.75} />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}
