import type { StoryFactData, StoryPlanItem, StoryTaskData } from '@/shared'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'

/** One staged item per reply position, so a reply cannot be sent to Facts or Tasks twice. */
export const assistantFactRef = (messageId: number, index: number) => `novel-reply:${messageId}#${index}`
export const assistantIssueRef = (messageId: number, index: number) => `novel-reply:${messageId}#issue-${index}`
export const assistantNoteRef = (messageId: number, index: number) => `novel-reply:${messageId}#note-${index}`
export const assistantStepRef = (messageId: number, index: number) => `novel-reply:${messageId}#step-${index}`

const clip = (value: string, limit: number) => Array.from(value).slice(0, limit).join('')
const passageQuote = (record: NovelAssistantRecord, sceneId: string, passage: string) =>
    record.context.packet.sources.find((source) => source.sceneId === sceneId)?.passages.find((row) => row.id === passage)?.quote.trim() ?? ''

/** The planning fact a reply proposes: it holds from its evidence scene and keeps that passage as its source. */
export function assistantFactData(record: NovelAssistantRecord, messageId: number, index: number): StoryFactData {
    const fact = record.result.facts![index]
    const quote = fact.excerpt ?? clip(passageQuote(record, fact.sceneId, fact.passage), 2000)
    return {
        subject: fact.subject, kind: fact.kind, statement: fact.statement, ...(fact.object ? { object: fact.object } : {}),
        fromSceneId: fact.sceneId, sourceSceneId: fact.sceneId, ...(quote ? { quote } : {}), sourceRevision: fact.revision,
        origin: 'assistant', originRef: assistantFactRef(messageId, index),
    }
}

/**
 * The continuity task a reply's issue becomes: anchored on its first evidence passage, with the
 * certainty and the other cited passages written into the body in the author's language.
 */
export function assistantIssueTask(record: NovelAssistantRecord, messageId: number, index: number,
    label: { certainty: string; also: (scene: string, quote: string) => string; scene: (sceneId: string) => string; fact?: (id: string) => string }): StoryTaskData {
    const issue = record.result.issues![index], [first, ...rest] = issue.evidence
    const quote = first.excerpt ?? clip(passageQuote(record, first.sceneId, first.passage), 2000)
    const others = rest.map((row) => label.also(label.scene(row.sceneId), clip(row.excerpt ?? passageQuote(record, row.sceneId, row.passage), 300)))
    return {
        title: issue.title, body: clip([issue.detail, ...(label.fact ? (issue.facts ?? []).map(label.fact) : []), label.certainty, ...others].join('\n\n'), 8000),
        sceneId: first.sceneId, ...(quote ? { quote } : {}), sourceRevision: first.revision,
        origin: 'continuity', originRef: assistantIssueRef(messageId, index),
    }
}

/**
 * The critique task a reply's note becomes: anchored on its first evidence passage, with the aspect,
 * every revision option and the other cited passages written into the body in the author's language.
 */
export function assistantNoteTask(record: NovelAssistantRecord, messageId: number, index: number,
    label: { aspect: string; option: (option: string) => string; also: (scene: string, quote: string) => string; scene: (sceneId: string) => string }): StoryTaskData {
    const note = record.result.notes![index], [first, ...rest] = note.evidence
    const quote = first.excerpt ?? clip(passageQuote(record, first.sceneId, first.passage), 2000)
    const others = rest.map((row) => label.also(label.scene(row.sceneId), clip(row.excerpt ?? passageQuote(record, row.sceneId, row.passage), 300)))
    return {
        title: note.title, body: clip([note.observation, ...note.options.map(label.option), label.aspect, ...others].join('\n\n'), 8000),
        sceneId: first.sceneId, ...(quote ? { quote } : {}), sourceRevision: first.revision,
        origin: 'critique', originRef: assistantNoteRef(messageId, index),
    }
}

/** A plan step tracked as an open task on its scene; the step's instruction is the body. */
export function assistantStepTask(record: NovelAssistantRecord, messageId: number, index: number,
    label: { title: (plan: string, number: number, total: number) => string; revision: (revision: number) => string }): StoryTaskData {
    const plan = record.result.plan!, step = plan.steps[index]
    return {
        title: clip(label.title(plan.title, index + 1, plan.steps.length), 200), body: clip([step.instruction, label.revision(step.revision)].join('\n\n'), 8000),
        sceneId: step.sceneId, sourceRevision: step.revision, origin: 'plan', originRef: assistantStepRef(messageId, index),
    }
}

/** Reply positions already staged, whatever their review state. */
export function sentAssistantFacts(items: readonly StoryPlanItem<'fact'>[]): ReadonlySet<string> {
    return new Set(items.flatMap((item) => item.data.origin === 'assistant' && item.data.originRef ? [item.data.originRef] : []))
}
export function sentAssistantTasks(items: readonly StoryPlanItem<'task'>[], origin: StoryTaskData['origin']): ReadonlyMap<string, StoryPlanItem<'task'>> {
    return new Map(items.flatMap((item) => item.data.origin === origin && item.data.originRef ? [[item.data.originRef, item] as const] : []))
}
export function sentAssistantIssues(items: readonly StoryPlanItem<'task'>[]): ReadonlySet<string> {
    return new Set(sentAssistantTasks(items, 'continuity').keys())
}
