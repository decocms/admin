import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "../lib/utils.ts";
import {
  DecoChatMessageAssistant,
  DecoChatMessageFooter,
  DecoChatMessageUser,
} from "./deco-chat-message.tsx";

interface DecoChatMessagesProps {
  children: ReactNode;
  className?: string;
  minHeightOffset?: number;
}

export function DecoChatMessages({
  children,
  className,
  minHeightOffset,
}: DecoChatMessagesProps) {
  const [maybeFooter, maybeAssistant, maybeUser, ...rest] =
    Children.toArray(children).toReversed();

  const footer =
    isValidElement(maybeFooter) && maybeFooter.type === DecoChatMessageFooter
      ? maybeFooter
      : null;

  const assistant =
    isValidElement(maybeAssistant) &&
    maybeAssistant.type === DecoChatMessageAssistant
      ? maybeAssistant
      : null;

  const user =
    isValidElement(maybeUser) && maybeUser.type === DecoChatMessageUser
      ? maybeUser
      : null;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-4 min-w-0 max-w-2xl mx-auto w-full py-4">
        {rest.length > 0 && (
          <div className="flex flex-col gap-4">{rest.toReversed()}</div>
        )}

        {assistant && user ? (
          <div
            className="flex flex-col gap-4"
            style={
              minHeightOffset
                ? { minHeight: `calc(100vh - ${minHeightOffset}px)` }
                : undefined
            }
          >
            {user}
            {assistant}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {user}
            {assistant}
          </div>
        )}

        {footer}
      </div>
    </div>
  );
}
