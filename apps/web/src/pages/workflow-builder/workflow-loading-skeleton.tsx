import { Spinner } from "@deco/ui/components/spinner.tsx";

export function WorkflowLoadingSkeleton() {
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-muted-foreground">Loading workflow...</p>
      </div>
    </div>
  );
}
