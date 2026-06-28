import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Import, Link2, Loader2, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { SharedCardResource } from '@/shared'
import { GalleryCard } from '@/ui/components'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { Badge, Button, Card, Icon, PageHeader, Toast } from '@/ui/primitives'
import { publicItems, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildSharedCardUrl, parseSharedCardToken } from '../galleryLinks'
import { useCardImport, useGalleryCardPreview, type ImportSource } from '../hooks/useCardImport'
import { CardImportOverlays } from './CardImportOverlays'

function playlistCardType(type: GalleryType) {
    return type === 'adventure' ? 'adventure_template' : type === 'persona' ? 'character' : type
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

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

export function SharedCardPage() {
    const { t } = useTranslation()
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
    }, [t, token])

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

    if (error || !item || !resource) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={Sparkles} size={44} />}
                    message={t('gallery.shared.unavailable')}
                    secondaryText={error ?? t('gallery.shared.unavailableBody')}
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
                    footer={
                        <Button
                            variant={alreadyImported ? 'secondary' : 'primary'}
                            size="sm"
                            full
                            iconLeft={
                                importing ? (
                                    <Icon icon={Loader2} size={15} className="animate-spin" />
                                ) : (
                                    <Icon icon={Import} size={15} />
                                )
                            }
                            disabled={importing}
                            onClick={importSharedCard}
                        >
                            {importing ? t('gallery.importing') : alreadyImported ? t('gallery.preview.importCopy') : t('gallery.importCard')}
                        </Button>
                    }
                />

                <Card className="p-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{t('gallery.shared.unlistedLink')}</Badge>
                            {resource.visibility?.public && <Badge tone="live">{t('gallery.shared.public')}</Badge>}
                        </div>
                        {item.originalCreatorName && (
                            <div>
                                <p className="font-ui text-[12px] uppercase tracking-[0.14em] text-parchment-400">{t('gallery.shared.creator')}</p>
                                <p className="mt-1 font-ui text-sm font-semibold text-parchment-100">{item.originalCreatorName}</p>
                            </div>
                        )}
                        <div>
                            <p className="font-ui text-[12px] uppercase tracking-[0.14em] text-parchment-400">{t('gallery.shared.cardType')}</p>
                            <p className="mt-1 font-ui text-sm font-semibold text-parchment-100">
                                {t(`gallery.type.${item.galleryType}.singular`)}
                            </p>
                        </div>
                        <div className="border-t border-parchment-50/[.08] pt-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                iconLeft={<Icon icon={Link2} size={15} />}
                                onClick={() => void copyCurrentLink()}
                            >
                                {t('gallery.copyUnlistedLink')}
                            </Button>
                        </div>
                    </div>
                </Card>
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
