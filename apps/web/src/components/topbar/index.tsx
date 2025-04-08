import { cn } from "@deco/ui/lib/utils.ts";
import { TOPBAR_ACTION_ID, TOPBAR_BREADCRUMB_ID } from "../../constants.ts";

export function Topbar() {
  return (
    <header
      className={cn(
        "w-full h-10 min-h-10",
        "grid grid-cols-2 justify-between justify-items-end gap-4 items-center",
      )}
    >
      <div className="justify-self-start" id={TOPBAR_BREADCRUMB_ID} />

      <div id={TOPBAR_ACTION_ID} />
    </header>
  );
}
