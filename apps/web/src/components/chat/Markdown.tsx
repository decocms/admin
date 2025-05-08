import { marked } from "marked";
import { memo, Suspense, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { lazy, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

const LazyHighlighter = lazy(() => import("./LazyHighlighter.tsx"));

function LazyHighlighterFallback() {
  const lines = [85, 70];

  return (
    <div
      className="p-4 font-mono text-sm"
      style={{
        background: "#2d2d2d",
        borderRadius: "0 0 0.5rem 0.5rem",
        overflow: "auto",
        minHeight: "4rem",
      }}
    >
      {lines.map((width, i) => (
        <div
          key={i}
          className="flex gap-2 items-center my-1"
        >
          {(i > 2 && i < 7) && (
            <div
              className="w-4 h-4 rounded-sm opacity-40 animate-pulse"
              style={{
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          )}

          {i % 4 === 0 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "3rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          )}

          {i % 3 === 1 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "2.5rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.14}s`,
              }}
            />
          )}

          <div
            className="h-4 rounded animate-pulse"
            style={{
              width: `${width}%`,
              background: "rgba(255, 255, 255, 0.1)",
              animationDelay: `${i * 0.1}s`,
            }}
          />

          {i % 5 === 2 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "4rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

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
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    // @ts-ignore - setTimeout returns number in browser
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 rounded-lg bg-muted overflow-hidden border border-border">
      <div className="flex items-center justify-between p-1 pl-4 bg-muted border-b border-border">
        <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest select-none">
          {language ? language : "text"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          aria-label="Copy code"
          className="text-muted-foreground hover:text-foreground rounded-lg h-8 w-8"
        >
          <Icon name={copied ? "check" : "content_copy"} size={14} />
        </Button>
      </div>

      <Suspense fallback={<LazyHighlighterFallback />}>
        <LazyHighlighter language={language} content={content} />
      </Suspense>
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
