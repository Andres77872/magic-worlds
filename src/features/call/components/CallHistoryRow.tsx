/**
 * CallHistoryRow — one past call in the call-history list (a distinct voice session).
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, ScrollText } from 'lucide-react'
import type { CallSummary, Character } from '@/shared'
import { Avatar, Button, Icon } from '@/ui/primitives'
import { callDisplay, callMetaLine, formatCallTime } from '../callTransforms'

interface CallHistoryRowProps {
    call: CallSummary
    characters: Character[]
    onView: () => void
    onCallAgain?: () => void
}

export function CallHistoryRow({ call, characters, onView, onCallAgain }: CallHistoryRowProps) {
    const { t } = useTranslation()
    const display = useMemo(() => callDisplay(call, characters, t), [call, characters, t])
    const meta = callMetaLine(call, t)
    const when = formatCallTime(call)

    return (
        <div
            className="flex items-center gap-3 rounded-xl border border-parchment-50/10 bg-ink-800/60 px-3 py-2.5 transition-colors hover:border-parchment-50/20"
            data-testid="call-history-row"
        >
            <Avatar name={display.name} src={display.imageUrl ?? null} size={44} />
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-parchment-100">{display.name}</p>
                <p className="truncate text-caption text-parchment-400">{[when, meta].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {onCallAgain && (
                    <Button variant="ghost" size="sm" iconLeft={<Icon icon={Phone} size={15} />} onClick={onCallAgain}>
                        {t('call.history.callAgain')}
                    </Button>
                )}
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={ScrollText} size={15} />} onClick={onView}>
                    {t('call.history.transcript')}
                </Button>
            </div>
        </div>
    )
}
