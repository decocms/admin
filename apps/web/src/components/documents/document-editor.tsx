import { cn } from "@deco/ui/lib/utils.ts";
import { createUnifiedMentions } from "../rich-text-editor/extensions/unified-mentions.ts";
import { MentionNode } from "../rich-text-editor/extensions/mention-node.tsx";
import { MentionDropdown } from "../rich-text-editor/components/mention-dropdown.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
// import Underline from "@tiptap/extension-underline"; // TODO: Package hangs on install, add back later
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { Markdown } from "tiptap-markdown";
import { DocumentBubbleMenu } from "./extensions/bubble-menu.tsx";
import { createSlashCommands } from "../editor/slash-commands.tsx";
import type { ProjectLocator } from "@deco/sdk";
import {
  type Integration,
  useIntegrations,
  callTool,
  useIntegration,
} from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

interface DocumentEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  locator: ProjectLocator;
}

const DOCUMENTS_INTEGRATION_ID = "i:documents-management";

export function DocumentEditor({
  value,
  onChange,
  placeholder = "Write, type / for commands or @ for tools...",
  className,
  disabled = false,
  locator,
}: DocumentEditorProps) {
  const { data: integrations = [] } = useIntegrations();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get documents integration for fetching documents
  const documentsIntegration = useIntegration(DOCUMENTS_INTEGRATION_ID).data;

  // Fetch all documents for mentions
  const { data: _documentsData = [] } = useQuery({
    queryKey: ["documents-for-mentions", locator],
    queryFn: async () => {
      if (!documentsIntegration?.connection) return [];
      try {
        const result = (await callTool(documentsIntegration.connection, {
          name: "DECO_RESOURCE_DOCUMENT_SEARCH",
          arguments: {
            term: "",
            page: 1,
            pageSize: 100,
          },
        })) as {
          structuredContent?: {
            items?: Array<{
              uri: string;
              data?: { name: string; description?: string };
            }>;
          };
        };
        return result?.structuredContent?.items ?? [];
      } catch (error) {
        console.error("Failed to fetch documents for mentions:", error);
        return [];
      }
    },
    enabled: Boolean(documentsIntegration?.connection),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Extend Integration type to include tools
  type IntegrationWithTools = Integration & {
    tools?: Array<{ name: string; description?: string }>;
  };

  // Tool interface for flattened tools
  interface Tool {
    id: string;
    name: string;
    description?: string;
    integration: {
      id: string;
      name: string;
      icon?: string;
    };
  }

  // Build tools array from integrations
  const tools: Tool[] = useMemo(() => {
    return (integrations as IntegrationWithTools[])
      .filter(
        (integration) =>
          // Filter out workspace-management to avoid duplicate tools
          integration.id !== "i:workspace-management" &&
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
    // Match DECO_RESOURCE_<NAME>_SEARCH pattern
    const SEARCH_TOOL_RE = /^DECO_RESOURCE_[A-Z_]+_SEARCH$/;
    return (integrations as IntegrationWithTools[])
      .filter((integration) => {
        // Filter out workspace-management to avoid duplicate document results
        if (integration.id === "i:workspace-management") return false;

        const toolsList = integration.tools ?? [];
        return toolsList.some((t) => SEARCH_TOOL_RE.test(t.name));
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

  // Wrap MentionNode with integration avatar support
  const MentionNodeWithAvatar = useCallback(
    // deno-lint-ignore no-explicit-any
    (props: any) => (
      <MentionNode
        {...props}
        IntegrationAvatar={IntegrationAvatar}
        ResourceIcon={() => <Icon name="description" />}
      />
    ),
    [],
  );

  // Wrap MentionDropdown with integration avatar support
  const MentionDropdownWithAvatar = useCallback(
    // deno-lint-ignore no-explicit-any
    (props: any) => (
      <MentionDropdown {...props} IntegrationAvatar={IntegrationAvatar} />
    ),
    [],
  );

  const extensions: Extensions = useMemo(() => {
    return [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: "is-empty",
        showOnlyWhenEditable: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class:
            "text-blue-500 hover:underline underline-offset-2 cursor-pointer transition-colors",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      // Underline, // TODO: Package hangs on install, add back later
      Highlight.configure({
        multicolor: true,
      }),
      createSlashCommands({
        includeFormatting: true,
      }),
      createUnifiedMentions({
        tools,
        resourceSearchers,
        callTool: (connection, args) =>
          callTool(
            connection as Parameters<typeof callTool>[0],
            args as Parameters<typeof callTool>[1],
          ),
        MentionNode: MentionNodeWithAvatar,
        MentionDropdown: MentionDropdownWithAvatar,
      }),
    ];
  }, [
    placeholder,
    locator,
    tools,
    resourceSearchers,
    MentionNodeWithAvatar,
    MentionDropdownWithAvatar,
  ]);

  const editor = useEditor(
    {
      extensions,
      content: value,
      editable: !disabled,
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-lg max-w-none w-full outline-none pb-20 break-words overflow-wrap-anywhere",
            className,
          ),
        },
      },
      onUpdate: ({ editor }) => {
        // Debounce all changes to prevent expensive markdown conversions on every keystroke
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
          const markdown = editor.storage.markdown.getMarkdown();
          onChange(markdown);
        }, 300);
      },
    },
    [extensions],
  );

  // Store locator in editor storage for extensions
  useEffect(() => {
    if (editor) {
      (editor.storage as Record<string, unknown>).locator = locator;
    }
  }, [editor, locator]);

  // Sync editor content with value prop changes
  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.storage.markdown.getMarkdown();
    if (value !== currentContent) {
      try {
        editor.commands.setContent(value, false);
      } catch (error) {
        console.error("Failed to set editor content:", error);
      }
    }
  }, [value, editor]);

  // Sync editable state
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("bg-background w-full max-w-full", className)}>
      <style>{`
        /* ProseMirror wrapping */
        .ProseMirror {
          width: 100%;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: pre-wrap;
        }

        /* Links - make them blue and clickable */
        .ProseMirror a {
          color: rgb(59 130 246) !important;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer !important;
          transition: color 0.15s ease;
        }
        
        .ProseMirror a:hover {
          text-decoration: none;
        }

        /* Base placeholder for all empty nodes */
        .ProseMirror p.is-empty::before {
          content: '${placeholder}';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* Heading placeholders */
        .ProseMirror h1.is-empty::before {
          content: 'Heading 1';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h2.is-empty::before {
          content: 'Heading 2';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h3.is-empty::before {
          content: 'Heading 3';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* List item placeholders */
        .ProseMirror li p.is-empty::before {
          content: 'List item';
          opacity: 0.5;
        }
        
        /* Blockquote placeholder */
        .ProseMirror blockquote p.is-empty::before {
          content: 'Quote';
          opacity: 0.5;
        }
        
        /* Code block placeholder */
        .ProseMirror pre code.is-empty::before {
          content: 'Code block';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }

        /* Slash command placeholder */
        .ProseMirror .slash-command-placeholder {
          color: var(--muted-foreground);
          pointer-events: none;
          user-select: none;
        }

        /* Show "Filter..." after typing / */
        .ProseMirror .ProseMirror-widget-suggestion::after {
          content: 'Filter...';
          color: var(--muted-foreground);
          pointer-events: none;
          user-select: none;
        }
      `}</style>
      <DocumentBubbleMenu editor={editor} />
      <div className="w-full max-w-full overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
