import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/atoms/Icon";

export interface MarkdownCopySelectProps {
  markdownPath?: string;
}

export function MarkdownCopySelect({
  markdownPath: _markdownPath,
}: MarkdownCopySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCopyPage = async () => {
    try {
      // Copy the whole markdown page content
      const content = document.getElementById("rendered-content");
      if (content) {
        const markdownText = content.textContent || "";
        await navigator.clipboard.writeText(markdownText);
      }
      setIsOpen(false);
      // You could add a toast notification here
    } catch (err) {
      console.error("Failed to copy page content:", err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(globalThis.location.href);
      setIsOpen(false);
      // You could add a toast notification here
    } catch (err) {
      console.error("Failed to copy page URL:", err);
    }
  };

  const handleOpenInChatGPT = () => {
    const currentUrl = globalThis.location.href;
    const chatGPTUrl = `https://chatgpt.com/?hints=search&q=Read%20from%20${encodeURIComponent(
      currentUrl,
    )}%20so%20I%20can%20ask%20questions%20about%20it.`;
    globalThis.open(chatGPTUrl, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex rounded-lg border border-border">
        {/* Copy page button */}
        <button
          type="button"
          onClick={handleCopyPage}
          className="flex items-center gap-3 px-3 py-2 rounded-l-lg cursor-pointer hover:bg-muted transition-colors"
        >
          <Icon name="Copy" size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground leading-none">
            Copy page
          </span>
        </button>

        {/* Dropdown trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center cursor-pointer justify-center w-8 h-8 border-l border-border rounded-r-lg hover:bg-muted transition-colors"
        >
          <Icon
            name="ChevronDown"
            size={16}
            className="text-muted-foreground"
          />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-app-background border border-border rounded-lg shadow-lg z-10 min-w-[280px]">
          <button
            type="button"
            onClick={handleCopyPage}
            className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors rounded-t-lg"
          >
            <Icon
              name="Copy"
              size={16}
              className="text-muted-foreground mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">
                Copy page
              </div>
              <div className="text-xs text-muted-foreground">
                Copy page as Markdown for LLMs
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors border-t border-border"
          >
            <Icon
              name="Link"
              size={16}
              className="text-muted-foreground mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">
                Copy link
              </div>
              <div className="text-xs text-muted-foreground">
                Copy this page URL
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleOpenInChatGPT}
            className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors border-t border-border rounded-b-lg"
          >
            <Icon
              name="ArrowUpRight"
              size={16}
              className="text-muted-foreground mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">
                Open in ChatGPT
              </div>
              <div className="text-xs text-muted-foreground">
                Ask questions about this page
              </div>
            </div>
          </button>

          {/* Commented out the "View as Markdown" option
          {markdownPath && (
            <button
              type="button"
              onClick={handleViewMarkdown}
              className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted transition-colors border-t border-border rounded-b-lg"
            >
              <Icon
                name="FileText"
                size={16}
                className="text-muted-foreground mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">View as Markdown</div>
                <div className="text-xs text-muted-foreground">View this page as plain text</div>
              </div>
            </button>
          )}
          */}
        </div>
      )}
    </div>
  );
}
