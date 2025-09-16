import { type Integration, useIntegrations } from "@deco/sdk";
import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";
import { cn } from "@deco/ui/lib/utils.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { Markdown } from "tiptap-markdown";
import { NoNewLine } from "./extensions/no-new-line.ts";
import { toolMentions } from "./extensions/tool-mention.ts";
import { useAgent } from "../agent/provider.tsx";

export interface Mention {
  id: string;
  type: string;
  content?: string;
  label?: string;
  title?: string;
  models?: Array<{
    model: string;
    instructions: string;
  }>;
  selectedModel?: string;
}

// Extend Integration type to include tools
type IntegrationWithTools = Integration & {
  tools?: Array<{ name: string; description?: string }>;
};

// Tool interface for flattened tools
export interface Tool {
  id: string;
  name: string;
  description?: string;
  integration: {
    id: string;
    name: string;
    icon?: string;
  };
}

interface RichTextAreaProps {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  allowNewLine?: boolean;
  enableToolMentions?: boolean;
}

export function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
  allowNewLine = false,
  enableToolMentions = false,
}: RichTextAreaProps) {
  const { isPublic } = useAgent();
  const { data: integrations = [] } = useIntegrations({ isPublic });

  // Flatten tools from all integrations
  const tools: Tool[] = useMemo(() => {
    return (integrations as IntegrationWithTools[])
      .filter(
        (integration) =>
          integration.tools &&
          Array.isArray(integration.tools) &&
          integration.tools.length > 0,
      )
      .flatMap((integration) =>
        integration.tools!.map(
          (tool: { name: string; description?: string }) => ({
            id: `${integration.id}-${tool.name}`,
            name: tool.name,
            description: tool.description,
            integration: {
              id: integration.id,
              name: integration.name,
              icon: integration.icon,
            },
          }),
        ),
      );
  }, [integrations]);

  const resourceSearchers = useMemo(() => {
    const SEARCH_TOOL_RE = /^DECO_CHAT_RESOURCES_SEARCH$/;
    return (integrations as IntegrationWithTools[])
      .filter((integration) => {
        const toolsList = integration.tools ?? [];
        // deno-lint-ignore no-explicit-any
        return Binding(WellKnownBindings.Resources as any).isImplementedBy(
          toolsList.map((t) => ({ name: t.name })) as Array<{ name: string }>,
        );
      })
      .map((integration) => {
        const searchToolNames = (integration.tools ?? [])
          .map((t) => t.name)
          .filter((name) => SEARCH_TOOL_RE.test(name));
        return {
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
          connection: (integration as Integration).connection,
          searchToolNames,
        };
      })
      .filter((s) => s.searchToolNames.length > 0);
  }, [integrations]);

  const extensions: Extensions = useMemo(() => {
    const extensions: Extensions = [
      StarterKit,
      Markdown.configure({
        html: true,
      }),
      NoNewLine.configure({
        shouldPreventNewLine: () => !allowNewLine,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
    ];

    if (enableToolMentions) {
      extensions.push(toolMentions({ tools, resourceSearchers }));
    }

    return extensions;
  }, [allowNewLine, placeholder, enableToolMentions, tools, resourceSearchers]);

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown({
        html: true,
      });

      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: cn(
          "w-full outline-none min-h-[48px] max-h-[164px] overflow-y-auto p-4  leading-[1.2] rounded-t-2xl",
          disabled && "opacity-100 text-muted-foreground",
          className,
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
      editor={editor}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPaste={onPaste}
    />
  );
}
