# @deco/sdk

The official SDK for building applications with decocms.com's AI capabilities
and integrations.

## Overview

The `@deco/sdk` package provides a comprehensive set of tools and utilities for
building applications that leverage various AI models and file system
operations. Built with TypeScript and React, it offers a modern and type-safe
development experience.

## Features

- **Multiple AI Model Support**
  - Google Gemini 2.5 Pro
  - Claude 3.7 Sonnet
  - OpenAI GPT-4.1 (and variants)
  - Grok 3 Beta
  - And more...

- **File System Operations**
  - Directory reading and management
  - File operations with configurable options
  - Customizable encoding and permissions

- **Integration Management**
  - List and manage integrations
  - Tool call handling
  - Custom actor stubs

- **Agent Management**
  - Create and manage AI agents
  - List available agents
  - Configure agent capabilities

## Installation

```bash
npm install @deco/sdk
```

## Usage

### Basic Setup

```typescript
import { SDKProvider } from "@deco/sdk";

function App() {
  return (
    <SDKProvider>
      {/* Your application components */}
    </SDKProvider>
  );
}
```

### Using AI Models

```typescript
import { useAgents } from "@deco/sdk";

function MyComponent() {
  const { data: agents } = useAgents();

  return (
    <div>
      {agents.map((agent) => (
        <div key={agent.id}>
          <h3>{agent.name}</h3>
          {/* Render agent details */}
        </div>
      ))}
    </div>
  );
}
```

### File System Operations

```typescript
import { useDirectory } from "@deco/sdk";

function FileExplorer() {
  const { data: directory } = useDirectory("/path/to/directory");

  return (
    <div>
      {directory.map((file) => (
        <div key={file.name}>
          {file.name}
        </div>
      ))}
    </div>
  );
}
```

## Capabilities

The SDK supports various capabilities across different models:

- **Reasoning**: Basic AI model capabilities
- **Image Upload**: Support for image processing
- **File Upload**: File handling capabilities
- **Web Search**: Internet search functionality

## Development

The SDK is built with:

- TypeScript
- React 19
- TanStack Query
- Zod for validation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the terms of the Apache license.
