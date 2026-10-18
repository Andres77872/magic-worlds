/**
 * NovelGalleryPage — full-page, server-searched library of the user's novels.
 * A structural twin of the card GalleryPage: masthead search (debounced
 * server query over title/description/chapter text), skip/limit infinite
 * scroll, image-forward GalleryCard grid, and DataProvider-backed actions.
 *
 * Workspace R1: lists the committed workspace's stories. A committed switch
 * remounts the view — list from offset 0, closed dialogs, cleared search — and
 * an open/create that completes after the switch does not navigate. While that
 * workspace is archived the library is read-only: novels open, read and search
 * as usual, while New and Delete are disabled (the app shell's archived banner
 * says why; a blocked attempt repeats it).
 */

import { useMemo, useState,useRef,useLayoutEffect, type ReactNode } from 'react'
import { BookOpenText, Copy, FileUp, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { StoryCreateRequest,StoryLibraryFilters } from '@/shared'
import { canonicalJson } from '@/utils/json'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY, useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { CardGrid, GalleryCard, GalleryCardSkeleton, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Callout, controlClass, Icon, IconButton, PageHeader, Toast,Select } from '@/ui/primitives'
import { getNovelGalleryConfig, type NovelGalleryItem } from '../novelGalleryConfig'
import { useCardGallery } from '@/features/gallery/hooks/useCardGallery'
import { useGalleryView } from '@/features/gallery/hooks/useGalleryView'
import { cardGridDensity, cardGridLayout, galleryCardView } from '@/features/gallery/galleryView'
import { GalleryViewToggle } from '@/features/gallery/components/GalleryViewToggle'
import { NovelCreateDialog as NovelCreateModal } from './NovelCreateDialog'
import { NovelImportDialog } from './NovelImportDialog'
import { NovelPendingLifecycle } from './NovelPendingLifecycle'
import { NovelPendingCreations } from './NovelPendingCreations'
import { NovelCopyModal } from './NovelCopyModal'
import { NovelPendingCopies } from './NovelPendingCopies'
import { useNovelCopies } from '../hooks/useNovelCopies'
import { NovelLibraryFilters } from './NovelLibraryFilters'
import { useNovelErases } from '../hooks/useNovelErases'
import { NovelEraseModal } from './NovelEraseModal'
import { NovelPendingErases } from './NovelPendingErases'
import { useNovelLifecycleRetention } from '../hooks/useNovelLifecycleRetention'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'

interface ActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

export function NovelGalleryPage() {
    const { workspaceEpoch } = useWorkspace()
    return <NovelGalleryScope key={workspaceEpoch} />
}

function NovelGalleryScope(){
    const [trashed,setTrashed]=useState(false)
    const [filters,setFilters]=useState<StoryLibraryFilters>({})
    return <NovelGalleryView key={String(trashed)} trashed={trashed} setTrashed={setTrashed} filters={filters} setFilters={(next)=>setFilters((current)=>canonicalJson(current)===canonicalJson(next)?current:next)}/>
}
function NovelGalleryView({trashed,setTrashed,filters,setFilters}:{trashed:boolean;setTrashed:(value:boolean)=>void;filters:StoryLibraryFilters;setFilters:(value:StoryLibraryFilters)=>void}) {
    const { t } = useTranslation()
    const { api,capture,isCurrent:workspaceCurrent }=useWorkspace()
    const mounted=useRef(true)
    useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
    const isCurrent=(scope:Parameters<typeof workspaceCurrent>[0])=>mounted.current&&workspaceCurrent(scope)
    const galleryConfig = useMemo(() => getNovelGalleryConfig(t, api,trashed,filters), [api, t,trashed,filters])
    const { setPage } = useNavigation()
    const auth = useAuth(), { isAuthenticated, openLoginModal } = auth
    const gallery = useCardGallery<NovelGalleryItem>(galleryConfig, undefined, { enabled: isAuthenticated && api !== null,resetKey:canonicalJson(filters) })
    const observedScope = capture(), observedStories = useMemo(() => gallery.items.map((item) => item.source), [gallery.items])
    const retainedLifecycle = useNovelLifecycleRetention({
        key: JSON.stringify([auth.accountKey, auth.authEpoch, observedScope]),
        scope: isAuthenticated && auth.userHash && observedScope?.workspaceId ? { apiOrigin: apiStorageOrigin(API_BASE_URL), userHash: auth.userHash, workspaceId: observedScope.workspaceId } : null,
        current: () => isCurrent(observedScope),
    }, observedStories, null)
    const [layoutView, setLayoutView] = useGalleryView()
    const { createStory,openStory,deleteStory,storyLifecycle,novelCreations,forgetErasedStory,pendingStoryLifecycle }=useData()
    const readOnly = useWorkspaceReadOnly()
    const copies=useNovelCopies(readOnly)
    const [copySource,setCopySource]=useState<{id:string;title:string}|null>(null)
    const [eraseSource,setEraseSource]=useState<{id:string;title:string}|null>(null)
    const searchRef=useRef<HTMLInputElement>(null)
    const erases=useNovelErases(readOnly,(id)=>{forgetErasedStory(id);gallery.removeItem(id)})
    const eraseResolved=()=>{
        const scope=capture(),trigger=document.activeElement
        setEraseSource(null);gallery.refresh()
        requestAnimationFrame(()=>{if(isCurrent(scope)&&(document.activeElement===trigger||document.activeElement===document.body))searchRef.current?.focus()})
    }


    const [createOpen, setCreateOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [openingId, setOpeningId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<NovelGalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    /** A write: refused with the archived message while the workspace is archived. */
    const requireWritable = (action: () => void) => {
        if (readOnly) {
            setActionNotice({ tone: 'error', title: t(ARCHIVED_WORKSPACE_MESSAGE_KEY) })
            return
        }
        requireAuth(action)
    }

    const openNovel = (item: Pick<NovelGalleryItem, 'id'>) => {
        requireAuth(() => {
            if (openingId) return
            const scope = capture()
            setOpeningId(item.id)
            openStory({ id: item.id })
                .then(() => {
                    if (isCurrent(scope)) setPage('story')
                })
                .catch((error) => {
                    console.error('Failed to open novel:', error)
                    if (!isCurrent(scope)) return
                    setActionNotice({ tone: 'error', title: t('novelGallery.notice.openFailed'), message: t('novelGallery.notice.tryAgain') })
                })
                .finally(() => {
                    if (isCurrent(scope)) setOpeningId(null)
                })
        })
    }

    const handleCreate = async (request: StoryCreateRequest) => {
        if (readOnly) return
        const scope = capture()
        setCreating(true)
        try {
            await createStory(request)
            if (!isCurrent(scope)) return
            setCreateOpen(false)
            setPage('story')
        } catch (error) {
            console.error('Failed to create novel:', error)
            if (!isCurrent(scope)) return
            setActionNotice({ tone: 'error', title: t('novelGallery.notice.createFailed'), message: t('novelGallery.notice.tryAgain') })
            throw error
        } finally {
            if (isCurrent(scope)) setCreating(false)
        }
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target || readOnly) return
        const scope = capture()
        setDeletingId(target.id)
        try {
            await deleteStory(target.id)
            if (isCurrent(scope)) gallery.removeItem(target.id)
        } catch (error) {
            console.error('Failed to delete novel:', error)
            if (isCurrent(scope)) setActionNotice({ tone: 'error', title: t('novelGallery.notice.deleteFailed'), message: t('novelGallery.notice.tryAgain') })
        } finally {
            if (isCurrent(scope)) setDeletingId(null)
        }
    }

    const restoreNovel=async(item:NovelGalleryItem)=>{
        if(readOnly)return
        const owner=capture()
        setDeletingId(item.id)
        try{await storyLifecycle(item.id,'restore');if(isCurrent(owner))gallery.removeItem(item.id)}
        catch{if(isCurrent(owner))setActionNotice({tone:'error',title:t('novelEditor.structure.failed')})}
        finally{if(isCurrent(owner))setDeletingId(null)}
    }
    const optionsFor = (item: NovelGalleryItem): CardOption[] => [
        {
            type: 'custom',
            icon: <Icon icon={BookOpenText} size={15} />,
            label: t('novelGallery.actions.open'),
            onClick: () => openNovel(item),
        },
        {
            type:'custom',icon:<Icon icon={Copy} size={15}/>,label:t('novelEditor.copyNovel.title'),
            onClick:()=>requireWritable(()=>setCopySource({id:item.id,title:item.title})),disabled:readOnly||copies.hasPending(item.id)||erases.hasPending(item.id),
        },
        {
            type: 'custom',
            icon: <Icon icon={Trash2} size={15} />,
            label: trashed?t('novelEditor.structure.restore'):t('novelEditor.structure.trash'),
            onClick: () => requireWritable(() => {if(trashed)void restoreNovel(item);else setPendingDelete(item)}),
            disabled: readOnly||erases.hasPending(item.id),
            danger: !trashed,
        },
        ...(trashed?[{
            type:'custom' as const,icon:<Icon icon={Trash2} size={15}/>,label:t('novelEditor.erasure.action'),danger:true,
            onClick:()=>requireWritable(()=>setEraseSource({id:item.id,title:item.title})),
            disabled:readOnly||!forgetErasedStory||erases.hasPending(item.id)||copies.hasPending(item.id)||Boolean(pendingStoryLifecycle?.some((record)=>record.storyId===item.id)),
        }]:[]),
    ]

    const hasQuery = gallery.query.trim().length > 0
    const hasFilters=Object.keys(filters).length>0
    const searchLabel=filters.searchIn&&filters.searchIn!=='all'?t('novelEditor.library.search.'+filters.searchIn):galleryConfig.searchPlaceholder

    const emptyAction: ReactNode = hasQuery||hasFilters ? (
        <Button variant="secondary" size="sm" onClick={() => {gallery.setQuery('');setFilters({})}}>
            {hasFilters?t('novelEditor.library.reset'):t('novelGallery.actions.clearSearch')}
        </Button>
    ) : trashed?null:(
        <Button
            variant="primary"
            size="sm"
            iconLeft={<Icon icon={Plus} size={16} />}
            onClick={() => requireWritable(() => setCreateOpen(true))}
            disabled={readOnly}
        >
            {galleryConfig.createLabel}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow={galleryConfig.eyebrow}
                title={galleryConfig.title}
                size="lg"
                actions={
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
                        <div className="relative flex w-full items-center sm:w-[320px]">
                            <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                                <Icon icon={Search} size={16} />
                            </span>
                            <input
                                ref={searchRef}
                                type="search"
                                value={gallery.query}
                                onChange={(e) => gallery.setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') gallery.setQuery('')
                                }}
                                placeholder={searchLabel}
                                aria-label={searchLabel}
                                className={`${controlClass} rounded-full pl-10 ${gallery.searching && hasQuery ? 'pr-16' : 'pr-12'}`}
                                data-testid="gallery-search-input"
                            />
                            {gallery.searching && (
                                <Loader2
                                    className={`absolute ${hasQuery ? 'right-12' : 'right-4'} animate-spin text-ember-500`}
                                    size={16}
                                    aria-hidden="true"
                                    data-testid="gallery-search-spinner"
                                />
                            )}
                            {hasQuery && (
                                <IconButton
                                    size="sm"
                                    onClick={() => gallery.setQuery('')}
                                    label={t('novelGallery.actions.clearSearch')}
                                    className="absolute right-2"
                                    data-testid="gallery-search-clear"
                                >
                                    <Icon icon={X} size={16} />
                                </IconButton>
                            )}
                        </div>
                        <Select aria-label={t('novelEditor.structure.libraryView')} value={trashed?'trash':'library'} onChange={(value)=>setTrashed(value==='trash')} options={[
                            {value:'library',label:t('novelEditor.structure.library')},{value:'trash',label:t('novelEditor.library.trash')},
                        ]}/>
                        <GalleryViewToggle value={layoutView} onChange={setLayoutView} className="shrink-0" />
                        <NovelLibraryFilters value={filters} onChange={setFilters} disabled={!isAuthenticated||!api}/>
                        <Button
                            variant="secondary"
                            iconLeft={<Icon icon={FileUp} size={16} />}
                            onClick={() => requireWritable(() => setImportOpen(true))}
                            disabled={readOnly}
                            className="shrink-0"
                        >
                            {t('novelEditor.import.action')}
                        </Button>
                        <Button
                            variant="primary"
                            iconLeft={<Icon icon={Plus} size={16} />}
                            onClick={() => requireWritable(() => setCreateOpen(true))}
                            disabled={readOnly}
                            className="shrink-0"
                        >
                            {galleryConfig.createLabel}
                        </Button>
                    </div>
                }
            />

            <NovelPendingLifecycle readOnly={readOnly} onResolved={gallery.refresh}/>
            <NovelPendingCreations onResolved={gallery.refresh}/>
            <NovelPendingCopies copies={copies} onResolved={gallery.refresh}/>
            <NovelPendingErases key={erases.scopeKey} erases={erases} onResolved={eraseResolved}/>
            {gallery.error && (
                <div
                    className="flex items-center justify-between gap-4 rounded-lg border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200"
                    role="alert"
                >
                    <span>{gallery.error}</span>
                    <Button variant="secondary" size="sm" onClick={gallery.refresh}>
                        {t('novelGallery.actions.retry')}
                    </Button>
                </div>
            )}

            <Toast
                open={Boolean(actionNotice)}
                tone={actionNotice?.tone ?? 'success'}
                title={actionNotice?.title}
                message={actionNotice?.message}
                autoCloseMs={actionNotice?.tone === 'success' ? 3200 : false}
                onClose={() => setActionNotice(null)}
            />

            {retainedLifecycle.failed && <Callout tone="warning" role="status">{t('novelEditor.deviceCache.lifecycleRetentionFailed')}</Callout>}
            {(!gallery.error || gallery.items.length > 0) && <CardGrid
                items={gallery.items.filter((item)=>!erases.isErased(item.id))}
                layout={cardGridLayout(layoutView)}
                density={cardGridDensity(layoutView)}
                getItemKey={(item) => item.id}
                loading={gallery.loading}
                renderSkeleton={() => (
                    <GalleryCardSkeleton
                        view={galleryCardView(layoutView)}
                        size={cardGridDensity(layoutView) === 'compact' ? 'compact' : 'default'}
                    />
                )}
                hasMore={gallery.hasMore}
                loadingMore={gallery.loadingMore}
                onLoadMore={gallery.loadMore}
                emptyStateTitle={hasQuery||hasFilters?galleryConfig.noMatchTitle:trashed?t('novelEditor.structure.emptyTrash'):galleryConfig.emptyTitle}
                emptyStateDescription={hasQuery||hasFilters?galleryConfig.noMatchDescription:trashed?t('novelEditor.structure.trashHelp'):galleryConfig.emptyDescription}
                emptyStateAction={emptyAction}
                data-testid="gallery-grid-novel"
                renderCard={(item) => (
                    <GalleryCard
                        id={item.id}
                        view={galleryCardView(layoutView)}
                        title={item.title}
                        badge={item.badge}
                        tags={item.tags}
                        imageUrl={item.imageUrl}
                        deleting={deletingId === item.id}
                        onClick={() => openNovel(item)}
                        actionLabel={t('novelGallery.actions.openNamed', { title: item.title })}
                        options={optionsFor(item)}
                    />
                )}
            />}

            <ConfirmDialog
                visible={pendingDelete !== null && !readOnly}
                title={t('novelEditor.structure.trash')}
                message={pendingDelete ? pendingDelete.title+' · '+t('novelEditor.structure.lifecycleHelp') : ''}
                confirmLabel={t('novelEditor.structure.trash')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            <NovelCreateModal
                open={createOpen && !readOnly}
                creating={creating}
                onClose={() => setCreateOpen(false)}
                onCreate={handleCreate}
                blocked={novelCreations?.items.some((item)=>!item.write.ack&&!item.write.rejected)}
                recovery={<NovelPendingCreations onResolved={gallery.refresh}/>}
            />
            {importOpen&&!readOnly&&<NovelImportDialog open onClose={()=>setImportOpen(false)} onImported={(id)=>{
                setImportOpen(false);gallery.refresh()
                openNovel({id})
            }}/>}
            {eraseSource&&<NovelEraseModal key={eraseSource.id} source={eraseSource} erases={erases} onClose={()=>setEraseSource(null)} onErased={eraseResolved}/>}
            {copySource&&!readOnly&&<NovelCopyModal key={copySource.id} source={copySource} copies={copies} onClose={()=>setCopySource(null)} onCopied={gallery.refresh}/>}
        </div>
    )
}
