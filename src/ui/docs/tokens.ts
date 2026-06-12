/**
 * Token *names* only. The swatch components in Swatch.tsx read each token's
 * resolved value live from theme.css via getComputedStyle, so these docs never
 * duplicate a hex/size — theme.css stays the single source of truth.
 */

export interface ColorGroup {
  label: string
  note: string
  tokens: string[]
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    label: 'Ink — the dark canvas',
    note: 'Depth comes from lightening surfaces, not heavy shadows. ink-800 is the default canvas.',
    tokens: ['--color-ink-900', '--color-ink-800', '--color-ink-700', '--color-ink-600', '--color-ink-500'],
  },
  {
    label: 'Parchment — warm foreground',
    note: 'Never pure white. parchment-50 is primary text; lower steps are secondary and muted.',
    tokens: [
      '--color-parchment-50',
      '--color-parchment-100',
      '--color-parchment-200',
      '--color-parchment-300',
      '--color-parchment-400',
      '--color-parchment-500',
    ],
  },
  {
    label: 'Ember — primary accent (candlelight gold)',
    note: 'The single hero accent: primary actions, active states, the player’s own voice, focus rings, the logo flame.',
    tokens: ['--color-ember-300', '--color-ember-400', '--color-ember-500', '--color-ember-600', '--color-ember-700'],
  },
  {
    label: 'Arcane — AI / magic',
    note: 'Marks the AI side: the character’s avatar ring and the “thinking” shimmer. Used sparingly so it stays special.',
    tokens: ['--color-arcane-300', '--color-arcane-400', '--color-arcane-500', '--color-arcane-600', '--color-arcane-700'],
  },
  {
    label: 'Semantic',
    note: 'verdant = success · blood = danger · amber = warning · on-ember = dark text on ember fills.',
    tokens: ['--color-verdant-500', '--color-blood-500', '--color-amber-500', '--color-on-ember'],
  },
]

export const RADII: string[] = [
  '--radius-xs',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
]

export interface ShadowToken {
  token: string
  label: string
}

export const SHADOWS: ShadowToken[] = [
  { token: '--shadow-sm', label: 'sm' },
  { token: '--shadow-md', label: 'md · default lift' },
  { token: '--shadow-lg', label: 'lg' },
  { token: '--shadow-xl', label: 'xl' },
  { token: '--shadow-glow-ember', label: 'glow-ember' },
  { token: '--shadow-glow-arcane', label: 'glow-arcane' },
  { token: '--shadow-card-hover', label: 'card-hover' },
]

export interface FontToken {
  token: string
  name: string
  role: string
  sample: string
}

export const FONTS: FontToken[] = [
  { token: '--font-display', name: 'Cormorant Garamond', role: 'Display & character names', sample: 'Worlds that talk back' },
  { token: '--font-narrative', name: 'Spectral', role: 'Narrative / roleplay prose', sample: 'You arrive at the tavern as the rain begins.' },
  { token: '--font-ui', name: 'Hanken Grotesk', role: 'UI chrome — buttons, labels, nav, fields', sample: 'Continue your scene' },
  { token: '--font-mono', name: 'Space Mono', role: 'Meta — timestamps, turn counters', sample: 'turn 014 · 21:47' },
]

export interface TypeToken {
  token: string
  label: string
  family: string
  sample: string
}

export const TYPE_SCALE: TypeToken[] = [
  { token: '--text-display', label: 'display', family: '--font-display', sample: 'Reverie' },
  { token: '--text-h1', label: 'h1', family: '--font-display', sample: 'Worlds that talk back' },
  { token: '--text-h2', label: 'h2', family: '--font-display', sample: 'Featured worlds' },
  { token: '--text-h3', label: 'h3', family: '--font-display', sample: 'Your characters' },
  { token: '--text-narrative', label: 'narrative', family: '--font-narrative', sample: 'She looks up — and recognizes you.' },
  { token: '--text-body', label: 'body', family: '--font-ui', sample: 'Write your reply — dialogue or action.' },
  { token: '--text-label', label: 'label', family: '--font-ui', sample: 'Character name' },
  { token: '--text-caption', label: 'caption', family: '--font-ui', sample: 'Lyra will remember this.' },
]
