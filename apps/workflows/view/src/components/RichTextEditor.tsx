/**
 * Rich Text Editor with @ Mentions (Tiptap)
 * Minimal implementation
 */
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { MentionNode } from "./MentionNode";
import { useMentionItems, type MentionItem } from "@/hooks/useMentionItems";
import { useStepEditorActions, useStepEditorPrompt } from "@/store/step-editor";
import { useRef, useEffect, useCallback, useMemo } from "react";

interface TiptapSuggestionProps {
  items: MentionItem[];
  clientRect?: (() => DOMRect | null) | null;
  command: (item: { id: string; label: string; type: "tool" | "step" }) => void;
}

interface TiptapKeyDownProps {
  event: KeyboardEvent;
}

interface RichTextEditorProps {
  minHeight?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function RichTextEditor({
  minHeight = "120px",
  placeholder = "Type @ to mention...",
  value,
  onChange,
}: RichTextEditorProps) {
  const mentions = useMentionItems();
  const { setPrompt } = useStepEditorActions();
  const globalPrompt = useStepEditorPrompt();

  // PERFORMANCE: Memoize initial content to prevent unnecessary recalculations
  const initialContent = useMemo(
    () => (value !== undefined ? value : globalPrompt),
    [], // Empty deps - only calculate once on mount
  );

  // Use ref to store mentions so they're accessible in closure without recreating editor
  const mentionsRef = useRef<MentionItem[]>(mentions);

  // PERFORMANCE: Debounce timer ref to prevent store updates on every keystroke
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Store onChange and setPrompt in refs to prevent editor recreation
  const onChangeRef = useRef(onChange);
  const setPromptRef = useRef(setPrompt);

  // Update ref when mentions change
  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);

  // Update refs when props change (without causing editor recreation)
  useEffect(() => {
    onChangeRef.current = onChange;
    setPromptRef.current = setPrompt;
  }, [onChange, setPrompt]);

  // PERFORMANCE: Debounced onChange handler
  // Stores updates are expensive - batch them with 300ms delay
  // Using refs to keep this function stable and prevent editor recreation
  const debouncedOnChange = useCallback((text: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onChangeRef.current) {
        onChangeRef.current(text);
      } else {
        setPromptRef.current(text);
      }
    }, 300); // 300ms debounce - good balance between UX and performance
  }, []); // Empty deps - stable function that uses refs

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // PERFORMANCE: Memoize editor extensions to prevent recreation on every render
  // Creating new extensions causes the entire editor to remount, which is very expensive
  const extensions = useMemo(
    () => [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.extend({
        addAttributes() {
          return {
            id: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-id"),
              renderHTML: (attributes) => ({ "data-id": attributes.id }),
            },
            label: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-label"),
              renderHTML: (attributes) => ({
                "data-label": attributes.label,
              }),
            },
            type: {
              default: "tool",
              parseHTML: (element) => element.getAttribute("data-type"),
              renderHTML: (attributes) => ({ "data-type": attributes.type }),
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(MentionNode);
        },
      }).configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: ({ query }) => {
            const currentMentions = mentionsRef.current;
            const filtered = currentMentions
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, 20);
            return filtered;
          },
          render: () => {
            let popup: TippyInstance | undefined;
            let component: HTMLDivElement;
            let selectedIndex = 0;

            return {
              onStart: (props: TiptapSuggestionProps) => {
                component = document.createElement("div");
                component.className = "mention-dropdown";
                selectedIndex = 0;

                if (!props.clientRect) return;

                const getRect = (): DOMRect | ClientRect => {
                  const rect = props.clientRect?.();
                  return rect ?? new DOMRect();
                };

                popup = tippy(document.body, {
                  getReferenceClientRect: getRect,
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });

                renderItems(
                  component,
                  props.items,
                  selectedIndex,
                  props.command,
                );
              },
              onUpdate: (props: TiptapSuggestionProps) => {
                if (popup && component) {
                  renderItems(
                    component,
                    props.items,
                    selectedIndex,
                    props.command,
                  );
                  if (props.clientRect) {
                    const getRect = (): DOMRect | ClientRect => {
                      const rect = props.clientRect?.();
                      return rect ?? new DOMRect();
                    };
                    popup.setProps({ getReferenceClientRect: getRect });
                  }
                }
              },
              onKeyDown: (
                props: TiptapKeyDownProps & {
                  items?: MentionItem[];
                  command?: (item: {
                    id: string;
                    label: string;
                    type: "tool" | "step";
                  }) => void;
                },
              ) => {
                // Validate props.items exists and component is ready
                if (
                  !props.items ||
                  props.items.length === 0 ||
                  !component ||
                  !props.command
                ) {
                  return false;
                }

                if (props.event.key === "ArrowUp") {
                  selectedIndex = Math.max(0, selectedIndex - 1);
                  renderItems(
                    component,
                    props.items,
                    selectedIndex,
                    props.command,
                  );
                  return true;
                }

                if (props.event.key === "ArrowDown") {
                  selectedIndex = Math.min(
                    props.items.length - 1,
                    selectedIndex + 1,
                  );
                  renderItems(
                    component,
                    props.items,
                    selectedIndex,
                    props.command,
                  );
                  return true;
                }

                if (props.event.key === "Enter") {
                  const item = props.items[selectedIndex];
                  if (item) {
                    props.command({
                      id: item.id,
                      label: item.label,
                      type: item.type,
                    });
                    return true;
                  }
                }

                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                return false;
              },
              onExit: () => {
                popup?.destroy();
              },
            };
          },
        },
      }),
    ],
    [placeholder],
  ); // Only recreate extensions if placeholder changes

  // PERFORMANCE: Memoize style object to prevent re-renders
  const editorStyle = useMemo(() => ({ minHeight }), [minHeight]);

  // PERFORMANCE: Track last internal value to detect external changes
  // This is more reliable than a boolean flag
  const lastInternalValueRef = useRef<string>("");

  const editor = useEditor(
    {
      extensions,
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        // Track the internal value so we can detect external changes
        lastInternalValueRef.current = text;
        // PERFORMANCE: Use debounced handler to batch store updates
        debouncedOnChange(text);
      },
      content: initialContent, // Use memoized initial content
    },
    [extensions, initialContent],
  ); // Removed debouncedOnChange from deps since it's stable with empty deps

  // PERFORMANCE: Only update editor when value changes externally (not from typing)
  useEffect(() => {
    if (!editor || value === undefined) return;

    const currentText = editor.getText();

    // CRITICAL: Don't update if the text is already the same
    // This is the most important check - prevents ALL unnecessary updates
    if (currentText === value) return;

    // CRITICAL: Don't update if this matches our last internal value
    // This means the value prop change came from our own typing
    if (lastInternalValueRef.current === value) return;

    // Value changed externally (e.g., from undo/redo, external edit, etc.)
    // Update the editor content
    editor.commands.setContent(value);
    lastInternalValueRef.current = value;
  }, [editor, value]);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        style={editorStyle}
        className="tiptap-editor p-4 bg-card border border-border rounded-xl text-foreground text-base leading-relaxed"
      />
    </div>
  );
}

