import { useTranslation } from 'react-i18next'
import type { EditorCodexEntry } from '../types'
import { KIND_META } from '../../utils/codexUtils'

export function ReferenceEntrySummary({ entry, preview = false }: { entry: EditorCodexEntry; preview?: boolean }) {
    const { t } = useTranslation()
    const kind = KIND_META.find((meta) => meta.kind === entry.kind)
    return <span className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden whitespace-normal text-left">
        <span className="break-words font-ui text-label font-semibold text-parchment-100">{entry.label}</span>
        <span className="break-words font-ui text-caption text-parchment-300">
            {kind ? t(kind.labelKey) : entry.kind} · {t(`novelEditor.references.scope.${entry.scope ?? 'novel'}`)}{entry.scopeLabel ? `: ${entry.scopeLabel}` : ''}
            {entry.sourceVersionNumber != null ? ` · ${t('novelEditor.references.version', { number: entry.sourceVersionNumber })}` : ''}
        </span>
        {entry.sourceId && <span className="break-all font-ui text-caption text-parchment-400">{t('novelEditor.references.source', { id: entry.sourceId })}</span>}
        <span className="font-ui text-caption text-parchment-300">{t(`novelEditor.references.state.${entry.contextState ?? (entry.enabled ? 'enabled' : 'disabled')}`)}</span>
        {preview && <span className="line-clamp-2 whitespace-pre-wrap font-ui text-caption text-parchment-200">{entry.description || t('novelEditor.references.noContent')}</span>}
    </span>
}
