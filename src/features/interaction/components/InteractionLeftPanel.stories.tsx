import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { DataContext } from '@/app/providers/DataProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { adventures, characters, worlds } from '@/ui/components/lists/fixtures'
import { libraryCardToSnapshotCard } from '../utils/adventureSnapshot'
import { InteractionLeftPanel } from './InteractionLeftPanel'

type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
const previewData = { characters, worlds, lorebooks: [], setLorebooks: () => {} } as unknown as DataValue

const meta = {
  title: 'Interaction/InteractionLeftPanel',
  component: InteractionLeftPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: { description: { component: 'The left rail in an adventure uses open scenario prose and compact portrait rows for the persona, world, and cast. Selecting a reference opens its card preview.' } },
  },
  decorators: [(Story) => (
    <DataContext.Provider value={previewData}>
      <FloatingWindowsProvider>
        <div className="w-80 max-w-full"><Story /></div>
      </FloatingWindowsProvider>
    </DataContext.Provider>
  )],
  argTypes: {
    adventure: { control: false },
    onBack: { control: false },
  },
  // Empty session ID keeps the isolated lorebook panel offline.
  args: {
    adventure: {
      ...adventures[0],
      id: '',
      snapshot: {
        schema_version: 2,
        source: 'resolved_library_clone',
        template_card_id: 'preview-template',
        template: {
          id: 'preview-template',
          name: adventures[0].scenario,
          description: adventures[0].turns?.[0]?.content ?? adventures[0].scenario,
          persona: libraryCardToSnapshotCard({ ...characters[3], role: 'persona' }, 'character'),
          characters: adventures[0].characters.map((character) => libraryCardToSnapshotCard(character, 'character')),
          world: [libraryCardToSnapshotCard(worlds[0], 'world')],
        },
      },
    },
    onBack: () => {},
  },
} satisfies Meta<typeof InteractionLeftPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
