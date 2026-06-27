import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Mail, RefreshCw, Ticket } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import type { CreditGrantKind } from '@/shared'
import { Button, Card, Icon, IconTile, PageHeader, SectionHeader, Toast } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { useCreditCodesStudio } from '../hooks/useCreditCodesStudio'
import { CreateCreditCodeGrantForm } from './CreateCreditCodeGrantForm'
import { CreateEmailCreditGrantsForm } from './CreateEmailCreditGrantsForm'
import { CreditCodeGrantsList } from './CreditCodeGrantsList'
import { CreditGrantSummaryTiles } from './CreditGrantSummaryTiles'
import { CreditTokensToolbar } from './CreditTokensToolbar'
import { EditCreditGrantDialog, type EditableGrant } from './EditCreditGrantDialog'
import { EmailCreditGrantsList } from './EmailCreditGrantsList'
import { QuotaResetPanel } from './QuotaResetPanel'

interface EditingTarget {
    kind: CreditGrantKind
    grant: EditableGrant
}

export function AdminCreditCodesPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const studio = useCreditCodesStudio(Boolean(isRoot))
    const [createOpen, setCreateOpen] = useState(false)
    const [editing, setEditing] = useState<EditingTarget | null>(null)

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
        return <RootAccessState message={t('admin.creditCodes.access.title')} secondaryText={t('admin.creditCodes.access.rootOnly')} />
    }

    const { activeType } = studio
    const counts = studio.summary ? (activeType === 'code' ? studio.summary.codes : studio.summary.emails) : undefined

    const handleSaveEdit = async (patch: Parameters<typeof studio.editGrant>[2]) => {
        if (!editing) return
        const id = editing.kind === 'code' ? (editing.grant as { code_id: number }).code_id : (editing.grant as { grant_id: number }).grant_id
        const ok = await studio.editGrant(editing.kind, id, patch)
        if (ok) setEditing(null)
    }

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-5 py-8 sm:px-8 sm:py-10">
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
                        iconLeft={<Icon icon={RefreshCw} size={15} className={studio.loading ? 'animate-spin' : undefined} />}
                        onClick={() => void studio.reload()}
                        disabled={studio.loading}
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

            <QuotaResetPanel
                resetting={studio.resettingQuotas}
                lastReset={studio.lastQuotaReset}
                onReset={studio.resetMembershipQuotas}
            />

            <CreditGrantSummaryTiles counts={counts} activeStatus={studio.status} onSelect={studio.setStatus} />

            <Card>
                <div className="flex flex-col gap-5 p-5">
                    <CreditTokensToolbar
                        activeType={activeType}
                        onTypeChange={(type) => {
                            setCreateOpen(false)
                            studio.setActiveType(type)
                        }}
                        status={studio.status}
                        onStatusChange={studio.setStatus}
                        search={studio.searchInput}
                        onSearchChange={studio.setSearchInput}
                        searching={studio.loading}
                        sort={studio.sort}
                        onSortChange={studio.setSort}
                        total={studio.total}
                        onCreate={() => setCreateOpen((open) => !open)}
                        createActive={createOpen}
                        onExport={() => void studio.exportCsv()}
                        exporting={studio.exporting}
                        exportDisabled={(studio.total ?? 0) === 0}
                    />

                    {createOpen && (
                        <div className="rounded-lg border border-ember-500/25 bg-ember-500/[.04] p-4">
                            <SectionHeader
                                icon={activeType === 'code' ? KeyRound : Mail}
                                title={
                                    activeType === 'code'
                                        ? t('admin.creditCodes.codes.title')
                                        : t('admin.creditCodes.emailGrants.title')
                                }
                                tone="ember"
                            />
                            <p className="mt-1 mb-4 font-ui text-[13px] leading-relaxed text-parchment-300">
                                {activeType === 'code'
                                    ? t('admin.creditCodes.codes.description')
                                    : t('admin.creditCodes.emailGrants.description')}
                            </p>
                            {activeType === 'code' ? (
                                <CreateCreditCodeGrantForm
                                    onCreated={() => studio.handleCreated()}
                                    notify={studio.setToast}
                                    setError={studio.setError}
                                />
                            ) : (
                                <CreateEmailCreditGrantsForm
                                    onCreated={() => studio.handleCreated()}
                                    notify={studio.setToast}
                                    setError={studio.setError}
                                />
                            )}
                        </div>
                    )}

                    <div className="border-t border-parchment-50/[.08] pt-5">
                        {activeType === 'code' ? (
                            <CreditCodeGrantsList
                                grants={studio.codeGrants}
                                loading={studio.loading}
                                mutatingId={studio.mutatingId}
                                onDisable={(grant) =>
                                    studio.setPendingDisable({
                                        kind: 'code',
                                        id: grant.code_id,
                                        label: grant.label || t('admin.creditCodes.codes.untitled'),
                                    })
                                }
                                onEdit={(grant) => setEditing({ kind: 'code', grant })}
                                hasMore={studio.hasMore}
                                loadingMore={studio.loadingMore}
                                onLoadMore={() => void studio.loadMore()}
                            />
                        ) : (
                            <EmailCreditGrantsList
                                grants={studio.emailGrants}
                                loading={studio.loading}
                                mutatingId={studio.mutatingId}
                                onDisable={(grant) =>
                                    studio.setPendingDisable({ kind: 'email', id: grant.grant_id, label: grant.email })
                                }
                                onEdit={(grant) => setEditing({ kind: 'email', grant })}
                                hasMore={studio.hasMore}
                                loadingMore={studio.loadingMore}
                                onLoadMore={() => void studio.loadMore()}
                            />
                        )}
                    </div>
                </div>
            </Card>

            <EditCreditGrantDialog
                key={editing ? `${editing.kind}-${editing.kind === 'code' ? (editing.grant as { code_id: number }).code_id : (editing.grant as { grant_id: number }).grant_id}` : 'edit-none'}
                open={editing !== null}
                kind={editing?.kind ?? 'code'}
                grant={editing?.grant ?? null}
                saving={editing != null && studio.mutatingId != null}
                onSave={(patch) => void handleSaveEdit(patch)}
                onClose={() => setEditing(null)}
            />

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
