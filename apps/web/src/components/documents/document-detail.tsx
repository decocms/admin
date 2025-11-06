import {
  DocumentDefinitionSchema,
  useDocumentByUriV2,
  useSDK,
  useUpdateDocument,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { DocumentEditor } from "./document-editor.tsx";
import {
  RefreshAction,
  SaveDiscardActions,
  CodeAction,
} from "../common/resource-detail-header.tsx";
import { TabActionButton } from "../canvas/tab-action-button.tsx";
import { usePinnedTabs } from "../../hooks/use-pinned-tabs.ts";

// Document type inferred from the Zod schema
export type DocumentDefinition = z.infer<typeof DocumentDefinitionSchema>;

// Extended document type for display (includes optional metadata)
export interface DisplayDocument extends DocumentDefinition {
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DocumentDetailProps {
  resourceUri: string;
}

/**
 * Document detail view with inline editing and markdown editor
 */
export function DocumentDetail({ resourceUri }: DocumentDetailProps) {
  const { locator } = useSDK();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: resource,
    isLoading,
    isFetching,
    refetch,
  } = useDocumentByUriV2(resourceUri);
  const effectiveDocument = resource?.data;

  // Track pinned tabs
  // Locator is a string "org/project", not an object
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { pinnedTabs, pinTab, isPinned } = usePinnedTabs(projectKey);

  // Update mutation
  const updateMutation = useUpdateDocument();

  // Form setup with react-hook-form and zod
  const form = useForm<DocumentDefinition>({
    resolver: zodResolver(DocumentDefinitionSchema),
    defaultValues: {
      name: "",
      description: "",
      content: "",
      tags: [],
    },
    mode: "onChange",
  });

  // UI state (not form state)
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [editorMode, setEditorMode] = useState<"pretty" | "raw">(() => {
    // Load from localStorage, default to "pretty"
    const saved = localStorage.getItem("document-editor-mode");
    return saved === "raw" ? "raw" : "pretty";
  });

  // Refs
  const tagInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const isProgrammaticUpdateRef = useRef(false); // Track programmatic updates to avoid marking as dirty

  // Watch form values
  const formValues = form.watch();

  // Track if there are unsaved changes
  const hasChanges = form.formState.isDirty;

  // Sync resource?.data → form (one-way)
  useEffect(() => {
    if (effectiveDocument) {
      form.reset(
        {
          name: effectiveDocument.name,
          description: effectiveDocument.description || "",
          content: effectiveDocument.content,
          tags: effectiveDocument.tags || [],
        },
        { keepDefaultValues: false },
      );

      // Sync contentEditable divs (without triggering dirty state)
      // Keep the flag true for 500ms to account for DocumentEditor's 300ms debounce
      isProgrammaticUpdateRef.current = true;
      if (titleRef.current) {
        titleRef.current.textContent = effectiveDocument.name;
      }
      if (descriptionRef.current) {
        descriptionRef.current.textContent =
          effectiveDocument.description || "";
      }
      setTimeout(() => {
        isProgrammaticUpdateRef.current = false;
      }, 500);

      // Update pinned tab title if it's already pinned
      if (isPinned(resourceUri)) {
        const existingTab = pinnedTabs.find(
          (tab) => tab.resourceUri === resourceUri,
        );
        if (existingTab && existingTab.title !== effectiveDocument.name) {
          pinTab({
            resourceUri: existingTab.resourceUri,
            title: effectiveDocument.name,
            type: existingTab.type,
            icon: existingTab.icon,
          });
        }
      }
    }
  }, [
    effectiveDocument,
    resourceUri,
    locator,
    projectKey,
    pinnedTabs,
    pinTab,
    isPinned,
    form,
  ]);

  // Save editor mode preference to localStorage
  useEffect(() => {
    localStorage.setItem("document-editor-mode", editorMode);
  }, [editorMode]);

  // Update URL when resource URI changes (e.g., after agent renames the document)
  useEffect(() => {
    if (resource?.uri && resource.uri !== resourceUri) {
      // Update the URL search params to reflect the new URI
      const newParams = new URLSearchParams(searchParams);
      newParams.set("uri", resource.uri);
      setSearchParams(newParams, { replace: true });
    }
  }, [resource?.uri, resourceUri, searchParams, setSearchParams]);

  const handleTitleChange = (newTitle: string) => {
    form.setValue("name", newTitle, {
      shouldDirty: !isProgrammaticUpdateRef.current,
    });
  };

  const handleDescriptionChange = (newDescription: string) => {
    form.setValue("description", newDescription, {
      shouldDirty: !isProgrammaticUpdateRef.current,
    });
  };

  const handleContentChange = (newContent: string) => {
    form.setValue("content", newContent, {
      shouldDirty: !isProgrammaticUpdateRef.current,
    });
  };

  const handleAddTag = () => {
    const currentTags = formValues.tags || [];
    if (newTagInput.trim() && !currentTags.includes(newTagInput.trim())) {
      form.setValue("tags", [...currentTags, newTagInput.trim()], {
        shouldDirty: true,
      });
      setNewTagInput("");
      setIsAddingTag(false);
    }
  };

  const handleCancelAddTag = () => {
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = formValues.tags || [];
    form.setValue(
      "tags",
      currentTags.filter((tag) => tag !== tagToRemove),
      { shouldDirty: true },
    );
  };

  // Auto-focus input when starting to add a tag
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  const handleSave = useCallback(async () => {
    if (!resourceUri || updateMutation.isPending) return;

    const values = form.getValues();
    try {
      await updateMutation.mutateAsync({
        uri: resourceUri,
        params: {
          name: values.name,
          description: values.description,
          content: values.content,
          tags: values.tags,
        },
      });
      toast.success("Document saved successfully");
      await refetch();
    } catch (error) {
      console.error("Failed to save document:", error);
      toast.error("Failed to save document");
    }
  }, [resourceUri, updateMutation, refetch, form]);

  const handleDiscard = useCallback(() => {
    if (effectiveDocument) {
      form.reset(
        {
          name: effectiveDocument.name,
          description: effectiveDocument.description || "",
          content: effectiveDocument.content,
          tags: effectiveDocument.tags || [],
        },
        { keepDefaultValues: false },
      );

      // Sync contentEditable divs (without triggering dirty state)
      // Keep the flag true for 500ms to account for DocumentEditor's 300ms debounce
      isProgrammaticUpdateRef.current = true;
      if (titleRef.current) {
        titleRef.current.textContent = effectiveDocument.name;
      }
      if (descriptionRef.current) {
        descriptionRef.current.textContent =
          effectiveDocument.description || "";
      }
      setTimeout(() => {
        isProgrammaticUpdateRef.current = false;
      }, 500);
      toast.success("Changes discarded");
    }
  }, [effectiveDocument, form]);

  const handleRefresh = useCallback(() => {
    if (isFetching) return;
    refetch();
  }, [isFetching, refetch]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!effectiveDocument) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <EmptyState
          icon="error"
          title="Document not found"
          description="The requested document could not be found or is not available."
        />
      </div>
    );
  }

  if (!locator) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <EmptyState
          icon="error"
          title="No workspace"
          description="Unable to load document without workspace context."
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Action buttons rendered in canvas header via portal */}
      <TabActionButton>
        <RefreshAction onRefresh={handleRefresh} isRefreshing={isFetching} />
        <CodeAction
          isOpen={editorMode === "raw"}
          onToggle={() =>
            setEditorMode((prev) => (prev === "raw" ? "pretty" : "raw"))
          }
          hasCode={true}
        />
        <SaveDiscardActions
          hasChanges={hasChanges}
          onSave={handleSave}
          onDiscard={handleDiscard}
          isSaving={updateMutation.isPending}
        />
      </TabActionButton>

      {/* Main content */}
      <ScrollArea className="flex-1 w-full [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!min-w-0 [&_[data-radix-scroll-area-viewport]>div]:!w-full">
        <div className="w-full max-w-3xl mx-auto pt-12">
          {/* Editable title and description section */}
          <div className="p-2 sm:px-4 md:px-6">
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Title - inline editable */}
              <div
                ref={titleRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Document title"
                aria-multiline="false"
                tabIndex={0}
                onInput={(e) =>
                  handleTitleChange(e.currentTarget.textContent || "")
                }
                onBlur={(e) => {
                  if (!e.currentTarget.textContent?.trim()) {
                    e.currentTarget.textContent = "";
                  }
                }}
                className="text-3xl font-semibold text-foreground leading-tight outline-none bg-transparent break-words overflow-wrap-anywhere empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:opacity-50"
                data-placeholder="Untitled document"
              />

              {/* Description - inline editable */}
              <div
                ref={descriptionRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Document description"
                aria-multiline="true"
                tabIndex={0}
                onInput={(e) =>
                  handleDescriptionChange(e.currentTarget.textContent || "")
                }
                onBlur={(e) => {
                  if (!e.currentTarget.textContent?.trim()) {
                    e.currentTarget.textContent = "";
                  }
                }}
                className="text-base text-muted-foreground outline-none bg-transparent break-words overflow-wrap-anywhere empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:opacity-50"
                data-placeholder="Add a description..."
              />
            </div>

            {/* Tags section */}
            <div className="py-6">
              <div className="flex gap-2.5 flex-wrap items-center">
                {(formValues.tags || []).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="group cursor-default transition-colors text-sm inline-flex items-center"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hidden group-hover:inline-flex items-center ml-1 hover:text-destructive transition-colors"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </Badge>
                ))}

                {/* Add tag button or input */}
                {isAddingTag ? (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 w-fit rounded-full border border-border transition-colors">
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        } else if (e.key === "Escape") {
                          handleCancelAddTag();
                        }
                      }}
                      onBlur={(e) => {
                        // Check if the blur is caused by clicking the check button
                        if (
                          !e.relatedTarget ||
                          !e.currentTarget.parentElement?.contains(
                            e.relatedTarget as Node,
                          )
                        ) {
                          handleCancelAddTag();
                        }
                      }}
                      placeholder="Tag..."
                      aria-label="Add new tag"
                      size={newTagInput.length || 6}
                      className="bg-transparent outline-none border-none text-sm placeholder:text-muted-foreground placeholder:opacity-50"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag();
                      }}
                      disabled={!newTagInput.trim()}
                      className="inline-flex items-center hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <Icon name="check" size={12} />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddingTag(true)}
                    className="size-6 text-muted-foreground p-0 rounded-full"
                  >
                    <Icon name="add" size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Document editor */}
          <div className="px-4 sm:px-6 md:px-8 pt-4 pb-20">
            {editorMode === "pretty" ? (
              <DocumentEditor
                value={formValues.content}
                onChange={handleContentChange}
                locator={locator}
              />
            ) : (
              <Textarea
                value={formValues.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write your markdown here..."
                className="min-h-[500px] font-mono text-sm resize-y"
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
