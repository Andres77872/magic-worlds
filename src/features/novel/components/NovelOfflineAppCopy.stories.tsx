import type { Meta, StoryObj } from '@storybook/react-vite'
import { NovelOfflineAppCopyView } from './NovelOfflineAppCopy'

const meta = { title: 'Novel/Offline app copy', component: NovelOfflineAppCopyView, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Controlled offline app states. These stories do not register a worker, fetch files or write storage. The native cold-load fixture verifies the production controller separately.' } } },
    args: { state: { state: 'empty' }, onPrepare: () => {} },
} satisfies Meta<typeof NovelOfflineAppCopyView>
export default meta
type Story = StoryObj<typeof meta>
export const Available: Story = {}
export const Downloading: Story = { args: { busy: true } }
export const Ready: Story = { args: { state: { state: 'ready' } } }
export const UpdateWaiting: Story = { args: { state: { state: 'waiting' } } }
export const NetworkFailure: Story = { args: { state: { state: 'failed', reason: 'network' } } }
export const ChangedDeployment: Story = { args: { state: { state: 'failed', reason: 'integrity' } } }
export const StorageFailure: Story = { args: { state: { state: 'failed', reason: 'storage' } } }
export const AllowanceRefused: Story = { args: { state: { state: 'failed', reason: 'limit' } } }
export const HttpLan: Story = { args: { state: { state: 'unsupported', reason: 'secure' } } }
export const ExistingWorker: Story = { args: { state: { state: 'foreign' } } }
