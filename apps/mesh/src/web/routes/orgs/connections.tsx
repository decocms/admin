import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@tanstack/react-router";
import { fetcher } from "@/tools/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Plus, MoreVertical, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { KEYS } from "@/web/lib/query-keys";
import type { MCPConnection } from "@/storage/types";

const useConnections = () => {
  return useQuery({
    queryKey: KEYS.connections(),
    queryFn: () => fetcher.CONNECTION_LIST({}),
  });
};

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

export default function OrgConnections() {
  const { org } = useParams({ strict: false });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useConnections();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] =
    useState<MCPConnection | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "HTTP" as "HTTP" | "SSE" | "Websocket",
    url: "",
    token: "",
  });

  const connections = data?.connections ?? [];

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "HTTP",
      url: "",
      token: "",
    });
    setEditingConnection(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return fetcher.CONNECTION_CREATE({
        name: data.name,
        description: data.description || undefined,
        connection: {
          type: data.type,
          url: data.url,
          token: data.token || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections() });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return fetcher.CONNECTION_UPDATE({
        id,
        name: data.name,
        description: data.description || undefined,
        connection: {
          type: data.type,
          url: data.url,
          token: data.token || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections() });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetcher.CONNECTION_DELETE({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.connections() });
    },
  });

  const handleEdit = (connection: MCPConnection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      description: connection.description || "",
      type: connection.connectionType,
      url: connection.connectionUrl,
      token: "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConnection) {
      updateMutation.mutate({ id: editingConnection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Manage your organization connections
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Connection
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? "Edit Connection" : "Create New Connection"}
            </DialogTitle>
            <DialogDescription>
              {editingConnection
                ? "Update the connection details below."
                : "Add a new connection to your organization. Fill in the details below."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="My Connection"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="A brief description of this connection"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as "HTTP" | "SSE" | "Websocket",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTTP">HTTP</SelectItem>
                    <SelectItem value="SSE">SSE</SelectItem>
                    <SelectItem value="Websocket">Websocket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/mcp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token">Token (optional)</Label>
                <Input
                  id="token"
                  type="password"
                  value={formData.token}
                  onChange={(e) =>
                    setFormData({ ...formData, token: e.target.value })
                  }
                  placeholder="Bearer token or API key"
                />
              </div>

              {(createMutation.isError || updateMutation.isError) && (
                <div className="text-sm text-destructive">
                  Error:{" "}
                  {createMutation.error?.message ||
                    updateMutation.error?.message ||
                    `Failed to ${editingConnection ? "update" : "create"} connection`}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? editingConnection
                    ? "Updating..."
                    : "Creating..."
                  : editingConnection
                    ? "Update Connection"
                    : "Create Connection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Organization Connections</CardTitle>
          <CardDescription>
            {connections.length} connection(s) in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[300px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection: MCPConnection) => (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{connection.name}</div>
                        {connection.description && (
                          <div className="text-sm text-muted-foreground">
                            {connection.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {connection.connectionType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-xs block">
                        {connection.connectionUrl}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(connection.status)}>
                        {connection.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate({
                                to: `/${org}/connections/${connection.id}/inspector`,
                              })
                            }
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Inspect
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(connection)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>Test Connection</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(connection.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {connections.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No connections found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
