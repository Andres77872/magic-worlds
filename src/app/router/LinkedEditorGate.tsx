/**
 * LinkedEditorGate — opens the adventure, lorebook or story editor on the
 * record its link names (`#/adventure?card=<id>`, `#/lorebook?lorebook=<id>`,
 * `#/story?story=<id>`), as when the assistant opens one in a new browser tab.
 *
 * Those editors read their record from DataProvider once, when they mount, and
 * a fresh tab has none, so the gate hands the library record over first
 * (before paint; a story waits for `openStory` to load its chapters). Only the
 * link the page opened with counts: in-app navigation sets the record itself,
 * and starting a new one inside the editor must not snap back.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { PageType } from '../../shared'
import { parseLinkedEditorId, type LinkedEditorPage } from '../../features/gallery/galleryLinks'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'
import { useAuth, useData, useNavigation } from '../hooks'

const GALLERY_PAGE: Record<LinkedEditorPage, PageType> = {
    adventure: 'gallery-adventures',
    lorebook: 'gallery-lorebooks',
    story: 'gallery-stories',
}

interface LinkedEditorGateProps {
    page: LinkedEditorPage
    children: ReactNode
}

export function LinkedEditorGate({ page, children }: LinkedEditorGateProps) {
    const { currentHash, setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        templateAdventures, editingTemplate, editTemplate,
        lorebooks, editingLorebook, editLorebook,
        stories, activeStory, openStory,
    } = useData()
    const [linkedId, setLinkedId] = useState(() => parseLinkedEditorId(page, currentHash))
    // A story loads once even if the provider re-renders while it is on its way.
    const requestedStory = useRef<string | null>(null)
    const editing = page === 'adventure' ? editingTemplate : page === 'lorebook' ? editingLorebook : activeStory
    const editingId = editing?.id ?? null
    // Once the editor holds the linked record the link is spent.
    if (linkedId !== null && linkedId === editingId) setLinkedId(null)
    // Signed out, the editor stays visible behind the sign-in dialog.
    const pending = linkedId !== null && linkedId !== editingId && isAuthenticated

    useLayoutEffect(() => {
        if (linkedId === null || linkedId === editingId) return
        // Signing in reloads the library and remounts the page, which reads the link again.
        if (!isAuthenticated) return openLoginModal()
        if (page === 'adventure') {
            const template = templateAdventures.find((card) => card.id === linkedId)
            if (template) return editTemplate(template)
        } else if (page === 'lorebook') {
            const lorebook = lorebooks.find((book) => book.id === linkedId)
            if (lorebook) return editLorebook(lorebook)
        } else {
            const story = stories.find((entry) => entry.id === linkedId)
            if (story) {
                if (requestedStory.current === linkedId) return
                requestedStory.current = linkedId
                openStory(story).catch(() => setPage(GALLERY_PAGE.story))
                return
            }
        }
        // Deleted, or not this account's: the gallery is the useful fallback.
        setPage(GALLERY_PAGE[page])
    }, [linkedId, editingId, isAuthenticated, page, templateAdventures, lorebooks, stories, editTemplate, editLorebook, openStory, openLoginModal, setPage])

    if (!pending) return children
    return (
        <div className="flex min-h-full flex-1 items-center justify-center">
            <LoadingSpinner />
        </div>
    )
}
