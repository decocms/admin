import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectMCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VENDORS = [
  { value: "external", label: "External" },
  { value: "deco", label: "@deco" },
  { value: "vtex", label: "@vtex" },
  { value: "anthropic", label: "@anthropic" },
  { value: "openai", label: "@openai" },
];

export function ConnectMCPDialog({ open, onOpenChange }: ConnectMCPDialogProps) {
  const [url, setUrl] = useState("");
  const [vendor, setVendor] = useState("external");
  const [isValidating, setIsValidating] = useState(false);

  const isValidUrl = (str: string) => {
    try {
      const parsed = new URL(str);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  function handleConnect() {
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid HTTP/HTTPS URL");
      return;
    }

    setIsValidating(true);
    
    // Mock validation delay
    setTimeout(() => {
      setIsValidating(false);
      toast.success(`MCP connection to ${url} will be configured (mock)`);
      onOpenChange(false);
      setUrl("");
      setVendor("external");
    }, 800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Connect External MCP</DialogTitle>
          <DialogDescription>
            Enter the URL of an MCP server to connect. We'll validate the endpoint and configure access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="mcp-url">MCP Server URL</Label>
            <Input
              id="mcp-url"
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConnect();
                }
              }}
              aria-label="MCP Server URL"
              aria-required="true"
            />
            <p className="text-xs text-muted-foreground">
              The URL should point to an MCP-compatible server endpoint
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger id="vendor">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {VENDORS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Helps categorize and display the connection
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setUrl("");
              setVendor("external");
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isValidating}>
            {isValidating ? "Validating..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

