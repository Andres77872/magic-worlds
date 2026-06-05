import { Avatar } from '../../../ui/primitives'

interface ChatAvatarProps {
    isUser: boolean
}

export function ChatAvatar({ isUser }: ChatAvatarProps) {
    return isUser ? (
        // Player — ember ring
        <Avatar
            initial="P"
            name="you"
            size={36}
            ring="ember"
            gradient="linear-gradient(135deg, rgba(232,162,74,.28), rgba(232,162,74,.08))"
        />
    ) : (
        // Game Master (AI) — arcane ring
        <Avatar
            initial="GM"
            name="Game Master"
            size={36}
            ring="arcane"
            gradient="radial-gradient(circle at 35% 30%, #4a3a6b, #1b1726)"
        />
    )
}
