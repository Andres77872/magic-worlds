# magic-worlds

React 19 + Vite + Tailwind CSS v4 + TypeScript SPA (AI roleplay frontend) with Storybook. Package manager: **pnpm** (not npm/yarn). Imports use the `@/` alias for `src/`.

## Commands

- `pnpm dev` — dev server
- `pnpm test` — vitest (jsdom + testing-library)
- `pnpm build` — typecheck + production build (**the real green/red signal**)
- `pnpm lint` — eslint. Caveat: pre-existing React-Compiler rule errors — lint redness is not necessarily caused by your change.
- `pnpm storybook` — Storybook on :6006
- `pnpm typecheck:stories` — typecheck story files (run after editing `*.stories.tsx`)

## UI work: read the skills first

Project skills live in `.agents/skills/` (`.claude/skills/` is a symlink to the same directory):

- **ui-design-system** (`.agents/skills/ui-design-system/SKILL.md`) — the Reverie look & feel: design tokens, color/typography/motion rules, ember-vs-arcane semantics. Read before styling anything. Tokens live in `src/ui/styles/theme.css`; never hardcode colors/fonts/shadows.
- **ui-components** (`.agents/skills/ui-components/SKILL.md`) — primitive/component catalog and composition recipes (pages, forms, overlays, card grids). Read before building any screen, form, or dialog. Reuse primitives before writing new markup.
- **ui-storybook** (`.agents/skills/ui-storybook/SKILL.md`) — story conventions and copy-paste templates. Read before touching `*.stories.tsx`, `.storybook/`, or `src/ui/docs/`.
