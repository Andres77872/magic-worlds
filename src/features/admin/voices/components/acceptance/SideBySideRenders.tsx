import { useTranslation } from 'react-i18next'
import type { AcceptanceRender } from '@/shared'
import { STANDARD_MODEL_ID, SCRIPT_KINDS } from '../../constants'
import { ConsoleAudioPlayer } from '../shell/ConsoleAudioPlayer'

interface SideBySideRendersProps {
    renders: AcceptanceRender[]
    language: string
    /** The response's `script_version`, shown for items that carry none (I-4). */
    scriptVersion?: string | null
}

/** Copy for a failed render: a known `error_code` names its cause. */
const FAILED_RENDER_KEYS: Readonly<Record<string, string>> = {
    acceptance_scripts_missing: 'admin.voices.acceptance.review.scriptsMissing',
}

const COLUMNS = [
    { modelId: STANDARD_MODEL_ID, titleKey: 'admin.voices.acceptance.review.flashRender' },
] as const

/**
 * v4 renders of the same voice and script (05 §8.4 step 3).
 * Each render names its script version: per item (`acc-v1-<lang>` for a light
 * language), else the batch's.
 */
export function SideBySideRenders({ renders, language, scriptVersion = null }: SideBySideRendersProps) {
    const { t } = useTranslation()
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {(renders.some((item) => item.model_id === 'drama-3') ? [{ modelId: 'drama-3', titleKey: 'admin.voices.acceptance.review.flashRender' }] : COLUMNS).map((column) => {
                const items = renders
                    .filter((render) => render.model_id === column.modelId)
                    .sort((a, b) => SCRIPT_KINDS.indexOf(a.script_kind) - SCRIPT_KINDS.indexOf(b.script_kind))
                return (
                    <section
                        key={column.modelId}
                        aria-label={t(`admin.voices.models.${column.modelId}`)}
                        className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4"
                    >
                        <h4 className="font-display text-base font-semibold text-fg">{t(`admin.voices.models.${column.modelId}`)}</h4>
                        {items.length === 0 && <p className="font-ui text-sm text-fg-muted">{t('admin.voices.acceptance.review.noRenders')}</p>}
                        {items.map((render) => {
                            const title = t(column.titleKey, { script: t(`admin.voices.acceptance.scripts.${render.script_kind}`) })
                            const version = render.script_version?.trim() || scriptVersion
                            const failedKey = (render.error_code && FAILED_RENDER_KEYS[render.error_code]) || 'admin.voices.acceptance.review.renderFailed'
                            return (
                                <div key={render.render_id} className="flex flex-col gap-1.5">
                                    <p className="font-ui text-label font-semibold text-parchment-100">{title}</p>
                                    {version && (
                                        <p className="font-mono text-meta text-fg-muted">{t('admin.voices.acceptance.review.scriptVersion', { version })}</p>
                                    )}
                                    {render.status === 'ready' && render.audio_url ? (
                                        <ConsoleAudioPlayer path={render.audio_url} title={title} durationMs={render.duration_ms} />
                                    ) : (
                                        <p className="font-ui text-caption text-blood-300">{t(failedKey)}</p>
                                    )}
                                    {render.text && (
                                        <p lang={language} className="font-ui text-caption leading-relaxed text-parchment-300">
                                            {render.text}
                                        </p>
                                    )}
                                    {typeof render.integrated_lufs === 'number' && Number.isFinite(render.integrated_lufs) && (
                                        <p className="font-mono text-meta text-fg-muted">
                                            {t('admin.voices.acceptance.review.measured', { lufs: render.integrated_lufs.toFixed(1) })}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </section>
                )
            })}
        </div>
    )
}
