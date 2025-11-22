import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@deco/ui/components/tabs.tsx";
import {
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
  useEffect,
} from "react";
import { toast } from "sonner";
import { useAgenticChat } from "../chat/provider.tsx";
import { CustomEvents } from "../../utils/custom-events.ts";
import { formatLogEntry } from "../../utils/format-time.ts";

export interface ConsoleLog {
  id: string;
  type: "info" | "warn" | "error" | "log" | "navigation" | "click";
  message: string;
  timestamp: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  expanded?: boolean;
}

interface ConsoleContextValue {
  logs: ConsoleLog[];
  errorCount: number;
  warningCount: number;
  clearLogs: () => void;
}

const ConsoleContext = createContext<ConsoleContextValue>({
  logs: [],
  errorCount: 0,
  warningCount: 0,
  clearLogs: () => {},
});

export function useConsoleState() {
  return useContext(ConsoleContext);
}

interface ViewConsoleProviderProps {
  children: React.ReactNode;
}

export function ViewConsoleProvider({ children }: ViewConsoleProviderProps) {
  const [logs, setLogs] = useState<ConsoleLog[]>(() => [
    {
      id: crypto.randomUUID(),
      type: "info",
      message: "Welcome to deco",
      timestamp: new Date().toISOString(),
      expanded: false,
    },
  ]);

  const { runtimeErrorEntries } = useAgenticChat();

  // Define trusted origins for postMessage validation
  const trustedOrigins = useMemo(() => {
    const origins = new Set<string>();

    // Add the app's own origin
    if (typeof window !== "undefined") {
      origins.add(window.location.origin);
    }

    // Allow blob: origins (used by iframe with srcDoc)
    // Note: blob URLs will have origin matching the parent origin

    // Allow null origin for sandboxed iframes with data: or srcdoc
    origins.add("null");

    return origins;
  }, []);

  const isTrustedOrigin = useCallback(
    (origin: string): boolean => {
      // Check if origin matches trusted origins
      if (trustedOrigins.has(origin)) {
        return true;
      }

      // Allow origins that match the app's origin (for blob: URLs)
      if (typeof window !== "undefined" && origin === window.location.origin) {
        return true;
      }

      return false;
    },
    [trustedOrigins],
  );

  // Handle console messages from iframe via postMessage
  const handleConsoleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate origin before processing any message data
      if (!isTrustedOrigin(event.origin)) {
        console.warn(
          "Rejected console message from untrusted origin:",
          event.origin,
        );
        return;
      }

      // Validate event source (should be from a window)
      if (!event.source || typeof event.source !== "object") {
        return;
      }

      // Now safe to access event.data
      if (!event.data || !event.data.type) return;

      // Handle console logs from iframe
      if (event.data.type === "CONSOLE_LOG") {
        const { level, message, timestamp } = event.data.payload;
        const logEntry: ConsoleLog = {
          id: crypto.randomUUID(),
          type: level || "log",
          message: message || "",
          timestamp: timestamp || new Date().toISOString(),
          expanded: false,
        };
        setLogs((prev) => [...prev, logEntry]);
      }
    },
    [isTrustedOrigin],
  );

  // Set up message listener on mount
  useEffect(() => {
    window.addEventListener("message", handleConsoleMessage);
    return () => window.removeEventListener("message", handleConsoleMessage);
  }, [handleConsoleMessage]);

  // Sync runtime errors from chat provider to console logs
  useEffect(() => {
    // Add new runtime errors to console logs
    const newLogs = runtimeErrorEntries.map(
      (error): ConsoleLog => ({
        id: error.timestamp + error.message, // Use combination for stable ID
        type: "error",
        message: error.message || "Unknown error",
        timestamp: error.timestamp || new Date().toISOString(),
        source: error.source,
        line: error.line,
        column: error.column,
        stack: error.stack,
        expanded: false,
      }),
    );

    // Replace existing error logs with new ones from runtime errors
    setLogs((prev) => {
      // Keep non-error logs
      const nonErrorLogs = prev.filter((log) => log.type !== "error");
      // Combine with new error logs
      return [...nonErrorLogs, ...newLogs].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    });
  }, [runtimeErrorEntries]);

  const errorCount = logs.filter((log) => log.type === "error").length;
  const warningCount = logs.filter((log) => log.type === "warn").length;

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <ConsoleContext.Provider
      value={{ logs, errorCount, warningCount, clearLogs }}
    >
      {children}
    </ConsoleContext.Provider>
  );
}

interface ViewConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ViewConsole({ isOpen, onClose }: ViewConsoleProps) {
  const { logs, errorCount, clearLogs } = useConsoleState();
  const { clearError } = useAgenticChat();
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("console");
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

  const handleClear = useCallback(() => {
    clearLogs();
    clearError();
  }, [clearLogs, clearError]);

