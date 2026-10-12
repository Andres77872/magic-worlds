import { describe, expect, it } from 'vitest'
import { replyLinkOpensInNewTab } from './replyLinks'

describe('replyLinkOpensInNewTab', () => {
    it('keeps record links on the thread, where they preview', () => {
        expect(replyLinkOpensInNewTab('#/gallery/characters?card=c-lyra')).toBe(false)
        expect(replyLinkOpensInNewTab('#/gallery/personas?card=p-dan')).toBe(false)
        expect(replyLinkOpensInNewTab('#/gallery/adventures?card=a-conclave')).toBe(false)
        expect(replyLinkOpensInNewTab('#/lorebook?lorebook=l-resonance')).toBe(false)
    })

    it('opens app pages, novels and resources in a new tab', () => {
        expect(replyLinkOpensInNewTab('#/world')).toBe(true)
        expect(replyLinkOpensInNewTab('#/item')).toBe(true)
        expect(replyLinkOpensInNewTab('#/gallery/items')).toBe(true)
        expect(replyLinkOpensInNewTab('#/story?story=s-1')).toBe(true)
        expect(replyLinkOpensInNewTab('#/gallery/resources?resource=r-1')).toBe(true)
    })

    it('opens the web in a new tab', () => {
        expect(replyLinkOpensInNewTab('https://example.com/lore')).toBe(true)
    })

    it('leaves links to nowhere and other schemes alone', () => {
        expect(replyLinkOpensInNewTab('#/no-such-page')).toBe(false)
        expect(replyLinkOpensInNewTab('mailto:hello@example.com')).toBe(false)
        expect(replyLinkOpensInNewTab(undefined)).toBe(false)
    })
})
