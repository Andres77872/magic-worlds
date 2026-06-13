import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '@/ui/primitives'
import { GreetingHeader } from './GreetingHeader'

const meta = {
  title: 'Landing/GreetingHeader',
  component: GreetingHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'Discovery greeting — a time-of-day eyebrow, the night\'s prompt, and the global dashboard search (sessions, adventures, cast, worlds, items, novels). While a query is active the field glows ember and shows the match count. Optional action slot beside the search.' } },
  },
  decorators: [(Story) => <div className="w-[860px] max-w-full"><Story /></div>],
  argTypes: {
    query: { control: false },
    onQueryChange: { control: false },
    resultsCount: { control: false },
    action: { control: false },
  },
  args: { query: '', onQueryChange: () => {} },
} satisfies Meta<typeof GreetingHeader>

export default meta
type Story = StoryObj<typeof meta>

function Demo({ withAction = false, initialQuery = '' }: { withAction?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  return (
    <GreetingHeader
      query={query}
      onQueryChange={setQuery}
      resultsCount={query.trim() ? 7 : undefined}
      action={withAction ? <Button kind="secondary">Continue last scene</Button> : undefined}
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
export const WithAction: Story = { render: () => <Demo withAction /> }
export const Searching: Story = { render: () => <Demo initialQuery="ember" /> }
