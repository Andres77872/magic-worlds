import { useTranslation } from 'react-i18next'
import type { LabMarkupMode } from '@/shared'
import { Button } from '@/ui/primitives'
import type { LabModelProfile } from '../../constants'

export interface MarkupInsert {
    id: string
    labelKey: string
    text: string
}

/**
 * Inserts per markup mode (05 §3.3): app speech markup v1 (translated per
 * model by the pipeline) or the model's native syntax, hiding inserts the
 * selected model does not support.
 */
export function markupInserts(mode: LabMarkupMode, model: LabModelProfile): MarkupInsert[] {
    if (mode === 'app') {
        return [
            { id: 'pause', labelKey: 'admin.voices.lab.markup.pause', text: '<#0.4#>' },
            { id: 'longPause', labelKey: 'admin.voices.lab.markup.longPause', text: '<#1.5#>' },
            { id: 'laugh', labelKey: 'admin.voices.lab.markup.laugh', text: '(laughs)' },
            { id: 'sigh', labelKey: 'admin.voices.lab.markup.sigh', text: '(sighs)' },
            { id: 'gasp', labelKey: 'admin.voices.lab.markup.gasp', text: '(gasps)' },
        ]
    }
    const inserts: MarkupInsert[] = []
    if (model.breaks) inserts.push({ id: 'break', labelKey: 'admin.voices.lab.markup.pause', text: '<break time="0.4s"/>' })
    if (model.audioTags) {
        inserts.push(
            { id: 'shortPause', labelKey: 'admin.voices.lab.markup.shortPause', text: '[short pause]' },
            { id: 'longPause', labelKey: 'admin.voices.lab.markup.longPause', text: '[long pause]' },
            { id: 'laugh', labelKey: 'admin.voices.lab.markup.laugh', text: '[laughs]' },
            { id: 'sigh', labelKey: 'admin.voices.lab.markup.sigh', text: '[sighs]' },
            { id: 'gasp', labelKey: 'admin.voices.lab.markup.gasp', text: '[gasps]' },
        )
    }
    if (model.inlineIpa) inserts.push({ id: 'ipa', labelKey: 'admin.voices.lab.markup.ipa', text: '"/ipa/"' })
    return inserts
}

interface MarkupToolbarProps {
    mode: LabMarkupMode
    model: LabModelProfile
    onInsert: (text: string) => void
}

export function MarkupToolbar({ mode, model, onInsert }: MarkupToolbarProps) {
    const { t } = useTranslation()
    const inserts = markupInserts(mode, model)
    if (inserts.length === 0) return null
    return (
        <div role="toolbar" aria-label={t('admin.voices.lab.markup.aria')} className="flex flex-wrap gap-1.5">
            {inserts.map((insert) => (
                <Button key={insert.id} variant="ghost" size="xs" onClick={() => onInsert(insert.text)} title={insert.text}>
                    {t(insert.labelKey)}
                    <span className="ml-1 font-mono text-[10px] text-fg-muted" aria-hidden>
                        {insert.text}
                    </span>
                </Button>
            ))}
        </div>
    )
}
