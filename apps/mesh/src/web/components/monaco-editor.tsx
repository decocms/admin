import { memo, useRef, useId, useState } from "react";
import Editor, {
  loader,
  OnMount,
  type EditorProps,
} from "@monaco-editor/react";
import type { Plugin } from "prettier";
import { Spinner } from "@deco/ui/components/spinner.js";

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

// ============================================
// Static Constants (module-scoped for stability)
// ============================================

const PRETTIER_OPTIONS = {
  parser: "typescript",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
} as const;

const EDITOR_BASE_OPTIONS: EditorProps["options"] = {
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
};

const LoadingPlaceholder = (
  <div className="flex items-center justify-center h-full w-full bg-[#1e1e1e] text-gray-400">
    <Spinner size="sm" />
  </div>
);

interface MonacoCodeEditorProps {
  code: string;
  onChange?: (value: string | undefined) => void;
  onSave?: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
  language?: "typescript" | "json";
}

export const MonacoCodeEditor = memo(function MonacoCodeEditor({
  code,
  onChange,
  onSave,
  readOnly = false,
  height = 300,
  language = "typescript",
}: MonacoCodeEditorProps) {
  const [isDirty, setIsDirty] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Store language in ref to avoid stale closures in editor callbacks
  const languageRef = useRef(language);
  languageRef.current = language;

  // Unique path so Monaco treats this as a TypeScript file
  const uniqueId = useId();
  const filePath =
    language === "typescript"
      ? `file:///workflow-${uniqueId.replace(/:/g, "-")}.tsx`
      : undefined;

  // Compute options with readOnly merged in
  const editorOptions = readOnly
    ? { ...EDITOR_BASE_OPTIONS, readOnly: true }
    : EDITOR_BASE_OPTIONS;

  // Format function that uses refs to avoid stale closures
  const formatWithPrettier = async (editorInstance: Parameters<OnMount>[0]) => {
    const model = editorInstance.getModel();
    if (!model) {
      console.warn("No model found");
      return;
    }

    const currentCode = model.getValue();
    const currentLanguage = languageRef.current;

    // For JSON, use native JSON formatting
    if (currentLanguage === "json") {
      try {
        const parsed = JSON.parse(currentCode);
        const formatted = JSON.stringify(parsed, null, 2);
        if (formatted !== currentCode) {
          const fullRange = model.getFullModelRange();
          editorInstance.executeEdits("json-format", [
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

      const formatted = await format(currentCode, {
        ...PRETTIER_OPTIONS,
        plugins,
      });

      // Only update if the formatted code is different
      if (formatted !== currentCode) {
        const fullRange = model.getFullModelRange();
        editorInstance.executeEdits("prettier", [
          { range: fullRange, text: formatted },
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

    editor.getModel()?.onDidChangeContent(() => {
      setIsDirty(true);
    });

    // Add Ctrl+S / Cmd+S keybinding to format and save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      // Format the document first
      await formatWithPrettier(editor);

      // Then call onSave with the formatted value
      const value = editor.getValue();
      onSaveRef.current?.(value);
      setIsDirty(false);
    });
  };

  const handleFormat = async () => {
    if (editorRef.current) {
      await formatWithPrettier(editorRef.current);
    }
  };

  const handleSave = async () => {
    if (editorRef.current) {
      await formatWithPrettier(editorRef.current);
      const value = editorRef.current.getValue();
      onSaveRef.current?.(value);
      setIsDirty(false);
    }
  };

  return (
    <div className="rounded-lg border border-base-border h-full">
      <div className="flex justify-end gap-2 p-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <button
          onClick={handleFormat}
          disabled={!isDirty}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Format
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save (⌘S)
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
        loading={LoadingPlaceholder}
        options={editorOptions}
      />
    </div>
  );
});
