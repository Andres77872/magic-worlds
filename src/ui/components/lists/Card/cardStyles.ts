/**
 * Shared card-state class strings — kept in one place so every card surface
 * (the shared `Card`/`GalleryCard` and the hand-rolled feature cards) expresses
 * the same interaction grammar.
 */

/**
 * Selected / highlighted surface: ember border + ring. Deliberately glow-free so
 * it reads identically on both spacious card tiles and dense list/picker rows;
 * tiles that want the candlelit glow add `shadow-card-hover` alongside it.
 */
export const SELECTED_CARD_CLASS = 'border-ember-500/55 ring-1 ring-ember-500/40'

/**
 * Hover/focus-revealed action cluster: always visible on touch (which has no
 * hover), hidden on desktop until the card is hovered or focus moves inside it.
 */
export const CARD_ACTION_REVEAL_CLASS =
    'opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
