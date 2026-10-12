/**
 * useGalleryCardActions — the owned-card actions shared by the type galleries
 * and the Workspace R1 Library: open/edit, chat/call/begin, write a novel,
 * set the default persona, versions, share/publish/export, duplicate and
 * delete, plus the dialogs those actions need. Everything branches on the
 * card's own type (`item.galleryType`), so mixed-type surfaces reuse it as is.
 *
 * Workspace R1: every private request goes through `api`, the scoped client
 * of the workspace that owns the cards; results are applied only while that
 * workspace is still the committed one (`capture`/`isCurrent`). `readOnly`
 * (an archived workspace) leaves only the read actions.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, Copy, Download, Globe2, History, Link2, Loader2, MessageCircle, Pencil, Phone, Play, Star, Trash2 } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { ApiService } from '@/infrastructure/api'
import type { Adventure, Character, Item, VersionableCardType, World } from '@/shared'
import { VersionHistoryDrawer } from '@/features/creation/common/components'
import { useStartCall } from '@/features/call'
import { PersonaPickerDialog, type CardOption } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { writeClipboardText } from '@/ui/components/common/clipboard'
import { Badge, Button, Icon } from '@/ui/primitives'
import { defaultPersonaForCharacter } from '@/utils/characterRoles'
import { downloadBlob, safeFilename } from '@/utils/download'
import { errorMessage } from '@/utils/errors'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { isCommunityCardsFeatureEnabled, isNovelsFeatureEnabled } from '@/shared/featureFlags'
import { publicItems, type GalleryItem, type GalleryType } from '../galleryConfig'
import { buildCardEditHash, buildSharedCardUrl } from '../galleryLinks'

export interface GalleryActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
    /** Optional follow-up shown under the notice (e.g. View card). */
    action?: { label: string; onClick: () => void }
}

export function versionableCardTypeFor(type: GalleryType): VersionableCardType | null {
    if (type === 'character' || type === 'persona') return 'character'
    if (type === 'world') return 'world'
    if (type === 'item') return 'item'
    return null
}

export interface GalleryCardActionsOptions {
    /** Scoped client of the workspace that owns the cards (`null` before the handshake). */
    api: ApiService | null
    /** Archived workspace: only open/versions/export remain. */
    readOnly?: boolean
    /** A card changed or a new one appeared (share/publish/duplicate results). */
    onItemChanged: (item: GalleryItem) => void
    /** A card was deleted. */
    onItemRemoved: (item: GalleryItem) => void
    /** Extra menu entries placed before Duplicate/Delete (e.g. Library organization). */
    extraOptions?: (item: GalleryItem) => CardOption[]
    /**
     * Client for new cards (duplicates). Inside a Library collection it is the
     * same workspace's client with that collection as `initialCollectionIds`;
     * defaults to `api` (the workspace root).
     */
    createApi?: ApiService | null
}

type PersonaPick =
    | { kind: 'adventure'; item: GalleryItem }
    | { kind: 'chat'; item: GalleryItem }
    | { kind: 'group-chat'; items: GalleryItem[]; onStarted?: () => void }

