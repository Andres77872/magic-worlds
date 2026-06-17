/**
 * CardHistoryDrawer — the in-editor Draft → Latest → Version-history panel.
 *
 * Three tiers, top to bottom:
 *   • Draft   — the private working copy (shown only when there are unpublished edits),
 *               with Publish (→ live + new version) and Discard (→ revert to published).
 *   • Latest  — the newest published version, marked with a "Latest" badge.
 *   • History — older versions; Restore loads one back into the draft for review.
 *
 * Versions are created by Publish (not a manual "save version"), so this panel has no
 * save-version input. Presentational: all mutations are delegated to callbacks the editor
 * wires to its `useCardDraft` instance, so the open editor can re-hydrate from the result.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, History, RotateCcw, Upload, Undo2 } from 'lucide-react'
import type { CardVersion, VersionableCardType } from '@/shared'
import { useCardUsage } from '@/shared/hooks/useCardUsage'
import { apiService } from '@/infrastructure/api'
import { Badge, Button, cx, Drawer, Eyebrow } from '@/ui/primitives'
import { CardUsageLine } from '@/ui/components/common/CardUsageLine'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { dateFromApiTimestamp } from '../../../../utils/time'

export interface CardHistoryDrawerProps {
    open: boolean
    onClose: () => void
    cardType: VersionableCardType
    cardId: string
    cardName: string
    /** Whether a private draft with unpublished edits exists. */
    hasDraft: boolean
    /** The published version the draft forked from (for "unsaved since v{n}"). */
    basedOnVersionNumber: number
    /** The newest published version number (the "Latest" marker). */
    latestVersionNumber: number
    /** True while a draft mutation (publish/discard/restore) is in flight. */
    busy: boolean
    onPublish: () => void
    onDiscard: () => void
    onRestore: (versionNumber: number) => void
    /** Open a version READ-ONLY (no draft changes) — drives the `?version=<n>` deep-link. */
    onView: (versionNumber: number) => void
    /** Bumped by the editor after publish so the list refetches the new version. */
    reloadToken?: number
}

function formatWhen(iso?: string | null): string {
    const d = dateFromApiTimestamp(iso ?? undefined)
    if (!d) return ''
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
}

export function CardHistoryDrawer({
    open,
    onClose,
    cardType,
    cardId,
    cardName,
    hasDraft,
    basedOnVersionNumber,
    latestVersionNumber,
    busy,
    onPublish,
    onDiscard,
    onRestore,
    onView,
    reloadToken,
}: CardHistoryDrawerProps) {
    const { t } = useTranslation()
    const [versions, setVersions] = useState<CardVersion[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const usage = useCardUsage(cardType, cardId, { enabled: open && Boolean(cardId) })

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await apiService.listCardVersions(cardType, cardId)
            setVersions(res.versions ?? [])
        } catch {
            setError(t('cardVersions.errors.load'))
        } finally {
            setLoading(false)
        }
    }, [cardType, cardId, t])

    // Refetch on open and whenever the editor signals a publish happened.
    useEffect(() => {
        if (open && cardId) void load()
    }, [open, cardId, load, reloadToken])

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow={<Eyebrow tone="arcane">{t('cardVersions.drawer.eyebrow')}</Eyebrow>}
            title={t('cardVersions.history.title')}
            footer={
                <Button variant="secondary" onClick={onClose}>
                    {t('cardVersions.drawer.done')}
                </Button>
            }
        >
            {cardName && (
                <p className="mb-1 font-display text-base font-semibold text-parchment-100">{cardName}</p>
            )}
            <p className="mb-4 font-narrative text-xs leading-snug text-parchment-400">
                {t('cardVersions.history.intro')}
            </p>

            <CardUsageLine usage={usage} showNone className="mb-4" />

            {/* Draft tier — only while there are unpublished edits. */}
            {hasDraft && (
                <div className="mb-4 rounded-xl border border-ember-500/55 bg-ember-500/10 px-3.5 py-3">
                    <div className="flex items-center gap-2">
                        <Badge tone="ember">{t('cardVersions.history.draftBadge')}</Badge>
                        <span className="font-ui text-sm font-semibold text-parchment-100">
                            {basedOnVersionNumber > 0
                                ? t('cardVersions.history.unsavedSince', { number: basedOnVersionNumber })
                                : t('cardVersions.history.unsavedNew')}
                        </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                            variant="arcane"
                            size="sm"
                            iconLeft={<Upload size={14} strokeWidth={1.75} />}
                            onClick={onPublish}
                            disabled={busy}
                        >
                            {t('cardVersions.publish.button')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<Undo2 size={14} strokeWidth={1.75} />}
                            onClick={onDiscard}
                            disabled={busy}
                        >
                            {t('cardVersions.draft.discard')}
                        </Button>
                    </div>
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
                        const isLatest = v.version_number === latestVersionNumber
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
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<Eye size={14} strokeWidth={1.75} />}
                                        onClick={() => onView(v.version_number)}
                                        disabled={busy}
                                        title={t('cardVersions.history.viewHint')}
                                    >
                                        {t('cardVersions.history.view')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={<RotateCcw size={14} strokeWidth={1.75} />}
                                        onClick={() => onRestore(v.version_number)}
                                        disabled={busy}
                                        title={t('cardVersions.history.restoreHint')}
                                    >
                                        {t('cardVersions.history.restore')}
                                    </Button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Drawer>
    )
}
