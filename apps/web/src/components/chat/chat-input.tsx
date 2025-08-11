import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
  useMemo,
} from "react";

import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { AudioButton } from "./audio-button.tsx";
import { ContextResources, UploadedFile } from "./context-resources.tsx";
import { useAgent } from "../agent/provider.tsx";
import { ModelSelector } from "./model-selector.tsx";
import { RichTextArea } from "./rich-text.tsx";
import ToolsButton from "./tools-button.tsx";

export function ChatInput({ disabled }: { disabled?: boolean } = {}) {
  const { chat, uiOptions } = useAgent();
  const { stop, input, handleInputChange, handleSubmit, status } = chat;
  const { showModelSelector, showThreadTools } = uiOptions;
  const isLoading = status === "submitted" || status === "streaming";
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  // Extract URLs from current input
  const extractedUrls = useMemo(() => {
    const urlAttachments: Array<{ name: string; url: string }> = [];
    
    // Regex to match any HTTPS URLs
    const URL_REGEXP = /https:\/\/[^\s]+/gi;
    // Extract URLs from current input
    const urls = input.match(URL_REGEXP);
    
    if (urls) {
      urls.forEach((url) => {

        let fileName = `file-from-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;        
        urlAttachments.push({
          name: fileName,
          url,
        });
      });
    }
    
    return urlAttachments;
  }, [input]);

  const fetchImageAsFileData = async (urlData: { name: string; url: string }) => {
    try {
      const response = await fetch(urlData.url);
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      
      const actualContentType = response.headers.get('content-type');
      
      if (!actualContentType?.startsWith('image/')) {
        return null;
      }
      
      const blob = await response.blob();
      return {
        name: urlData.name,
        contentType: actualContentType,
        url: urlData.url,
        size: blob.size,
      };
    } catch (error) {
      console.error(`Error fetching URL ${urlData.name}:`, error);
      return null;
    }
  };

  const handleRichTextChange = (markdown: string) => {
    handleInputChange({
      target: { value: markdown },
    } as ChangeEvent<HTMLTextAreaElement>);
  };

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
      if (!isLoading && input.trim()) {
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

    // Extract URLs from input and fetch them (only images will be included)
    const urlFileDataPromises = extractedUrls.map(fetchImageAsFileData);
    const imageFileData = (await Promise.all(urlFileDataPromises)).filter(Boolean);

    const doneFiles = uploadedFiles.filter((uf) => uf.status === "done");
    
    // Combine uploaded files and extracted images
    const allFileData = [
      ...doneFiles.map((uf) => ({
        name: uf.file.name,
        contentType: uf.file.type,
        url: uf.url,
        size: uf.file.size,
      })),
      ...imageFileData.filter((item): item is NonNullable<typeof item> => item !== null),
    ];

    if (allFileData.length === 0) {
      handleSubmit(e);
      return;
    }

    const experimentalAttachments = allFileData.map((file) => ({
      name: file.name,
      type: file.contentType,
      contentType: file.contentType,
      size: file.size,
      url: file.url || (doneFiles.find(df => df.file.name === file.name)?.url) || URL.createObjectURL(doneFiles.find(df => df.file.name === file.name)?.file!),
    }));

    handleSubmit(e, {
      experimental_attachments: experimentalAttachments as unknown as FileList,
      // @ts-expect-error not yet on typings
      fileData: allFileData,
    });
    setUploadedFiles([]);
  };

  return (
    <div className="w-full mx-auto">
      <ContextResources
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
      />
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative flex items-center gap-2 pt-0",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        )}
      >
        <div className="w-full">
          <div className="relative rounded-md w-full mx-auto">
            <div className="relative flex flex-col">
              <div
                className="overflow-y-auto relative"
                style={{ maxHeight: "164px" }}
              >
                <RichTextArea
                  value={input}
                  onChange={handleRichTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="border border-b-0 placeholder:text-muted-foreground resize-none focus-visible:ring-0"
                  disabled={isLoading || disabled}
                  allowNewLine={isMobile}
                  enableToolMentions
                />
              </div>

              <div className="flex items-center justify-between h-12 border border-t-0 rounded-b-2xl px-2">
                <div className="flex items-center gap-2">
                  {/* File upload is now handled by ContextResources */}
                </div>
                <div className="flex items-center gap-2">
                  {showModelSelector && (
                    <ModelSelector
                      model={model}
                      onModelChange={(modelToSelect) =>
                        setPreferences({
                          ...preferences,
                          defaultModel: modelToSelect,
                        })
                      }
                    />
                  )}
                  {showThreadTools && <ToolsButton />}
                  <AudioButton onMessage={handleRichTextChange} />
                  <Button
                    type={isLoading ? "button" : "submit"}
                    size="icon"
                    disabled={!isLoading && !input.trim()}
                    onClick={isLoading ? stop : undefined}
                    className="h-8 w-8 transition-all hover:opacity-70"
                    title={
                      isLoading ? "Stop generating" : "Send message (Enter)"
                    }
                  >
                    <Icon filled name={isLoading ? "stop" : "send"} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
