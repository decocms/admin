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

### Authentication & Security

```mermaid
graph TB
    subgraph "Authentication Flow"
        User[User]
        Supabase[Supabase Auth]
        JWT[JWT Tokens]
        API[API Service]
    end
    
    subgraph "Authorization"
        RBAC[Role-Based Access]
        Policies[Policies]
        Teams[Team Membership]
    end
    
    subgraph "Security Features"
        Encryption[Data Encryption]
        HTTPS[HTTPS/TLS]
        CORS[CORS Policy]
        RLS[Row Level Security]
    end
    
    User --> Supabase
    Supabase --> JWT
    JWT --> API
    API --> RBAC
    RBAC --> Policies
    RBAC --> Teams
    
    API --> Encryption
    API --> HTTPS
    API --> CORS
    Supabase --> RLS
    
    style User fill:#e8f5e8
    style Supabase fill:#fff3e0
    style RBAC fill:#f3e5f5
    style Encryption fill:#fce4ec
```

## Database Schema Overview

### Core Tables

```mermaid
erDiagram
    profiles {
        bigint id PK
        uuid user_id FK
        string name
        string email
        timestamp created_at
    }
    
    teams {
        bigint id PK
        string name
        string slug UK
        jsonb theme
        uuid plan_id FK
        timestamp created_at
    }
    
    members {
        bigint id PK
        uuid user_id FK
        bigint team_id FK
        boolean admin
        jsonb activity
        timestamp deleted_at
    }
    
    deco_chat_agents {
        uuid id PK
        string name
        string workspace
        jsonb tools_set
        jsonb memory
        string model
        text instructions
        timestamp created_at
    }
    
    deco_chat_integrations {
        uuid id PK
        string name
        string workspace
        jsonb connection
        string icon
        timestamp created_at
    }
    
    deco_chat_channels {
        uuid id PK
        string discriminator
        uuid integration_id FK
        string workspace
        boolean active
        timestamp created_at
    }
    
    deco_chat_hosting_apps {
        uuid id PK
        string slug UK
        string workspace
        jsonb files
        string cloudflare_worker_id
        timestamp created_at
    }
    
    profiles ||--o{ members : "user_id"
    teams ||--o{ members : "team_id"
    deco_chat_integrations ||--o{ deco_chat_channels : "integration_id"
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        Dev[Local Development]
        Deno[Deno Runtime]
        Local[Local Backend]
    end
    
    subgraph "CI/CD"
        GitHub[GitHub Actions]
        Build[Build Process]
        Test[Testing]
    end
    
    subgraph "Production"
        CF[Cloudflare Workers]
        Pages[Cloudflare Pages]
        Supabase[Supabase Cloud]
        R2[Cloudflare R2]
    end
    
    subgraph "Monitoring"
        Logs[Cloudflare Logs]
        Analytics[Analytics]
        Alerts[Alerting]
    end
    
    Dev --> GitHub
    GitHub --> Build
    Build --> Test
    Test --> CF
    Test --> Pages
    Test --> Supabase
    Test --> R2
    
    CF --> Logs
    Pages --> Analytics
    Logs --> Alerts
    
    style Dev fill:#e8f5e8
    style GitHub fill:#f1f8e9
    style CF fill:#e3f2fd
    style Logs fill:#fff8e1
```

## Integration Architecture

### External Integrations

```mermaid
graph TB
    subgraph "deco.chat Core"
        Agent[AI Agents]
        MCP[MCP Server]
        Tools[Tool Registry]
    end
    
    subgraph "AI Providers"
        OpenAI[OpenAI GPT]
        Anthropic[Anthropic Claude]
        Google[Google Gemini]
        DeepSeek[DeepSeek]
        XAI[xAI Grok]
    end
    
    subgraph "Productivity Tools"
        Drive[Google Drive]
        Sheets[Google Sheets]
        Notion[Notion]
        Slack[Slack]
        Email[Email Services]
    end
    
    subgraph "Communication"
        WhatsApp[WhatsApp Business]
        Channels[Custom Channels]
        Webhooks[Webhooks]
    end
    
    subgraph "Payment & Billing"
        Stripe[Stripe]
        Wallet[Wallet System]
        Plans[Subscription Plans]
    end
    
    Agent --> MCP
    MCP --> Tools
    Tools --> OpenAI
    Tools --> Anthropic
    Tools --> Google
    Tools --> DeepSeek
    Tools --> XAI
    
    Tools --> Drive
    Tools --> Sheets
    Tools --> Notion
    Tools --> Slack
    Tools --> Email
    
    Tools --> WhatsApp
    Tools --> Channels
    Tools --> Webhooks
    
    Tools --> Stripe
    Tools --> Wallet
    Tools --> Plans
    
    style Agent fill:#e8f5e8
    style OpenAI fill:#e3f2fd
    style Drive fill:#f1f8e9
    style WhatsApp fill:#e1f5fe
    style Stripe fill:#fce4ec
```

## Performance & Scaling

