import type { Meta,StoryObj } from '@storybook/react-vite'
import type { StorySnapshotSource } from '../hooks/useSnapshotSource'
import { annotatedSnapshot,snapshotNoteReaders } from '@/test/fixtures/storySnapshotNotes'
import { snapshotComparison,snapshotPreview,snapshotPage,snapshotView,snapshotStory,snapshotRestorePreview } from '@/test/fixtures/storySnapshots'
import { NovelSnapshotNotes } from './NovelSnapshotNotes'

const source:StorySnapshotSource={...snapshotNoteReaders,key:'captured-notes-preview',isCurrent:()=>true,preview:async()=>snapshotPreview(),list:async()=>snapshotPage(),compare:async()=>snapshotComparison(),scene:async()=>snapshotView(),currentScene:async()=>snapshotStory(true).chapters[0].scenes[0],restorePreview:async(_id,options)=>snapshotRestorePreview(options)}
const meta={title:'Novel/Captured personal notes',component:NovelSnapshotNotes,tags:['autodocs'],
    parameters:{layout:'padded',docs:{description:{component:'Read the personal-note text, status and exact passage captured with a named manuscript snapshot. These controlled fixtures never write to the backend.'}}},
    args:{snapshot:annotatedSnapshot(),source},
} satisfies Meta<typeof NovelSnapshotNotes>
export default meta
type Story=StoryObj<typeof meta>
export const Captured:Story={}
export const Legacy:Story={args:{snapshot:snapshotComparison()}}
export const Empty:Story={args:{snapshot:{...snapshotComparison(),manifest:{...snapshotComparison().manifest,annotations:{revision:1,notes:[]}}}}}
export const Unavailable:Story={args:{source:{...source,notes:async()=>{throw new Error('Historical event unavailable')}}}}
