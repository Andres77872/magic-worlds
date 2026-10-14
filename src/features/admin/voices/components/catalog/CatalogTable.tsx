import { useTranslation } from 'react-i18next'
import type { AdminCatalogVoice } from '@/shared'
import { Badge, Button } from '@/ui/primitives'
import { ACCEPTANCE_MODELS } from '../../constants'
import { formatDate, formatNumber } from '../../format'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface CatalogTableProps {
    voices: readonly AdminCatalogVoice[]
    onManage: (voiceKey: string) => void
}

const STATUS_TONE: Record<AdminCatalogVoice['status'], 'live' | 'neutral' | 'warning' | 'danger'> = {
    draft: 'neutral',
    active: 'live',
    hidden: 'neutral',
    deprecating: 'warning',
    removed: 'danger',
    blocked: 'danger',
    failed: 'danger',
}

const cell = 'border-b border-line-faint py-2.5 pr-3 align-top'

/** The catalog list (05 §8.3): every column is text; badges never carry meaning by colour alone. */
export function CatalogTable({ voices, onManage }: CatalogTableProps) {
    const { t } = useTranslation()
    const { locale, languageName } = useVoiceConsole()

    const languageLines = (voice: AdminCatalogVoice) => {
        const languages = [...new Set([...voice.languages.map((entry) => entry.language), ...voice.acceptance.map((row) => row.language)])].sort()
        return languages.map((language) => {
            const accepted = ACCEPTANCE_MODELS.filter((modelId) =>
                voice.acceptance.some((row) => row.model_id === modelId && row.language === language && row.verdict === 'pass'),
            )
            return accepted.length > 0
                ? t('admin.voices.catalog.acceptedModels', {
                      language: languageName(language),
                      models: accepted.map((modelId) => t(`admin.voices.models.short.${modelId}`)).join(', '),
                  })
                : t('admin.voices.catalog.notAccepted', { language: languageName(language) })
        })
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse font-ui text-sm">
                <caption className="sr-only">{t('admin.voices.catalog.columns.caption')}</caption>
                <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                        {(['voice', 'source', 'status', 'languages', 'callEligible', 'references', 'disableAt', 'suspectSince', 'actions'] as const).map((column) => (
                            <th key={column} scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">
                                {t(`admin.voices.catalog.columns.${column}`)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {voices.map((voice) => (
                        <tr key={voice.voice_key}>
                            <th scope="row" className={`${cell} text-left font-normal`}>
                                <span className="block font-semibold text-parchment-50">{voice.display_name}</span>
                                {voice.provider_name !== voice.display_name && (
                                    <span className="block text-caption text-fg-muted">{t('admin.voices.catalog.providerName', { name: voice.provider_name })}</span>
                                )}
                            </th>
                            <td className={`${cell} text-parchment-200`}>{t(`admin.voices.sourceKind.${voice.source_kind}`)}</td>
                            <td className={cell}>
                                <span className="flex flex-wrap gap-1">
                                    <Badge tone={STATUS_TONE[voice.status]}>{t(`admin.voices.status.${voice.status}`)}</Badge>
                                    <Badge tone={voice.visibility === 'admin' ? 'neutral' : 'ember'}>{t(`admin.voices.visibility.${voice.visibility}`)}</Badge>
                                </span>
                            </td>
                            <td className={`${cell} text-parchment-200`}>
                                <ul className="flex flex-col gap-0.5">
                                    {languageLines(voice).map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            </td>
                            <td className={`${cell} text-parchment-200`}>{voice.call_eligible ? t('admin.voices.common.yes') : t('admin.voices.common.no')}</td>
                            <td className={`${cell} tabular-nums text-parchment-200`}>{formatNumber(voice.reference_count, locale)}</td>
                            <td className={`${cell} text-parchment-300`}>{voice.disable_at ? formatDate(voice.disable_at, locale) : '—'}</td>
                            <td className={`${cell} ${voice.suspect_since ? 'text-amber-500' : 'text-parchment-300'}`}>
                                {voice.suspect_since ? formatDate(voice.suspect_since, locale) : '—'}
                            </td>
                            <td className={cell}>
                                <Button variant="secondary" size="xs" onClick={() => onManage(voice.voice_key)} aria-label={t('admin.voices.catalog.manage', { name: voice.display_name })}>
                                    {t('admin.voices.catalog.manageShort')}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
