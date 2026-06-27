# Reverie design system — how to build with it

Reverie is the dark, candlelit UI of Magic Worlds (an AI roleplay app). Surfaces are deep
**ink**, text is warm **parchment**, and two accents carry meaning: **ember** (candlelight gold)
for primary/hero actions and warmth, **arcane** (violet) for AI / magic. Destructive = **blood**
red. Components are styled with Tailwind v4 utility classes bound to Reverie design tokens.

## Wrap the app in `ReveriePreviewProvider`

Many components read app context (i18n, theme, navigation, audio). Render your tree inside
`ReveriePreviewProvider` (exported from the library) or they throw `use<X> must be used within
<Provider>` and render blank:

```jsx
import { ReveriePreviewProvider, Button, PageHeader, Card } from '<this library>'

export default function App() {
  return (
    <ReveriePreviewProvider>
      <div className="min-h-screen bg-ink-900 text-parchment-50 font-ui p-8">
        <PageHeader eyebrow="Creation Studio" title="Forge a character" />
        <Card>
          <p className="font-narrative text-parchment-300">A wandering bard of the Umbral Reach.</p>
          <Button variant="primary">Step into the story</Button>
        </Card>
      </div>
    </ReveriePreviewProvider>
  )
}
```

Leaf components that need a parent (e.g. `SwitchRow`, reference rows, list cards) must be composed
inside their container — render the real composition, never the leaf alone.

## Styling idiom: Tailwind utilities + Reverie tokens

Style layout glue with Tailwind utility classes that map to these token families (use them — do
**not** invent hex colors or font names; everything below exists in the shipped CSS):

| Family | Utilities (real names) | Use for |
|---|---|---|
| Surfaces | `bg-ink-900` `bg-ink-800` `bg-ink-700` · `bg-surface` `bg-surface-raised` `bg-surface-sunken` `bg-surface-overlay` | page / panel / raised / sunken backgrounds |
| Text | `text-parchment-50` `text-parchment-100…500` · `text-fg` `text-fg-muted` `text-fg-subtle` `text-fg-faint` | body / muted / faint copy |
| Ember (primary) | `bg-ember-500` `text-ember-300` `text-on-ember` `border-ember-500/60` `shadow-glow-ember` | hero actions, warmth, highlights |
| Arcane (AI/magic) | `bg-arcane-500/15` `text-arcane-300` `shadow-glow-arcane` | AI / magic affordances |
| Danger | `text-blood-500` `bg-blood-500` | destructive |
| Hairlines | `border-line` `border-line-strong` `border-line-faint` (and `border-parchment-50/10` for soft dividers) | borders, dividers |
| Fonts | `font-ui` (Hanken Grotesk · UI) · `font-display` (Cormorant Garamond · serif titles) · `font-narrative` (Spectral · prose) · `font-mono` (Space Mono) | interface / headings / narrative / code |
| Radius | `rounded-sm md lg xl 2xl full` | corners |
| Elevation | `shadow-sm md lg xl` · `shadow-glow-ember` `shadow-glow-arcane` `shadow-card-hover` | depth, candlelit glow |

Ember vs arcane is **semantic**: ember = the user's primary/hero action and warmth; arcane =
anything AI/generation/magic. Don't mix them decoratively. Translucent accent fills
(`bg-ember-500/15`, `bg-arcane-500/15`) are intentional — they glow over the dark canvas.

Component variants are props, not classes: e.g. `Button` takes `variant` (`primary` ember /
`secondary` / `ghost` / `arcane` / `danger`) and `size` (`sm`/`md`/`lg`); Badge/IconTile/etc. take
a `tone`. Read each component's `.d.ts` (the `<Name>Props` interface) and `.prompt.md` for the
real API and example compositions before composing.

## Where the truth lives

- **Styling**: `styles.css` (it `@import`s the compiled Tailwind/`_ds_bundle.css` with every token
  and utility). Read it before adding classes. Fonts load from Google Fonts via a remote `@import`.
- **Per component**: `components/<group>/<Name>/<Name>.d.ts` (props contract) and `<Name>.prompt.md`
  (usage + examples). The card preview HTML shows the real rendered variants.
