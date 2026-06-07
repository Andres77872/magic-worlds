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
    docs: { description: { component: 'Discovery greeting — a time-of-day eyebrow, the night\'s prompt, and a search field that filters the scene gallery. Optional action slot beside the search.' } },
  },
  decorators: [(Story) => <div className="w-[860px] max-w-full"><Story /></div>],
  argTypes: {
    query: { control: false },
    onQueryChange: { control: false },
    action: { control: false },
  },
  args: { query: '', onQueryChange: () => {} },
} satisfies Meta<typeof GreetingHeader>

export default meta
type Story = StoryObj<typeof meta>

function Demo({ withAction = false }: { withAction?: boolean }) {
  const [query, setQuery] = useState('')
  return (
    <GreetingHeader
      query={query}
      onQueryChange={setQuery}
      action={withAction ? <Button kind="secondary">Continue last scene</Button> : undefined}
    />
  )
}

export const Default: Story = { render: () => <Demo /> }
export const WithAction: Story = { render: () => <Demo withAction /> }
