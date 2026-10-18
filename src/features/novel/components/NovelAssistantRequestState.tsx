import { useTranslation } from 'react-i18next'
import { Button, Callout } from '@/ui/primitives'
import type { NovelAssistantDraft, NovelAssistantPendingTurn } from '../persistence/assistantDraftJournal'

interface Props {
    pending: NovelAssistantPendingTurn | null
    /** The reply is streaming into this tab right now, so its result is not uncertain yet. */
    live?: boolean
    outcome?: NovelAssistantDraft['outcome']
    busy: boolean
    stopping: boolean
    canResume: boolean
    canStop: boolean
    onCheck: () => void
    onStop: () => void
    onResume: () => void
}

/** A stopped request keeps its exact identity until its outcome and usage are known. */
export function NovelAssistantRequestState({ pending, outcome, live = false, busy, stopping, canResume, canStop, onCheck, onStop, onResume }: Props) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.assistant.' + key)
    if (!pending && !outcome) return null
    const terminal = pending?.terminal ?? outcome?.result
    const control = terminal && 'control' in terminal ? terminal.control : undefined
    const requested = Boolean(pending?.stopRequested)
    const controlled = requested || Boolean(control)
    // While the reply streams in, only Stop applies; checking or resuming is for a request this tab lost track of.
    const receiving = live && Boolean(pending) && !controlled && !terminal
    const phase = stopping ? 'stopping' : receiving ? 'receiving' : terminal?.status === 'completed' ? 'finishedBeforeStop'
        : requested && !control?.executor_stopped ? 'stopUnconfirmed'
            : terminal?.status === 'cancelled' ? 'stopped' : terminal?.status === 'failed' ? 'requestFailed' : 'pending'
    const accounting = control?.settlement === 'not_used' ? 'usageNotUsed'
        : control?.settlement === 'used' ? control.usage_complete ? 'usageConfirmed' : 'usageTotalsPending'
            : control ? 'usagePending' : null
    return <Callout tone={pending && !receiving ? 'warning' : 'info'} role="status">
        <p>{text(phase)}</p>
        {accounting && <p className="mt-2 text-caption">{text(accounting)}</p>}
        {pending && <div className="mt-3 flex flex-wrap gap-2">
            {controlled ? <Button variant="secondary" disabled={control?.executor_stopped ? busy : !canStop}
                onClick={control?.executor_stopped ? onCheck : onStop}>{text(control?.executor_stopped ? 'checkUsage' : 'retryStop')}</Button>
                : receiving ? <Button variant="secondary" disabled={!canStop} onClick={onStop}>{text('stopRequest')}</Button> : <>
                <Button variant="secondary" disabled={busy} onClick={onCheck}>{text('checkResult')}</Button>
                {canResume && <Button variant="secondary" disabled={busy} onClick={onResume}>{text('retryOriginal')}</Button>}
                <Button variant="secondary" disabled={!canStop} onClick={onStop}>{text('stopRequest')}</Button>
            </>}
        </div>}
        {pending && !controlled && !receiving && <p className="mt-2 text-caption">{text('retryHelp')}</p>}
    </Callout>
}
