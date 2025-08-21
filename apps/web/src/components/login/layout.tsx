import { cn } from "@deco/ui/lib/utils.ts";

export const ContextIsEverythingPanel = () => {
  return (
    <img
      src="/img/context-is-everything-panel.jpg"
      alt="Context is everything"
      className="w-full h-full object-cover rounded-lg"
    />
  );
};

export function SplitScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen flex items-center gap-4 p-4">
      <div className={cn("hidden lg:block lg:w-1/3 lg:min-w-[475px] h-full")}>
        <ContextIsEverythingPanel />
      </div>
      <div className="w-full lg:w-2/3 h-full">{children}</div>
    </div>
  );
}