export function useGalleryCardActions({ api, readOnly = false, onItemChanged, onItemRemoved, extraOptions, createApi }: GalleryCardActionsOptions) {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { capture, isCurrent } = useWorkspace()
    const {
        editCharacter,
        setCharacters,
        setEditingCharacter,
        deleteCharacter,
        setDefaultPersona,
        characters,
        startCharacterChat,
        startCharacterGroupChat,
        editWorld,
        worlds,
        setWorlds,
        deleteWorld,
        editItem,
        items: libraryItems,
        setItems,
        deleteItem,
        editTemplate,
        templateAdventures,
        setTemplateAdventures,
        startTemplate,
        deleteTemplateById,
        createStory,
    } = useData()
    const communityCardsEnabled = isCommunityCardsFeatureEnabled()
    const novelsEnabled = isNovelsFeatureEnabled()
    const voiceModeEnabled = isFrontendVoiceModeEnabled()
    const callControls = useStartCall()

    const [notice, setNotice] = useState<GalleryActionNotice | null>(null)
    const [highlightedId, setHighlightedId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [pendingDefault, setPendingDefault] = useState<GalleryItem | null>(null)
    const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
    const [exportingId, setExportingId] = useState<string | null>(null)
    const [sharingId, setSharingId] = useState<string | null>(null)
    const [startingChatId, setStartingChatId] = useState<string | null>(null)
    const [versionTarget, setVersionTarget] = useState<GalleryItem | null>(null)
    const [personaPick, setPersonaPick] = useState<PersonaPick | null>(null)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)
    const [isPersonaPickConfirming, setIsPersonaPickConfirming] = useState(false)

    // Per-workspace dialogs never survive a committed switch.
    const scopeKeyRef = useRef(api)
    useEffect(() => {
        if (scopeKeyRef.current === api) return
        scopeKeyRef.current = api
        setPendingDelete(null)
        setPendingDefault(null)
        setVersionTarget(null)
        setPersonaPick(null)
        setNotice(null)
    }, [api])

    const requireAuth = useCallback((action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }, [isAuthenticated, openLoginModal])

    const requireApi = (): ApiService | null => {
        if (api) return api
        setNotice({ tone: 'error', title: t('gallery.action.tryAgain') })
        return null
    }

    /** Open the matching card editor (where draft/publish/restore are managed). */
    const openEditorForItem = (item: GalleryItem) => {
        if (item.galleryType === 'character' || item.galleryType === 'persona') {
            editCharacter(item.source as Character)
            setPage('character', { hash: buildCardEditHash('character', item.id) })
        } else if (item.galleryType === 'world') {
            editWorld(item.source as World)
            setPage('world', { hash: buildCardEditHash('world', item.id) })
        } else if (item.galleryType === 'item') {
            editItem(item.source as Item)
            setPage('item', { hash: buildCardEditHash('item', item.id) })
        } else {
            editTemplate(item.source as Adventure)
            setPage('adventure')
        }
    }

    const startCharacterChatFromCard = (item: GalleryItem) => {
        requireAuth(() => {
            const persona = defaultPersonaForCharacter(item.source as Character, characters)
            if (!persona) {
                setPersonaPickError(null)
                setPersonaPick({ kind: 'chat', item })
                return
            }
            if (startingChatId) return

            setNotice(null)
            setStartingChatId(item.id)
            void startCharacterChat(item.source as Character, persona)
                .then(() => setPage('character-chat'))
                .catch((error) => {
                    console.error('Failed to start character chat:', error)
                    setNotice({
                        tone: 'error',
                        title: t('gallery.action.startChatFailed'),
                        message: errorMessage(error, t('gallery.action.tryAgain')),
                    })
                })
                .finally(() => {
                    setStartingChatId((current) => (current === item.id ? null : current))
                })
        })
    }

    /** The card's primary action: edit, or begin an adventure (open it when read-only). */
    const primaryAction = (item: GalleryItem) => {
        requireAuth(() => {
            if (item.galleryType === 'adventure' && !readOnly) {
                setPersonaPickError(null)
                setPersonaPick({ kind: 'adventure', item })
                return
            }
            openEditorForItem(item)
        })
    }

    const actionLabelFor = (item: GalleryItem): string =>
        item.galleryType === 'adventure' && !readOnly
            ? t('gallery.cardAction.beginAdventure', { title: item.title })
            : t('gallery.cardAction.edit', { title: item.title })

    const exportCard = async (item: GalleryItem) => {
        if (exportingId) return
        const client = requireApi()
        if (!client) return
        setNotice(null)
        setExportingId(item.id)
        try {
            const exportType =
                item.galleryType === 'adventure'
                    ? 'adventure_template'
                    : item.galleryType === 'persona'
                      ? 'character'
                      : item.galleryType
            const blob = await client.exportCardImage(exportType, item.id)
            downloadBlob(blob, `${safeFilename(item.title, 'card')}.png`)
        } catch (error) {
            console.error('Failed to export card image:', error)
            setNotice({
                tone: 'error',
                title: t('gallery.action.exportFailed'),
                message: t('gallery.action.exportBody', { title: item.title.slice(0, 80) }),
            })
        } finally {
            setExportingId(null)
        }
    }

    const copyShareLink = async (item: GalleryItem) => {
        if (!communityCardsEnabled || sharingId) return
        const client = requireApi()
        if (!client) return
        const scope = capture()
        setNotice(null)
        setSharingId(item.id)
        try {
            const share = await client.createCardShareLink(item.backendType, item.id)
            await writeClipboardText(buildSharedCardUrl(share.share_token))
            if (!isCurrent(scope)) return
            const updated = publicItems(share.resource, item.galleryType)[0]
            if (updated) onItemChanged(updated)
            setNotice({
                tone: 'success',
                title: t('gallery.action.linkCopied'),
                message: t('gallery.action.linkCopiedBody', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to copy gallery card link:', error)
            if (isCurrent(scope)) setNotice({ tone: 'error', title: t('gallery.action.copyFailed'), message: t('gallery.action.tryAgain') })
        } finally {
            setSharingId(null)
        }
    }

    const togglePublicCard = async (item: GalleryItem) => {
        if (!communityCardsEnabled || sharingId) return
        const client = requireApi()
        if (!client) return
        const scope = capture()
        setNotice(null)
        setSharingId(item.id)
        const isPublic = Boolean(item.visibility?.public)
        try {
            const resource = isPublic
                ? await client.unpublishCard(item.backendType, item.id)
                : await client.publishCard(item.backendType, item.id)
            if (!isCurrent(scope)) return
            const updated = publicItems(resource, item.galleryType)[0]
            if (updated) onItemChanged(updated)
            setNotice({
                tone: 'success',
                title: isPublic ? t('gallery.action.publicRemoved') : t('gallery.action.publicShared'),
                message: isPublic
                    ? t('gallery.action.publicRemovedBody', { title: item.title.slice(0, 80) })
                    : t('gallery.action.publicSharedBody', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to update public card visibility:', error)
            if (isCurrent(scope)) {
                setNotice({
                    tone: 'error',
                    title: t('gallery.action.publicFailed'),
                    message: errorMessage(error, t('gallery.action.tryAgain')),
                })
            }
        } finally {
            setSharingId(null)
        }
    }

    const prependDuplicateIntoData = (item: GalleryItem) => {
        if (item.galleryType === 'character' || item.galleryType === 'persona') {
            const duplicate = item.source as Character
            setCharacters([duplicate, ...characters.filter((character) => character.id !== duplicate.id)])
        } else if (item.galleryType === 'world') {
            const duplicate = item.source as World
            setWorlds([duplicate, ...worlds.filter((world) => world.id !== duplicate.id)])
        } else if (item.galleryType === 'item') {
            const duplicate = item.source as Item
            setItems([duplicate, ...libraryItems.filter((storedItem) => storedItem.id !== duplicate.id)])
        } else {
            const duplicate = item.source as Adventure
            setTemplateAdventures([duplicate, ...templateAdventures.filter((template) => template.id !== duplicate.id)])
        }
    }

    const duplicateCard = async (item: GalleryItem) => {
        if (duplicatingId) return
        const client = createApi ?? requireApi()
        if (!client) return
        const scope = capture()
        setNotice(null)
        setDuplicatingId(item.id)
        try {
            const response = await client.duplicateCard(item.backendType, item.id)
            if (!isCurrent(scope)) return
            const duplicated = publicItems(response, item.galleryType)[0]
            if (!duplicated) throw new Error(t('gallery.action.tryAgain'))
            onItemChanged(duplicated)
            prependDuplicateIntoData(duplicated)
            setHighlightedId(duplicated.id)
            setNotice({
                tone: 'success',
                title: t('gallery.action.duplicateTitle'),
                message: t('gallery.action.duplicateBody', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to duplicate gallery card:', error)
            if (isCurrent(scope)) {
                setNotice({
                    tone: 'error',
                    title: t('gallery.action.duplicateFailed'),
                    message: errorMessage(error, t('gallery.action.tryAgain')),
                })
            }
        } finally {
            setDuplicatingId(null)
        }
    }

    const applyDefaultPersona = async (item: GalleryItem) => {
        if (settingDefaultId) return
        setNotice(null)
        setSettingDefaultId(item.id)
        try {
            await setDefaultPersona(item.source as Character)
            setNotice({
                tone: 'success',
                title: t('gallery.personas.setDefaultDone', { title: item.title.slice(0, 80) }),
            })
        } catch (error) {
            console.error('Failed to set default persona:', error)
            setNotice({ tone: 'error', title: t('gallery.personas.setDefaultFailed') })
        } finally {
            setSettingDefaultId(null)
        }
    }

    // Setting default publishes the card (discarding any pending draft), so confirm first when
    // there are unsaved draft edits; otherwise apply in one click.
    const setDefault = (item: GalleryItem) =>
        requireAuth(() => {
            if (item.hasDraft) {
                setPendingDefault(item)
                return
            }
            void applyDefaultPersona(item)
        })

    const writeFromCard = (item: GalleryItem) =>
        requireAuth(() => {
            // Non-blank story sources require a stored non-empty title
            // (DB check constraint) — never pass a blank card name through.
            const sourceTitle = item.title.trim() || t('novelGallery.create.untitledFallback')
            const source =
                item.galleryType === 'character' || item.galleryType === 'persona'
                    ? { kind: 'character' as const, id: item.id, title: sourceTitle }
                    : item.galleryType === 'world'
                      ? { kind: 'world' as const, id: item.id, title: sourceTitle }
                      : item.galleryType === 'item'
                        ? { kind: 'item' as const, id: item.id, title: sourceTitle }
                        : { kind: 'adventure_template' as const, id: item.id, title: sourceTitle }
            const cardRefKind =
                item.galleryType === 'adventure'
                    ? 'adventure_template'
                    : item.galleryType === 'persona'
                      ? 'character'
                      : item.galleryType
            void createStory({
                title: t('gallery.novelTitle', { title: item.title }),
                source,
                chapters: [{ title: t('gallery.chapterOne'), body: '', status: 'draft', order: 0 }],
                cardRefs: [{ kind: cardRefKind, cardId: item.id, source: 'source' }],
            }).then(() => setPage('story'))
        })

    const shareOptionsFor = (item: GalleryItem): CardOption[] => [
        ...(communityCardsEnabled && !readOnly
            ? [
                  {
                      type: 'custom',
                      icon: <Icon icon={Link2} size={15} />,
                      label: sharingId === item.id ? t('gallery.copyingLink') : t('gallery.copyUnlistedLink'),
                      onClick: () => requireAuth(() => void copyShareLink(item)),
                      disabled: sharingId !== null,
                  } satisfies CardOption,
                  {
                      type: 'custom',
                      icon: <Icon icon={Globe2} size={15} />,
                      label: item.visibility?.public ? t('gallery.removeFromPublic') : t('gallery.shareAsPublic'),
                      onClick: () => requireAuth(() => void togglePublicCard(item)),
                      disabled: sharingId !== null,
                  } satisfies CardOption,
              ]
            : []),
        {
            type: 'custom',
            icon: <Icon icon={Download} size={15} />,
            label: exportingId === item.id ? t('gallery.downloading') : t('gallery.downloadPng'),
            onClick: () => requireAuth(() => void exportCard(item)),
            disabled: exportingId !== null,
            separatorBefore: communityCardsEnabled && !readOnly,
        },
    ]

    const optionsFor = (item: GalleryItem): CardOption[] => {
        const options: CardOption[] = []
        if (novelsEnabled && !readOnly) {
            options.push({
                type: 'custom',
                icon: <Icon icon={BookOpenText} size={15} />,
                label: t('gallery.write'),
                onClick: () => writeFromCard(item),
            })
        }
        if (item.galleryType === 'character' && !readOnly) {
            options.push({
                type: 'custom',
                icon: <Icon icon={MessageCircle} size={15} />,
                label: t('gallery.chat'),
                onClick: () => startCharacterChatFromCard(item),
                disabled: Boolean(startingChatId),
            })
            if (voiceModeEnabled) {
                options.push({
                    type: 'custom',
                    icon: <Icon icon={Phone} size={15} />,
                    label: t('gallery.call'),
                    onClick: () => callControls.startCall(item.source as Character),
                    disabled: callControls.startingId === item.id,
                })
            }
        }
        if (item.galleryType === 'adventure' && !readOnly) {
            options.push({
                type: 'custom',
                icon: <Icon icon={Play} size={15} />,
                label: t('gallery.beginAdventure'),
                onClick: () => primaryAction(item),
            })
        }
        options.push({
            type: 'custom',
            icon: <Icon icon={Pencil} size={15} />,
            label: t('gallery.edit'),
            onClick: () => requireAuth(() => openEditorForItem(item)),
        })
        if (item.galleryType === 'persona' && !item.isDefaultPersona && !readOnly) {
            options.push({
                type: 'custom',
                icon: settingDefaultId === item.id ? (
                    <Icon icon={Loader2} size={15} className="animate-spin" />
                ) : (
                    <Icon icon={Star} size={15} />
                ),
                label: settingDefaultId === item.id ? t('gallery.personas.settingDefault') : t('gallery.personas.setDefault'),
                onClick: () => setDefault(item),
                disabled: settingDefaultId !== null,
            })
        }
        if (versionableCardTypeFor(item.galleryType)) {
            options.push({
                type: 'custom',
                icon: <Icon icon={History} size={15} />,
                label: t('cardVersions.action'),
                onClick: () => requireAuth(() => setVersionTarget(item)),
            })
        }
        if (extraOptions) options.push(...extraOptions(item))
        if (!readOnly) {
            options.push({
                type: 'custom',
                icon: duplicatingId === item.id ? (
                    <Icon icon={Loader2} size={15} className="animate-spin" />
                ) : (
                    <Icon icon={Copy} size={15} />
                ),
                label: duplicatingId === item.id ? t('gallery.duplicating') : t('gallery.duplicate'),
                onClick: () => requireAuth(() => void duplicateCard(item)),
                disabled: duplicatingId !== null,
            })
            options.push({
                type: 'custom',
                icon: <Icon icon={Trash2} size={15} />,
                label: t('gallery.delete'),
                onClick: () => requireAuth(() => setPendingDelete(item)),
                danger: true,
            })
        }
        return options
    }

    /** Pinned Chat / Call row for owned character cards. */
    const footerFor = (item: GalleryItem): ReactNode => {
        if (item.galleryType !== 'character' || readOnly) return undefined
        return (
            <div className="flex gap-2">
                <Button
                    variant="primary"
                    size="sm"
                    className="min-w-0 flex-1"
                    iconLeft={
                        startingChatId === item.id ? (
                            <Icon icon={Loader2} size={15} className="animate-spin" />
                        ) : (
                            <Icon icon={MessageCircle} size={15} />
                        )
                    }
                    disabled={Boolean(startingChatId)}
                    onClick={() => startCharacterChatFromCard(item)}
                >
                    {startingChatId === item.id ? t('gallery.starting') : t('gallery.chat')}
                </Button>
                {voiceModeEnabled && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="min-w-0 flex-1"
                        iconLeft={
                            callControls.startingId === item.id ? (
                                <Icon icon={Loader2} size={15} className="animate-spin" />
                            ) : (
                                <Icon icon={Phone} size={15} />
                            )
                        }
                        disabled={Boolean(callControls.startingId)}
                        onClick={() => callControls.startCall(item.source as Character)}
                    >
                        {callControls.startingId === item.id ? t('gallery.starting') : t('gallery.call')}
                    </Button>
                )}
            </div>
        )
    }

    // The default persona gets a distinct ember chip pinned above its (kept) race badge.
    const markerFor = (item: GalleryItem): ReactNode =>
        item.isDefaultPersona ? (
            <Badge tone="ember" icon={<Icon icon={Star} size={11} />}>
                {t('gallery.personas.defaultMarker')}
            </Badge>
        ) : undefined

    /** Group chat from selected character cards (the gallery's six-character selection). */
    const openGroupChatPicker = (items: GalleryItem[], onStarted?: () => void) => {
        setPersonaPickError(null)
        setPersonaPick({ kind: 'group-chat', items, onStarted })
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            if (target.galleryType === 'character' || target.galleryType === 'persona') await deleteCharacter(target.id)
            else if (target.galleryType === 'world') await deleteWorld(target.id)
            else if (target.galleryType === 'item') await deleteItem(target.id)
            else await deleteTemplateById(target.id)
            onItemRemoved(target)
        } catch (error) {
            console.error('Failed to delete from gallery:', error)
        } finally {
            setDeletingId(null)
        }
    }

    const closePersonaPick = () => {
        if (isPersonaPickConfirming) return
        setPersonaPick(null)
        setPersonaPickError(null)
    }

    const confirmPersonaPick = async (persona: Character) => {
        const pending = personaPick
        if (!pending || isPersonaPickConfirming) return
        setPersonaPickError(null)
        setIsPersonaPickConfirming(true)
        try {
            if (pending.kind === 'adventure') {
                await startTemplate(pending.item.source as Adventure, persona)
                setPersonaPick(null)
                setPage('interaction')
            } else if (pending.kind === 'chat') {
                await startCharacterChat(pending.item.source as Character, persona)
                setPersonaPick(null)
                setPage('character-chat')
            } else {
                await startCharacterGroupChat(pending.items.map((item) => item.source as Character), persona)
                pending.onStarted?.()
                setPersonaPick(null)
                setPage('character-chat')
            }
        } catch (error) {
            const fallback = pending.kind === 'adventure'
                ? t('gallery.action.beginAdventureFailedBody')
                : pending.kind === 'group-chat'
                  ? t('gallery.action.startGroupFailedBody')
                  : t('gallery.action.startChatFailedBody')
            setPersonaPickError(errorMessage(error, fallback))
        } finally {
            setIsPersonaPickConfirming(false)
        }
    }

    const confirmSetDefault = async () => {
        const target = pendingDefault
        setPendingDefault(null)
        if (!target) return
        await applyDefaultPersona(target)
    }

    const versionCardType = versionTarget ? versionableCardTypeFor(versionTarget.galleryType) : null

    const overlays = (
        <>
            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('gallery.deleteTitle', {
                    type: pendingDelete ? t(`gallery.type.${pendingDelete.galleryType}.singular`) : '',
                })}
                message={pendingDelete ? t('gallery.deleteMessage', { title: pendingDelete.title.slice(0, 80) }) : ''}
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />

            <ConfirmDialog
                visible={pendingDefault !== null}
                icon={<Icon icon={Star} size={18} />}
                title={t('gallery.personas.setDefaultDraftTitle')}
                message={pendingDefault ? t('gallery.personas.setDefaultDraftBody', { title: pendingDefault.title.slice(0, 80) }) : ''}
                confirmLabel={t('gallery.personas.setDefaultDraftConfirm')}
                variant="primary"
                onConfirm={() => void confirmSetDefault()}
                onCancel={() => setPendingDefault(null)}
            />

            <PersonaPickerDialog
                open={personaPick !== null}
                title={personaPick?.kind === 'chat' || personaPick?.kind === 'group-chat' ? t('gallery.choosePersona') : t('gallery.beginAs')}
                actionLabel={personaPick?.kind === 'group-chat' ? t('gallery.startGroupChat') : personaPick?.kind === 'chat' ? t('gallery.startChat') : t('gallery.beginAdventure')}
                description={
                    personaPick?.kind === 'group-chat'
                        ? t('gallery.personaGroupDescription')
                        : personaPick?.kind === 'chat'
                          ? t('gallery.personaChatDescription')
                          : t('gallery.personaAdventureDescription')
                }
                error={personaPickError}
                isConfirming={isPersonaPickConfirming}
                characters={characters}
                onConfirm={confirmPersonaPick}
                onClose={closePersonaPick}
                onCreateCharacter={() => {
                    if (isPersonaPickConfirming) return
                    setPersonaPick(null)
                    setPersonaPickError(null)
                    setEditingCharacter(null)
                    setPage('character')
                }}
            />

            <VersionHistoryDrawer
                open={versionTarget !== null && versionCardType !== null}
                onClose={() => setVersionTarget(null)}
                cardType={versionCardType ?? 'character'}
                cardId={versionTarget?.id}
                cardName={versionTarget?.title ?? ''}
                hasDraft={Boolean(versionTarget?.hasDraft)}
                onEdit={() => {
                    const target = versionTarget
                    if (!target) return
                    setVersionTarget(null)
                    requireAuth(() => openEditorForItem(target))
                }}
            />

            <PersonaPickerDialog
                open={callControls.personaPickOpen}
                title={t('gallery.choosePersona')}
                actionLabel={t('gallery.startCall')}
                description={t('gallery.personaChatDescription')}
                error={callControls.personaPickError}
                isConfirming={callControls.personaPickConfirming}
                characters={characters}
                onConfirm={callControls.confirmPersonaPick}
                onClose={callControls.closePersonaPick}
            />
        </>
    )

    return {
        notice,
        setNotice,
        highlightedId,
        setHighlightedId,
        deletingId,
        requireAuth,
        primaryAction,
        actionLabelFor,
        optionsFor,
        shareOptionsFor,
        footerFor,
        markerFor,
        openEditorForItem,
        openGroupChatPicker,
        overlays,
    }
}

export type GalleryCardActions = ReturnType<typeof useGalleryCardActions>