  const handleSendLogs = useCallback(() => {
    if (logs.length === 0) {
      toast.info("No console logs to send");
      return;
    }

    // Format logs as text
    const logText = logs.map((log) => formatLogEntry(log)).join("\n\n");

    // Add logs to chat context
    CustomEvents.addLogs({ logs: logText });
    toast.success("Console logs added to chat");
  }, [logs]);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, []);

  const handleCopyLogs = useCallback(() => {
    const logText = logs
      .map((log) => {
        const time = formatTime(log.timestamp);
        const source = log.source
          ? ` [${log.source}:${log.line}:${log.column}]`
          : "";
        const stack = log.stack ? `\n${log.stack}` : "";
        return `[${time}] ${log.type.toUpperCase()}: ${log.message}${source}${stack}`;
      })
      .join("\n\n");

    navigator.clipboard
      .writeText(logText)
      .then(() => {
        // Could show a toast here if desired
        console.log("Logs copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy logs:", err);
      });
  }, [logs, formatTime]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (!showErrors && log.type === "error") return false;
    if (!showWarnings && log.type === "warn") return false;
    if (!showInfo && (log.type === "info" || log.type === "log")) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (!isOpen) {
    return null;
  }

  const getLogIcon = (type: ConsoleLog["type"]) => {
    switch (type) {
      case "error":
        return <Icon name="cancel" size={14} className="text-red-600" />;
      case "warn":
        return <Icon name="warning" size={14} className="text-yellow-600" />;
      case "info":
        return <Icon name="info" size={14} className="text-blue-600" />;
      case "navigation":
        return (
          <Icon name="arrow_forward" size={14} className="text-blue-600" />
        );
      case "click":
        return (
          <Icon name="ads_click" size={14} className="text-muted-foreground" />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-96 bg-background border-t border-border flex flex-col shrink-0">
      {/* Tabs Header */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full gap-0"
      >
        <div className="relative">
          <TabsList variant="underline" className="w-full h-10">
            <TabsTrigger value="console" variant="underline" className="gap-2">
              Console
              {errorCount > 0 && (
                <Badge
                  variant="destructive"
                  className="size-2 p-0 rounded-full"
                ></Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="network" variant="underline">
              Network
            </TabsTrigger>
            <TabsTrigger value="tools" variant="underline">
              Tools
            </TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 absolute right-2 top-1/2 -translate-y-1/2"
            title="Close console"
          >
            <Icon name="close" size={14} />
          </Button>
        </div>

        <TabsContent
          value="console"
          className="flex-1 flex flex-col mt-0 overflow-hidden"
        >
          {/* Filter Bar */}
          <div className="flex items-center px-4 py-2 border-b border-border bg-muted/20">
            <Icon name="search" size={16} className="text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter"
              className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm"
            />
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={showErrors ? "outline" : "ghost"}
                size="sm"
                onClick={() => setShowErrors(!showErrors)}
                className="h-7 px-2 text-xs"
              >
                <Icon name="cancel" size={12} className="mr-1" />
                Errors
              </Button>
              <Button
                variant={showWarnings ? "outline" : "ghost"}
                size="sm"
                onClick={() => setShowWarnings(!showWarnings)}
                className="h-7 px-2 text-xs"
              >
                <Icon name="warning" size={12} className="mr-1" />
                Warnings
              </Button>
              <Button
                variant={showInfo ? "outline" : "ghost"}
                size="sm"
                onClick={() => setShowInfo(!showInfo)}
                className="h-7 px-2 text-xs"
              >
                <Icon name="info" size={12} className="mr-1" />
                Info
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSendLogs}
                className="h-7 w-7"
                title="Send console logs to chat"
              >
                <Icon name="description" size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyLogs}
                className="h-7 w-7"
                title="Copy logs to clipboard"
              >
                <Icon name="content_copy" size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-7 w-7"
                title="Clear console"
              >
                <Icon name="block" size={14} />
              </Button>
            </div>
          </div>

          {/* Console Output */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="font-mono text-xs pb-4">
              {filteredLogs.length === 0 ? (
                <div className="p-4 text-muted-foreground italic">
                  No messages
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 px-4 py-1.5 border-b border-border/50 hover:bg-muted/50 ${
                      log.type === "error" ? "bg-destructive/10" : ""
                    }`}
                  >
                    <div className="shrink-0 mt-0.5 w-3.5" />
                    <span className="text-muted-foreground shrink-0 mt-0.5 tabular-nums text-xs">
                      {formatTime(log.timestamp)}
                    </span>
                    <div className="shrink-0 mt-0.5">
                      {getLogIcon(log.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`wrap-break-word text-xs ${
                          log.type === "error"
                            ? "text-destructive"
                            : log.type === "warn"
                              ? "text-yellow-600 dark:text-yellow-500"
                              : log.type === "info"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-foreground"
                        }`}
                      >
                        {log.message}
                      </div>
                      {log.source && (
                        <div className="text-muted-foreground text-[10px] mt-1">
                          {log.source}:{log.line}:{log.column}
                        </div>
                      )}
                      {log.stack && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground hover:underline">
                            Stack trace
                          </summary>
                          <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap bg-muted/30 border border-border p-2 rounded">
                            {log.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="network"
          className="flex-1 flex items-center justify-center mt-0"
        >
          <div className="text-sm text-muted-foreground">
            Network monitoring coming soon
          </div>
        </TabsContent>

        <TabsContent
          value="tools"
          className="flex-1 flex items-center justify-center mt-0"
        >
          <div className="text-sm text-muted-foreground">
            Tool inspector coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
