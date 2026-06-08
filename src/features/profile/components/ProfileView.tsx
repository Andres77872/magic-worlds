/**
 * Presentational profile/account view (Reverie). Pure — takes the loaded
 * profile and a logout handler as props so it renders in isolation (Storybook,
 * tests). The container {@link ProfilePage} wires the data + auth hooks.
 *
 * The magic-worlds-api profile surface is read-only, so there is no edit form;
 * a disabled "Edit profile" affordance signals that it's coming.
 */
import { useState } from 'react'
import {
    Check,
    Copy,
    Crown,
    Globe,
    Lock,
    LogOut,
    ShieldCheck,
    Swords,
    Trash2,
    TriangleAlert,
    User as UserIcon,
    Users,
    Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserProfile } from '@/shared'
import { Avatar, Badge, Button, Card, Icon, IconButton, SectionHeader, type BadgeTone } from '@/ui/primitives'
import { DeleteDataDialog } from './DeleteDataDialog'

interface ProfileViewProps {
    profile: UserProfile
    onLogout: () => void
    /** Wipes all of the user's content (account kept). Rejects to surface an error in the dialog. */
    onDeleteAllData: () => Promise<void>
}

interface RoleMeta {
    label: string
    tone: BadgeTone
    icon: LucideIcon
}

/** Friendly label + accent for each backend `user_type`. */
function roleMeta(userType: string): RoleMeta {
    switch (userType) {
        case 'root':
            return { label: 'Root', tone: 'arcane', icon: Crown }
        case 'admin':
            return { label: 'Admin', tone: 'arcane', icon: ShieldCheck }
        default:
            return { label: userType ? capitalize(userType) : 'Adventurer', tone: 'neutral', icon: UserIcon }
    }
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

export function ProfileView({ profile, onLogout, onDeleteAllData }: ProfileViewProps) {
    const role = roleMeta(profile.user_type)
    const { card_counts: counts } = profile
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    return (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            {/* ---------- Hero / identity ---------- */}
            <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
                <Avatar name={profile.username} size={88} ring="ember" />

                <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <h1 className="font-display text-h1 font-semibold text-parchment-50">{profile.username}</h1>
                        <Badge tone={role.tone} icon={<Icon icon={role.icon} size={11} />}>
                            {role.label}
                        </Badge>
                    </div>

                    <UserHashChip value={profile.user_hash} />

                    <div className="mt-1 flex flex-col items-center gap-1.5 sm:items-start">
                        <Button kind="secondary" size="sm" disabled iconLeft={<Icon icon={Lock} size={15} />}>
                            Edit profile
                        </Button>
                        <span className="font-ui text-[12px] text-parchment-400">Profile editing is coming soon</span>
                    </div>
                </div>
            </section>

            {/* ---------- Stats ---------- */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={Users} label="Characters" value={counts.character} />
                <StatCard icon={Globe} label="Worlds" value={counts.world} />
                <StatCard icon={Swords} label="Adventures" value={counts.adventure_template} />
                <StatCard icon={Zap} label="Credits" value={profile.user_usage} />
            </section>

            {/* ---------- Account ---------- */}
            <section className="flex flex-col gap-4">
                <SectionHeader icon={ShieldCheck} title="Account" />
                <Card>
                    <dl className="flex flex-col">
                        <AccountRow label="Username" value={profile.username} />
                        <AccountRow label="Role" value={role.label} />
                        <AccountRow label="User ID" value={profile.user_hash} mono />
                        <AccountRow label="Usage" value={`${profile.user_usage} credits`} />
                    </dl>
                    <div className="flex justify-end border-t border-parchment-50/[.08] px-5 py-4">
                        <Button kind="danger" size="sm" iconLeft={<Icon icon={LogOut} size={15} />} onClick={onLogout}>
                            Log out
                        </Button>
                    </div>
                </Card>
            </section>

            {/* ---------- Danger zone ---------- */}
            <section className="flex flex-col gap-4">
                <SectionHeader icon={TriangleAlert} title="Danger zone" />
                <Card className="border-blood-500/25">
                    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="font-ui text-[14px] font-semibold text-parchment-50">Delete all my data</span>
                            <span className="font-ui text-[13px] text-parchment-400">
                                Permanently removes everything you've created — characters, worlds, adventures, chats and
                                generated media. Your account stays active.
                            </span>
                        </div>
                        <Button
                            kind="danger"
                            size="sm"
                            iconLeft={<Icon icon={Trash2} size={15} />}
                            onClick={() => setConfirmDeleteOpen(true)}
                            className="shrink-0"
                        >
                            Delete all data
                        </Button>
                    </div>
                </Card>
            </section>

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
            <IconButton label={copied ? 'Copied' : 'Copy user ID'} size="sm" onClick={copy}>
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
