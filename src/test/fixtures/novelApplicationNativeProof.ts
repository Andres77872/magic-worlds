import {generateUUID} from '@/utils/uuid'
import {canonicalJson} from '@/utils/json'
import {manuscript,storyScene} from './story'
import {draftJournalKey,readCheckpoint,writeCheckpoint} from '@/features/novel/persistence/draftJournal'
import {retainSceneDraft,retainedSceneDraftPrefix,readRetainedSceneDrafts} from '@/features/novel/persistence/retainedSceneDrafts'
import {reconciliationSource} from '@/features/novel/hooks/useReconciliationProgress'
import {listSavedReconciliations,reconciliationJournal,reconciliationKey,reconciliationSceneScope} from '@/features/novel/persistence/reconciliationJournal'

/** Opt-in browser-only proof. Each run retains a fresh fictional author scope. */
export async function proveNativeRejectedApplication() {
    const scope={apiOrigin:'https://novel-application-fixture.example',userHash:'native-application-proof-'+generateUUID(),workspaceId:'native-application-desk'}
    const proposed=manuscript('The sealed letter stayed unopened. 🌙','letter'),device=manuscript('Later device writing retained. 🌙','letter')
    const applicationRejection={reason:'sources_changed' as const,generationId:'fictional-generation',write:{requestId:'fictional-accept',expectedRevision:1,document:proposed}}
    let checks=0
    const require=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);checks++}
    const earlier=new Map(Object.entries(localStorage))
    const draftKey=draftJournalKey(scope.userHash,scope.workspaceId,'novel','scene')!
    require(writeCheckpoint(draftKey,{schema:2,title:'The letter',document:device,baseRevision:1,baseMetadataRevision:1,sequence:3,pending:null,applicationRejection}),'Rejected application could not be retained')
    const reopened=readCheckpoint(draftKey)!
    require(canonicalJson(reopened.applicationRejection)===canonicalJson(applicationRejection),'Reopened application identity changed')
    require(canonicalJson(reopened.document)===canonicalJson(device),'Later device writing changed')
    const source=reconciliationSource({id:'fictional-review',ownerKey:'fictional-author',sequence:3,deviceTitle:'The letter',deviceDocument:device,
        baseDocument:manuscript('The original letter.','letter'),account:storyScene({storyId:'novel',id:'scene',revision:3,document:manuscript('Current account writing.','letter')}),applicationRejection})
    const checkpoint={schema:1 as const,key:reconciliationKey(scope,'writer'),sceneScope:reconciliationSceneScope(scope,'novel','scene'),source,
        value:{choices:{},order:'account' as const,title:'account' as const},sequence:1,writtenAt:Date.now()}
    require(await reconciliationJournal.save(scope,checkpoint)==='saved','Native comparison could not be saved')
    const loaded=await reconciliationJournal.load(scope,source)
    require(canonicalJson(loaded.checkpoint?.source.applicationRejection)===canonicalJson(applicationRejection),'Native comparison lost the rejection')
    require((await reconciliationJournal.load(scope,{...source,applicationRejection:{...applicationRejection,generationId:'another-generation'}})).checkpoint===null,'Choices crossed generation identities')
    const saved=await listSavedReconciliations(scope)
    require(saved.items.length===1&&canonicalJson(saved.items[0].checkpoint.source.applicationRejection)===canonicalJson(applicationRejection),'Saved comparison library lost the rejection')
    const prefix=retainedSceneDraftPrefix(scope.userHash,scope.workspaceId,'novel','scene')!
    require(Boolean(retainSceneDraft(prefix,{title:'The letter',document:device,baseRevision:1,baseMetadataRevision:1,applicationRejection})),'Separate device copy failed')
    const copied=readRetainedSceneDrafts(prefix)
    require(copied.items.length===1&&canonicalJson(copied.items[0].applicationRejection)===canonicalJson(applicationRejection),'Retained copy lost application identity')
    require(canonicalJson(copied.items[0].document)===canonicalJson(device),'Retained copy lost later writing')
    for(const [key,value] of earlier)require(localStorage.getItem(key)===value,'An earlier browser record changed')
    return {checks,retainedRejectedApplications:1,retainedComparisons:1,retainedDeviceCopies:1,removedRecords:0,projectWrites:0,providerRequests:0}
}
