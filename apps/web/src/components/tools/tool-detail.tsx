import {
  ToolDefinitionSchema,
  useSDK,
  useToolByUriV2,
  useUpdateTool,
} from "@deco/sdk";
import { useToolCall, type MCPToolCallResult } from "@deco/sdk/hooks";
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
import { useCallback, useEffect, useState } from "react";
import { z } from "zod/v3";
import { toast } from "sonner";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAgenticChat } from "../chat/provider.tsx";
import { JsonViewer } from "../chat/json-viewer.tsx";
import { DetailSection } from "../common/detail-section.tsx";
import { EmptyState } from "@deco/ui/components/empty-state.tsx";
import {
  CodeAction,
  SaveDiscardActions,
} from "../common/resource-detail-header.tsx";
import { TabActionButton } from "../canvas/tab-action-button.tsx";

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

/**
 * Interactive tool display that shows tool details with execution capability
 */
export function ToolDetail({ resourceUri }: ToolDisplayCanvasProps) {
  const { data: resource, isLoading } = useToolByUriV2(resourceUri);
  const effectiveTool = resource?.data;
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string | undefined>(undefined);
  const updateToolMutation = useUpdateTool();

  // Current code value = draft OR saved value
  const currentCode = codeDraft ?? effectiveTool?.execute ?? "";

  // isDirty = draft exists and differs from saved value
  const isDirty =
    codeDraft !== undefined && codeDraft !== effectiveTool?.execute;

  // Handlers for code editing
  const handleCodeChange = useCallback((value: string) => {
    setCodeDraft(value);
  }, []);

  const handleSaveCode = useCallback(async () => {
    if (!effectiveTool) {
      toast.error("Tool not found");
      return;
    }

    try {
      await updateToolMutation.mutateAsync({
        uri: resourceUri,
        params: {
          name: effectiveTool.name,
          description: effectiveTool.description,
          execute: currentCode,
          inputSchema: effectiveTool.inputSchema,
          outputSchema: effectiveTool.outputSchema,
          dependencies: effectiveTool.dependencies,
        },
      });
      setCodeDraft(undefined);
      toast.success("Tool code updated successfully");
    } catch (error) {
      console.error("Failed to save tool code:", error);
      toast.error("Failed to save tool code");
    }
  }, [effectiveTool, resourceUri, currentCode, updateToolMutation]);

  const handleResetCode = useCallback(() => {
    setCodeDraft(undefined);
  }, []);

  // Track as recently opened when tool is loaded (only once)

  const { clearError, appendError } = useAgenticChat();

  // Clear errors when tool changes
  useEffect(() => {
    clearError();
  }, [resourceUri, clearError]);

  // Tool execution state
  const [executionResult, setExecutionResult] =
    useState<MCPToolCallResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStats, setExecutionStats] = useState<{
    latency?: number;
    byteSize?: number;
    estimatedTokens?: number;
  }>({});

  // Form data state to prevent clearing after submission
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Get locator from SDK context
  const { locator } = useSDK();

  // Tool call hook - extract tool name from URI and use i:self integration
  const toolCallMutation = useToolCall({ id: "i:self" }, locator);

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

        // Extract tool name from URI (format: rsc://i:self/tool/<name>)
        const toolName = resourceUri.split("/").pop();
        if (!toolName) {
          throw new Error(`Invalid tool URI: ${resourceUri}`);
        }

        const result = await toolCallMutation.mutateAsync({
          name: toolName,
          arguments: formData,
        });

        const endTime = performance.now();
        const latency = endTime - startTime;
        const resultByteSize = new Blob([JSON.stringify(result)]).size;
        const resultText = JSON.stringify(result);
        const resultTokens = estimateTokens(resultText);

        if (result.isError) {
          const errorMessage = result.content.map((c) => c.text).join("\n");
          throw new Error(errorMessage || "Tool execution failed");
        }

        setExecutionResult(result);
        setExecutionStats({
          latency: Math.round(latency),
          byteSize: inputByteSize + resultByteSize,
          estimatedTokens: inputTokens + resultTokens,
        });

        // Clear any previous errors on successful execution
        clearError();
      } catch (error) {
        console.error("Tool execution failed:", error);

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        setExecutionResult({
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        });

        // Send error to chat provider for AI assistance
        appendError(error, resourceUri, effectiveTool.name);
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
    <div className="h-full w-full flex flex-col bg-background">
      {/* Action buttons rendered in canvas header via portal */}
      <TabActionButton>
        {isCodeViewerOpen && (
          <SaveDiscardActions
            hasChanges={isDirty}
            onSave={handleSaveCode}
            onDiscard={handleResetCode}
            isSaving={updateToolMutation.isPending}
            discardLabel="Reset"
          />
        )}
        <CodeAction
          isOpen={isCodeViewerOpen}
          onToggle={() => setIsCodeViewerOpen(!isCodeViewerOpen)}
          hasCode={!!effectiveTool.execute}
        />
      </TabActionButton>

      {/* Code Viewer Section - Shows when code button is clicked */}
      {isCodeViewerOpen && effectiveTool.execute ? (
        <div className="flex-1 overflow-hidden w-full">
          <CodeMirror
            value={currentCode}
            onChange={handleCodeChange}
            extensions={[javascript({ jsx: true, typescript: true })]}
            theme={oneDark}
            height="100%"
            className="h-full w-full text-sm"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightSpecialChars: true,
              foldGutter: true,
              drawSelection: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              syntaxHighlighting: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              searchKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
          />
        </div>
      ) : (
        /* UI Section - Shows when code viewer is closed */
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col">
            {/* Execution stats and errors - only show after execution */}
            {executionResult !== null && (
              <DetailSection>
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
                {executionResult?.isError ? (
                  <Alert className="bg-destructive/5 border-none">
                    <Icon name="error" className="h-4 w-4 text-destructive" />
                    <AlertTitle className="text-destructive">Error</AlertTitle>
                    <AlertDescription className="text-destructive">
                      {executionResult.content.map((c) => c.text).join("\n")}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </DetailSection>
            )}

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
                {/* Output */}
                {!executionResult.isError && (
                  <JsonViewer
                    data={
                      executionResult.structuredContent ||
                      executionResult.content
                    }
                  />
                )}
              </DetailSection>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
