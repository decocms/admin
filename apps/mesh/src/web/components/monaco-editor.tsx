import { useRef, useId } from "react";
import Editor, { loader, OnMount } from "@monaco-editor/react";
import type { Plugin } from "prettier";

// Lazy load Prettier modules
let prettierCache: {
  format: (code: string, options: object) => Promise<string>;
  plugins: Plugin[];
} | null = null;

const loadPrettier = async () => {
  if (prettierCache) return prettierCache;

  const [prettierModule, tsPlugin, estreePlugin] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/estree"),
  ]);

  prettierCache = {
    format: prettierModule.format,
    plugins: [tsPlugin.default, estreePlugin.default],
  };

  return prettierCache;
};

// Configure Monaco to load from CDN
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs",
  },
});

interface MonacoCodeEditorProps {
  code: string;
  onChange?: (value: string | undefined) => void;
  onSave?: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
  language?: "typescript" | "json";
}

export function MonacoCodeEditor({
  code,
  onChange,
  onSave,
  readOnly = false,
  height = 300,
  language = "typescript",
}: MonacoCodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Unique path so Monaco treats this as a TypeScript file
  const uniqueId = useId();
  const filePath =
    language === "typescript"
      ? `file:///workflow-${uniqueId.replace(/:/g, "-")}.tsx`
      : undefined;

  const formatWithPrettier = async (editor: Parameters<OnMount>[0]) => {
    const model = editor.getModel();
    if (!model) {
      console.warn("No model found");
      return;
    }

    const code = model.getValue();

    // For JSON, use native JSON formatting
    if (language === "json") {
      try {
        const parsed = JSON.parse(code);
        const formatted = JSON.stringify(parsed, null, 2);
        if (formatted !== code) {
          const fullRange = model.getFullModelRange();
          editor.executeEdits("json-format", [
            { range: fullRange, text: formatted },
          ]);
        }
      } catch (err) {
        console.error("JSON formatting failed:", err);
      }
      return;
    }

    // For TypeScript, use Prettier
    try {
      const { format, plugins } = await loadPrettier();

      const formatted = await format(code, {
        parser: "typescript",
        plugins: plugins,
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "es5",
        printWidth: 80,
      });

      // Only update if the formatted code is different
      if (formatted !== code) {
        const fullRange = model.getFullModelRange();
        editor.executeEdits("prettier", [
          {
            range: fullRange,
            text: formatted,
          },
        ]);
      }
    } catch (err) {
      console.error("Prettier formatting failed:", err);
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure TypeScript AFTER mount (beforeMount was causing value not to display)
    if (language === "typescript") {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowNonTsExtensions: true,
        allowJs: true,
        strict: false, // Less strict for workflow code
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowSyntheticDefaultImports: true,
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }

    // Auto-format on load
    setTimeout(() => {
      formatWithPrettier(editor);
    }, 300);

    // Add Ctrl+S / Cmd+S keybinding to format and save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      // Format the document first
      await formatWithPrettier(editor);

      // Then call onSave with the formatted value
      const value = editor.getValue();
      onSaveRef.current?.(value);
    });
  };

  const handleFormat = async () => {
    if (editorRef.current) {
      await formatWithPrettier(editorRef.current);
    }
  };

  return (
    <div className="rounded-lg border border-base-border h-full">
      <div className="flex justify-end gap-2 p-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <button
          onClick={handleFormat}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Format (⌘S)
        </button>
      </div>
      <Editor
        height={height}
        language={language}
        value={code}
        path={filePath}
        theme="vs-dark"
        onChange={onChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-400">
            Loading editor...
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          folding: true,
          bracketPairColorization: { enabled: true },
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          parameterHints: { enabled: true },
          inlineSuggest: { enabled: true },
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
