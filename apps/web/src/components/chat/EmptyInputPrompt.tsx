import React, { useState } from "react";
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
      className="text-xs md:text-sm bg-[#09381A] hover:bg-[#0D4A22] cursor-pointer border-slate-200 text-[#C6EA33] h-[136px] rounded-l-lg rounded-tr-lg  p-4 flex flex-col gap-2 transition-all duration-100 hover:shadow-md w-[245px] "
    >
      <Icon name={icon} className="text-[#C6EA33] text-2xl" />
      <p className="max-h-20 overflow-hidden">
        {text}
      </p>
    </div>
  );
}

export function EmptyInputPrompt() {
  const [hasClicked, setHasClicked] = useState(false);
  const { chat } = useChatContext();

  const handleSuggestionClick = (text: string) => {
    chat.handleInputChange(
      { target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>,
    );
  };

  return (
    <>
      {!hasClicked && (
        <div className="w-full max-w-[755px] mx-auto pb-2 flex justify-center items-center">
          <div className="flex  gap-2 overflow-x-auto  pb-4 w-full px-4 md:px-0 scrollbar-hide justify-start items-start">
            <Suggestion
              text="You're a friendly assistant that helps users plan trips on a budget."
              onClick={() => {
                handleSuggestionClick(
                  "You're a friendly assistant that helps users plan trips on a budget.",
                );
                setHasClicked(true);
              }}
              icon="trip"
            />
            <Suggestion
              text="Act like a professional sommelier who recommends wine pairings."
              onClick={() => {
                handleSuggestionClick(
                  "Act like a professional sommelier who recommends wine pairings.",
                );
                setHasClicked(true);
              }}
              icon="wine_bar"
            />
            <Suggestion
              text="You're a sarcastic but helpful coding mentor."
              onClick={() => {
                handleSuggestionClick(
                  "You're a sarcastic but helpful coding mentor.",
                );
                setHasClicked(true);
              }}
              icon="code"
            />
          </div>
        </div>
      )}
    </>
  );
}
