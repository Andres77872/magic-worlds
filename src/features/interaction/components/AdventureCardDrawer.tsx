/**
 * AdventureCardDrawer — view & edit a single cloned card (persona / cast / world)
 * for the current adventure. Opens from a compact card in the side panel.
 *
 * Editing writes ONLY to this adventure's snapshot copy via `onSave`; it never
 * calls the library card endpoints, so the original character/world is untouched.
 * The chat AI reads its context from the snapshot, so edits take effect next turn.
 */

import { startTransition, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Pencil, Trash2 } from 'lucide-react'
import type { CardUsage, SnapshotCard, VersionableCardType } from '../../../shared'
import {
    CUSTOM_WORLD_PLACE_TYPE,
    DEFAULT_WORLD_PLACE_TYPE,
    WORLD_PLACE_TYPE_OPTIONS,
    readWorldPlaceType,
    worldPlaceTypeLabel,
    worldPlaceTypeOptionValue,
} from '../../../shared'
import { useAuth } from '@/app/hooks'
import { Badge, Button, Chip, Drawer, Eyebrow, Icon, Portrait, Select, Tag } from '../../../ui/primitives'
import { apiService, ApiError, resolveMediaUrl } from '../../../infrastructure/api'
import type { AttributeCategory } from '../../../ui/components/common/AttributeList'
import {
    AttributeManager,
    CreatorField,
    CreatorInput,
    CreatorTextarea,
    MediaStudioSection,
    TriggersField,
} from '../../creation/common/components'
import { useAttributeCategories, toCategoryPayload } from '../../creation/common/hooks'
import type { SnapshotCardEntry, SnapshotCardRef } from '../utils/adventureSnapshot'

const FORM_ID = 'adventure-card-edit-form'

function characterDefaults(t: TFunction): AttributeCategory[] {
    return [
        { id: 'stats', name: t('interaction.cardDrawer.statsName'), type: 'stat', description: t('interaction.cardDrawer.statsDesc') },
    ]
}
function worldDefaults(t: TFunction): AttributeCategory[] {
    return [
        { id: 'details', name: t('interaction.cardDrawer.detailsName'), type: 'detail', description: t('interaction.cardDrawer.detailsDesc') },
    ]
}

function roleLabel(t: TFunction, ref: SnapshotCardRef): string {
    if (ref.kind === 'persona') return t('interaction.cardDrawer.rolePersona')
    if (ref.kind === 'world') return t('interaction.cardDrawer.roleWorld')
    return t('interaction.cardDrawer.roleCast')
}

/** Map a save failure to a user-facing message — special-casing the active-stream 409. */
function saveErrorMessage(t: TFunction, error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 409) {
            return t('interaction.cardDrawer.saveError409')
        }
        if (error.message) return error.message
    }
    return t('interaction.cardDrawer.saveErrorGeneric')
}

interface AdventureCardDrawerProps {
    open: boolean
    entry: SnapshotCardEntry | null
    onClose: () => void
    onSave: (ref: SnapshotCardRef, card: SnapshotCard) => Promise<void>
    /** Remove this card from the adventure (its own copy only). Omit to hide the action. */
    onRemove?: (ref: SnapshotCardRef) => Promise<void>
}

