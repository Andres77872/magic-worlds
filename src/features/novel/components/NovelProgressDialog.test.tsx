import { fireEvent, render, screen, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { writingProgress } from '@/test/fixtures/storyProgress'
import { NovelProgressDialog } from './NovelProgressDialog'

const load = vi.fn(), closed = vi.fn()
const KEY = 'magic-worlds:novel-progress-streak::test'
const show = () => render(<I18nextProvider i18n={i18n}><NovelProgressDialog open onClose={closed} load={load} streakKey={KEY} /></I18nextProvider>)

beforeEach(async () => {
    vi.resetAllMocks()
    localStorage.removeItem(KEY)
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'America/Mexico_City' } as Intl.ResolvedDateTimeFormatOptions)
    load.mockImplementation(async (timeZone: string) => writingProgress({ timeZone }))
    await i18n.changeLanguage('en')
})

it('shows the goal, the deadline pace, today against the daily target and AI words apart', async () => {
    show()
    await screen.findByText('629 of 1,000 words')
    expect(load).toHaveBeenCalledWith('America/Mexico_City', expect.any(AbortSignal))
    expect(screen.getByRole('progressbar', { name: 'Words toward the novel goal' })).toHaveAttribute('aria-valuenow', '629')
    expect(screen.getByText('Deadline November 30, 2026: 45 days left, today included.')).toBeInTheDocument()
    expect(screen.getByText('About 9 words a day reach the goal by then.')).toBeInTheDocument()
    expect(screen.getByText('34 words written today')).toBeInTheDocument()
    expect(screen.getByText('35 added · 1 removed')).toBeInTheDocument()
    expect(screen.getByText('34 of 200 for today')).toBeInTheDocument()
    expect(screen.getByText('486 words from accepted AI proposals, not counted as your writing.')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(8)  // the header and each day of this week-long window, newest first
    expect(rows[1]).toHaveTextContent('Sat, Oct 1734486')
    expect(screen.getByText('Last 30 days: 214 words on 3 writing days, 71 a writing day on average.')).toBeInTheDocument()
    expect(screen.getByText(/Days follow America\/Mexico_City\./)).toBeInTheDocument()
})

it('says what is not set instead of inventing goals, and keeps an unknown total unknown', async () => {
    load.mockImplementation(async (timeZone: string) => writingProgress({ timeZone, activeWords: null, deadline: null, dailyWordGoal: null }))
    show()
    await screen.findByText('The saved word count is not available right now.')
    expect(screen.getByText('No deadline.')).toBeInTheDocument()
    expect(screen.getByText('No daily target.')).toBeInTheDocument()
    expect(screen.getByText('Set the novel goal, the deadline and a daily target in the novel’s details.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: 'Words toward the novel goal' })).not.toBeInTheDocument()
})

it('reads in UTC when the server does not know the zone, and says so', async () => {
    load.mockRejectedValueOnce(new ApiError(422, 'zone', { code: 'STORY_TIME_ZONE_INVALID', retryable: false }))
    show()
    await screen.findByText('Your time zone could not be used, so days follow UTC.')
    expect(load).toHaveBeenLastCalledWith('UTC', expect.any(AbortSignal))
    expect(screen.getByText(/Days follow UTC\./)).toBeInTheDocument()
})

it('offers a retry when the progress cannot be read', async () => {
    load.mockRejectedValueOnce(new Error('offline'))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await screen.findByText('629 of 1,000 words')
})

it('shows the streak only when asked and remembers the choice on this device', async () => {
    show()
    await screen.findByText('629 of 1,000 words')
    expect(screen.queryByText('2-day streak')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Show writing streak' }))
    expect(screen.getByText('2-day streak')).toBeInTheDocument()
    expect(localStorage.getItem(KEY)).toBe('true')
})
