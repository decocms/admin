import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - correct
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism/index.js";

interface LazyHighlighterProps {
  language: string;
  content: string;
  fillHeight?: boolean;
}

function LazyHighlighter({
  language,
  content,
  fillHeight = false,
}: LazyHighlighterProps) {
  return (
    <SyntaxHighlighter
      language={language || "text"}
      style={tomorrow}
      showLineNumbers
      customStyle={{
        margin: 0,
        padding: "1rem",
        fontSize: "14px",
        borderRadius: "0.5rem",
        background: "#263238",
        position: "relative",
        overflowX: "hidden",
        overflowY: "visible",
        width: "100%",
        maxWidth: "100%",
        display: "block",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        height: fillHeight ? "100%" : undefined,
        minHeight: fillHeight ? "100%" : undefined,
      }}
      lineNumberStyle={{
        minWidth: "2.5em",
        paddingRight: "1.5em",
        color: "rgba(115, 115, 115, 0.5)",
        textAlign: "right",
        userSelect: "none",
        fontSize: "14px",
        fontFamily: "'CommitMono', 'Roboto Mono', monospace",
      }}
      codeTagProps={{
        className: "font-mono",
        style: {
          wordBreak: "break-word",
          overflowWrap: "break-word",
          whiteSpace: "pre-wrap",
          fontSize: "14px",
          fontFamily: "'CommitMono', 'Roboto Mono', monospace",
          lineHeight: "1.5",
        },
      }}
      wrapLongLines
    >
      {content}
    </SyntaxHighlighter>
  );
}

export default LazyHighlighter;
