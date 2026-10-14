/**
 * The voice safety pause notice (R2-BE-01 FE): a modal around
 * {@link CrisisResourcesPanel}, opened when the chat socket reports a pause
 * (`voice_safety_notice`). Closing it keeps the pause; text chat keeps working.
 */
import { useTranslation } from 'react-i18next'
import { PauseCircle } from 'lucide-react'
import { Icon, Modal } from '@/ui/primitives'
import { CrisisResourcesPanel } from './CrisisResourcesPanel'

export interface SafetyPauseNoticeProps {
    open: boolean
    retryAfterSeconds: number | null
    onClose: () => void
}

export function SafetyPauseNotice({ open, retryAfterSeconds, onClose }: SafetyPauseNoticeProps) {
    const { t } = useTranslation()
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={t('voiceSafety.title')}
            icon={<Icon icon={PauseCircle} size={20} className="text-ember-400" />}
            closeLabel={t('voiceSafety.close')}
            size="sm"
        >
            <CrisisResourcesPanel retryAfterSeconds={retryAfterSeconds} />
        </Modal>
    )
}
