import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useChatContext } from "./context.tsx";

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: (props) => <p {...props} className="leading-relaxed" />,
          strong: (props) => <strong {...props} className="font-bold" />,
          em: (props) => <em {...props} className="italic" />,
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            />
          ),
          ul: (props) => (
            <ul {...props} className="list-disc ml-6 my-4 space-y-2" />
          ),
          ol: (props) => (
            <ol {...props} className="list-decimal ml-6 my-4 space-y-2" />
          ),
          li: (props) => <li {...props} className="leading-relaxed" />,
          code: (props) => (
            <code
              {...props}
              className="px-1 py-0.5 bg-gray-100 rounded text-sm font-mono"
            />
          ),
          pre: (props) => (
            <pre
              {...props}
              className="flex max-w-[calc(640px-64px)] my-4 bg-gray-100 rounded"
            >
              <code className="flex-1 min-w-0 p-4 text-sm font-mono whitespace-pre overflow-x-auto">
                {props.children}
              </code>
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
);

function CodeBlock(
  { language, content }: { language: string; content: string },
) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="my-4 rounded-lg bg-muted overflow-hidden border border-border">
      <div className="flex items-center justify-between p-1 pl-4 bg-muted border-b border-border">
        <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest select-none">
          {language ? language : "text"}
        </span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        aria-label="Copy code"
        className="text-muted-foreground hover:text-foreground rounded-lg h-8 w-8"
      >
        <Icon name={copied ? "check" : "content_copy"} size={14} />
      </Button>
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
    </div>
  );
}

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = (
  { content, id }: { content: string; id: string },
) => {
  const blocks = useMemo(() => marked.lexer(content), [content]);

  return blocks.map((block, index) => {
    if (block.type === "code") {
      return (
        <CodeBlock
          language={block.lang}
          content={block.text}
          key={`${id}-block_${index}`}
        />
      );
    }

    return (
      <MemoizedMarkdownBlock
        content={block.raw}
        key={`${id}-block_${index}`}
      />
    );
  });
};

MemoizedMarkdown.displayName = "MemoizedMarkdown";
