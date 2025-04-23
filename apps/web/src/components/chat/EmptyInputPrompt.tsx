import React from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useChatContext } from "./context.tsx";

interface SuggestionProps {
  text: string;
  onClick: () => void;
  icon: string;
}

function Suggestion({ text, onClick, icon }: SuggestionProps) {
  return (
    <div
      onClick={onClick}
      className="text-xs md:text-sm bg-[#09381A] hover:bg-[#0D4A22] cursor-pointer border-slate-200 text-[#C6EA33] h-[136px] rounded-l-lg rounded-tr-lg max-w-[245px] p-4 flex flex-col gap-2 transition-all duration-100 hover:scale-[1.02] hover:shadow-md flex-shrink-0 md:flex-shrink"
    >
      <Icon name={icon} className="text-[#C6EA33] text-2xl" />
      {text}
    </div>
  );
}

export function EmptyInputPrompt() {
  const { chat } = useChatContext();

  const handleSuggestionClick = (text: string) => {
    chat.handleInputChange(
      { target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>,
    );
  };

  return (
    <div className="w-full max-w-[752px] mx-auto pb-2 flex justify-center items-center">
      <div className="flex md:flex-wrap gap-2 overflow-x-auto md:overflow-x-visible pb-4 w-full px-4 md:px-0 scrollbar-hide md:justify-center md:items-center justify-start items-start">
        <Suggestion
          text="You're a friendly assistant that helps users plan trips on a budget."
          onClick={() =>
            handleSuggestionClick(
              "You're a friendly assistant that helps users plan trips on a budget.",
            )}
          icon="trip"
        />
        <Suggestion
          text="Act like a professional sommelier who recommends wine pairings."
          onClick={() =>
            handleSuggestionClick(
              "Act like a professional sommelier who recommends wine pairings.",
            )}
          icon="wine_bar"
        />
        <Suggestion
          text="You're a sarcastic but helpful coding mentor."
          onClick={() =>
            handleSuggestionClick(
              "You're a sarcastic but helpful coding mentor.",
            )}
          icon="code"
        />
      </div>
    </div>
  );
}
