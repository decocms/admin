import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useEffect, useRef } from "react";
import { useThreadManager } from "../decopilot/thread-context-manager.tsx";
import { MainChatSkeleton } from "../agent/chat.tsx";
import { Canvas } from "../canvas/canvas.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import type { ImperativePanelHandle } from "react-resizable-panels";

export function ProjectHome() {
  const { tabs } = useThreadManager();
  const { open: decopilotOpen, setOpen: setDecopilotOpen } = useDecopilotOpen();
  const hasTabs = tabs.length > 0;
  const canvasPanelRef = useRef<ImperativePanelHandle>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);

  // Automatically open decopilot when tabs are added
  useEffect(() => {
    if (hasTabs && !decopilotOpen) {
      setDecopilotOpen(true);
    }
  }, [hasTabs, decopilotOpen, setDecopilotOpen]);

  // Collapse/expand panels based on tabs and decopilot state
  useEffect(() => {
    if (hasTabs && decopilotOpen) {
      // Show both canvas and chat
      canvasPanelRef.current?.expand();
      chatPanelRef.current?.expand();
    } else if (hasTabs && !decopilotOpen) {
      // Show only canvas (full width)
      canvasPanelRef.current?.expand();
      chatPanelRef.current?.collapse();
    } else if (!hasTabs && decopilotOpen) {
      // Show only chat (full width)
      canvasPanelRef.current?.collapse();
      chatPanelRef.current?.expand();
    } else {
      // No tabs and chat closed - show chat by default
      canvasPanelRef.current?.collapse();
      chatPanelRef.current?.expand();
    }
  }, [hasTabs, decopilotOpen]);

  const showResizeHandle = hasTabs && decopilotOpen;

  return (
    <ResizablePanelGroup direction="horizontal">
      {/* Canvas panel - left side, collapsed when no tabs */}
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
      {/* Resize handle - always present but only visible when both panels are visible */}
      <ResizableHandle
        withHandle={showResizeHandle}
        className={
          showResizeHandle ? undefined : "pointer-events-none opacity-0"
        }
      />
      {/* Chat panel - right side, collapsed when decopilot is closed */}
      <ResizablePanel
        ref={chatPanelRef}
        defaultSize={30}
        className="min-w-0"
        collapsible={true}
      >
        <Suspense fallback={<MainChatSkeleton />}>
          <DecopilotChat />
        </Suspense>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
