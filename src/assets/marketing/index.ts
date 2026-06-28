/**
 * Typed barrel for the generated marketing art (candlelit Reverie illustrations).
 * Importing a `.webp`/`.png` through Vite yields a hashed URL string, so these
 * maps let consumers index by the ids/keys they already use (create-action key,
 * showcase world id) instead of building asset paths by hand.
 *
 * NOTE: these are STATIC assets — render them with a plain <img> or the
 * `Illustration` primitive, never `Portrait`/`AuthenticatedImage` (those fetch
 * protected media blobs through the authed media hook).
 */
import heroImage from './hero.webp'
import notFoundImage from './not-found.webp'

import adventuresImg from './features/adventures.webp'
import charactersImg from './features/characters.webp'
import itemsImg from './features/items.webp'
import lorebookImg from './features/lorebook.webp'
import storyWriterImg from './features/story-writer.webp'
import themeSongsImg from './features/theme-songs.webp'
import voiceTtsImg from './features/voice-tts.webp'
import worldsImg from './features/worlds.webp'

import lyraImg from './showcase/lyra.webp'
import kaelImg from './showcase/kael.webp'
import sorenImg from './showcase/soren.webp'
import miraImg from './showcase/mira.webp'
import vexImg from './showcase/vex.webp'
import wrenImg from './showcase/wren.webp'

import docsHeroImg from './docs/hero.webp'
import docsMapImg from './docs/map.webp'
import docsLibraryImg from './docs/library.webp'
import docsCardsImg from './docs/cards.webp'
import docsPlayImg from './docs/play.webp'
import docsVoicePresetsImg from './docs/voice-presets.webp'
import docsVoiceImg from './docs/voice.webp'
import docsWritingImg from './docs/writing.webp'
import docsMediaImg from './docs/media.webp'
import docsBestPracticesImg from './docs/best-practices.webp'

import legalAboutImg from './legal/about.webp'
import legalContactImg from './legal/contact.webp'
import legalPrivacyImg from './legal/privacy.webp'
import legalDisclaimerImg from './legal/disclaimer.webp'

import wordmarkLight from '@/assets/brand/wordmark.png' // light lockup — for dark surfaces
import wordmarkDark from '@/assets/brand/wordmark-ink.png' // dark lockup — for light surfaces

/** Wide candlelit hero tableau (2560×1440). */
export const heroArt = heroImage

/** "Lost on a fading map" tableau (1536×1024) — the 404 / not-found view hero. */
export const notFoundArt = notFoundImage

/**
 * Per-feature illustration, keyed by the create-action key (matches
 * `CREATE_ACTIONS[].key` and the `landing.create.*` i18n). `novel` maps to the
 * story-writer art; `themeSong`/`voice` are gallery-only additions.
 */
export const featureArt = {
    character: charactersImg,
    world: worldsImg,
    item: itemsImg,
    adventure: adventuresImg,
    novel: storyWriterImg,
    lorebook: lorebookImg,
    themeSong: themeSongsImg,
    voice: voiceTtsImg,
} as const
export type FeatureArtKey = keyof typeof featureArt

/** Showcase character portrait, keyed by `ShowcaseWorld.id`. */
export const showcaseArt: Record<string, string> = {
    lyra: lyraImg,
    kael: kaelImg,
    soren: sorenImg,
    mira: miraImg,
    vex: vexImg,
    wren: wrenImg,
}

/** Docs page hero banner (its own art, not the landing hero). */
export const docsHeroArt = docsHeroImg

/** Per-docs-section banner, keyed by the section id used in `docsContent.ts`. */
export const docsArt: Record<string, string> = {
    map: docsMapImg,
    library: docsLibraryImg,
    cards: docsCardsImg,
    play: docsPlayImg,
    'voice-presets': docsVoicePresetsImg,
    voice: docsVoiceImg,
    writing: docsWritingImg,
    resources: lorebookImg,
    media: docsMediaImg,
    'best-practices': docsBestPracticesImg,
}

/** Per-legal-page banner, keyed by `LegalPageId`. */
export const legalArt: Record<string, string> = {
    about: legalAboutImg,
    contact: legalContactImg,
    privacy: legalPrivacyImg,
    disclaimer: legalDisclaimerImg,
}

/** Reverie wordmark lockups — `light` for dark UI, `dark` for light surfaces. */
export const wordmarks = { light: wordmarkLight, dark: wordmarkDark } as const
