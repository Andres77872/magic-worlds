import { novel, storyChapter, storyGeneration } from '@/test/fixtures/story'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Story, StoryGeneration } from '@/shared'
import { useGenerationHistory } from './useGenerationHistory'

function generation(id: string, overrides: Partial<StoryGeneration> = {}): StoryGeneration {
    return storyGeneration({id,storyId:'s1',chapterId:'ch1',sceneId:'sc1',output:`Output ${id}`,createdAt:`2026-08-01T00:0${id.slice(-1)}:00`,...overrides})
}
function story(generations: StoryGeneration[]): Story {
    return novel({id:'s1',chapters:[storyChapter({id:'ch1',storyId:'s1',generationHistory:generations})]})
}

describe('useGenerationHistory', () => {
    it('does not show a late result from a previously open story', () => {
        const { result, rerender } = renderHook(({ s }) => useGenerationHistory({ story: s }), { initialProps: { s: story([]) } })
        const oldRecord = result.current.record
        rerender({ s: { ...story([]), id: 's2', chapters: [] } })
        act(() => oldRecord(generation('g1'), 'Old chapter', 'Private old prompt'))
        expect(result.current.generations).toEqual([])
    })
    it('shows locally recorded generations before any story refetch, newest first', () => {
        const { result } = renderHook(() => useGenerationHistory({ story: story([generation('g1')]) }))

        act(() => result.current.record(generation('g2'), 'Chapter 1'))

        expect(result.current.generations.map((item) => item.id)).toEqual(['g2', 'g1'])
        expect(result.current.generations[0].chapterTitle).toBe('Chapter 1')
    })

    it('keeps the prompt the writer typed when the server copy arrives without one', () => {
        const { result, rerender } = renderHook(({ s }) => useGenerationHistory({ story: s }), {
            initialProps: { s: story([]) },
        })

        act(() => result.current.record(generation('g1'), 'Chapter 1', 'she follows him to the saltworks'))
        expect(result.current.generations[0].prompt).toBe('she follows him to the saltworks')

        // The authoritative copy has no record of what was typed. Once the beat
        // is accepted the prose is just part of the chapter, so if the merge
        // dropped the prompt it would exist nowhere at all.
        rerender({ s: story([generation('g1', { status: 'accepted' })]) })

        expect(result.current.generations[0].status).toBe('accepted')
        expect(result.current.generations[0].prompt).toBe('she follows him to the saltworks')
    })

    it('records no prompt for a command that had none', () => {
        const { result } = renderHook(() => useGenerationHistory({ story: story([]) }))

        act(() => result.current.record(generation('g1'), 'Chapter 1', '   '))

        expect(result.current.generations[0].prompt).toBeUndefined()
    })

    it('dedupes by id once the server copy arrives and keeps status patches on top', () => {
        const { result, rerender } = renderHook(({ s }) => useGenerationHistory({ story: s }), {
            initialProps: { s: story([generation('g1')]) },
        })

        act(() => result.current.record(generation('g2'), 'Chapter 1'))
        act(() => result.current.patchStatus('g2', 'rejected'))

        // Story refetch now includes g2 with the server-side status.
        rerender({ s: story([generation('g1'), generation('g2')]) })

        const items = result.current.generations
        expect(items.map((item) => item.id)).toEqual(['g2', 'g1'])
        expect(items[0].status).toBe('rejected')
    })
})
