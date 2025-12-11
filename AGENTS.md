# Repository Guidelines

## Project Structure & Module Organization
The workspace is managed via npm workspaces. Runtime surfaces live in `apps/`: `apps/web` hosts the Vite/React client, `apps/api` contains the edge API (Deno + Supabase bindings), and `apps/outbound` and `apps/deconfig` cover auxiliary services. Shared logic sits in `packages/` (UI kit, SDK, runtime, CLI tooling). Long-form docs are under `docs/`, infrastructure helpers sit in `scripts/`, and Supabase migrations live in `supabase/`.

## Build, Test, and Development Commands
- `npm run dev`: boots the web client and API locally (runs from repo root).
- `npm run build`: Deno-driven build targeting `apps/web` for production assets.
- `npm run lint`: runs `deno lint` with the repo-wide configuration.
- `npm run fmt` / `npm run fmt:check`: format or verify via Biome.
- `npm run check`: TypeScript compile-only check for all workspaces.
- `npm run test` / `npm run test:watch`: execute the Vitest suite once or in watch mode.
- `npm run db:migration` and `npm run db:types`: manage Supabase migrations and regenerate shared types.

## Coding Style & Naming Conventions
Biome enforces two-space indentation and double quotes; keep imports sorted and prefer explicit file extensions when Deno requires them. Components and classes use PascalCase, hooks and utilities use camelCase, and shared packages enforce kebab-case filenames via `plugins/enforce-kebab-case-file-names.ts`. Favor TypeScript types over `any`, and keep Tailwind design tokens consistent—`plugins/ensure-tailwind-design-system-tokens.ts` will fail builds otherwise.

## Testing Guidelines
Bun is the default runner. Co-locate specs next to source as `*.test.ts` or under each app's `test/` directory; align describe blocks with module names. Run `bun test` before raising a PR, and add targeted integration tests when touching API endpoints. Use `bun test --coverage` locally if changes could regress critical flows, and document any intentional coverage gaps in the PR description.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit-style history: `type(scope): message`, optionally wrapping the type in brackets for chores (e.g., `[chore]: update deps`). Reference issues or tickets with `(#1234)` when applicable. PRs should include a succinct summary, testing notes, and relevant screenshots for UI changes. Confirm formatting (`npm run fmt`) and tests before requesting review, and flag follow-up work with TODOs linked to issues.
