---
name: ui-storybook
description: Conventions for writing and maintaining Storybook stories and docs in this repo — CSF3 meta templates, title hierarchy, the global Reverie decorator, fixtures, variant-gallery patterns, and the commands to run and typecheck stories. Use when creating or editing *.stories.tsx files, writing stories for a new or existing component, working in .storybook/ or src/ui/docs/, or debugging Storybook build, a11y, or story typecheck failures.
---

# Storybook conventions

Storybook 10 (`@storybook/react-vite`), addons: docs + a11y. Config: `.storybook/main.ts` (story glob `src/**/*.stories.@(ts|tsx)` + `src/**/*.mdx`, react-docgen-typescript for auto prop tables), `.storybook/preview.tsx` (global decorator, backgrounds, sort), `.storybook/preview-head.html` (Google Fonts — the app's `index.html` doesn't apply to the preview iframe).

Copy-paste templates for every pattern below are in [references/story-patterns.md](references/story-patterns.md).

## What every story gets for free

The global `withReverieFrame` decorator in `.storybook/preview.tsx` already provides: `theme.css` (tokens + dark canvas + fonts + focus ring), `AudioPlaylistProvider` (so ThemeSongButton / AudioWavePlayer / PlaylistDock work in isolation), `font-ui text-parchment-50` and 1.5rem padding. **Do not** re-import the stylesheet or re-wrap the playlist provider in stories. Backgrounds toolbar: ink-900 void / ink-800 canvas (default) / ink-700 surface.

## Conventions

- Stories are co-located: `Component.stories.tsx` next to `Component.tsx`. CSF3 with `const meta = {...} satisfies Meta<typeof Component>` and `type Story = StoryObj<typeof meta>`. Always `tags: ['autodocs']` and a `docs.description.component` sentence explaining the component and its tone semantics.
- Title hierarchy = sidebar location: `Design System/...`, `Primitives/Button`, `Components/LoginModal`, `Components/Lists/CardGrid`, `Components/Audio/...`, `Components/Common/...`, then feature areas (`Creation/`, `Interaction/`, `Landing/`). Sort order is pinned in preview.tsx.
- argTypes idioms: `control: 'inline-radio'` for variant unions, `'boolean'` for flags, `control: false` for callbacks/ReactNodes, `action: 'clicked'` for handlers, a `description` string on non-obvious props. Provide `args` defaults so the first story is a controls playground.
- Layout: default is `centered`; use `parameters: { layout: 'padded' }` for full-width components, `'fullscreen'` for page-level features.
- Story copy is in-world (e.g. "Step into the story", "Delete scene") — sentence case, no lorem ipsum, no emoji.
- Mock data: import from `src/ui/components/lists/fixtures.ts` (`characters`, `worlds`, `adventures`, `templates`, `characterChats`) instead of inventing inline fixtures.

## Pattern menu (templates in references/story-patterns.md)

1. **Basic meta + playground** — mirrors `src/ui/primitives/Button.stories.tsx`.
2. **Variant gallery** (`AllKinds`/`Sizes` with `controls: { disable: true }`) — Button.stories.tsx.
3. **Controlled overlay** (`ModalDemo` trigger-button wrapper) — `src/ui/primitives/Modal.stories.tsx`.
4. **Provider decorator** (mock context value + `Decorator`) — `src/ui/components/LoginModal.stories.tsx`.
5. **Fixed-width / container decorator** — `src/ui/primitives/Field.stories.tsx`.
6. **Stateful render function** (`ControlledSwitch`-style helper) — `src/ui/primitives/Switch.stories.tsx`.
7. **List/grid with fixtures** — `src/ui/components/lists/Card/CardGrid.stories.tsx`.
8. **MDX doc page** — `src/ui/docs/Overview.mdx` and `src/ui/docs/foundations/`.

## Commands

- `pnpm storybook` — dev server on :6006.
- `pnpm typecheck:stories` — `tsc` over `.storybook/tsconfig.json`; **run after writing/editing stories** (this is the story gate; stories are excluded from the app build).
- `pnpm build-storybook` — static build (output `storybook-static/`, gitignored).
- Unit tests: `pnpm test` (vitest 4 + testing-library, jsdom; `src/test/setup.ts` stubs IntersectionObserver and auto-cleans up). Tests that mock `@/app/hooks` must ALSO mock `@/app/hooks/usePlaylist` (deep import).

## Caveats

- a11y addon runs with `test: 'todo'` — axe findings surface but don't fail; low-contrast hairlines/muted text are intentional Reverie aesthetics. Care about: missing labels/alt text, focus order, keyboard operability, ARIA roles.
- `pnpm lint` has pre-existing React-Compiler rule errors — lint redness is not necessarily caused by your change; `pnpm build` is the green/red signal.
- No visual-regression tooling (no Chromatic/test-runner) — review visually in the dev server.

## Coverage gaps (good targets when asked to "add stories")

Primitives ~92% covered. Missing/thin: `audio/` (only AudioWavePlayer; PlaylistDock + WaveformSeekBar uncovered), `lists/` (CardOptions uncovered), `common/` (EmptyState, AttributeList uncovered), and feature dirs `gallery/`, `interaction/`, `novel/`, `lorebook/` have none.
