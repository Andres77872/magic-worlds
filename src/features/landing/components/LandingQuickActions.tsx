import type { KeyboardEvent, ReactNode } from 'react'
import { BookOpen, Globe, UserPlus } from 'lucide-react'
import { Card, Icon } from '../../../ui/primitives'
import type { LucideIcon } from 'lucide-react'

interface LandingQuickActionsProps {
    onCreateCharacter: () => void
    onBuildWorld: () => void
    onCreateAdventure: () => void
}

interface QuickActionCardProps {
    icon: LucideIcon
    title: string
    description: ReactNode
    descriptionId: string
    onClick: () => void
}

function QuickActionCard({ icon, title, description, descriptionId, onClick }: QuickActionCardProps) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }

    return (
        <Card
            interactive
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            aria-describedby={descriptionId}
            className="flex min-h-[240px] flex-col items-center p-6 text-center md:p-10"
        >
            <div className="mb-6 flex justify-center text-ember-500" aria-hidden="true">
                <Icon icon={icon} size={56} />
            </div>
            <h3 className="mb-2 font-display text-h3 font-semibold text-parchment-50">
                {title}
            </h3>
            <p
                id={descriptionId}
                className="mx-auto flex max-w-[280px] flex-grow items-center text-body leading-normal text-parchment-200"
            >
                {description}
            </p>
        </Card>
    )
}

export function LandingQuickActions({
    onCreateCharacter,
    onBuildWorld,
    onCreateAdventure,
}: LandingQuickActionsProps) {
    return (
        <section
            className="relative z-[2] px-4 py-12 sm:px-6"
            aria-labelledby="quick-actions-title"
        >
            <h2
                className="mb-12 text-center font-display text-h2 font-bold text-parchment-50"
                id="quick-actions-title"
            >
                Begin Your Journey
            </h2>
            <div
                className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]"
                role="group"
                aria-label="Quick action buttons"
            >
                <QuickActionCard
                    icon={UserPlus}
                    title="Create Character"
                    description="Forge a legendary hero with unique traits, abilities, and a compelling backstory"
                    descriptionId="character-description"
                    onClick={onCreateCharacter}
                />
                <QuickActionCard
                    icon={Globe}
                    title="Build World"
                    description="Design mystical realms filled with wonder, danger, and endless possibilities"
                    descriptionId="world-description"
                    onClick={onBuildWorld}
                />
                <QuickActionCard
                    icon={BookOpen}
                    title="Create Adventure"
                    description="Craft epic quests, thrilling storylines, and memorable encounters"
                    descriptionId="adventure-description"
                    onClick={onCreateAdventure}
                />
            </div>
        </section>
    )
}
