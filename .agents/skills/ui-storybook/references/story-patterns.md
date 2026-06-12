# Story templates

Copy-paste skeletons for each repo pattern. Each notes the real story file it mirrors — diff against that living example when in doubt.

## 1. Basic meta + controls playground

Mirrors `src/ui/primitives/Button.stories.tsx`.

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Widget } from './Widget'

const meta = {
  title: 'Primitives/Widget',
  component: Widget,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One sentence: what it is, what the tones/kinds mean (ember = hero/player, arcane = AI).',
      },
    },
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['ember', 'arcane'],
      description: '`ember` = player side · `arcane` = AI side.',
    },
    disabled: { control: 'boolean' },
    children: { control: 'text', description: 'Label (sentence case).' },
    icon: { control: false },
    onClick: { action: 'clicked' },
  },
  args: { tone: 'ember', disabled: false, children: 'Step into the story' },
} satisfies Meta<typeof Widget>

export default meta
type Story = StoryObj<typeof meta>

/** Controls-driven playground. */
export const Default: Story = {}
export const Arcane: Story = { args: { tone: 'arcane', children: 'Conjure a character' } }
```

## 2. Variant gallery

Mirrors `AllKinds` / `Sizes` in `src/ui/primitives/Button.stories.tsx`. Disable controls — the story IS the matrix.

```tsx
/** Every kind side by side. */
export const AllKinds: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button kind="primary">Primary</Button>
      <Button kind="secondary">Secondary</Button>
      <Button kind="ghost">Ghost</Button>
      <Button kind="arcane">Arcane</Button>
      <Button kind="danger">Danger</Button>
    </div>
  ),
}
```

## 3. Controlled overlay (Modal / Drawer / dialogs)

Mirrors `src/ui/primitives/Modal.stories.tsx`. A demo wrapper owns the `open` state and renders a trigger; args defaults exist only to satisfy the type.

```tsx
import type { ComponentProps } from 'react'
import { useState } from 'react'

// meta args: { open: false, onClose: () => {}, children: undefined } + control: false on all three

/** Stories render a trigger button; the modal opens into its own scrim. */
function ModalDemo(props: Partial<ComponentProps<typeof Modal>>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        title="Keep the story going"
        {...props}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button kind="ghost" onClick={() => setOpen(false)}>Not now</Button>
            <Button kind="primary" onClick={() => setOpen(false)}>Continue</Button>
          </>
        }
      >
        {props.children ?? <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">…</p>}
      </Modal>
    </>
  )
}

export const Default: Story = { render: (args) => <ModalDemo {...args} /> }
```

## 4. Provider decorator (context-dependent components)

Mirrors `src/ui/components/LoginModal.stories.tsx`. Type the mock from the provider itself; name the decorator function (lint).

```tsx
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { AuthContext } from '@/app/providers/AuthProvider'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>

const guestAuth: AuthValue = {
  isAuthenticated: false, user: null, token: null, projects: [],
  isLoading: false, error: null, isLoginModalOpen: false,
  login: async () => false, register: async () => false,
  logout: () => {}, clearError: () => {},
  openLoginModal: () => {}, closeLoginModal: () => {},
}

const withAuth: Decorator = function Provided(Story) {
  return (
    <AuthContext.Provider value={guestAuth}>
      <Story />
    </AuthContext.Provider>
  )
}

// then in meta: decorators: [withAuth]
```

Note: `AudioPlaylistProvider` is already global (preview.tsx) — never re-wrap it.

## 5. Container decorators

```tsx
// Fixed width for form primitives (mirrors Field.stories.tsx):
decorators: [(Story) => <div className="w-80"><Story /></div>]

// Card-like framed container (mirrors AudioWavePlayer.stories.tsx):
decorators: [
  (Story) => (
    <div className="w-[360px] rounded-xl border border-parchment-50/10 bg-ink-800 p-4">
      <Story />
    </div>
  ),
]

// Wide layout demo (mirrors CardGrid.stories.tsx):
parameters: { layout: 'padded' },
decorators: [(Story) => <div style={{ maxWidth: 1040, margin: '0 auto' }}><Story /></div>]
```

## 6. Stateful render function

Mirrors `ControlledSwitch` in `src/ui/primitives/Switch.stories.tsx`.

```tsx
function ControlledSwitch(
  props: Omit<Parameters<typeof Switch>[0], 'checked' | 'onChange'> & { initial?: boolean },
) {
  const { initial = false, ...rest } = props
  const [checked, setChecked] = useState(initial)
  return <Switch {...rest} checked={checked} onChange={setChecked} />
}

// Or inline (mirrors Field.stories.tsx WithSelect):
export const WithSelect: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('cg')
    return (
      <Field {...args}>
        <Select value={value} onChange={setValue} options={OPTIONS} />
      </Field>
    )
  },
}
```

## 7. Lists with fixtures

Mirrors `src/ui/components/lists/Card/CardGrid.stories.tsx`. Never invent inline domain data.

```tsx
import { characters, worlds } from '@/ui/components/lists/fixtures'

export const Grid: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <CardGrid
      items={characters}
      getItemKey={(c) => c.id}
      renderCard={(c) => <Card title={c.name} subtitle={`${c.race} ${c.class}`} />}
    />
  ),
}
```

Available fixtures: `characters` (4), `worlds` (3), `adventures`, `templates`, `characterChats`.

## 8. MDX doc page

Mirrors `src/ui/docs/Overview.mdx`; foundations pages live in `src/ui/docs/foundations/`. Token swatches read LIVE values — list token names in `src/ui/docs/tokens.ts` and render via the `Swatch.tsx` helpers (`getComputedStyle`), never paste hex values into docs.

```mdx
import { Meta } from '@storybook/addon-docs/blocks'

<Meta title="Design System/Foundations/NewPage" />

# Page title

Prose… token references use `var(--color-…)` inline styles for live values.
```

## Checklist before finishing

1. `pnpm typecheck:stories` passes.
2. Title sits in the right hierarchy bucket; `tags: ['autodocs']` present.
3. Controls playground story first; variant galleries disable controls.
4. Story copy is in-world, sentence case, no emoji.
5. a11y panel: ignore contrast-on-hairline warnings; fix label/keyboard/ARIA findings.
