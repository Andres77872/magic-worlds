/**
 * Presentational profile/account view (Reverie). Pure — takes the loaded
 * profile and a logout handler as props so it renders in isolation (Storybook,
 * tests). The container {@link ProfilePage} wires the data + auth hooks.
 *
 * The magic-worlds-api profile surface is read-only, so there is no edit form;
 * a disabled "Edit profile" affordance signals that it's coming.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
    Check,
    Copy,
    Crown,
    Gem,
    Globe2,
    Globe,
    Link2,
    Loader2,
    LogOut,
    RefreshCw,
    Share2,
    ShieldCheck,
    Swords,
    Trash2,
    TriangleAlert,
    User as UserIcon,
    Users,
    Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SharedCardResource, UserProfile } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { effectiveName } from '@/utils/displayName'
import { Avatar, Badge, Button, Card, Chip, Icon, IconButton, SectionHeader, Toast, type BadgeTone } from '@/ui/primitives'
import { LogoutConfirmDialog } from '@/ui/components/LogoutConfirmDialog'
import { publicItems } from '@/features/gallery/galleryConfig'
import { buildSharedCardUrl } from '@/features/gallery/galleryLinks'
import type { ProfileSharedCardsState } from '../hooks/useProfileSharedCards'
import { AccountSecuritySection } from './AccountSecuritySection'
import { DeleteDataDialog } from './DeleteDataDialog'
import { DisplayNameEditor } from './DisplayNameEditor'
import { EmailSection } from './EmailSection'
import { MembershipSection } from './MembershipSection'
import { UsageSection } from './UsageSection'

interface ProfileViewProps {
    profile: UserProfile
    sharing?: ProfileSharedCardsState
    onLogout: () => void
    /** Wipes all of the user's content (account kept). Rejects to surface an error in the dialog. */
    onDeleteAllData: () => Promise<void>
    /** Called with the saved display name (null when cleared) after a successful edit. */
    onDisplayNameUpdated?: (displayName: string | null) => void
}

interface RoleMeta {
    label: string
    tone: BadgeTone
    icon: LucideIcon
}

