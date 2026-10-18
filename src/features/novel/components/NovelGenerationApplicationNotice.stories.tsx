import type {Meta,StoryObj} from '@storybook/react-vite'
import {manuscript} from '@/test/fixtures/story'
import {NovelGenerationApplicationNotice} from './NovelGenerationApplicationNotice'

const meta={title:'Novel/Unapplied suggestion',component:NovelGenerationApplicationNotice,tags:['autodocs'],
    args:{value:{reason:'sources_changed',generationId:'fictional-generation',write:{requestId:'fictional-accept',expectedRevision:1,document:manuscript('The sealed letter remained unopened.')}}},
    parameters:{docs:{description:{component:'A definite application rejection retains the original saved suggestion, reviewed text and later device writing. These fictional examples make no API or provider request.'}}}} satisfies Meta<typeof NovelGenerationApplicationNotice>
export default meta
type Story=StoryObj<typeof meta>
export const SourcesChanged:Story={}
export const WritingChanged:Story={args:{value:{...meta.args.value,reason:'writing_changed'}}}
