/**
 * UseExampleLink — one-click ghost copy for first-class prose fields (name,
 * description, greeting…). Guided fields get this behavior from GuidedFieldRow;
 * this is the same affordance for fields that live outside the engine.
 */
import { useTranslation } from 'react-i18next'

export interface UseExampleLinkProps {
    value: string
    hint?: string
    onUse: (hint: string) => void
}

export function UseExampleLink({ value, hint, onUse }: UseExampleLinkProps) {
    const { t } = useTranslation()
    if (value.trim() || !hint) return null
    return (
        <button
            type="button"
            onClick={() => onUse(hint)}
            className="self-start font-narrative text-[12px] italic text-arcane-300 transition-colors hover:text-arcane-400"
            title={t('creation.common.fieldRow.useExampleTitle')}
        >
            {t('creation.common.fieldRow.useExample')}
        </button>
    )
}
