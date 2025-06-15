import { useState } from 'react'
import type { Adventure } from '../types'
import { InteractionLeftPanel } from './InteractionLeftPanel'
import { InteractionCenterPanel } from './InteractionCenterPanel'
import { InteractionRightPanel } from './InteractionRightPanel'
import '../App.css'

interface TurnEntry {
  number: number
  input: string
}

export function AdventureInteraction({
  adventure,
  onBack,
}: {
  adventure: Adventure
  onBack: () => void
}) {
  // Placeholder turns list, starts empty
  const [turns] = useState<TurnEntry[]>([])

  return (
    <div className="interaction-container">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <InteractionLeftPanel adventure={adventure} />
      <InteractionCenterPanel />
      <InteractionRightPanel adventure={adventure} turns={turns} />
    </div>
  )
}