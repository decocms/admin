import { useState } from "react";
import {
  Agent,
  useAgent,
  useCreateTrigger,
  useListTriggersByAgentId,
  useSDK,
  useSendAgentWhatsAppInvite,
  useUpsertWhatsAppUser,
  useWhatsAppUser,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { useProfile } from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { useProfileModal } from "../layout.tsx";
import { WhatsAppInviteDialog } from "./WhatsAppInviteDialog.tsx";

const PHONE_NUMBER = "11920902075";

const getWhatsAppLink = (agent: Agent) => {
  const url = new URL(`https://wa.me/${PHONE_NUMBER}`);

  url.searchParams.set("text", `Hey, is that ${agent.name}?`);

  return url.href;
};

export function WhatsAppButton({ isMobile = false }: { isMobile?: boolean }) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: triggers } = useListTriggersByAgentId(agentId);
  const { mutate: createTrigger } = useCreateTrigger(agentId);
  const { data: profile } = useProfile();
  const { data: whatsappUser } = useWhatsAppUser(profile?.phone ?? "");
  const focusChat = useFocusChat();
  const { openProfileModal } = useProfileModal();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  const { workspace } = useSDK();

  const isDecoTeam = workspace as string === "shared/deco.cx";

  // Find webhook triggers (WhatsApp uses webhook triggers)
  const webhookTriggers =
    triggers?.triggers?.filter((trigger) => trigger.type === "webhook") ?? [];
  const whatsappTrigger =
    webhookTriggers.find((trigger) =>
      whatsappUser?.trigger_id === trigger.id
    ) ?? webhookTriggers[0]; // Use first webhook trigger if no specific WhatsApp trigger found

  const { mutate: upsertWhatsAppUser } = useUpsertWhatsAppUser({
    agentId: agentId,
  });
  const { mutate: sendAgentWhatsAppInvite, isPending: isInvitePending } =
    useSendAgentWhatsAppInvite(agentId, whatsappTrigger?.id ?? "");

  function runWhatsAppIntegration() {
    (!triggers?.triggers || triggers?.triggers.length === 0) && createTrigger(
      {
        title: "WhatsApp Integration",
        description: "A WhatsApp integration for this agent",
        type: "webhook",
        passphrase: crypto.randomUUID(),
      },
    );

    if (!whatsappTrigger?.data.url || !whatsappTrigger?.id) {
      toast.error("No trigger available for WhatsApp integration");
      return;
    }

    upsertWhatsAppUser(
      {
        triggerUrl: whatsappTrigger?.data.url,
        triggerId: whatsappTrigger?.id,
        triggers: [...(whatsappUser?.triggers ?? [])],
      },
      {
        onSuccess: () => {
          toast.success("This agent is now available on WhatsApp.");
          focusChat(agentId, crypto.randomUUID(), {
            history: false,
          });
        },
        onError: (error) => {
          toast.error(`Failed to create temporary agent: ${error.message}`);
        },
      },
    );
  }

  function handleWhatsAppClick() {
    if (!profile?.phone) {
      toast(
        "To enable your agent for WhatsApp use, first register your WhatsApp phone number.",
      );
      openProfileModal(runWhatsAppIntegration);
      return;
    }
    runWhatsAppIntegration();
  }

  function handleInviteClick() {
    setIsInviteDialogOpen(true);
  }

  function handleInviteSubmit(phoneNumber: string) {
    if (!isDecoTeam) {
      toast.error("This feature is only available for the deco.cx team.");
      return;
    }

    if (!whatsappTrigger && webhookTriggers.length === 0) {
      createTrigger(
        {
          title: "WhatsApp Integration",
          description: "WhatsApp integration for this agent",
          type: "webhook",
          passphrase: crypto.randomUUID(),
        },
        {
          onSuccess: () => {
            // Send invite with the newly created trigger
            sendAgentWhatsAppInvite(
              { to: phoneNumber },
              {
                onSuccess: () => {
                  toast.success("WhatsApp invite sent successfully!");
                  setIsInviteDialogOpen(false);
                },
                onError: (error) => {
                  toast.error(`Failed to send invite: ${error.message}`);
                },
              },
            );
          },
          onError: (error) => {
            toast.error(`Failed to create trigger: ${error.message}`);
          },
        },
      );
      return;
    }

    if (!whatsappTrigger) {
      toast.error("No trigger available for WhatsApp integration");
      return;
    }

    sendAgentWhatsAppInvite(
      { to: phoneNumber },
      {
        onSuccess: () => {
          toast.success("WhatsApp invite sent successfully!");
          setIsInviteDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to send invite: ${error.message}`);
        },
      },
    );
  }

  function handleTalkInWhatsApp() {
    if (agent) {
      globalThis.open(getWhatsAppLink(agent), "_blank");
    }
  }

  const isWhatsAppEnabled = whatsappUser?.trigger_id === whatsappTrigger?.id;

  if (isWellKnownAgent) {
    return;
  }

  const buttonContent = (
    <Button
      variant="ghost"
      size="icon"
      onClick={isWhatsAppEnabled
        ? () => globalThis.open(getWhatsAppLink(agent), "_blank")
        : handleWhatsAppClick}
      className={isMobile ? "w-full justify-center gap-4" : ""}
    >
      <img
        src="/img/zap.svg"
        className={isMobile ? "w-[14px] h-[14px] ml-[-6px]" : "w-4 h-4"} // xd
      />
      <span className={cn(isMobile ? "text-sm" : "text-base", "font-normal")}>
        {!isMobile ? "" : isWhatsAppEnabled ? "Start chat" : "Enable WhatsApp"}
      </span>
    </Button>
  );

  // For mobile, return the button without tooltip
  if (isMobile) {
    return buttonContent;
  }

  // For desktop, wrap with tooltip
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <img src="/img/zap.svg" className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isWhatsAppEnabled
                ? (
                  <DropdownMenuItem onClick={handleTalkInWhatsApp}>
                    Talk in WhatsApp
                  </DropdownMenuItem>
                )
                : (
                  <DropdownMenuItem onClick={handleWhatsAppClick}>
                    Use in WhatsApp
                  </DropdownMenuItem>
                )}
              {isDecoTeam &&
                (
                  <DropdownMenuItem onClick={handleInviteClick}>
                    Invite
                  </DropdownMenuItem>
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          WhatsApp Options
        </TooltipContent>
      </Tooltip>

      <WhatsAppInviteDialog
        isOpen={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSubmit={handleInviteSubmit}
        isLoading={isInvitePending}
      />
    </>
  );
}
