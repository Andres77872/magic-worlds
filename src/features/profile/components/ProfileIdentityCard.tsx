/**
 * Profile identity header — the always-visible band above the section tabs.
 * Shows the avatar, the inline display-name editor (which owns the page <h1>),
 * the role badge, `@username`, the copyable user hash, a compact content-stat
 * strip, and the log-out action. Pure: the container wires the data + handlers.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check, Copy, Crown, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AvatarVariantId, UserProfile } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { avatarVariantUrl } from '@/infrastructure/api/mediaUrl'
import { effectiveName } from '@/utils/displayName'
import { Avatar, Badge, Button, cx, Icon, IconButton, Tooltip, type BadgeTone } from '@/ui/primitives'
import { DisplayNameEditor } from './DisplayNameEditor'
import { ProfileStats } from './ProfileStats'

const ALL_AVATAR_VARIANTS: readonly AvatarVariantId[] = ['A', 'B', 'C', 'D']

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

function variantLabel(variant: AvatarVariantId, t: TFunction): string {
    switch (variant) {
        case 'A':
            return t('profile.identity.avatarVariantA')
        case 'B':
            return t('profile.identity.avatarVariantB')
        case 'C':
            return t('profile.identity.avatarVariantC')
        case 'D':
            return t('profile.identity.avatarVariantD')
    }
}

interface ProfileIdentityCardProps {
    profile: UserProfile
    /** Called with the saved display name (null when cleared) after a successful edit. */
    onDisplayNameUpdated?: (displayName: string | null) => void
    /** Called with the updated UserProfile after switching the active avatar variant. */
    onAvatarVariantUpdated?: (updatedProfile: UserProfile) => void
    /** Opens the log-out confirmation. Omitted in isolation (Storybook) hides the action. */
    onRequestLogout?: () => void
}

export function ProfileIdentityCard({
    profile,
    onDisplayNameUpdated,
    onAvatarVariantUpdated,
    onRequestLogout,
}: ProfileIdentityCardProps) {
    const { t } = useTranslation()
    const role = roleMeta(profile.user_type, t)
    const [pendingVariant, setPendingVariant] = useState<AvatarVariantId | null>(null)
    const [avatarError, setAvatarError] = useState<string | null>(null)

    const availableVariants = profile.available_avatar_variants ?? []
    const activeVariant = profile.active_avatar_variant ?? (availableVariants[0] ?? null)
    const displayLabel = effectiveName(profile)

    const handleSelectVariant = async (variant: AvatarVariantId) => {
        if (pendingVariant || variant === activeVariant || !availableVariants.includes(variant)) return
        setPendingVariant(variant)
        setAvatarError(null)
        try {
            const updated = await apiService.updateAvatarVariant(variant)
            onAvatarVariantUpdated?.(updated)
        } catch {
            setAvatarError(t('profile.identity.avatarError'))
        } finally {
            setPendingVariant(null)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                    <div className="flex flex-col items-center gap-2.5">
                        <Avatar
                            name={displayLabel}
                            src={profile.avatar_url}
                            size={72}
                            ring="ember"
                        />
                        {availableVariants.length > 1 && (
                            <div
                                role="radiogroup"
                                aria-label={t('profile.identity.avatarEmblemLabel')}
                                className="inline-flex items-center gap-1.5 rounded-full border border-parchment-50/[.08] bg-ink-700 px-2 py-1"
                            >
                                {ALL_AVATAR_VARIANTS.map((variant) => {
                                    const isAvailable = availableVariants.includes(variant)
                                    if (!isAvailable) return null
                                    const isSelected = activeVariant === variant
                                    const isSaving = pendingVariant === variant
                                    const label = variantLabel(variant, t)
                                    return (
                                        <Tooltip key={variant} label={label}>
                                            <button
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                aria-label={label}
                                                disabled={Boolean(pendingVariant)}
                                                onClick={() => void handleSelectVariant(variant)}
                                                className={cx(
                                                    'relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-all',
                                                    isSelected
                                                        ? 'ring-2 ring-ember-500 ring-offset-2 ring-offset-ink-800 shadow-glow-ember'
                                                        : 'opacity-70 hover:opacity-100',
                                                    isSaving && 'animate-pulse',
                                                )}
                                            >
                                                <Avatar
                                                    name={displayLabel}
                                                    src={avatarVariantUrl(variant, 128)}
                                                    size={28}
                                                    ring="none"
                                                />
                                            </button>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        )}
                        {avatarError && (
                            <p role="alert" className="font-ui text-caption text-blood-500">
                                {avatarError}
                            </p>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col items-center gap-1.5 sm:items-start">
                        <DisplayNameEditor
                            username={profile.username}
                            displayName={profile.display_name ?? null}
                            onUpdated={onDisplayNameUpdated}
                        />
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <span className="font-ui text-[13px] text-parchment-400">@{profile.username}</span>
                            <Badge tone={role.tone} icon={<Icon icon={role.icon} size={11} />}>
                                {role.label}
                            </Badge>
                        </div>
                        <UserHashChip value={profile.user_hash} />
                    </div>
                </div>

                {onRequestLogout && (
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={LogOut} size={15} />}
                        onClick={onRequestLogout}
                        className="self-center sm:self-start"
                    >
                        {t('sidebar.logout')}
                    </Button>
                )}
            </div>

            <ProfileStats profile={profile} />
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
