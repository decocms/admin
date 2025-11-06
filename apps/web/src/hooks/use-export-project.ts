import { useMutation } from "@tanstack/react-query";
import { toast } from "@deco/ui/components/sonner.tsx";
import { MCPClient } from "@deco/sdk";

interface ExportProjectInput {
  org: string;
  project: string;
}

export function useExportProjectToZip() {
  return useMutation({
    mutationFn: async (input: ExportProjectInput) => {
      toast.info("Exporting project...");

      const result = await MCPClient.PROJECTS_EXPORT_ZIP(input);

      // Convert base64 to blob and download
      const binaryString = atob(result.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Project exported successfully!");
      return result;
    },
    onError: (error) => {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export project",
      );
    },
  });
}

