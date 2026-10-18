import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { avatarVariantUrl, isProtectedMediaUrl, resolveAvatarUrlForSize } from '@/infrastructure/api/mediaUrl'
import { apiService } from '@/infrastructure/api'
import type { UserProfile } from '@/shared'
import { ProfileIdentityCard } from '../ProfileIdentityCard'
import '@/app/i18n'

function buildMockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
        user_hash: 'ABCDEF1234567890ZYXWVU',
        username: 'andres',
        display_name: 'Andres',
        avatar_url: '/user/me/avatar/variant_A/512.webp',
        active_avatar_variant: 'A',
        available_avatar_variants: ['A', 'B', 'C', 'D'],
        user_type: 'consumer',
        card_counts: {
            character: 2,
            world: 1,
            adventure_template: 0,
            item: 0,
        },
        membership: {
            plan_code: 'free',
            display_name: 'Free',
            credits: { period: 'daily', max: 50, used: 0, remaining: 50, usage_date: '2026-10-18' },
            payg: { balance: 0, free_balance: 0, billed_balance: 0 },
            total_available_credits: 50,
            limits: {},
            profile_cards: {
                current_plan_code: 'free',
                tiers: [],
                payg: {
                    balance: 0,
                    free_balance: 0,
                    billed_balance: 0,
                    credit_cost: 1,
                    covered_operations: [],
                    non_expiring: true,
                    available: true,
                    reference_only: false,
                    badge: 'PAYG',
                    description: '',
                    highlights: [],
                    visual: { tone: 'payg', icon: 'coins' },
                    action: { state: 'active', label: 'Available', enabled: false },
                },
            },
        },
        ...overrides,
    }
}

describe('Profile avatar URLs & variant selector', () => {
    it('recognizes /user/me/avatar/ as protected media and resolves optimal WebP size tiers', () => {
        const url512 = avatarVariantUrl('A', 512)
        expect(url512).toBe('/user/me/avatar/variant_A/512.webp')
        expect(isProtectedMediaUrl(url512)).toBe(true)

        expect(resolveAvatarUrlForSize(url512, 28)).toBe('/user/me/avatar/variant_A/128.webp')
        expect(resolveAvatarUrlForSize(url512, 72)).toBe('/user/me/avatar/variant_A/256.webp')
        expect(resolveAvatarUrlForSize(url512, 200)).toBe('/user/me/avatar/variant_A/512.webp')
    })

    it('renders the 4 medallion variants and calls updateAvatarVariant when switching', async () => {
        const profile = buildMockProfile()
        const updatedProfile = buildMockProfile({
            avatar_url: '/user/me/avatar/variant_C/512.webp',
            active_avatar_variant: 'C',
        })
        const spy = vi.spyOn(apiService, 'updateAvatarVariant').mockResolvedValueOnce(updatedProfile)
        const onUpdated = vi.fn()

        render(<ProfileIdentityCard profile={profile} onAvatarVariantUpdated={onUpdated} />)

        const radios = screen.getAllByRole('radio')
        expect(radios).toHaveLength(4)
        expect(radios[0]).toHaveAttribute('aria-checked', 'true')

        fireEvent.click(radios[2])

        await waitFor(() => {
            expect(spy).toHaveBeenCalledWith('C')
            expect(onUpdated).toHaveBeenCalledWith(updatedProfile)
        })

        spy.mockRestore()
    })

    it('falls back cleanly to the initial glyph when no avatar variants are available yet', () => {
        const profile = buildMockProfile({
            avatar_url: null,
            active_avatar_variant: null,
            available_avatar_variants: [],
        })

        render(<ProfileIdentityCard profile={profile} />)

        expect(screen.queryByRole('radiogroup')).toBeNull()
        expect(screen.getByText('A')).toBeInTheDocument()
    })
})
