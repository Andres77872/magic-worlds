/**
 * Common layout component for all creator views
 */

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Eyebrow, Icon } from '@/ui/primitives';

export interface CreatorLayoutProps {
    title: string;
    eyebrow?: string;
    icon?: string;
    onBack: () => void;
    children: ReactNode;
    isLoading?: boolean;
}

export function CreatorLayout({
    title,
    eyebrow = 'Creation',
    icon,
    onBack,
    children,
    isLoading = false
}: CreatorLayoutProps) {
    return (
        <Card
            className={`relative mx-auto my-6 max-w-[860px] p-6 text-parchment-50 sm:p-8 ${
                isLoading ? 'pointer-events-none opacity-70' : ''
            }`}
        >
            <div className="mb-8 flex items-start justify-between gap-4 border-b border-parchment-50/10 pb-6 max-sm:flex-col max-sm:items-stretch">
                <div className="flex flex-col gap-1">
                    <Eyebrow tone="ember">{eyebrow}</Eyebrow>
                    <h2 className="m-0 flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight max-sm:text-xl">
                        {icon && <span className="text-2xl max-sm:text-xl">{icon}</span>}
                        <span>{title}</span>
                    </h2>
                </div>
                <Button
                    variant="secondary"
                    onClick={onBack}
                    iconLeft={<Icon icon={ArrowLeft} size={16} />}
                    className="shrink-0 max-sm:w-full"
                >
                    Back
                </Button>
            </div>
            <div>
                {children}
            </div>
        </Card>
    );
}
