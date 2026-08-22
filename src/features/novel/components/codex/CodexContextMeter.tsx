/**
 * CodexContextMeter — answers the one question the codex panel never used to:
 * what actually reached the model. Every generation returns a StoryContextTrace
 * that the UI threw away; this well surfaces the enabled/total split, the token
 * estimate, and how many chapters rode along, so a writer can see the cost of
 * an entry before wondering why the AI ignored it. Arcane-tinted because it
 * describes the AI side, not the manuscript.
 */

import { useTranslation } from 'react-i18next'

export interface CodexContextMeterProps {
    enabledCount: number
    totalCount: number
    /** null until a generation has run — no trace means no numbers to show. */
    estimatedTokens: number | null
    chapterCount: number | null
}

export function CodexContextMeter({ enabledCount, totalCount, estimatedTokens, chapterCount }: CodexContextMeterProps) {
    const { t } = useTranslation()

    const total = safeCount(totalCount)
    const enabled = Math.min(safeCount(enabledCount), total)
    const percent = total > 0 ? Math.round((enabled / total) * 100) : 0

    // A trace only exists after the first generation; until then the footer
    // explains the toggles instead of printing a number nobody measured.
    const tokens = estimatedTokens !== null && Number.isFinite(estimatedTokens) ? safeCount(estimatedTokens) : null
    const chapters = chapterCount !== null && Number.isFinite(chapterCount) ? safeCount(chapterCount) : null

    const footer =
        tokens === null
            ? t('novelEditor.codex.context.hint')
            : [t('novelEditor.codex.context.tokens', { tokens }), chapters === null ? null : t('novelEditor.codex.context.chapters', { count: chapters })]
                  .filter(Boolean)
                  .join(' · ')

    return (
        <div
            className="rounded-md border border-arcane-500/25 bg-arcane-500/[.07] p-2"
            data-testid="codex-context-meter"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-ui text-xs font-semibold text-parchment-200">
                    {t('novelEditor.codex.context.title')}
                </span>
                <span className="font-mono text-meta text-arcane-300">
                    {t('novelEditor.codex.context.count', { enabled, total })}
                </span>
            </div>
            {/* An empty codex has nothing to measure: aria-valuemax must exceed
                aria-valuemin, so the track drops its progressbar role instead of
                claiming an invalid 0..0 range. */}
            <div
                className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-parchment-50/10"
                role={total > 0 ? 'progressbar' : undefined}
                aria-hidden={total > 0 ? undefined : true}
                aria-label={total > 0 ? t('novelEditor.codex.context.title') : undefined}
                aria-valuemin={total > 0 ? 0 : undefined}
                aria-valuemax={total > 0 ? total : undefined}
                aria-valuenow={total > 0 ? enabled : undefined}
            >
                <div className="h-full bg-arcane-500 transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <p className="m-0 mt-1.5 font-ui text-meta text-parchment-400">{footer}</p>
        </div>
    )
}

function safeCount(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}
