import type { ChatNarratorIdentity, ForwardOption, TurnEntry } from '@/shared'
import { finalizeResponseSegments, segmentsToPlainText } from '@/utils/chatSegments'

type MergeableTurnEntry = TurnEntry & {
  forwardOptions?: ForwardOption[]
  narratorIdentity?: ChatNarratorIdentity | null
}

export function mergeHydratedChatTurns(current: TurnEntry[], hydrated: TurnEntry[]): TurnEntry[] {
  if (hydrated.length === 0) return current
  return hydrated.map((turn) => {
    const existing = findMatchingTurn(current, turn)
    if (!existing || turn.type !== 'ai') return turn
    const hydratedTurn = turn as MergeableTurnEntry
    const existingTurn = existing as MergeableTurnEntry
    const next = preserveMissingChatMetadata(hydratedTurn, existingTurn)
    if (hydratedTurn.segments?.length) {
      return { ...next, segments: finalizeResponseSegments(hydratedTurn.segments) }
    }
    if (!existingTurn.segments?.length) {
      return next
    }
    const segments = finalizeResponseSegments(existingTurn.segments)
    const content = hydratedTurn.content?.trim() || visibleContent(existingTurn)
    return { ...next, content, segments }
  })
}

function findMatchingTurn(current: TurnEntry[], turn: TurnEntry): TurnEntry | undefined {
  const sameType = current.filter((candidate) => candidate.type === turn.type)
  if (turn.assistantMessageId) {
    const byAssistantId = sameType.find((candidate) => candidate.assistantMessageId === turn.assistantMessageId)
    if (byAssistantId) return byAssistantId
  }
  if (turn.turnId) {
    const byTurnId = sameType.find((candidate) => candidate.turnId === turn.turnId)
    if (byTurnId) return byTurnId
  }
  if (turn.id) {
    const byId = sameType.find((candidate) => candidate.id === turn.id)
    if (byId) return byId
  }
  return undefined
}

function preserveMissingChatMetadata(hydrated: MergeableTurnEntry, existing: MergeableTurnEntry): MergeableTurnEntry {
  return {
    ...hydrated,
    forwardOptions: hydrated.forwardOptions ?? existing.forwardOptions,
    imagePrompt: hydrated.imagePrompt ?? existing.imagePrompt,
    narratorIdentity: hydrated.narratorIdentity ?? existing.narratorIdentity,
  }
}

function visibleContent(turn: MergeableTurnEntry): string {
  return turn.content?.trim() || segmentsToPlainText(turn.segments).trim()
}
