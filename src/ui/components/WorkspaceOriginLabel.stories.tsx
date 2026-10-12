import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import {
  createWorkspaceTestState,
  OTHER_WORKSPACE_ID,
  TEST_WORKSPACE_ID,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { WorkspaceOriginLabel } from './WorkspaceOriginLabel'

const UNLISTED_WORKSPACE_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

// "Main library" is selected; "Novel A" is another workspace of the account.
const workspace = createWorkspaceTestState().value()

const withWorkspace: Decorator = function Provided(Story) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      <Story />
    </WorkspaceContext.Provider>
  )
}

const meta = {
  title: 'Components/WorkspaceOriginLabel',
  component: WorkspaceOriginLabel,
  tags: ['autodocs'],
  decorators: [withWorkspace],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Neutral "From <workspace>" badge for account-wide surfaces (tasks, notifications, the playlist dock) whose item belongs to a workspace other than the selected one. It renders nothing for the selected workspace, for items without an origin, and outside a workspace provider.',
      },
    },
  },
  argTypes: {
    workspaceId: { control: 'text', description: 'The item’s origin workspace id.' },
  },
  args: { workspaceId: OTHER_WORKSPACE_ID },
} satisfies Meta<typeof WorkspaceOriginLabel>

export default meta
type Story = StoryObj<typeof meta>

export const FromAnotherWorkspace: Story = {}

/** A workspace the account no longer lists (hidden or removed). */
export const UnknownWorkspace: Story = {
  args: { workspaceId: UNLISTED_WORKSPACE_ID },
}

/** Items of the selected workspace carry no label. */
export const SelectedWorkspace: Story = {
  args: { workspaceId: TEST_WORKSPACE_ID },
}
