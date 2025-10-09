import {
  DocumentDefinitionSchema,
  useDocumentByUriV2,
  useUpdateDocument,
} from "@deco/sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import RichTextArea from "../prompts/rich-text/index.tsx";

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

// Form schema for document editing
const DocumentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
});

type DocumentFormData = z.infer<typeof DocumentFormSchema>;

/**
 * Document detail view with markdown editor
 * Supports viewing and editing document content
 */
export function DocumentDetail({ resourceUri }: DocumentDetailProps) {
  const {
    data: resource,
    isLoading: isLoading,
    refetch,
  } = useDocumentByUriV2(resourceUri);
  const effectiveDocument = resource?.data;

  // Local loading state for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Local state for tag input
  const [newTag, setNewTag] = useState("");

  // Update mutation
  const updateMutation = useUpdateDocument();

  // Form setup with react-hook-form
  const form = useForm<DocumentFormData>({
    resolver: zodResolver(DocumentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      content: "",
      tags: [],
    },
  });

  // Sync form with fetched document
  useEffect(() => {
    if (effectiveDocument) {
      form.reset({
        name: effectiveDocument.name,
        description: effectiveDocument.description || "",
        content: effectiveDocument.content,
        tags: effectiveDocument.tags || [],
      });
    }
  }, [effectiveDocument, form]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const onSubmit = useCallback(
    async (data: DocumentFormData) => {
      if (!resourceUri) return;

      try {
        await updateMutation.mutateAsync({
          uri: resourceUri,
          params: data,
        });

        toast.success("Document saved successfully");
        form.reset(data);
        await refetch();
      } catch (error) {
        console.error("Failed to save document:", error);
        toast.error(
          `Failed to save document: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [resourceUri, updateMutation, form, refetch],
  );

  const handleDiscard = useCallback(() => {
    if (effectiveDocument) {
      form.reset({
        name: effectiveDocument.name,
        description: effectiveDocument.description || "",
        content: effectiveDocument.content,
        tags: effectiveDocument.tags || [],
      });
    }
  }, [effectiveDocument, form]);

  const handleAddTag = useCallback(() => {
    const currentTags = form.getValues("tags") || [];
    if (newTag.trim() && !currentTags.includes(newTag.trim())) {
      form.setValue("tags", [...currentTags, newTag.trim()], {
        shouldDirty: true,
      });
      setNewTag("");
    }
  }, [newTag, form]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      const currentTags = form.getValues("tags") || [];
      form.setValue(
        "tags",
        currentTags.filter((tag) => tag !== tagToRemove),
        { shouldDirty: true },
      );
    },
    [form],
  );

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const isMutating = form.formState.isSubmitting;

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <Icon
            name="refresh"
            size={24}
            className="animate-spin mx-auto mb-2"
          />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
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

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Floating action buttons */}
      <div className="absolute z-50 top-2 right-2 border border-border bg-background rounded-xl p-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <Icon
              name="refresh"
              className={cn(isRefreshing && "animate-spin")}
            />
          </Button>
          <div
            className={cn(
              "items-center gap-2",
              numberOfChanges > 0 ? "flex" : "hidden",
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
              onClick={() => {
                onSubmit(form.getValues());
              }}
              disabled={isMutating}
            >
              {isMutating ? (
                <>
                  <Spinner size="xs" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  Save {numberOfChanges} change
                  {numberOfChanges > 1 ? "s" : ""}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <ScrollArea className="h-[calc(100vh-48px)] w-full">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            {/* Metadata section with subtle background */}
            <div className="bg-muted/30 border-b border-border p-6 space-y-6">
              {/* Name field */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        placeholder="Untitled document"
                        className="border-none! px-0 text-2xl! font-bold outline-none! w-full bg-transparent"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description field */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Description
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of the document"
                        className="bg-background"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags field */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Tags
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {field.value && field.value.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {field.value.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTag(tag)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <Icon name="close" size={12} />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                            placeholder="Add a tag and press Enter"
                            className="bg-background"
                          />
                          <Button
                            type="button"
                            onClick={handleAddTag}
                            variant="outline"
                            size="sm"
                          >
                            <Icon name="add" size={16} />
                          </Button>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Content section with clear separation */}
            <div className="p-6">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                      Document Content
                    </FormLabel>
                    <FormControl>
                      <div className="border border-border rounded-lg p-4 bg-background">
                        <RichTextArea
                          placeholder="Write your document content in markdown..."
                          className="min-h-[50vh]"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </ScrollArea>
    </div>
  );
}
