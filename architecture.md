# Deco.chat Architecture

## Overview

deco.chat is an extensible, self-hosted AI workspace for building intelligent, UI-rich AI Agents that integrate seamlessly with internal tools and data. It's built as a modern web application following a microservices architecture powered by Cloudflare Workers and Deno.

### Core Concept

deco.chat is an **Agent Builder application** that allows users to:
- Connect integrations (Google Drive, Sheets, Notion, or custom ones)
- Create AI Agents with system instructions and available tools
- Deploy agents that provide rich, interactive UI experiences
- Manage workspaces with team collaboration features

## Technology Stack

- **Frontend**: React 19, Tailwind CSS v4, Vite, shadcn/ui
- **Backend**: Deno, TypeScript, Hono (API framework)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **Infrastructure**: Cloudflare Workers, Cloudflare Pages
- **AI/ML**: Multiple providers (OpenAI, Anthropic, Google, DeepSeek, etc.)
- **Protocol**: Model Context Protocol (MCP) for tool communication
- **Authentication**: Supabase Auth with JWT tokens

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web App<br/>React SPA]
        CLI[CLI Tool<br/>Deno]
        Mobile[Mobile Apps<br/>Future]
    end
    
    subgraph "Edge Layer - Cloudflare"
        Pages[Pages Worker<br/>Route Dispatcher]
        API[API Service<br/>api.deco.chat]
        Outbound[Outbound Proxy<br/>External Requests]
        R2[R2 Storage<br/>File Storage]
    end
    
    subgraph "AI Layer"
        Agent[AI Agents<br/>Durable Objects]
        Trigger[Triggers<br/>Durable Objects]
        LLM[LLM Providers<br/>OpenAI, Anthropic, etc.]
    end
    
    subgraph "Data Layer"
        Supabase[Supabase<br/>PostgreSQL]
        D1[D1 Database<br/>Workflows]
        Memory[Memory Store<br/>LibSQL/Turso]
    end
    
    subgraph "External Services"
        Integrations[Integrations<br/>Google, Slack, etc.]
        Payments[Stripe<br/>Payments]
        Email[Email Service<br/>Resend]
    end
    
    Web --> Pages
    CLI --> API
    Pages --> API
    API --> Agent
    API --> Trigger
    API --> Supabase
    API --> D1
    API --> Memory
    API --> R2
    Agent --> LLM
    Outbound --> Integrations
    API --> Payments
    API --> Email
    
    style Web fill:#e1f5fe
    style API fill:#f3e5f5
    style Agent fill:#e8f5e8
    style Supabase fill:#fff3e0
```

## System Components

### 1. Frontend Applications

#### Web Application (`apps/web`)
- **Type**: React 19 SPA built with Vite
- **Hosting**: Cloudflare Pages
- **Features**:
  - Agent builder interface
  - Chat interface with rich UI components
  - Workspace management
  - Team collaboration tools
  - Integration management

#### CLI Tool (`packages/cli`)
- **Type**: Deno-based command-line interface
- **Features**:
  - Authentication management
  - Application deployment
  - Workspace operations
  - Local development tools

### 2. Backend Services

#### API Service (`apps/api`)
- **Type**: Hono-based API running on Cloudflare Workers
- **Domain**: `api.deco.chat`
- **Features**:
  - MCP (Model Context Protocol) server
  - Authentication & authorization
  - CRUD operations for agents, integrations, teams
  - File management
  - Webhook handling

#### Outbound Service (`apps/outbound`)
- **Type**: Proxy service for external requests
- **Purpose**: Handle authentication for hosted applications
- **Features**:
  - JWT token management
  - Request proxying
  - Supabase integration for app metadata

#### Pages Worker (`apps/pages`)
- **Type**: Dynamic routing service
- **Domain**: `*.deco.page`
- **Purpose**: Route requests to appropriate hosted applications
- **Features**:
  - Subdomain-based routing
  - Application dispatch
  - Error handling

### 3. AI & Processing Layer

#### AI Agents (Durable Objects)
- **Type**: Cloudflare Durable Objects
- **Features**:
  - Stateful AI agent execution
  - Memory management
  - Tool execution
  - Streaming responses
  - Multi-model support

#### Triggers (Durable Objects)
- **Type**: Cloudflare Durable Objects
- **Features**:
  - Webhook handling
  - Scheduled tasks
  - Event processing
  - Channel management

### 4. Data Layer

#### Supabase (Primary Database)
- **Type**: PostgreSQL with real-time features
- **Key Tables**:
  - `deco_chat_agents`
  - `deco_chat_integrations`
  - `deco_chat_teams`
  - `deco_chat_channels`
  - `deco_chat_hosting_apps`
  - `deco_chat_api_keys`
  - `profiles`
  - `members`

#### Cloudflare R2 (File Storage)
- **Purpose**: File storage with CDN capabilities
- **Features**:
  - Workspace-specific buckets
  - Pre-signed URLs
  - CORS configuration
  - Asset management

#### D1 Database (Workflows)
- **Type**: Cloudflare D1 (SQLite)
- **Purpose**: Workflow execution and state management
- **Features**:
  - Workflow run tracking
  - Step execution logs
  - Performance metrics

## Data Flow Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        React[React Components]
        Hooks[SDK Hooks]
        Query[React Query]
    end
    
    subgraph "API Layer"
        MCP[MCP Server]
        Tools[MCP Tools]
        Auth[Authorization]
    end
    
    subgraph "Agent Layer"
        Agent[AI Agent DO]
        Memory[Agent Memory]
        Tools2[Agent Tools]
    end
    
    subgraph "Data Layer"
        DB[(Supabase)]
        R2[(R2 Storage)]
        D1[(D1 Database)]
    end
    
    React --> Hooks
    Hooks --> Query
    Query --> MCP
    MCP --> Tools
    Tools --> Auth
    Auth --> Agent
    Agent --> Memory
    Agent --> Tools2
    Tools --> DB
    Tools --> R2
    Tools --> D1
    
    style React fill:#e3f2fd
    style MCP fill:#f1f8e9
    style Agent fill:#fce4ec
    style DB fill:#fff8e1
```

