import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { cx, Icon } from '@/ui/primitives'
import type { RuleCheck } from '../../consoleRules'

interface RuleChecklistProps {
    title: string
    checks: readonly RuleCheck[]
    id?: string
}

/** A checklist whose state is in the text, not only the icon colour (05 §10). */
export function RuleChecklist({ title, checks, id }: RuleChecklistProps) {
    const { t } = useTranslation()
    const titleId = useId()
    return (
        <div id={id} className="flex flex-col gap-2">
            <p id={titleId} className="font-ui text-label font-semibold text-fg">
                {title}
            </p>
            <ul aria-labelledby={titleId} className="flex flex-col gap-1.5">
                {checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-2 font-ui text-sm">
                        <Icon
                            icon={check.passed ? Check : X}
                            size={15}
                            className={cx('mt-0.5 shrink-0', check.passed ? 'text-verdant-500' : 'text-blood-300')}
                        />
                        <span className={check.passed ? 'text-parchment-200' : 'text-parchment-100'}>
                            {t(check.labelKey, check.labelValues)}
                            <span className="sr-only">
                                {' — '}
                                {check.passed ? t('admin.voices.common.checkPassed') : t('admin.voices.common.checkFailed')}
                            </span>
                            {check.noteKey && <span className="block text-caption text-amber-500">{t(check.noteKey)}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
