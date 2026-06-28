import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookOpenText, Globe, Link2, Trash2, Users } from 'lucide-react'
import { Badge, Icon, IconButton, IconTile, Switch } from '@/ui/primitives'
import { ReferenceGroup } from './ReferenceGroup'
import { ReferenceRow } from './ReferenceRow'

const meta = {
    title: 'Components/Reference/ReferenceGroup',
    component: ReferenceGroup,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'A borderless labelled section: slim eyebrow + quiet count + icon-only add, above its rows or a one-line empty state. Groups draw no box, so several stack inside one shell (split by a `divide-y` hairline) and read as a single consolidated panel. Tone follows the ember (player) / arcane (AI memory) split.',
            },
        },
    },
    argTypes: {
        label: { control: 'text' },
        tone: { control: 'inline-radio', options: ['ember', 'arcane'] },
        count: { control: 'number' },
        addLabel: { control: 'text' },
        emptyText: { control: 'text' },
        isEmpty: { control: 'boolean' },
        onAdd: { action: 'add' },
        children: { control: false },
        headerExtras: { control: false },
    },
    args: {
        label: 'Codex',
        tone: 'ember',
        count: 2,
        addLabel: 'Add cards',
        isEmpty: false,
    },
} satisfies Meta<typeof ReferenceGroup>

export default meta
type Story = StoryObj<typeof meta>

const codexRows = (
    <div className="flex flex-col gap-1">
        <ReferenceRow
            leading={<IconTile icon={Users} tone="ember" size="sm" />}
            title="Aria Vex"
            description="Court mage"
            trailing={<Switch checked size="sm" onChange={() => {}} aria-label="Toggle Aria Vex" />}
        />
        <ReferenceRow
            leading={<IconTile icon={Globe} tone="arcane" size="sm" />}
            title="Ironhold"
            description="Mountain capital"
            trailing={<Switch checked size="sm" onChange={() => {}} aria-label="Toggle Ironhold" />}
        />
    </div>
)

/** A populated codex group. */
export const Populated: Story = { args: { children: codexRows } }

/** Empty groups collapse to a single inline line — no icon, no well. */
export const Empty: Story = {
    args: {
        count: 0,
        isEmpty: true,
        emptyText: 'Add cards to keep their context available in future replies.',
    },
}

/**
 * Two stacked groups inside one shell — the consolidated chat panel: ember Codex
 * over arcane Lorebooks, separated by a hairline.
 */
export const ConsolidatedPanel: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <div className="flex w-[320px] flex-col divide-y divide-parchment-50/[.08] rounded-lg border border-parchment-50/10 bg-ink-800 px-4 py-3">
            <ReferenceGroup label="Codex" tone="ember" count={2} addLabel="Add cards" onAdd={() => {}}>
                {codexRows}
            </ReferenceGroup>
            <ReferenceGroup label="Lorebooks" tone="arcane" count={1} addLabel="Add lorebook" onAdd={() => {}}>
                <div className="flex flex-col gap-1">
                    <ReferenceRow
                        leading={<IconTile icon={BookOpenText} tone="arcane" size="sm" />}
                        title="Glass Courts"
                        description="Court etiquette and old pacts"
                        trailing={
                            <>
                                <Badge tone="arcane" icon={<Icon icon={Link2} size={11} />}>
                                    Linked
                                </Badge>
                                <IconButton label="Remove Glass Courts" size="sm" tone="danger">
                                    <Icon icon={Trash2} size={14} />
                                </IconButton>
                            </>
                        }
                    />
                </div>
            </ReferenceGroup>
        </div>
    ),
}
