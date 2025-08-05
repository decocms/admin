# AGENTS.md - Development Guide for deco.chat

## Build/Lint/Test Commands
- **Build**: `npm run build` (web app), `PWD=$PWD/apps/web deno run build` (root)
- **Lint**: `deno lint --config ./package.json .` (root), `npm run lint` (web app uses ESLint)
- **Format**: `biome format --write` (format), `biome format` (check only)
- **Type Check**: `NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit`
- **Test**: `vitest run` (all tests), `vitest` (watch mode)
- **Single Test**: `vitest run path/to/test.test.ts`
- **Dev**: `npm run dev` (starts both web and api), `cd apps/web && npm run dev` (web only)

## Code Style Guidelines
- **Formatting**: 2-space indentation, double quotes (enforced by Biome)
- **File Naming**: kebab-case for directories (`auth-wizard`), camelCase for files
- **Imports**: Use named exports, organize imports (Biome auto-organizes)
- **TypeScript**: Prefer interfaces over types, avoid enums (use maps), functional components
- **React**: Use function keyword for pure functions, useMemo for expensive computations
- **Components**: Single responsibility, use @deco/ui components, avoid prop drilling
- **Forms**: Use react-hook-form with Zod validation, not useState for form state
- **Performance**: Use useDeferredValue for search, memoize objects/arrays in dependency arrays
- **Error Handling**: Consistent loading/error states, extract complex logic into components
- **Database**: Use QueryResult pattern, workspace-scoped queries, proper RLS policies