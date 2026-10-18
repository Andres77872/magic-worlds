import { describe, expect, it } from 'vitest'
import { assistantContextFixture } from '@/test/fixtures/storyAssistantContext'
import type { StoryAssistantAction, StoryAssistantContext } from '@/shared/types/storyAssistant.types'
import { canonicalJson } from '@/utils/json'
import { isAssistantAction, isAssistantContextRequest, verifyAssistantContext, verifyFrozenAssistantContext } from './storyAssistantContextContract'

const ABSENT = Symbol('absent')
/** The fixture's prepared turn with an action in its request and, unless absent, in its actual message. */
function withAction(action: StoryAssistantAction, task: 'ask' | 'suggest', packetAction: unknown = action, order: unknown = null) {
    const { index, request, result } = assistantContextFixture()
    const query = { ...request, task, action }
    const value: StoryAssistantContext = structuredClone(result), packet = value.packet as unknown as Record<string, unknown>
    value.request = query
    packet.task = task
    if (packetAction !== ABSENT) packet.action = packetAction
    if (order !== ABSENT) packet.readingOrder = order ?? [...value.packet.sources.map((source) => source.sceneId)].reverse()
    value.messages[1].content = canonicalJson(value.packet)
    value.trace.inputEstimate = new TextEncoder().encode(canonicalJson(value.messages)).length + 64
    return { index, query, value }
}

describe('named assistant actions', () => {
    it('accepts each action with its own task and exact parameters', () => {
        const { request } = assistantContextFixture()
        const valid: Array<[StoryAssistantAction, 'ask' | 'suggest']> = [
            [{ kind: 'transform', pov: 'first', tense: null }, 'suggest'], [{ kind: 'transform', pov: null, tense: 'present' }, 'suggest'],
            [{ kind: 'line_edit', focus: ['rhythm', 'grammar'] }, 'suggest'], [{ kind: 'dialogue', speaker: 'Mara' }, 'suggest'], [{ kind: 'bridge' }, 'suggest'],
            [{ kind: 'brainstorm', topic: 'what_if' }, 'ask'], [{ kind: 'outline', target: 'chapter_plan' }, 'ask'], [{ kind: 'summary' }, 'ask'],
        ]
        for (const [action, task] of valid) expect(isAssistantContextRequest({ ...request, task, action })).toBe(true)
        expect(isAssistantContextRequest(request)).toBe(true)
    })

    it('refuses an action for the other task, unknown or missing parameters and an explicit null', () => {
        const { request } = assistantContextFixture()
        for (const [action, task] of [
            [{ kind: 'transform', pov: 'first', tense: null }, 'ask'], [{ kind: 'summary' }, 'suggest'],
            [{ kind: 'transform', pov: null, tense: null }, 'suggest'], [{ kind: 'transform', pov: 'first' }, 'suggest'],
            [{ kind: 'line_edit', focus: [] }, 'suggest'], [{ kind: 'line_edit', focus: ['grammar', 'grammar'] }, 'suggest'],
            [{ kind: 'dialogue', speaker: ' Mara' }, 'suggest'], [{ kind: 'brainstorm', topic: 'plot' }, 'ask'],
            [{ kind: 'outline', target: 'beats', extra: true }, 'ask'], [{ kind: 'translate' }, 'ask'], [null, 'ask'],
        ] as const) expect(isAssistantContextRequest({ ...request, task, action })).toBe(false)
        expect(isAssistantAction({ kind: 'bridge', speaker: 'Mara' })).toBe(false)
    })

    it('verifies a prepared turn only when its actual message carries the same action', () => {
        const action: StoryAssistantAction = { kind: 'outline', target: 'beats' }
        const same = withAction(action, 'ask')
        expect(verifyAssistantContext(same.value, same.index, same.query)).toBe(true)
        expect(verifyFrozenAssistantContext(same.value, same.index.id)).toBe(true)
        const cases: Array<[unknown, unknown]> = [[ABSENT, null], [{ kind: 'outline', target: 'synopsis' }, null], [action, ABSENT], [action, ['missing']], [ABSENT, ABSENT]]
        for (const [packetAction, order] of cases) {
            const other = withAction(action, 'ask', packetAction, order)
            expect(verifyAssistantContext(other.value, other.index, other.query)).toBe(false)
            expect(verifyFrozenAssistantContext(other.value, other.index.id)).toBe(false)
        }
    })

    it('accepts a question without an action that lists its sources in reading order, and older ones saved without the order', () => {
        const { index, request, result } = assistantContextFixture()
        const ordered: StoryAssistantContext = structuredClone(result)
        ;(ordered.packet as unknown as Record<string, unknown>).readingOrder = ordered.packet.sources.map((source) => source.sceneId)
        ordered.messages[1].content = canonicalJson(ordered.packet)
        ordered.trace.inputEstimate = new TextEncoder().encode(canonicalJson(ordered.messages)).length + 64
        expect(verifyAssistantContext(ordered, index, request)).toBe(true)
        expect(verifyFrozenAssistantContext(ordered, index.id)).toBe(true)
        expect(verifyFrozenAssistantContext(result, index.id)).toBe(true)
        const short = structuredClone(ordered)
        ;(short.packet as unknown as Record<string, unknown>).readingOrder = ['missing']
        short.messages[1].content = canonicalJson(short.packet)
        short.trace.inputEstimate = new TextEncoder().encode(canonicalJson(short.messages)).length + 64
        expect(verifyFrozenAssistantContext(short, index.id)).toBe(false)
    })
})
