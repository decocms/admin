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

const WHATSAPP_LINK = "https://wa.me/11920902075?text=Hi!";

export function WhatsAppButton() {
  const { agentId } = useChatContext();
  const { data: triggers } = useListTriggersByAgentId(agentId);
  const { mutate: createTrigger } = useCreateTrigger(agentId);
  const { mutate: createTempAgent } = useCreateTempAgent();
  const user = useUser();
  const focusChat = useFocusChat();

  const whatsappTrigger = triggers?.triggers.find(
    (trigger) =>
      trigger.data.type === "webhook" &&
      // deno-lint-ignore no-explicit-any
      (trigger.data as any).whatsappEnabled,
  );

  const handleWhatsAppClick = () => {
    const audio = new Audio("/holy-melody.mp3");
    audio.play();

    createTrigger(
      {
        title: "WhatsApp Integration",
        description: "WhatsApp integration for this agent",
        type: "webhook",
        passphrase: crypto.randomUUID(),
        whatsappEnabled: true,
      },
      {
        onSuccess: () => {
          createTempAgent(
            { agentId, userId: user.id },
            {
              onSuccess: () => {
                alert("This agent is now available on WhatsApp.");
                focusChat(agentId, crypto.randomUUID(), {
                  history: false,
                });
              },
              onError: (error) => {
                alert(`Failed to create temporary agent: ${error.message}`);
              },
            },
          );
        },
        onError: (error) => {
          if (
            error.message.includes(
              "Only one WhatsApp-enabled trigger is allowed per agent",
            )
          ) {
            createTempAgent(
              { agentId, userId: user.id },
              {
                onSuccess: () => {
                  alert("This agent is now available on WhatsApp.");
                  focusChat(agentId, crypto.randomUUID(), {
                    history: false,
                  });
                },
                onError: (tempAgentError) => {
                  alert(
                    `Failed to create temporary agent: ${tempAgentError.message}`,
                  );
                },
              },
            );
          } else {
            alert(`Failed to create WhatsApp integration: ${error.message}`);
          }
        },
      },
    );
  };

  if (whatsappTrigger) {
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
