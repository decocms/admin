import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, ExternalLink } from "lucide-react";
import { DECO_CMS_API_URL, Locator, useSDK, type Theme } from "@deco/sdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

const importFormSchema = z.object({
  url: z.string().url("Invalid URL"),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

export interface ImportStylesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (data: { url: string; theme: Theme }) => void;
}

export function ImportStylesModal({
  open,
  onOpenChange,
  onImportComplete,
}: ImportStylesModalProps) {
  const { locator } = useSDK();
  const { org, project } = locator
    ? Locator.parse(locator)
    : { org: "", project: "" };

  const [isImporting, setIsImporting] = useState(false);

  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      url: "",
    },
  });

  const handleImport = async (values: ImportFormValues) => {
    setIsImporting(true);

    try {
      // Validate URL
      const urlValidation = validateUrl(values.url);
      if (!urlValidation.valid) {
        toast.error(urlValidation.error || "Invalid URL");
        return;
      }

      toast.info("Analyzing website...", {
        description: "This may take a few seconds",
      });

      if (!org || !project) {
        throw new Error("Missing organization or project context");
      }

      const response = await fetch(`${DECO_CMS_API_URL}/${org}/${project}/theme/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: values.url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        const errorMessage = errorData.error || "Failed to scrape website";
        console.error("Scraping failed:", errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json() as {
        success: boolean;
        theme?: Theme;
        error?: string;
        metadata?: {
          colorsFound: number;
          fontsFound: number;
          elementsAnalyzed: number;
        };
      };

      if (!data.success || !data.theme) {
        throw new Error(data.error || "Failed to extract theme");
      }

      // Apply theme directly
      onImportComplete({
        url: values.url,
        theme: data.theme,
      });

      // Reset and close
      form.reset();
      onOpenChange(false);

      toast.success("Theme imported successfully!", {
        description: `Found ${data.metadata?.colorsFound || 0} colors and ${data.metadata?.fontsFound || 0} fonts`,
      });
    } catch (error) {
      console.error("Error importing styles:", error);
      
      let errorMessage = "Please try again";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error("Failed to import styles", {
        description: errorMessage,
        duration: 6000, // Show error longer so user can read it
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Site Styles</DialogTitle>
          <DialogDescription>
            Paste a website URL to automatically extract colors, fonts, and
            visual styles. This works best with static HTML sites. Sites that
            heavily rely on JavaScript may not extract properly.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleImport)} className="space-y-6">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://example.com"
                        {...field}
                        disabled={isImporting}
                      />
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(field.value, "_blank")}
                          disabled={isImporting}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import & Apply
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Helper function - moved from site-scraper to avoid import issues
function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return {
        valid: false,
        error: "Cannot import from local or private URLs",
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}


