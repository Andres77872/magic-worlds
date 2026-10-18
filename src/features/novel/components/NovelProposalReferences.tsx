import { useTranslation } from 'react-i18next'
import { Callout } from '@/ui/primitives'
import { referenceKeeping } from '../utils/referenceKeeping'

/** Whether a proposal keeps the original's @references, which accepting turns back into Codex mentions (A10). */
export function NovelProposalReferences({ original, proposed, labels }: { original: string; proposed: string; labels: readonly string[] }) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistantActions.references.' + key, values)
    const rows = referenceKeeping(original, proposed, labels)
    if (!rows.length) return null
    const lost = rows.filter((row) => row.after < row.before)
    const list = (items: typeof rows, missing: boolean) => items.map((row) => missing ? text('lostItem', { label: row.label, kept: row.after, count: row.before }) : text('keptItem', { label: row.label, count: row.before })).join(', ')
    return lost.length
        ? <Callout tone="warning" role="alert">{text('lost', { list: list(lost, true) })}</Callout>
        : <p role="status" className="text-caption text-parchment-300">{text('kept', { list: list(rows, false) })}</p>
}