## Model Context Protocol (MCP) Architecture

deco.chat uses MCP as its core communication protocol for tools and integrations:

```mermaid
graph LR
    subgraph "MCP Client"
        Frontend[Frontend App]
        CLI[CLI Tool]
    end
    
    subgraph "MCP Servers"
        Global[Global Tools<br/>Teams, Profiles]
        Workspace[Workspace Tools<br/>Agents, Threads]
        Agent[Agent Tools<br/>Agent-specific]
        Email[Email Tools<br/>Email Operations]
    end
    
    subgraph "Tool Categories"
        CRUD[CRUD Operations]
        FS[File System]
        AI[AI Operations]
        Integration[Integrations]
    end
    
    Frontend --> Global
    Frontend --> Workspace
    Frontend --> Agent
    Frontend --> Email
    CLI --> Global
    CLI --> Workspace
    
    Global --> CRUD
    Workspace --> CRUD
    Agent --> AI
    Email --> Integration
    
    style Frontend fill:#e8f5e8
    style Global fill:#fff3e0
    style Workspace fill:#f3e5f5
    style Agent fill:#e1f5fe
```

## Infrastructure Components

### Cloudflare Services

```mermaid
graph TB
    subgraph "Cloudflare Edge"
        CDN[CDN/Cache]
        DNS[DNS Management]
        SSL[SSL/TLS]
    end
    
    subgraph "Cloudflare Workers"
        API[API Worker]
        Pages[Pages Worker]
        Outbound[Outbound Worker]
        Apps[Hosted Apps]
    end
    
    subgraph "Cloudflare Storage"
        R2[R2 Object Storage]
        D1[D1 Database]
        KV[KV Store]
    end
    
    subgraph "Cloudflare Compute"
        DO[Durable Objects]
        Queue[Queues]
        Cron[Cron Triggers]
    end
    
    CDN --> API
    CDN --> Pages
    DNS --> CDN
    SSL --> CDN
    
    API --> R2
    API --> D1
    API --> KV
    API --> DO
    API --> Queue
    
    Pages --> Apps
    Outbound --> Apps
    
    DO --> Queue
    Cron --> DO
    
    style CDN fill:#e3f2fd
    style API fill:#f1f8e9
    style R2 fill:#fff8e1
    style DO fill:#fce4ec
```

## Component Descriptions

### Cloudflare Edge
- **CDN/Cache**: Global content delivery network that caches static assets and API responses at edge locations worldwide for faster loading times
- **DNS Management**: Cloudflare's DNS service that routes user requests to the nearest edge location and manages domain resolution
- **SSL/TLS**: Automatic SSL certificate management and TLS encryption for secure HTTPS connections

### Cloudflare Workers
- **API Worker**: Main backend service running on `api.deco.chat` that handles all API requests, authentication, and business logic
- **Pages Worker**: Dynamic routing service on `*.deco.page` that dispatches requests to appropriate hosted applications based on subdomain
- **Outbound Worker**: Proxy service that handles external API calls and manages authentication tokens for hosted applications
- **Hosted Apps**: User-deployed applications running as individual Workers, created through the deco.chat platform

### Cloudflare Storage
- **R2 Object Storage**: S3-compatible object storage for files, documents, and assets with global distribution and no egress fees
- **D1 Database**: SQLite-based database service used for workflow execution, step tracking, and performance metrics
- **KV Store**: Key-value storage for caching, session data, and configuration settings with eventual consistency

### Cloudflare Compute
- **Durable Objects**: Stateful compute units that handle AI agent execution, maintaining conversation state and processing logic
- **Queues**: Message queuing system for asynchronous task processing and background job execution
- **Cron Triggers**: Scheduled task execution for periodic operations like cleanup jobs and maintenance tasks