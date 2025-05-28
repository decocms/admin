import { useInvites } from "@deco/sdk/hooks";
import { cn } from "@deco/ui/lib/utils.ts";

export default function Notification({ className }: { className?: string }) {
  const { data: invites = [] } = useInvites();

  if (!invites.length) return null;

  return (
    <span className={cn("relative flex size-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
    </span>
  );
}
