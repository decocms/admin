import { Button } from "@deco/ui/components/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  useCreateTempAgent,
  useCreateTrigger,
  useListTriggersByAgentId,
} from "@deco/sdk";
import { useUser } from "../../hooks/data/useUser.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { useProfile } from "@deco/sdk/hooks";
import { useProfileModal } from "../layout.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useTempWppAgent } from "@deco/sdk/hooks";

const WHATSAPP_LINK = "https://wa.me/11920902075?text=Hi!";

export function WhatsAppButton() {
  const { agentId } = useChatContext();
  const { data: triggers } = useListTriggersByAgentId(agentId);
  const { mutate: createTrigger } = useCreateTrigger(agentId);
  const { mutate: createTempAgent } = useCreateTempAgent();
  const user = useUser();
  const focusChat = useFocusChat();
  const { data: profile } = useProfile();
  const { openProfileModal } = useProfileModal();
  const { data: tempWppAgent } = useTempWppAgent(user.id);

  const whatsappTrigger = triggers?.triggers.find(
    (trigger) =>
      trigger.data.type === "webhook" &&
      // deno-lint-ignore no-explicit-any
      (trigger.data as any).whatsappEnabled,
  );

  function runWhatsAppIntegration() {
    !whatsappTrigger && createTrigger(
      {
        title: "WhatsApp Integration",
        description: "WhatsApp integration for this agent",
        type: "webhook",
        passphrase: crypto.randomUUID(),
        whatsappEnabled: true,
      },
    );

    createTempAgent(
      { agentId, userId: user.id },
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

  // Show WhatsApp link if this agent is the temp agent and has a WhatsApp-enabled trigger
  if (
    tempWppAgent?.agent_id === agentId &&
    whatsappTrigger
  ) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={WHATSAPP_LINK} target="_blank">
            <Button variant="ghost" size="icon">
              <img src="/img/zap.svg" className="w-4 h-4" />
            </Button>
          </a>
        </TooltipTrigger>
        <TooltipContent>
          Talk in WhatsApp
        </TooltipContent>
      </Tooltip>
    );
  }

  // Otherwise, show enable button
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={handleWhatsAppClick}>
          <img src="/img/zap.svg" className="w-4 h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Enable WhatsApp
      </TooltipContent>
    </Tooltip>
  );
}
