import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../ui/primitives'

interface ChatAvatarProps {
    isUser: boolean
}

export function ChatAvatar({ isUser }: ChatAvatarProps) {
    const { t } = useTranslation()
    return isUser ? (
        // Player — ember ring
        <Avatar
            initial={t('interaction.avatar.playerInitial')}
            name={t('interaction.avatar.playerName')}
            size={36}
            ring="ember"
            gradient="linear-gradient(135deg, rgba(232,162,74,.28), rgba(232,162,74,.08))"
        />
    ) : (
        // Game Master (AI) — arcane ring
        <Avatar
            initial={t('interaction.avatar.gmInitial')}
            name={t('interaction.avatar.gmName')}
            size={36}
            ring="arcane"
            gradient="radial-gradient(circle at 35% 30%, var(--color-arcane-700), var(--color-ink-700))"
        />
    )
}
