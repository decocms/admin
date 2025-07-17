import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - correct 
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism/index.js";

interface LazyHighlighterProps {
  language: string;
  content: string;
}

function LazyHighlighter({ language, content }: LazyHighlighterProps) {
  return (
    <SyntaxHighlighter
      language={language || "text"}
      style={tomorrow}
      customStyle={{
        margin: 0,
        padding: "1rem",
        fontSize: "0.875rem",
        borderRadius: "0 0 0.5rem 0.5rem",
        background: "#2d2d2d",
        position: "relative",
        overflow: "auto",
      }}
      codeTagProps={{
        className: "font-mono",
      }}
    >
      {content}
    </SyntaxHighlighter>
  );
}

export default LazyHighlighter;
