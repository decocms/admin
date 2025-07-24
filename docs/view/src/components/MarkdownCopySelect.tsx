import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export interface MarkdownCopySelectProps {
  markdownPath?: string;
}

export function MarkdownCopySelect({ markdownPath }: MarkdownCopySelectProps) {
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
      await navigator.clipboard.writeText(globalThis.location.href);
      setIsOpen(false);
      // You could add a toast notification here
    } catch (err) {
      console.error("Failed to copy page URL:", err);
    }
  };

  const handleViewMarkdown = () => {
    if (markdownPath) {
      // Open the markdown file in a new tab
      globalThis.open(markdownPath, "_blank");
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex rounded-lg border border-stone-200">
        {/* Copy page button */}
        <button
          type="button"
          onClick={handleCopyPage}
          className="flex items-center gap-3 px-3 py-2 rounded-l-lg hover:bg-stone-50 transition-colors"
        >
          <Icon name="Copy" size={16} className="text-stone-500" />
          <span className="text-sm text-stone-500 leading-none">Copy page</span>
        </button>

        {/* Dropdown trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-8 h-8 border-l border-stone-200 rounded-r-lg hover:bg-stone-50 transition-colors"
        >
          <Icon name="ChevronDown" size={16} className="text-stone-500" />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 min-w-[140px]">
          <button
            type="button"
            onClick={handleCopyPage}
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-stone-50 transition-colors rounded-t-lg"
          >
            <Icon name="Copy" size={16} className="text-stone-500" />
            <span className="text-sm text-stone-500">Copy page</span>
          </button>

          {markdownPath && (
            <button
              type="button"
              onClick={handleViewMarkdown}
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-stone-50 transition-colors rounded-b-lg border-t border-stone-100"
            >
              <Icon name="FileText" size={16} className="text-stone-500" />
              <span className="text-sm text-stone-500">View as markdown</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
