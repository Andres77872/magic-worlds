/**
 * Copy to workspace (document 08 "Copy drawer", document 15 copy contract).
 *
 * Shows the origin and destination, asks for the destination first and then
 * loads its collections (optional targets), and summarizes what a copy
 * includes. A copy is all-or-nothing: while it runs the drawer shows progress
 * and refuses resubmission; any error says plainly that nothing was copied.
 *
 * Request IDs: one is minted when a given selection + destination + collection
 * set is submitted; Try again after an error or an uncertain response reuses
 * it (a copy that did land comes back as the same result, not a duplicate).
 * Changing any input, or Copy again after success, mints a new one.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle2, Copy, Folder, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { ApiError, apiService, isWorkspaceApiError } from '@/infrastructure/api'
import { MAX_COPY_CARDS } from '@/infrastructure/api/workspaceContract'
import type { Collection, CopyOutcome, Workspace, WorkspaceCardType } from '@/shared/types'
import { Button, Callout, Drawer, Eyebrow, Field, Icon, Select, SelectionCheck, cx } from '@/ui/primitives'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card/cardStyles'
import { makeRequestId } from '@/utils/uuid'

export interface CopyCardRef {
    cardType: WorkspaceCardType
    cardId: string
    title: string
}

export type CopyErrorKey = 'archived' | 'collectionMissing' | 'notFound' | 'limit' | 'conflict' | 'generic' | 'network'

export function copyErrorKey(error: unknown): CopyErrorKey {
    if (isWorkspaceApiError(error, 'WORKSPACE_ARCHIVED')) return 'archived'
    if (isWorkspaceApiError(error, 'COLLECTION_NOT_FOUND')) return 'collectionMissing'
    if (isWorkspaceApiError(error, 'CONTENT_NOT_FOUND') || isWorkspaceApiError(error, 'WORKSPACE_NOT_FOUND')) return 'notFound'
    if (isWorkspaceApiError(error, 'COPY_LIMIT_EXCEEDED') || isWorkspaceApiError(error, 'WORKSPACE_REQUEST_LIMIT_EXCEEDED')) return 'limit'
    if (isWorkspaceApiError(error, 'COPY_REQUEST_CONFLICT')) return 'conflict'
    if (error instanceof ApiError) return error.status >= 500 || error.status === 408 ? 'network' : 'generic'
    // No response at all (dropped connection, timeout): the outcome is uncertain.
    return 'network'
}

interface CopyAttempt {
    requestId: string
    signature: string
    /** True until the attempt succeeded or its ID was refused. */
    reusable: boolean
}

/** The request ID for a submission: reuse the last one only for an unchanged retry. */
export function copyRequestIdFor(previous: CopyAttempt | null, signature: string, mint: () => string = () => makeRequestId('copy')): string {
    return previous && previous.reusable && previous.signature === signature ? previous.requestId : mint()
}

function signatureOf(destinationId: string, cards: readonly CopyCardRef[], collectionIds: Iterable<string>): string {
    return JSON.stringify([
        destinationId,
        cards.map((card) => `${card.cardType}:${card.cardId}`).sort(),
        [...collectionIds].sort(),
    ])
}

type CollectionsState =
    | { destinationId: null }
    | { destinationId: string; status: 'loading' | 'error' }
    | { destinationId: string; status: 'ready'; items: readonly Collection[] }

interface CopyToWorkspaceDrawerProps {
    open: boolean
    onClose: () => void
    source: Pick<Workspace, 'id' | 'name'>
    cards: readonly CopyCardRef[]
    /** Candidate destinations: active workspaces other than the source. */
    destinations: readonly Workspace[]
    onViewCopies: (destination: Workspace, outcome: CopyOutcome) => void
}

