import { useCallback, useRef, useState } from 'react'
import { useData } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import {
    fetchCardPreview,
    findLocalCardPreview,
    type CardPreview,
    type CardPreviewTarget,
} from '../cardPreview'

/**
 * The read-only card preview modal. Workspace R1: a card the local library does
 * not hold is fetched through the current workspace's scoped client, a late
 * result after a switch is ignored, and an open preview closes once the user
 * commits another workspace (document 08: previews close on a committed switch).
 */
export function useCardPreviewModal() {
    const { characters, worlds, items, templateAdventures } = useData()
    const { api, workspaceEpoch, capture, isCurrent } = useWorkspace()
    const [target, setTarget] = useState<CardPreviewTarget | null>(null)
    const [card, setCard] = useState<CardPreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The workspace epoch the preview was opened in; any other epoch reads as closed.
    const [openedEpoch, setOpenedEpoch] = useState(workspaceEpoch)
    const ticketRef = useRef(0)

    const closeCardPreview = useCallback(() => {
        ticketRef.current += 1
        setTarget(null)
        setCard(null)
        setLoading(false)
        setError(null)
    }, [])

    const openCardPreview = useCallback(
        (nextTarget: CardPreviewTarget) => {
            if (!nextTarget.id) return
            const ticket = ticketRef.current + 1
            ticketRef.current = ticket
            setTarget(nextTarget)
            setOpenedEpoch(workspaceEpoch)
            setError(null)

            const library = { characters, worlds, items, templateAdventures }
            const local = findLocalCardPreview(library, nextTarget)
            if (local) {
                setCard(local)
                setLoading(false)
                return
            }

            setCard(null)
            if (!api) {
                setLoading(false)
                setError('Card could not be loaded.')
                return
            }
            setLoading(true)
            const scope = capture()
            const owns = () => ticketRef.current === ticket && isCurrent(scope)
            void fetchCardPreview(nextTarget, api)
                .then((preview) => {
                    if (!owns()) return
                    setCard(preview)
                    if (!preview) setError('Card could not be loaded.')
                })
                .catch(() => {
                    if (!owns()) return
                    setError('Card could not be loaded.')
                })
                .finally(() => {
                    if (owns()) setLoading(false)
                })
        },
        [characters, worlds, items, templateAdventures, api, workspaceEpoch, capture, isCurrent],
    )

    const open = target !== null && openedEpoch === workspaceEpoch
    return {
        target: open ? target : null,
        card: open ? card : null,
        loading: open && loading,
        error: open ? error : null,
        openCardPreview,
        closeCardPreview,
    }
}
