import {
  useProjects,
  useUpdateProject,
  useCreateProject,
  useDeleteProject,
  type Project,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useState, useDeferredValue } from "react";
import { Link, useParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { CommunityCallBanner } from "../common/event/community-call-banner";
import { OrgAvatars, OrgMemberCount } from "./members";
import { Separator } from "@deco/ui/components/separator.tsx";

function ProjectCard({
  project,
  url,
  slugPrefix = "@",
  showMembers = true,
  additionalInfo,
  hideSlug = false,
}: {
  project: Project;
  url: string;
  slugPrefix?: string;
  showMembers?: boolean;
  additionalInfo?: string;
  hideSlug?: boolean;
}) {
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newName, setNewName] = useState(project.title);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() === project.title || !newName.trim()) {
      setIsSettingsDialogOpen(false);
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        org: project.org.slug,
        project: project.slug,
        data: { title: newName.trim() },
      });
      setIsSettingsDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename project:", error);
      // Error state is handled by the mutation hook
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      const result = await deleteProjectMutation.mutateAsync({
        projectId: project.id,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to delete project");
      }
      setIsDeleteDialogOpen(false);
      setIsSettingsDialogOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete project.",
      );
    }
  };

  return (
    <div className="group bg-card hover:bg-accent transition-colors flex flex-col rounded-lg relative">
      <Link to={url} className="flex flex-col">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <Avatar
              url={project.avatar_url || project.org.avatar_url || ""}
              fallback={project.title || project.slug}
              size="lg"
              objectFit="contain"
            />
          </div>
          <div className="flex flex-col gap-[2px]">
            {!hideSlug && (
              <h3 className="text-sm text-muted-foreground truncate">
                {slugPrefix}
                {project.slug}
              </h3>
            )}
            <p className="font-medium truncate">{project.title}</p>
            {additionalInfo && (
              <span className="text-xs text-muted-foreground">
                {additionalInfo}
              </span>
            )}
          </div>
        </div>
        {/* Show organization members on the project card for now */}
        {showMembers && typeof project.org.id === "number" && (
          <div className="p-4 border-t border-border flex justify-between items-center">
            <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
              <Suspense fallback={<OrgAvatars.Skeleton />}>
                <OrgAvatars teamId={project.org.id} />
              </Suspense>
              <Suspense fallback={<OrgMemberCount.Skeleton />}>
                <OrgMemberCount teamId={project.org.id} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </Link>

      {/* Config Icon */}
      <Dialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
      >
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity p-1 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setNewName(project.title);
            }}
          >
            <Icon name="settings" size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter project name"
                disabled={updateProjectMutation.isPending}
              />
              {updateProjectMutation.error && (
                <p className="text-sm text-destructive">
                  Failed to rename project. Please try again.
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettingsDialogOpen(false)}
                disabled={updateProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProjectMutation.isPending || !newName.trim()}
              >
                {updateProjectMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Delete Project</h3>
            <p className="text-xs text-muted-foreground">
              Permanently remove this project and all its data
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={(e) => {
                e.preventDefault();
                setIsDeleteDialogOpen(true);
              }}
              disabled={deleteProjectMutation.isPending}
            >
              Delete Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project "{project.title}" and all its data.
            </AlertDialogDescription>
            {deleteError && (
              <div className="text-destructive text-sm mt-2">{deleteError}</div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={deleteProjectMutation.isPending}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                await handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
            >
              {deleteProjectMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner size="xs" variant="destructive" /> Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Projects({ query, org }: { query?: string; org: string }) {
  const projects = useProjects({ searchQuery: query, org });

  if (projects.length === 0) {
    return <Projects.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          url={`/${project.org.slug}/${project.slug}`}
        />
      ))}
    </div>
  );
}

Projects.Skeleton = () => (
  <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="h-12 w-12 bg-card rounded-lg"></div>
          <div className="h-4 w-32 bg-card rounded-lg"></div>
          <div className="h-4 w-32 bg-card rounded-lg"></div>
        </div>
        <div className="p-4 border-t border-border flex items-center">
          <div className="h-6 w-6 bg-card rounded-full animate-pulse"></div>
          <div className="h-6 w-6 bg-card rounded-full animate-pulse -ml-2"></div>
          <div className="h-6 w-6 bg-card rounded-full animate-pulse -ml-2"></div>
        </div>
      </div>
    ))}
  </div>
);

Projects.Error = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8">
    <Icon name="error" size={24} className="text-muted-foreground" />
    <div className="text-sm text-muted-foreground text-center">
      We couldn't load your projects right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Projects.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No projects found.
    </div>
  </div>
);

function CreateProject({ org, disabled }: { org: string; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createProjectMutation = useCreateProject();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !title.trim()) {
      return;
    }

    try {
      await createProjectMutation.mutateAsync({
        org,
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
      });
      // Reset form and close dialog on success
      setSlug("");
      setTitle("");
      setDescription("");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
      // Error state is handled by the mutation hook
    }
  };

  const handleSlugChange = (value: string) => {
    // Convert to URL-friendly slug
    const slugified = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(slugified);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="special" disabled={disabled}>
          <Icon name="add" size={16} />
          <span>New project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">
              Project Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                // Auto-generate slug from title if slug is empty
                if (!slug) {
                  handleSlugChange(e.target.value);
                }
              }}
              placeholder="My Awesome Project"
              disabled={createProjectMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-slug">
              Project Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-awesome-project"
              disabled={createProjectMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier (lowercase, no spaces)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              disabled={createProjectMutation.isPending}
              rows={3}
            />
          </div>

          {createProjectMutation.error && (
            <p className="text-sm text-destructive">
              Failed to create project.{" "}
              {createProjectMutation.error instanceof Error
                ? createProjectMutation.error.message
                : "Please try again."}
            </p>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={createProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createProjectMutation.isPending || !slug.trim() || !title.trim()
              }
            >
              {createProjectMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrgProjectListContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const { org } = useParams();

  return (
    <div className="min-h-full w-full bg-background">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto min-h-[calc(100vh-48px)]">
        <CommunityCallBanner />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Projects</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <CreateProject org={org ?? ""} disabled />
          </div>
        </div>
        <div className="@container overflow-y-auto flex-1 pb-28">
          <ErrorBoundary fallback={<Projects.Error />}>
            <Suspense fallback={<Projects.Skeleton />}>
              <Projects query={deferredQuery} org={org ?? ""} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default OrgProjectListContent;
export { ProjectCard };
