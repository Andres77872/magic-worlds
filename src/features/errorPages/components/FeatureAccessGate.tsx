import { useTranslation } from 'react-i18next'
import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
import { Button, Callout } from '@/ui/primitives'

export function FeatureAccessGate() {
    const { t } = useTranslation()
    const { phase } = useFeatureFlags()
    const waiting = phase === 'idle' || phase === 'loading'
    const reload = phase === 'reload-required'
    const message = waiting ? 'loading' : reload ? 'reload' : phase === 'unavailable' ? 'unavailable' : 'denied'
    return <div className="p-6" aria-busy={waiting}>
        <Callout role="status" tone={phase === 'unavailable' ? 'warning' : 'info'}
            action={waiting ? undefined : <Button size="sm" variant="secondary" onClick={() => {
                if (reload) window.location.reload()
                else window.dispatchEvent(new Event('feature-flags:invalidate'))
            }}>{t(reload ? 'featureFlags.reloadAction' : 'featureFlags.retry')}</Button>}>
            {t(`featureFlags.${message}`)}
        </Callout>
    </div>
}

