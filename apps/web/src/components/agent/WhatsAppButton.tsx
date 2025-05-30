import {
  Agent,
  useAgent,
  useCreateTempAgent,
  useCreateTrigger,
  useListTriggersByAgentId,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { useProfile, useTempWppAgent } from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { useChatContext } from "../chat/context.tsx";
import { useProfileModal } from "../layout.tsx";

const getWhatsAppLink = (agent: Agent) => {
  const url = new URL("https://wa.me/11920902075");

  url.searchParams.set("text", `Hey, is that ${agent.name}?`);

  return url.href;
};

interface WhatsAppButtonProps {
  isMobile?: boolean;
}

export function WhatsAppButton({ isMobile = false }: WhatsAppButtonProps) {
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: triggers } = useListTriggersByAgentId(agentId);
  const { mutate: createTrigger } = useCreateTrigger(agentId);
  const { mutate: createTempAgent } = useCreateTempAgent();
  const user = useUser();
  const focusChat = useFocusChat();
  const { data: profile } = useProfile();
  const { openProfileModal } = useProfileModal();
  const { data: tempWppAgent } = useTempWppAgent(user.id);

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

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

  const enabled = tempWppAgent?.agent_id === agentId && whatsappTrigger;

  if (isWellKnownAgent) {
    return;
  }

  const buttonContent = (
    <Button
      variant="ghost"
      size="icon"
      onClick={enabled
        ? () => globalThis.open(getWhatsAppLink(agent), "_blank")
        : handleWhatsAppClick}
      className={isMobile ? "w-full justify-center gap-4" : ""}
    >
      <img
        src="/img/zap.svg"
        className={isMobile ? "w-[14px] h-[14px] ml-[-6px]" : "w-4 h-4"} // xd
      />
      {isMobile && (
        <span className={cn("text-sm font-normal")}>
          {enabled ? "Start chat" : "Enable WhatsApp"}
        </span>
      )}
    </Button>
  );

  // For mobile, return the button without tooltip
  if (isMobile) {
    return buttonContent;
  }

  // For desktop, wrap with tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {buttonContent}
      </TooltipTrigger>
      <TooltipContent>
        Enable WhatsApp
      </TooltipContent>
    </Tooltip>
  );
}
