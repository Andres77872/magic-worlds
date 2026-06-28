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
    tokens: ['--color-verdant-500', '--color-blood-300', '--color-blood-500', '--color-amber-500', '--color-on-ember'],
  },
]

/**
 * The semantic / role layer: tokens named for *intent* that point at the raw
 * ramps above. Prefer these in components so a palette shift is a single token
 * edit and the meaning reads at the call site.
 */
export const SEMANTIC_COLORS: ColorGroup[] = [
  {
    label: 'Foreground — text & icons',
    note: 'Maps onto the parchment ramp. fg = parchment-50 (primary) · muted = parchment-200 (secondary) · subtle = parchment-300 (muted) · faint = parchment-400 (placeholders).',
    tokens: ['--color-fg', '--color-fg-muted', '--color-fg-subtle', '--color-fg-faint'],
  },
  {
    label: 'Surfaces — backgrounds by depth',
    note: 'Maps onto the ink ramp. surface = ink-800 (page/base) · raised = ink-700 (cards, controls) · overlay = ink-600 (popovers, raised wells) · sunken = ink-900 (deepest wells, scrims).',
    tokens: ['--color-surface', '--color-surface-raised', '--color-surface-overlay', '--color-surface-sunken'],
  },
  {
    label: 'Accents — action & AI',
    note: 'accent = ember-500 (primary action / focus) · accent-hover = ember-400 · accent-ai = arcane-500 (the AI / magic side). Reach for accent over a raw ember step.',
    tokens: ['--color-accent', '--color-accent-hover', '--color-accent-ai'],
  },
  {
    label: 'Lines — hairline borders',
    note: 'Parchment at low alpha. line = ~12% (default hairline) · line-faint = ~8% (quietest divider) · line-strong = ~22% (emphasised edge). An accent border signals the active state.',
    tokens: ['--color-line', '--color-line-faint', '--color-line-strong'],
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
  // ambient elevation
  { token: '--shadow-sm', label: 'sm' },
  { token: '--shadow-md', label: 'md · default lift' },
  { token: '--shadow-lg', label: 'lg' },
  { token: '--shadow-xl', label: 'xl' },
  // candlelight glow — ember (you) / arcane (AI), at three intensities
  { token: '--shadow-glow-ember', label: 'glow-ember' },
  { token: '--shadow-glow-ember-strong', label: 'glow-ember-strong' },
  { token: '--shadow-glow-ember-soft', label: 'glow-ember-soft · IconTile' },
  { token: '--shadow-glow-arcane', label: 'glow-arcane' },
  { token: '--shadow-glow-arcane-strong', label: 'glow-arcane-strong' },
  { token: '--shadow-glow-arcane-soft', label: 'glow-arcane-soft · IconTile' },
  // identity rings — a solid ring + halo around an Avatar
  { token: '--shadow-ring-ember', label: 'ring-ember · Avatar (you)' },
  { token: '--shadow-ring-arcane', label: 'ring-arcane · Avatar (AI)' },
  // input focus glow (the field-level twin of the global focus ring)
  { token: '--shadow-input-focus', label: 'input-focus' },
  { token: '--shadow-input-focus-arcane', label: 'input-focus-arcane' },
  // card hover — elevation + glow combined, in one box-shadow
  { token: '--shadow-card-hover', label: 'card-hover' },
  { token: '--shadow-card-hover-arcane', label: 'card-hover-arcane' },
  // tonal elevation — semantic hue at emphasis alpha (Toast)
  { token: '--shadow-glow-verdant', label: 'glow-verdant · Toast' },
  { token: '--shadow-glow-blood', label: 'glow-blood · Toast' },
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
  { token: '--text-eyebrow', label: 'eyebrow · tracked caps', family: '--font-ui', sample: 'CREATION STUDIO' },
  { token: '--text-meta', label: 'meta · badges & counts', family: '--font-ui', sample: 'Featured · 14 turns' },
  { token: '--text-micro', label: 'micro · tiniest meta', family: '--font-mono', sample: 'turn 014 · 21:47' },
]
