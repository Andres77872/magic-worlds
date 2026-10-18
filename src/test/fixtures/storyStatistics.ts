import type { StorySectionStatistics,StoryStatistics } from '@/shared'
export const sectionStatistics=(patch:Partial<StorySectionStatistics>={}):StorySectionStatistics=>({wordCount:0,characterCount:0,textBytes:0,parts:0,chapters:0,scenes:0,...patch})
export const storyStatistics=(patch:Partial<StoryStatistics>={}):StoryStatistics=>({schemaVersion:1,algorithm:'icu-word-en-v1',complete:true,sourceStructureRevision:1,
    active:sectionStatistics({wordCount:7,characterCount:40,textBytes:43,chapters:1,scenes:1}),archived:sectionStatistics(),trashed:sectionStatistics(),...patch})
