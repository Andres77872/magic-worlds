import { useAuth } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { NovelCreateModal,type NovelCreateModalProps } from './NovelCreateModal'

/** Production entry points share one scoped form; pure modal fixtures can inject a reader. */
export function NovelCreateDialog(props:Omit<NovelCreateModalProps,'sourceApi'>){
    return props.open?<ScopedCreationDialog {...props}/>:null
}
function ScopedCreationDialog(props:Omit<NovelCreateModalProps,'sourceApi'>){
    const {userHash}=useAuth(),{api,workspaceEpoch}=useWorkspace()
    const readOnly=useWorkspaceReadOnly()
    return <NovelCreateModal key={`${userHash??'guest'}:${workspaceEpoch}`} {...props} sourceApi={api??undefined} blocked={props.blocked||readOnly||!api}/>
}
