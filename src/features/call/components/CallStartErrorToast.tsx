import { useTranslation } from 'react-i18next'
import { Toast } from '@/ui/primitives'

/** The reason a call did not start (useStartCall `error`); stays until dismissed. */
export function CallStartErrorToast({ error, onClose }: { error: string | null; onClose: () => void }) {
    const { t } = useTranslation()
    return <Toast open={error !== null} tone="error" title={t('call.start.errorTitle')} message={error ?? undefined} onClose={onClose} />
}
