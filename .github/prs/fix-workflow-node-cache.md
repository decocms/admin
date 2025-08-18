Fix workflow failures caused by node setup cache expecting a root lockfile

What changed

- Removed the `cache: npm` option from `actions/setup-node` in workflows that
  run across the monorepo where there is no lockfile at the repository root.

Why

- `actions/setup-node`'s caching option requires a lockfile (package-lock.json,
  yarn.lock, etc.) in the repository root. When it is missing the step errors
  and the workflow fails. The repo is a multi-workspace monorepo and some
  workflows run from subpackages where lockfiles live elsewhere.

What this PR does

- Disable the `cache: npm` option in the affected workflows to avoid CI
  failures. This keeps installs working while preserving the rest of the
  workflow logic.

Follow-ups

- Consider enabling workspace-aware caching by adding lockfiles at repo root or
  switching workflows to run per-workspace and add workspace lockfiles. This PR
  removes the `cache: npm` option from `actions/setup-node` in the repository
  workflows to avoid failures when there is no lockfile at the repository root.

Why:

- `actions/setup-node` with `cache: 'npm'` expects a root lockfile
  (package-lock.json / yarn.lock). In this monorepo the lockfile is not at the
  root, causing CI runs that use the root workspace to fail with: "Dependencies
  lock file is not found..."

What this change does:

- Disables the cache option in the affected workflows so installs proceed even
  when no root lockfile exists.

Next steps:

- After merge, future PR runs should no longer fail with that specific error. We
  can consider a follow-up to enable workspace-aware caching (adding a root
  lockfile or configuring per-workspace caching).
