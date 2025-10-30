import { Separator } from "@deco/ui/components/separator.tsx";
import { ConnectedMCPsSection } from "./connected-mcps.tsx";
import { DecoMCPsSection } from "./deco-mcps.tsx";

export default function MCPsHome() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 flex flex-col gap-8">
        {/* Deco MCPs Section */}
        <DecoMCPsSection />

        <Separator />

        {/* Connected MCPs Section */}
        <ConnectedMCPsSection />
      </div>
    </div>
  );
}

