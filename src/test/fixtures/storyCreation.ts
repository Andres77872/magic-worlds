import type { StoryCreateWrite,StoryCreationAcknowledgement } from '@/shared'
export const creationWrite=(patch:Partial<Extract<StoryCreateWrite,{chapters:unknown}>>={}):StoryCreateWrite=>({requestId:'creation-one',title:'The gate',source:{kind:'blank'},chapters:[{title:'Opening',status:null}],...patch})
export const creationAck=(write=creationWrite()):StoryCreationAcknowledgement=>({kind:'novel_create',requestId:write.requestId,storyId:'created-novel',write})
