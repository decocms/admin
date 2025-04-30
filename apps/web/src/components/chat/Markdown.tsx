import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
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

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return blocks.map((block, index) => (
      <MemoizedMarkdownBlock
        content={block}
        key={`${id}-block_${index}`}
      />
    ));
  },
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
