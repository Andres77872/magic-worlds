import { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useTranslation } from 'react-i18next'
import { DocsQueryContext } from '../docsQuery'
import { getDocsContent } from '../docsContent'
import { RoadmapView } from './RoadmapView'
import { InitiativePanel } from './InitiativePanel'

/** Builds the live, localized roadmap so the toolbar locale switch applies. */
function RoadmapDemo({ query = '' }: { query?: string }) {
    const { t } = useTranslation()
    const docs = useMemo(() => getDocsContent(t), [t])
    return (
        <DocsQueryContext.Provider value={query.trim().toLowerCase()}>
            <div className="mx-auto w-full max-w-[1200px]">
                <RoadmapView roadmap={docs.roadmap} onJump={(anchor) => document.getElementById(anchor)?.scrollIntoView()} />
            </div>
        </DocsQueryContext.Provider>
    )
}

function InitiativeDemo({ id, width }: { id: 'novels' | 'charaStudio'; width: number }) {
    const { t } = useTranslation()
    const roadmap = useMemo(() => getDocsContent(t).roadmap, [t])
    const initiative = roadmap.initiatives.find((entry) => entry.id === id)!
    return (
        <div style={{ width }}>
            <InitiativePanel
                initiative={initiative}
                stageLabel={roadmap.stages[initiative.stage].label}
                labels={{
                    today: roadmap.labels.today,
                    builtSoFar: roadmap.labels.builtSoFar,
                    coming: roadmap.labels.coming,
                    scope: roadmap.labels.scope,
                }}
                phaseLabel={(number) => t('docs.roadmap.phase', { number })}
            />
        </div>
    )
}

const meta = {
    title: 'Docs/Roadmap view',
    component: RoadmapDemo,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The Docs Roadmap view: a dated header with the no-dates promise, Novel Studio and Chara Studio with what exists today kept apart from their ordered phases, then every product area under one status. Status always pairs an icon shape with its label; ember marks work in progress, verdant what is available, amber what this version keeps off. Copy follows the locale toolbar; availability follows this build\'s feature flags.',
            },
        },
    },
    argTypes: {
        query: { control: 'text', description: 'Simulates the page search (already lowercased by the page).' },
    },
    args: { query: '' },
} satisfies Meta<typeof RoadmapDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}

/** The shared search narrows panels and areas, marks matches and opens matching decisions. */
export const Searching: Story = { args: { query: 'scene' } }

export const NoMatches: Story = { args: { query: 'a term the roadmap never uses' } }

/** Side-by-side width: the panel's container query keeps one column. */
export const NovelStudioNarrow: Story = {
    render: () => <InitiativeDemo id="novels" width={540} />,
    parameters: { controls: { disable: true }, layout: 'centered' },
}

/** Full width: today and the phases sit in two columns. */
export const CharaStudioWide: Story = {
    name: 'Chara Studio wide',
    render: () => <InitiativeDemo id="charaStudio" width={960} />,
    parameters: { controls: { disable: true }, layout: 'centered' },
}
