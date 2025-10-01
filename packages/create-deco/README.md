# create-deco

A simple wrapper package that allows users to create new deco projects using the
standard `npm create` pattern.

## Usage

```bash
# Using npm
npm create deco my-project

# Using yarn
yarn create deco my-project

# Using pnpm
pnpm create deco my-project

# Using bun
bun create deco my-project
```

## What it does

This package is a thin wrapper around the `create` command from `deco-cli`. When
you run `npm create deco`, it:

1. Invokes the `deco create` command from the `deco-cli` package
2. Passes all arguments through to the underlying command
3. Provides the same interactive experience as running `deco create` directly

## Requirements

- Node 22 or higher

## Related packages

- [`deco-cli`](../cli) - The main CLI tool for deco
