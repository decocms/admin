import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  appName: string;
  appDescription?: string;
  appIcon?: string;
}

export function InstallModal({
  isOpen,
  onClose,
  onInstall,
  appName,
  appDescription,
  appIcon,
}: InstallModalProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    // Simulate installation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    onInstall();
    setIsInstalling(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {appIcon ? (
              <img 
                src={appIcon} 
                alt={appName} 
                className="w-10 h-10 rounded-lg object-contain"
              />
            ) : (
              <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
                <Icon name="check" size={20} className="text-primary-dark" />
              </div>
            )}
            <span>Install {appName}</span>
          </DialogTitle>
          <DialogDescription className="pt-4">
            {appDescription || `Install ${appName} to add powerful features to your workspace.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">This app will have access to:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Icon name="check" size={16} className="text-primary-light mt-0.5" />
                <span>Create and manage pages in your workspace</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="check" size={16} className="text-primary-light mt-0.5" />
                <span>Add sections and components to your pages</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="check" size={16} className="text-primary-light mt-0.5" />
                <span>Configure data loaders and integrations</span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="check" size={16} className="text-primary-light mt-0.5" />
                <span>Access workspace settings and configurations</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInstalling}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={isInstalling}>
            {isInstalling ? (
              <>
                <Icon name="spinner" className="animate-spin mr-2" size={16} />
                Installing...
              </>
            ) : (
              <>
                <Icon name="download" className="mr-2" size={16} />
                Install App
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
