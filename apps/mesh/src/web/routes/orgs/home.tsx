import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/web/lib/auth-client";
import { fetcher } from "@/tools/client";
import { KEYS } from "@/web/lib/query-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Users, Cable, ArrowRight, Activity } from "lucide-react";

const useMembers = () => {
  return useQuery({
    queryKey: KEYS.members(),
    queryFn: () => authClient.organization.listMembers(),
  });
};

const useConnections = () => {
  return useQuery({
    queryKey: KEYS.connections(),
    queryFn: () => fetcher.CONNECTION_LIST({}),
  });
};

export default function OrgHome() {
  const { org: orgSlug } = useParams({ from: "/shell/$org" });
  const { data: membersData, isLoading: membersLoading } = useMembers();
  const { data: connectionsData, isLoading: connectionsLoading } =
    useConnections();

  const members = membersData?.data?.members ?? [];
  const connections = connectionsData?.connections ?? [];

  const activeConnections = connections.filter(
    (c) => c.status === "active",
  ).length;

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your organization</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{members.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Active organization members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Cable className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {connectionsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{connections.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {activeConnections} active
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Manage your organization members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {membersLoading ? (
                    <Skeleton className="h-4 w-20 inline-block" />
                  ) : (
                    `${members.length} member${members.length !== 1 ? "s" : ""}`
                  )}
                </span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/$org/members" params={{ org: orgSlug }}>
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>
              MCP server connections and integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cable className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {connectionsLoading ? (
                    <Skeleton className="h-4 w-20 inline-block" />
                  ) : (
                    `${connections.length} connection${connections.length !== 1 ? "s" : ""}`
                  )}
                </span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/$org/connections" params={{ org: orgSlug }}>
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent organization activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Coming soon
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
