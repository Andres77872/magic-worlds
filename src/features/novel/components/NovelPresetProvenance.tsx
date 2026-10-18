/** Which prompt preset version a request was filled from and with which values (A19); the copy is frozen with the turn. */

import { useTranslation } from 'react-i18next'
import type { NovelPresetSnapshot } from '@/shared/types/storyAssistant.types'

export function NovelPresetProvenance({ value }: { value: NovelPresetSnapshot }) {
    const { t } = useTranslation()
    const filled = value.definition.inputs.filter((input) => value.inputs[input.key])
    return <section aria-label={t('novelEditor.assistantPresets.provenanceLabel')} className="space-y-1 rounded-md border border-parchment-50/10 bg-ink-800/60 p-3">
        <p className="text-caption text-parchment-200">{t('novelEditor.assistantPresets.provenance', { name: value.name, version: value.revision })}</p>
        {filled.length > 0 && <dl className="grid gap-x-3 gap-y-1 text-caption sm:grid-cols-[auto_1fr]">
            {filled.map((input) => <div key={input.key} className="contents"><dt className="text-parchment-400">{input.label}</dt><dd className="min-w-0 break-words text-parchment-200">{value.inputs[input.key]}</dd></div>)}
        </dl>}
    </section>
}
