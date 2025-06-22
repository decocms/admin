import { type Prompt, usePrompts } from "@deco/sdk";
import {
  normalizeMentions,
  unescapeHTML,
  weakEscapeHTML,
} from "@deco/sdk/utils";
import { cn } from "@deco/ui/lib/utils.ts";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { Markdown } from "tiptap-markdown";
import { useWorkspaceLink } from "../../../hooks/use-navigate-workspace.ts";
import suggestion from "../common.ts";
import type { PromptInputProps } from "./index.tsx";

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
}: PromptInputProps) {
  const { data: prompts } = usePrompts();
  const withWorkspace = useWorkspaceLink();

  const promptMap = useMemo(() => {
    if (!prompts) return new Map();
    return new Map<string, Prompt>(
      prompts.map((prompt) => [prompt.id, prompt]),
    );
  }, [prompts]);

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
    ];

    if (enableMentions) {
      extensions.push(Mention.configure({
        HTMLAttributes: {
          class:
            "inline-flex items-center rounded-md bg-purple-light/20 transition-colors duration-300 hover:bg-purple-light/70 px-2 py-0.5 font-medium text-black border border-purple-light text-xs group relative text-purple-dark",
        },
        suggestion: suggestion(prompts ?? []),
        renderText({ node }) {
          const promptName = promptMap.get(node.attrs.id) || node.attrs.id;
          return `${promptName}`;
        },
        renderHTML({ node, options: { HTMLAttributes } }) {
          return [
            "span",
            {
              ...HTMLAttributes,
              "data-type": "mention",
              "data-id": node.attrs.id,
            },
            [
              "div",
              {
                class:
                  "group-hover:opacity-100 group-hover:pointer-events-auto pointer-events-none opacity-0 transition-opacity duration-300 absolute top-full left-0 w-56 z-10",
              },
              [
                "div",
                {
                  class: "bg-white rounded-md p-2 shadow-md border mt-2 block",
                },
                [
                  "p",
                  {
                    class: "line-clamp-3",
                  },
                  `${
                    unescapeHTML(
                      promptMap.get(node.attrs.id)?.content ||
                        `Prompt "${node.attrs.id}" not found`,
                    )
                  }`,
                ],
                ...(promptMap.has(node.attrs.id)
                  ? [
                    [
                      "div",
                      {
                        class: "h-px w-full bg-border my-1 block",
                      },
                      "",
                    ],
                    [
                      "a",
                      {
                        class:
                          "text-foreground no-underline text-xs w-full block text-right",
                        // TODO(@vitoUwu): Add a way to open the prompt in a golden layout tab
                        // instead of navigating to it
                        href: withWorkspace(`/prompt/${node.attrs.id}`),
                      },
                      "View Prompt",
                    ],
                  ]
                  : []),
              ],
            ],
            [
              "p",
              {},
              `${promptMap.get(node.attrs.id)?.name || node.attrs.id}`,
            ],
          ];
        },
      }));
    }

    return extensions;
  }, [enableMentions, placeholder, prompts]);

  const editor = useEditor({
    extensions,
    content: normalizeMentions(weakEscapeHTML(value)),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const markdown = normalizeMentions(
        editor.storage.markdown.getMarkdown(),
      );

      onChange(markdown);
    },
    editorProps: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          const normalizedText = normalizeMentions(text);

          if (normalizedText.includes("&lt;")) {
            view.dispatch(
              view.state.tr.insertText(unescapeHTML(normalizedText)),
            );
            return true;
          }

          view.dispatch(view.state.tr.insertText(normalizedText));
          return true;
        }
        return false;
      },
      handleTextInput(view, from, to, text) {
        view.dispatch(
          view.state.tr.insertText(normalizeMentions(text), from, to),
        );
        return true;
      },
      attributes: {
        class: cn(
          "min-h-[25lvh] prose dark:prose-invert max-w-none h-full border-border border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content w-full rounded-xl border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm prose leading-7",
          disabled && "opacity-100 text-muted-foreground",
          className,
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const markdown = normalizeMentions(weakEscapeHTML(
      editor?.storage.markdown.getMarkdown() ?? "",
    ));

    const normalizedValue = normalizeMentions(weakEscapeHTML(value));

    if (markdown !== normalizedValue) {
      editor.commands.setContent(
        normalizedValue,
        false,
        {
          preserveWhitespace: "full",
        },
      );
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <>
      <EditorContent
        editor={editor}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
      />
      {enableMentions && (
        <p className="text-muted-foreground text-xs font-normal mt-2">
          Hint: You can use the <span className="font-bold">/</span>{" "}
          to insert a prompt.
        </p>
      )}
    </>
  );
}
