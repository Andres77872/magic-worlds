/**
 * Asks for the user's own provider key before a personal (BYOK) image profile
 * runs. The input is uncontrolled so the key never sits in React state; it is
 * handed to `onSubmit` once and the field is cleared.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import type { ImageProvider } from '@/shared/types/imageProfile.types'
import { Button, Field, Icon, Input, Modal } from '@/ui/primitives'

interface ImageKeyDialogProps {
    provider: ImageProvider | null
    /** Throws IMAGE_CREDENTIAL_HTTPS_REQUIRED, IMAGE_SESSION_UNAVAILABLE or IMAGE_CREDENTIAL_INVALID. */
    onSubmit: (key: string) => void
    onCancel: () => void
}

export function ImageKeyDialog({ provider, onSubmit, onCancel }: ImageKeyDialogProps) {
    const { t } = useTranslation()
    const input = useRef<HTMLInputElement>(null)
    const [error, setError] = useState<string | null>(null)
    const providerName = provider ? t(`imageProfiles.providers.${provider}`) : ''

    const close = () => { setError(null); onCancel() }
    const confirm = () => {
        if (!input.current) return
        try {
            onSubmit(input.current.value)
            input.current.value = ''
            setError(null)
        } catch (failure) {
            const code = failure instanceof Error ? failure.message : ''
            setError(t(code === 'IMAGE_CREDENTIAL_HTTPS_REQUIRED' ? 'imageProfiles.key.httpsRequired' : 'imageProfiles.key.invalid'))
        }
    }

    return <Modal open={provider !== null} onClose={close} size="sm" icon={<Icon icon={KeyRound} size={18} />}
        title={t('imageProfiles.key.title', { provider: providerName })}
        footer={<><Button variant="ghost" onClick={close}>{t('imageProfiles.cancel')}</Button>
            <Button onClick={confirm}>{t('imageProfiles.key.use')}</Button></>}>
        <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); confirm() }}>
            <p className="text-body text-parchment-200">{t('imageProfiles.key.explanation')}</p>
            <p className="text-label text-parchment-300">{t('imageProfiles.key.billing')}</p>
            <Field label={t('imageProfiles.key.label')} error={error ?? undefined}>
                <Input ref={input} type="password" autoComplete="off" maxLength={4096} data-private="true" />
            </Field>
        </form>
    </Modal>
}
