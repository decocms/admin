# Repository Guidelines

## Project Structure & Module Organization
The workspace is managed via npm workspaces. Runtime surfaces live in `apps/`: `apps/web` hosts the Vite/React client, `apps/api` contains the edge API (Deno + Supabase bindings), and `apps/outbound` and `apps/deconfig` cover auxiliary services. Shared logic sits in `packages/` (UI kit, SDK, runtime, CLI tooling). Long-form docs are under `docs/`, infrastructure helpers sit in `scripts/`, and Supabase migrations live in `supabase/`.

## Build, Test, and Development Commands
Always prefer Bun when running scripts locally to avoid npm's extra overhead.

- `bun run dev`: boots the web client and API locally (runs from repo root).
- `bun run build`: Deno-driven build targeting `apps/web` for production assets.
- `bun run lint`: runs `deno lint` with the repo-wide configuration.
- `bun run fmt` / `bun run fmt:check`: format or verify via Biome. Prefer `bun run fmt:check --fix` first so we don't spend review tokens on auto-fixable formatting.
- `bun run check`: TypeScript compile-only check for all workspaces.
- `bun run test` / `bun run test:watch`: execute the Vitest suite once or in watch mode.
- `bun run db:migration` and `bun run db:types`: manage Supabase migrations and regenerate shared types.

## Coding Style & Naming Conventions
Biome enforces two-space indentation and double quotes; keep imports sorted and prefer explicit file extensions when Deno requires them. Components and classes use PascalCase, hooks and utilities use camelCase, and shared packages enforce kebab-case filenames via `plugins/enforce-kebab-case-file-names.ts`. Favor TypeScript types over `any`, and keep Tailwind design tokens consistent—`plugins/ensure-tailwind-design-system-tokens.ts` will fail builds otherwise.

## Testing Guidelines
Vitest is the default runner. Co-locate specs next to source as `*.test.ts` or under each app's `test/` directory; align describe blocks with module names. Run `bun run test` before raising a PR, and add targeted integration tests when touching API endpoints. Use `bun run test -- --run --coverage` locally if changes could regress critical flows, and document any intentional coverage gaps in the PR description.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit-style history: `type(scope): message`, optionally wrapping the type in brackets for chores (e.g., `[chore]: update deps`). Reference issues or tickets with `(#1234)` when applicable. PRs should include a succinct summary, testing notes, and relevant screenshots for UI changes. Confirm formatting (`bun run fmt` or `bun run fmt:check --fix`) and tests before requesting review, and flag follow-up work with TODOs linked to issues.
