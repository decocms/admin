import {
  ToolDefinitionSchema,
  useToolByUriV2,
  useToolCallV2,
  useSDK,
  useRecentResources,
} from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { ToolCallResultV2 } from "@deco/sdk/hooks";
import { DetailSection } from "../common/detail-section.tsx";

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

// Tool type inferred from the Zod schema
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// Extended tool type for display (includes optional metadata)
export interface DisplayTool extends ToolDefinition {
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ToolDisplayCanvasProps {
  resourceUri: string;
}

interface JsonViewerProps {
  data: unknown;
  title: string;
}

function JsonViewer({ data, title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy data", error);
    }
  }

  if (data === null || data === undefined) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          {title}
        </p>
        <div className="text-xs text-muted-foreground italic p-2">
          No {title.toLowerCase()}
        </div>
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="space-y-2 min-w-0 w-full">
      <p className="font-mono text-sm text-muted-foreground uppercase">
        {title}
      </p>
      <div className="relative bg-muted rounded-xl max-h-[400px] overflow-auto w-full">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-background rounded-xl shadow-sm">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </Button>
        </div>
        <div className="overflow-x-auto w-full">
          <Suspense
            fallback={
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            }
          >
            <LazyHighlighter language="json" content={jsonString} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive tool display that shows tool details with execution capability
 */
export function ToolDetail({ resourceUri }: ToolDisplayCanvasProps) {
  const { data: resource, isLoading } = useToolByUriV2(resourceUri);
  const effectiveTool = resource?.data;
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const params = useParams<{ org: string; project: string }>();
  const hasTrackedRecentRef = useRef(false);

  // Track as recently opened when tool is loaded (only once)
  useEffect(() => {
    if (
      effectiveTool &&
      resourceUri &&
      projectKey &&
      params.org &&
      params.project &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      // Parse the resource URI to extract integration and resource name
      // Format: rsc://integration-id/resource-name/resource-id
      const uriWithoutPrefix = resourceUri.replace("rsc://", "");
      const [integrationId, resourceName] = uriWithoutPrefix.split("/");

      // Use setTimeout to ensure this runs after render
      setTimeout(() => {
        addRecent({
          id: resourceUri,
          name: effectiveTool.name,
          type: "tool",
          icon: "build",
          path: `/${projectKey}/rsc/${integrationId.startsWith("i:") ? integrationId : `i:${integrationId}`}/${resourceName}/${encodeURIComponent(resourceUri)}`,
        });
      }, 0);
    }
  }, [
    effectiveTool,
    resourceUri,
    projectKey,
    params.org,
    params.project,
    addRecent,
  ]);

  // Tool execution state
  const [executionResult, setExecutionResult] =
    useState<ToolCallResultV2 | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStats, setExecutionStats] = useState<{
    latency?: number;
    byteSize?: number;
    estimatedTokens?: number;
  }>({});

  // Form data state to prevent clearing after submission
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Tool call hook
  const toolCallMutation = useToolCallV2();

