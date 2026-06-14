import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, Crown, RefreshCw } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { Button, Icon, IconTile, PageHeader, Toast } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { useVoiceStudio } from '../hooks/useVoiceStudio'
import { MiniMaxReferenceDrawer } from './MiniMaxReferenceDrawer'
import { SynthLabPanel } from './SynthLabPanel'
import { VoiceCreatePanel } from './VoiceCreatePanel'
import { VoiceLibraryPanel } from './VoiceLibraryPanel'

export function AdminVoicesPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const studio = useVoiceStudio(Boolean(isRoot))
    const [referenceOpen, setReferenceOpen] = useState(false)

    if (!isAuthenticated) {
        return (
            <RootAccessState
                message={t('admin.voices.access.title')}
                secondaryText={t('admin.voices.access.loginRequired')}
                action={{ label: t('admin.common.logIn'), onClick: openLoginModal }}
            />
        )
    }

    if (!isRoot) {
        return (
            <RootAccessState
                message={t('admin.voices.access.title')}
                secondaryText={t('admin.voices.access.rootOnly')}
            />
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('admin.common.rootConsole')}
                eyebrowTone="arcane"
                icon={<IconTile icon={Crown} tone="arcane" />}
                title={t('admin.voices.page.title')}
                subtitle={t('admin.voices.page.subtitle')}
                size="lg"
                actions={
                    <div className="flex gap-2">
                        <Button
                            kind="secondary"
                            size="sm"
                            iconLeft={<Icon icon={BookOpenText} size={15} />}
                            onClick={() => setReferenceOpen(true)}
                        >
                            {t('admin.voices.page.reference')}
                        </Button>
                        <Button
                            kind="secondary"
                            size="sm"
                            iconLeft={<Icon icon={RefreshCw} size={15} className={studio.loadingVoices ? 'animate-spin' : undefined} />}
                            onClick={() => void studio.refreshVoices()}
                            disabled={studio.loadingVoices}
                        >
                            {t('admin.common.refresh')}
                        </Button>
                    </div>
                }
                divider
            />

            {studio.error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{studio.error}</span>
                    <Button kind="secondary" size="sm" onClick={() => studio.setError(null)}>
                        {t('admin.common.dismiss')}
                    </Button>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-6 self-start">
                    <VoiceCreatePanel
                        onCreated={() => void studio.refreshVoices()}
                        notify={studio.setToast}
                        setError={studio.setError}
                        onSendToLab={studio.sendToLab}
                    />
                    <SynthLabPanel
                        voiceId={studio.labVoiceId}
                        onVoiceIdChange={studio.setLabVoiceId}
                        notify={studio.setToast}
                        setError={studio.setError}
                    />
                </div>

                <VoiceLibraryPanel
                    groups={studio.groups}
                    voiceType={studio.voiceType}
                    setVoiceType={studio.setVoiceType}
                    loadingVoices={studio.loadingVoices}
                    deletingVoiceId={studio.deletingVoiceId}
                    onTest={(voice) => studio.sendToLab(voice.voice_id)}
                    onDelete={studio.setPendingDelete}
                />
            </div>

            <ConfirmDialog
                visible={studio.pendingDelete !== null}
                title={t('admin.voices.deleteDialog.title')}
                message={studio.pendingDelete ? t('admin.voices.deleteDialog.message', { voiceId: studio.pendingDelete.voice_id }) : ''}
                confirmLabel={t('admin.common.delete')}
                variant="danger"
                onConfirm={() => void studio.confirmDelete()}
                onCancel={() => studio.setPendingDelete(null)}
            />

            <MiniMaxReferenceDrawer open={referenceOpen} onClose={() => setReferenceOpen(false)} />

            {studio.toast && (
                <Toast
                    open
                    tone={studio.toast.tone}
                    title={studio.toast.title}
                    message={studio.toast.message}
                    onClose={() => studio.setToast(null)}
                    autoCloseMs={3500}
                />
            )}
        </div>
    )
}

function RootAccessState({
    message,
    secondaryText,
    action,
}: {
    message: string
    secondaryText: string
    action?: { label: string; onClick: () => void }
}) {
    return (
        <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
            <EmptyState icon={<Icon icon={Crown} size={44} />} message={message} secondaryText={secondaryText} button={action} />
        </div>
    )
}
