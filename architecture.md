# Deco.chat Architecture

## Application Components

```mermaid
graph TB
    subgraph "Frontend Layer"
        WebApp[React Web App<br/><small>Cloudflare Pages</small>]
        CDN[Content Delivery<br/><small>Cloudflare CDN</small>]
    end
    
    subgraph "Backend Services"
        API[api.deco.chat<br/><small>Cloudflare Workers</small>]
        Outbound[Outbound Proxy for authenticating user-deployed workers<br/><small>Cloudflare Workers</small>]
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

A arquitetura do deco.chat é organizada em camadas funcionais que representam diferentes aspectos da aplicação. A camada de frontend inclui a aplicação web React hospedada via Cloudflare Pages, que se comunica através de uma CDN global. O backend é composto por serviços de API executados em Cloudflare Workers, que gerenciam autenticação via Supabase e processamento de requisições através de um proxy outbound para integrações externas.

A camada de processamento de IA utiliza Durable Objects para manter estado persistente dos agentes conversacionais e triggers de eventos, complementada por um sistema de agendamento via Cron Triggers. O armazenamento de dados é distribuído entre o banco principal PostgreSQL do Supabase para dados estruturados, Cloudflare R2 para arquivos e assets, Cloudflare KV para cache de alta performance, e Cloudflare D1 para dados de workflows e métricas operacionais. 

## Cloudflare Workers for Platforms

O deco.chat utiliza o Cloudflare Workers for Platforms para implementar um modelo de computação multi-tenant, onde cada workspace possui seus próprios workers isolados. Esta arquitetura permite que integrações customizadas sejam executadas de forma segura e independente para cada workspace.

### User Workers e Outbound Proxy

```mermaid
graph TB
    subgraph "Workspace A"
        UserWorkerA[User Worker A<br/><small>Workspace-specific Worker</small>]
        MCPsA[MCPs/Integrations A<br/><small>Google Drive, Notion, etc.</small>]
    end
    
    subgraph "Workspace B"
        UserWorkerB[User Worker B<br/><small>Workspace-specific Worker</small>]
        MCPsB[MCPs/Integrations B<br/><small>Slack, Sheets, etc.</small>]
    end
    
    subgraph "Platform Services"
        OutboundProxy[Outbound Proxy<br/><small>Request Routing Service</small>]
        API[Main API<br/><small>Platform Management</small>]
        Auth[Authentication<br/><small>Workspace Credentials</small>]
    end
    
    UserWorkerA --> OutboundProxy
    UserWorkerB --> OutboundProxy
    OutboundProxy --> Auth
    Auth --> MCPsA
    Auth --> MCPsB
    API --> UserWorkerA
    API --> UserWorkerB
    
    style UserWorkerA fill:#e8f5e8
    style UserWorkerB fill:#e8f5e8
    style OutboundProxy fill:#fff3e0
    style Auth fill:#e1f5fe
    style MCPsA fill:#f3e5f5
    style MCPsB fill:#f3e5f5
```

### Autenticação de MCPs

Apenas os **user workers** (workers específicos de cada workspace) utilizam o outbound proxy para autenticar chamadas para os MCPs. Esta abordagem garante:

- **Isolamento de Segurança**: Cada workspace tem suas próprias credenciais e permissões
- **Autenticação Centralizada**: O serviço de autenticação gerencia todas as credenciais de integração
- **Controle de Acesso**: Apenas workers autorizados podem acessar integrações específicas
- **Auditoria**: Todas as chamadas para MCPs são rastreadas e logadas

O fluxo de autenticação funciona da seguinte forma:

1. **User Worker** recebe uma requisição para acessar uma integração (ex: Google Drive)
2. **User Worker** faz uma chamada para o **Outbound Proxy** com o token do workspace
3. **Outbound Proxy** valida o token e encaminha para o serviço de **Authentication**
4. **Authentication** recupera as credenciais específicas do workspace e autentica a chamada com a integração externa (MCP)
5. **Authentication** retorna a resposta autenticada através do **Outbound Proxy** para o **User Worker**

Esta arquitetura permite que cada workspace tenha suas próprias integrações configuradas de forma independente, enquanto mantém a segurança e o controle centralizados através do outbound proxy e do serviço de autenticação. 