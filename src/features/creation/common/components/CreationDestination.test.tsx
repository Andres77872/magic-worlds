import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    TEST_COLLECTION_ID,
    TEST_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'

const mocks = vi.hoisted(() => ({ getCollection: vi.fn() }))

vi.mock('@/infrastructure/api', () => ({ apiService: { getCollection: mocks.getCollection } }))

import { CreationDestination } from './CreationDestination'
import { OrganizationWarningNotice } from './OrganizationWarningNotice'

function renderDestination(origin: Parameters<typeof CreationDestination>[0]['origin']) {
    const workspace = createWorkspaceTestState()
    return render(<WorkspaceTestProvider state={workspace}><CreationDestination origin={origin} /></WorkspaceTestProvider>)
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCollection.mockResolvedValue({ id: TEST_COLLECTION_ID, name: 'Heroes' })
})

describe('CreationDestination', () => {
    it('names the workspace root as the Library', () => {
        renderDestination({ workspaceId: OTHER_WORKSPACE_ID, collectionId: null, returnTo: null })
        expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Novel A / Library')
        expect(mocks.getCollection).not.toHaveBeenCalled()
    })

    it('names the origin collection once it resolves', async () => {
        renderDestination({ workspaceId: TEST_WORKSPACE_ID, collectionId: TEST_COLLECTION_ID, returnTo: null })
        expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / a collection')
        await waitFor(() => expect(screen.getByTestId('creation-destination')).toHaveTextContent('Will be saved in Main library / Heroes'))
        expect(mocks.getCollection).toHaveBeenCalledWith(TEST_WORKSPACE_ID, TEST_COLLECTION_ID)
    })

    it('shows a known workspace destination and stays hidden before an origin is selected', () => {
        const { unmount } = renderDestination({ workspaceId: TEST_WORKSPACE_ID, collectionId: null, returnTo: null })
        expect(screen.getByTestId('creation-destination')).toBeInTheDocument()
        unmount()
        renderDestination(null)
        expect(screen.queryByTestId('creation-destination')).toBeNull()
    })
})

describe('OrganizationWarningNotice', () => {
    it('renders nothing without removed collections', () => {
        const { container } = render(<OrganizationWarningNotice warnings={[]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('summarizes removed collections as one non-blocking status', () => {
        render(<OrganizationWarningNotice warnings={[
            { code: 'COLLECTION_REMOVED', collection_id: TEST_COLLECTION_ID },
            { code: 'COLLECTION_REMOVED', collection_id: OTHER_WORKSPACE_ID },
        ]} />)
        expect(screen.getByRole('status')).toHaveTextContent('Saved in the library. 2 collections it was going into were deleted')
    })
})
