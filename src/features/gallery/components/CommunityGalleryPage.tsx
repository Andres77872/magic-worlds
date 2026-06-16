import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Gem, Globe, Import, Loader2, RefreshCw, Sparkles, Swords, UserCircle, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { CardGrid, GalleryCard, GalleryCardSkeleton } from '@/ui/components'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { Button, Icon, PageHeader, SectionHeader, Toast } from '@/ui/primitives'
import { buildGalleryViewHash, galleryPageForType } from '../galleryLinks'
import { publicConfigFor, type GalleryItem, type GalleryType } from '../galleryConfig'
import { useCardGallery } from '../hooks/useCardGallery'
import { useCardImport, useGalleryCardPreview } from '../hooks/useCardImport'
import { CardImportOverlays } from './CardImportOverlays'

interface CommunitySectionMeta {
    type: GalleryType
    icon: LucideIcon
}

const COMMUNITY_SECTIONS: CommunitySectionMeta[] = [
    { type: 'character', icon: Users },
    { type: 'persona', icon: UserCircle },
    { type: 'world', icon: Globe },
    { type: 'item', icon: Gem },
    { type: 'adventure', icon: Swords },
]

function playlistCardType(type: GalleryType) {
    return type === 'adventure' ? 'adventure_template' : type === 'persona' ? 'character' : type
}

export function CommunityGalleryPage() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const importHook = useCardImport()
    const preview = useGalleryCardPreview()

    if (!isAuthenticated) {
        return (
            <div className="mx-auto flex w-full max-w-[960px] px-5 py-10 sm:px-8">
                <EmptyState
                    icon={<Icon icon={Sparkles} size={44} />}
                    message={t('gallery.communitySignedOutTitle')}
                    secondaryText={t('gallery.communitySignedOutBody')}
                    button={{ label: t('sidebar.login'), onClick: openLoginModal }}
                />
            </div>
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={t('gallery.community')}
                title={t('gallery.communityTitle')}
                subtitle={t('gallery.communitySubtitle')}
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

            <div className="flex flex-col gap-9">
                {COMMUNITY_SECTIONS.map((section) => (
                    <CommunityGallerySection
                        key={section.type}
                        section={section}
                        importingKey={importHook.importingKey}
                        onImport={(item) => void importHook.requestImport({ kind: 'clone', item })}
                        onPreview={preview.open}
                    />
                ))}
            </div>

            <CardImportOverlays
                importHook={importHook}
                previewItem={preview.previewItem}
                onClosePreview={preview.close}
            />
        </div>
    )
}

function CommunityGallerySection({
    section,
    importingKey,
    onImport,
    onPreview,
}: {
    section: CommunitySectionMeta
    importingKey: string | null
    onImport: (item: GalleryItem) => void
    onPreview: (item: GalleryItem) => void
}) {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const config = useMemo(() => publicConfigFor(section.type), [section.type])
    const gallery = useCardGallery(config, 10)
    const openFullGallery = () => {
        setPage(galleryPageForType(section.type), {
            hash: buildGalleryViewHash(section.type, 'public'),
        })
    }
    const sectionLabel = t(`gallery.type.${section.type}.title`)

    return (
        <section className="flex flex-col gap-3" aria-labelledby={`community-${section.type}`}>
            <SectionHeader
                icon={section.icon}
                title={<span id={`community-${section.type}`}>{sectionLabel}</span>}
                right={
                    <div className="flex items-center gap-2">
                        {gallery.error && (
                            <Button
                                kind="ghost"
                                size="sm"
                                iconLeft={<Icon icon={RefreshCw} size={14} />}
                                onClick={gallery.refresh}
                            >
                                {t('gallery.retry')}
                            </Button>
                        )}
                        <Button kind="secondary" size="sm" onClick={openFullGallery}>
                            {t('gallery.viewAll')}
                        </Button>
                    </div>
                }
            />
            <CardGrid
                items={gallery.items}
                layout="rail"
                fadeEdges
                loading={gallery.loading}
                loadingComponent={<GalleryCardSkeleton />}
                showEmptyState={!gallery.loading}
                emptyStateTitle={t(`gallery.type.${section.type}.publicEmptyTitle`)}
                emptyStateDescription={t('gallery.publicEmptyDescription')}
                getItemKey={(item) => item.id}
                data-testid={`community-gallery-${section.type}`}
                renderCard={(item) => {
                    const key = `${item.backendType}:${item.id}`
                    const importing = importingKey === key
                    const alreadyImported = Boolean(item.resource?.already_imported)
                    return (
                        <GalleryCard
                            id={item.id}
                            title={item.title}
                            badge={alreadyImported ? t('gallery.alreadyImported') : item.badge ?? item.originalCreatorName ?? undefined}
                            eyebrow={item.eyebrow}
                            description={item.description}
                            tags={item.tags}
                            imageUrl={item.imageUrl}
                            themeSongUrl={item.themeSongUrl}
                            cardType={playlistCardType(item.galleryType)}
                            cardId={item.id}
                            onClick={() => onPreview(item)}
                            actionLabel={t('gallery.preview.previewAction', { title: item.title })}
                            footer={
                                <Button
                                    kind={alreadyImported ? 'secondary' : 'primary'}
                                    size="sm"
                                    full
                                    iconLeft={
                                        importing ? (
                                            <Icon icon={Loader2} size={15} className="animate-spin" />
                                        ) : (
                                            <Icon icon={Import} size={15} />
                                        )
                                    }
                                    disabled={importingKey !== null}
                                    onClick={() => onImport(item)}
                                >
                                    {importing
                                        ? t('gallery.importing')
                                        : alreadyImported
                                          ? t('gallery.preview.importCopy')
                                          : t('gallery.import')}
                                </Button>
                            }
                        />
                    )
                }}
            />
        </section>
    )
}
