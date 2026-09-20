import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollText, Tags, User } from 'lucide-react'
import { Button, Field, Icon, Input, Textarea } from '@/ui/primitives'
import { Card } from '@/ui/components/lists/Card'
import { Tag } from '@/ui/primitives'
import { CreatorStudio } from './CreatorStudio'
import { StudioSection } from './StudioSection'
import { StudioSectionNav } from './StudioSectionNav'
import { StudioPreviewDock } from './StudioPreviewDock'

const meta = {
  title: 'Creation/CreatorStudio',
  component: CreatorStudio,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'The shared two-pane shell for every creator: header (eyebrow + title + Back + Save) over an editor column (sticky section nav + the caller\'s form) and a sticky live-preview pane. Entity-agnostic — it does not own the form.' } },
  },
  argTypes: {
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    isLoading: { control: 'boolean' },
    icon: { control: false },
    onBack: { control: false },
    headerActions: { control: false },
    nav: { control: false },
    preview: { control: false },
    children: { control: false },
  },
  args: {
    eyebrow: 'Creation',
    title: 'Create character',
    icon: <Icon icon={User} size={28} />,
    isLoading: false,
    onBack: () => {},
    headerActions: (
      <Button variant="primary" form="demo-form" type="submit">
        Create
      </Button>
    ),
    nav: (
      <StudioSectionNav
        items={[
          { id: 'identity', label: 'Identity', icon: User },
          { id: 'attributes', label: 'Attributes', icon: Tags },
          { id: 'backstory', label: 'Backstory', icon: ScrollText },
        ]}
      />
    ),
    preview: (
      <StudioPreviewDock>
        <Card title="Lyra Dawnwhisper" subtitle={<Tag>Half-elf</Tag>}>
          <div className="font-narrative text-sm italic text-parchment-400">Charisma: 17 • Dexterity: 14</div>
        </Card>
      </StudioPreviewDock>
    ),
    children: (
      <form id="demo-form" className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <StudioSection id="identity" icon={User} title="Identity" description="Who steps into the scene?">
          <Field label="Name"><Input placeholder="Lyra Dawnwhisper" /></Field>
          <Field label="Race"><Input placeholder="Half-elf" /></Field>
        </StudioSection>
        <StudioSection id="attributes" icon={Tags} title="Attributes" description="Details that shape how your character acts.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Strength"><Input placeholder="A practiced swordswoman" /></Field>
            <Field label="Vulnerability"><Input placeholder="Trust comes slowly" /></Field>
          </div>
        </StudioSection>
        <StudioSection id="backstory" icon={ScrollText} title="Backstory">
          <Field label="History"><Textarea placeholder="A line that sets the scene…" rows={4} /></Field>
        </StudioSection>
      </form>
    ),
  },
} satisfies Meta<typeof CreatorStudio>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
