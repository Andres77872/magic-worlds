/**
 * CastRail — "who will you meet": the user's AI characters as a compact
 * image-forward rail, each card carrying the arcane Chat affordance (the 1:1
 * conversation entry point). Sub-rail register: SectionHeader, not a zone
 * header, because it lives inside the Begin zone's rhythm.
 */

import { useState } from 'react'
import { ArrowRight, MessageCircle, Pencil, Trash2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Character } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { CardGrid, GalleryCard, type CardOption } from '@/ui/components/lists/Card'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { characterCardProps } from './libraryCards'

/** A shelf teases; the characters gallery exhausts. */
const RAIL_CAP = 12

export interface CastRailProps {
    cast: Character[]
    onChat: (character: Character) => void
    onEdit: (character: Character) => void
    onDelete: (character: Character) => Promise<void> | void
    onViewAll: () => void
}

export function CastRail({ cast, onChat, onEdit, onDelete, onViewAll }: CastRailProps) {
    const { t } = useTranslation()
    const [pending, setPending] = useState<Character | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

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
        <section className="flex flex-col gap-1" data-testid="cast-rail">
            <SectionHeader
                title={t('landing.cast.title')}
                icon={Users}
                right={
                    <Button
                        kind="ghost"
                        size="sm"
                        iconRight={<Icon icon={ArrowRight} size={14} />}
                        onClick={onViewAll}
                        aria-label={t('landing.cast.viewAllAria')}
                    >
                        {t('landing.cast.viewAll', { count: cast.length })}
                    </Button>
                }
            />
            <CardGrid
                items={cast.slice(0, RAIL_CAP)}
                layout="rail"
                railWidth="compact"
                fadeEdges
                getItemKey={(character) => character.id}
                showEmptyState={false}
                renderCard={(character) => {
                    const options: CardOption[] = [
                        {
                            type: 'custom',
                            icon: <Icon icon={Pencil} size={15} />,
                            label: t('gallery.edit'),
                            onClick: () => onEdit(character),
                        },
                        {
                            type: 'custom',
                            icon: <Icon icon={Trash2} size={15} />,
                            label: t('gallery.delete'),
                            onClick: () => setPending(character),
                            danger: true,
                        },
                    ]
                    return (
                        <GalleryCard
                            {...characterCardProps(character)}
                            size="compact"
                            cardType="character"
                            cardId={character.id}
                            options={options}
                            onClick={() => onEdit(character)}
                            actionLabel={t('landing.rail.editAria', { name: character.name })}
                            deleting={deletingId === character.id}
                            footer={
                                <Button
                                    kind="arcane"
                                    size="sm"
                                    full
                                    iconLeft={<Icon icon={MessageCircle} size={15} />}
                                    onClick={() => onChat(character)}
                                >
                                    {t('landing.cast.chat')}
                                </Button>
                            }
                        />
                    )
                }}
            />

            <ConfirmDialog
                visible={pending !== null}
                title={t('landing.cast.deleteTitle')}
                message={pending ? t('landing.cast.deleteMessage', { name: pending.name }) : ''}
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
