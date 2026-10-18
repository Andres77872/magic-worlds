import type { CharacterChatSession } from '@/shared'

type ChatParticipants = Pick<CharacterChatSession,
    'character_id' | 'character_ids' | 'persona_id' | 'character' | 'characters' | 'persona'>

/** Participant and persona cards already contribute their frozen chat context. */
export function characterChatParticipantIds(chat: ChatParticipants): Set<string> {
    return new Set([
        ...(chat.character_ids ?? []),
        chat.character_id,
        chat.persona_id,
        chat.character?.id,
        ...(chat.characters ?? []).map((character) => character.id),
        chat.persona?.id,
    ].filter((id): id is string => Boolean(id)))
}
