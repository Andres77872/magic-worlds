/**
 * Live design-token specimens for the Design System MDX docs. Every value is
 * read at runtime from theme.css (via getComputedStyle), so nothing here
 * duplicates a hex or size — theme.css is the single source of truth.
 *
 * Specimens render on a dark "Stage" so the candlelit palette reads correctly
 * even though the surrounding Storybook docs page is light.
 */
import type { CSSProperties, ReactNode } from 'react'
import { COLOR_GROUPS, FONTS, RADII, SEMANTIC_COLORS, SHADOWS, TYPE_SCALE, type ShadowToken } from './tokens'

/**
 * Resolve a CSS custom property's live value from theme.css. getComputedStyle
 * flushes pending styles, so reading during render returns the real value with
 * no effect/state needed (the tokens are static at runtime).
 */
function resolveVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const mono: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 }
const hairline = '1px solid rgba(246,239,226,.13)'

/** Dark candlelit panel that wraps every specimen. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-ink-900)',
        border: '1px solid rgba(246,239,226,.08)',
        borderRadius: 16,
        padding: 24,
        margin: '20px 0',
        color: 'var(--color-parchment-50)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {children}
    </div>
  )
}

function GroupLabel({ label, note }: { label: string; note: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-parchment-50)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--color-parchment-300)', maxWidth: '60ch' }}>{note}</div>
    </div>
  )
}

function ColorSwatch({ token }: { token: string }) {
  const hex = resolveVar(token)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 92 }}>
      <div style={{ height: 56, borderRadius: 10, background: `var(${token})`, boxShadow: `inset 0 0 0 ${hairline}` }} />
      <div style={{ ...mono, color: 'var(--color-parchment-50)' }}>{token.replace('--color-', '')}</div>
      <div style={{ ...mono, color: 'var(--color-parchment-300)' }}>{hex || '…'}</div>
    </div>
  )
}

/** All color scales (ink, parchment, ember, arcane, semantic). */
export function ColorScales() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {COLOR_GROUPS.map((group) => (
          <div key={group.label}>
            <GroupLabel label={group.label} note={group.note} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {group.tokens.map((t) => (
                <ColorSwatch key={t} token={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

/** The semantic / role color tokens, grouped and read live like ColorScales. */
export function SemanticScales() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {SEMANTIC_COLORS.map((group) => (
          <div key={group.label}>
            <GroupLabel label={group.label} note={group.note} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {group.tokens.map((t) => (
                <ColorSwatch key={t} token={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

/** The four font families with their job + a live specimen. */
export function FontFamilies() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {FONTS.map((f) => (
          <div key={f.token} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ ...mono, color: 'var(--color-ember-300)' }}>
              {f.name} · {f.token}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-parchment-300)' }}>{f.role}</div>
            <div style={{ fontFamily: `var(${f.token})`, fontSize: 30, color: 'var(--color-parchment-50)', lineHeight: 1.2 }}>
              {f.sample}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

/** The semantic type scale, each row rendered at its real size + family. */
export function TypeScale() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {TYPE_SCALE.map((t) => (
          <div key={t.token} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ ...mono, color: 'var(--color-parchment-300)' }}>
              {t.label} · {t.token}
            </div>
            <div
              style={{
                fontFamily: `var(${t.family})`,
                fontSize: `var(${t.token})`,
                // render the token's own tracking where it defines one (display, eyebrow)
                letterSpacing: `var(${t.token}--letter-spacing, normal)`,
                color: 'var(--color-parchment-50)',
                lineHeight: 1.15,
              }}
            >
              {t.sample}
            </div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

function RadiusSwatch({ token }: { token: string }) {
  const value = resolveVar(token)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div
        style={{
          width: 84,
          height: 64,
          borderRadius: `var(${token})`,
          background: 'var(--color-ink-600)',
          border: hairline,
        }}
      />
      <div style={{ ...mono, color: 'var(--color-parchment-50)' }}>{token.replace('--radius-', 'radius-')}</div>
      <div style={{ ...mono, color: 'var(--color-parchment-300)' }}>{value || '…'}</div>
    </div>
  )
}

export function RadiusScale() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {RADII.map((t) => (
          <RadiusSwatch key={t} token={t} />
        ))}
      </div>
    </Stage>
  )
}

function ShadowSwatch({ token, label }: { token: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div
        style={{
          width: 120,
          height: 80,
          borderRadius: 12,
          background: 'var(--color-ink-700)',
          boxShadow: `var(${token})`,
        }}
      />
      <div style={{ ...mono, color: 'var(--color-parchment-50)' }}>{label}</div>
    </div>
  )
}

export function ShadowScale() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, rowGap: 32 }}>
        {SHADOWS.map((s) => (
          <ShadowSwatch key={s.token} token={s.token} label={s.label} />
        ))}
      </div>
    </Stage>
  )
}

/** The global focus-ring composites (a 2px ink gap + a 4px accent band). */
const RINGS: ShadowToken[] = [
  { token: '--ring-ember', label: 'ring-ember · default focus' },
  { token: '--ring-arcane', label: 'ring-arcane · AI surfaces' },
  { token: '--ring-danger', label: 'ring-danger · destructive' },
]

export function FocusRings() {
  return (
    <Stage>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36, rowGap: 28 }}>
        {RINGS.map((r) => (
          <div key={r.token} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div
              style={{
                ...mono,
                width: 132,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-ink-700)',
                color: 'var(--color-parchment-200)',
                boxShadow: `var(${r.token})`,
              }}
            >
              focus
            </div>
            <div style={{ ...mono, color: 'var(--color-parchment-300)' }}>{r.label}</div>
          </div>
        ))}
      </div>
    </Stage>
  )
}

/** Motion: easing/duration tokens + the live "thinking" pulse and hover-lift. */
export function MotionSpecimen() {
  const easeOut = resolveVar('--ease-out')
  const easeInOut = resolveVar('--ease-in-out')
  const dur = resolveVar('--default-transition-duration')
  return (
    <Stage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <div style={mono}>
          <span style={{ color: 'var(--color-ember-300)' }}>--ease-out</span>
          <span style={{ color: 'var(--color-parchment-300)' }}> {easeOut || '…'} — entrances, hover</span>
        </div>
        <div style={mono}>
          <span style={{ color: 'var(--color-ember-300)' }}>--ease-in-out</span>
          <span style={{ color: 'var(--color-parchment-300)' }}> {easeInOut || '…'} — looping / the think pulse</span>
        </div>
        <div style={mono}>
          <span style={{ color: 'var(--color-ember-300)' }}>--default-transition-duration</span>
          <span style={{ color: 'var(--color-parchment-300)' }}> {dur || '…'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {/* The AI "thinking" pulse — drives the character avatar while generating. */}
          <span
            className="animate-think"
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              display: 'inline-block',
              background: 'var(--color-arcane-500)',
            }}
          />
          <span style={{ ...mono, color: 'var(--color-parchment-300)' }}>animate-think</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {/* Hover this card — lift + ember glow on --ease-out. */}
          <span className="transition-all hover:-translate-y-1 hover:shadow-card-hover" style={{ width: 120, height: 48, borderRadius: 12, display: 'inline-block', background: 'var(--color-ink-600)', border: hairline }} />
          <span style={{ ...mono, color: 'var(--color-parchment-300)' }}>hover — lift + glow</span>
        </div>
      </div>
    </Stage>
  )
}