export function CopyToWorkspaceDrawer({ open, onClose, source, cards, destinations, onViewCopies }: CopyToWorkspaceDrawerProps) {
    const { t } = useTranslation()
    const [destinationId, setDestinationId] = useState<string | null>(null)
    const [collections, setCollections] = useState<CollectionsState>({ destinationId: null })
    const [selectedCollections, setSelectedCollections] = useState<ReadonlySet<string>>(new Set())
    const [phase, setPhase] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle')
    const [errorKey, setErrorKey] = useState<CopyErrorKey | null>(null)
    const [outcome, setOutcome] = useState<CopyOutcome | null>(null)
    // The last submitted attempt (state, not a ref: it resets with the drawer during render).
    const [attempt, setAttempt] = useState<CopyAttempt | null>(null)
    const [reloadToken, setReloadToken] = useState(0)

    // A fresh drawer for every opening.
    const [wasOpen, setWasOpen] = useState(open)
    if (wasOpen !== open) {
        setWasOpen(open)
        if (open) {
            setDestinationId(null)
            setCollections({ destinationId: null })
            setSelectedCollections(new Set())
            setPhase('idle')
            setErrorKey(null)
            setOutcome(null)
            setAttempt(null)
        }
    }

    const destination = destinations.find((workspace) => workspace.id === destinationId) ?? null
    const overLimit = cards.length > MAX_COPY_CARDS
    const hasCharacters = cards.some((card) => card.cardType === 'character')

    useEffect(() => {
        if (!open || !destinationId) return
        let cancelled = false
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollections({ destinationId, status: 'loading' })
        apiService.listCollections(destinationId)
            .then((list) => {
                if (cancelled) return
                setCollections({ destinationId, status: 'ready', items: list.items })
                // Drop selections the destination no longer has.
                setSelectedCollections((current) => {
                    const valid = new Set(list.items.map((item) => item.id))
                    const next = new Set([...current].filter((id) => valid.has(id)))
                    return next.size === current.size ? current : next
                })
            })
            .catch(() => {
                if (!cancelled) setCollections({ destinationId, status: 'error' })
            })
        return () => {
            cancelled = true
        }
    }, [destinationId, open, reloadToken])

    const collectionsReady = collections.destinationId === destinationId && collections.destinationId !== null
        && 'status' in collections && collections.status === 'ready'
    const collectionItems = collectionsReady && 'items' in collections ? collections.items : []
    const submitting = phase === 'submitting'
    const canSubmit = Boolean(destination) && collectionsReady && !overLimit && cards.length > 0 && !submitting && phase !== 'success'

    const choose = (id: string) => {
        if (submitting || id === destinationId) return
        setDestinationId(id)
        setSelectedCollections(new Set())
        setPhase('idle')
        setErrorKey(null)
    }

    const toggleCollection = (id: string) => {
        if (submitting) return
        setSelectedCollections((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
        if (phase === 'error') setPhase('idle')
    }

    const submit = async () => {
        if (!canSubmit || !destination) return
        const signature = signatureOf(destination.id, cards, selectedCollections)
        const requestId = copyRequestIdFor(attempt, signature)
        setAttempt({ requestId, signature, reusable: true })
        setPhase('submitting')
        setErrorKey(null)
        try {
            const result = await apiService.copyCardsToWorkspace(destination.id, {
                request_id: requestId,
                source_workspace_id: source.id,
                cards: cards.map((card) => ({ card_type: card.cardType, card_id: card.cardId })),
                destination_collection_ids: [...selectedCollections],
            })
            setAttempt({ requestId, signature, reusable: false })
            setOutcome(result)
            setPhase('success')
        } catch (error) {
            const key = copyErrorKey(error)
            // A refused ID can't be retried; anything else (incl. uncertain) retries with the same one.
            if (key === 'conflict') setAttempt(null)
            if (key === 'collectionMissing') setReloadToken((token) => token + 1)
            setErrorKey(key)
            setPhase('error')
        }
    }

    const copyAgain = () => {
        setAttempt(null)
        setOutcome(null)
        setPhase('idle')
    }

    const destinationOptions = useMemo(
        () => destinations.map((workspace) => ({ value: workspace.id, label: workspace.name })),
        [destinations],
    )

    const footer = phase === 'success' && destination && outcome ? (
        <>
            <Button variant="ghost" onClick={onClose}>{t('library.copy.close')}</Button>
            <Button variant="secondary" onClick={copyAgain}>{t('library.copy.copyAgain')}</Button>
            <Button variant="primary" iconRight={<ArrowRight size={15} />} onClick={() => onViewCopies(destination, outcome)}>
                {t('library.copy.viewCopies')}
            </Button>
        </>
    ) : (
        <>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
            <Button
                variant="primary"
                iconLeft={submitting ? <Icon icon={Loader2} size={15} className="animate-spin motion-reduce:animate-none" /> : <Icon icon={Copy} size={15} />}
                disabled={!canSubmit}
                onClick={() => void submit()}
            >
                {submitting
                    ? t('library.copy.submitting')
                    : phase === 'error' ? t('library.copy.tryAgain') : t('library.copy.submit', { count: cards.length })}
            </Button>
        </>
    )

    return (
        <Drawer
            open={open}
            onClose={submitting ? () => {} : onClose}
            title={t('library.copy.title')}
            eyebrow={t('library.copy.eyebrow')}
            icon={<Icon icon={Copy} size={20} className="text-ember-400" />}
            size="lg"
            footer={<div className="flex flex-wrap justify-end gap-2">{footer}</div>}
        >
            <div className="flex flex-col gap-5" aria-busy={submitting || undefined}>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-raised/40 px-4 py-3 font-ui text-sm">
                    <span className="text-fg-muted">{t('library.copy.from')}</span>
                    <span className="truncate font-semibold text-fg">
                        {source.name} · {t('library.copy.cards', { count: cards.length })}
                    </span>
                    <span className="text-fg-muted">{t('library.copy.to')}</span>
                    <span className="truncate font-semibold text-fg">{destination?.name ?? '—'}</span>
                </div>

                {overLimit && (
                    <Callout tone="warning" role="alert" icon={<Icon icon={TriangleAlert} size={16} />}>
                        {t('library.copy.limit', { max: MAX_COPY_CARDS, extra: cards.length - MAX_COPY_CARDS })}
                    </Callout>
                )}

                {destinations.length === 0 ? (
                    <Callout tone="info">{t('library.copy.noDestinations')}</Callout>
                ) : (
                    <Field label={t('library.copy.destination')}>
                        <Select
                            options={destinationOptions}
                            value={destinationId}
                            onChange={choose}
                            placeholder={t('library.copy.destinationPlaceholder')}
                            disabled={submitting || phase === 'success'}
                        />
                    </Field>
                )}

                {destination && (
                    <section className="flex flex-col gap-2" aria-labelledby="copy-collections-label">
                        <div>
                            <p id="copy-collections-label" className="font-ui text-label font-semibold text-fg">{t('library.copy.collections')}</p>
                            <p className="font-ui text-caption text-fg-muted">{t('library.copy.collectionsHelper')}</p>
                        </div>
                        {'status' in collections && collections.status === 'loading' && (
                            <p role="status" className="flex items-center gap-2 font-ui text-sm text-fg-muted">
                                <Icon icon={Loader2} size={15} className="animate-spin motion-reduce:animate-none" />
                                {t('library.copy.collectionsLoading')}
                            </p>
                        )}
                        {'status' in collections && collections.status === 'error' && (
                            <Callout
                                tone="danger"
                                role="alert"
                                action={
                                    <Button size="sm" variant="secondary" iconLeft={<RefreshCw size={14} />} onClick={() => setReloadToken((token) => token + 1)}>
                                        {t('library.copy.collectionsRetry')}
                                    </Button>
                                }
                            >
                                {t('library.copy.collectionsError')}
                            </Callout>
                        )}
                        {collectionsReady && collectionItems.length === 0 && (
                            <p className="font-ui text-sm text-fg-muted">{t('library.copy.collectionsEmpty')}</p>
                        )}
                        {collectionsReady && collectionItems.length > 0 && (
                            <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                                {collectionItems.map((collection) => {
                                    const isSelected = selectedCollections.has(collection.id)
                                    return (
                                        <li key={collection.id}>
                                            <button
                                                type="button"
                                                aria-pressed={isSelected}
                                                disabled={submitting || phase === 'success'}
                                                onClick={() => toggleCollection(collection.id)}
                                                className={cx(
                                                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left font-ui text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 disabled:opacity-60',
                                                    isSelected ? SELECTED_CARD_CLASS : 'border-line hover:border-line-strong',
                                                )}
                                            >
                                                <Icon icon={Folder} size={15} className="shrink-0 text-ember-400" />
                                                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{collection.name}</span>
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                                    <SelectionCheck selected={isSelected} />
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                )}

                <section className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3">
                    <Eyebrow tone="muted">{t('library.copy.summaryTitle')}</Eyebrow>
                    <ul className="flex list-disc flex-col gap-1 pl-4 font-ui text-sm text-fg-muted">
                        <li>{t('library.copy.summaryPublished')}</li>
                        <li>{t('library.copy.summaryLorebooks')}</li>
                        <li>{t('library.copy.summaryIndependent')}</li>
                        {hasCharacters && <li>{t('library.copy.summaryPersona')}</li>}
                    </ul>
                </section>

                <div aria-live="polite" className="flex flex-col gap-2">
                    {submitting && (
                        <Callout tone="info" role="status" icon={<Icon icon={Loader2} size={16} className="animate-spin motion-reduce:animate-none" />}>
                            {t('library.copy.progress')}
                        </Callout>
                    )}
                    {phase === 'error' && errorKey && (
                        <Callout tone="danger" role="alert" icon={<Icon icon={TriangleAlert} size={16} />}>
                            <p className="font-semibold text-parchment-50">{t('library.copy.errorTitle')}</p>
                            <p className="mt-0.5">{t(`library.copy.errors.${errorKey}`)}</p>
                        </Callout>
                    )}
                    {phase === 'success' && destination && outcome && (
                        <Callout tone="success" role="status" icon={<Icon icon={CheckCircle2} size={16} />}>
                            <p className="font-semibold text-parchment-50">{t('library.copy.successTitle', { name: destination.name })}</p>
                            <p className="mt-0.5">{t('library.copy.successBody', { count: outcome.result.cards.length })}</p>
                        </Callout>
                    )}
                </div>
            </div>
        </Drawer>
    )
}
