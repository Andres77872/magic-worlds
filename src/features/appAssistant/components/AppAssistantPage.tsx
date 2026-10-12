/**
 * AppAssistantPage — the `#/assistant` route ("Assistant" in the sidebar, next
 * to Explore and Community). Wires the knowledge sources, the conversation hook,
 * the `app_assistant` model control, and in-app link handling into the view.
 * Its history holds every assistant's conversations; a card or lorebook one
 * continues in its editor, which opens its assistant panel on it.
 *
 * Deep link: `#/assistant?conversation=<id>` reopens a saved thread; the page
 * keeps the hash in sync (replaceState) as the active thread changes.
 *
 * Library links in replies preview their record on hover (`HoverCardsProvider`):
 * cards nest, lock open, tear off when dragged, and can join the focus shelf.
 * Clicking a record link (or a card's View) previews it over the thread; a
 * card's Open, and every other link in a reply, opens in a new browser tab.
 */
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useFloatingWindows, useLanguage, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import type { PageType } from '@/shared'
import type { AssistantConversation } from '@/shared/types/assistant.types'
import { buildCardEditHash, buildLinkedEditorHash, pageHash } from '@/features/gallery/galleryLinks'
import { useOriginNavigation } from '@/features/workspaces/originNavigation'
import { CardPreviewModal, useCardPreviewModal } from '@/features/cards'
import { lorebookWindow } from '@/features/floatingWindows'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { useAssistant } from '@/features/creation/common/components/assistant/useAssistant'
import { withAssistantConversation } from '@/features/creation/common/components/assistant/assistantHandoff'
import { AssistantLinkContext } from '@/features/creation/common/components/assistant/assistantLinkContext'
import { conversationTargetId } from '@/features/creation/common/components/assistant/assistantModel'
import { Toast } from '@/ui/primitives'
import { adventureName, estimateFocusTokens } from '../appKnowledge'
import { assistantTag } from '../assistantTags'
import { appAssistantAdapter } from '../appAssistantAdapter'
import { APP_ASSISTANT_SUGGESTIONS } from '../assistantSuggestions'
import { FOCUS_LIMIT, useAssistantKnowledge } from '../hooks/useAssistantKnowledge'
import { HoverCardsProvider, focusMatchKey, parseHoverCardHref, previewTargetFor, type HoverCardRef } from '../hoverCards'
import { AssistantFocusPicker } from './AssistantFocusPicker'
import { AssistantReplyLink } from './AssistantReplyLink'
import { AppAssistantView } from './AppAssistantView'

