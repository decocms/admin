import { useEffect, useState } from "react";
import { cn } from "@deco/ui/lib/utils.ts";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";

export function MobileAccessModal() {
  const isMobile = useIsMobile();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(globalThis.location.search);
      const nextParam = urlParams.get("next");
      setShowModal(isMobile && !!nextParam && nextParam.includes("deco.chat"));
    }
  }, [isMobile]);

  return (
    <Dialog open={showModal} modal>
      <DialogContent className="flex flex-col items-center p-6 gap-4">
        <DialogTitle className="text-xl font-semibold text-center">
          deco.chat is on closed-beta
        </DialogTitle>
        <p className="text-center text-muted-foreground">
          Access to deco.chat is currently limited to invited users.
        </p>
        <Button
          className="w-full"
          asChild
        >
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSei-NiJhRpdLHR0k_FFeLZgOEDN8k-Z2pmPDl0LZFpOxCGUJg/viewform?usp=dialog"
            target="_blank"
            rel="noopener noreferrer"
          >
            Request Access
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function SplitScreenLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <div className="w-screen h-screen flex">
      <MobileAccessModal />
      <div
        className={cn(
          "hidden md:block md:w-1/2 bg-cover",
        )}
      >
        <div className="p-6 h-full">
          <div className="flex flex-col gap-10 bg-[#49DE80] items-center justify-center h-full rounded-[64px]">
            <p className="text-[#033B18] text-6xl text-center">
              Your <span className="text-7xl font-crimson-pro italic">new</span>
              <br />
              AI Workspace
            </p>
            <img
              src="/img/deco-chat-logo.svg"
              className="h-6 rounded-lg mb-6"
            />
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2 h-full">{children}</div>
    </div>
  );
}
