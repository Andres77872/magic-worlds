import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface StudioPanels {
    focusMode: boolean
    codexOpen: boolean
    typewriter: boolean
    narrowPanel: 'outline' | 'codex' | null
    codexScope: 'novel' | 'chapter' | 'scene'
}
export const DEFAULT_STUDIO_PANELS: Readonly<StudioPanels> = Object.freeze({
    focusMode: false, codexOpen: true, typewriter: false, narrowPanel: null, codexScope: 'novel',
})
interface View {
    selectedUnit: string | null
    panels: Readonly<StudioPanels>
    selectionUnavailable: boolean
    panelsUnavailable: boolean
}
function validId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 64
}
function validPanels(value: unknown): value is StudioPanels {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const p = value as Record<string, unknown>
    return Object.keys(p).length === 5 && typeof p.focusMode === 'boolean' && typeof p.codexOpen === 'boolean' && typeof p.typewriter === 'boolean'
        && (p.narrowPanel === null || p.narrowPanel === 'outline' || p.narrowPanel === 'codex')
        && ['novel', 'chapter', 'scene'].includes(p.codexScope as string)
}
function read(key: string | null): View {
    const result: View = { selectedUnit: null, panels: DEFAULT_STUDIO_PANELS, selectionUnavailable: false, panelsUnavailable: false }
    if (!key) return result
    try {
        const raw = localStorage.getItem(key)
        const value = raw && raw.length <= 1024 ? JSON.parse(raw) : null
        if (value && Object.keys(value).length === 1 && validId(value.sceneId)) result.selectedUnit = value.sceneId
    } catch { result.selectionUnavailable = true }
    try {
        const raw = localStorage.getItem(key + ':panels')
        const stored = raw && raw.length <= 2048 ? JSON.parse(raw) : null
        if (stored?.schemaVersion === 1) {
            const value = { ...stored }
            delete value.schemaVersion
            if (validPanels(value)) result.panels = value
        }
    } catch { result.panelsUnavailable = true }
    return result
}
export function readStudioSelection(key:string|null):string|null {return read(key).selectedUnit}

/** Optional device view state; never owns writing, author metadata or review. */
export function useStudioView(key: string | null) {
    const seed = useMemo(() => read(key), [key])
    const [state, setState] = useState({ key, value: seed })
    const value = state.key === key ? state.value : seed
    const live = useRef<{ key: string | null; value: View } | undefined>({ key, value })
    useLayoutEffect(() => { live.current = { key, value } })
    useLayoutEffect(() => () => { live.current = undefined }, [key])
    const update = useCallback((area: 'selection' | 'panels', change: (view: View) => View) => {
        if (!live.current || live.current.key !== key) return
        const next = change(live.current.value)
        if ((next.selectedUnit !== null && !validId(next.selectedUnit)) || !validPanels(next.panels)) return
        let unavailable = !key
        if (key) {
            try {
                localStorage.setItem(key + (area === 'panels' ? ':panels' : ''), JSON.stringify(area === 'selection'
                    ? { sceneId: next.selectedUnit } : { schemaVersion: 1, ...next.panels }))
            } catch { unavailable = true }
        }
        next[area === 'selection' ? 'selectionUnavailable' : 'panelsUnavailable'] = unavailable
        live.current = { key, value: next }
        setState({ key, value: next })
    }, [key])
    const selectUnit = useCallback((id: string) => update('selection', (view) => ({ ...view, selectedUnit: id })), [update])
    const panels = useCallback((change: (value: Readonly<StudioPanels>) => StudioPanels) => update('panels', (view) => ({ ...view, panels: change(view.panels) })), [update])
    return {
        selectedUnit: value.selectedUnit, ...value.panels,
        viewStorageUnavailable: value.selectionUnavailable || value.panelsUnavailable,
        selectUnit,
        toggleFocusMode: () => panels((p) => ({ ...p, focusMode: !p.focusMode, narrowPanel: !p.focusMode ? null : p.narrowPanel })),
        toggleTypewriter: () => panels((p) => ({ ...p, typewriter: !p.typewriter })),
        setCodexOpen: (codexOpen: boolean) => panels((p) => ({ ...p, codexOpen, narrowPanel: !codexOpen && p.narrowPanel === 'codex' ? null : p.narrowPanel })),
        setNarrowPanel: (narrowPanel: StudioPanels['narrowPanel']) => panels((p) => ({ ...p, narrowPanel, codexOpen: narrowPanel === 'codex' || p.codexOpen })),
        setCodexScope: (codexScope: StudioPanels['codexScope']) => panels((p) => ({ ...p, codexScope })),
    }
}
