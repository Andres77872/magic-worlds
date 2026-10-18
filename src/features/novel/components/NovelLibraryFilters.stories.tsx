import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Meta,StoryObj } from '@storybook/react-vite'
import type { StoryLibraryFilters } from '@/shared'
import { Callout } from '@/ui/primitives'
import { NovelLibraryFilters } from './NovelLibraryFilters'
function FiltersDemo({sizeRange=false}:{sizeRange?:boolean}){
    const {t}=useTranslation()
    const [filters,setFilters]=useState<StoryLibraryFilters>(sizeRange?{minWords:20000,maxWords:80000,sort:'words_desc',includeArchivedSections:true}:{status:'revising',genre:'Fantasy',sort:'title_asc'})
    return <div className="space-y-4 p-6">
        <NovelLibraryFilters value={filters} onChange={setFilters}/>
        <Callout tone="info">{filters.genre||'All genres'} · {filters.status?t('novelEditor.structure.statuses.'+filters.status):t('novelEditor.library.allStatuses')} · {t('novelEditor.library.sorts.'+(filters.sort??'updated_desc'))}{filters.minWords!==undefined&&<> · {t('novelEditor.library.minWords')}: {filters.minWords.toLocaleString()}</>}{filters.maxWords!==undefined&&<> · {t('novelEditor.library.maxWords')}: {filters.maxWords.toLocaleString()}</>}</Callout>
    </div>
}
const meta={title:'Novel/Library filters',component:FiltersDemo,tags:['autodocs'],parameters:{layout:'fullscreen',docs:{description:{component:'Review search scope, literal metadata filters, UTC activity days, sorting and archived-section choices before applying. Controlled form fixture makes no backend requests.'}}}} satisfies Meta<typeof FiltersDemo>
export default meta
type Story=StoryObj<typeof meta>
export const Review:Story={}
export const SavedSize:Story={args:{sizeRange:true}}
