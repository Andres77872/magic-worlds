import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Callout } from '@/ui/primitives'
import { inspectOfflineApp, prepareOfflineApp, type OfflineAppState } from '@/app/offline/offlineApp'

export function NovelOfflineAppCopy() {
    const [state, setState] = useState<OfflineAppState | null>(null), [busy, setBusy] = useState(false)
    const alive = useRef(true)
    const inFlight = useRef(false)
    useEffect(() => {
        alive.current = true
        void inspectOfflineApp().then((value) => { if (alive.current) setState(value) })
        return () => { alive.current = false }
    }, [])
    const prepare = async () => {
        if (inFlight.current) return
        inFlight.current = true
        setBusy(true)
        const result = await prepareOfflineApp()
        inFlight.current = false
        if (alive.current) { setState(result); setBusy(false) }
    }
    return <NovelOfflineAppCopyView state={state} busy={busy} onPrepare={() => void prepare()} />
}
export function NovelOfflineAppCopyView({ state, busy = false, onPrepare }: { state: OfflineAppState | null; busy?: boolean; onPrepare: () => void }) {
    const { t } = useTranslation(), text = (key: string) => t('novelEditor.offlineApp.' + key)
    const message = state?.state === 'unsupported' ? 'unsupported_' + state.reason : state?.state === 'failed' ? 'failed_' + state.reason : state?.state
    return <section className="space-y-3 rounded-lg border border-line p-4">
        <h3 className="font-display text-h3">{text('title')}</h3>
        <p className="text-body text-parchment-200">{text('help')}</p>
        {message && <Callout role="status" tone={state?.state === 'failed' || state?.state === 'foreign' ? 'warning' : state?.state === 'ready' ? 'success' : undefined}>{text(message)}</Callout>}
        <Button variant="secondary" size="sm" disabled={state?.state === 'unsupported' || state?.state === 'foreign'} aria-disabled={busy || undefined} aria-busy={busy} onClick={() => { if (!busy) onPrepare() }}>{text(busy ? 'preparing' : state?.state === 'ready' || state?.state === 'waiting' ? 'check' : 'prepare')}</Button>
    </section>
}
