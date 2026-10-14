import { useTranslation } from 'react-i18next'
import { BookOpen, Brain, MessageSquareQuote } from 'lucide-react'
import type { PreviewTextId } from '@/shared'
import { Icon, SegmentedControl, type SegmentedControlOption } from '@/ui/primitives'

const ICONS = { narration: BookOpen, dialogue: MessageSquareQuote, thought: Brain } as const

interface PreviewTextChooserProps {
    value: PreviewTextId
    onChange: (value: PreviewTextId) => void
}

/** Pick which fixed text a recipe preview reads (D18): narration, dialogue or thought. No free text. */
export function PreviewTextChooser({ value, onChange }: PreviewTextChooserProps) {
    const { t } = useTranslation()
    const options: SegmentedControlOption<PreviewTextId>[] = (['narration', 'dialogue', 'thought'] as const).map((id) => ({
        value: id,
        label: t(`voices.preview.textIds.${id}`),
        icon: <Icon icon={ICONS[id]} size={14} />,
    }))
    return (
        <div className="flex flex-col gap-2">
            {/* The radiogroup carries the same name; the visible label is not read twice. */}
            <p aria-hidden="true" className="font-ui text-label font-semibold text-fg">
                {t('voices.preview.textLabel')}
            </p>
            <SegmentedControl options={options} value={value} onChange={onChange} showLabels aria-label={t('voices.preview.textLabel')} className="self-start" />
        </div>
    )
}