export function AdventureCardDrawer({ open, entry, onClose, onSave, onRemove }: AdventureCardDrawerProps) {
    const { t } = useTranslation()
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const cardKey = entry?.key ?? null

    // Reset to the read view + clear transient state only when switching to a
    // DIFFERENT card. Guarding `cardKey !== null` avoids stomping `mode` back to
    // 'view' when the drawer is merely closing (entry → null) or when the parent
    // re-renders with a fresh same-card entry object. Adjusting state during
    // render is the React-endorsed alternative to an effect.
    const [prevKey, setPrevKey] = useState(cardKey)
    if (cardKey !== null && cardKey !== prevKey) {
        setPrevKey(cardKey)
        setMode('view')
        setIsSubmitting(false)
        setRemoving(false)
        setSaveError(null)
    }

    const handleClose = () => {
        setMode('view')
        onClose()
    }

    const handleSubmit = async (ref: SnapshotCardRef, card: SnapshotCard) => {
        setIsSubmitting(true)
        setSaveError(null)
        try {
            await onSave(ref, card)
            setMode('view')
        } catch (error) {
            console.error('Failed to save adventure card:', error)
            setSaveError(saveErrorMessage(t, error))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemove = async () => {
        if (!entry || !onRemove) return
        setRemoving(true)
        try {
            await onRemove(entry.ref)
            handleClose()
        } catch (error) {
            console.error('Failed to remove adventure card:', error)
            setRemoving(false)
        }
    }

    const removeLabel = entry?.ref.kind === 'persona' ? t('interaction.cardDrawer.removePersona') : t('interaction.cardDrawer.remove')

    const footer = entry ? (
        mode === 'view' ? (
            <div className="flex w-full items-center justify-between gap-3">
                {onRemove ? (
                    <Button
                        variant="ghost"
                        iconLeft={<Icon icon={Trash2} size={16} />}
                        onClick={handleRemove}
                        disabled={removing}
                        className="text-blood-400 hover:text-blood-500"
                    >
                        {removing ? t('interaction.cardDrawer.removing') : removeLabel}
                    </Button>
                ) : (
                    <span />
                )}
                <Button
                    variant="primary"
                    iconLeft={<Icon icon={Pencil} size={16} />}
                    // Defer the view→edit swap out of this click. React 19 commits a
                    // click handler's state synchronously; swapping this button for the
                    // "Save changes" submit button mid-gesture lets the same click land
                    // on the new button and instantly submit the form (open+close + a
                    // stray PUT). A transition defers the swap until the click is done.
                    onClick={() => startTransition(() => setMode('edit'))}
                    className="shrink-0"
                >
                    {t('interaction.cardDrawer.editCard')}
                </Button>
            </div>
        ) : (
            <div className="flex w-full items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => startTransition(() => setMode('view'))} disabled={isSubmitting}>
                    {t('common.cancel')}
                </Button>
                <Button variant="primary" type="submit" form={FORM_ID} disabled={isSubmitting}>
                    {isSubmitting ? t('common.saving') : t('interaction.cardDrawer.saveChanges')}
                </Button>
            </div>
        )
    ) : undefined

    return (
        <Drawer
            open={open}
            onClose={handleClose}
            size="xl"
            eyebrow={
                entry ? (
                    <Eyebrow tone={entry.ref.kind === 'world' ? 'ember' : 'arcane'}>{roleLabel(t, entry.ref)}</Eyebrow>
                ) : undefined
            }
            footer={footer}
        >
            {entry &&
                (mode === 'view' ? (
                    <CardReadView entry={entry} />
                ) : (
                    // Keyed so the attribute hook re-hydrates when a different card is edited.
                    <CardEditForm key={entry.key} entry={entry} onSubmit={handleSubmit} error={saveError} />
                ))}
        </Drawer>
    )
}

/* ----------------------------- read view ----------------------------- */

function CardReadView({ entry }: { entry: SnapshotCardEntry }) {
    const { t } = useTranslation()
    const { card, ref } = entry
    const isWorld = ref.kind === 'world'

    // Usage + "newer version available" are informative reads keyed off the library card
    // this snapshot was cloned from. Only character/world live in adventure snapshots.
    const sourceCardId = typeof card.source_card_id === 'string' ? card.source_card_id : undefined
    const usageType: VersionableCardType | null = isWorld ? 'world' : ref.kind === 'character' || ref.kind === 'persona' ? 'character' : null
    const [usage, setUsage] = useState<CardUsage | null>(null)
    useEffect(() => {
        if (!sourceCardId || !usageType) {
            setUsage(null)
            return
        }
        let cancelled = false
        void apiService
            .getCardUsage(usageType, sourceCardId)
            .then((result) => {
                if (!cancelled) setUsage(result)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [sourceCardId, usageType])
    const badges = isWorld
        ? [worldPlaceTypeLabel(readWorldPlaceType(card)), card.type]
            .map((item) => item?.trim())
            .filter((item): item is string => Boolean(item))
        : [card.race]
            .map((item) => item?.trim())
            .filter((item): item is string => Boolean(item))
    const groups = (card.category ?? []).filter((g) => (g.attributes?.length ?? 0) > 0)
    const triggers = card.triggers ?? []
    const description = card.description?.trim()

    return (
        <div className="flex flex-col gap-6">
            {/* Hero banner — generated portrait (or gradient) with name + type overlaid. */}
            <Portrait name={card.name || ''} src={resolveMediaUrl(card.image_url)} height={180} className="rounded-xl">
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
                    <h3 className="font-display text-[26px] font-semibold leading-tight text-parchment-50">
                        {card.name || t('interaction.cardDrawer.untitled')}
                    </h3>
                    {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {badges.map((badge) => (
                                <Tag key={badge}>{badge}</Tag>
                            ))}
                        </div>
                    ) : (
                        <span className="font-narrative text-[13px] italic text-parchment-300">
                            {isWorld ? t('interaction.cardDrawer.noTypeSet') : t('interaction.cardDrawer.noRaceSet')}
                        </span>
                    )}
                </div>
            </Portrait>

            {/* Informative-only: a newer library version exists than the one cloned here. */}
            {card.newer_version_available && (
                <div className="flex items-center gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-2.5">
                    <Badge tone="ember">{t('cardVersions.newer.badge')}</Badge>
                    <p className="font-narrative text-[13px] leading-snug text-parchment-200">
                        {t('cardVersions.newer.notice')}
                    </p>
                </div>
            )}

            {usage && usage.sessions > 0 && (
                <p className="font-ui text-[12px] text-parchment-400">
                    {t('cardVersions.usage.sessions', { count: usage.sessions })}
                </p>
            )}

            <DetailSection title={isWorld ? t('interaction.cardDrawer.setting') : t('interaction.cardDrawer.about')}>
                {description ? (
                    <p className="whitespace-pre-line font-narrative text-[15px] leading-relaxed text-parchment-200">
                        {description}
                    </p>
                ) : (
                    <EmptyHint>{t('interaction.cardDrawer.noDescription')}</EmptyHint>
                )}
            </DetailSection>

            <DetailSection title={isWorld ? t('interaction.cardDrawer.details') : t('interaction.cardDrawer.attributes')}>
                {groups.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {groups.map((group, gi) => (
                            <AttributeGroup key={`${group.name}-${gi}`} name={group.name} attributes={group.attributes ?? []} />
                        ))}
                    </div>
                ) : (
                    <EmptyHint>{t('interaction.cardDrawer.noAttributes')}</EmptyHint>
                )}
            </DetailSection>

            <DetailSection title={t('interaction.cardDrawer.triggers')} hint={t('interaction.cardDrawer.triggersHint')}>
                {triggers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {triggers.map((trigger, i) => (
                            <Chip key={`${trigger}-${i}`} active disabled tabIndex={-1} className="pointer-events-none">
                                {trigger}
                            </Chip>
                        ))}
                    </div>
                ) : (
                    <EmptyHint>{t('interaction.cardDrawer.noTriggers')}</EmptyHint>
                )}
            </DetailSection>

            <p className="font-ui text-[12px] leading-snug text-parchment-500">
                {t('interaction.cardDrawer.ownCopyNote')}
            </p>
        </div>
    )
}

function DetailSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <Eyebrow tone="muted">{title}</Eyebrow>
            {children}
            {hint && <p className="font-ui text-[11px] leading-snug text-parchment-500">{hint}</p>}
        </section>
    )
}

