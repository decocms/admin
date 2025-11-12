import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { lazy, memo, Suspense, useMemo, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useCopy } from "../../hooks/use-copy.ts";

const LazyHighlighter = lazy(() => import("./lazy-highlighter.tsx"));

const MAX_TREE_DEPTH = 10;

const TreeNode = memo(function TreeNode({
  nodeKey,
  value,
  level = 0,
}: {
  nodeKey?: string;
  value: unknown;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const indent = level * 16;

  const getValueType = (val: unknown): string => {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    return typeof val;
  };

  const getCount = (val: unknown): number | null => {
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === "object") return Object.keys(val).length;
    return null;
  };

  const isExpandable = (val: unknown): boolean => {
    return (
      (Array.isArray(val) && val.length > 0) ||
      (val !== null &&
        typeof val === "object" &&
        Object.keys(val as object).length > 0)
    );
  };

  const valueType = getValueType(value);
  const count = getCount(value);
  const canExpand = isExpandable(value);

  // Pre-compute entries for expandable objects/arrays - must be called before any conditional returns
  const entries = useMemo(
    () =>
      canExpand
        ? Array.isArray(value)
          ? value.map((item, index) => [index.toString(), item] as const)
          : Object.entries(value as Record<string, unknown>)
        : [],
    [value, canExpand],
  );

  // Check for max depth - prevents infinite recursion and excessive nesting
  if (level >= MAX_TREE_DEPTH && canExpand) {
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 text-sm leading-normal min-w-0"
      >
        <div className="w-4 shrink-0" />
        <span className="min-w-0 flex-1 wrap-anywhere">
          {nodeKey && (
            <span className="text-[#61afef] shrink-0">{nodeKey}: </span>
          )}
          <span className="text-[#5c6370]">[Max Depth Reached]</span>
        </span>
      </div>
    );
  }

  // Render primitive values
  if (!canExpand) {
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 text-sm leading-normal min-w-0"
      >
        <div className="w-4 shrink-0" />
        <span className="min-w-0 flex-1 wrap-anywhere">
          {nodeKey && (
            <span className="text-[#61afef] shrink-0">{nodeKey}: </span>
          )}
          {value === null ? (
            <span className="text-[#c678dd]">null</span>
          ) : typeof value === "boolean" ? (
            <span className="text-[#c678dd]">{value.toString()}</span>
          ) : typeof value === "number" ? (
            <span className="text-[#d19a66]">{value}</span>
          ) : typeof value === "string" ? (
            <span className="text-[#98c379]">{value}</span>
          ) : (
            <span className="text-[#abb2bf]">{String(value)}</span>
          )}
        </span>
      </div>
    );
  }

  // Render expandable objects/arrays
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 w-full text-left hover:bg-white/5 transition-colors rounded leading-normal min-w-0"
      >
        <Icon
          name="chevron_right"
          className={cn(
            "w-4 h-4 text-[#5c6370] transition-transform shrink-0 mt-0.5",
            isOpen && "rotate-90",
          )}
        />
        <div className="min-w-0 flex-1 wrap-anywhere">
          {nodeKey && (
            <span className="text-[#61afef] shrink-0">{nodeKey}: </span>
          )}
          <span className="text-[#5c6370]">
            {valueType}{" "}
            {count !== null && (
              <span className="text-[#56b6c2]">{`{${count}}`}</span>
            )}
          </span>
        </div>
      </button>
      {isOpen && (
        <div>
          {entries.map(([key, val]) => (
            <TreeNode key={key} nodeKey={key} value={val} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
});

function JsonTreeView({ data }: { data: unknown }) {
  return (
    <div
      className="p-4 text-sm overflow-auto rounded-lg h-full"
      style={{ background: "#282c34" }}
    >
      <TreeNode value={data} level={0} />
    </div>
  );
}

interface JsonViewerProps {
  data: unknown;
  defaultView?: "code" | "tree";
  maxHeight?: string;
  showControls?: boolean;
  className?: string;
}

export function JsonViewer({
  data,
  defaultView = "code",
  maxHeight = "500px",
  showControls = true,
  className,
}: JsonViewerProps) {
  const { handleCopy, copied } = useCopy();
  const [viewMode, setViewMode] = useState<"code" | "tree">(defaultView);
  const [showButtons, setShowButtons] = useState(false);

  const jsonString = useMemo(() => {
    const stringified = JSON.stringify(data, null, 2);
    return stringified ? stringified.replace(/"(\w+)":/g, '"$1":') : "{}";
  }, [data]);

  const isFullHeight = maxHeight === "100%";

  return (
    <div
      className={cn(
        "relative min-w-0 flex flex-col",
        isFullHeight ? "h-full" : "max-h-[500px]",
        className,
      )}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      onFocus={() => setShowButtons(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setShowButtons(false);
        }
      }}
    >
      {showControls && showButtons && (
        <div className="absolute top-2 right-2 flex items-center bg-background gap-0.5 shadow-sm rounded-md z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setViewMode((prev) => (prev === "code" ? "tree" : "code"));
            }}
            className="size-8 rounded-none rounded-l-md hover:bg-accent/50 transition-colors"
            title={viewMode === "code" ? "Show tree view" : "Show code view"}
          >
            <Icon
              name={viewMode === "code" ? "account_tree" : "code"}
              className="w-4 h-4 text-muted-foreground"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(jsonString);
            }}
            className="size-8 rounded-none rounded-r-md hover:bg-accent/50 transition-colors"
            title={copied ? "Copied" : "Copy JSON"}
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </Button>
        </div>
      )}
      <div
        className={cn(
          "overflow-x-auto min-w-0",
          isFullHeight ? "h-full w-full" : "overflow-y-auto flex-1",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {viewMode === "code" ? (
          <ErrorBoundary
            fallback={
              <pre
                className={cn(
                  "p-4 text-xs whitespace-pre-wrap break-all rounded-lg m-0",
                  isFullHeight && "h-full",
                )}
                style={{ background: "#282c34", color: "#abb2bf" }}
              >
                <code className="select-text cursor-auto">
                  {jsonString || "Loading..."}
                </code>
              </pre>
            }
          >
            <Suspense
              fallback={
                <pre
                  className={cn(
                    "p-4 text-xs whitespace-pre-wrap break-all rounded-lg m-0",
                    isFullHeight && "h-full",
                  )}
                  style={{ background: "#282c34", color: "#abb2bf" }}
                >
                  <code className="select-text cursor-auto">
                    {jsonString || "Loading..."}
                  </code>
                </pre>
              }
            >
              <LazyHighlighter
                language="json"
                content={jsonString || "{}"}
                fillHeight={isFullHeight}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <JsonTreeView data={data} />
        )}
      </div>
    </div>
  );
}
