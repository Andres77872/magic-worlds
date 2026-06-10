/**
 * AdventurePreviewCard — the "playbill" live preview of the adventure being
 * built. Pure projection of form state (no API): a scene header seeded from the
 * derived title, the premise excerpt, a cast row (persona first, ringed + "You"),
 * the chosen world, objectives count, and trigger chips.
 */

import { Avatar, Badge, Card, Chip, Eyebrow, Portrait, Tag } from '@/ui/primitives'
import { resolveMediaUrl } from '@/infrastructure/api'

export interface PreviewMember {
    id: string
    name: string
}

export interface AdventurePreviewCardProps {
    title: string
    scenario: string
    /** Cast avatars (persona already excluded by the caller). */
    cast: PreviewMember[]
    persona?: PreviewMember
    world?: { name: string; type?: string }
    objectivesCount: number
    triggers: string[]
    /** Generated cover image URL (may be backend-relative). */
    imageUrl?: string
}

export function AdventurePreviewCard({ title, scenario, cast, persona, world, objectivesCount, triggers, imageUrl }: AdventurePreviewCardProps) {
    const hasMeta = objectivesCount > 0 || triggers.length > 0

    return (
        <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Live preview</Eyebrow>
            <Card>
                <Portrait name={title} src={resolveMediaUrl(imageUrl)} height={150}>
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
                        <Eyebrow tone="ember">Now Playing</Eyebrow>
                        <h3 className="m-0 line-clamp-2 font-display text-xl font-semibold leading-tight text-parchment-50">
                            {title || 'Untitled Adventure'}
                        </h3>
                        {world && (
                            <Badge tone="arcane" className="self-start capitalize">
                                {world.type ? `${world.type}: ` : ''}
                                {world.name}
                            </Badge>
                        )}
                    </div>
                </Portrait>

                <div className="flex flex-col gap-4 p-4">
                    <p className="line-clamp-4 font-narrative text-sm leading-relaxed text-parchment-200">
                        {scenario.trim() || <span className="italic text-parchment-400">Set the opening scene…</span>}
                    </p>

                    <div>
                        <Eyebrow tone="muted" className="mb-2 block">
                            The Cast
                        </Eyebrow>
                        <div className="flex flex-wrap items-center gap-2.5">
                            {persona && (
                                <span className="relative inline-flex">
                                    <Avatar name={persona.name} size={36} ring="ember" />
                                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                                        <Badge tone="ember" className="px-1.5 py-0 text-[9px] leading-tight">
                                            You
                                        </Badge>
                                    </span>
                                </span>
                            )}
                            {cast.map((m) => (
                                <Avatar key={m.id} name={m.name} size={36} />
                            ))}
                            {cast.length === 0 && !persona && (
                                <span className="font-narrative text-xs italic text-parchment-400">No cast chosen yet</span>
                            )}
                        </div>
                    </div>

                    {hasMeta && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-parchment-50/[.08] pt-3">
                            {objectivesCount > 0 && (
                                <Tag>
                                    {objectivesCount} objective{objectivesCount > 1 ? 's' : ''}
                                </Tag>
                            )}
                            {triggers.slice(0, 6).map((t, i) => (
                                <Chip key={`${t}-${i}`} active disabled tabIndex={-1} className="pointer-events-none">
                                    {t}
                                </Chip>
                            ))}
                            {triggers.length > 6 && <Tag>+{triggers.length - 6}</Tag>}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}
