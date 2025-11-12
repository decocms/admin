import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense, useEffect, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { MainChatSkeleton } from "../agent/chat.tsx";
import { Canvas } from "../canvas/canvas.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";
import { useThread } from "../decopilot/thread-provider.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";

export function ProjectHome() {
  const { tabs } = useThread();
  const { open: decopilotOpen } = useDecopilotOpen();
  const hasTabs = tabs.length > 0;
  const canvasPanelRef = useRef<ImperativePanelHandle>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);

  // Collapse/expand panels based on tabs and decopilot state
  useEffect(() => {
    if (hasTabs && decopilotOpen) {
      canvasPanelRef.current?.expand();
      chatPanelRef.current?.expand();
    } else if (hasTabs && !decopilotOpen) {
      canvasPanelRef.current?.expand();
      chatPanelRef.current?.collapse();
    } else if (!hasTabs && decopilotOpen) {
      canvasPanelRef.current?.collapse();
      chatPanelRef.current?.expand();
    } else {
      canvasPanelRef.current?.collapse();
      chatPanelRef.current?.expand();
    }
  }, [hasTabs, decopilotOpen]);

  const showResizeHandle = Boolean(hasTabs && decopilotOpen);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel
        ref={canvasPanelRef}
        className="bg-background"
        defaultSize={70}
        collapsible={true}
      >
        <Suspense
          fallback={
            <div className="h-[calc(100vh-48px)] w-full grid place-items-center">
              <Spinner />
            </div>
          }
        >
          <Canvas />
        </Suspense>
      </ResizablePanel>

      <ResizableHandle
        withHandle={showResizeHandle}
        className={
          showResizeHandle ? undefined : "pointer-events-none opacity-0"
        }
      />

      <ResizablePanel
        ref={chatPanelRef}
        defaultSize={30}
        minSize={30}
        className="min-w-0 overflow-hidden transition-[flex] duration-300 ease-(--ease-out-quint)"
        collapsible={true}
      >
        <div className={cn("h-full w-full", hasTabs && "min-w-[380px]")}>
          <Suspense fallback={<MainChatSkeleton />}>
            <DecopilotChat />
          </Suspense>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
