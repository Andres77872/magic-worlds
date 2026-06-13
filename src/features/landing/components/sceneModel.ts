/**
 * Scene view-model — derives the discovery-gallery card shape from an adventure
 * template. A "scene" leads with its persona (who you become), set in its world,
 * tagged by its categories / triggers / world type. Keeping this mapping in one
 * place lets the featured hero, the grid cards, and search/filter stay in sync.
 */

import type { Adventure } from '@/shared'

export interface Scene {
    /** The originating template (kept by reference for index/edit/start/delete). */
    template: Adventure
    title: string
    /** World name (or persona race) — the small "where" label. */
    location?: string
    description: string
    tags: string[]
    monogram: string
}

function firstWords(text: string, count: number): string {
    const words = text.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return ''
    const slice = words.slice(0, count).join(' ')
    return words.length > count ? `${slice}…` : slice
}

function meaningful(value?: string | null): string {
    const text = value?.trim() ?? ''
    return text.length > 1 ? text : ''
}

/** Persona name reads best ("who will you become"); fall back to the scenario. */
export function sceneTitle(template: Adventure): string {
    const persona = meaningful(template.persona?.name)
    if (persona) return persona
    const scenario = meaningful(template.scenario)
    if (scenario) return firstWords(scenario, 5)
    return 'Untitled adventure'
}

/** Up to three genre-ish tags, preferring category names, then triggers, then world type. */
export function sceneTags(template: Adventure): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const push = (value?: string) => {
        const tag = meaningful(value)
        if (!tag) return
        const key = tag.toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        out.push(tag)
    }
    template.category?.forEach((category) => push(category.name))
    template.triggers?.forEach((trigger) => push(trigger))
    push(template.world?.type)
    return out.slice(0, 3)
}

export function toScene(template: Adventure): Scene {
    const title = sceneTitle(template)
    return {
        template,
        title,
        location: meaningful(template.world?.name) || meaningful(template.persona?.race) || undefined,
        description: meaningful(template.scenario) || 'A scene waiting to begin.',
        tags: sceneTags(template),
        monogram: title.charAt(0).toUpperCase() || '?',
    }
}

export function sceneMatchesQuery(scene: Scene, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [scene.title, scene.location, scene.description, ...scene.tags]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(q))
}

export function sceneMatchesFilter(scene: Scene, filter: string): boolean {
    if (filter === 'All') return true
    return scene.tags.some((tag) => tag.toLowerCase() === filter.toLowerCase())
}

/**
 * Genre chips reflect the tags actually present across the user's scenes.
 * Single-character scratch values read like leaked test data in a global filter.
 */
export function genresFromScenes(scenes: Scene[]): string[] {
    const byKey = new Map<string, string>()
    scenes.forEach((scene) =>
        scene.tags.forEach((tag) => {
            if (tag.trim().length < 2) return
            const key = tag.toLowerCase()
            if (!byKey.has(key)) byKey.set(key, tag)
        }),
    )
    return Array.from(byKey.values()).slice(0, 6)
}
