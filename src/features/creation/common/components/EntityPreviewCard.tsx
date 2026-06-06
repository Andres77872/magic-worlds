/**
 * EntityPreviewCard — the live "card" preview shared by the Character and World
 * creators. Renders the real domain Card (so the preview matches the library
 * list exactly) fed from live form state: a name-seeded portrait, the name as
 * title, the race/type as a Tag subtitle, a few filled attributes, a clamped
 * description, and triggers as ember chips.
 */

import { Card } from '@/ui/components/lists/Card'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { Chip, Eyebrow, Tag } from '@/ui/primitives'
import type { AttrMap } from '../hooks'

export interface EntityPreviewCardProps {
    name: string
    /** Title shown when no name has been typed yet, e.g. "Unnamed Character". */
    unnamedLabel: string
    /** The race (character) or type (world) value. */
    badge: string
    /** Placeholder shown when the badge value is empty, e.g. "Add a race…". */
    badgePlaceholder: string
    description?: string
    triggers: string[]
    attributes: AttrMap
    categories: AttributeCategory[]
}

export function EntityPreviewCard({
    name,
    unnamedLabel,
    badge,
    badgePlaceholder,
    description,
    triggers,
    attributes,
    categories,
}: EntityPreviewCardProps) {
    // Same filter as toCategoryPayload — only fully-filled rows count.
    const topAttrs = categories
        .flatMap((category) => attributes[category.id] || [])
        .filter((row) => row.key && row.value)
        .slice(0, 3)

    const hasBody = topAttrs.length > 0 || Boolean(description?.trim()) || triggers.length > 0

    return (
        <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Live preview</Eyebrow>
            <Card
                title={name.trim() || unnamedLabel}
                subtitle={
                    badge.trim() ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Tag>{badge}</Tag>
                        </div>
                    ) : (
                        <span className="font-narrative italic text-parchment-400">{badgePlaceholder}</span>
                    )
                }
            >
                {hasBody ? (
                    <div className="flex flex-col gap-3">
                        {topAttrs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {topAttrs.map((attr, i) => (
                                    <Tag key={`${attr.key}-${i}`}>
                                        {attr.key}: {attr.value}
                                    </Tag>
                                ))}
                            </div>
                        )}
                        {description?.trim() && (
                            <p className="line-clamp-3 font-narrative text-sm leading-normal text-parchment-400">
                                {description}
                            </p>
                        )}
                        {triggers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {triggers.slice(0, 6).map((trigger, i) => (
                                    <Chip key={`${trigger}-${i}`} active disabled tabIndex={-1} className="pointer-events-none">
                                        {trigger}
                                    </Chip>
                                ))}
                                {triggers.length > 6 && <Tag>+{triggers.length - 6}</Tag>}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="font-narrative text-sm italic text-parchment-400">
                        Your card takes shape here as you fill in the details.
                    </p>
                )}
            </Card>
        </div>
    )
}
