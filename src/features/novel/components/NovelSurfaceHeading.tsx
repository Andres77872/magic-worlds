/** The heading of a Plan or Review surface, with the way back to the manuscript. */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'
import { Button, Eyebrow, Icon } from '@/ui/primitives'

export function NovelSurfaceHeading({ id, title, eyebrow, icon, onBack }: {
    id: string; title: string; eyebrow: string; icon: ReactNode; onBack: () => void
}) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-parchment-50/10 pb-3">
            <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden="true" className="mt-1 text-ember-400">{icon}</span>
                <div className="min-w-0">
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <h2 id={id} className="font-display text-h3 font-semibold text-parchment-50">{title}</h2>
                </div>
            </div>
            <Button size="sm" variant="secondary" iconLeft={<Icon icon={PenLine} size={16} />} onClick={onBack}>
                {t('novelEditor.surfaces.backToWrite')}
            </Button>
        </div>
    )
}
