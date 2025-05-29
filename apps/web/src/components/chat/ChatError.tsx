import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useEffect } from "react";
import { Link } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useChatContext } from "./context.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useState } from "react";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";
import { Protect } from "../wallet/plan.tsx";
import { useContactUsUrl } from "../../hooks/useContactUs.ts";

const WELL_KNOWN_ERROR_MESSAGES = {
  InsufficientFunds: "Insufficient funds",
};

export function ChatError() {
  const workspaceLink = useWorkspaceLink();
  const { chat: { error }, retry, correlationIdRef } = useChatContext();
  const insufficientFunds = error?.message.includes(
    WELL_KNOWN_ERROR_MESSAGES.InsufficientFunds,
  );
  const contactUsUrl = useContactUsUrl();

  useEffect(() => {
    if (insufficientFunds) {
      trackEvent("chat_error_insufficient_funds", {
        error,
      });
    }
  }, [insufficientFunds, error]);

  const [copied, setCopied] = useState(false);

  if (!error) {
    return null;
  }

  if (insufficientFunds) {
    return (
      <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
        <div className="flex w-full justify-between p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
          <div className="flex items-center gap-4">
            <Icon name="info" />
            <div className="flex flex-col">
              <p>Insufficient funds</p>
              <Protect
                feature="ai-wallet-deposit"
                fallback={
                  <p className="text-xs text-foreground pr-2">
                    This workspace has reached its usage limit. Upgrade your
                    plan to continue using AI.
                  </p>
                }
              >
                <p className="text-xs text-foreground pr-2">
                  Your workspace wallet has reached its limit. Add more funds to
                  continue using AI.
                </p>
              </Protect>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Protect
              feature="ai-wallet-deposit"
              fallback={
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
                  asChild
                >
                  <Link to={contactUsUrl}>
                    <Icon name="mail" className="mr-2" />
                    Contact Us
                  </Link>
                </Button>
              }
            >
              <Button
                size="sm"
                variant="secondary"
                className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
                asChild
              >
                <Link to={workspaceLink("/settings")}>
                  <Icon name="wallet" className="mr-2" />
                  Add credits
                </Link>
              </Button>
            </Protect>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
      <div className="flex items-center gap-4 p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
        <Icon name="info" size={20} />
        <div className="flex flex-col">
          <p>An error occurred while generating the response.</p>
          {correlationIdRef?.current && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="select-none">
                Error Id:
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="font-mono select-all cursor-pointer hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(correlationIdRef.current!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    tabIndex={0}
                    role="button"
                    aria-label="Copy Error Id"
                  >
                    {correlationIdRef.current}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {copied ? "Copied!" : "Copy"}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
            onClick={() => {
              retry([
                JSON.stringify({
                  type: "error",
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }),
                "The previous attempt resulted in an error. I'll try to address the error and provide a better response.",
              ]);
            }}
          >
            <Icon name="refresh" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
