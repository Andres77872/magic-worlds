import { useTranslation } from 'react-i18next'
import { KeyRound, Mail, RefreshCw, Ticket } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { Button, Card, Icon, IconTile, PageHeader, SectionHeader, Toast } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { useCreditCodesStudio } from '../hooks/useCreditCodesStudio'
import { CreateCreditTokenForm } from './CreateCreditTokenForm'
import { CreditTokensList } from './CreditTokensList'
import { InviteUsersForm } from './InviteUsersForm'
import { CreditInvitesList } from './CreditInvitesList'

export function AdminCreditCodesPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const studio = useCreditCodesStudio(Boolean(isRoot))

    if (!isAuthenticated) {
        return (
            <RootAccessState
                message={t('admin.creditCodes.access.title')}
                secondaryText={t('admin.creditCodes.access.loginRequired')}
                action={{ label: t('admin.common.logIn'), onClick: openLoginModal }}
            />
        )
    }

    if (!isRoot) {
        return (
            <RootAccessState
                message={t('admin.creditCodes.access.title')}
                secondaryText={t('admin.creditCodes.access.rootOnly')}
            />
        )
    }

    const refreshing = studio.loadingTokens || studio.loadingInvites
    const refreshAll = () => {
        void studio.refreshTokens()
        void studio.refreshInvites()
    }

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('admin.common.rootConsole')}
                eyebrowTone="arcane"
                icon={<IconTile icon={Ticket} tone="arcane" />}
                title={t('admin.creditCodes.page.title')}
                subtitle={t('admin.creditCodes.page.subtitle')}
                size="lg"
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={15} className={refreshing ? 'animate-spin' : undefined} />}
                        onClick={refreshAll}
                        disabled={refreshing}
                    >
                        {t('admin.common.refresh')}
                    </Button>
                }
                divider
            />

            {studio.error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{studio.error}</span>
                    <Button variant="secondary" size="sm" onClick={() => studio.setError(null)}>
                        {t('admin.common.dismiss')}
                    </Button>
                </div>
            )}

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <SectionHeader icon={KeyRound} title={t('admin.creditCodes.tokens.title')} tone="ember" />
                    <p className="font-ui text-[13px] leading-relaxed text-parchment-300">
                        {t('admin.creditCodes.tokens.description')}
                    </p>
                    <CreateCreditTokenForm
                        onCreated={studio.addToken}
                        notify={studio.setToast}
                        setError={studio.setError}
                    />
                    <div className="border-t border-parchment-50/[.08] pt-5">
                        <CreditTokensList
                            tokens={studio.tokens}
                            loading={studio.loadingTokens}
                            disablingId={studio.disablingId}
                            onDisable={(token) =>
                                studio.setPendingDisable({
                                    kind: 'token',
                                    id: token.token_id,
                                    label: token.label || t('admin.creditCodes.tokens.untitled'),
                                })
                            }
                        />
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <SectionHeader icon={Mail} title={t('admin.creditCodes.invites.title')} tone="ember" />
                    <p className="font-ui text-[13px] leading-relaxed text-parchment-300">
                        {t('admin.creditCodes.invites.description')}
                    </p>
                    <InviteUsersForm
                        onCreated={studio.addInvites}
                        notify={studio.setToast}
                        setError={studio.setError}
                    />
                    <div className="border-t border-parchment-50/[.08] pt-5">
                        <CreditInvitesList
                            invites={studio.invites}
                            loading={studio.loadingInvites}
                            disablingId={studio.disablingId}
                            onDisable={(invite) =>
                                studio.setPendingDisable({ kind: 'invite', id: invite.invite_id, label: invite.email })
                            }
                        />
                    </div>
                </div>
            </Card>

            <ConfirmDialog
                visible={studio.pendingDisable !== null}
                title={t('admin.creditCodes.disableDialog.title')}
                message={
                    studio.pendingDisable
                        ? t('admin.creditCodes.disableDialog.message', { label: studio.pendingDisable.label })
                        : ''
                }
                confirmLabel={t('admin.creditCodes.disable')}
                variant="danger"
                onConfirm={() => void studio.confirmDisable()}
                onCancel={() => studio.setPendingDisable(null)}
            />

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
            <EmptyState icon={<Icon icon={Ticket} size={44} />} message={message} secondaryText={secondaryText} button={action} />
        </div>
    )
}
