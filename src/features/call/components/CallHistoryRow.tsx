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
            className="flex flex-wrap items-center gap-3 border-b border-line-faint py-4 last:border-b-0"
            data-testid="call-history-row"
        >
            <Avatar name={display.name} src={display.imageUrl ?? null} size={44} />
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-parchment-100">{display.name}</p>
                <p className="truncate text-caption text-parchment-400">{[when, meta].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
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
