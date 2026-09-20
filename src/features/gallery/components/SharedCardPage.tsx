import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Import, Link2, Loader2, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import { useNavigation } from '@/app/hooks'
import type { SharedCardResource } from '@/shared'
import { isAdventuresFeatureEnabled } from '@/shared/featureFlags'
import { GalleryCard } from '@/ui/components'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { Badge, Button, Eyebrow, Icon, PageHeader, Toast } from '@/ui/primitives'
import { publicItems, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildSharedCardUrl, parseSharedCardToken } from '../galleryLinks'
import { useCardImport, useGalleryCardPreview, type ImportSource } from '../hooks/useCardImport'
import { CardImportOverlays } from './CardImportOverlays'
import { writeClipboardText } from '@/ui/components/common/clipboard'
import { errorMessage } from '@/utils/errors'

function playlistCardType(type: GalleryType) {
    return type === 'adventure' ? 'adventure_template' : type === 'persona' ? 'character' : type
}



export function SharedCardPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const [retryCount, setRetryCount] = useState(0)
    const token = parseSharedCardToken()
    const importHook = useCardImport()
    const preview = useGalleryCardPreview()
    const [resource, setResource] = useState<SharedCardResource | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const item = useMemo<GalleryItem | null>(() => (resource ? publicItems(resource)[0] ?? null : null), [resource])
    const importSource = (it: GalleryItem | null): ImportSource => ({ kind: 'shared', token: token ?? '', item: it })
    const importing = importHook.importingKey === `shared:${token ?? ''}`
    const alreadyImported = Boolean(item?.resource?.already_imported)
    const existingCardId = item?.resource?.existing_card_id ?? null

    useEffect(() => {
        if (!token) {
            setLoading(false)
            setError(t('gallery.shared.missingToken'))
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        void apiService
            .getSharedCard(token)
            .then((nextResource) => {
                if (cancelled) return
                setResource(nextResource)
            })
            .catch((err) => {
                if (cancelled) return
                console.error('Failed to load shared card:', err)
                setError(errorMessage(err, t('gallery.shared.openFailed')))
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [t, token, retryCount])

    const importSharedCard = () => {
        if (!token) return
        void importHook.requestImport(importSource(item))
    }

    const copyCurrentLink = async () => {
        if (!token) return
        importHook.setActionNotice(null)
        try {
            await writeClipboardText(buildSharedCardUrl(token))
            importHook.setActionNotice({ tone: 'success', title: t('gallery.shared.linkCopied') })
        } catch (err) {
            console.error('Failed to copy shared card link:', err)
            importHook.setActionNotice({ tone: 'error', title: t('gallery.action.copyFailed'), message: t('gallery.action.tryAgain') })
        }
    }

    if (loading) return <LoadingSpinner message={t('gallery.shared.loading')} />

    // A shared adventure card would import something the user can never open
    // while adventures are off — treat the link as unavailable instead.
    const adventureBlocked = item?.galleryType === 'adventure' && !isAdventuresFeatureEnabled()
    if (error || !item || !resource || adventureBlocked) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={Sparkles} size={44} />}
                    message={t('gallery.shared.unavailable')}
                    secondaryText={error ?? t('gallery.shared.unavailableBody')}
                    button={token && error ? { label: t('gallery.retry'), onClick: () => setRetryCount(value => value + 1) } : { label: t('sidebar.nav.community'), onClick: () => setPage('community') }}
                />
            </div>
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('gallery.shared.eyebrow')}
                title={item.title}
                subtitle={t('gallery.shared.subtitle')}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" iconLeft={<Icon icon={Link2} size={16} />} onClick={() => void copyCurrentLink()}>
                            {t('profile.sharing.copyLink')}
                        </Button>
                        {alreadyImported && existingCardId && (
                            <Button variant="secondary" onClick={() => importHook.openExisting(existingCardId, item.galleryType)}>
                                {t('gallery.preview.openExisting')}
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            iconLeft={
                                importing ? (
                                    <Icon icon={Loader2} size={16} className="animate-spin" />
                                ) : (
                                    <Icon icon={Import} size={16} />
                                )
                            }
                            disabled={importing}
                            onClick={importSharedCard}
                        >
                            {importing ? t('gallery.importing') : alreadyImported ? t('gallery.preview.importCopy') : t('gallery.import')}
                        </Button>
                    </div>
                }
                size="lg"
            />

            <Toast
                open={Boolean(importHook.actionNotice)}
                tone={importHook.actionNotice?.tone ?? 'success'}
                title={importHook.actionNotice?.title}
                message={importHook.actionNotice?.message}
                autoCloseMs={importHook.actionNotice?.tone === 'success' ? 3200 : false}
                onClose={() => importHook.setActionNotice(null)}
            />

            <div className="grid gap-5 md:grid-cols-[minmax(240px,360px)_1fr] md:items-start">
                <GalleryCard
                    id={item.id}
                    title={item.title}
                    badge={alreadyImported ? t('gallery.alreadyImported') : item.badge}
                    eyebrow={item.eyebrow}
                    description={item.description}
                    tags={item.tags}
                    imageUrl={item.imageUrl}
                    themeSongUrl={item.themeSongUrl}
                    cardType={playlistCardType(item.galleryType)}
                    cardId={item.id}
                    actionLabel={t('gallery.preview.previewAction', { title: item.title })}
                    onClick={() => preview.open(item)}

                />

                <section className="min-w-0 border-t border-line-faint pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-1" aria-label={t('gallery.shared.cardType')}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{t('gallery.shared.unlistedLink')}</Badge>
                            {resource.visibility?.public && <Badge tone="live">{t('gallery.shared.public')}</Badge>}
                        </div>
                        {item.originalCreatorName && (
                            <div>
                                <Eyebrow tone="muted" className="block">{t('gallery.shared.creator')}</Eyebrow>
                                <p className="mt-1 font-ui text-sm font-semibold text-parchment-100">{item.originalCreatorName}</p>
                            </div>
                        )}
                        <div>
                            <Eyebrow tone="muted" className="block">{t('gallery.shared.cardType')}</Eyebrow>
                            <p className="mt-1 font-ui text-sm font-semibold text-parchment-100">
                                {t(`gallery.type.${item.galleryType}.singular`)}
                            </p>
                        </div>

                    </div>
                </section>
            </div>

            <CardImportOverlays
                importHook={importHook}
                previewItem={preview.previewItem}
                onClosePreview={preview.close}
                toSource={importSource}
            />
        </div>
    )
}
