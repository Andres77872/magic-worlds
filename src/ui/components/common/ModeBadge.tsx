/**
 * Mode badge — tags a card, shelf, or screen with the play mode it belongs to:
 * Adventure (Swords/ember, GM-led role-play) or Chat (MessageCircle/arcane, 1:1).
 * Vocabulary and colors come from MODE_META so every surface stays consistent.
 */
import { MODE_META, type PlayMode } from '@/shared/modes'
import { Badge, Icon } from '@/ui/primitives'

interface ModeBadgeProps {
    mode: PlayMode
    /** Icon-only variant for dense card rows; the label moves to a tooltip. */
    compact?: boolean
    className?: string
}

export function ModeBadge({ mode, compact = false, className }: ModeBadgeProps) {
    const meta = MODE_META[mode]
    return (
        <Badge
            tone={meta.tone}
            icon={<Icon icon={meta.icon} size={12} />}
            title={compact ? meta.label : meta.tagline}
            className={className}
        >
            {!compact && meta.label}
        </Badge>
    )
}
