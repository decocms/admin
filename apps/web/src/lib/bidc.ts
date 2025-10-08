import { createChannel } from "bidc";
import { useEffect, useRef } from "react";
import * as z from "zod";

export const useBidcOnIframe = <T extends z.ZodTypeAny>({
  iframeIdOrElement,
  messageSchema,
  onMessage,
}: {
  iframeIdOrElement: string | HTMLIFrameElement;
  messageSchema: T;
  onMessage: (message: z.infer<T>) => void;
}) => {
  const channelRef = useRef<ReturnType<typeof createChannel>>(null);

  useEffect(() => {
    const iframe =
      typeof iframeIdOrElement === "string"
        ? (document.getElementById(iframeIdOrElement) as HTMLIFrameElement)
        : iframeIdOrElement;

    if (!iframe || !iframe.contentWindow) {
      console.warn("No iframe or content window found");
      return;
    }

    const channel = createChannel(iframe.contentWindow);
    channelRef.current = channel;

    const { receive, cleanup } = channel;

    receive((message) => {
      const parsed = messageSchema.safeParse(message);
      if (!parsed.success) {
        console.warn("Invalid message", message);
        return;
      }
      onMessage(message);
    });

    return () => {
      cleanup();
    };
  }, []);

  return channelRef.current;
};
