import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { Button, Icon, Modal } from '../primitives'

export const APP_WARNING_ACCEPTANCE_KEY = 'magic_worlds:app-warning-accepted:v1'
const APP_WARNING_ACCEPTANCE_VALUE = 'accepted'

function hasAcceptedAppWarning() {
    try {
        return localStorage.getItem(APP_WARNING_ACCEPTANCE_KEY) === APP_WARNING_ACCEPTANCE_VALUE
    } catch {
        return false
    }
}

export function AppWarningModal() {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(() => !hasAcceptedAppWarning())
    const voiceModeEnabled = isFrontendVoiceModeEnabled()

    const acceptWarning = () => {
        try {
            localStorage.setItem(APP_WARNING_ACCEPTANCE_KEY, APP_WARNING_ACCEPTANCE_VALUE)
        } catch (error) {
            console.warn('[AppWarningModal] Could not save app warning acceptance:', error)
        }
        setIsOpen(false)
    }

    return (
        <Modal
            open={isOpen}
            onClose={() => {}}
            title={t('warning.title')}
            icon={<Icon icon={AlertTriangle} size={22} className="text-amber-500" />}
            showClose={false}
            size="lg"
            footer={
                <Button
                    kind="primary"
                    onClick={acceptWarning}
                    iconLeft={<CheckCircle2 size={16} strokeWidth={1.75} />}
                >
                    {t('warning.accept')}
                </Button>
            }
        >
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-parchment-200">
                <p>{t('warning.body')}</p>

                <ul className="list-disc space-y-2 pl-5">
                    <li>{t('warning.contentSaved')}</li>
                    <li>{t('warning.localOnly')}</li>
                    <li>{t('warning.authRequired')}</li>
                    <li>{t('warning.wipe')}</li>
                    <li>{t('warning.nsfw')}</li>
                    <li>{t('warning.credits')}</li>
                    {voiceModeEnabled && (
                        <li>{t('warning.voice')}</li>
                    )}
                </ul>
            </div>
        </Modal>
    )
}
