import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@deco/ui/components/sonner.tsx";
import { KEYS, MCPClient } from "@deco/sdk";

interface ImportFromGithubInput {
  org: string;
  githubUrl: string;
  slug?: string;
  title?: string;
}

export function useImportProjectFromGithub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportFromGithubInput) => {
      toast.info("Importing project from GitHub...");

      // Call the MCP tool
      const result = await MCPClient.PROJECTS_IMPORT_FROM_GITHUB(input);

      toast.success(`Project "${result.projectSlug}" imported successfully!`);
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate projects list for the organization
      queryClient.invalidateQueries({
        queryKey: KEYS.PROJECTS(variables.org),
      });

      // Invalidate recent projects
      queryClient.invalidateQueries({
        queryKey: KEYS.RECENT_PROJECTS(),
      });
    },
    onError: (error) => {
      console.error("Import from GitHub failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to import project from GitHub. Try using the CLI: npx deco-cli@latest project import",
      );
    },
  });
}
