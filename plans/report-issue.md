## Report Issue — Descoberta (onde está o quê)

Este documento mapeia os pontos do sistema que precisamos tocar para adicionar
um botão "Report Issue" na UI e registrar o reporte via MCP na camada Team &
User Management, salvando no banco.

### Escopo da UI (Topbar no contexto de projeto)

- Arquivo base da topbar em telas de projeto:
  `apps/web/src/components/layout/project.tsx`
  - Área top-right (onde fica o botão de Chat):
    ```typescript
    // linha ~193-204
    <div id="chat-header-end-slot" className={cn("flex items-center gap-2", ...)}>
      {actionButtons}
      {preferences.enableDecopilot && <ToggleDecopilotButton />}
    </div>
    ```
  - O `ToggleDecopilotButton` usa simplesmente `<Icon name="chat" />` (sem logo,
    apenas ícone do sistema).
  - Para posicionar "Report Issue" à esquerda do Chat: renderizar entre
    `{actionButtons}` e `<ToggleDecopilotButton />`.

- Apenas telas de projeto usam `PageLayout` (garante que o botão apareça só em
  projeto):
  - Todas as rotas sob `/:org/:project` em `apps/web/src/main.tsx` usam
    `ProjectLayout` → `PageLayout`.
  - Exemplos: `/agents`, `/connections`, `/settings`, `/monitor`, `/views`, etc.

- Componentes de UI disponíveis (preferir `@deco/ui`): `popover.tsx`,
  `select.tsx`, `textarea.tsx`, `button.tsx`.

### Captura de contexto no cliente (usuário e localização)

- Hook do usuário: `useUser()` de `apps/web/src/hooks/use-user.ts`
  - Retorna `User` com `id`, `email` via `fetchUser()` (que chama
    `MCPClient.PROFILES_GET`).

- Localização atual:
  - `useParams()` → `org`, `project`
  - `useLocation()` → `pathname`, `search`
  - `globalThis.location.href` → URL completa

### Fluxo MCP + Persistência (onde plugar o novo tool)

- Onde os MCP tools de Team & User Management vivem:
  `packages/sdk/src/mcp/members/api.ts`
  - Grupo criado via
    `createToolGroup("Team", { name: "Team & User Management", ... })`.
  - Padrão de persistência: `c.db.from("<tabela>").insert(...).select()`.
  - Esse é o local ideal para `TEAM_REPORT_ISSUE_CREATE`.

- Como o AppContext injeta o banco:
  - `apps/api/src/middlewares/context.ts` →
    `ctx.set("db", getServerClient(...))`.
  - Todos os tools em `packages/sdk/src/mcp/**/api.ts` usam `c.db`.

- Onde salvar o reporte:
  - Não existe tabela de `issues` ainda. Criar migration:
    `supabase/migrations/<timestamp>_create_issues_table.sql`.
  - Nome da tabela: `deco_chat_issues`.
  - Colunas:
    - `id` (uuid, pk)
    - `team_id` (int, fk `teams.id`)
    - `project_id` (int, nullable, fk `deco_chat_projects.id`)
    - `reporter_user_id` (uuid, fk `auth.users.id`)
    - `type` (text, check: `Bug` | `Idea`)
    - `content` (text)
    - `url` (text, nullable)
    - `path` (text, nullable)
    - `created_at` (timestamptz, default now())

### Onde colocar o novo Tool

- Arquivo: `packages/sdk/src/mcp/members/api.ts`.
- Nome: `TEAM_REPORT_ISSUE_CREATE`.
- Input schema (Zod):
  - `teamSlug: string`
  - `projectSlug?: string`
  - `type: "Bug" | "Idea"`
  - `content: string`
  - `url?: string`
  - `path?: string`
- Handler:
  1. Buscar `team` por `slug` → `team_id`.
  2. `assertTeamResourceAccess(c.tool.name, teamId, c)`.
  3. `assertPrincipalIsUser(c)` → `user.id`.
  4. Se `projectSlug`, buscar `project_id`.
  5. `c.db.from("deco_chat_issues").insert([...])`.

### Como o front chamará o tool

```typescript
import { MCPClient } from "@deco/sdk";

await MCPClient.TEAM_REPORT_ISSUE_CREATE({
  teamSlug: org,
  projectSlug: project,
  type: "Bug" | "Idea",
  content,
  url: globalThis.location.href,
  path: location.pathname,
});
```