### Caching Strategy

```mermaid
graph TB
    subgraph "Client-Side Caching"
        ReactQuery[React Query]
        LocalStorage[Local Storage]
        IndexedDB[IndexedDB]
    end
    
    subgraph "Edge Caching"
        CDN[Cloudflare CDN]
        EdgeCache[Edge Cache]
        Workers[Worker Cache]
    end
    
    subgraph "Database Caching"
        Policy[Policy Cache]
        LRU[LRU Cache]
        Memory[Memory Cache]
    end
    
    subgraph "Asset Caching"
        R2Cache[R2 Cache]
        Static[Static Assets]
        Images[Image Cache]
    end
    
    ReactQuery --> EdgeCache
    LocalStorage --> CDN
    CDN --> Workers
    Workers --> Policy
    Policy --> LRU
    Workers --> R2Cache
    R2Cache --> Static
    Static --> Images
    
    style ReactQuery fill:#e3f2fd
    style CDN fill:#f1f8e9
    style Policy fill:#e8f5e8
    style R2Cache fill:#fff8e1
```

## Security Architecture

### Security Layers

```mermaid
graph TB
    subgraph "Network Security"
        WAF[Web Application Firewall]
        DDoS[DDoS Protection]
        SSL[SSL/TLS Encryption]
    end
    
    subgraph "Authentication"
        OAuth[OAuth 2.0]
        JWT[JWT Tokens]
        MFA[Multi-Factor Auth]
    end
    
    subgraph "Authorization"
        RBAC[Role-Based Access]
        Policies[Fine-grained Policies]
        Teams[Team Permissions]
    end
    
    subgraph "Data Protection"
        Encryption[Data Encryption]
        RLS[Row Level Security]
        Audit[Audit Logging]
    end
    
    WAF --> OAuth
    DDoS --> JWT
    SSL --> MFA
    OAuth --> RBAC
    JWT --> Policies
    MFA --> Teams
    RBAC --> Encryption
    Policies --> RLS
    Teams --> Audit
    
    style WAF fill:#ffebee
    style OAuth fill:#e8f5e8
    style RBAC fill:#e3f2fd
    style Encryption fill:#fff8e1
```

## Monitoring & Observability

### Observability Stack

```mermaid
graph TB
    subgraph "Metrics Collection"
        OTEL[OpenTelemetry]
        Traces[Distributed Tracing]
        Metrics[Custom Metrics]
    end
    
    subgraph "Logging"
        CFLogs[Cloudflare Logs]
        Structured[Structured Logging]
        Correlation[Correlation IDs]
    end
    
    subgraph "Monitoring"
        Dashboards[Dashboards]
        Alerts[Alerting]
        SLO[SLO Monitoring]
    end
    
    subgraph "Analytics"
        Usage[Usage Analytics]
        Performance[Performance Metrics]
        Costs[Cost Monitoring]
    end
    
    OTEL --> CFLogs
    Traces --> Structured
    Metrics --> Correlation
    CFLogs --> Dashboards
    Structured --> Alerts
    Correlation --> SLO
    Dashboards --> Usage
    Alerts --> Performance
    SLO --> Costs
    
    style OTEL fill:#e3f2fd
    style CFLogs fill:#f1f8e9
    style Dashboards fill:#e8f5e8
    style Usage fill:#fff8e1
```

## Development Workflow

### Development Process

```mermaid
graph LR
    subgraph "Local Development"
        Code[Code Changes]
        Deno[Deno Dev Server]
        Local[Local Testing]
    end
    
    subgraph "Version Control"
        Git[Git Repository]
        Branch[Feature Branches]
        PR[Pull Requests]
    end
    
    subgraph "CI/CD Pipeline"
        Build[Build & Test]
        Deploy[Deploy to Staging]
        Prod[Deploy to Production]
    end
    
    subgraph "Monitoring"
        Health[Health Checks]
        Metrics[Metrics Collection]
        Alerts[Alert System]
    end
    
    Code --> Deno
    Deno --> Local
    Local --> Git
    Git --> Branch
    Branch --> PR
    PR --> Build
    Build --> Deploy
    Deploy --> Prod
    Prod --> Health
    Health --> Metrics
    Metrics --> Alerts
    
    style Code fill:#e8f5e8
    style Git fill:#f1f8e9
    style Build fill:#e3f2fd
    style Health fill:#fff8e1
```

## Conclusion

deco.chat represents a modern, scalable architecture for AI agent development and deployment. The system leverages Cloudflare's edge computing capabilities, Supabase's database and authentication services, and a robust MCP-based tool system to provide a comprehensive platform for building intelligent agents.

Key architectural strengths:
- **Edge-first design** with global distribution
- **Microservices architecture** for scalability
- **Type-safe communication** via MCP
- **Rich ecosystem** of integrations
- **Comprehensive security** with RBAC
- **Developer-friendly** tools and APIs

The architecture is designed to support rapid development, easy deployment, and seamless scaling as the platform grows.