  // Token estimation function
  const estimateTokens = useCallback((text: string): number => {
    if (!text || typeof text !== "string") return 0;

    // Split by whitespace to get words
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const wordCount = words.length;

    // Count punctuation marks and special characters
    const punctuationCount = (text.match(/[.,!?;:"'()]/g) || []).length;

    // Estimate tokens: ~1.3 tokens per word + 1 token per punctuation
    const estimatedTokens = Math.ceil(wordCount * 1.3 + punctuationCount);

    return estimatedTokens;
  }, []);

  const handleFormSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!effectiveTool || !resourceUri) return;

      try {
        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionStats({});

        const startTime = performance.now();
        const inputByteSize = new Blob([JSON.stringify(formData)]).size;
        const inputText = JSON.stringify(formData);
        const inputTokens = estimateTokens(inputText);

        const result = await toolCallMutation.mutateAsync({
          params: {
            uri: resourceUri,
            input: formData,
          },
        });

        const endTime = performance.now();
        const latency = endTime - startTime;
        const resultByteSize = new Blob([JSON.stringify(result)]).size;
        const resultText = JSON.stringify(result);
        const resultTokens = estimateTokens(resultText);

        setExecutionResult(result);
        setExecutionStats({
          latency: Math.round(latency),
          byteSize: inputByteSize + resultByteSize,
          estimatedTokens: inputTokens + resultTokens,
        });
      } catch (error) {
        console.error("Tool execution failed:", error);
        setExecutionResult({
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [effectiveTool, resourceUri, toolCallMutation, estimateTokens],
  );

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!effectiveTool) {
    return (
      <EmptyState
        icon="error"
        title="Tool not found"
        description="The requested tool could not be found or is not available."
      />
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col">
        {/* Header */}
        <DetailSection>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-2xl font-medium">{effectiveTool.name}</h1>
              {effectiveTool.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {effectiveTool.description}
                </p>
              )}
            </div>
          </div>

          {/* Execution stats (show after execution) */}
          {executionResult !== null &&
          typeof executionStats.latency === "number" ? (
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Icon
                  name="schedule"
                  size={16}
                  className="text-muted-foreground"
                />
                <span className="font-mono text-sm">
                  {executionStats.latency}ms
                </span>
              </div>

              {executionStats.byteSize ? (
                <>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <Icon
                      name="storage"
                      size={16}
                      className="text-muted-foreground"
                    />
                    <span className="font-mono text-sm">
                      {executionStats.byteSize} bytes
                    </span>
                  </div>
                </>
              ) : null}

              {executionStats.estimatedTokens ? (
                <>
                  <div className="h-3 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <Icon
                      name="token"
                      size={16}
                      className="text-muted-foreground"
                    />
                    <span className="font-mono text-sm">
                      ~{executionStats.estimatedTokens} tokens
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Error Alert */}
          {executionResult?.error ? (
            <Alert className="bg-destructive/5 border-none">
              <Icon name="error" className="h-4 w-4 text-destructive" />
              <AlertTitle className="text-destructive">Error</AlertTitle>
              <AlertDescription className="text-destructive">
                {typeof executionResult.error === "string"
                  ? executionResult.error
                  : JSON.stringify(executionResult.error)}
              </AlertDescription>
            </Alert>
          ) : null}
        </DetailSection>

        {/* Input Form */}
        <DetailSection title="Input">
          <div className="bg-muted/30 rounded-xl p-6">
            {effectiveTool.inputSchema &&
            typeof effectiveTool.inputSchema === "object" &&
            "properties" in effectiveTool.inputSchema &&
            effectiveTool.inputSchema.properties &&
            Object.keys(effectiveTool.inputSchema.properties).length > 0 ? (
              <Form
                schema={effectiveTool.inputSchema}
                validator={validator}
                formData={formData}
                onChange={({ formData }) => setFormData(formData)}
                onSubmit={({ formData }) => handleFormSubmit(formData)}
                showErrorList={false}
                noHtml5Validate
                liveValidate={false}
              >
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="submit"
                    disabled={isExecuting}
                    size="lg"
                    className="min-w-[200px] flex items-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <Spinner size="xs" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Icon name="play_arrow" size={18} />
                        Execute Tool
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                <p className="text-sm text-muted-foreground">
                  This tool does not require any input parameters.
                </p>
                <Button
                  disabled={isExecuting}
                  size="lg"
                  onClick={() => handleFormSubmit({})}
                  className="min-w-[200px] flex items-center gap-2"
                >
                  {isExecuting ? (
                    <>
                      <Spinner size="xs" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Icon name="play_arrow" size={18} />
                      Execute Tool
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DetailSection>

        {/* Result Section - only show if we have a result */}
        {executionResult && (
          <DetailSection title="Result">
            {/* Logs Section */}
            {executionResult.logs && executionResult.logs.length > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-sm text-muted-foreground uppercase">
                  Console Logs
                </p>
                <div className="bg-muted rounded-xl p-3 max-h-[200px] overflow-auto">
                  {executionResult.logs.map((log, index) => (
                    <div
                      key={index}
                      className={`text-xs font-mono ${
                        log.type === "error"
                          ? "text-destructive"
                          : log.type === "warn"
                            ? "text-yellow-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      [{log.type.toUpperCase()}] {log.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output */}
            {!executionResult.error && (
              <JsonViewer
                data={executionResult.result || executionResult}
                title="Output"
              />
            )}
          </DetailSection>
        )}
      </div>
    </ScrollArea>
  );
}
