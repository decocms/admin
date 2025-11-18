import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { authClient } from "@/web/lib/auth-client";
import { KEYS } from "@/web/lib/query-keys";
import { fetcher } from "@/tools/client";
import { useProjectContext } from "@/web/providers/project-context-provider";
import type { MCPConnection } from "@/storage/types";
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
} from "@/web/hooks/use-organization-settings";

interface OrganizationSettingsResponse {
  organizationId: string;
  modelsBindingConnectionId: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export default function OrgSettings() {
  const navigate = useNavigate();
  const { locator, org } = useProjectContext();

  const {
    data: organizations,
    isLoading: organizationsLoading,
    isError: organizationsError,
  } = authClient.useListOrganizations();

  const currentOrganization = useMemo(() => {
    return organizations?.find((organization) => organization.slug === org);
  }, [organizations, org]);

  const organizationId = currentOrganization?.id;

  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    error: settingsErrorValue,
  } = useOrganizationSettings(organizationId);

  const {
    data: connectionsData,
    isLoading: connectionsLoading,
    isError: connectionsError,
    error: connectionsErrorValue,
  } = useQuery({
    queryKey: KEYS.connectionsByBinding(locator, "MODELS"),
    queryFn: async () => {
      return (await fetcher.CONNECTION_LIST({
        binding: "MODELS",
      })) as { connections: MCPConnection[] };
    },
    retry: 1,
  });

  const connections = connectionsData?.connections ?? [];

  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setSelectedConnectionId(settings.modelsBindingConnectionId ?? null);
    }
  }, [settings]);

  const updateMutation = useUpdateOrganizationSettings();

  const isSaving = updateMutation.isPending;
  const initialConnectionId = settings?.modelsBindingConnectionId ?? null;
  const hasChanges = selectedConnectionId !== initialConnectionId;

  if (organizationsError) {
    return (
      <div className="container max-w-4xl mx-auto py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Unable to load organizations. Please try again later.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate({ to: "/" })}
            >
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (organizationsLoading || !organizationId) {
    return (
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Configure how Decopilot selects and calls language models for this
          organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Models Provider</CardTitle>
          <CardDescription>
            Choose the MCP connection that exposes the MODELS binding. Only
            connections that satisfy the binding schema are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {connectionsError ? (
            <p className="text-sm text-destructive">
              {connectionsErrorValue instanceof Error
                ? connectionsErrorValue.message
                : "Failed to load connections."}
            </p>
          ) : connectionsLoading || settingsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10 w-full max-w-sm" />
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p>No connections with a MODELS binding were found.</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => navigate({ to: "/$org/mcps", params: { org } })}
              >
                Manage connections
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="models-binding">MCP connection</Label>
              <Select
                value={selectedConnectionId ?? "__none__"}
                onValueChange={(value) =>
                  setSelectedConnectionId(value === "__none__" ? null : value)
                }
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No connection</SelectItem>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                organizationId &&
                updateMutation.mutate({
                  organizationId,
                  modelsBindingConnectionId: selectedConnectionId,
                })
              }
              disabled={
                isSaving ||
                !hasChanges ||
                connections.length === 0 ||
                settingsLoading ||
                connectionsLoading
              }
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedConnectionId(initialConnectionId)}
              disabled={
                !hasChanges ||
                isSaving ||
                settingsLoading ||
                connectionsLoading
              }
            >
              Reset
            </Button>
          </div>

          {settingsError && (
            <p className="text-sm text-destructive">
              {settingsErrorValue instanceof Error
                ? settingsErrorValue.message
                : "Failed to load current settings."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
