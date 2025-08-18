import { Extension } from '@tiptap/react';

export interface NoNewLineOptions {
  shouldPreventNewLine: () => boolean;
}

export const NoNewLine = Extension.create<NoNewLineOptions>({
  name: 'noNewLine',

  addOptions() {
    return {
      shouldPreventNewLine: () => true,
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.options.shouldPreventNewLine(),
    };
  },
});
