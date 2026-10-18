import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { isOperationFeatureEnabled, isLlmFeatureEnabled } from '@/shared/featureFlags'
import { useTranslation } from 'react-i18next'
import { Activity } from 'lucide-react'
import type { LlmCapacityUsage } from '@/shared/types/llmProfile.types'
import { Badge, Card, SectionHeader } from '@/ui/primitives'

const PAYERS = ['platform', 'user_byok', 'unattributed'] as const

export function LlmCapacityUsageView({ usage, loading = false, error = '' }: {
    usage: LlmCapacityUsage | null
    loading?: boolean
    error?: string
}) {
    useFeatureFlags()
    const { t, i18n } = useTranslation()
    const format = new Intl.NumberFormat(i18n.resolvedLanguage)
    return <Card className="flex flex-col gap-3 p-4">
        <SectionHeader icon={Activity} title={t('llmProfiles.usage.title')}
            right={usage && <Badge tone="neutral">{usage.month_start} – {usage.usage_day} UTC</Badge>} />
        <p className="font-ui text-label text-parchment-300">{t('llmProfiles.usage.description')}</p>
        {loading ? <p role="status">{t('llmProfiles.loading')}</p>
            : error ? <p role="alert" className="text-label text-blood-300">{error}</p>
                : usage && <div className="relative overflow-x-auto">
                    <table className="w-full border-collapse font-ui text-label">
                        <caption className="sr-only">{t('llmProfiles.usage.periods')}</caption>
                        <thead><tr>
                            <th scope="col" className="border-b border-line-faint py-2 text-left">{t('llmProfiles.usage.feature')}</th>
                            {PAYERS.map(payer => <th key={payer} scope="col" className="border-b border-line-faint px-3 py-2 text-right">
                                {t(`llmProfiles.usage.columns.${payer}`)}
                            </th>)}
                        </tr></thead>
                        <tbody>{usage.operations.filter(row => isOperationFeatureEnabled(row.operation) && row.features.some(isLlmFeatureEnabled)).map(row => <tr key={row.operation}>
                            <th scope="row" className="border-b border-line-faint py-3 text-left font-normal">
                                <span className="block text-parchment-100">{row.features.filter(isLlmFeatureEnabled).map(feature => t(`llmProfiles.features.${feature}`)).join(' · ')}</span>
                                <span className="text-caption text-parchment-400">
                                    {t(row.app_credit_billed ? 'llmProfiles.usage.creditBilled' : 'llmProfiles.usage.noExtraCredits')}
                                </span>
                            </th>
                            {PAYERS.map(payer => <td key={payer} className="border-b border-line-faint px-3 py-3 text-right tabular-nums text-parchment-200">
                                {format.format(row.today[payer])} / {format.format(row.month[payer])}
                            </td>)}
                        </tr>)}</tbody>
                    </table>
                </div>}
    </Card>
}
