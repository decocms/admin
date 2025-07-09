# Deco.chat Architecture

## Application Components

```mermaid
graph TB
    subgraph "Frontend Layer"
        WebApp[Web Application<br/><small>Cloudflare Pages</small>]
        CLI[CLI Tool<br/><small>Deno Runtime</small>]
        CDN[Content Delivery<br/><small>Cloudflare CDN</small>]
    end
    
    subgraph "Backend Services"
        API[API Server<br/><small>Cloudflare Workers</small>]
        Outbound[Outbound Proxy<br/><small>Cloudflare Workers</small>]
        Auth[Authentication<br/><small>Supabase Auth</small>]
    end
    
    subgraph "AI & Processing"
        Agents[AI Agents<br/><small>Durable Objects</small>]
        Triggers[Event Triggers<br/><small>Durable Objects</small>]
        Scheduler[Task Scheduler<br/><small>Cron Triggers</small>]
    end
    
    subgraph "Data & Storage"
        Database[Primary Database<br/><small>Supabase PostgreSQL</small>]
        FileStorage[File Storage<br/><small>Cloudflare R2</small>]
        Cache[Cache Layer<br/><small>Cloudflare KV</small>]
        Workflows[Workflow DB<br/><small>Cloudflare D1</small>]
    end
    
    WebApp --> CDN
    CLI --> API
    CDN --> API
    API --> Auth
    API --> Agents
    API --> Triggers
    API --> Database
    API --> FileStorage
    API --> Cache
    API --> Workflows
    
    Agents --> Database
    Agents --> FileStorage
    Triggers --> Database
    Scheduler --> Triggers
    Outbound --> API
    
    style WebApp fill:#e3f2fd
    style API fill:#f1f8e9
    style Agents fill:#fce4ec
    style Database fill:#fff8e1
```

A arquitetura do deco.chat é organizada em camadas funcionais que representam diferentes aspectos da aplicação. A camada de frontend inclui a aplicação web React hospedada via Cloudflare Pages e uma ferramenta CLI, ambas se comunicando através de uma CDN global. O backend é composto por serviços de API executados em Cloudflare Workers, que gerenciam autenticação via Supabase e processamento de requisições através de um proxy outbound para integrações externas.

A camada de processamento de IA utiliza Durable Objects para manter estado persistente dos agentes conversacionais e triggers de eventos, complementada por um sistema de agendamento via Cron Triggers. O armazenamento de dados é distribuído entre o banco principal PostgreSQL do Supabase para dados estruturados, Cloudflare R2 para arquivos e assets, Cloudflare KV para cache de alta performance, e Cloudflare D1 para dados de workflows e métricas operacionais. 