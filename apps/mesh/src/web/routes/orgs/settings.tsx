import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { authClient } from "@/web/lib/auth-client";
import { useProjectContext } from "@/web/providers/project-context-provider";

export default function OrgSettings() {
  const navigate = useNavigate();
  const { org } = useProjectContext();

  const {
    data: organizationsData,
    error: organizationsError,
    isPending: organizationsPending,
  } = authClient.useListOrganizations();

  const organizations = organizationsData ?? [];
  const organizationsLoading =
    organizationsPending && organizations.length === 0;

  const currentOrganization = useMemo(() => {
    return organizations.find((organization) => organization.slug === org);
  }, [organizations, org]);

  const organizationId = currentOrganization?.id;

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
    <div className="container mx-auto max-w-3xl space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for {currentOrganization?.name || "your organization"}
          .
        </p>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p>No additional settings to configure.</p>
        <p className="mt-2">
          Models and agents are automatically discovered from your MCP
          connections.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate({ to: "/$org/mcps", params: { org } })}
        >
          Manage connections
        </Button>
      </div>
    </div>
  );
}
