import { describe, expect, it } from 'vitest'
import type { ForwardOption, TurnEntry } from '@/shared'
import { mergeHydratedChatTurns } from './chatTurnMerge'

type ExtendedTurnEntry = TurnEntry & { forwardOptions?: ForwardOption[] }

const timestamp = '2026-06-07T00:00:00.000Z'

const userTurn: TurnEntry = {
  id: '100',
  type: 'user',
  content: 'Look around',
  timestamp,
  turnId: 'turn-9',
}

const liveAiTurn: ExtendedTurnEntry = {
  id: '999',
  type: 'ai',
  content: 'Aria: Who goes there?',
  timestamp,
  assistantMessageId: 999,
  turnId: 'turn-9',
  segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?', streaming: true }],
  forwardOptions: [{ label: 'Answer Aria', message: 'I answer Aria.' }],
  imagePrompt: 'A torchlit threshold.',
}

describe('mergeHydratedChatTurns', () => {
  it('preserves current structured segments when hydrated AI turn is plain text only', () => {
    const hydrated: TurnEntry[] = [
      userTurn,
      {
        id: '999',
        type: 'ai',
        content: 'Aria: Who goes there?',
        timestamp,
        assistantMessageId: 999,
        turnId: 'turn-9',
      },
    ]

    const next = mergeHydratedChatTurns([userTurn, liveAiTurn], hydrated)

    expect(next).toHaveLength(2)
    expect(next[1].segments).toEqual([
      { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' },
    ])
    expect((next[1] as ExtendedTurnEntry).forwardOptions).toEqual(liveAiTurn.forwardOptions)
    expect(next[1].imagePrompt).toBe('A torchlit threshold.')
  })

  it('uses authoritative hydrated segments when the server provides them', () => {
    const hydratedAi: TurnEntry = {
      id: '999',
      type: 'ai',
      content: 'Borin: Hold fast.',
      timestamp,
      assistantMessageId: 999,
      turnId: 'turn-9',
      segments: [{ kind: 'speech', speaker_id: 'borin', speaker_name: 'Borin', content: 'Hold fast.' }],
    }

    const next = mergeHydratedChatTurns([userTurn, liveAiTurn], [userTurn, hydratedAi])

    expect(next[1].content).toBe('Borin: Hold fast.')
    expect(next[1].segments).toEqual(hydratedAi.segments)
  })

  it('lets hydrated ordering and deletions win', () => {
    const next = mergeHydratedChatTurns([userTurn, liveAiTurn], [userTurn])

    expect(next).toEqual([userTurn])
  })

  it('preserves trailing optimistic turns the projection cannot contain yet', () => {
    const optimisticUser: TurnEntry = {
      id: 'b6a1c9c2-2f1e-4d70-9a3d-2f57c2f5a111',
      type: 'user',
      content: 'And then?',
      timestamp,
    }
    const optimisticAi: ExtendedTurnEntry = {
      id: 'b6a1c9c2-2f1e-4d70-9a3d-2f57c2f5a222',
      type: 'ai',
      content: 'The door creaks',
      timestamp,
    }

    // A stale projection (fetched before the follow-up send) only knows turn A.
    const next = mergeHydratedChatTurns(
      [userTurn, liveAiTurn, optimisticUser, optimisticAi],
      [userTurn, { ...liveAiTurn, segments: undefined }],
    )

    expect(next.map((turn) => turn.id)).toEqual([userTurn.id, liveAiTurn.id, optimisticUser.id, optimisticAi.id])
    expect(next[2]).toBe(optimisticUser)
    expect(next[3]).toBe(optimisticAi)
  })

  it('still drops unmatched turns once the server has acknowledged them', () => {
    const acknowledgedUser: TurnEntry = {
      id: '412',
      type: 'user',
      content: 'Deleted elsewhere',
      timestamp,
      turnId: 'turn-12',
    }

    const next = mergeHydratedChatTurns([userTurn, liveAiTurn, acknowledgedUser], [userTurn, liveAiTurn])

    expect(next.map((turn) => turn.id)).toEqual([userTurn.id, liveAiTurn.id])
  })

  it('preserves current segments when hydrated content differs but has no segments', () => {
    const hydratedAi: TurnEntry = {
      id: '999',
      type: 'ai',
      content: 'The hall falls silent.',
      timestamp,
      assistantMessageId: 999,
      turnId: 'turn-9',
    }

    const next = mergeHydratedChatTurns([userTurn, liveAiTurn], [userTurn, hydratedAi])

    expect(next[1].content).toBe('The hall falls silent.')
    expect(next[1].segments).toEqual([
      { kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' },
    ])
  })

  it('keeps the full local entry for locally-edited turns instead of the stored text', () => {
    const editedAi: ExtendedTurnEntry = {
      ...liveAiTurn,
      content: 'Aria: Stand down, all of you.',
      segments: undefined,
    }
    const editedUser: TurnEntry = { ...userTurn, content: 'Look up' }
    // Server still holds the pre-edit projection.
    const hydrated: TurnEntry[] = [userTurn, { ...liveAiTurn, segments: undefined }]

    const next = mergeHydratedChatTurns([editedUser, editedAi], hydrated, {
      preferLocalIds: new Set(['100', '999']),
    })

    expect(next[0]).toBe(editedUser)
    expect(next[1]).toBe(editedAi)
  })

  it('locally-edited turns still take their position and deletions from hydration', () => {
    const editedAi: ExtendedTurnEntry = { ...liveAiTurn, content: 'Edited reply.', segments: undefined }
    // Server deleted the user turn; only the AI turn remains.
    const next = mergeHydratedChatTurns([userTurn, editedAi], [{ ...liveAiTurn, segments: undefined }], {
      preferLocalIds: new Set(['999']),
    })

    expect(next.map((turn) => turn.id)).toEqual(['999'])
    expect(next[0].content).toBe('Edited reply.')
  })
})
