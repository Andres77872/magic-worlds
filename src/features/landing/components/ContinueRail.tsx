/**
 * ContinueRail — the dashboard's "pick up where you left off" shelf shell, shared
 * by the active adventures, chats, and novels sections. A SectionHeader (icon +
 * tone + "See all") over a horizontal scroll-snap rail of fixed-width cards.
 * Renders nothing when the collection is empty, so dormant sections fold away
 * instead of leaving a bare header.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CardGrid } from '@/ui/components/lists/Card'
import { Button, Icon, SectionHeader } from '@/ui/primitives'

export interface ContinueRailProps<T> {
    title: string
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
    items: T[]
    /** Full collection size (items is already capped) for the "See all (N)" count. */
    total?: number
    getItemKey: (item: T, index: number) => string
    renderCard: (item: T) => ReactNode
    onViewAll?: () => void
    viewAllLabel?: string
    'data-testid'?: string
}

export function ContinueRail<T>({
    title,
    icon,
    tone = 'ember',
    items,
    total,
    getItemKey,
    renderCard,
    onViewAll,
    viewAllLabel,
    'data-testid': testId,
}: ContinueRailProps<T>) {
    const { t } = useTranslation()
    if (items.length === 0) return null
    const resolvedViewAllLabel = viewAllLabel ?? t('landing.continue.seeAll')
    const label = total != null ? `${resolvedViewAllLabel} (${total})` : resolvedViewAllLabel

    return (
        <section className="flex flex-col gap-3" data-testid={testId}>
            <SectionHeader
                title={title}
                icon={icon}
                tone={tone}
                right={
                    onViewAll ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            iconRight={<Icon icon={ArrowRight} size={14} />}
                            onClick={onViewAll}
                            aria-label={label}
                        >
                            {label}
                        </Button>
                    ) : undefined
                }
            />
            <CardGrid
                items={items}
                layout="rail"
                fadeEdges
                getItemKey={getItemKey}
                showEmptyState={false}
                renderCard={(item) => renderCard(item)}
            />
        </section>
    )
}
