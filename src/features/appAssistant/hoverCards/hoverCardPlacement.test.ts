import { describe, expect, it } from 'vitest'
import { placeHoverCard } from './hoverCardPlacement'

const viewport = { width: 1280, height: 800 }
const size = { width: 300, height: 260 }
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height })

describe('placeHoverCard', () => {
    it('opens under a thread link', () => {
        expect(placeHoverCard({ anchor: rect(400, 200, 80, 20), host: null, size, viewport })).toEqual({ left: 400, top: 226 })
    })

    it('flips above when the viewport runs out below', () => {
        expect(placeHoverCard({ anchor: rect(400, 700, 80, 20), host: null, size, viewport })).toEqual({ left: 400, top: 434 })
    })

    it('keeps the card inside the right edge', () => {
        expect(placeHoverCard({ anchor: rect(1200, 200, 60, 20), host: null, size, viewport }).left).toBe(1280 - 300 - 8)
    })

    it('opens a nested card beside its host card, right first', () => {
        const host = rect(100, 150, 300, 260)
        expect(placeHoverCard({ anchor: rect(150, 260, 60, 18), host, size, viewport })).toEqual({ left: 408, top: 246 })
    })

    it('uses the left side when the right one is full', () => {
        const host = rect(900, 150, 300, 260)
        expect(placeHoverCard({ anchor: rect(950, 260, 60, 18), host, size, viewport }).left).toBe(900 - 8 - 300)
    })

    it('falls back under the link when neither side has room', () => {
        const narrow = { width: 420, height: 800 }
        const host = rect(60, 100, 300, 260)
        expect(placeHoverCard({ anchor: rect(100, 200, 60, 18), host, size, viewport: narrow })).toEqual({ left: 100, top: 224 })
    })
})
