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
import { useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { useProfileModal } from "../layout.tsx";
import { WhatsAppInviteDialog } from "./WhatsAppInviteDialog.tsx";

const getWhatsAppLink = (agent: Agent) => {
  const url = new URL("https://wa.me/11920902075");

  url.searchParams.set("text", `Hey, is that ${agent.name}?`);

  return url.href;
};

export function WhatsAppButton() {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: triggers } = useListTriggersByAgentId(agentId);
  const { mutate: createTrigger } = useCreateTrigger(agentId);
  const { data: profile } = useProfile();
  const { data: whatsappUser } = useWhatsAppUser(profile?.phone ?? "");
  const focusChat = useFocusChat();
  const { openProfileModal } = useProfileModal();
  const { workspace } = useSDK();

  // Find webhook triggers (WhatsApp uses webhook triggers)
  const webhookTriggers =
    triggers?.triggers?.filter((trigger) => trigger.type === "webhook") ?? [];
  const whatsappTrigger =
    webhookTriggers.find((trigger) =>
      whatsappUser?.trigger_id === trigger.id
    ) ?? webhookTriggers[0]; // Use first webhook trigger if no specific WhatsApp trigger found

  const { mutate: upsertWhatsAppUser } = useUpsertWhatsAppUser({
    phone: profile?.phone ?? "",
    triggerUrl: whatsappTrigger?.data.url ?? "",
    triggerId: whatsappTrigger?.id ?? "",
    triggers: [...(whatsappUser?.triggers ?? []), whatsappTrigger?.id],
    workspace: workspace,
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

    upsertWhatsAppUser(
      undefined,
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

  function handleInviteSubmit(phoneNumber: string, selectedTriggerId?: string) {
    // If no trigger is selected and no triggers exist, create one first
    if (!selectedTriggerId && webhookTriggers.length === 0) {
      createTrigger(
        {
          title: "WhatsApp Integration",
          description: "WhatsApp integration for this agent",
          type: "webhook",
          passphrase: crypto.randomUUID(),
        },
        {
          onSuccess: (_newTrigger) => {
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

    // Use selected trigger or default to first available
    const triggerToUse = selectedTriggerId || webhookTriggers[0]?.id;
    if (!triggerToUse) {
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
              <DropdownMenuItem onClick={handleInviteClick}>
                Invite
              </DropdownMenuItem>
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
        triggers={webhookTriggers}
      />
    </>
  );
}

//   const enabled = tempWppAgent?.agent_id === agentId && whatsappTrigger;

//   const buttonContent = (
//     <Button
//       variant="ghost"
//       size="icon"
//       onClick={enabled
//         ? () => globalThis.open(getWhatsAppLink(agent), "_blank")
//         : handleWhatsAppClick}
//       className={isMobile ? "w-full justify-center gap-4" : ""}
//     >
//       <img
//         src="/img/zap.svg"
//         className={isMobile ? "w-[14px] h-[14px] ml-[-6px]" : "w-4 h-4"} // xd
//       />
//       <span className={cn(isMobile ? "text-sm" : "text-base", "font-normal")}>
//         {!isMobile ? "" : enabled ? "Start chat" : "Enable WhatsApp"}
//       </span>
//     </Button>
//   );

//   // For mobile, return the button without tooltip
//   if (isMobile) {
//     return buttonContent;
//   }

//   // For desktop, wrap with tooltip
//   return (
//     <Tooltip>
//       <TooltipTrigger asChild>
//         {buttonContent}
//       </TooltipTrigger>
//       <TooltipContent>
//         Enable WhatsApp
//       </TooltipContent>
//     </Tooltip>
//   );
// }
