import {
  useCreateProject,
  useDeleteProject,
  useFile,
  useProjects,
  useUpdateProject,
  useWriteFile,
  type Project,
} from "@deco/sdk";
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
import { Avatar } from "@deco/ui/components/avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ErrorBoundary } from "../../error-boundary";
import { normalizeGithubImportValue } from "../../utils/github-import.ts";
import { CommunityCallBanner } from "../common/event/community-call-banner";
import { ImportProjectFromGithub } from "./import-project-from-github.tsx";
import { OrgAvatars, OrgMemberCount } from "./members";

const AVATAR_UPLOAD_SIZE_LIMIT = 1024 * 1024 * 5; // 5MB
const PROJECT_AVATAR_PATH = "project-avatars";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount or when it changes
  useEffect(() => {
    const currentUrl = localAvatarUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [localAvatarUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasNameChange = newName.trim() !== project.title && newName.trim();
    if (!hasNameChange && !selectedFile) {
      setIsSettingsDialogOpen(false);
      return;
    }

    try {
      // Upload avatar if a file was selected
      let avatarUrl: string | undefined = project.avatar_url || undefined;
      if (selectedFile) {
        if (selectedFile.size > AVATAR_UPLOAD_SIZE_LIMIT) {
          toast.error("File size exceeds the limit of 5MB");
          setSelectedFile(null);
          setLocalAvatarUrl(null);
          return;
        }

        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ];
        if (!allowedTypes.includes(selectedFile.type)) {
          toast.error("Please upload a PNG, JPEG, JPG, or WebP image file");
          setSelectedFile(null);
          setLocalAvatarUrl(null);
          return;
        }

        const filename = `${project.slug}-${crypto.randomUUID()}.${
          selectedFile.name.split(".").pop() || "png"
        }`;
        const path = `${PROJECT_AVATAR_PATH}/${filename}`;
        await writeFileMutation.mutateAsync({
          path,
          content: new Uint8Array(await selectedFile.arrayBuffer()),
          contentType: selectedFile.type,
        });
        avatarUrl = path;
      }

      const updateData: { title?: string; icon?: string } = {};
      if (hasNameChange) {
        updateData.title = newName.trim();
      }
      if (selectedFile) {
        updateData.icon = avatarUrl;
      }

      await updateProjectMutation.mutateAsync({
        org: project.org.slug,
        project: project.slug,
        data: updateData,
      });

      // Reset states
      setSelectedFile(null);
      setLocalAvatarUrl(null);
      setIsSettingsDialogOpen(false);
      toast.success("Project settings updated successfully");
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error("Failed to update project settings");
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
  const { data: resolvedAvatarUrl } = useFile(project.avatar_url || "");

  return (
    <Card className="group transition-colors flex flex-col relative">
      <Link to={url} className="flex flex-col">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <Avatar
              url={resolvedAvatarUrl || ""}
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
              setSelectedFile(null);
              setLocalAvatarUrl(null);
            }}
          >
            <Icon name="settings" size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-avatar">Project Icon</Label>
              <div className="flex items-center gap-4">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar
                    shape="square"
                    fallback={project.title}
                    url={
                      localAvatarUrl ||
                      resolvedAvatarUrl ||
                      project.org.avatar_url ||
                      ""
                    }
                    objectFit="contain"
                    size="2xl"
                    className="group-hover:opacity-50 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="upload" size={32} className="text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      if (file.size > AVATAR_UPLOAD_SIZE_LIMIT) {
                        toast.error("File size exceeds the limit of 5MB");
                        e.target.value = "";
                        return;
                      }
                      setSelectedFile(file);
                      const objectUrl = URL.createObjectURL(file);
                      setLocalAvatarUrl(objectUrl);
                    }
                  }}
                  disabled={
                    updateProjectMutation.isPending ||
                    writeFileMutation.isPending
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Click the icon to upload a new project avatar (PNG, JPEG,
                  WebP, max 5MB)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter project name"
                disabled={
                  updateProjectMutation.isPending || writeFileMutation.isPending
                }
              />
              {updateProjectMutation.error && (
                <p className="text-sm text-destructive">
                  Failed to update project. Please try again.
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSettingsDialogOpen(false);
                  setSelectedFile(null);
                  setLocalAvatarUrl(null);
                }}
                disabled={
                  updateProjectMutation.isPending || writeFileMutation.isPending
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updateProjectMutation.isPending ||
                  writeFileMutation.isPending ||
                  !newName.trim()
                }
              >
                {updateProjectMutation.isPending || writeFileMutation.isPending
                  ? "Saving..."
                  : "Save"}
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
    </Card>
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const createProjectMutation = useCreateProject();
  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount or when it changes
  useEffect(() => {
    const currentUrl = localAvatarUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [localAvatarUrl]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !title.trim()) {
      return;
    }

    try {
      // Upload avatar if a file was selected
      let icon: string | undefined;
      if (selectedFile) {
        if (selectedFile.size > AVATAR_UPLOAD_SIZE_LIMIT) {
          toast.error("File size exceeds the limit of 5MB");
          setSelectedFile(null);
          setLocalAvatarUrl(null);
          return;
        }

        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ];
        if (!allowedTypes.includes(selectedFile.type)) {
          toast.error("Please upload a PNG, JPEG, JPG, or WebP image file");
          setSelectedFile(null);
          setLocalAvatarUrl(null);
          return;
        }

        const filename = `${slug.trim()}-${crypto.randomUUID()}.${
          selectedFile.name.split(".").pop() || "png"
        }`;
        const path = `${PROJECT_AVATAR_PATH}/${filename}`;
        await writeFileMutation.mutateAsync({
          path,
          content: new Uint8Array(await selectedFile.arrayBuffer()),
          contentType: selectedFile.type,
        });
        icon = path;
      }

      await createProjectMutation.mutateAsync({
        org,
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        icon,
      });

      // Reset form and close dialog on success
      setSlug("");
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setLocalAvatarUrl(null);
      setIsOpen(false);
      toast.success("Project created successfully");
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project");
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
        <Button variant="default" disabled={disabled}>
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
            <Label htmlFor="project-icon">Project Icon</Label>
            <div className="flex items-center gap-4">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar
                  shape="square"
                  fallback={title || "Project"}
                  url={localAvatarUrl || ""}
                  objectFit="contain"
                  size="2xl"
                  className="group-hover:opacity-50 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="upload" size={32} className="text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    if (file.size > AVATAR_UPLOAD_SIZE_LIMIT) {
                      toast.error("File size exceeds the limit of 5MB");
                      e.target.value = "";
                      return;
                    }
                    setSelectedFile(file);
                    const objectUrl = URL.createObjectURL(file);
                    setLocalAvatarUrl(objectUrl);
                  }
                }}
                disabled={
                  createProjectMutation.isPending || writeFileMutation.isPending
                }
              />
              <p className="text-xs text-muted-foreground">
                Click the icon to upload a project avatar (PNG, JPEG, WebP, max
                5MB)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-title">
              Project Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                handleSlugChange(e.target.value);
              }}
              placeholder="My Awesome Project"
              disabled={
                createProjectMutation.isPending || writeFileMutation.isPending
              }
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
              disabled={
                createProjectMutation.isPending || writeFileMutation.isPending
              }
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
              disabled={
                createProjectMutation.isPending || writeFileMutation.isPending
              }
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
              onClick={() => {
                setIsOpen(false);
                setSelectedFile(null);
                setLocalAvatarUrl(null);
              }}
              disabled={
                createProjectMutation.isPending || writeFileMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createProjectMutation.isPending ||
                writeFileMutation.isPending ||
                !slug.trim() ||
                !title.trim()
              }
            >
              {createProjectMutation.isPending || writeFileMutation.isPending
                ? "Creating..."
                : "Create"}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const importGithubParam = searchParams.get("importGithub") ?? undefined;
  const { slug: importGithubSlug, url: normalizedGithubUrl } =
    normalizeGithubImportValue(importGithubParam);
  const importGithubUrl = normalizedGithubUrl ?? undefined;

  const handleImportDialogClose = useCallback(() => {
    if (!importGithubParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("importGithub");
    setSearchParams(next, { replace: true });
  }, [importGithubParam, searchParams, setSearchParams]);

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
            <ImportProjectFromGithub
              org={org ?? ""}
              defaultOpen={Boolean(importGithubSlug)}
              defaultGithubUrl={importGithubUrl}
              onClose={handleImportDialogClose}
            />
            <CreateProject org={org ?? ""} />
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
