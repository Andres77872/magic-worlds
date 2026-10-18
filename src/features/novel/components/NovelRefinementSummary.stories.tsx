import type {Meta,StoryObj} from '@storybook/react-vite'
import type {NovelRefinementContext,NovelRefinementSource} from '@/shared/types/storyAssistant.types'
import fixture from '@/test/fixtures/novelAssistantRefinement.json'
import authored from '@/test/fixtures/novelVariantRefinementNative.json'
import {NovelRefinementSummary} from './NovelRefinementSummary'

const meta={title:'Novel/Refinement parent',component:NovelRefinementSummary,tags:['autodocs'],
    args:{value:fixture.parent as unknown as NovelRefinementContext},
    parameters:{docs:{description:{component:'Exact retained proposed writing is inspected separately from the new saved sources. This fictional Python-generated fixture makes no API or provider request.'}}}} satisfies Meta<typeof NovelRefinementSummary>
export default meta
type Story=StoryObj<typeof meta>
export const PriorWriting:Story={}
export const AuthoredVersion:Story={args:{value:authored.preview.refinement as unknown as NovelRefinementSource}}