---

## Planejamento de Implementação

### 1. Migration do Banco (Supabase)

**Arquivo**: `supabase/migrations/<timestamp>_create_issues_table.sql`

```sql
CREATE TABLE IF NOT EXISTS deco_chat_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id integer REFERENCES deco_chat_projects(id) ON DELETE SET NULL,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('Bug', 'Idea')),
  content text NOT NULL,
  url text,
  path text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_deco_chat_issues_team_id ON deco_chat_issues(team_id);
CREATE INDEX idx_deco_chat_issues_reporter_user_id ON deco_chat_issues(reporter_user_id);
CREATE INDEX idx_deco_chat_issues_created_at ON deco_chat_issues(created_at DESC);

ALTER TABLE deco_chat_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team issues"
  ON deco_chat_issues FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "Team members can create issues"
  ON deco_chat_issues FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
```

**Próximos passos**: Nomear com timestamp atual; testar com `supabase db reset`.

---

### 2. MCP Tool (Backend)

**Arquivo**: `packages/sdk/src/mcp/members/api.ts`

Adicionar após os tools existentes:

```typescript
export const createIssue = createTool({
  name: "TEAM_REPORT_ISSUE_CREATE",
  description: "Report a bug or idea within a team/project context",
  inputSchema: z.object({
    teamSlug: z.string(),
    projectSlug: z.string().optional(),
    type: z.enum(["Bug", "Idea"]),
    content: z.string().min(1),
    url: z.string().optional(),
    path: z.string().optional(),
  }),
  handler: async (props, c) => {
    const { teamSlug, projectSlug, type, content, url, path } = props;

    // 1. Get team by slug
    const { data: team, error: teamError } = await c.db
      .from("teams")
      .select("id")
      .eq("slug", teamSlug)
      .single();

    if (teamError) throw teamError;
    if (!team) throw new NotFoundError("Team not found");

    const teamId = team.id;

    // 2. Assert access
    await assertTeamResourceAccess(c.tool.name, teamId, c);
    assertPrincipalIsUser(c);
    const user = c.user;

    // 3. Resolve project_id if provided
    let projectId: number | null = null;
    if (projectSlug) {
      const { data: project } = await c.db
        .from("deco_chat_projects")
        .select("id")
        .eq("org_id", teamId)
        .eq("slug", projectSlug)
        .single();
      projectId = project?.id ?? null;
    }

    // 4. Insert issue
    const { data: issue, error: insertError } = await c.db
      .from("deco_chat_issues")
      .insert([
        {
          team_id: teamId,
          project_id: projectId,
          reporter_user_id: user.id,
          type,
          content,
          url: url ?? null,
          path: path ?? null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      id: issue.id,
      team_id: issue.team_id,
      project_id: issue.project_id,
      type: issue.type,
      content: issue.content,
      url: issue.url,
      path: issue.path,
      created_at: issue.created_at,
    };
  },
});
```

**Próximos passos**: Importar `NotFoundError` se necessário; verificar que
`assertPrincipalIsUser` e `assertTeamResourceAccess` existem.

---

### 3. Expor Tool no Client (SDK)

**Arquivo**: `packages/sdk/src/fetcher.ts` (ou onde `MCPClient` é gerado)

Se o `MCPClient` é gerado automaticamente, rodar o script de geração. Caso
contrário, adicionar:

```typescript
TEAM_REPORT_ISSUE_CREATE: (params: {
  teamSlug: string;
  projectSlug?: string;
  type: "Bug" | "Idea";
  content: string;
  url?: string;
  path?: string;
}) => callMCPTool("TEAM_REPORT_ISSUE_CREATE", params),
```

---

### 4. Componente UI - Report Issue Button

**Arquivo**: `apps/web/src/components/common/report-issue-button.tsx` (novo)

