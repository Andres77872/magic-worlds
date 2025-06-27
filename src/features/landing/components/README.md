# Landing Page Components

This directory contains the refactored landing page components for better maintainability and structure.

## Component Architecture

The original monolithic `LandingPage` component has been broken down into the following modular components:

### Core Components

- **`LandingPage.tsx`** - Main container component that orchestrates all sub-components
- **`LandingLoading.tsx`** - Loading state with magical spinner animation
- **`LandingHero.tsx`** - Hero section with title, description, CTA button, and stats
- **`LandingQuickActions.tsx`** - Quick action cards for creating characters, worlds, and adventures
- **`LandingContentSections.tsx`** - Tabbed interface for viewing existing content (characters, worlds, templates, adventures)
- **`LandingTips.tsx`** - Getting started tips for new users
- **`LandingFooter.tsx`** - Footer with clear all data functionality

### Styling Structure

Each component has its own scoped CSS file to avoid class name conflicts:

- **`LandingPage.css`** - Main page layout and background effects
- **`LandingLoading.css`** - Loading spinner and particle animations
- **`LandingHero.css`** - Hero section, title animations, stats cards
- **`LandingQuickActions.css`** - Action cards styling and hover effects
- **`LandingContentSections.css`** - Tab interface and content panels
- **`LandingTips.css`** - Tips cards and numbering
- **`LandingFooter.css`** - Footer layout

### CSS Variable Strategy

All components use the same CSS custom properties (variables) from the main theme, ensuring:
- Consistent colors, spacing, and animations across components
- Easy theme updates by changing variables in one place
- No class name conflicts between components (all prefixed with `landing-`)

### Benefits of This Structure

1. **Modularity**: Each component has a single responsibility
2. **Maintainability**: Easier to find and modify specific functionality
3. **Reusability**: Components can be reused or modified independently
4. **Performance**: Better code splitting potential
5. **Testing**: Each component can be tested in isolation
6. **CSS Organization**: Scoped styles prevent conflicts and improve maintainability

### Component Props Interface

Each component receives only the props it needs, making dependencies clear:

```typescript
// Example: LandingHero only needs stats and one callback
interface LandingHeroProps {
    charactersCount: number
    worldsCount: number
    totalAdventures: number
    hasContent: boolean
    onStartJourney: () => void
}
```

### Import Structure

All components are exported from `index.ts` for clean imports:

```typescript
import { 
    LandingLoading, 
    LandingHero, 
    LandingQuickActions,
    // ... etc
} from './'
```

## Migration Notes

- The original monolithic CSS file has been split into component-specific files
- All CSS class names remain the same to maintain visual consistency
- Component interfaces match the original functionality exactly
- No breaking changes to the parent component API 