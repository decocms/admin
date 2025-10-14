/**
 * Rich Text Editor with @ Mentions (Tiptap)
 * Minimal implementation
 */
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionNode } from './MentionNode';
import { useMentionItems } from '@/hooks/useMentionItems';
import { useStepEditorActions, useStepEditorPrompt } from '@/store/step-editor';
import { useRef, useEffect } from 'react';

interface MentionItem {
  id: string;
  label: string;
  type: 'tool' | 'step';
  description?: string;
  category?: string;
}

export function RichTextEditor({ minHeight = '120px', placeholder = 'Type @ to mention...'}: { minHeight?: string, placeholder?: string }) {
  const mentions = useMentionItems();
  const { setPrompt } = useStepEditorActions();
  const prompt = useStepEditorPrompt();
  
  // Use ref to store mentions so they're accessible in closure without recreating editor
  const mentionsRef = useRef<MentionItem[]>(mentions);
  
  // Update ref when mentions change
  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.extend({
        addAttributes() {
          return {
            id: {
              default: null,
              parseHTML: element => element.getAttribute('data-id'),
              renderHTML: attributes => ({ 'data-id': attributes.id }),
            },
            label: {
              default: null,
              parseHTML: element => element.getAttribute('data-label'),
              renderHTML: attributes => ({ 'data-label': attributes.label }),
            },
            type: {
              default: 'tool',
              parseHTML: element => element.getAttribute('data-type'),
              renderHTML: attributes => ({ 'data-type': attributes.type }),
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(MentionNode);
        },
      }).configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }) => {
            const currentMentions = mentionsRef.current;
            console.log('🔍 [Tiptap] Filtering mentions - Total available:', currentMentions.length, 'Query:', query);
            const filtered = currentMentions.filter(item =>
              item.label.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 20);
            console.log('✅ [Tiptap] Filtered results:', filtered.length);
            return filtered;
          },
          render: () => {
            let popup: TippyInstance | undefined;
            let component: HTMLDivElement;
            let selectedIndex = 0;

            return {
              onStart: (props: any) => {
                component = document.createElement('div');
                component.className = 'mention-dropdown';
                selectedIndex = 0;
                
                if (!props.clientRect) return;

                popup = tippy(document.body, {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });

                renderItems(component, props.items, selectedIndex, props.command);
              },
              onUpdate: (props: any) => {
                if (popup && component) {
                  renderItems(component, props.items, selectedIndex, props.command);
                  popup.setProps({ getReferenceClientRect: props.clientRect });
                }
              },
              onKeyDown: (props: any) => {
                console.log('⌨️ [Tiptap] Key pressed:', props.event.key, 'Items:', props.items?.length, 'Component:', !!component);
                
                // Validate props.items exists and component is ready
                if (!props.items || props.items.length === 0 || !component) {
                  console.log('⚠️ [Tiptap] Skipping - no items or component');
                  return false;
                }
                
                if (props.event.key === 'ArrowUp') {
                  console.log('⬆️ [Tiptap] Arrow Up - selectedIndex:', selectedIndex);
                  selectedIndex = Math.max(0, selectedIndex - 1);
                  renderItems(component, props.items, selectedIndex, props.command);
                  console.log('✅ [Tiptap] New selectedIndex:', selectedIndex);
                  return true;
                }
                
                if (props.event.key === 'ArrowDown') {
                  console.log('⬇️ [Tiptap] Arrow Down - selectedIndex:', selectedIndex);
                  selectedIndex = Math.min(props.items.length - 1, selectedIndex + 1);
                  renderItems(component, props.items, selectedIndex, props.command);
                  console.log('✅ [Tiptap] New selectedIndex:', selectedIndex);
                  return true;
                }
                
                if (props.event.key === 'Enter') {
                  console.log('⏎ [Tiptap] Enter - selectedIndex:', selectedIndex);
                  const item = props.items[selectedIndex];
                  if (item) {
                    console.log('✅ [Tiptap] Selecting item:', item.label);
                    props.command({ id: item.id, label: item.label, type: item.type });
                    return true;
                  }
                }
                
                if (props.event.key === 'Escape') {
                  console.log('⎋ [Tiptap] Escape - closing popup');
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
    onUpdate: ({ editor }) => { 
      setPrompt(editor.getText());
    },
    content: prompt,
  }, []); // Empty deps - mentions are accessed via ref, avoiding recreation

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="tiptap-editor p-4 bg-card border border-border rounded-xl text-foreground text-base leading-relaxed"
      />
      <style>{`
        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: ${minHeight};
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--muted-foreground);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .mention-dropdown {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 6px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          max-height: 320px;
          overflow: auto;
          min-width: 400px;
          max-width: 500px;
        }
        .mention-item {
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.1s;
          margin-bottom: 2px;
        }
        .mention-item:hover {
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}

function renderItems(
  container: HTMLDivElement,
  items: MentionItem[],
  selectedIndex: number,
  command: (item: any) => void
) {
  if (items.length === 0) {
    container.innerHTML = '<div style="padding: 8px; color: var(--muted-foreground); font-size: 14px;">No results</div>';
    return;
  }

  console.log('🎨 [renderItems] Items:', items.map(i => ({ id: i.id, label: i.label, type: i.type })));
  
  container.innerHTML = items.map((item, index) => {
    const typeColor = item.type === 'tool' ? 'var(--success)' : 'var(--primary)';
    const typeLabel = item.type === 'tool' ? '🔧 Tool' : '📦 Step';
    const isSelected = index === selectedIndex;
    const bgColor = isSelected ? 'var(--accent)' : 'transparent';
    const textColor = isSelected ? 'var(--foreground)' : 'var(--muted-foreground)';
    return `
      <button class="mention-item" data-index="${index}" data-id="${item.id}" data-label="${item.label}" data-type="${item.type}" style="background: ${bgColor};">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-weight: 600; color: ${textColor}; font-size: 14px;">${item.label}</span>
          <span style="font-size: 11px; color: ${typeColor}; font-weight: 500;">${typeLabel}</span>
        </div>
        ${item.category ? `<div style="font-size: 11px; color: var(--muted-foreground); margin-bottom: 2px;">${item.category}</div>` : ''}
        ${item.description ? `<div style="font-size: 12px; color: var(--muted-foreground); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description}</div>` : ''}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.mention-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const label = btn.getAttribute('data-label');
      const type = btn.getAttribute('data-type');
      command({ id, label, type });
    });
  });
  
  // Scroll selected item into view
  const selectedButton = container.querySelector(`[data-index="${selectedIndex}"]`);
  if (selectedButton) {
    selectedButton.scrollIntoView({ block: 'nearest' });
  }
}
