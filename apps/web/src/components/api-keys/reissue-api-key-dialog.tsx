import type { ApiKeyPolicies } from "@deco/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { ReissueApiKeyForIntegration } from "./reissue-api-key.tsx";

interface ReissueApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  newPolicies: ApiKeyPolicies;
  onReissued?: (result: { id: string; value: string }) => void;
}

export function ReissueApiKeyDialog({
  open,
  onOpenChange,
  integrationId,
  newPolicies,
  onReissued,
}: ReissueApiKeyDialogProps) {
  function handleReissued(result: { id: string; value: string }) {
    onReissued?.(result);
    onOpenChange(false);
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reissue API Key</DialogTitle>
        </DialogHeader>
        <ReissueApiKeyForIntegration
          integrationId={integrationId}
          newPolicies={newPolicies}
          onReissued={handleReissued}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
