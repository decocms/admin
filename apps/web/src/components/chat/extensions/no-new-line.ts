import { Extension } from "@tiptap/react";

export const NoNewLine = Extension.create({
  name: "noNewLine",

  addKeyboardShortcuts() {
    return {
      Enter: () => true,
    };
  },
});
