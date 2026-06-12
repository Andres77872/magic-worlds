import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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
    const [isOpen, setIsOpen] = useState(() => !hasAcceptedAppWarning())

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
            title="Before you continue"
            icon={<Icon icon={AlertTriangle} size={22} className="text-amber-500" />}
            showClose={false}
            size="lg"
            footer={
                <Button
                    kind="primary"
                    onClick={acceptWarning}
                    iconLeft={<CheckCircle2 size={16} strokeWidth={1.75} />}
                >
                    I understand and accept
                </Button>
            }
        >
            <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-parchment-200">
                <p>
                    Magic Worlds is free during this preview, but it is still under active development.
                    Please review these limits before using the app.
                </p>

                <ul className="list-disc space-y-2 pl-5">
                    <li>Your content is saved on the backend so the app can work.</li>
                    <li>Local-only storage and zero-retention mode are not supported right now.</li>
                    <li>Login or registration is required, registration is open, and no email is required.</li>
                    <li>Backend content and database records may be wiped without notice during development.</li>
                    <li>NSFW content is not currently allowed.</li>
                    <li>Credits are only informational reference values for now.</li>
                </ul>
            </div>
        </Modal>
    )
}
