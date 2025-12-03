# MCP Apps Card Component

Componente adaptado para exibir aplicações MCP no novo formato do discovery do web app.

## Formato de Dados

O `MCPToolCard` (renomeado para aceitar MCPApp) agora suporta o formato de resposta do discovery:

```typescript
interface MCPApp {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  _meta?: {
    "io.decocms"?: {
      verified?: boolean;
      scopeName?: string;
      appName?: string;
    };
  };
  server?: {
    description?: string;
    icons?: Array<{
      src: string;
      mimeType: string;
    }>;
    _meta?: {
      "io.decocms/publisher-provided"?: {
        friendlyName?: string;
      };
    };
  };
}
```

## Exemplo de Resposta API

```json
{
  "items": [
    {
      "id": "app-id-123",
      "title": "My App",
      "created_at": "2025-12-02T10:00:00.000Z",
      "updated_at": "2025-12-02T15:30:00.000Z",
      "_meta": {
        "io.decocms": {
          "id": "app-id-123",
          "verified": true,
          "scopeName": "acme",
          "appName": "my-app"
        }
      },
      "server": {
        "name": "io.decocms/acme/my-app",
        "title": "My App",
        "description": "A great app",
        "icons": [
          {
            "src": "https://example.com/icon.png",
            "mimeType": "image/png"
          }
        ],
        "_meta": {
          "io.decocms/publisher-provided": {
            "friendlyName": "My Awesome App"
          }
        }
      }
    }
  ],
  "totalCount": 150,
  "hasMore": true
}
```

## Uso do Componente

### Importar

```tsx
import { MCPToolCard, type MCPApp } from "@/web/components/store";
```

### Usar em um Grid

```tsx
import { MCPToolCard, type MCPApp } from "@/web/components/store";
import { useState } from "react";

export function MCPAppsGrid() {
  const [apps, setApps] = useState<MCPApp[]>([
    {
      id: "app-1",
      title: "My App",
      server: {
        description: "A great app",
        icons: [{ src: "https://example.com/icon.png", mimeType: "image/png" }],
        _meta: {
          "io.decocms/publisher-provided": {
            friendlyName: "My Awesome App",
          },
        },
      },
      _meta: {
        "io.decocms": {
          verified: true,
          scopeName: "acme",
          appName: "my-app",
        },
      },
    },
  ]);

  const handleAppClick = (app: MCPApp) => {
    console.log("Clicked:", app);
    // Instalar, navegar, etc
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {apps.map((app) => (
        <MCPToolCard key={app.id} app={app} onCardClick={handleAppClick} />
      ))}
    </div>
  );
}
```

### Em uma Seção

```tsx
import { MCPToolCard, type MCPApp } from "@/web/components/store";

export function FeaturedApps({ apps }: { apps: MCPApp[] }) {
  const handleAppClick = (app: MCPApp) => {
    console.log("Selected app:", app);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Featured Apps</h2>
        <p className="text-sm text-muted-foreground">{apps.length} available</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {apps.map((app) => (
          <MCPToolCard
            key={app.id}
            app={app}
            onCardClick={handleAppClick}
          />
        ))}
      </div>
    </div>
  );
}
```

## Extração de Dados

O componente extrai automaticamente os dados do aninhamento complexo:

### Nome da App
Prioridade:
1. `server._meta["io.decocms/publisher-provided"].friendlyName` (nome amigável)
2. `title` (título da app)
3. "Unknown App" (fallback)

### Descrição
Prioridade:
1. `server.description` (descrição do servidor)
2. `description` (descrição geral)
3. "No description available" (fallback)

### Ícone
- `server.icons[0].src` (primeiro ícone, se disponível)
- Fallback para iniciais do nome

### Verificação
- `_meta["io.decocms"].verified` (boolean)
- Mostra badge verde "Verified by Deco"

## Exemplo Completo

```tsx
import { useState, useEffect } from "react";
import { MCPToolCard, type MCPApp } from "@/web/components/store";
import { Loader2 } from "lucide-react";
import { Icon } from "@deco/ui/components/icon.tsx";

export function MCPAppsPage() {
  const [apps, setApps] = useState<MCPApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await fetch("/api/mcp-registry/apps");
        const data = await response.json();
        setApps(data.items);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchApps();
  }, []);

  const handleAppClick = async (app: MCPApp) => {
    console.log("Installing:", app);
    // Install MCP app
    try {
      await fetch("/api/mcp/install", {
        method: "POST",
        body: JSON.stringify({
          appId: app.id,
          scope: app._meta?.["io.decocms"]?.scopeName,
          appName: app._meta?.["io.decocms"]?.appName,
        }),
      });
      console.log("Installed successfully");
    } catch (err) {
      console.error("Installation failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon name="error" size={48} className="text-destructive mb-4" />
        <p className="text-destructive">{error.message}</p>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Icon name="inbox" size={48} className="text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No apps available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">MCP Apps Registry</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {apps.map((app) => (
          <MCPToolCard key={app.id} app={app} onCardClick={handleAppClick} />
        ))}
      </div>
    </div>
  );
}
```

## Recursos

- ✅ Suporta nome amigável, descrição e ícone
- ✅ Badge de verificado (Deco verified)
- ✅ Fallback para iniciais
- ✅ Responsive grid
- ✅ Hover effects
- ✅ Tooltips informativos
- ✅ Dados aninhados extraídos automaticamente

## Mudanças de v1 para v2

| Aspecto | v1 | v2 |
|---------|----|----|
| Componente | `MCPToolCard` | `MCPToolCard` (mesmo nome, novo tipo) |
| Prop nome | `tool` | `app` |
| Tipo | `MCP` | `MCPApp` |
| Nome | `tool.name` | Extrai de `server._meta` > `title` |
| Descrição | `tool.description` | Extrai de `server.description` > `description` |
| Ícone | Não tinha | `server.icons[0].src` |
| Verificado | Não tinha | Badge "Verified by Deco" |

