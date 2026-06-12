import { Check, Sparkles } from 'lucide-react'
import { Badge, Eyebrow } from '@/ui/primitives'
import { formatAppliedChange } from './appliedActions'
import { AssistantMarkdown } from './AssistantMarkdown'
import type { AssistantTurnBase } from './appliedActions'

export interface VisibleAssistantTurn extends AssistantTurnBase {
    isStreaming: boolean
    isInterrupted: boolean
}

function turnTime(value?: string): string {
    if (!value) return ''
    const stamp = new Date(value)
    if (Number.isNaN(stamp.getTime())) return ''
    return stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** One visible chat turn: ember bubble for the user, literary prose + change chips for the assistant. */
export function AssistantMessage({ turn }: { turn: VisibleAssistantTurn }) {
    const { message, appliedChanges, isStreaming, isInterrupted } = turn
    const time = turnTime(message.created_at)

    if (message.role === 'user') {
        return (
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-baseline gap-2">
                    {time && <span className="font-mono text-[11px] text-parchment-500">{time}</span>}
                    <Eyebrow tone="ember" className="text-[10px]">You</Eyebrow>
                </div>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-[4px] border border-ember-500/30 bg-ember-500/[.14] px-3.5 py-2.5 font-ui text-[14px] leading-relaxed text-parchment-50">
                    {message.content}
                </div>
            </div>
        )
    }

    if (message.status === 'failed') {
        return (
            <div className="flex flex-col items-start gap-1">
                <Eyebrow tone="arcane" className="text-[10px]">Assistant</Eyebrow>
                <div className="rounded-lg border border-blood-500/40 bg-blood-500/10 px-3 py-2 font-ui text-[13px] leading-relaxed text-parchment-100">
                    {message.content}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex items-baseline gap-2">
                <Eyebrow tone="arcane" className="text-[10px]">Assistant</Eyebrow>
                {time && <span className="font-mono text-[11px] text-parchment-500">{time}</span>}
            </div>
            <AssistantMarkdown content={message.content} isStreaming={isStreaming} />
            {isInterrupted && <span className="font-ui text-[11px] italic text-parchment-400">— stopped</span>}
            {appliedChanges.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                    {appliedChanges.map((change, index) => {
                        const { label, title } = formatAppliedChange(change)
                        return change.kind === 'replace' ? (
                            <Badge key={index} tone="arcane" icon={<Sparkles size={12} />}>{label}</Badge>
                        ) : (
                            <Badge key={index} tone="live" icon={<Check size={12} />} title={title}>{label}</Badge>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