function AttributeGroup({ name, attributes }: { name?: string; attributes: Array<Record<string, string>> }) {
    return (
        <div className="flex flex-col gap-1.5">
            {name && (
                <span className="font-ui text-[12px] font-semibold uppercase tracking-[0.08em] text-parchment-300">{name}</span>
            )}
            <div className="overflow-hidden rounded-lg border border-parchment-50/10 bg-ink-800">
                {attributes.map((attr, ai) => {
                    const [key, value] = Object.entries(attr)[0] ?? ['', '']
                    return (
                        <div
                            key={`${key}-${ai}`}
                            className="flex items-start justify-between gap-3 border-b border-parchment-50/[0.06] px-3.5 py-2.5 last:border-b-0"
                        >
                            <span className="font-ui text-[13px] text-parchment-400">{key}</span>
                            <span className="text-right font-ui text-[13px] text-parchment-100">{String(value)}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function EmptyHint({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-parchment-50/12 bg-ink-700/40 px-3.5 py-3 font-narrative text-[13px] italic text-parchment-400">
            {children}
        </p>
    )
}

/* ----------------------------- edit form ----------------------------- */

function CardEditForm({
    entry,
    onSubmit,
    error,
}: {
    entry: SnapshotCardEntry
    onSubmit: (ref: SnapshotCardRef, card: SnapshotCard) => void
    error: string | null
}) {
    const { t } = useTranslation()
    const { card, ref } = entry
    const { isAuthenticated, openLoginModal } = useAuth()
    const isWorld = ref.kind === 'world'
    const cardType = isWorld ? 'world' : 'character'
    const [name, setName] = useState(card.name ?? '')
    const [placeType, setPlaceType] = useState(readWorldPlaceType(isWorld ? card : null))
    const [badgeValue, setBadgeValue] = useState((isWorld ? card.type : card.race) || '')
    const [description, setDescription] = useState(card.description ?? '')
    const [triggers, setTriggers] = useState<string[]>(card.triggers ?? [])
    const [imageUrl, setImageUrl] = useState<string | undefined>(card.image_url)
    const [themeSongUrl, setThemeSongUrl] = useState<string | undefined>(card.theme_song_url)
    const [touched, setTouched] = useState(false)

    // Theme songs attach to a library card; this adventure-only copy targets its
    // origin (`source_card_id`) — theme audio is associated media, so it never
    // mutates the snapshot's own body. Without an origin, theme is unavailable.
    const themeSourceId = card.source_card_id
    const themeDisabledReason = themeSourceId
        ? undefined
        : t('interaction.cardDrawer.themeNoOrigin')
    const ensureSaved = async (): Promise<string> => {
        if (!themeSourceId) throw new Error('No library origin to attach a theme to.')
        return themeSourceId
    }

    // Backstop against the "phantom submit": if the view→edit button swap ever
    // isn't fully deferred, the click that opened this form can land on the
    // freshly mounted submit button and fire onSubmit before any user input.
    // Only accept submits once the form has settled (one frame after mount).
    const readyRef = useRef(false)
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            readyRef.current = true
        })
        return () => cancelAnimationFrame(id)
    }, [])

    const defaults = isWorld ? worldDefaults(t) : characterDefaults(t)
    const attrs = useAttributeCategories({ defaults, entity: card })

    const nameError = touched && !name.trim() ? t('interaction.cardDrawer.nameRequired') : undefined
    const placeTypeError = touched && isWorld && !placeType.trim() ? t('interaction.cardDrawer.placeTypeRequired') : undefined
    const selectedPlaceTypeOption = worldPlaceTypeOptionValue(placeType)

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (!readyRef.current) return
        setTouched(true)
        if (!name.trim() || (isWorld && !placeType.trim())) return
        const updated: SnapshotCard = {
            ...card,
            name: name.trim(),
            description: description.trim(),
            triggers,
            category: toCategoryPayload(attrs.categories, attrs.attributes),
            image_url: imageUrl,
            theme_song_url: themeSongUrl,
        }
        if (isWorld) {
            updated.place_type = placeType.trim() || DEFAULT_WORLD_PLACE_TYPE
            updated.type = badgeValue.trim()
        } else {
            updated.race = badgeValue.trim()
        }
        onSubmit(ref, updated)
    }

    return (
        <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
                <p
                    role="status"
                    aria-live="polite"
                    className="rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-[13px] text-parchment-100"
                >
                    {error}
                </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <CreatorField label={t('interaction.cardDrawer.nameLabel')} required error={nameError}>
                    <CreatorInput value={name} onChange={setName} placeholder={isWorld ? t('interaction.cardDrawer.worldNamePlaceholder') : t('interaction.cardDrawer.characterNamePlaceholder')} autoFocus />
                </CreatorField>

                {isWorld ? (
                    <CreatorField
                        label={t('interaction.cardDrawer.placeTypeLabel')}
                        required
                        error={placeTypeError}
                        tooltip={t('interaction.cardDrawer.placeTypeTooltip')}
                    >
                        <Select
                            value={selectedPlaceTypeOption}
                            onChange={(next) => {
                                setPlaceType(next === CUSTOM_WORLD_PLACE_TYPE ? '' : next)
                            }}
                            options={[
                                ...WORLD_PLACE_TYPE_OPTIONS,
                                { value: CUSTOM_WORLD_PLACE_TYPE, label: t('interaction.cardDrawer.customOption') },
                            ]}
                        />
                    </CreatorField>
                ) : (
                    <CreatorField label={t('interaction.cardDrawer.raceLabel')}>
                        <CreatorInput value={badgeValue} onChange={setBadgeValue} placeholder={t('interaction.cardDrawer.racePlaceholder')} />
                    </CreatorField>
                )}
            </div>

            {isWorld && selectedPlaceTypeOption === CUSTOM_WORLD_PLACE_TYPE && (
                <CreatorField label={t('interaction.cardDrawer.customPlaceTypeLabel')} required error={placeTypeError}>
                    <CreatorInput
                        value={placeType}
                        onChange={setPlaceType}
                        placeholder={t('interaction.cardDrawer.customPlaceTypePlaceholder')}
                    />
                </CreatorField>
            )}

            {isWorld && (
                <CreatorField
                    label={t('interaction.cardDrawer.genreLabel')}
                    tooltip={t('interaction.cardDrawer.genreTooltip')}
                >
                    <CreatorInput value={badgeValue} onChange={setBadgeValue} placeholder={t('interaction.cardDrawer.genrePlaceholder')} />
                </CreatorField>
            )}

            <CreatorField label={t('interaction.cardDrawer.descriptionLabel')} tooltip={isWorld ? t('interaction.cardDrawer.descriptionTooltipWorld') : t('interaction.cardDrawer.descriptionTooltipCharacter')}>
                <CreatorTextarea value={description} onChange={setDescription} rows={5} placeholder={t('interaction.cardDrawer.descriptionPlaceholder')} />
            </CreatorField>

            <AttributeManager
                title={isWorld ? t('interaction.cardDrawer.worldDetailsTitle') : t('interaction.cardDrawer.attributesTitle')}
                subtitle={t('interaction.cardDrawer.attributesSubtitle')}
                categories={attrs.categories}
                attributes={attrs.attributes}
                onAddCategory={attrs.addCategory}
                onDeleteCategory={attrs.deleteCategory}
                onAddAttribute={attrs.addAttribute}
                onUpdateAttribute={attrs.updateAttribute}
                onRemoveAttribute={attrs.removeAttribute}
            />

            <TriggersField values={triggers} onChange={setTriggers} />

            <div className="border-t border-parchment-50/[.07] pt-6">
                <MediaStudioSection
                    cardType={cardType}
                    noun={isWorld ? 'world' : 'character'}
                    template={{
                        name,
                        description,
                        subtype: badgeValue,
                        place_type: isWorld ? placeType.trim() || DEFAULT_WORLD_PLACE_TYPE : undefined,
                        category: toCategoryPayload(attrs.categories, attrs.attributes),
                    }}
                    imageUrl={imageUrl}
                    onImageUrl={setImageUrl}
                    themeSongUrl={themeSongUrl}
                    onThemeSongUrl={setThemeSongUrl}
                    onGeneratedThemeSongUrl={setThemeSongUrl}
                    ensureSaved={ensureSaved}
                    themeTargetId={themeSourceId}
                    themeDisabledReason={themeDisabledReason}
                    isAuthenticated={isAuthenticated}
                    onAuthRequired={openLoginModal}
                />
            </div>
        </form>
    )
}
