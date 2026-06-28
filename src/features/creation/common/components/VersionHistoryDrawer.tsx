/**
 * VersionHistoryDrawer — a read-only version viewer opened from the gallery action menu.
 *
 * Versioning is now managed inside the card editor (draft → publish → history). This drawer
 * is a quick audit surface: it lists the card's published versions (newest = "Latest"), shows
 * how widely the card is used, and flags a pending unpublished draft — then hands off to the
 * editor ("Edit to publish changes") where Publish / Discard / Restore live. It performs no
 * mutations itself.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, PencilLine } from 'lucide-react'
import type { CardVersion, VersionableCardType } from '@/shared'
import { useCardUsage } from '@/shared/hooks/useCardUsage'
import { apiService } from '@/infrastructure/api'
import { Badge, Button, cx, Drawer, Eyebrow } from '@/ui/primitives'
import { CardUsageLine } from '@/ui/components/common/CardUsageLine'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { dateFromApiTimestamp } from '../../../../utils/time'

export interface VersionHistoryDrawerProps {
    open: boolean
    onClose: () => void
    cardType: VersionableCardType
    /** Card id; when absent the drawer prompts to save the card first. */
    cardId?: string
    /** Card display name — used in the header. */
    cardName: string
    /** Open the editor for this card (where draft/publish/restore are managed). */
    onEdit?: () => void
}

function formatWhen(iso?: string | null): string {
    const d = dateFromApiTimestamp(iso ?? undefined)
    if (!d) return ''
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
}

export function VersionHistoryDrawer({ open, onClose, cardType, cardId, cardName, onEdit }: VersionHistoryDrawerProps) {
    const { t } = useTranslation()
    const [versions, setVersions] = useState<CardVersion[]>([])
    const [latest, setLatest] = useState(0)
    const [hasDraft, setHasDraft] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // How widely this card is used — shown so the impact of publishing changes is clear.
    const usage = useCardUsage(cardType, cardId, { enabled: open && Boolean(cardId) })

    const load = useCallback(async () => {
        if (!cardId) return
        setLoading(true)
        setError(null)
        try {
            const res = await apiService.listCardVersions(cardType, cardId)
            setVersions(res.versions ?? [])
            setLatest(res.latest_version_number ?? 0)
            setHasDraft(Boolean(res.has_draft))
        } catch {
            setError(t('cardVersions.errors.load'))
        } finally {
            setLoading(false)
        }
    }, [cardType, cardId, t])

    useEffect(() => {
        if (open && cardId) void load()
    }, [open, cardId, load])

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow={<Eyebrow tone="arcane">{t('cardVersions.drawer.eyebrow')}</Eyebrow>}
            title={t('cardVersions.history.title')}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {t('cardVersions.drawer.done')}
                    </Button>
                    {onEdit && (
                        <Button variant="primary" iconLeft={<PencilLine size={16} strokeWidth={1.75} />} onClick={onEdit}>
                            {t('cardVersions.gallery.editToManage')}
                        </Button>
                    )}
                </>
            }
        >
            {cardName && (
                <p className="mb-1 font-display text-base font-semibold text-parchment-100">{cardName}</p>
            )}
            <p className="mb-4 font-narrative text-xs leading-snug text-parchment-400">
                {t('cardVersions.history.intro')}
            </p>

            {cardId && <CardUsageLine usage={usage} showNone className="mb-4" />}

            {hasDraft && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3.5 py-2.5">
                    <Badge tone="ember">{t('cardVersions.history.draftBadge')}</Badge>
                    <p className="font-narrative text-[13px] leading-snug text-parchment-200">
                        {t('cardVersions.history.unsavedNew')}
                    </p>
                </div>
            )}

            {error && <p className="mb-3 text-sm text-blood-500">{error}</p>}

            {loading && versions.length === 0 ? (
                <p className="font-narrative text-sm text-parchment-400">{t('cardVersions.drawer.loading')}</p>
            ) : versions.length === 0 ? (
                <EmptyState
                    icon={<History size={28} strokeWidth={1.5} />}
                    message={t('cardVersions.history.empty')}
                    secondaryText={t('cardVersions.history.emptyHint')}
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {versions.map((v) => {
                        const isLatest = v.version_number === latest
                        return (
                            <li
                                key={v.version_id}
                                className={cx(
                                    'flex items-center justify-between gap-3 rounded-xl border bg-ink-800 px-3 py-2.5',
                                    isLatest ? 'border-verdant-500/50' : 'border-parchment-50/10',
                                )}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-ui text-sm font-semibold text-parchment-100">
                                            {t('cardVersions.drawer.versionLabel', { number: v.version_number })}
                                        </span>
                                        {isLatest && <Badge tone="live">{t('cardVersions.history.latest')}</Badge>}
                                    </div>
                                    {v.label && <p className="truncate font-narrative text-xs text-parchment-300">{v.label}</p>}
                                    <p className="font-ui text-[11px] text-parchment-500">{formatWhen(v.created_at)}</p>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Drawer>
    )
}
