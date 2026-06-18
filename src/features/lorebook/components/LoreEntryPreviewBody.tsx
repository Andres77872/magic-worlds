/**
 * LoreEntryPreviewBody — read-only view of a single lorebook entry for a
 * floating preview window: type + optional source + keys + full content.
 */
import { useTranslation } from 'react-i18next'
import { Tag } from '@/ui/primitives'
import type { LorebookEntry } from '@/shared'

interface LoreEntryPreviewBodyProps {
    entry: LorebookEntry
    /** Source lorebook name, when the entry is a clone (novel codex). */
    sourceName?: string
    /** Pre-localized origin line (e.g. "From {lorebook}") when opened from a chat trigger. */
    originLabel?: string
}

export function LoreEntryPreviewBody({ entry, sourceName, originLabel }: LoreEntryPreviewBodyProps) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
                <Tag>{entry.entryType}</Tag>
                {entry.constant && <Tag>{t('floatingWindows.constant')}</Tag>}
            </div>
            {originLabel ? (
                <p className="m-0 font-ui text-xs text-arcane-300">{originLabel}</p>
            ) : sourceName ? (
                <p className="m-0 font-ui text-xs text-parchment-400">
                    {t('novelEditor.entryDrawer.clonedFrom', { name: sourceName })}
                </p>
            ) : null}
            {(entry.keys.length > 0 || entry.secondaryKeys.length > 0) && (
                <div className="flex flex-col gap-1.5">
                    {entry.keys.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-ui text-xs text-parchment-400">{t('novelEditor.entryDrawer.keys')}</span>
                            {entry.keys.map((key) => (
                                <Tag key={key}>{key}</Tag>
                            ))}
                        </div>
                    )}
                    {entry.secondaryKeys.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-ui text-xs text-parchment-400">{t('floatingWindows.secondaryKeys')}</span>
                            {entry.secondaryKeys.map((key) => (
                                <Tag key={key}>{key}</Tag>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {entry.content && (
                <p className="m-0 whitespace-pre-line font-narrative text-sm leading-relaxed text-parchment-200">
                    {entry.content}
                </p>
            )}
        </div>
    )
}
