import { Badge, Icon } from '@/ui/primitives'
import type { RoadmapStage } from '../roadmapContent'
import { STAGE_META } from './roadmapMeta'

/** One roadmap status: icon shape + label, toned by the shared stage vocabulary. */
export function StageBadge({ stage, label, className }: { stage: RoadmapStage; label: string; className?: string }) {
    const meta = STAGE_META[stage]
    return (
        <Badge tone={meta.tone} icon={<Icon icon={meta.icon} size={13} />} className={className} data-stage={stage}>
            {label}
        </Badge>
    )
}
