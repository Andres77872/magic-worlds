/**
 * HistoricalVersionBanner — shown atop the editor when viewing a read-only past version
 * (URL `?version=<n>`). The displayed body is a historical snapshot and is NOT editable until
 * the user restores it into the draft; "Restore this version to edit" stages it for editing.
 */

import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'

export interface HistoricalVersionBannerProps {
    versionNumber: number
    onRestore: () => void
    busy?: boolean
}

export function HistoricalVersionBanner({ versionNumber, onRestore, busy = false }: HistoricalVersionBannerProps) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-arcane-500/55 bg-arcane-500/10 px-3.5 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
                <Icon icon={History} size={18} className="mt-0.5 shrink-0 text-arcane-300" />
                <div className="min-w-0">
                    <p className="font-ui text-sm font-semibold text-parchment-100">
                        {t('cardVersions.historical.banner', { number: versionNumber })}
                    </p>
                    <p className="font-narrative text-xs text-parchment-400">{t('cardVersions.historical.bannerHint')}</p>
                </div>
            </div>
            <Button variant="arcane" size="sm" onClick={onRestore} disabled={busy}>
                {t('cardVersions.historical.restoreToEdit')}
            </Button>
        </div>
    )
}
