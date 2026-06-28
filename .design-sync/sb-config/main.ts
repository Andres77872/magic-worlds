import type { StorybookConfig } from '@storybook/react-vite'

/**
 * Scoped Reverie Storybook for design-sync (the fidelity oracle).
 * Mirrors ../../.storybook/main.ts but narrows `stories` to src/ui only — the
 * design system being synced. The `@/` alias and @tailwindcss/vite plugin are
 * inherited from the project vite.config.ts (Storybook merges it). The sibling
 * preview.tsx re-exports the real ../../.storybook/preview so the Reverie frame,
 * tokens, fonts, i18n and audio context are byte-identical to the app's.
 */
const config: StorybookConfig = {
  // Component stories only. Standalone foundation/pattern MDX docs are excluded:
  // they are not bundle components (the oracle only needs component renders), and
  // some reach outside src/ui (e.g. NarrativeProse.mdx imports @/features/...),
  // which the addon-docs MDX pass can't alias-resolve in this scoped build.
  // The design-system token/typography knowledge is folded into conventions.md.
  stories: ['../../src/ui/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
}

export default config
