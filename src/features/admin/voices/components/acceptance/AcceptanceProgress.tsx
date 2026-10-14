import { useTranslation } from 'react-i18next'
import { CURATED_LANGUAGES, PUBLISH_TARGET_PER_LANGUAGE, PUBLISH_TARGET_TOTAL } from '../../constants'
import type { PublishProgress } from '../../consoleRules'
import { UsageMeter } from '../shell/UsageMeter'

interface AcceptanceProgressProps {
    progress: PublishProgress
    languageName: (code: string) => string
}

/** Progress towards the R0 exit target (D09): ≥ 40 published, ≥ 16 per curated language. */
export function AcceptanceProgress({ progress, languageName }: AcceptanceProgressProps) {
    const { t } = useTranslation()
    return (
        <section aria-labelledby="acceptance-progress-heading" className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
            <h3 id="acceptance-progress-heading" className="font-display text-base font-semibold text-fg">
                {t('admin.voices.acceptance.progress.title')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
                <UsageMeter
                    label={t('admin.voices.acceptance.progress.total', { count: progress.total, target: PUBLISH_TARGET_TOTAL })}
                    valueText={`${progress.total} / ${PUBLISH_TARGET_TOTAL}`}
                    value={progress.total}
                    max={PUBLISH_TARGET_TOTAL}
                />
                {CURATED_LANGUAGES.map((language) => {
                    const count = progress.byLanguage[language] ?? 0
                    return (
                        <UsageMeter
                            key={language}
                            label={t('admin.voices.acceptance.progress.language', {
                                language: languageName(language),
                                count,
                                target: PUBLISH_TARGET_PER_LANGUAGE,
                            })}
                            valueText={`${count} / ${PUBLISH_TARGET_PER_LANGUAGE}`}
                            value={count}
                            max={PUBLISH_TARGET_PER_LANGUAGE}
                        />
                    )
                })}
            </div>
            <p className="font-ui text-caption text-fg-muted">{t('admin.voices.acceptance.progress.note')}</p>
        </section>
    )
}
