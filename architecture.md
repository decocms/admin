# Deco.chat Architecture

## Infrastructure Components

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

A arquitetura do deco.chat é construída inteiramente sobre a plataforma Cloudflare, aproveitando seus serviços de edge computing para criar uma solução escalável e distribuída globalmente. O sistema utiliza Cloudflare Workers para executar a lógica de backend, Cloudflare R2 para armazenamento de objetos, D1 para banco de dados SQL, e Durable Objects para manter estado dos agentes de IA. Esta arquitetura edge-first garante baixa latência e alta disponibilidade em qualquer região do mundo.

Os componentes principais incluem o API Worker que gerencia todas as operações de backend, o Pages Worker que roteia aplicações hospedadas dinamicamente, e o Outbound Worker que funciona como proxy para requisições externas. O armazenamento é distribuído entre R2 (arquivos e assets), D1 (workflows e métricas), e KV Store (cache e configurações), enquanto os Durable Objects mantêm o estado conversacional dos agentes de IA e processam triggers em tempo real. 