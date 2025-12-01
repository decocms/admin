import { createChannel } from "bidc";
import { useEffect, useRef } from "react";
import * as z from "zod/v3";

function useBidcChannel<T extends z.ZodTypeAny>({
  createChannelFn,
  messageSchema,
  onMessage,
}: {
  createChannelFn: () => ReturnType<typeof createChannel> | undefined;
  messageSchema: T;
  onMessage: (message: z.infer<T>) => void;
}) {
  const channelRef = useRef<ReturnType<typeof createChannel>>(null);

  useEffect(() => {
    const channel = createChannelFn();
    if (!channel) return;

    channelRef.current = channel;

    const { receive, cleanup } = channel;

    receive((message) => {
      const parsed = messageSchema.safeParse(message);
      if (!parsed.success) {
        console.warn("Invalid message", message);
        return;
      }
      onMessage(parsed.data);
    });

    return () => {
      cleanup();
    };
  }, []);

  return channelRef.current;
}

export const useBidcOnIframe = <T extends z.ZodTypeAny>({
  iframeIdOrElement,
  messageSchema,
  onMessage,
}: {
  iframeIdOrElement: string | HTMLIFrameElement;
  messageSchema: T;
  onMessage: (message: z.infer<T>) => void;
}) => {
  const channel = useBidcChannel({
    createChannelFn: () => {
      const iframe =
        typeof iframeIdOrElement === "string"
          ? (document.getElementById(iframeIdOrElement) as HTMLIFrameElement)
          : iframeIdOrElement;

      if (!iframe || !iframe.contentWindow) {
        console.warn("No iframe or content window found");
        return;
      }

      return createChannel(iframe.contentWindow);
    },
    messageSchema,
    onMessage,
  });

  return channel;
};

export const useBidcForTopWindow = <T extends z.ZodTypeAny>({
  messageSchema,
  onMessage,
}: {
  messageSchema: T;
  onMessage: (message: z.infer<T>) => void;
}) => {
  const channel = useBidcChannel({
    createChannelFn: () => {
      try {
        return createChannel();
      } catch (error) {
        console.error("Error creating channel for top window", error);
        return undefined;
      }
    },
    messageSchema,
    onMessage,
  });

  return channel;
};
