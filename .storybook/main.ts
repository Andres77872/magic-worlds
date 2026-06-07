import type { StorybookConfig } from '@storybook/react-vite'

/**
 * Reverie design-system Storybook.
 * Stories + MDX live co-located under src/. The `@/` alias and the
 * @tailwindcss/vite plugin are inherited from the project vite.config.ts
 * (Storybook merges it), so Tailwind tokens and `@/...` imports just work.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // Read prop interfaces (ButtonProps, BadgeProps, …) so controls/argTypes
    // and the autodocs prop tables are inferred from the real TS types.
    reactDocgen: 'react-docgen-typescript',
  },
}

export default config
