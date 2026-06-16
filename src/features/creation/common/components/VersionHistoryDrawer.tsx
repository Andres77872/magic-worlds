/**
 * VersionHistoryDrawer — explicit card versioning + rollback for character/world/item cards.
 *
 * Versions are deliberate snapshots: "Save current as version" captures the card's current
 * content as an immutable version; "Restore" brings an earlier version back as the live card
 * (in place — history is never deleted). A session/chat that cloned this card later shows a
 * "newer version available" notice when its pinned version is older than the latest here.
 *
 * Modeled on MediaHistoryDrawer (Drawer surface + apiService + per-row actions).
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw } from 'lucide-react'
import type { CardVersion, VersionableCardType } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { Badge, Button, cx, Drawer, Eyebrow, Input } from '@/ui/primitives'
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
    /**
     * Called after a successful save or restore so the parent can refetch the card
     * (its `latest_version_number` changes on save; its body changes on restore).
     */
    onChanged?: () => void
}

function formatWhen(iso?: string | null): string {
    const d = dateFromApiTimestamp(iso ?? undefined)
    if (!d) return ''
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
}

export function VersionHistoryDrawer({ open, onClose, cardType, cardId, cardName, onChanged }: VersionHistoryDrawerProps) {
    const { t } = useTranslation()
    const [versions, setVersions] = useState<CardVersion[]>([])
    const [latest, setLatest] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [label, setLabel] = useState('')
    const [saving, setSaving] = useState(false)
    const [restoring, setRestoring] = useState<number | null>(null)

    const load = useCallback(async () => {
        if (!cardId) return
        setLoading(true)
        setError(null)
        try {
            const res = await apiService.listCardVersions(cardType, cardId)
            setVersions(res.versions ?? [])
            setLatest(res.latest_version_number ?? 0)
        } catch {
            setError(t('cardVersions.errors.load'))
        } finally {
            setLoading(false)
        }
    }, [cardType, cardId, t])

    // Fetch on open (and whenever the target card changes while open).
    useEffect(() => {
        if (open && cardId) void load()
        if (!open) {
            setLabel('')
            setError(null)
        }
    }, [open, cardId, load])

    const handleSave = async () => {
        if (!cardId || saving) return
        setSaving(true)
        setError(null)
        try {
            await apiService.saveCardVersion(cardType, cardId, label || undefined)
            setLabel('')
            await load()
            onChanged?.()
        } catch {
            setError(t('cardVersions.errors.save'))
        } finally {
            setSaving(false)
        }
    }

    const handleRestore = async (versionNumber: number) => {
        if (!cardId || restoring !== null) return
        setRestoring(versionNumber)
        setError(null)
        try {
            await apiService.restoreCardVersion(cardType, cardId, versionNumber)
            await load()
            onChanged?.()
        } catch {
            setError(t('cardVersions.errors.restore'))
        } finally {
            setRestoring(null)
        }
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="lg"
            eyebrow={<Eyebrow tone="arcane">{t('cardVersions.drawer.eyebrow')}</Eyebrow>}
            title={t('cardVersions.drawer.title')}
            footer={
                <Button kind="secondary" onClick={onClose}>
                    {t('cardVersions.drawer.done')}
                </Button>
            }
        >
            {cardName && (
                <p className="mb-1 font-display text-base font-semibold text-parchment-100">{cardName}</p>
            )}
            <p className="mb-4 font-narrative text-xs leading-snug text-parchment-400">
                {t('cardVersions.drawer.intro')}
            </p>

            {/* Save current as a new version. */}
            <div className="mb-5 flex items-end gap-2">
                <label className="flex-1">
                    <span className="sr-only">{t('cardVersions.drawer.labelPlaceholder')}</span>
                    <Input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder={t('cardVersions.drawer.labelPlaceholder')}
                        disabled={!cardId || saving}
                        maxLength={255}
                    />
                </label>
                <Button kind="primary" onClick={() => void handleSave()} disabled={!cardId || saving}>
                    {saving ? t('cardVersions.drawer.saving') : t('cardVersions.drawer.saveButton')}
                </Button>
            </div>

            {error && <p className="mb-3 text-sm text-blood-500">{error}</p>}

            {loading && versions.length === 0 ? (
                <p className="font-narrative text-sm text-parchment-400">{t('cardVersions.drawer.loading')}</p>
            ) : versions.length === 0 ? (
                <EmptyState
                    icon={<History size={28} strokeWidth={1.5} />}
                    message={t('cardVersions.drawer.emptyTitle')}
                    secondaryText={t('cardVersions.drawer.emptyHint')}
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {versions.map((v) => {
                        const isCurrent = v.version_number === latest
                        const busy = restoring === v.version_number
                        return (
                            <li
                                key={v.version_id}
                                className={cx(
                                    'flex items-center justify-between gap-3 rounded-xl border bg-ink-800 px-3 py-2.5',
                                    isCurrent ? 'border-arcane-400/60' : 'border-parchment-50/10',
                                )}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-ui text-sm font-semibold text-parchment-100">
                                            {t('cardVersions.drawer.versionLabel', { number: v.version_number })}
                                        </span>
                                        {isCurrent && <Badge tone="arcane">{t('cardVersions.drawer.current')}</Badge>}
                                    </div>
                                    {v.label && <p className="truncate font-narrative text-xs text-parchment-300">{v.label}</p>}
                                    <p className="font-ui text-[11px] text-parchment-500">{formatWhen(v.created_at)}</p>
                                </div>
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    iconLeft={<RotateCcw size={14} strokeWidth={1.75} />}
                                    onClick={() => void handleRestore(v.version_number)}
                                    disabled={restoring !== null}
                                >
                                    {busy ? t('cardVersions.drawer.restoring') : t('cardVersions.drawer.restore')}
                                </Button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Drawer>
    )
}
