import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fixture from '@/test/fixtures/storyOutlinePreview.json'
import type { StoryOutlinePreview } from '@/shared/types/storyOutline.types'
import { apiService } from './index'
import { isStoryOutlinePlan, selectOutlineChapters, verifyStoryOutlinePreview } from './storyOutlineContract'

const preview = () => structuredClone(fixture.preview) as StoryOutlinePreview
const fetchMock = vi.fn()
beforeEach(() => { setTestFeatureFlags({ novels: true }); localStorage.setItem('magic_worlds:token', 'outline-token'); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); localStorage.clear() })

it('accepts the actual Python preview and refuses changed counts, levels, notes and plan shapes', () => {
    expect(verifyStoryOutlinePreview(preview(), null)).toBe(true)
    // A chosen level must be the level the server read.
    expect(verifyStoryOutlinePreview(preview(), 3)).toBe(false)
    const corruptions: Array<(value: StoryOutlinePreview) => void> = [
        (value) => { value.counts.beats = 3 },
        (value) => { value.detectedLevel = 9 },
        (value) => { (value.notes as Record<string, number>).other = 1 },
        (value) => { value.notes.ignored = 0 },
        (value) => { value.outline.chapters[0].part = 7 },
        (value) => { value.outline.chapters[0].title = ' Untrimmed' },
        (value) => { value.outline.chapters[0].scenes = [] },
        (value) => { value.outline.chapters[0].scenes[0].beats = [''] },
        (value) => { value.outline.parts[0].synopsis = 'x'.repeat(20_001) },
        (value) => { (value as unknown as Record<string, unknown>).extra = true },
    ]
    for (const corrupt of corruptions) {
        const value = preview(); corrupt(value)
        expect(verifyStoryOutlinePreview(value, null)).toBe(false)
    }
    // Titles count characters, as the server does: 255 emoji fit although they are 510 UTF-16 units.
    const wide = preview(); wide.outline.chapters[0].title = '🌒'.repeat(255)
    expect(isStoryOutlinePlan(wide.outline)).toBe(true)
    wide.outline.chapters[0].title = '🌒'.repeat(256)
    expect(isStoryOutlinePlan(wide.outline)).toBe(false)
})

it('keeps only the outline parts the chosen chapters use and renumbers them', () => {
    const plan = preview().outline
    expect(selectOutlineChapters(plan, new Set([1]))).toEqual({ parts: [plan.parts[1]], chapters: [{ ...plan.chapters[1], part: 0 }] })
    expect(selectOutlineChapters(plan, new Set([0, 1]))).toEqual(plan)
    const loose = { ...plan, chapters: [{ ...plan.chapters[0], part: null }, plan.chapters[1]] }
    expect(selectOutlineChapters(loose, new Set([0]))).toEqual({ parts: [], chapters: [loose.chapters[0]] })
})

it('previews by text with authentication, refuses oversized text locally and an unexpected reply', async () => {
    const respond = (value: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    respond(fixture.preview)
    expect(await apiService.previewStoryOutline(fixture.text, null)).toEqual(fixture.preview)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/stories/outline-preview'); expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer outline-token' })
    expect(JSON.parse(init.body)).toEqual({ text: fixture.text, chapterLevel: null })
    await expect(apiService.previewStoryOutline('x'.repeat(500_001), null)).rejects.toMatchObject({ code: 'story_outline_request' })
    await expect(apiService.previewStoryOutline('# A', 7)).rejects.toMatchObject({ code: 'story_outline_request' })
    expect(fetchMock).toHaveBeenCalledOnce()
    respond({ ...fixture.preview, chapterLevel: 2 })
    await expect(apiService.previewStoryOutline(fixture.text, 1)).rejects.toMatchObject({ code: 'story_outline_contract' })
})
