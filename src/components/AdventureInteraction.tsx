import {useEffect, useState} from 'react'
import type {Adventure, TurnEntry} from '../types'
import {InteractionCenterPanel, InteractionLeftPanel, InteractionRightPanel} from './interaction'
import '../App.css'
import {storage} from '../services/storage'

export function AdventureInteraction({
                                         adventure,
                                         onBack,
                                     }: {
    adventure: Adventure
    onBack: () => void
}) {
    const [turns, setTurns] = useState<TurnEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Load turns from storage when component mounts or adventure changes
    useEffect(() => {
        let isMounted = true

        const loadTurns = async () => {
            try {
                setIsLoading(true)
                const loadedTurns = await storage.loadTurns(adventure.id)
                if (isMounted) {
                    setTurns(loadedTurns)
                }
            } catch (error) {
                console.error('Failed to load turns:', error)
                if (isMounted) {
                    setTurns([])
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadTurns()

        return () => {
            isMounted = false
        }
    }, [adventure.id])

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading adventure...</p>
            </div>
        )
    }


    return (
        <div className="interaction-container">
            <button className="back-button" onClick={onBack}>
                ← Back
            </button>
            <InteractionLeftPanel adventure={adventure}/>
            <InteractionCenterPanel
                adventure={adventure}
                turns={turns}
                setTurns={setTurns}
            />
            <InteractionRightPanel adventure={adventure} turns={turns}/>
        </div>
    )
}