import { FilePlus2, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LorebookResource } from '@/shared'
import { Button, Card, Icon } from '@/ui/primitives'
import { ResourceCard } from './ResourceCard'

interface ResourceGridProps {
    items: LorebookResource[]
    loading: boolean
    hasMore: boolean
    loadingMore: boolean
    deletingId: string | null
    hasQuery: boolean
    onLoadMore: () => void
    onClearSearch: () => void
    onCreate: () => void
    onOpen: (resource: LorebookResource) => void
    onDelete: (resource: LorebookResource) => void
}

/** List branch of the resources page: loading / empty / responsive card grid + Load more. */
export function ResourceGrid({
    items,
    loading,
    hasMore,
    loadingMore,
    deletingId,
    hasQuery,
    onLoadMore,
    onClearSearch,
    onCreate,
    onOpen,
    onDelete,
}: ResourceGridProps) {
    const { t } = useTranslation()

    if (loading) {
        return (
            <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="animate-spin text-ember-500" size={26} aria-hidden="true" />
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <Card className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
                <Icon icon={Plus} size={32} className="text-arcane-300" />
                <div className="grid gap-1">
                    <h2 className="font-display text-h3 font-semibold text-parchment-50">
                        {hasQuery ? t('lorebookResourcesGallery.empty.noMatchTitle') : t('lorebookResourcesGallery.empty.noItemsTitle')}
                    </h2>
                    <p className="m-0 max-w-[44ch] font-narrative text-sm text-parchment-300">
                        {hasQuery ? t('lorebookResourcesGallery.empty.noMatchDescription') : t('lorebookResourcesGallery.empty.noItemsDescription')}
                    </p>
                </div>
                {hasQuery ? (
                    <Button variant="secondary" size="sm" onClick={onClearSearch}>{t('lorebookResourcesGallery.actions.clearSearch')}</Button>
                ) : (
                    <Button variant="primary" size="sm" iconLeft={<Icon icon={FilePlus2} size={16} />} onClick={onCreate}>
                        {t('lorebookResourcesGallery.actions.newText')}
                    </Button>
                )}
            </Card>
        )
    }

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((resource) => (
                    <ResourceCard
                        key={resource.id}
                        resource={resource}
                        deleting={deletingId === resource.id}
                        onOpen={() => onOpen(resource)}
                        onDelete={() => onDelete(resource)}
                    />
                ))}
            </div>
            {hasMore && (
                <Button variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
                    {loadingMore ? t('common.loading') : t('lorebookResourcesGallery.actions.loadMore')}
                </Button>
            )}
        </>
    )
}
