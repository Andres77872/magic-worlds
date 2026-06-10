/**
 * SceneCard — a discovery-gallery card: a seeded monogram portrait on top,
 * then name + world, a two-line hook, and genre tags. The whole card begins the
 * scene; a hover menu exposes edit / delete.
 */

import type { KeyboardEvent, MouseEvent } from 'react'
import { Pencil, Play, Trash2 } from 'lucide-react'
import { MODE_META } from '@/shared/modes'
import { Badge, Card, Icon, Portrait, Tag } from '@/ui/primitives'
import { CardOptions, type CardOption } from '@/ui/components/lists/Card'
import { ModeBadge } from '@/ui/components/common/ModeBadge'
import type { Scene } from './sceneModel'

export interface SceneCardProps {
    scene: Scene
    onBegin: () => void
    onEdit: () => void
    onDelete: () => void
}

export function SceneCard({ scene, onBegin, onEdit, onDelete }: SceneCardProps) {
    const options: CardOption[] = [
        { type: 'custom', icon: <Icon icon={Play} size={15} />, label: MODE_META.adventure.beginLabel, onClick: onBegin },
        { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: 'Edit', onClick: onEdit },
        { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: 'Delete', onClick: onDelete, danger: true },
    ]

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onBegin()
        }
    }

    return (
        <Card
            interactive
            role="button"
            tabIndex={0}
            aria-label={`Begin adventure: ${scene.title}`}
            onClick={onBegin}
            onKeyDown={handleKeyDown}
            className="group flex h-full flex-col"
        >
            <div className="relative">
                <Portrait name={scene.title} height={140} />
                <span className="absolute left-3 top-3 flex items-center gap-1.5">
                    <ModeBadge mode="adventure" compact />
                    {scene.tags[0] && <Badge tone="glass">{scene.tags[0]}</Badge>}
                </span>
                <div
                    className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                    onClick={(e: MouseEvent) => e.stopPropagation()}
                >
                    <CardOptions options={options} aria-label={`Actions for ${scene.title}`} />
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate font-display text-lg font-semibold leading-tight text-parchment-50" title={scene.title}>
                        {scene.title}
                    </h3>
                    {scene.location && (
                        <span className="shrink-0 font-mono text-[11px] text-parchment-400" title={scene.location}>
                            {scene.location}
                        </span>
                    )}
                </div>

                <p className="line-clamp-2 font-narrative text-sm leading-normal text-parchment-300">
                    {scene.description}
                </p>

                {scene.tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                        {scene.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}
