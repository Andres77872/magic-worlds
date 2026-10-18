import type { StoryErasePreview,StoryEraseWrite,StoryEraseAcknowledgement } from '@/shared'

export const erasePreview=(change:Partial<StoryErasePreview>={}):StoryErasePreview=>({schema:1,kind:'novel_erase_preview',storyId:'story-1',title:'The closed door',
    sourceVersion:'a'.repeat(64),trashedAt:'2026-10-17T00:00:00',policy:'explicit-novel-erase-v1',activeExecutions:0,
    counts:{parts:0,chapters:1,scenes:2,sceneRevisions:8,structureRevisions:3,cardRefs:1,generations:2,notes:3,bookmarks:1,annotationEvents:5,requestReceipts:9,executions:2,conversations:0,assistantMessages:0,variants:2},...change})
export const eraseWrite=(change:Partial<StoryEraseWrite>={}):StoryEraseWrite=>({requestId:'erase-one',expectedSourceVersion:'a'.repeat(64),confirmedTitle:'The closed door',...change})
export const eraseAck=(write=eraseWrite()):StoryEraseAcknowledgement=>({schema:1,kind:'novel_erase',storyId:'story-1',requestId:write.requestId,
    sourceVersion:write.expectedSourceVersion,intentHash:'b'.repeat(64),erasedAt:'2026-10-17T00:00:00'})
