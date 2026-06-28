import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { Button, Icon, Modal } from '../primitives'

export const APP_WARNING_ACCEPTANCE_KEY = 'magic_worlds:app-warning-accepted:v1'
const APP_WARNING_ACCEPTANCE_VALUE = 'accepted'

// Hashes the modal links to. When a new tab is opened on one of these public
// legal pages, the (shared-localStorage) first-run modal must not block it.
const LEGAL_HASH_PREFIXES = ['#/disclaimer', '#/privacy']

function hasAcceptedAppWarning() {
    try {
        return localStorage.getItem(APP_WARNING_ACCEPTANCE_KEY) === APP_WARNING_ACCEPTANCE_VALUE
    } catch {
        return false
    }
}

function isViewingLegalPage() {
    try {
        return LEGAL_HASH_PREFIXES.some((hash) => window.location.hash.startsWith(hash))
    } catch {
        return false
    }
}

export function AppWarningModal() {
    const { t } = useTranslation()
    const [isOpen, setIsOpen] = useState(() => !hasAcceptedAppWarning() && !isViewingLegalPage())
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
                    variant="primary"
                    onClick={acceptWarning}
                    iconLeft={<CheckCircle2 size={16} strokeWidth={1.75} />}
                    className="w-full sm:w-auto"
                >
                    {t('warning.accept')}
                </Button>
            }
        >
            <div className="flex flex-col gap-4 text-body leading-relaxed text-parchment-200">
                <p>{t('warning.body')}</p>

                <ul className="list-disc space-y-2 pl-5">
                    <li>{t('warning.ageRequirement')}</li>
                    <li>{t('warning.contentSaved')}</li>
                    <li>{t('warning.localOnly')}</li>
                    <li>{t('warning.authRequired')}</li>
                    <li>{t('warning.wipe')}</li>
                    <li>{t('warning.nsfw')}</li>
                    <li>{t('warning.aiContent')}</li>
                    <li>{t('warning.noPersonalData')}</li>
                    <li>{t('warning.credits')}</li>
                    {voiceModeEnabled && (
                        <li>{t('warning.voice')}</li>
                    )}
                </ul>

                <p className="text-sm text-parchment-300">
                    {t('warning.legalPrompt')}{' '}
                    <a
                        href="#/disclaimer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm font-semibold text-ember-400 underline-offset-2 transition-colors hover:text-ember-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                    >
                        {t('legal.links.disclaimer')}
                    </a>
                    {' · '}
                    <a
                        href="#/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-sm font-semibold text-ember-400 underline-offset-2 transition-colors hover:text-ember-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                    >
                        {t('legal.links.privacy')}
                    </a>
                </p>
            </div>
        </Modal>
    )
}