function renderItems(
  container: HTMLDivElement,
  items: MentionItem[],
  selectedIndex: number,
  command: (item: { id: string; label: string; type: "tool" | "step" }) => void,
) {
  if (items.length === 0) {
    container.innerHTML =
      '<div style="padding: 8px; color: var(--muted-foreground); font-size: 14px;">No results</div>';
    return;
  }

  container.innerHTML = items
    .map((item, index) => {
      const typeColor =
        item.type === "tool" ? "var(--success)" : "var(--primary)";
      const typeLabel = item.type === "tool" ? "🔧 Tool" : "📦 Step";
      const isSelected = index === selectedIndex;
      const bgColor = isSelected ? "var(--accent)" : "transparent";
      const textColor = isSelected
        ? "var(--foreground)"
        : "var(--muted-foreground)";
      return `
      <button class="mention-item" data-index="${index}" data-id="${item.id}" data-label="${item.label}" data-type="${item.type}" style="background: ${bgColor};">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-weight: 600; color: ${textColor}; font-size: 14px;">${item.label}</span>
          <span style="font-size: 11px; color: ${typeColor}; font-weight: 500;">${typeLabel}</span>
        </div>
        ${item.category ? `<div style="font-size: 11px; color: var(--muted-foreground); margin-bottom: 2px;">${item.category}</div>` : ""}
        ${item.description ? `<div style="font-size: 12px; color: var(--muted-foreground); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description}</div>` : ""}
      </button>
    `;
    })
    .join("");

  container.querySelectorAll(".mention-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const label = btn.getAttribute("data-label");
      const type = btn.getAttribute("data-type");
      if (id && label && (type === "tool" || type === "step")) {
        command({ id, label, type });
      }
    });
  });

  // Scroll selected item into view
  const selectedButton = container.querySelector(
    `[data-index="${selectedIndex}"]`,
  );
  if (selectedButton) {
    selectedButton.scrollIntoView({ block: "nearest" });
  }
}
