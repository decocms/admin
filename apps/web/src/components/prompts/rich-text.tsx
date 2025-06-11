import { usePrompts } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { Markdown } from "tiptap-markdown";
import suggestion from "./common.ts";

interface RichTextAreaProps {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
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
}: RichTextAreaProps) {
  const { data: prompts } = usePrompts();

  const promptMap = useMemo(() => {
    if (!prompts) return new Map();
    return new Map(prompts.map((prompt) => [prompt.id, prompt.name]));
  }, [prompts]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: true,
        breaks: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "inline-flex items-center rounded-full bg-primary-light/20 transition-colors duration-300 hover:bg-primary-light/70 px-2 font-medium text-black border border-primary-light text-xs",
        },
        suggestion: suggestion(prompts ?? []),
        renderText({ node }) {
          const promptName = promptMap.get(node.attrs.id) || node.attrs.id;
          return `@${promptName}`;
        },
        renderHTML({ node, options: { HTMLAttributes } }) {
          return [
            "span",
            {
              ...HTMLAttributes,
              "data-type": "mention",
              "data-id": node.attrs.id,
            },
            `@${promptMap.get(node.attrs.id) || node.attrs.id}`,
          ];
        },
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown({
        html: true,
      }).replaceAll(
        /<span\s+data-type="mention"[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/g,
        '<span data-type="mention" data-id="$1"></span>',
      );

      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: cn(
          "w-full outline-none min-h-[48px] overflow-y-auto prose",
          disabled && "opacity-100 text-muted-foreground",
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && editor.storage.markdown.getMarkdown() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <EditorContent
      className={className}
      editor={editor}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPaste={onPaste}
    />
  );
}
