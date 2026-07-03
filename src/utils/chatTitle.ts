import type { CharacterChatSession } from '@/shared'

/**
 * Display title for a 1:1 or group character chat: the room's own title first
 * (groups get a generated one server-side), then the cast names joined. Returns
 * '' when neither exists so call sites can apply their own localized fallback.
 */
export function chatDisplayTitle(chat: CharacterChatSession | null | undefined): string {
    if (!chat) return ''
    const cast = chat.characters?.length ? chat.characters : chat.character ? [chat.character] : []
    return (
        chat.title?.trim() ||
        cast.map((character) => character.name?.trim()).filter(Boolean).join(', ')
    )
}