function conversationIdFromHash(hash: string): number | null {
    const [, query = ''] = hash.split('?')
    const value = Number(new URLSearchParams(query).get('conversation'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
}

function conversationHash(id: number | null): string {
    return id ? `${pageHash('assistant')}?${new URLSearchParams({ conversation: String(id) }).toString()}` : pageHash('assistant')
}

export function AppAssistantPage() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        lorebooks, characters, worlds, items, templateAdventures,
        editLorebook, setEditingLorebook, editCharacter, setEditingCharacter, editWorld, setEditingWorld,
        editItem, setEditingItem, editTemplate, setEditingTemplate,
    } = useData()
    const { language } = useLanguage()
    const { setPage, previousPage, currentHash, replaceHash } = useNavigation()
    const cardPreview = useCardPreviewModal()
    const { openWindow } = useFloatingWindows()
    const { selectedWorkspaceId } = useWorkspace()
    // Archived workspace: conversations stay readable; new turns would be refused (409).
    const readOnly = useWorkspaceReadOnly()
    const { navigateToOrigin } = useOriginNavigation()
    const [pickerOpen, setPickerOpen] = useState(false)
    const [linkNotice, setLinkNotice] = useState<string | null>(null)

    // The page the reader came from anchors "this page" questions; frozen on mount.
    const [originPage] = useState<PageType | null>(() => (previousPage && previousPage !== 'assistant' ? previousPage : null))
    const [initialConversationId] = useState(() => conversationIdFromHash(currentHash))

    const knowledge = useAssistantKnowledge(originPage)

    const syncHash = useCallback((id: number | null) => {
        replaceHash(conversationHash(id))
    }, [replaceHash])

    // The hook reads the binding at send time, so a turn always carries the sources as they are right now.
    const assistant = useAssistant({
        adapter: appAssistantAdapter,
        binding: {
            context: knowledge.knowledge.markdown,
            locale: language,
            page: originPage ? pageHash(originPage) : null,
        },
        isAuthenticated,
        onAuthRequired: openLoginModal,
        initialConversationId,
        onActiveConversationChange: syncHash,
    })

    const targetNames = useMemo(() => {
        const { library } = knowledge
        return new Map<string, string>([
            ...library.characters.map((card): [string, string] => [card.id, card.name]),
            ...library.worlds.map((card): [string, string] => [card.id, card.name]),
            ...library.items.map((card): [string, string] => [card.id, card.name]),
            ...library.adventures.map((card): [string, string] => [card.id, adventureName(card)]),
            ...library.lorebooks.map((book): [string, string] => [book.id, book.name]),
        ])
    }, [knowledge])

    const suggestions = useMemo(
        () => APP_ASSISTANT_SUGGESTIONS.filter((suggestion) => !suggestion.requires || knowledge.sources.includes(suggestion.requires)),
        [knowledge.sources],
    )

    const knowledgeSummary = useMemo(() => {
        const { library } = knowledge
        const cards = library.characters.length + library.worlds.length + library.items.length + library.adventures.length
        const parts = [t('appAssistant.summary.cards', { count: cards })]
        if (knowledge.sources.includes('lorebooks')) parts.push(t('appAssistant.summary.lorebooks', { count: library.lorebooks.length }))
        if (knowledge.sources.includes('resources')) parts.push(t('appAssistant.summary.resources', { count: library.resources.length }))
        if (knowledge.sources.includes('novels')) parts.push(t('appAssistant.summary.novels', { count: library.stories.length }))
        return parts.join(' · ')
    }, [knowledge, t])

    // Hover cards pin records to the same focus shelf the panel edits (a persona
    // may be stored under either kind, so match it the way the cards do).
    const { library, focus: focusRefs, setFocus, removeFocus } = knowledge
    const toggleFocus = useCallback((ref: HoverCardRef) => {
        const key = focusMatchKey(ref)
        const current = focusRefs.find((entry) => focusMatchKey(entry) === key)
        if (current) removeFocus(current)
        else if (focusRefs.length < FOCUS_LIMIT) setFocus([...focusRefs, ref])
    }, [focusRefs, setFocus, removeFocus])
    const focusTokens = useCallback((ref: HoverCardRef) => estimateFocusTokens(library, ref, t), [library, t])
    // A record previews over the thread: a card in its preview modal, and a
    // lorebook (which has none) in its preview window.
    const viewRecord = useCallback((ref: HoverCardRef) => {
        const target = previewTargetFor(ref)
        if (target) return cardPreview.openCardPreview(target)
        const lorebook = lorebooks.find((book) => book.id === ref.id)
        if (lorebook) openWindow(lorebookWindow(lorebook))
        else setLinkNotice(t('appAssistant.notices.linkMissing'))
    }, [cardPreview, lorebooks, openWindow, t])

    // Every other working link opens in a new tab (`AssistantReplyLink`), so
    // only record links and links to nowhere reach the page.
    const navigateLink = useCallback((href: string) => {
        const ref = parseHoverCardHref(href)
        if (ref) viewRecord(ref)
        else setLinkNotice(t('appAssistant.notices.linkMissing'))
    }, [viewRecord, t])

    // A card or lorebook conversation keeps going in its editor: open the saved
    // document (or a fresh draft for an unbound one) with the conversation handed over.
    // Workspace R1: a conversation of another workspace continues there — the
    // coordinator guards the switch and the editor loads the record from its route.
    const continueInEditor = useCallback((conversation: AssistantConversation) => {
        const id = conversation.conversation_id
        const targetId = conversationTargetId(conversation)
        const missing = () => setLinkNotice(t('appAssistant.handoff.missing'))
        const tag = assistantTag(conversation)
        if (tag === 'app') return
        const origin = conversation.organization?.workspace_id ?? null
        if (origin && origin !== selectedWorkspaceId) {
            const page: PageType = tag === 'adventure_template' ? 'adventure' : tag
            const route = !targetId
                ? pageHash(page)
                : tag === 'lorebook' ? buildLinkedEditorHash('lorebook', targetId)
                    : tag === 'adventure_template' ? buildLinkedEditorHash('adventure', targetId)
                        : buildCardEditHash(tag, targetId)
            void navigateToOrigin({ workspaceId: origin, page, hash: withAssistantConversation(route, id) }).then((outcome) => {
                if (outcome === 'unavailable') setLinkNotice(t('workspaceActivity.assistant.unavailable'))
            })
            return
        }
        if (tag === 'lorebook') {
            const lorebook = targetId ? lorebooks.find((book) => book.id === targetId) : null
            if (targetId && !lorebook) return missing()
            if (lorebook) editLorebook(lorebook)
            else setEditingLorebook(null)
            setPage('lorebook', { hash: withAssistantConversation(pageHash('lorebook'), id) })
            return
        }
        if (tag === 'adventure_template') {
            const template = targetId ? templateAdventures.find((card) => card.id === targetId) : null
            if (targetId && !template) return missing()
            if (template) editTemplate(template)
            else setEditingTemplate(null)
            setPage('adventure', { hash: withAssistantConversation(pageHash('adventure'), id) })
            return
        }
        // Character, world and item editors load a saved card missing from the library from their own route.
        const byId = <C extends { id: string }>(cards: C[]) => (targetId ? cards.find((card) => card.id === targetId) : undefined)
        if (tag === 'character') {
            const card = byId(characters)
            if (card) editCharacter(card)
            else setEditingCharacter(null)
        } else if (tag === 'world') {
            const card = byId(worlds)
            if (card) editWorld(card)
            else setEditingWorld(null)
        } else {
            const card = byId(items)
            if (card) editItem(card)
            else setEditingItem(null)
        }
        const route = targetId ? buildCardEditHash(tag, targetId) : pageHash(tag)
        setPage(tag, { hash: withAssistantConversation(route, id) })
    }, [t, lorebooks, templateAdventures, characters, worlds, items, setPage, editLorebook, setEditingLorebook,
        editTemplate, setEditingTemplate, editCharacter, setEditingCharacter, editWorld, setEditingWorld, editItem, setEditingItem,
        selectedWorkspaceId, navigateToOrigin])

    // The picker resolves the `app_assistant` profile, which only exists on servers that
    // offer the assistant: wait for the history to confirm it instead of showing an error.
    const modelControl = assistant.ready && !assistant.unavailable
        ? <LlmFeatureControl feature="app_assistant" disabled={assistant.status === 'streaming'} />
        : undefined

    return (
        <HoverCardsProvider
            library={library}
            focus={focusRefs}
            focusLimit={FOCUS_LIMIT}
            focusBusy={assistant.status === 'streaming'}
            focusTokens={focusTokens}
            onToggleFocus={toggleFocus}
            onView={viewRecord}
        >
            <AssistantLinkContext.Provider value={AssistantReplyLink}>
                <AppAssistantView
                    signedIn={isAuthenticated}
                    onLogin={openLoginModal}
                    status={assistant.status}
                    historyReady={assistant.ready}
                    conversations={assistant.conversations}
                    activeConversation={assistant.activeConversation}
                    targetNames={targetNames}
                    turns={assistant.turns}
                    notice={assistant.notice}
                    unavailable={assistant.unavailable}
                    onRecheck={assistant.recheck}
                    suggestions={suggestions}
                    knowledgeSummary={knowledgeSummary}
                    knowledge={{
                        sources: knowledge.sources,
                        sections: knowledge.knowledge.sections,
                        enabled: knowledge.enabled,
                        onToggle: knowledge.toggleSource,
                        focus: knowledge.focusChips,
                        focusLimit: FOCUS_LIMIT,
                        onAddFocus: () => setPickerOpen(true),
                        onRemoveFocus: knowledge.removeFocus,
                        tokens: knowledge.knowledge.tokens,
                        truncated: knowledge.knowledge.truncated,
                        loading: knowledge.resourcesLoading,
                    }}
                    modelControl={modelControl}
                    readOnly={readOnly}
                    onSend={(text) => {
                        if (!readOnly) void assistant.send(text)
                    }}
                    onStop={assistant.stop}
                    onRetry={readOnly ? undefined : assistant.retry}
                    onReload={() => void assistant.reloadConversation()}
                    onDismissNotice={assistant.clearNotice}
                    onNewConversation={assistant.newConversation}
                    onSelectConversation={(id) => void assistant.selectConversation(id)}
                    onDeleteConversation={(id) => void assistant.deleteConversation(id)}
                    onContinueInEditor={continueInEditor}
                    onNavigateLink={navigateLink}
                    overlays={(
                        <>
                            <AssistantFocusPicker
                                open={pickerOpen}
                                onClose={() => setPickerOpen(false)}
                                candidates={knowledge.candidates}
                                selected={knowledge.focus}
                                limit={FOCUS_LIMIT}
                                onApply={knowledge.setFocus}
                            />
                            <CardPreviewModal
                                target={cardPreview.target}
                                card={cardPreview.card}
                                loading={cardPreview.loading}
                                error={cardPreview.error}
                                onClose={cardPreview.closeCardPreview}
                                showUsage
                            />
                            <Toast
                                open={Boolean(linkNotice)}
                                tone="error"
                                title={linkNotice ?? ''}
                                autoCloseMs={3200}
                                onClose={() => setLinkNotice(null)}
                            />
                        </>
                    )}
                />
            </AssistantLinkContext.Provider>
        </HoverCardsProvider>
    )
}
