import { useState } from 'react'
import type { Adventure, TurnEntry } from '../types'
import { InteractionLeftPanel } from './InteractionLeftPanel'
import { InteractionCenterPanel } from './InteractionCenterPanel'
import { InteractionRightPanel } from './InteractionRightPanel'
import '../App.css'


export function AdventureInteraction({
  adventure,
  onBack,
}: {
  adventure: Adventure
  onBack: () => void
}) {
  // List of completed user/assistant turns
  const [turns, setTurns] = useState<TurnEntry[]>([])

  return (
    <div className="interaction-container">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>
      <InteractionLeftPanel adventure={adventure} />
      <InteractionCenterPanel
        adventure={adventure}
        turns={turns}
        setTurns={setTurns}
      />
      <InteractionRightPanel adventure={adventure} turns={turns} />
    </div>
  )
}