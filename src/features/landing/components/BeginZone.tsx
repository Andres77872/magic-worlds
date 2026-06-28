/**
 * BeginZone — "begin anew": the adventure templates waiting to start. Owns the
 * genre chips (they only ever filtered scenes), an image-forward GalleryCard
 * grid capped so the dashboard teases while the gallery exhausts, the no-match
 * panel, and the create-CTA panel for accounts with no templates yet.
 */

import { ArrowRight, Pencil, Play, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Adventure } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { GalleryCard, type CardOption } from '@/ui/components/lists/Card'
import { Button, Eyebrow, GlowBackdrop, Icon } from '@/ui/primitives'
import { CARD_GRID_CLASS, sceneCardProps } from './libraryCards'
import type { Scene } from './sceneModel'
import { FilterChips } from './FilterChips'
import { ZoneHeader } from './ZoneHeader'

/** Two rows of five at 1160px — a tease, not an archive. */
const GRID_CAP = 10

export interface BeginZoneProps {
    /** Chip-filtered scenes for the grid (the page handles any hero slice). */
    scenes: Scene[]
    /** All templates, for the count + view-all affordances. */
    totalCount: number
    genres: string[]
    filter: string
    onFilterChange: (filter: string) => void
    onBegin: (template: Adventure) => void
    onEdit: (template: Adventure) => void
    onDelete: (template: Adventure) => void
    onViewAll: () => void
    onCreate: () => void
}

export function BeginZone({
    scenes,
    totalCount,
    genres,
    filter,
    onFilterChange,
    onBegin,
    onEdit,
    onDelete,
    onViewAll,
    onCreate,
}: BeginZoneProps) {
    const { t } = useTranslation()
    if (totalCount === 0) {
        return (
            <section className="flex flex-col" data-testid="begin-zone">
                <BeginHeader count={0} onViewAll={undefined} onCreate={onCreate} />
                <div className="relative mt-5 flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-parchment-50/10 bg-ink-800 px-8 py-14 text-center">
                    <GlowBackdrop variant="center" />
                    <div className="relative flex flex-col items-center gap-3">
                        <Eyebrow tone="ember">{t('landing.begin.emptyEyebrow')}</Eyebrow>
                        <h3 className="m-0 font-display text-h3 font-semibold text-parchment-50">
                            {t('landing.begin.emptyTitle')}
                        </h3>
                        <p className="m-0 max-w-[46ch] font-narrative text-narrative text-parchment-300">
                            {t('landing.begin.emptyBody')}
                        </p>
                        <div className="pt-2">
                            <Button variant="primary" iconLeft={<Icon icon={Wand2} size={16} />} onClick={onCreate}>
                                {t('landing.begin.emptyAction')}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        )
    }

    const visible = scenes.slice(0, GRID_CAP)

    return (
        <section className="flex flex-col" data-testid="begin-zone">
            <BeginHeader count={totalCount} onViewAll={onViewAll} onCreate={onCreate} />
            {genres.length > 0 && (
                <div className="mt-4">
                    <FilterChips options={genres} active={filter} onChange={onFilterChange} />
                </div>
            )}

            {visible.length > 0 ? (
                <div className={`mt-5 ${CARD_GRID_CLASS}`}>
                    {visible.map((scene) => {
                        const options: CardOption[] = [
                            {
                                type: 'custom',
                                icon: <Icon icon={Play} size={15} />,
                                label: MODE_META.adventure.beginLabel,
                                onClick: () => onBegin(scene.template),
                            },
                            {
                                type: 'custom',
                                icon: <Icon icon={Pencil} size={15} />,
                                label: t('gallery.edit'),
                                onClick: () => onEdit(scene.template),
                            },
                            {
                                type: 'custom',
                                icon: <Icon icon={Trash2} size={15} />,
                                label: t('gallery.delete'),
                                onClick: () => onDelete(scene.template),
                                danger: true,
                            },
                        ]
                        return (
                            <GalleryCard
                                key={scene.template.id}
                                {...sceneCardProps(scene)}
                                cardType="adventure_template"
                                cardId={scene.template.id}
                                options={options}
                                onClick={() => onBegin(scene.template)}
                                actionLabel={`${MODE_META.adventure.beginLabel}: ${scene.title}`}
                            />
                        )
                    })}
                </div>
            ) : filter !== 'All' ? (
                <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-parchment-50/[.12] bg-ink-800 p-12 text-center">
                    <Icon icon={Sparkles} size={28} className="text-parchment-500" />
                    <p className="m-0 font-narrative text-narrative text-parchment-300">
                        {t('landing.begin.noGenreMatch')}
                    </p>
                    <Button variant="secondary" size="sm" onClick={() => onFilterChange('All')}>
                        {t('landing.begin.clearFilter')}
                    </Button>
                </div>
            ) : null}
        </section>
    )
}

function BeginHeader({ count, onViewAll, onCreate }: { count: number; onViewAll?: () => void; onCreate: () => void }) {
    const { t } = useTranslation()
    return (
        <ZoneHeader
            eyebrow={t('landing.begin.eyebrow')}
            title={t('landing.begin.title')}
            right={
                <>
                    <Button variant="ghost" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={onCreate}>
                        {t('landing.begin.newAdventure')}
                    </Button>
                    {onViewAll && (
                        <Button
                            variant="ghost"
                            size="sm"
                            iconRight={<Icon icon={ArrowRight} size={14} />}
                            onClick={onViewAll}
                            aria-label={t('landing.begin.viewAllAria')}
                        >
                            {t('landing.begin.viewAll', { count })}
                        </Button>
                    )}
                </>
            }
        />
    )
}
