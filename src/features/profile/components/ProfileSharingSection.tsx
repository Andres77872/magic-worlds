/**
 * Sharing manager for the profile Sharing tab. Two sub-views (public cards /
 * unlisted share links) toggled with Chips, each row offering copy/revoke or
 * unpublish actions with toast feedback. Self-contained around the
 * {@link ProfileSharedCardsState} passed in by the container.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Copy, Globe2, Link2, Loader2, RefreshCw, Share2, Trash2 } from 'lucide-react'
import type { SharedCardResource } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { Badge, Button, Card, Chip, Icon, SectionHeader, Toast } from '@/ui/primitives'
import { publicItems } from '@/features/gallery/galleryConfig'
import { buildSharedCardUrl } from '@/features/gallery/galleryLinks'
import type { ProfileSharedCardsState } from '../hooks/useProfileSharedCards'

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

export function ProfileSharingSection({ sharing }: { sharing: ProfileSharedCardsState }) {
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
                            variant="ghost"
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
                        <Button variant="secondary" size="sm" onClick={sharing.refresh}>
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
                                                    variant="secondary"
                                                    size="sm"
                                                    iconLeft={<Icon icon={linkBusy ? Loader2 : Copy} size={14} className={linkBusy ? 'animate-spin' : undefined} />}
                                                    onClick={() => void copyLink(resource)}
                                                    disabled={busyKey !== null}
                                                >
                                                    {t('profile.sharing.copyLink')}
                                                </Button>
                                                <Button
                                                    variant="danger"
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
                                                variant="danger"
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