```typescript
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { MCPClient } from "@deco/sdk";
import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { useUser } from "../../hooks/use-user.ts";
import { toast } from "sonner";

export function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Bug" | "Idea">("Bug");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const user = useUser();
  const { org, project } = useParams();
  const location = useLocation();

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please provide a description");
      return;
    }

    if (!org || !project) {
      toast.error("Team or project not found");
      return;
    }

    setIsSubmitting(true);

    try {
      await MCPClient.TEAM_REPORT_ISSUE_CREATE({
        teamSlug: org,
        projectSlug: project,
        type,
        content: content.trim(),
        url: globalThis.location.href,
        path: location.pathname,
      });

      toast.success("Report submitted successfully!");
      setContent("");
      setType("Bug");
      setOpen(false);
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" title="Report Issue">
          <Icon name="report" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" side="bottom">
        <div className="space-y-4">
          <Select
            value={type}
            onValueChange={(v) => setType(v as "Bug" | "Idea")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bug">Bug</SelectItem>
              <SelectItem value="Idea">Idea</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Describe the issue or idea..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="resize-none"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Próximos passos**: Verificar se `Icon name="report"` existe; se não, usar
`"bug_report"` ou `"flag"`.

---

### 5. Integração no PageLayout

**Arquivo**: `apps/web/src/components/layout/project.tsx`

No topo, adicionar import:

```typescript
import { ReportIssueButton } from "../common/report-issue-button.tsx";
```

Modificar a div `chat-header-end-slot` (linha ~193):

```typescript
<div
  id="chat-header-end-slot"
  className={cn(
    "flex items-center gap-2",
    "mb-0 md:-mb-2 empty:mb-0",
    "min-h-14 empty:min-h-0",
    "justify-self-end",
  )}
>
  {actionButtons}
  <ReportIssueButton />
  {preferences.enableDecopilot && <ToggleDecopilotButton />}
</div>;
```

**Explicação**: O botão ficará entre `actionButtons` e `ToggleDecopilotButton`
(Chat), com `gap-2` de espaçamento.

---

### 6. Tipos TypeScript (opcional)

**Arquivo**: `packages/sdk/src/models/issue.ts` (novo)

```typescript
export interface Issue {
  id: string;
  team_id: number;
  project_id: number | null;
  reporter_user_id: string;
  type: "Bug" | "Idea";
  content: string;
  url: string | null;
  path: string | null;
  created_at: string;
}

export type CreateIssueInput = {
  teamSlug: string;
  projectSlug?: string;
  type: "Bug" | "Idea";
  content: string;
  url?: string;
  path?: string;
};
```

---

### 7. Checklist de Testes

- [ ] **Migration**: Rodar `supabase db reset` e verificar tabela criada.
- [ ] **MCP Tool**: Testar via cliente (Postman) ou teste unitário.
- [ ] **UI - Botão aparece**: Navegar para página de projeto e verificar botão
      ao lado do Chat.
- [ ] **UI - Popover abre**: Clicar e verificar Select + Textarea.
- [ ] **UI - Submit funciona**: Preencher e submeter; verificar toast + registro
      no banco.
- [ ] **UI - Validação**: Submeter vazio → toast de erro.
- [ ] **UI - Loading state**: Botão disabled durante submit.
- [ ] **Responsividade**: Testar em mobile/tablet.
- [ ] **Permissões**: Tentar criar issue em team sem acesso → erro 403.

---

### 8. Melhorias Futuras (fora do escopo)

- Dashboard para admins visualizarem issues.
- Notificações (email/slack) quando issue criado.
- Filtros por tipo, data, projeto.
- Status de issue (open, in progress, resolved).
- Comentários/threads.
- Anexar screenshots.

---

### Resumo - Ordem de Execução

1. **Migration** → `supabase/migrations/<timestamp>_create_issues_table.sql`
2. **MCP Tool** → `packages/sdk/src/mcp/members/api.ts` (adicionar
   `TEAM_REPORT_ISSUE_CREATE`)
3. **Client** → verificar/gerar `MCPClient.TEAM_REPORT_ISSUE_CREATE`
4. **UI Component** → `apps/web/src/components/common/report-issue-button.tsx`
5. **Integration** → `apps/web/src/components/layout/project.tsx` (adicionar
   `<ReportIssueButton />`)
6. **Test** → checklist acima

**Arquivos criados**:

- `supabase/migrations/<timestamp>_create_issues_table.sql`
- `apps/web/src/components/common/report-issue-button.tsx`
- (Opcional) `packages/sdk/src/models/issue.ts`

**Arquivos modificados**:

- `packages/sdk/src/mcp/members/api.ts`
- `apps/web/src/components/layout/project.tsx`
- (Possivelmente) `packages/sdk/src/fetcher.ts`
