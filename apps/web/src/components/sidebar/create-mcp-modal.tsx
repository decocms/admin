import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface CreateMcpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMcpModal({ open, onOpenChange }: CreateMcpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create MCP</DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 py-4">
          {/* Create MCP in chat option */}
          <Button
            variant="outline"
            className="flex-1 h-auto p-6 flex flex-col items-center gap-3 hover:bg-accent"
            onClick={() => {
              // TODO: Navigate to chat creation
              console.log("Create MCP in chat");
            }}
          >
            <Icon name="message_circle" size={32} className="text-primary" />
            <span className="text-sm font-medium">Create MCP in chat</span>
          </Button>

          {/* Create MCP with CLI option */}
          <Button
            variant="outline"
            className="flex-1 h-auto p-6 flex flex-col items-center gap-3 hover:bg-accent relative"
            onClick={() => {
              // TODO: Navigate to CLI instructions
              console.log("Create MCP with CLI");
            }}
          >
            <Icon name="terminal" size={32} className="text-primary" />
            <span className="text-sm font-medium">Create MCP with CLI</span>
            
            {/* CLI command at the bottom of the card */}
            <div className="mt-3 p-2 bg-muted rounded-md w-full">
              <code className="text-xs text-muted-foreground">
                npm i -g deco-cli
              </code>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
