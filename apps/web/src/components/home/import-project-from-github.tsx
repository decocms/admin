import {
  useState,
  useMemo,
  useEffect,
  useDeferredValue,
  Suspense,
} from "react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useImportProjectFromGithub } from "../../hooks/use-import-project-from-github.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useProjects, type Project } from "@deco/sdk";

interface ImportProjectFromGithubProps {
  org: string;
  disabled?: boolean;
  defaultOpen?: boolean;
  defaultGithubUrl?: string;
  onClose?: () => void;
}

interface ImportProjectFormProps {
  org: string;
  defaultGithubUrl?: string;
  onClose: () => void;
}

function ImportProjectForm({
  org,
  defaultGithubUrl,
  onClose,
}: ImportProjectFormProps) {
  const [githubUrl, setGithubUrl] = useState(defaultGithubUrl ?? "");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const importMutation = useImportProjectFromGithub();
  const projects = useProjects({ org, searchQuery: "" });

  // Defer the slug check to prevent input lag
  const deferredSlug = useDeferredValue(projectSlug);

  // Check if the slug already exists (uses deferred value)
  const slugExists = useMemo(() => {
    if (!deferredSlug.trim()) return false;
    return projects.some((p: Project) => p.slug === deferredSlug.trim());
  }, [projects, deferredSlug]);

  useEffect(() => {
    if (defaultGithubUrl) {
      setGithubUrl(defaultGithubUrl);
      parseGithubUrl(defaultGithubUrl, { force: true });
    }
  }, [defaultGithubUrl]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!githubUrl.trim()) {
      return;
    }

    try {
      await importMutation.mutateAsync({
        org,
        githubUrl: githubUrl.trim(),
        slug: projectSlug.trim() || undefined,
        title: projectTitle.trim() || undefined,
      });

      // Close dialog on success
      onClose();
    } catch (error) {
      console.error("Failed to import project from GitHub:", error);
      // Error state is handled by the mutation hook
    }
  };

  const handleSlugChange = (value: string) => {
    // Allow lowercase letters, numbers, and dashes
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setProjectSlug(cleaned);
  };

  function parseGithubUrl(url: string, options: { force?: boolean } = {}) {
    const { force = false } = options;
    // Try to extract repo info from GitHub URL
    // Supports: https://github.com/owner/repo or https://github.com/owner/repo.git
    const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
    if (match) {
      const [, , repo] = match;
      if (force) {
        setProjectSlug("");
        setProjectTitle("");
      }
      if (force || !projectSlug) {
        handleSlugChange(repo);
      }
      if (force || !projectTitle) {
        // Convert kebab-case to Title Case
        const title = repo
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        setProjectTitle(title);
      }
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <img
            src="/img/github.svg"
            alt="GitHub"
            className="size-6 brightness-50"
          />
          Import Project from GitHub
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleImport} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="github-url">
            GitHub Repository URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="github-url"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              parseGithubUrl(e.target.value);
            }}
            placeholder="https://github.com/owner/repo"
            disabled={importMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-title">Project Title</Label>
          <Input
            id="project-title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="Auto-detected from repository"
            disabled={importMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-slug">Project Slug</Label>
          <Input
            id="project-slug"
            value={projectSlug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="Auto-detected from repository"
            disabled={importMutation.isPending}
            className={
              slugExists
                ? "border-destructive focus-visible:ring-destructive"
                : ""
            }
          />
          {slugExists && (
            <p className="text-xs text-destructive">
              A project with slug "{projectSlug}" already exists in this
              organization. Please choose a different slug.
            </p>
          )}
        </div>

        {importMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="sm" />
            <span>Downloading and importing project...</span>
          </div>
        )}

        {importMutation.error && (
          <p className="text-sm text-destructive">
            Failed to import project from GitHub.{" "}
            {importMutation.error instanceof Error
              ? importMutation.error.message
              : "Please try again."}
          </p>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              importMutation.isPending || !githubUrl.trim() || slugExists
            }
          >
            {importMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </div>
      </form>
    </>
  );
}

export function ImportProjectFromGithub({
  org,
  disabled,
  defaultOpen,
  defaultGithubUrl,
  onClose,
}: ImportProjectFromGithubProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Icon name="download" size={16} />
          <span>Import from GitHub</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8">
              <Spinner />
            </div>
          }
        >
          <ImportProjectForm
            org={org}
            defaultGithubUrl={defaultGithubUrl}
            onClose={handleClose}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
