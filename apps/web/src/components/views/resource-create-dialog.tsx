import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";

// Schema based on ResourceCreateInputSchema from packages/runtime/src/resources.ts
const ResourceCreateFormSchema = z.object({
  resourceName: z
    .string()
    .min(1, "Resource name is required")
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      "Resource name can only contain letters, numbers, hyphens, and underscores",
    ),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .describe("The text content for the resource"),
  viewType: z.enum(["blank", "grid", "list"]),
});

type ResourceCreateFormData = z.infer<typeof ResourceCreateFormSchema>;

interface ResourceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  onSubmit: (data: {
    resourceName: string;
    title?: string;
    description?: string;
    content: { data: string; type: "text" };
  }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  initialViewType?: "blank" | "grid" | "list";
}

export function ResourceCreateDialog({
  open,
  onOpenChange,
  resourceName,
  onSubmit,
  isLoading = false,
  error,
  onClearError,
  initialViewType = "blank",
}: ResourceCreateDialogProps) {
  const form = useForm<ResourceCreateFormData>({
    resolver: zodResolver(ResourceCreateFormSchema),
    defaultValues: {
      resourceName: "",
      title: "",
      description: "",
      content: "",
      viewType: initialViewType,
    },
    mode: "onBlur",
  });

  const handleSubmit = async (data: ResourceCreateFormData) => {
    // Clear any previous errors when submitting
    onClearError?.();

    try {
      let content = data.content;

      if (data.viewType === "grid") {
        content = `import React from "react";

export const App = ({ views = [] }: { views?: string[] }) => {
    const [viewData, setViewData] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        if (!views.length) return;

        views.forEach((uri) => {
            // @ts-ignore - fetchView is injected by the SDK
            (window as any).fetchView(uri)
                .then((html: string) => {
                    setViewData((prev) => ({ ...prev, [uri]: html }));
                })
                .catch((err: Error) => {
                    setErrors((prev) => ({ ...prev, [uri]: err.message }));
                });
        });
    }, [views]);

    if (!views.length) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-semibold mb-2">Empty Grid</h2>
                <p>No views configured. Add view URIs to the "views" prop.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {views.map((uri) => (
                <div key={uri} className="border rounded-lg overflow-hidden shadow-sm bg-white h-96 flex flex-col">
                    <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 truncate" title={uri}>
                            {uri}
                        </span>
                        <button
                            onClick={() => (window as any).navigate(uri)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            Open
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        {errors[uri] ? (
                            <div className="absolute inset-0 flex items-center justify-center p-4 text-red-500 text-sm text-center bg-red-50">
                                Error loading view: {errors[uri]}
                            </div>
                        ) : viewData[uri] ? (
                            <iframe
                                srcDoc={viewData[uri]}
                                className="w-full h-full border-0"
                                title={\`View \${uri}\`}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};`;
      } else if (data.viewType === "list") {
        content = `import React from "react";

export const App = ({ views = [] }: { views?: string[] }) => {
    const [viewData, setViewData] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        if (!views.length) return;

        views.forEach((uri) => {
            // @ts-ignore - fetchView is injected by the SDK
            (window as any).fetchView(uri)
                .then((html: string) => {
                    setViewData((prev) => ({ ...prev, [uri]: html }));
                })
                .catch((err: Error) => {
                    setErrors((prev) => ({ ...prev, [uri]: err.message }));
                });
        });
    }, [views]);

    if (!views.length) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-semibold mb-2">Empty List</h2>
                <p>No views configured. Add view URIs to the "views" prop.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
            {views.map((uri) => (
                <div key={uri} className="border rounded-lg overflow-hidden shadow-sm bg-white flex flex-col md:flex-row h-64 md:h-48">
                    <div className="bg-gray-50 p-4 border-b md:border-b-0 md:border-r w-full md:w-64 flex flex-col justify-between shrink-0">
                        <div>
                            <h3 className="font-medium text-gray-900 truncate mb-1" title={uri}>
                                {uri}
                            </h3>
                            <p className="text-xs text-gray-500">View Component</p>
                        </div>
                        <button
                            onClick={() => (window as any).navigate(uri)}
                            className="mt-4 w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Open Full View
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        {errors[uri] ? (
                            <div className="absolute inset-0 flex items-center justify-center p-4 text-red-500 text-sm text-center bg-red-50">
                                Error loading view: {errors[uri]}
                            </div>
                        ) : viewData[uri] ? (
                            <iframe
                                srcDoc={viewData[uri]}
                                className="w-full h-full border-0"
                                title={\`View \${uri}\`}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};`;
      }

      await onSubmit({
        resourceName: data.resourceName,
        title: data.title || undefined,
        description: data.description || undefined,
        content: {
          data: content,
          type: "text",
        },
      });
      // Only reset and close on success (handled in parent component)
      form.reset();
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Failed to create resource:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      form.reset();
      onClearError?.(); // Clear errors when closing dialog
    }
    onOpenChange(newOpen);
  };

  // Update form default value when initialViewType changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.setValue("viewType", initialViewType);
      if (initialViewType === "grid" || initialViewType === "list") {
        form.setValue("content", " ");
      } else {
        form.setValue("content", "");
      }
    }
  }, [open, initialViewType, form]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create {resourceName}</DialogTitle>
          <DialogDescription>
            Create a new {resourceName.toLowerCase()} resource. All fields
            except the resource name and content are optional.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="resourceName"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>
                    Resource Name{" "}
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="my-resource-name"
                      className={
                        fieldState.error
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="viewType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>View Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Clear content if switching to grid or list so it gets auto-generated
                      if (value === "grid" || value === "list") {
                        form.setValue("content", " "); // Set to space to bypass required check, will be replaced on submit
                      } else {
                        form.setValue("content", "");
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a view type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="blank">Blank View</SelectItem>
                      <SelectItem value="grid">Grid View</SelectItem>
                      <SelectItem value="list">List View</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Display title for the resource"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional description of the resource"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("viewType") === "blank" && (
              <FormField
                control={form.control}
                name="content"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      Content <span className="text-destructive ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter the text content for this resource"
                        rows={6}
                        className={
                          fieldState.error
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  "Create Resource"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
