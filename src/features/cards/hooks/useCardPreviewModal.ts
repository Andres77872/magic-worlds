import { useCallback, useRef, useState } from 'react'
import { useData } from '@/app/hooks'
import {
    fetchCardPreview,
    findLocalCardPreview,
    type CardPreview,
    type CardPreviewTarget,
} from '../cardPreview'

export function useCardPreviewModal() {
    const { characters, worlds, items, templateAdventures } = useData()
    const [target, setTarget] = useState<CardPreviewTarget | null>(null)
    const [card, setCard] = useState<CardPreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
            setError(null)

            const library = { characters, worlds, items, templateAdventures }
            const local = findLocalCardPreview(library, nextTarget)
            if (local) {
                setCard(local)
                setLoading(false)
                return
            }

            setCard(null)
            setLoading(true)
            void fetchCardPreview(nextTarget)
                .then((preview) => {
                    if (ticketRef.current !== ticket) return
                    setCard(preview)
                    if (!preview) setError('Card could not be loaded.')
                })
                .catch(() => {
                    if (ticketRef.current !== ticket) return
                    setError('Card could not be loaded.')
                })
                .finally(() => {
                    if (ticketRef.current === ticket) setLoading(false)
                })
        },
        [characters, worlds, items, templateAdventures],
    )

    return {
        target,
        card,
        loading,
        error,
        openCardPreview,
        closeCardPreview,
    }
}
