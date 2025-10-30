import { useProjects } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { generateMockMetrics, MetricCell, StatusBadge } from "./common.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";

// Toggle between real data and mocks
const USE_REAL_DATA = true;

interface CreateMCPCardProps {
  title: string;
  description: string;
  icon: string;
  variant?: "default" | "primary";
  onClick: () => void;
}

function CreateMCPCard({
  title,
  description,
  icon,
  variant = "default",
  onClick,
}: CreateMCPCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md focus-within:ring-2 focus-within:ring-primary ${
        variant === "primary" ? "border-primary bg-primary/5" : ""
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${title}: ${description}`}
    >
      <CardContent className="p-6 flex flex-col gap-3">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            variant === "primary" ? "bg-primary/10" : "bg-muted"
          }`}
        >
          <Icon
            name={icon}
            size={24}
            className={variant === "primary" ? "text-primary" : "text-muted-foreground"}
          />
        </div>
        <div>
          <h3 className="font-medium text-base mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DecoMCPsContent() {
  const { org } = useParams();
  const { data: projects } = useProjects({ org: org ?? "" });
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const projectsWithMetrics = useMemo(() => {
    if (!USE_REAL_DATA) {
      // Mock data
      return [
        {
          id: "1",
          slug: "healthcheck-agent",
          name: "Healthcheck Agent",
          description: "E-commerce health monitoring",
          status: "active" as const,
        },
        {
          id: "2",
          slug: "brand-strategy",
          name: "Brand Strategy",
          description: "Brand voice and positioning",
          status: "active" as const,
        },
        {
          id: "3",
          slug: "landing-optimizer",
          name: "Landing Page Optimizer",
          description: "Conversion optimization",
          status: "pending" as const,
        },
      ].map((p) => ({
        ...p,
        metrics: generateMockMetrics(p.id),
      }));
    }

    return (projects?.data || []).map((p) => ({
      ...p,
      status: "active" as const,
      metrics: generateMockMetrics(p.id),
    }));
  }, [projects]);

  function handleCreateFromScratch() {
    toast.info("Create from scratch dialog would open here (future)");
    setCreateMenuOpen(false);
  }

  function handleCreateFromTemplate() {
    toast.info("Template selector would open here (future)");
    setCreateMenuOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            Deco MCPs
            <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
              {projectsWithMetrics.length}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Your internal AI apps and templates
          </p>
        </div>
        <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Icon name="add" size={16} />
              Create MCP
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCreateFromScratch}>
              <Icon name="edit" size={16} className="mr-2" />
              From scratch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateFromTemplate}>
              <Icon name="content_copy" size={16} className="mr-2" />
              From template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CreateMCPCard
          title="AI App Template"
          description="Build a custom AI App MCP"
          icon="add_circle"
          variant="primary"
          onClick={handleCreateFromScratch}
        />
        <CreateMCPCard
          title="Strategy Template"
          description="AI-powered strategic planning agent"
          icon="psychology"
          onClick={handleCreateFromTemplate}
        />
        <CreateMCPCard
          title="More templates"
          description="Browse our collection of pre-built MCPs"
          icon="apps"
          onClick={handleCreateFromTemplate}
        />
      </div>

      {/* Existing MCPs table */}
      {projectsWithMetrics.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MCP Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"># Calls</TableHead>
                <TableHead className="text-right"># Errors</TableHead>
                <TableHead className="text-right">Avg Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsWithMetrics.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => {
                    toast.info(`Navigate to ${project.name} (future)`);
                  }}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        to={`/${org}/${project.slug}`}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <span className="text-xs text-muted-foreground">
                          {project.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={project.metrics.calls.toLocaleString()} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell
                      value={project.metrics.errors}
                      className={project.metrics.errors > 10 ? "text-red-600" : ""}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell value={project.metrics.latency} suffix="ms" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {projectsWithMetrics.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Icon name="add_box" size={48} className="text-muted-foreground" />
          <div>
            <h3 className="font-medium mb-1">No MCPs yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first Deco MCP to get started
            </p>
          </div>
          <Button onClick={handleCreateFromScratch}>
            <Icon name="add" size={16} className="mr-2" />
            Create MCP
          </Button>
        </div>
      )}
    </div>
  );
}

export function DecoMCPsSection() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      }
    >
      <DecoMCPsContent />
    </Suspense>
  );
}

