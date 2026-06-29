/**
 * Presentational profile/account view (Reverie). Pure — takes the loaded profile
 * and handlers as props so it renders in isolation (Storybook, tests). The
 * container {@link ProfilePage} wires the data + auth hooks.
 *
 * Layout is a two-column settings shell: an always-visible identity header
 * (avatar, name, role, stats, log out) over a sticky section nav (vertical on
 * desktop, a horizontal scroller on mobile) beside the active section panel.
 * This keeps each section to roughly one viewport instead of one long scroll.
 *
 * Panels are kept mounted (`hidden` toggles), NOT lazy — the Membership panel's
 * email-credit auto-claim and the Account panel's email prefetch must fire on
 * load. Do not switch these to `mountOnEnter` without re-checking those effects.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, CreditCard, Mail, Share2, ShieldCheck } from 'lucide-react'
import type { UserProfile } from '@/shared'
import { Icon, Tabs, TabPanel, useIsDesktop, type TabOption } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LogoutConfirmDialog } from '@/ui/components/LogoutConfirmDialog'
import type { ProfileSharedCardsState } from '../hooks/useProfileSharedCards'
import { AccountSecuritySection } from './AccountSecuritySection'
import { DangerZone } from './DangerZone'
import { DeleteDataDialog } from './DeleteDataDialog'
import { EmailSection } from './EmailSection'
import { MembershipSection } from './MembershipSection'
import { ProfileIdentityCard } from './ProfileIdentityCard'
import { ProfileSharingSection } from './ProfileSharingSection'
import { UsageSection } from './UsageSection'

export type ProfileTab = 'membership' | 'usage' | 'sharing' | 'account' | 'security'

interface ProfileViewProps {
    profile: UserProfile
    sharing?: ProfileSharedCardsState
    onLogout: () => void
    /** Wipes all of the user's content (account kept). Rejects to surface an error in the dialog. */
    onDeleteAllData: () => Promise<void>
    /** Called with the saved display name (null when cleared) after a successful edit. */
    onDisplayNameUpdated?: (displayName: string | null) => void
    /** Re-fetch /user/me after a credit code is redeemed so the wallet balance updates. */
    onRedeemed?: () => void
    /** Claim pending email credit grants once after a notification email opens Profile. */
    autoClaimEmailCreditGrants?: boolean
    /** Whether Stripe billing is enabled server-side — gates the "Plans & credits" entry. */
    billingEnabled?: boolean
    /** Whether the community-card sharing manager is exposed. */
    sharingEnabled?: boolean
    /** Uncontrolled initial section (Storybook, tests). Ignored when `activeTab` is set. */
    initialTab?: ProfileTab
    /** Controlled active section (the container drives this from the URL hash). */
    activeTab?: ProfileTab
    /** Reports a section change so the container can sync the URL. */
    onTabChange?: (tab: ProfileTab) => void
}

export function ProfileView({
    profile,
    sharing,
    onLogout,
    onDeleteAllData,
    onDisplayNameUpdated,
    onRedeemed,
    autoClaimEmailCreditGrants,
    billingEnabled,
    sharingEnabled = true,
    initialTab,
    activeTab,
    onTabChange,
}: ProfileViewProps) {
    const { t } = useTranslation()
    const isDesktop = useIsDesktop()
    const [internalTab, setInternalTab] = useState<ProfileTab>(initialTab ?? 'membership')
    const tab = activeTab ?? internalTab
    const setTab = (next: ProfileTab) => {
        if (activeTab === undefined) setInternalTab(next)
        onTabChange?.(next)
    }
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    const confirmLogout = () => {
        setConfirmLogoutOpen(false)
        onLogout()
    }

    const tabs: TabOption<ProfileTab>[] = [
        { value: 'membership', label: t('profile.tabs.membership'), icon: <Icon icon={CreditCard} size={16} /> },
        { value: 'usage', label: t('profile.tabs.usage'), icon: <Icon icon={Activity} size={16} /> },
        ...(sharingEnabled ? [{ value: 'sharing' as const, label: t('profile.tabs.sharing'), icon: <Icon icon={Share2} size={16} /> }] : []),
        { value: 'account', label: t('profile.tabs.account'), icon: <Icon icon={Mail} size={16} /> },
        { value: 'security', label: t('profile.tabs.security'), icon: <Icon icon={ShieldCheck} size={16} /> },
    ]

    return (
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <ProfileIdentityCard
                profile={profile}
                onDisplayNameUpdated={onDisplayNameUpdated}
                onRequestLogout={() => setConfirmLogoutOpen(true)}
            />

            <div className="grid gap-6 border-t border-parchment-50/[.08] pt-6 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <aside className="lg:sticky lg:top-6 lg:self-start">
                    <Tabs
                        options={tabs}
                        value={tab}
                        onChange={setTab}
                        idBase="profile"
                        aria-label={t('profile.tabs.aria')}
                        orientation={isDesktop ? 'vertical' : 'horizontal'}
                        className={isDesktop ? undefined : '-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8'}
                    />
                </aside>

                <div className="min-w-0">
                    <TabPanel value="membership" idBase="profile" active={tab} className="flex flex-col gap-8">
                        <MembershipSection
                            profile={profile}
                            onRedeemed={onRedeemed}
                            autoClaimEmailCreditGrants={autoClaimEmailCreditGrants}
                            billingEnabled={billingEnabled}
                        />
                    </TabPanel>

                    <TabPanel value="usage" idBase="profile" active={tab}>
                        <UsageSection profile={profile} />
                    </TabPanel>

                    {sharingEnabled && (
                        <TabPanel value="sharing" idBase="profile" active={tab}>
                            {sharing ? (
                                <ProfileSharingSection sharing={sharing} />
                            ) : (
                                <EmptyState icon={<Icon icon={Share2} size={40} />} message={t('profile.sharing.title')} secondaryText={t('profile.sharing.publicEmpty')} />
                            )}
                        </TabPanel>
                    )}

                    <TabPanel value="account" idBase="profile" active={tab}>
                        <EmailSection />
                    </TabPanel>

                    <TabPanel value="security" idBase="profile" active={tab} className="flex flex-col gap-8">
                        <AccountSecuritySection />
                        <DangerZone onRequestDelete={() => setConfirmDeleteOpen(true)} />
                    </TabPanel>
                </div>
            </div>

            <LogoutConfirmDialog
                open={confirmLogoutOpen}
                username={profile.username}
                onCancel={() => setConfirmLogoutOpen(false)}
                onConfirm={confirmLogout}
            />

            <DeleteDataDialog
                open={confirmDeleteOpen}
                username={profile.username}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={onDeleteAllData}
            />
        </div>
    )
}
