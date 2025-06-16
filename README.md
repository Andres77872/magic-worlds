# Magic Worlds RPG

A React-based fantasy adventure game creator and interaction system with AI-powered storytelling.

## Features

- **Character Creation**: Design detailed RPG characters with stats and backgrounds
- **World Building**: Create rich, immersive worlds with custom lore and settings  
- **Adventure Templates**: Build reusable adventure scenarios
- **Interactive Storytelling**: AI-powered chat-based adventure gameplay
- **Theme Support**: Light, dark, and system theme options
- **Local Storage**: Persistent data storage for all your creations

## Architecture

This project follows an LLM-optimized architecture with clear separation of concerns:

```
src/
├── app/                    # Application root and providers
├── features/              # Feature-based organization
│   ├── characters/        # Character management
│   ├── worlds/           # World building
│   ├── adventures/       # Adventure creation
│   ├── interaction/      # Interactive gameplay
│   └── landing/          # Landing page
├── shared/               # Shared utilities and types
├── ui/                   # Reusable UI components
└── infrastructure/       # External services
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd magic-worlds

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS Variables** - Theming system
- **React Icons** - Icon library

## Development

### Project Structure

- **Features**: Each major feature has its own folder with components, hooks, services, and types
- **Shared**: Common utilities, types, and hooks used across features
- **UI**: Reusable components and styling system
- **Infrastructure**: External services like storage and API clients

### Code Style

- Use TypeScript for all new code
- Follow React best practices and hooks patterns
- Keep components small and focused (< 200 lines)
- Use CSS variables for consistent theming
- Write self-documenting code with clear naming

### Adding New Features

1. Create a new folder in `src/features/`
2. Add components, hooks, services, and types as needed
3. Export from feature's `index.ts` file
4. Update routing in `AppRouter.tsx`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the project structure
4. Test your changes
5. Submit a pull request

## License

This project is licensed under the MIT License.
