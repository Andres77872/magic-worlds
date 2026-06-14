/**
 * LorebookRail — the dashboard's "lore & memory" shelf (section 8). Reuses the
 * gallery's LorebookCard in a horizontal scroll-snap rail and owns its own
 * delete confirmation. Renders nothing when the user has no lorebooks yet.
 */

import { useState } from 'react'
import { ArrowRight, BookOpen, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Lorebook } from '@/shared'
import { LorebookCard } from '@/features/lorebook/components/LorebookCard'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { CardGrid, type CardOption } from '@/ui/components/lists/Card'
import { Button, Icon, SectionHeader } from '@/ui/primitives'

export interface LorebookRailProps {
    lorebooks: Lorebook[]
    /** Full collection size (lorebooks is already capped) for the "View all (N)" count. */
    total?: number
    onOpen: (lorebook: Lorebook) => void
    onDelete: (lorebook: Lorebook) => Promise<void> | void
    onViewAll?: () => void
}

export function LorebookRail({ lorebooks, total, onOpen, onDelete, onViewAll }: LorebookRailProps) {
    const { t } = useTranslation()
    const [pending, setPending] = useState<Lorebook | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    if (lorebooks.length === 0) return null
    const count = total ?? lorebooks.length

    const confirmDelete = async () => {
        const target = pending
        setPending(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await onDelete(target)
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="flex flex-col gap-3" data-testid="lorebook-rail">
            <SectionHeader
                title={t('landing.rail.lorebooksTitle')}
                icon={BookOpen}
                tone="arcane"
                right={
                    onViewAll ? (
                        <Button
                            kind="ghost"
                            size="sm"
                            iconRight={<Icon icon={ArrowRight} size={14} />}
                            onClick={onViewAll}
                            aria-label={t('landing.rail.viewAll', { count })}
                        >
                            {t('landing.rail.viewAll', { count })}
                        </Button>
                    ) : undefined
                }
            />
            <CardGrid
                items={lorebooks}
                layout="rail"
                fadeEdges
                getItemKey={(lorebook) => lorebook.id}
                showEmptyState={false}
                renderCard={(lorebook) => {
                    const options: CardOption[] = [
                        { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: t('gallery.edit'), onClick: () => onOpen(lorebook) },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15} />,
                            label: t('gallery.delete'),
                            onClick: () => setPending(lorebook),
                            danger: true,
                        },
                    ]
                    return (
                        <LorebookCard
                            lorebook={lorebook}
                            options={options}
                            onClick={() => onOpen(lorebook)}
                            deleting={deletingId === lorebook.id}
                        />
                    )
                }}
            />

            <ConfirmDialog
                visible={pending !== null}
                title={t('landing.rail.deleteLorebookTitle')}
                message={pending ? t('landing.rail.deleteMessage', { name: pending.name }) : ''}
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
