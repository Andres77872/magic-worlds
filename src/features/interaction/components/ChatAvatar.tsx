import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../ui/primitives'

interface ChatAvatarProps {
    isUser: boolean
    /** The AI speaker's identity (a 1:1 character); the Game Master glyph otherwise. */
    aiName?: string
    aiImageUrl?: string | null
    /** Pulse the AI ring while its reply is being written. */
    thinking?: boolean
}

export function ChatAvatar({ isUser, aiName, aiImageUrl, thinking = false }: ChatAvatarProps) {
    const { t } = useTranslation()
    if (isUser) {
        // Player — ember ring
        return (
            <Avatar
                initial={t('interaction.avatar.playerInitial')}
                name={t('interaction.avatar.playerName')}
                size={36}
                ring="ember"
                gradient="linear-gradient(135deg, color-mix(in srgb, var(--color-ember-500) 28%, transparent), color-mix(in srgb, var(--color-ember-500) 8%, transparent))"
            />
        )
    }
    const status = thinking ? 'think' : 'none'
    // A named character keeps its own portrait and initial.
    if (aiName) {
        return <Avatar name={aiName} src={aiImageUrl ?? undefined} size={36} ring="arcane" status={status} />
    }
    // Game Master (AI) — arcane ring
    return (
        <Avatar
            initial={t('interaction.avatar.gmInitial')}
            name={t('interaction.avatar.gmName')}
            size={36}
            ring="arcane"
            status={status}
            gradient="radial-gradient(circle at 35% 30%, var(--color-arcane-700), var(--color-ink-700))"
        />
    )
}
