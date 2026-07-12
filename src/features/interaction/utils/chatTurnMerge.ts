import type { ChatNarratorIdentity, ForwardOption, TurnEntry } from '@/shared'
import { finalizeResponseSegments, segmentsToPlainText } from '@/utils/chatSegments'

type MergeableTurnEntry = TurnEntry & {
  forwardOptions?: ForwardOption[]
  narratorIdentity?: ChatNarratorIdentity | null
}

export interface MergeHydratedChatTurnsOptions {
  /**
   * Ids of turns edited locally (client mirror only — the backend has no
   * message-edit endpoint). A matched turn in this set keeps its full local
   * entry so hydration can't revert the edit to the canonical pre-edit text;
   * hydration still owns its position in the transcript.
   */
  preferLocalIds?: ReadonlySet<string>
}

export function mergeHydratedChatTurns(
  current: TurnEntry[],
  hydrated: TurnEntry[],
  options: MergeHydratedChatTurnsOptions = {},
): TurnEntry[] {
  if (hydrated.length === 0) return current
  const preferLocalIds = options.preferLocalIds
  const matched = new Set<TurnEntry>()
  const merged = hydrated.map((turn) => {
    const existing = findMatchingTurn(current, turn)
    if (existing) matched.add(existing)
    if (existing && preferLocalIds?.has(existing.id)) return existing
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
  // Hydration owns ordering and deletions for turns the server has acknowledged,
  // but a stale projection must never eat optimistic turns it can't contain yet
  // (rapid follow-up send, mid-stream reconnect) — re-append those at the tail.
  const optimisticTail = current.filter((turn) => !matched.has(turn) && !isServerAcknowledged(turn))
  return optimisticTail.length ? [...merged, ...optimisticTail] : merged
}

function isServerAcknowledged(turn: TurnEntry): boolean {
  if (turn.turnId) return true
  if (turn.type === 'ai' && turn.assistantMessageId) return true
  const numericId = Number(turn.id)
  return Number.isInteger(numericId) && numericId > 0
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
