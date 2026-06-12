/**
 * Hero preview — a tilted, frosted card showing a single narrative exchange:
 * the character's line (italic narration + bright dialogue) and your reply.
 * A small, honest taste of what a scene feels like. Built from primitives.
 */

import { Brain } from 'lucide-react'
import { Avatar, Badge, Icon } from '@/ui/primitives'
import { SHOWCASE_WORLDS } from './landingContent'

export function HeroPreviewCard() {
    const lead = SHOWCASE_WORLDS[0]
    return (
        <div className="w-[420px] max-w-[92vw] -rotate-[1.2deg] rounded-2xl border border-parchment-50/[.08] bg-ink-700/[.78] p-[22px] shadow-xl backdrop-blur-[8px]">
            {/* header: avatar + name/world + "Remembers" cue */}
            <div className="mb-4 flex items-center gap-2.5 border-b border-parchment-50/[.06] pb-4">
                <Avatar
                    name={lead.name}
                    initial={lead.initial}
                    gradient={lead.portrait}
                    size={40}
                    ring="arcane"
                    status="think"
                />
                <div>
                    <div className="font-display text-[19px] font-semibold leading-none text-parchment-50">
                        {lead.name}
                    </div>
                    <div className="mt-[3px] font-ui text-[11.5px] text-parchment-400">{lead.world}</div>
                </div>
                <Badge tone="arcane" className="ml-auto" icon={<Icon icon={Brain} size={12} />}>
                    Remembers
                </Badge>
            </div>

            {/* narration (italic, dim) + dialogue (bright) */}
            <p className="mb-4 font-narrative text-[15.5px] leading-[1.6] text-parchment-200">
                <em className="text-parchment-100">She slides a cup across the table, steam curling between you. </em>
                <span className="text-parchment-50">&ldquo;Drink. Then tell me why you really came.&rdquo;</span>
            </p>

            {/* your reply — ember-soft bubble, corner pointing at the speaker */}
            <div className="flex justify-end">
                <div className="max-w-[300px] rounded-lg rounded-br-[5px] border border-ember-500/25 bg-ember-500/[.08] px-3.5 py-2.5 font-narrative text-[15px] text-parchment-50">
                    &ldquo;I&rsquo;m looking for someone.&rdquo;
                </div>
            </div>

            {/* she reacts — the conversation carries on, and she remembers */}
            <p className="mt-4 font-narrative text-[15.5px] leading-[1.6] text-parchment-200">
                <em className="text-parchment-100">She studies you a moment, then slides a brass key across the wood. </em>
                <span className="text-parchment-50">&ldquo;Room at the back. Mind the third stair.&rdquo;</span>
            </p>
        </div>
    )
}
