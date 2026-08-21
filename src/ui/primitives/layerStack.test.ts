import { beforeEach, describe, expect, it } from 'vitest'
import { isTopLayer, lockScroll, openLayerCount, popLayer, pushLayer, unlockScroll } from './layerStack'

describe('layerStack', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main data-app-main style="overflow-y:auto"></main>'
        document.body.style.overflow = ''
    })

    it('treats only the frontmost layer as top, and hands the crown back on pop', () => {
        const drawer = pushLayer('drawer')
        expect(isTopLayer(drawer)).toBe(true)

        // A lightbox opened from inside the drawer: Escape must reach the lightbox alone.
        const lightbox = pushLayer('lightbox')
        expect(isTopLayer(drawer)).toBe(false)
        expect(isTopLayer(lightbox)).toBe(true)

        popLayer(lightbox)
        expect(isTopLayer(drawer)).toBe(true)
        popLayer(drawer)
        expect(openLayerCount()).toBe(0)
    })

    it('ignores a repeated pop instead of unseating the layer beneath', () => {
        const a = pushLayer('a')
        const b = pushLayer('b')
        popLayer(b)
        popLayer(b)
        expect(isTopLayer(a)).toBe(true)
        popLayer(a)
        expect(openLayerCount()).toBe(0)
    })

    it('ref-counts the scroll lock and restores the scroller to its previous value', () => {
        const main = document.querySelector<HTMLElement>('[data-app-main]')!
        main.style.overflow = 'scroll'

        lockScroll()
        expect(main.style.overflow).toBe('hidden')
        lockScroll()
        unlockScroll()
        // Still one layer holding the lock.
        expect(main.style.overflow).toBe('hidden')
        unlockScroll()
        expect(main.style.overflow).toBe('scroll')
        expect(document.body.style.overflow).toBe('')
    })

    it('cannot be driven negative by a stray unlock', () => {
        unlockScroll()
        const main = document.querySelector<HTMLElement>('[data-app-main]')!
        lockScroll()
        expect(main.style.overflow).toBe('hidden')
        unlockScroll()
        expect(main.style.overflow).toBe('')
    })
})
