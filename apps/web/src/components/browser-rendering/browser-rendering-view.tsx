import { useMemo, useState } from "react";
import { useDeleteScreenshot, useScreenshots } from "@deco/sdk/hooks/browser-rendering";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { toast } from "sonner";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

type DateFilter = "all" | "today" | "week" | "month";

export function BrowserRenderingView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Load screenshots
  const { data: screenshots, isLoading, refetch, error } = useScreenshots({
    prefix: getDatePrefix(dateFilter),
    limit: 100,
  });

  // Show error state
  if (error) {
    console.error("Failed to load screenshots:", error);
  }

  const deleteMutation = useDeleteScreenshot();

  // AI Chat Context Integration
  const threadContextItems = useMemo<Array<
    { id: string; type: "rule"; text: string } | 
    { id: string; type: "toolset"; integrationId: string; enabledTools: string[] }
  >>(() => {
    const rules = [
      `You are helping the user capture screenshots, generate PDFs, and scrape websites using Cloudflare Browser Rendering.`,
      `Use BROWSER_SCREENSHOT to capture screenshots of websites. You can provide a URL or custom HTML.`,
      `Use BROWSER_PDF to generate PDFs from web pages.`,
      `Use BROWSER_HTML to fetch the fully rendered HTML content after JavaScript execution.`,
      `Use BROWSER_SCRAPE to extract specific elements from a page using CSS selectors.`,
      `All captured screenshots are automatically saved to the workspace's file storage in browser-rendering/screenshots/ organized by date.`,
      `Examples:`,
      `- Screenshot: { "url": "https://example.com" }`,
      `- Full page: { "url": "https://example.com", "screenshotOptions": { "fullPage": true } }`,
      `- Element: { "url": "https://example.com", "selector": "#main-content" }`,
      `- Custom HTML: { "html": "<h1>Hello World</h1>" }`,
    ];

    const contextItems: Array<
      { id: string; type: "rule"; text: string } | 
      { id: string; type: "toolset"; integrationId: string; enabledTools: string[] }
    > = rules.map((text) => ({
      id: crypto.randomUUID(),
      type: "rule" as const,
      text,
    }));

    // Add browser rendering toolset
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:browser-rendering",
      enabledTools: [
        "BROWSER_SCREENSHOT",
        "BROWSER_PDF",
        "BROWSER_HTML",
        "BROWSER_SCRAPE",
        "BROWSER_SCREENSHOTS_LIST",
      ],
    });

    // Add HTTP fetch for external data
    contextItems.push({
      id: crypto.randomUUID(),
      type: "toolset" as const,
      integrationId: "i:http",
      enabledTools: ["HTTP_FETCH"],
    });

    return contextItems;
  }, []);

  // Inject context into AI thread
  useSetThreadContextEffect(threadContextItems);

  // Filter screenshots by search term
  const filteredScreenshots = useMemo(() => {
    if (!screenshots) return [];
    if (!searchTerm) return screenshots;

    const lowerSearch = searchTerm.toLowerCase();
    return screenshots.filter(
      (screenshot) =>
        screenshot.metadata?.sourceUrl?.toLowerCase().includes(lowerSearch) ||
        screenshot.path.toLowerCase().includes(lowerSearch)
    );
  }, [screenshots, searchTerm]);

  const handleDelete = async (path: string) => {
    if (!confirm("Are you sure you want to delete this screenshot?")) return;

    try {
      await deleteMutation.mutateAsync({ path });
      toast.success("Screenshot deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete screenshot"
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Browser</h1>
            <p className="text-muted-foreground text-sm">
              Capture screenshots, generate PDFs, and scrape websites
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            <Icon name="refresh" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value as DateFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          {screenshots && (
            <Badge variant="secondary" className="ml-auto">
              {filteredScreenshots.length} screenshot{filteredScreenshots.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full" />
              </Card>
            ))}
          </div>
        ) : filteredScreenshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Icon name="camera" className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No screenshots yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Use AI chat to capture screenshots, or use the MCP tools directly
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <Icon name="refresh" className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredScreenshots.map((screenshot) => (
              <Card
                key={screenshot.path}
                className="group hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
              >
                <div
                  onClick={() => setSelectedScreenshot(screenshot.url)}
                  className="relative aspect-video bg-muted"
                >
                  <img
                    src={screenshot.url}
                    alt="Screenshot"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {screenshot.metadata?.sourceUrl && (
                      <p className="text-xs text-muted-foreground truncate" title={screenshot.metadata.sourceUrl}>
                        {screenshot.metadata.sourceUrl}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {new Date(screenshot.lastModified).toLocaleDateString()}
                      </span>
                      {screenshot.metadata?.dimensions && (
                        <span className="text-muted-foreground">
                          {screenshot.metadata.dimensions.width}×{screenshot.metadata.dimensions.height}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(screenshot.url, "_blank");
                        }}
                      >
                        <Icon name="open_in_new" className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(screenshot.path);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Icon name="delete" className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-full overflow-auto">
            {selectedScreenshot && (
              <img
                src={selectedScreenshot}
                alt="Screenshot"
                className="w-full h-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDatePrefix(filter: DateFilter): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  switch (filter) {
    case "today":
      return `browser-rendering/screenshots/${year}/${month}/${day}`;
    case "week": {
      // Get the start of the week (last Monday)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      return `browser-rendering/screenshots/${year}/${month}`;
    }
    case "month":
      return `browser-rendering/screenshots/${year}/${month}`;
    case "all":
    default:
      return "browser-rendering/screenshots/";
  }
}

