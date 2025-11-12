import { useAgentV2, useUpdateAgentV2, useIntegrations } from "@deco/sdk";
import type { AgentCreateParamsV2 } from "@deco/sdk";
import { z } from "zod";

// Define the schema inline since it's not exported from SDK
const AgentV2DataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  system: z.string(),
  tools: z.record(z.string(), z.array(z.string())).default({}),
});

type AgentV2Data = AgentCreateParamsV2;
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SaveDiscardActions } from "../common/resource-detail-header.tsx";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { IntegrationListItem } from "../toolsets/selector.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { Integration } from "@deco/sdk";

/**
 * Agent V2 Detail Component
 * Full-featured form for editing V2 agents stored in deconfig
 */

interface AgentV2DetailProps {
  resourceUri: string;
}

/**
 * Standalone tools/integrations section for agent v2
 * Simplified version that doesn't depend on AgenticChatProvider
 */
function ToolsIntegrationsSection({
  toolsSet,
  onChange,
}: {
  toolsSet: Record<string, string[]>;
  onChange: (tools: Record<string, string[]>) => void;
}) {
  const { data: integrations = [] } = useIntegrations();
  const [search, setSearch] = useState("");

  const installedIntegrations = useMemo(
    () => integrations.filter((i) => i.id.startsWith("i:")),
    [integrations],
  );

  const connections = useMemo(
    () => installedIntegrations.filter((connection) => !!toolsSet[connection.id]),
    [installedIntegrations, toolsSet],
  );

  const showAddConnectionEmptyState = connections.length === 0 && !search;

  const enableAllTools = useCallback(
    (integrationId: string) => {
      const newToolsSet = { ...toolsSet, [integrationId]: [] };
      onChange(newToolsSet);
    },
    [toolsSet, onChange],
  );

  const disableAllTools = useCallback(
    (integrationId: string) => {
      const newToolsSet = { ...toolsSet };
      delete newToolsSet[integrationId];
      onChange(newToolsSet);
    },
    [toolsSet, onChange],
  );

  const setIntegrationTools = useCallback(
    (integrationId: string, tools: string[]) => {
      const newToolsSet = { ...toolsSet, [integrationId]: tools };
      onChange(newToolsSet);
    },
    [toolsSet, onChange],
  );

  const connectionFilter = (integration: Integration) =>
    integration.id.startsWith("i:");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground pb-2">
          Connect and configure integrations to extend your agent's capabilities
        </p>
        {!showAddConnectionEmptyState && (
          <SelectConnectionDialog
            onSelect={(integration) => enableAllTools(integration.id)}
            filter={connectionFilter}
            trigger={
              <Button variant="outline" size="sm">
                <Icon name="add" /> Add integration
              </Button>
            }
          />
        )}
      </div>
      {showAddConnectionEmptyState ? (
        <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
          <p className="text-sm text-muted-foreground">No integrations added yet</p>
          <SelectConnectionDialog
            onSelect={(integration) => enableAllTools(integration.id)}
            filter={connectionFilter}
            trigger={
              <Button variant="outline" size="sm">
                <Icon name="add" /> Add integration
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex gap-2 w-full">
            <div className="border border-border rounded-xl w-full">
              <div className="flex items-center h-10 px-4 gap-2">
                <Icon name="search" size={20} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 h-full border-none focus:outline-none placeholder:text-muted-foreground bg-transparent px-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {connections.map((connection) => (
                  <IntegrationListItem
                    key={connection.id}
                    toolsSet={toolsSet}
                    setIntegrationTools={setIntegrationTools}
                    integration={connection}
                    onConfigure={() => {
                      // Could implement navigation to app config if needed
                      console.log("Configure", connection.id);
                    }}
                    onRemove={(integrationId) => disableAllTools(integrationId)}
                    searchTerm={search.toLowerCase()}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AgentV2Detail({ resourceUri }: AgentV2DetailProps) {
  const { data, isLoading, error, refetch } = useAgentV2(resourceUri);
  const updateAgent = useUpdateAgentV2();
  
  const isProgrammaticUpdateRef = useRef(false);

  // Form setup with react-hook-form and zod
  const form = useForm<AgentV2Data>({
    resolver: zodResolver(AgentV2DataSchema),
    defaultValues: {
      name: "",
      description: "",
      system: "",
      tools: {},
    },
    mode: "onChange",
  });

  // Watch form values
  const formValues = form.watch();
  
  // Track if there are unsaved changes
  const hasChanges = form.formState.isDirty;

  // Sync resource data → form (one-way)
  useEffect(() => {
    if (!data?.data) return;

    isProgrammaticUpdateRef.current = true;
    form.reset({
      name: data.data.name,
      description: data.data.description || "",
      system: data.data.system,
      tools: data.data.tools || {},
    });
    // Small delay to ensure reset completes before enabling dirty tracking
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 0);
  }, [data, form]);

  const handleSave = async () => {
    try {
      await updateAgent.mutateAsync({
        uri: resourceUri,
        params: formValues,
      });
      
      // Reset form state to mark as pristine
      form.reset(formValues);
      
      await refetch();
      toast.success("Agent saved successfully");
    } catch (err) {
      console.error("Failed to save agent:", err);
      toast.error("Failed to save agent");
    }
  };

  const handleDiscard = () => {
    if (!data?.data) return;
    
    isProgrammaticUpdateRef.current = true;
    form.reset({
      name: data.data.name,
      description: data.data.description || "",
      system: data.data.system,
      tools: data.data.tools || {},
    });
    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 0);
    
    toast.info("Changes discarded");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Agent not found</h2>
          <p className="text-muted-foreground">
            The agent you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Header with save/discard actions */}
      <div className="flex-shrink-0 border-b border-border px-4 sm:px-6 md:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {formValues.name || "Untitled Agent"}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {formValues.description || "No description"}
            </p>
          </div>
          
          {hasChanges && (
            <SaveDiscardActions
              hasChanges={hasChanges}
              onSave={handleSave}
              onDiscard={handleDiscard}
              isSaving={updateAgent.isPending}
            />
          )}
        </div>
      </div>

      {/* Form content */}
      <ScrollArea className="flex-1">
        <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8 max-w-4xl">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-4">Basic Information</h2>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter agent name"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the agent"
                {...form.register("description")}
              />
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">System Prompt</h2>
              <p className="text-sm text-muted-foreground">
                Define the agent's behavior, personality, and capabilities
              </p>
            </div>
            
            <div className="space-y-2">
              <Textarea
                id="system"
                placeholder="You are a helpful assistant..."
                className="min-h-[200px] font-mono text-sm resize-y"
                {...form.register("system")}
              />
              {form.formState.errors.system && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.system.message}
                </p>
              )}
            </div>
          </div>

          {/* Tools & Integrations */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Tools & Integrations</h2>
              <p className="text-sm text-muted-foreground">
                Configure which tools and integrations this agent can use
              </p>
            </div>
            
            <ToolsIntegrationsSection
              toolsSet={formValues.tools || {}}
              onChange={(newTools: Record<string, string[]>) => {
                form.setValue("tools", newTools, { shouldDirty: true });
              }}
            />
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>URI:</strong> {resourceUri}</p>
              {data.created_at && (
                <p><strong>Created:</strong> {new Date(data.created_at).toLocaleString()}</p>
              )}
              {data.updated_at && (
                <p><strong>Updated:</strong> {new Date(data.updated_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