/** Friendly label + accent for each backend `user_type`. */
function roleMeta(userType: string, t: TFunction): RoleMeta {
    switch (userType) {
        case 'root':
            return { label: t('profile.roles.root'), tone: 'arcane', icon: Crown }
        case 'admin':
            return { label: t('profile.roles.admin'), tone: 'arcane', icon: ShieldCheck }
        default:
            return { label: userType ? capitalize(userType) : t('profile.roles.adventurer'), tone: 'neutral', icon: UserIcon }
    }
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function availableCredits(profile: UserProfile) {
    return profile.membership?.total_available_credits ?? profile.user_usage
}

export function ProfileView({ profile, sharing, onLogout, onDeleteAllData, onDisplayNameUpdated }: ProfileViewProps) {
    const { t } = useTranslation()
    const role = roleMeta(profile.user_type, t)
    const { card_counts: counts } = profile
    const credits = availableCredits(profile)
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    const confirmLogout = () => {
        setConfirmLogoutOpen(false)
        onLogout()
    }

    return (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            {/* ---------- Hero / identity ---------- */}
            <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
                <Avatar name={effectiveName(profile)} size={88} ring="ember" />

                <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <DisplayNameEditor
                            username={profile.username}
                            displayName={profile.display_name ?? null}
                            onUpdated={onDisplayNameUpdated}
                        />
                        <Badge tone={role.tone} icon={<Icon icon={role.icon} size={11} />}>
                            {role.label}
                        </Badge>
                    </div>

                    <span className="font-ui text-[13px] text-parchment-400">@{profile.username}</span>

                    <UserHashChip value={profile.user_hash} />
                </div>
            </section>

            {/* ---------- Stats ---------- */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard icon={Users} label={t('profile.stats.characters')} value={counts.character} />
                <StatCard icon={Globe} label={t('profile.stats.worlds')} value={counts.world} />
                <StatCard icon={Gem} label={t('profile.stats.items')} value={counts.item ?? 0} />
                <StatCard icon={Swords} label={t('profile.stats.adventures')} value={counts.adventure_template} />
                <StatCard icon={Zap} label={t('profile.stats.credits')} value={credits} />
            </section>

            <MembershipSection profile={profile} />

            <UsageSection profile={profile} />

            {sharing && <ProfileSharingSection sharing={sharing} />}

            {/* ---------- Account ---------- */}
            <section className="flex flex-col gap-4">
                <SectionHeader icon={ShieldCheck} title={t('profile.account.title')} />
                <Card>
                    <dl className="flex flex-col">
                        <AccountRow label={t('profile.account.username')} value={profile.username} />
                        <AccountRow label={t('profile.account.role')} value={role.label} />
                        <AccountRow label={t('profile.account.userId')} value={profile.user_hash} mono />
                        <AccountRow label={t('profile.account.availableCredits')} value={t('profile.account.creditsValue', { count: credits })} />
                    </dl>
                    <div className="flex justify-end border-t border-parchment-50/[.08] px-5 py-4">
                        <Button
                            kind="danger"
                            size="sm"
                            iconLeft={<Icon icon={LogOut} size={15} />}
                            onClick={() => setConfirmLogoutOpen(true)}
                        >
                            {t('sidebar.logout')}
                        </Button>
                    </div>
                </Card>
            </section>

            {/* ---------- Email addresses ---------- */}
            <EmailSection />

            {/* ---------- Password & security ---------- */}
            <AccountSecuritySection />

            {/* ---------- Danger zone ---------- */}
            <section className="flex flex-col gap-4">
                <SectionHeader icon={TriangleAlert} title={t('profile.danger.title')} />
                <Card className="border-blood-500/25">
                    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="font-ui text-[14px] font-semibold text-parchment-50">{t('profile.danger.deleteAllTitle')}</span>
                            <span className="font-ui text-[13px] text-parchment-400">
                                {t('profile.danger.deleteAllBody')}
                            </span>
                        </div>
                        <Button
                            kind="danger"
                            size="sm"
                            iconLeft={<Icon icon={Trash2} size={15} />}
                            onClick={() => setConfirmDeleteOpen(true)}
                            className="shrink-0"
                        >
                            {t('profile.danger.deleteAllAction')}
                        </Button>
                    </div>
                </Card>
            </section>

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

/** Monospace user-hash with copy-to-clipboard feedback (Copy → Check). */
function UserHashChip({ value }: { value: string }) {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        try {
            await navigator.clipboard?.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard unavailable (e.g. insecure context) — silently no-op.
        }
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-600 px-3 py-1 font-mono text-[12px] text-parchment-400">
            {value}
            <IconButton label={copied ? t('profile.account.copied') : t('profile.account.copyUserId')} size="sm" onClick={copy}>
                <Icon icon={copied ? Check : Copy} size={14} className={copied ? 'text-verdant-500' : undefined} />
            </IconButton>
        </span>
    )
}

interface StatCardProps {
    icon: LucideIcon
    label: string
    value: number
}

function StatCard({ icon, label, value }: StatCardProps) {
    return (
        <Card className="flex flex-col items-center gap-1.5 px-4 py-5 text-center">
            <Icon icon={icon} size={20} className="text-ember-400" />
            <span className="font-display text-[32px] font-semibold leading-none text-parchment-50">{value}</span>
            <span className="font-ui text-[12px] uppercase tracking-[0.14em] text-parchment-400">{label}</span>
        </Card>
    )
}

interface ProfileSharingNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

type SharingTab = 'public' | 'links'

async function writeClipboardText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard copy failed')
}

function sharedCardItem(resource: SharedCardResource) {
    return publicItems(resource)[0] ?? null
}

function sharedCardTitle(resource: SharedCardResource, fallback: string): string {
    return sharedCardItem(resource)?.title ?? fallback
}

function sharedCardTypeLabel(resource: SharedCardResource, t: TFunction): string {
    const item = sharedCardItem(resource)
    const type = item?.galleryType ?? (resource.card_type === 'adventure_template' ? 'adventure' : resource.card_type)
    return type === 'adventure' ? t('profile.sharing.types.adventure') : type.charAt(0).toUpperCase() + type.slice(1)
}

function sharedCardId(resource: SharedCardResource): string | null {
    return sharedCardItem(resource)?.id ?? resource.original_card_id ?? null
}

function sharingErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

function ProfileSharingSection({ sharing }: { sharing: ProfileSharedCardsState }) {
    const { t } = useTranslation()
    const [tab, setTab] = useState<SharingTab>('public')
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [notice, setNotice] = useState<ProfileSharingNotice | null>(null)
    const activeItems = tab === 'public' ? sharing.publicCards : sharing.shareLinks

    const copyLink = async (resource: SharedCardResource) => {
        if (!resource.share_token || busyKey) return
        const key = `copy:${resource.share_token}`
        setBusyKey(key)
        setNotice(null)
        try {
            await writeClipboardText(buildSharedCardUrl(resource.share_token))
            setNotice({ tone: 'success', title: t('profile.sharing.notice.linkCopied'), message: sharedCardTitle(resource, t('profile.sharing.untitledCard')).slice(0, 80) })
        } catch (error) {
            console.error('Failed to copy profile shared card link:', error)
            setNotice({ tone: 'error', title: t('profile.sharing.notice.copyFailed'), message: t('profile.sharing.notice.tryAgain') })
        } finally {
            setBusyKey(null)
        }
    }

    const revokeLink = async (resource: SharedCardResource) => {
        if (!resource.share_token || busyKey) return
        const key = `revoke:${resource.share_token}`
        setBusyKey(key)
        setNotice(null)
        try {
            await apiService.revokeSharedCardLink(resource.share_token)
            sharing.refresh()
            setNotice({ tone: 'success', title: t('profile.sharing.notice.linkRevoked'), message: sharedCardTitle(resource, t('profile.sharing.untitledCard')).slice(0, 80) })
        } catch (error) {
            console.error('Failed to revoke profile shared card link:', error)
            setNotice({
                tone: 'error',
                title: t('profile.sharing.notice.revokeFailed'),
                message: sharingErrorMessage(error, t('profile.sharing.notice.tryAgain')),
            })
        } finally {
            setBusyKey(null)
        }
    }

    const unpublishCard = async (resource: SharedCardResource) => {
        const cardId = sharedCardId(resource)
        if (!cardId || busyKey) return
        const key = `public:${resource.card_type}:${cardId}`
        setBusyKey(key)
        setNotice(null)
        try {
            await apiService.unpublishCard(resource.card_type, cardId)
            sharing.refresh()
            setNotice({ tone: 'success', title: t('profile.sharing.notice.publicRemoved'), message: sharedCardTitle(resource, t('profile.sharing.untitledCard')).slice(0, 80) })
        } catch (error) {
            console.error('Failed to unpublish profile card:', error)
            setNotice({
                tone: 'error',
                title: t('profile.sharing.notice.publicFailed'),
                message: sharingErrorMessage(error, t('profile.sharing.notice.tryAgain')),
            })
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader
                icon={Share2}
                title={t('profile.sharing.title')}
                right={
                    <div className="flex flex-wrap items-center gap-2">
                        <Chip active={tab === 'public'} icon={<Icon icon={Globe2} size={13} />} onClick={() => setTab('public')}>
                            {t('profile.sharing.public')}
                        </Chip>
                        <Chip active={tab === 'links'} icon={<Icon icon={Link2} size={13} />} onClick={() => setTab('links')}>
                            {t('profile.sharing.links')}
                        </Chip>
                        <Button
                            kind="ghost"
                            size="sm"
                            iconLeft={<Icon icon={RefreshCw} size={14} />}
                            onClick={sharing.refresh}
                            disabled={sharing.isLoading}
                        >
                            {t('profile.sharing.refresh')}
                        </Button>
                    </div>
                }
            />

            <Toast
                open={Boolean(notice)}
                tone={notice?.tone ?? 'success'}
                title={notice?.title}
                message={notice?.message}
                autoCloseMs={notice?.tone === 'success' ? 3200 : false}
                onClose={() => setNotice(null)}
            />

            <Card>
                {sharing.isLoading ? (
                    <div className="flex items-center gap-2 px-5 py-5 font-ui text-sm text-parchment-300">
                        <Icon icon={Loader2} size={16} className="animate-spin text-ember-400" />
                        {t('profile.sharing.loading')}
                    </div>
                ) : sharing.error ? (
                    <div className="flex flex-col gap-3 px-5 py-5">
                        <p className="font-ui text-sm text-blood-500">{sharing.error}</p>
                        <Button kind="secondary" size="sm" onClick={sharing.refresh}>
                            {t('common.tryAgain')}
                        </Button>
                    </div>
                ) : activeItems.length === 0 ? (
                    <div className="px-5 py-5 font-ui text-sm text-parchment-400">
                        {tab === 'public'
                            ? t('profile.sharing.publicEmpty')
                            : t('profile.sharing.linksEmpty')}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {activeItems.map((resource) => {
                            const item = sharedCardItem(resource)
                            const title = item?.title ?? sharedCardTitle(resource, t('profile.sharing.untitledCard'))
                            const cardId = sharedCardId(resource)
                            const linkBusy = resource.share_token ? busyKey === `copy:${resource.share_token}` : false
                            const revokeBusy = resource.share_token ? busyKey === `revoke:${resource.share_token}` : false
                            const publicBusy = cardId ? busyKey === `public:${resource.card_type}:${cardId}` : false
                            return (
                                <div
                                    key={`${tab}:${resource.card_type}:${cardId ?? resource.share_token ?? title}`}
                                    className="flex flex-col gap-3 border-b border-parchment-50/[.06] px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate font-ui text-sm font-semibold text-parchment-50">{title}</p>
                                            <Badge tone={tab === 'public' ? 'live' : 'neutral'}>
                                                {sharedCardTypeLabel(resource, t)}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 truncate font-ui text-xs text-parchment-400">
                                            {tab === 'public' ? t('profile.sharing.publicListed') : t('profile.sharing.unlistedOnly')}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        {tab === 'links' && resource.share_token && (
                                            <>
                                                <Button
                                                    kind="secondary"
                                                    size="sm"
                                                    iconLeft={<Icon icon={linkBusy ? Loader2 : Copy} size={14} className={linkBusy ? 'animate-spin' : undefined} />}
                                                    onClick={() => void copyLink(resource)}
                                                    disabled={busyKey !== null}
                                                >
                                                    {t('profile.sharing.copyLink')}
                                                </Button>
                                                <Button
                                                    kind="danger"
                                                    size="sm"
                                                    iconLeft={<Icon icon={revokeBusy ? Loader2 : Trash2} size={14} className={revokeBusy ? 'animate-spin' : undefined} />}
                                                    onClick={() => void revokeLink(resource)}
                                                    disabled={busyKey !== null}
                                                >
                                                    {t('profile.sharing.revoke')}
                                                </Button>
                                            </>
                                        )}
                                        {tab === 'public' && (
                                            <Button
                                                kind="danger"
                                                size="sm"
                                                iconLeft={<Icon icon={publicBusy ? Loader2 : Globe2} size={14} className={publicBusy ? 'animate-spin' : undefined} />}
                                                onClick={() => void unpublishCard(resource)}
                                                disabled={busyKey !== null || !cardId}
                                            >
                                                {t('profile.sharing.removePublic')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>
        </section>
    )
}

interface AccountRowProps {
    label: string
    value: string
    mono?: boolean
}

function AccountRow({ label, value, mono }: AccountRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-parchment-50/[.06] px-5 py-3.5 last:border-b-0">
            <dt className="font-ui text-[13px] text-parchment-400">{label}</dt>
            <dd className={`truncate text-right text-[14px] text-parchment-100 ${mono ? 'font-mono text-[12px]' : 'font-ui'}`}>
                {value}
            </dd>
        </div>
    )
}
