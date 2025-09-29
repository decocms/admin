import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { PropsWithChildren } from "react";
import { useLocalStorage } from "../../hooks/use-local-storage";
import {
  DecopilotContextValue,
  DecopilotProvider,
} from "../decopilot/context.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";

export function useDecopilotOpen() {
  const { value: open, update: setOpen } = useLocalStorage({
    key: "deco-cms-decopilot",
    defaultValue: false,
  });

  const toggle = () => {
    setOpen(!open);
  };

  return {
    open,
    setOpen,
    toggle,
  };
}

export function DecopilotLayout({
  children,
  value,
}: PropsWithChildren<{ value: DecopilotContextValue }>) {
  const { open: decopilotOpen } = useDecopilotOpen();

  return (
    <DecopilotProvider value={value}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>{children}</ResizablePanel>
        {decopilotOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30}>
              <DecopilotChat />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </DecopilotProvider>
  );
}
