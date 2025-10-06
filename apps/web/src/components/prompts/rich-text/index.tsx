import { usePrompts } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import BubbleMenu from "./bubble-menu.tsx";
import { mentionToTag, removeMarkdownCodeBlock, sanitizeMarkdown } from "./common.ts";
import { Comment } from "./extensions/comment.tsx";
import { mentions } from "./extensions/mentions/mentions.ts";

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onKeyUp?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onPaste?: (
    event: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  enableMentions?: boolean;
  hideMentionsLabel?: boolean;
  excludeIds?: string[];
}

export default function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
  enableMentions = false,
  hideMentionsLabel = false,
  excludeIds = [],
}: Props) {
  const hadUserInteraction = useRef(false);
  const { data: prompts } = usePrompts({ excludeIds });

  const extensions = useMemo(() => {
    const extensions: Extensions = [
      StarterKit,
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
      Comment,
    ];

    if (enableMentions) {
      extensions.push(mentions(prompts ?? []));
    }

    return extensions;
  }, [enableMentions, placeholder, prompts]);

  const editor = useEditor(
    {
      extensions,
      content: mentionToTag(sanitizeMarkdown(removeMarkdownCodeBlock(value)), true),
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown();

        if (!hadUserInteraction.current && editor.isFocused) {
          hadUserInteraction.current = true;
        }

        if (hadUserInteraction.current) {
          onChange(markdown);
        }
      },
      editorProps: {
        attributes: {
          class: cn(
            "h-full placeholder:text-muted-foreground field-sizing-content w-full bg-transparent text-base transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 prose whitespace-pre-wrap break-words wrap-anywhere",
            className,
          ),
        },
      },
    },
    [prompts],
  );

  // Sync editor content with value prop changes
  useEffect(() => {
    if (!editor) return;

    const processedValue = mentionToTag(sanitizeMarkdown(removeMarkdownCodeBlock(value)), true);
    const currentContent = editor.storage.markdown.getMarkdown();

    // Only update if the content is actually different to avoid infinite loops
    if (processedValue !== currentContent) {
      // Temporarily disable user interaction tracking to prevent onChange from firing
      const wasUserInteraction = hadUserInteraction.current;
      hadUserInteraction.current = false;

      try {
        editor.commands.setContent(processedValue, false, {
          preserveWhitespace: "full",
        });
      } catch (error) {
        // If content setting still fails after sanitization, log and use empty content
        console.error("Failed to set editor content after sanitization:", error);
        editor.commands.setContent("", false, {
          preserveWhitespace: "full",
        });
      }

      // Restore user interaction state
      hadUserInteraction.current = wasUserInteraction;
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="h-full flex flex-col">
      {enableMentions && !hideMentionsLabel && (
        <div className="rounded-full flex gap-1 bg-muted text-muted-foreground w-fit items-center px-1.5 py-0.5 mb-2.5 select-none">
          <Icon name="info" size={10} />
          <p className="text-xs font-medium">Type / to add tools and more</p>
        </div>
      )}
      <BubbleMenu editor={editor} />
      <EditorContent
        className="h-full"
        editor={editor}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
      />
    </div>
  );
}
