/**
 * Root console: Membership & plans. Three tabs over one data hook —
 * Plans (catalog + create / edit), Members (who is on what, with usage and a
 * Change plan action), and Usage (per-plan and per-operation consumption plus
 * the quota reset tool). KPI tiles sit above the tabs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Layers, RefreshCw, Users, WalletCards } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import type { MembershipMember, MembershipPlan } from '@/shared'
import { Button, Callout, Icon, IconTile, PageHeader, TabPanel, Tabs, Toast, type TabOption } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { useMembershipAdmin } from '../hooks/useMembershipAdmin'
import { AssignPlanDialog } from './AssignPlanDialog'
import { MembersList } from './MembersList'
import { MembersToolbar } from './MembersToolbar'
import { MembershipOverviewTiles } from './MembershipOverviewTiles'
import { PlanEditorDialog, type PlanEditorMode } from './PlanEditorDialog'
import { PlanList } from './PlanList'
import { QuotaResetPanel } from './QuotaResetPanel'
import { UsageBreakdown } from './UsageBreakdown'

type MembershipTab = 'plans' | 'members' | 'usage'

interface EditorState {
    mode: PlanEditorMode
    plan: MembershipPlan | null
}

const TAB_ID_BASE = 'admin-membership'

export function AdminMembershipPage() {
    const { t } = useTranslation()
    const { isAuthenticated, user, openLoginModal } = useAuth()
    const isRoot = isAuthenticated && user?.user_type === 'root'
    const admin = useMembershipAdmin(Boolean(isRoot))
    const [tab, setTab] = useState<MembershipTab>('plans')
    const [editor, setEditor] = useState<EditorState | null>(null)
    const [assignTarget, setAssignTarget] = useState<MembershipMember | null>(null)

    if (!isAuthenticated) {
        return (
            <RootAccessState
                message={t('admin.membership.access.title')}
                secondaryText={t('admin.membership.access.loginRequired')}
                action={{ label: t('admin.common.logIn'), onClick: openLoginModal }}
            />
        )
    }

    if (!isRoot) {
        return <RootAccessState message={t('admin.membership.access.title')} secondaryText={t('admin.membership.access.rootOnly')} />
    }

    const tabs: TabOption<MembershipTab>[] = [
        { value: 'plans', label: t('admin.membership.tabs.plans'), icon: <Icon icon={Layers} size={16} /> },
        { value: 'members', label: t('admin.membership.tabs.members'), icon: <Icon icon={Users} size={16} /> },
        { value: 'usage', label: t('admin.membership.tabs.usage'), icon: <Icon icon={Activity} size={16} /> },
    ]

    const loading = admin.overviewLoading || admin.plansLoading || admin.membersLoading

    const openMembersForPlan = (plan: MembershipPlan) => {
        admin.setPlanFilter(plan.plan_code)
        setTab('members')
    }

    const handleCreate = async (body: Parameters<typeof admin.createPlan>[0]) => {
        const created = await admin.createPlan(body)
        if (created) setEditor(null)
    }

    const handleUpdate = async (planCode: string, body: Parameters<typeof admin.updatePlan>[1]) => {
        const updated = await admin.updatePlan(planCode, body)
        if (updated) setEditor(null)
    }

    const handleAssign = async (planCode: string, reason: string | null) => {
        if (!assignTarget) return
        const result = await admin.assignPlan({ user_id: assignTarget.user_id, plan_code: planCode, reason })
        if (result) setAssignTarget(null)
    }

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('admin.common.rootConsole')}
                eyebrowTone="arcane"
                icon={<IconTile icon={WalletCards} tone="arcane" />}
                title={t('admin.membership.page.title')}
                subtitle={t('admin.membership.page.subtitle')}
                size="lg"
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : undefined} />}
                        onClick={admin.reload}
                        disabled={loading}
                    >
                        {t('admin.common.refresh')}
                    </Button>
                }
                divider
            />

            {admin.error && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={
                        <Button variant="secondary" size="sm" onClick={() => admin.setError(null)}>
                            {t('admin.common.dismiss')}
                        </Button>
                    }
                >
                    {admin.error}
                </Callout>
            )}

            <MembershipOverviewTiles overview={admin.overview} loading={admin.overviewLoading && !admin.overview} />

            <Tabs
                options={tabs}
                value={tab}
                onChange={setTab}
                idBase={TAB_ID_BASE}
                aria-label={t('admin.membership.tabs.label')}
            />

            <TabPanel value="plans" idBase={TAB_ID_BASE} active={tab} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="font-display text-h3 font-semibold text-parchment-50">{t('admin.membership.plans.title')}</h2>
                    <p className="max-w-[72ch] font-ui text-[13px] leading-relaxed text-parchment-300">
                        {t('admin.membership.plans.description')}
                    </p>
                </div>
                <PlanList
                    plans={admin.plans}
                    loading={admin.plansLoading}
                    onCreate={() => setEditor({ mode: 'create', plan: null })}
                    onEdit={(plan) => setEditor({ mode: 'edit', plan })}
                    onViewMembers={openMembersForPlan}
                />
            </TabPanel>

            <TabPanel value="members" idBase={TAB_ID_BASE} active={tab} className="flex flex-col gap-4">
                <MembersToolbar
                    plans={admin.plans}
                    planFilter={admin.planFilter}
                    onPlanFilterChange={admin.setPlanFilter}
                    search={admin.searchInput}
                    onSearchChange={admin.setSearchInput}
                    searching={admin.membersLoading}
                    sort={admin.sort}
                    onSortChange={admin.setSort}
                    total={admin.total}
                />
                <MembersList
                    members={admin.members}
                    loading={admin.membersLoading}
                    hasMore={admin.hasMore}
                    loadingMore={admin.loadingMore}
                    onLoadMore={() => void admin.loadMore()}
                    onAssign={setAssignTarget}
                    busy={admin.assigning}
                />
            </TabPanel>

            <TabPanel value="usage" idBase={TAB_ID_BASE} active={tab} className="flex flex-col gap-8">
                <UsageBreakdown overview={admin.overview} />
                <QuotaResetPanel
                    resetting={admin.resettingQuotas}
                    lastReset={admin.lastQuotaReset}
                    onReset={admin.resetMembershipQuotas}
                />
            </TabPanel>

            {editor && (
                <PlanEditorDialog
                    key={`${editor.mode}:${editor.plan?.plan_code ?? 'new'}`}
                    open
                    mode={editor.mode}
                    plan={editor.plan}
                    plans={admin.plans}
                    operations={admin.operations}
                    saving={admin.savingPlan}
                    onCreate={(body) => void handleCreate(body)}
                    onUpdate={(planCode, body) => void handleUpdate(planCode, body)}
                    onClose={() => setEditor(null)}
                />
            )}

            {assignTarget && (
                <AssignPlanDialog
                    key={`assign:${assignTarget.user_id}`}
                    open
                    member={assignTarget}
                    plans={admin.plans}
                    assigning={admin.assigning}
                    onConfirm={(planCode, reason) => void handleAssign(planCode, reason)}
                    onClose={() => setAssignTarget(null)}
                />
            )}

            {admin.toast && (
                <Toast
                    open
                    tone={admin.toast.tone}
                    title={admin.toast.title}
                    message={admin.toast.message}
                    onClose={() => admin.setToast(null)}
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
            <EmptyState icon={<Icon icon={WalletCards} size={44} />} message={message} secondaryText={secondaryText} button={action} />
        </div>
    )
}
