import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { UIMessage } from "@ai-sdk/react";
import { useFileUpload } from "../../hooks/use-file-upload.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useAgent } from "../agent/provider.tsx";
import { AudioButton } from "./audio-button.tsx";
import { ContextResources } from "./context-resources.tsx";
import { ModelSelector } from "./model-selector.tsx";
import { RichTextArea } from "./rich-text.tsx";

export function ChatInput({
  disabled,
  rightNode,
}: {
  disabled?: boolean;
  rightNode?: ReactNode;
} = {}) {
  const { chat, uiOptions, input, setInput, isLoading, setIsLoading } =
    useAgent();
  const { stop, sendMessage } = chat;
  const { showModelSelector, showContextResources } = uiOptions;
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  // Use ref to avoid recreating callback on every preferences change
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const {
    uploadedFiles,
    isDragging,
    fileInputRef,
    handleFileChange,
    removeFile,
    openFileDialog,
    clearFiles,
  } = useFileUpload({ maxFiles: 5 });

  // TODO(@viktormarinho): Bring this back
  const enableFileUpload = false;

  const canSubmit =
    !isLoading &&
    input?.trim() &&
    !uploadedFiles.some((uf) => uf.status === "uploading");

  const handleRichTextChange = (markdown: string) => {
    setInput(markdown);
  };

  const handleModelChange = useCallback(
    (modelToSelect: string) => {
      setPreferences({
        ...preferencesRef.current,
        defaultModel: modelToSelect,
      });
    },
    [setPreferences],
  );

  // Auto-focus when loading state changes from true to false
  useEffect(() => {
    if (!isLoading) {
      const editor = document.querySelector(".ProseMirror") as HTMLElement;
      if (editor) {
        editor.focus();
      }
    }
  }, [isLoading]);

  const isMobile =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.userAgent.toLowerCase().includes("mobile"));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      if (canSubmit) {
        e.preventDefault();
        const formEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        });
        e.currentTarget.closest("form")?.dispatchEvent(formEvent);
      }
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    setIsLoading(true);

    try {
      const doneFiles = uploadedFiles.filter((uf) => uf.status === "done");

      // Prepare message with attachments if any
      const message: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          {
            type: "text",
            text: input,
          },
        ],
      };

      if (doneFiles.length > 0) {
        // Add file attachments as parts
        const fileParts = doneFiles.map((uf) => ({
          type: "file" as const,
          name: uf.file.name,
          contentType: uf.file.type,
          mediaType: uf.file.type,
          size: uf.file.size,
          url: uf.url || URL.createObjectURL(uf.file),
        }));

        message.parts.push(...fileParts);
      }

      await sendMessage(message);
      setInput("");
      clearFiles();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto">
      {showContextResources && (
        <ContextResources
          uploadedFiles={uploadedFiles}
          isDragging={isDragging}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          removeFile={removeFile}
          openFileDialog={openFileDialog}
          enableFileUpload={enableFileUpload}
          rightNode={rightNode}
        />
      )}
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        )}
      >
        <div className="w-full">
          <div className="relative rounded-xl border border-border bg-background w-full mx-auto">
            <div className="relative flex flex-col gap-4 p-2.5">
              {/* Input Area */}
              <div
                className="overflow-y-auto relative"
                style={{ maxHeight: "164px" }}
              >
                <RichTextArea
                  value={input}
                  onChange={handleRichTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything or @ for context"
                  className="placeholder:text-muted-foreground resize-none focus-visible:ring-0 border-0 p-2 text-sm min-h-[20px] rounded-none"
                  disabled={isLoading || disabled}
                  allowNewLine={isMobile}
                  enableToolMentions
                />
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={openFileDialog}
                    className="flex size-8 items-center justify-center rounded-full p-1 hover:bg-accent transition-colors"
                    title="Add context"
                  >
                    <Icon name="add" size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {showModelSelector && (
                    <ModelSelector
                      model={model}
                      onModelChange={handleModelChange}
                    />
                  )}
                  <AudioButton onMessage={handleRichTextChange} />
                  <button
                    type={isLoading ? "button" : "submit"}
                    disabled={isLoading ? false : !canSubmit}
                    onClick={
                      isLoading
                        ? () => {
                            stop();
                            setIsLoading(false);
                          }
                        : undefined
                    }
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full p-1 transition-all hover:opacity-70",
                      !isLoading && !canSubmit && "bg-muted",
                    )}
                    title={
                      isLoading ? "Stop generating" : "Send message (Enter)"
                    }
                  >
                    <Icon
                      name={isLoading ? "stop" : "arrow_upward"}
                      size={20}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
