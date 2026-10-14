/**
 * Provider delete with double confirmation (D19, AC-R2). The first call
 * returns the confirm token; the second, with the token, deletes the provider
 * voice. The catalog row is kept.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogVoice } from '@/shared'
import { Button, Callout, Icon, Modal } from '@/ui/primitives'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'

interface ProviderDeleteDialogProps {
    voice: AdminCatalogVoice
    onCancel: () => void
    onDeleted: (voice: AdminCatalogVoice) => void
}

export function ProviderDeleteDialog({ voice, onCancel, onDeleted }: ProviderDeleteDialogProps) {
    const { t } = useTranslation()
    const { reportError } = useVoiceConsole()
    const [token, setToken] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const step = async () => {
        setProcessing(true)
        setError(null)
        try {
            const response = await apiService.deleteAdminCatalogVoice(voice.voice_key, token ?? undefined)
            if (response.status === 'confirmation_required') setToken(response.confirm_token)
            else onDeleted(response.voice)
        } catch (caught) {
            setError(reportError(caught))
        } finally {
            setProcessing(false)
        }
    }

    return (
        <Modal
            open
            onClose={() => {
                if (!processing) onCancel()
            }}
            title={t('admin.voices.catalog.delete.title', { name: voice.display_name })}
            icon={<Icon icon={AlertTriangle} size={18} className="text-blood-300" />}
            size="md"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={processing}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button variant="danger" onClick={() => void step()} disabled={processing}>
                        {processing
                            ? t('admin.voices.common.saving')
                            : token
                              ? t('admin.voices.catalog.delete.confirm')
                              : t('admin.voices.catalog.delete.continue')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="font-ui text-sm leading-relaxed text-parchment-200">
                    {token ? t('admin.voices.catalog.delete.step2') : t('admin.voices.catalog.delete.step1')}
                </p>
                {error && (
                    <Callout tone="danger" role="alert">
                        {error}
                    </Callout>
                )}
            </div>
        </Modal>
    )
}
