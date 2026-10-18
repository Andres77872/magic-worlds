import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { getRoadmapContent, ROADMAP_STAGES, roadmapStage } from './roadmapContent'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('roadmapStage', () => {
    it.each([
        ['implemented', null, 'available'],
        ['implemented', true, 'available'],
        ['implemented', false, 'off'],
        ['partial', true, 'progress'],
        ['partial', false, 'off'],
        ['planned', true, 'planned'],
        ['planned', null, 'planned'],
    ] as const)('maps %s / enabled=%s to %s', (state, enabled, stage) => {
        expect(roadmapStage(state, enabled)).toBe(stage)
    })
})

describe('getRoadmapContent', () => {
    it.each(['en', 'es'])('resolves every roadmap string in %s', (language) => {
        const roadmap = getRoadmapContent(i18n.getFixedT(language))
        const strings = [
            roadmap.title,
            roadmap.intro,
            roadmap.note,
            ...Object.values(roadmap.labels),
            ...ROADMAP_STAGES.flatMap((stage) => [roadmap.stages[stage].label, roadmap.stages[stage].description]),
            ...roadmap.initiatives.flatMap((initiative) => [
                initiative.title,
                initiative.tagline,
                initiative.scope,
                initiative.progress,
                ...initiative.today,
                ...initiative.phases.flatMap((phase) => [phase.title, phase.body, phase.statusLabel, phase.dependsLabel]),
            ]),
            ...roadmap.items.flatMap((item) => [item.title, item.status, item.availability, item.current, item.next, item.decision]),
            ...roadmap.done.flatMap((entry) => [entry.title, entry.body, entry.areaTitle]),
        ]
        for (const value of strings) {
            expect(value).not.toMatch(/^docs\./)
            expect(value).not.toContain('{{')
        }
    })

    it('files every completed entry under an existing area', () => {
        const roadmap = getRoadmapContent(i18n.getFixedT('en'))
        const areas = new Set(roadmap.items.map((item) => item.id))
        expect(roadmap.done.length).toBeGreaterThan(0)
        for (const entry of roadmap.done) {
            expect(areas.has(entry.area)).toBe(true)
            expect(entry.areaTitle).not.toBe('')
        }
    })

    it('shows the new cross-cutting areas as work in progress without a product flag', () => {
        const roadmap = getRoadmapContent(i18n.getFixedT('en'))
        for (const id of ['models', 'contentSafety']) {
            const item = roadmap.items.find((entry) => entry.id === id)
            expect(item?.state).toBe('partial')
            expect(item?.enabled).toBeNull()
            expect(item?.stage).toBe('progress')
        }
    })

    it('shows group voice calls as planned next to the 1:1 calls area', () => {
        const roadmap = getRoadmapContent(i18n.getFixedT('en'))
        const ids = roadmap.items.map((item) => item.id)
        const groupCalls = roadmap.items.find((item) => item.id === 'groupCalls')
        expect(groupCalls?.state).toBe('planned')
        expect(groupCalls?.stage).toBe('planned')
        expect(ids.indexOf('groupCalls')).toBe(ids.indexOf('calls') + 1)
    })

    it('details the assistant tools and content safety plans on their area cards', () => {
        const roadmap = getRoadmapContent(i18n.getFixedT('en'))
        for (const id of ['appAssistant', 'contentSafety'] as const) {
            const initiative = roadmap.initiatives.find((entry) => entry.id === id)
            expect(roadmap.items.find((item) => item.id === id)?.initiative).toBe(id)
            expect(initiative?.phases.every((phase) => phase.status !== 'done' && phase.status !== 'current')).toBe(true)
        }
        expect(roadmap.initiatives.find((entry) => entry.id === 'contentSafety')?.stage).toBe('progress')
    })

    it('only lets phases build on earlier phases', () => {
        const roadmap = getRoadmapContent(i18n.getFixedT('en'))
        for (const initiative of roadmap.initiatives) {
            initiative.phases.forEach((phase, index) => {
                expect(phase.number).toBe(index + 1)
                for (const dependency of phase.dependsOn) expect(dependency).toBeLessThan(phase.number)
            })
            expect(initiative.phases.filter((phase) => phase.status === 'current').length).toBeLessThanOrEqual(1)
        }
    })

    it('ties each initiative to its area status for this version', () => {
        setTestFeatureFlags({ novels: false })
        const off = getRoadmapContent(i18n.getFixedT('en'))
        expect(off.initiatives.find((initiative) => initiative.id === 'novels')?.stage).toBe('off')
        expect(off.items.find((item) => item.id === 'novels')?.initiative).toBe('novels')

        setTestFeatureFlags({ novels: true })
        const on = getRoadmapContent(i18n.getFixedT('en'))
        expect(on.initiatives.find((initiative) => initiative.id === 'novels')?.stage).toBe('progress')
        expect(on.initiatives.find((initiative) => initiative.id === 'charaStudio')?.stage).toBe('planned')
    })
})
